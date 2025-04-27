const { v4: uuidv4 } = require('uuid');
const FinancialDocumentService = require("../financialDocumentService");
const Sentry = require("../../instrument");
const InvoiceRepository = require('../../repositories/invoiceRepository.js');
const CustomerRepository = require('../../repositories/customerRepository.js');
const VendorRepository = require('../../repositories/vendorRepository.js');
const ItemRepository = require('../../repositories/itemRepository.js');
const AzureDocumentAnalyzer = require('../analysis/azureDocumentAnalyzer');
const InvoiceValidator = require('./invoiceValidator');
const InvoiceResponseFormatter = require('./invoiceResponseFormatter');
const { AzureInvoiceMapper } = require('../invoiceMapperService/invoiceMapperService');
const InvoiceLogger = require('./invoiceLogger');
const DocumentStatus = require('../../models/enums/DocumentStatus.js');
const { NotFoundError } = require('../../utils/errors.js');

class InvoiceService extends FinancialDocumentService {
  constructor(dependencies = {}) {
    // Panggil konstruktor parent dengan type dokumen dan s3Service
    super("Invoice", dependencies.s3Service);
    
    // Inisialisasi repositories
    this.invoiceRepository = dependencies.invoiceRepository || new InvoiceRepository();
    this.customerRepository = dependencies.customerRepository || new CustomerRepository();
    this.vendorRepository = dependencies.vendorRepository || new VendorRepository();
    this.itemRepository = dependencies.itemRepository || new ItemRepository();
    
    // Inisialisasi services
    this.documentAnalyzer = dependencies.documentAnalyzer || new AzureDocumentAnalyzer();
    this.validator = dependencies.validator || new InvoiceValidator();
    this.responseFormatter = dependencies.responseFormatter || new InvoiceResponseFormatter();
    this.azureMapper = dependencies.azureMapper || new AzureInvoiceMapper();
    
    // Logger menggunakan nilai default jika tidak ada
    this.logger = dependencies.logger || this.logger;
  }
  
  async uploadInvoice(fileData) {
    try {
      this.validator.validateFileData(fileData);
      const { buffer, originalname, partnerId } = fileData;

      const invoiceUuid = uuidv4();
      this.logger.logUploadStart(invoiceUuid, partnerId, originalname);

      let s3Result;
      try {
        s3Result = await this.uploadFile(fileData);
        this.logger.logUploadSuccess(invoiceUuid, s3Result.file_url);
      } catch (error) {
        this.logger.logError(invoiceUuid, error, 'S3_UPLOAD');
        throw new Error("Failed to upload file to S3");
      }

      await this.invoiceRepository.createInitial({
        id: invoiceUuid,
        status: DocumentStatus.PROCESSING,
        partner_id: partnerId,
        file_url: s3Result.file_url,
        original_filename: originalname,
        file_size: buffer.length,
      });

      this.processInvoiceAsync(invoiceUuid, buffer, partnerId, originalname, invoiceUuid);

      return {
        message: "Invoice upload initiated",
        id: invoiceUuid,
        status: DocumentStatus.PROCESSING
      };
    } catch (error) {
      this.logger.logError(null, error, 'UPLOAD_INITIATION');
      throw new Error(`Failed to process invoice: ${error.message}`);
    }
  }

