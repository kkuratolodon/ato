const { Invoice } = require("../models");
const FinancialDocumentService = require("./financialDocumentService")
const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");
const { AzureInvoiceMapper } = require("./invoiceMapperService/invoiceMapperService");
const dotenv = require("dotenv");
const { Customer } = require("../models");
const { Vendor } = require("../models");
const { Item, FinancialDocumentItem } = require('../models');
const { v4: uuidv4 } = require('uuid');

const Sentry = require("../instrument");
dotenv.config();

const endpoint = process.env.AZURE_ENDPOINT;
const key = process.env.AZURE_KEY;
const modelId = process.env.AZURE_INVOICE_MODEL;


class InvoiceService extends FinancialDocumentService {
  constructor() {
    super("Invoice");
    this.azureMapper = new AzureInvoiceMapper();
  }
  /**
   * Uploads and processes an invoice file
   * 
   * This method handles the complete invoice processing workflow:
   * 1. Validates the file data and partner ID
   * 2. Uploads the file to S3 storage
   * 3. Analyzes the invoice using Azure's document intelligence
   * 4. Maps the analysis results to our invoice data model
   * 5. Saves the invoice data to the database
   *
   * @param {Object} fileData - Object containing invoice file data
   * @param {Buffer} fileData.buffer - The raw file content
   * @param {string} fileData.originalname - The original filename
   * @param {string} fileData.partnerId - The partner/customer ID associated with this invoice
   * @returns {Promise<Object>} Object containing success message, invoice ID and basic invoice details
   * @throws {Error} If file validation fails, S3 upload fails, analysis fails, or database operations fail
   */
  async uploadInvoice(fileData) {
    try {
      // Validate file data
      this.validateFileData(fileData);
      const { buffer, originalname, partnerId } = fileData;

      // Generate UUID untuk invoice
      const invoiceUuid = uuidv4();

      // Upload file ke S3
      let s3Result;
      try {
        s3Result = await this.uploadFile(fileData);
      } catch (error) {
        console.error("Error uploading to S3:", error);
        throw new Error("Failed to upload file to S3");
      }

      // Buat record invoice awal dengan status "Processing"
      // Explisit set id dengan UUID yang digenerate
      const invoice = await Invoice.create({
        id: invoiceUuid,
        status: "Processing",
        partner_id: partnerId,
        file_url: s3Result.file_url,
        original_filename: originalname,
        file_size: buffer.length,
      });

      // Mulai processing di background (tidak await)
      this.processInvoiceAsync(invoice.id, buffer, partnerId, originalname, invoiceUuid);

      // Kembalikan UUID dan status segera
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

  /**
   * Process invoice asynchronously in background
   * @private
   */
  async processInvoiceAsync(invoiceId, buffer, partnerId, originalname, uuid) {
    try {
      Sentry.addBreadcrumb({
        category: "invoiceProcessing",
        message: `Starting async processing for invoice ${uuid}`,
        level: "info"
      });

      // 1. Analisis invoice menggunakan Azure
      const analysisResult = await this.analyzeInvoice(buffer);
      
      // 2. Upload hasil OCR ke S3 sebagai JSON dan dapatkan URL-nya
      const jsonUrl = await super.uploadAnalysisResults(analysisResult, invoiceId);
      
      // Print URL JSON yang berhasil diupload
      console.log("=============================================");
      console.log(`JSON Analysis URL: ${jsonUrl}`);
      console.log("=============================================");

      // 3. Map hasil analisis ke model data
      const { invoiceData, customerData, vendorData, itemsData } =
        this.mapAnalysisResult(analysisResult, partnerId, originalname, buffer.length);

      // 4. Update record invoice dengan data hasil analisis dan URL JSON
      await this.updateInvoiceRecord(invoiceId, {
        ...invoiceData,
        // Uncomment baris di bawah ini untuk menyimpan URL JSON ke database (untuk task berikutnya)
        // analysis_json_url: jsonUrl
      });

      // 5. Update data customer dan vendor
      await this.updateCustomerAndVendorData(invoiceId, customerData, vendorData);

      // 6. Simpan item invoice
      await this.saveInvoiceItems(invoiceId, itemsData);

      // 7. Update status menjadi "Analyzed"
      await Invoice.update({ status: "Analyzed" }, { where: { id: invoiceId } });

      Sentry.captureMessage(`Successfully completed processing invoice ${uuid}`);
    } catch (error) {
      console.error(`Error in async processing for invoice ${uuid}:`, error);
      Sentry.captureException(error);

      // Update status menjadi "Failed" jika processing gagal
      await Invoice.update({ status: "Failed" }, { where: { id: invoiceId } });
    }
  }

  validateFileData(fileData) {
    if (!fileData) {
      throw new Error("File not found");
    }
    const { partnerId } = fileData;
    if (!partnerId) {
      throw new Error("Partner ID is required");
    }
  }

  async createInvoiceRecord(partnerId, s3Url) {
    const invoiceData = {
      status: "Processing",
      partner_id: partnerId,
      file_url: s3Url,
    };
    return await Invoice.create(invoiceData);
  }

  mapAnalysisResult(analysisResult, partnerId, originalname, fileSize) {
    const { invoiceData, customerData, vendorData, itemsData } =
      this.azureMapper.mapToInvoiceModel(analysisResult.data, partnerId);

    // Tambahkan metadata file
    invoiceData.original_filename = originalname;
    invoiceData.file_size = fileSize;

    console.log("Invoice data mapped:", JSON.stringify(invoiceData, null, 2));

    // Return dengan nama yang konsisten
    return { invoiceData, customerData, vendorData, itemsData };
  }

  async updateInvoiceRecord(invoiceId, invoiceData) {
    try {
      // Log data dengan nama variabel yang konsisten
      console.log("Data yang akan diupdate ke Invoice:", JSON.stringify(invoiceData, null, 2));

      if (!invoiceData) {
        console.error("Invoice data is undefined!");
        return;
      }

      // Update invoice dengan data lengkap
      await Invoice.update(invoiceData, { where: { id: invoiceId } });
      console.log(`Invoice data updated for ${invoiceId}`);

      // Status diupdate dalam langkah terpisah (sudah benar)
    } catch (error) {
      console.error("Error updating invoice:", error);
      throw new Error(`Failed to update invoice: ${error.message}`);
    }
  }

  async updateCustomerAndVendorData(invoiceId, customerData, vendorData) {
    if (customerData?.name) {
      let customer = await Customer.findOne({
        where: {
          name: customerData.name,
          ...(customerData.tax_id && { tax_id: customerData.tax_id }),
          ...(customerData.address && { address: customerData.address })
        }
      });
      if (!customer) {
        customer = await Customer.create(customerData);
      }
      await Invoice.update({ customer_id: customer.uuid }, { where: { id: invoiceId } });
    }

    if (vendorData?.name) {
      let vendor = await Vendor.findOne({
        where: {
          name: vendorData.name,
          ...(vendorData.tax_id && { tax_id: vendorData.tax_id }),
          ...(vendorData.address && { address: vendorData.address })
        }
      });
      if (!vendor) {
        vendor = await Vendor.create(vendorData);
      }
      await Invoice.update({ vendor_id: vendor.uuid }, { where: { id: invoiceId } });
    }
  }

  /**
 * Save invoice items and create associations in the database
 * @param {number} invoiceId - ID of the invoice
 * @param {Array} itemsData - Array of item data from OCR analysis
 * @returns {Promise<void>}
 */
  async saveInvoiceItems(invoiceId, itemsData) {
    if (!itemsData || !Array.isArray(itemsData) || itemsData.length === 0) {
      console.log("No items to save");
      return;
    }

    try {
      for (const itemData of itemsData) {

        const [item] = await Item.findOrCreate({
          where: { description: itemData.description },
          defaults: {
            uuid: uuidv4(),
            description: itemData.description
          }
        });

        // Generate UUID untuk item dokumen
        const documentItemId = uuidv4();
        await FinancialDocumentItem.create({
          id: documentItemId,
          document_type: 'Invoice',
          document_id: invoiceId,
          item_id: item.uuid,
          quantity: itemData.quantity || 0,
          unit: itemData.unit || null,
          unit_price: itemData.unitPrice || 0,
          amount: itemData.amount || 0
        });
      }

      console.log(`Saved ${itemsData.length} items for invoice ${invoiceId}`);
    } catch (error) {
      console.error('Error saving invoice items:', error);
      throw new Error(`Failed to save invoice items: ${error.message}`);
    }
  }

  async getPartnerId(id) {
    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      throw new Error("Invoice not found");
    }
    return invoice.partner_id;
  }

  // Fungsi helper untuk mendapatkan detail item invoice
  async _getInvoiceItemsWithDetails(invoiceId) {
    const invoiceItems = await FinancialDocumentItem.findAll({
      where: {
        document_type: 'Invoice',
        document_id: invoiceId
      }
    });

    const itemsWithDetails = [];
    for (const item of invoiceItems) {
      const itemData = item.get({ plain: true });
      const itemDetails = await Item.findByPk(itemData.item_id);
      if (itemDetails) {
        itemData.item = itemDetails.get({ plain: true });
        itemsWithDetails.push(itemData);
      }
    }

    // Transform items data to the required format
    return itemsWithDetails.map(item => ({
      amount: item.amount,
      description: item.item?.description || null,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price
    }));
  }

  // Fungsi helper untuk mendapatkan entitas terkait (customer & vendor)
  async _getInvoiceRelatedEntities(invoiceData) {
    if (invoiceData.customer_id) {
      const customer = await Customer.findByPk(invoiceData.customer_id);
      if (customer) {
        invoiceData.customer = customer.get({ plain: true });
      }
    }

    if (invoiceData.vendor_id) {
      const vendor = await Vendor.findByPk(invoiceData.vendor_id);
      if (vendor) {
        invoiceData.vendor = vendor.get({ plain: true });
      }
    }

    return invoiceData;
  }

  // Fungsi helper untuk format response invoice
  _formatInvoiceResponse(invoiceData) {
    return {
      header: {
        invoice_details: {
          invoice_number: invoiceData.invoice_number,
          purchase_order_id: invoiceData.purchase_order_id,
          invoice_date: invoiceData.invoice_date,
          due_date: invoiceData.due_date,
          payment_terms: invoiceData.payment_terms
        },
        vendor_details: invoiceData.vendor ? {
          name: invoiceData.vendor.name,
          address: invoiceData.vendor.address || "",
          recipient_name: invoiceData.vendor.recipient_name,
          tax_id: invoiceData.vendor.tax_id
        } : {
          name: null,
          address: "",
          recipient_name: null,
          tax_id: null
        },
        customer_details: invoiceData.customer ? {
          id: invoiceData.customer.uuid,
          name: invoiceData.customer.name,
          recipient_name: invoiceData.customer.recipient_name,
          address: invoiceData.customer.address || "",
          tax_id: invoiceData.customer.tax_id
        } : {
          id: null,
          name: null,
          recipient_name: null,
          address: "",
          tax_id: null
        },
        financial_details: {
          currency: {
            currency_symbol: invoiceData.currency_symbol,
            currency_code: invoiceData.currency_code
          },
          total_amount: invoiceData.total_amount,
          subtotal_amount: invoiceData.subtotal_amount,
          discount_amount: invoiceData.discount_amount,
          total_tax_amount: invoiceData.tax_amount,
        }
      },
      items: invoiceData.items
    };
  }

  // Fungsi utama dengan kompleksitas yang dikurangi
  async getInvoiceById(id) {
    try {
      const invoice = await Invoice.findOne({
        where: { id: id }
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      // Get basic invoice data
      let invoiceData = invoice.get({ plain: true });

      // Get related entities (customer and vendor)
      invoiceData = await this._getInvoiceRelatedEntities(invoiceData);

      // Get items with details
      const formattedItems = await this._getInvoiceItemsWithDetails(id);
      invoiceData.items = formattedItems;

      // Format response
      const formattedResponse = this._formatInvoiceResponse(invoiceData);

      // Bungkus dalam format yang diminta
      return {
        data: {
          documents: [formattedResponse]
        }
      };

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
    if (!documentUrl) {
      throw new Error("documentUrl is required");
    }

    return Sentry.startSpan(
      {
        name: "analyzeInvoice",
        attributes: {
          documentUrl: typeof documentUrl === "string" ? documentUrl : "Buffer data",
        },
      },
      async (span) => {
        try {
          Sentry.captureMessage(`analyzeInvoice() called with documentUrl: ${typeof documentUrl === 'string' ? documentUrl : 'Buffer data'}`);

          Sentry.addBreadcrumb({
            category: "analyzeInvoice",
            message: `Starting document analysis for: ${typeof documentUrl === "string" ? documentUrl : "Binary Buffer"}`,
            level: "info",
          });

          console.log("Processing PDF...");
          const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
          let poller;

          if (typeof documentUrl === 'string') {
            poller = await client.beginAnalyzeDocument(modelId, documentUrl);
          } else if (Buffer.isBuffer(documentUrl)) {
            poller = await client.beginAnalyzeDocument(modelId, documentUrl);
          } else {
            throw new Error("Invalid document source type");
          }

          Sentry.addBreadcrumb({
            category: "analyzeInvoice",
            message: "Azure analysis started...",
            level: "info",
          });

          const azureResult = await poller.pollUntilDone();
          console.log("Analysis completed");

          Sentry.addBreadcrumb({
            category: "analyzeInvoice",
            message: "Azure analysis completed successfully",
            level: "info",
          });

          Sentry.captureMessage("analyzeInvoice() completed successfully");

          return {
            message: "PDF processed successfully",
            data: azureResult,
          };
        } catch (error) {
          Sentry.addBreadcrumb({
            category: "analyzeInvoice",
            message: `Error encountered: ${error.message}`,
            level: "error",
          });

          Sentry.captureException(error);
          if (error.message === 'Invalid date format') {
            throw new Error("Invoice contains invalid date format");
          }
          if (error.message === 'Invalid document source type') {
            throw error;
          }
          if (error.statusCode === 503) {
            console.error("Service Unavailable:", error);
            throw new Error("Service is temporarily unavailable. Please try again later.");
          } else if (error.statusCode === 409) {
            console.error("Conflict Error:", error);
            throw new Error("Conflict error occurred. Please check the document and try again.");
          } else {
            console.error(error);
            throw new Error("Failed to process the document");
          }
        } finally {
          span.end();
        }
      }
    );
  }

  async processOcrResults(invoiceId, ocrResults) {
    try {
      // Pastikan invoice ada
      const invoice = await Invoice.findByPk(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice with ID ${invoiceId} not found`);
      }
      
      // Upload hasil OCR ke S3 sebagai JSON
      const jsonUrl = await this.uploadAnalysisResults(ocrResults, invoiceId);
      
      // Di sini bisa menambahkan logika lain untuk memproses hasil OCR
      // ...
      
      // Mengembalikan URL JSON tanpa menyimpan ke database
      return {
        success: true,
        analysis_json_url: jsonUrl,
        // Data lain yang mungkin diperlukan
      };
      
      /* 
      Untuk task berikutnya, Anda bisa menambahkan kode untuk menyimpan URL:
      await invoice.update({ 
        analysis_json_url: jsonUrl,
        status: 'Analyzed'
      });
      */
    } catch (error) {
      console.error("Error processing OCR results:", error);
      throw error;
    }
  }
}

module.exports = new InvoiceService();