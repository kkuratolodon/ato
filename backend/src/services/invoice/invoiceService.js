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
const { AzureInvoiceMapper } = require('../invoiceMapperService');

class InvoiceService extends FinancialDocumentService {
  constructor() {
    super("Invoice");
    this.invoiceRepository = new InvoiceRepository();
    this.customerRepository = new CustomerRepository();
    this.vendorRepository = new VendorRepository();
    this.itemRepository = new ItemRepository();
    this.documentAnalyzer = new AzureDocumentAnalyzer();
    this.validator = new InvoiceValidator();
    this.responseFormatter = new InvoiceResponseFormatter();
    this.azureMapper = new AzureInvoiceMapper();
  }

  async uploadInvoice(fileData) {
    try {
      this.validator.validateFileData(fileData);
      const { buffer, originalname, partnerId } = fileData;

      const invoiceUuid = uuidv4();

      let s3Result;
      try {
        s3Result = await this.uploadFile(fileData);
      } catch (error) {
        console.error("Error uploading to S3:", error);
        throw new Error("Failed to upload file to S3");
      }

      await this.invoiceRepository.createInitial({
        id: invoiceUuid,
        status: "Processing",
        partner_id: partnerId,
        file_url: s3Result.file_url,
        original_filename: originalname,
        file_size: buffer.length,
      });
      
      this.processInvoiceAsync(invoiceUuid, buffer, partnerId, originalname, invoiceUuid);
      
      return {
        message: "Invoice upload initiated",
        id: invoiceUuid,
        status: "Processing"
      };
    } catch (error) {
      console.error("Error in uploadInvoice:", error);
      throw new Error(`Failed to process invoice: ${error.message}`);
    }
  }

  async processInvoiceAsync(invoiceId, buffer, partnerId, originalname, uuid) {
    try {
      Sentry.addBreadcrumb({
        category: "invoiceProcessing",
        message: `Starting async processing for invoice ${uuid}`,
        level: "info"
      });

      const analysisResult = await this.documentAnalyzer.analyzeDocument(buffer);
      
      const { invoiceData, customerData, vendorData, itemsData } =
        this.mapAnalysisResult(analysisResult, partnerId, originalname, buffer.length);

      await this.updateInvoiceRecord(invoiceId, invoiceData);
      await this.updateCustomerAndVendorData(invoiceId, customerData, vendorData);
      await this.saveInvoiceItems(invoiceId, itemsData);

      await this.invoiceRepository.updateStatus(invoiceId, "Analyzed");

      Sentry.captureMessage(`Successfully completed processing invoice ${uuid}`);
    } catch (error) {
      console.error(`Error in async processing for invoice ${uuid}:`, error);
      Sentry.captureException(error);

      await this.invoiceRepository.updateStatus(invoiceId, "Failed");
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
    if (!itemsData || !Array.isArray(itemsData) || itemsData.length === 0) {
      console.log("No items to save");
      return;
    }

    try {
      for (const itemData of itemsData) {
        const item = await this.itemRepository.findOrCreateItem(itemData.description);
        
        await this.itemRepository.createDocumentItem(
          'Invoice', 
          invoiceId, 
          item.uuid, 
          {
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

  async getPartnerId(id) {
    const invoice = await this.invoiceRepository.findById(id);
    
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    return invoice.partner_id;
  }

  async getInvoiceById(id) {
    try {
      const invoice = await this.invoiceRepository.findById(id);
      
      if (!invoice) {
        throw new Error("Invoice not found");
      }
      
      const items = await this.itemRepository.findItemsByDocumentId(id, 'Invoice');
      
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

  async analyzeInvoice(documentUrl) {
    return this.documentAnalyzer.analyzeDocument(documentUrl);
  }
}

module.exports = new InvoiceService();