  /**
     * Process invoice asynchronously in background
     * @private
     */
  async processInvoiceAsync(invoiceId, buffer, partnerId, originalname, uuid) {
    try {
      this.logger.logProcessingStart(invoiceId);
      Sentry.addBreadcrumb({
        category: "invoiceProcessing",
        message: `Starting async processing for invoice ${uuid}`,
        level: "info"
      });

      // 1. Analisis invoice menggunakan Azure
      const analysisResult = await this.analyzeInvoice(buffer);

      // 2. Upload hasil OCR ke S3 sebagai JSON dan dapatkan URL-nya
      const jsonUrl = await this.uploadAnalysisResults(analysisResult, invoiceId);
      this.logger.logAnalysisComplete(invoiceId, jsonUrl);

      // 3. Map hasil analisis ke model data
      const { invoiceData, customerData, vendorData, itemsData } =
        this.mapAnalysisResult(analysisResult, partnerId, originalname, buffer.length);

      this.logger.logDataMappingComplete(invoiceId, {
        hasCustomerData: !!customerData,
        hasVendorData: !!vendorData,
        itemsCount: itemsData?.length
      });

      // 4. Update record invoice dengan data hasil analisis dan URL JSON
      await this.updateInvoiceRecord(invoiceId, {
        ...invoiceData,
        analysis_json_url: jsonUrl
      });

      // 5. Update data customer dan vendor
      await this.updateCustomerAndVendorData(invoiceId, customerData, vendorData);

      // 6. Simpan item invoice
      await this.saveInvoiceItems(invoiceId, itemsData);

      // 7. Update status menjadi "Analyzed"
      await this.invoiceRepository.update(invoiceId, { status: DocumentStatus.ANALYZED });

      this.logger.logProcessingComplete(invoiceId);
      Sentry.captureMessage(`Successfully completed processing invoice ${uuid}`);
    } catch (error) {
      this.logger.logError(invoiceId, error, 'PROCESSING');
      Sentry.captureException(error);

      // Update status menjadi "Failed" jika processing gagal
      await this.invoiceRepository.updateStatus(invoiceId, DocumentStatus.FAILED);
    }
  }

  mapAnalysisResult(analysisResult, partnerId, originalname, fileSize) {
    const { invoiceData, customerData, vendorData, itemsData } =
      this.azureMapper.mapToInvoiceModel(analysisResult.data, partnerId);

    invoiceData.original_filename = originalname;
    invoiceData.file_size = fileSize;

    console.log("Invoice data mapped:", JSON.stringify(invoiceData, null, 2));

    return { invoiceData, customerData, vendorData, itemsData };
  }

  async updateInvoiceRecord(invoiceId, invoiceData) {
    try {
      if (!invoiceData) {
        console.error("Invoice data is undefined!");
        return;
      }

      await this.invoiceRepository.update(invoiceId, invoiceData);
      console.log(`Invoice data updated for ${invoiceId}`);
    } catch (error) {
      console.error("Error updating invoice:", error);
      throw new Error(`Failed to update invoice: ${error.message}`);
    }
  }

  async updateCustomerAndVendorData(invoiceId, customerData, vendorData) {
    if (customerData?.name) {
      let customer = await this.customerRepository.findByAttributes({
        name: customerData.name,
        ...(customerData.tax_id && { tax_id: customerData.tax_id }),
        ...(customerData.address && { address: customerData.address })
      });

      if (!customer) {
        customer = await this.customerRepository.create(customerData);
      }

      await this.invoiceRepository.updateCustomerId(invoiceId, customer.uuid);
    }

    if (vendorData?.name) {
      let vendor = await this.vendorRepository.findByAttributes({
        name: vendorData.name,
        ...(vendorData.tax_id && { tax_id: vendorData.tax_id }),
        ...(vendorData.address && { address: vendorData.address })
      });

      if (!vendor) {
        vendor = await this.vendorRepository.create(vendorData);
      }

      await this.invoiceRepository.updateVendorId(invoiceId, vendor.uuid);
    }
  }

  async saveInvoiceItems(invoiceId, itemsData) {
    console.log("Saving invoice items...", itemsData);
    if (!itemsData || !Array.isArray(itemsData) || itemsData.length === 0) {
      console.log("No items to save");
      return;
    }

    try {
      for (const itemData of itemsData) {
        await this.itemRepository.createDocumentItem(
          'Invoice',
          invoiceId,
          {
            description: itemData.description || null,
            quantity: itemData.quantity || 0,
            unit: itemData.unit || null,
            unit_price: itemData.unitPrice || 0,
            amount: itemData.amount || 0
          }
        );
      }

      console.log(`Saved ${itemsData.length} items for invoice ${invoiceId}`);
    } catch (error) {
      console.error('Error saving invoice items:', error);
      throw new Error(`Failed to save invoice items: ${error.message}`);
    }
  }

  async getPartnerId(invoiceId) {
    const invoice = await this.invoiceRepository.findById(invoiceId);

    if (!invoice) {
      throw new NotFoundError("Invoice not found");
    }
    return invoice.partner_id;
  }

  async getInvoiceById(invoiceId) {
    try {
      const invoice = await this.invoiceRepository.findById(invoiceId);
      
      if (!invoice) {
        throw new NotFoundError("Invoice not found");
      }

      // Check invoice status first
      if (invoice.status === DocumentStatus.PROCESSING) {
        return {
          message: "Invoice is still being processed. Please try again later.",
          data: { documents: [] }
        };
      }

      if (invoice.status === DocumentStatus.FAILED) {
        return {
          message: "Invoice processing failed. Please re-upload the document.",
          data: { documents: [] }
        };
      }

      const items = await this.itemRepository.findItemsByDocumentId(invoiceId, 'Invoice');

      let customer = null;
      if (invoice.customer_id) {
        customer = await this.customerRepository.findById(invoice.customer_id);
      }

      let vendor = null;
      if (invoice.vendor_id) {
        vendor = await this.vendorRepository.findById(invoice.vendor_id);
      }

      return this.responseFormatter.formatInvoiceResponse(invoice, items, customer, vendor);
    } catch (error) {
      console.error("Error retrieving invoice:", error);
      if (error.message === "Invoice not found") {
        throw error;
      } else {
        throw new Error("Failed to retrieve invoice: " + error.message);
      }
    }
  }

  async deleteInvoiceById(id) {
    try {
      const result = await this.invoiceRepository.delete(id);
  
      if (result === 0) {
        const err = new Error(`Failed to delete invoice with ID: ${id}`);;
        Sentry.captureException(err);
        throw err;
      }
  
      return { message: "Invoice successfully deleted" };
    } catch (error) {
      Sentry.captureException(error);
      throw new Error("Failed to delete invoice: " + error.message);
    }
  }
  

  async analyzeInvoice(documentUrl) {
    return this.documentAnalyzer.analyzeDocument(documentUrl);
  }
}

/**
 * Factory function untuk membuat instance InvoiceService yang dikonfigurasi dengan benar
 * @param {Object} customDependencies - Custom dependencies untuk mengganti default
 * @returns {InvoiceService} Instance InvoiceService yang dikonfigurasi
 */
function createInvoiceService(customDependencies = {}) {
  // Import default dependencies
  const InvoiceRepository = require('../../repositories/invoiceRepository.js');
  const CustomerRepository = require('../../repositories/customerRepository.js');
  const VendorRepository = require('../../repositories/vendorRepository.js');
  const ItemRepository = require('../../repositories/itemRepository.js');
  const AzureDocumentAnalyzer = require('../analysis/azureDocumentAnalyzer');
  const InvoiceValidator = require('./invoiceValidator');
  const InvoiceResponseFormatter = require('./invoiceResponseFormatter');
  const { AzureInvoiceMapper } = require('../invoiceMapperService/invoiceMapperService');
  const InvoiceLogger = require('./invoiceLogger');
  const s3Service = require('../s3Service');
  
  // Gabungkan default dependencies dengan custom dependencies
  const dependencies = {
    invoiceRepository: new InvoiceRepository(),
    customerRepository: new CustomerRepository(),
    vendorRepository: new VendorRepository(),
    itemRepository: new ItemRepository(),
    documentAnalyzer: new AzureDocumentAnalyzer(),
    validator: new InvoiceValidator(),
    responseFormatter: new InvoiceResponseFormatter(),
    azureMapper: new AzureInvoiceMapper(),
    logger: InvoiceLogger,
    s3Service: s3Service,
    ...customDependencies
  };
  
  return new InvoiceService(dependencies);
}
// Buat instance default untuk kompatibilitas
const defaultInstance = createInvoiceService();

// Export instance default sebagai export utama
module.exports = defaultInstance;

// Juga export class dan factory function untuk penggunaan yang lebih fleksibel
module.exports.InvoiceService = InvoiceService;
module.exports.createInvoiceService = createInvoiceService;