const { Invoice } = require("../models");
const s3Service = require("./s3Service")
const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");
const { AzureInvoiceMapper } = require("./invoiceMapperService");
const dotenv = require("dotenv");
dotenv.config();

const endpoint = process.env.AZURE_ENDPOINT;
const key = process.env.AZURE_KEY;
const modelId = process.env.AZURE_INVOICE_MODEL;


class InvoiceService {
  constructor() {
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
      // Check if file data exists
      if (!fileData) {
        throw new Error("File not found");
      }
      
      // Destructure after checking to avoid error when null
      const { buffer, originalname, partnerId } = fileData;
      
      if (!partnerId) {
        throw new Error("Partner ID is required");
      }

      const s3Url = await s3Service.uploadFile(buffer);
      if (!s3Url) {
        throw new Error("Failed to upload file to S3");
      }

      
      // Initialize invoice data with processing status and partner ID
      const invoiceData = {
        status: "Processing",
        partner_id: partnerId,
        file_url: s3Url
      };

      const invoice = await Invoice.create(invoiceData);


      // 1. Gunakan method analyzeInvoice yang sudah ada untuk memproses dokumen
      const analysisResult = await this.analyzeInvoice(buffer);
      
      if (!analysisResult || !analysisResult.data) {
        throw new Error("Failed to analyze invoice: No data returned");
      }
      
      // 2. Map hasil Azure ke model invoice kita
      const invoiceData2 = this.azureMapper.mapToInvoiceModel(analysisResult.data, partnerId);
      
      // 3. Tambahkan informasi tambahan
      invoiceData2.original_filename = originalname;
      invoiceData2.file_size = buffer.length;
      invoiceData2.status = "Analyzed"
      // 4. Simpan invoice ke database
      await Invoice.update(invoiceData2, {
        where: { id: invoice.id }
      });
      // 5. Kembalikan hasil mapping
      return {
        message: "Invoice successfully processed and saved",
        invoiceId: invoice.id,
        details: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date,
          total_amount: invoice.total_amount,
          status: invoice.status,
          created_at: invoice.created_at
        }
      };
    } catch (error) {
      console.error("Error processing invoice:", error);
      throw new Error("Failed to process invoice: " + error.message);
    }
  }

  async getInvoiceById(id) {
    const invoice = await Invoice.findByPk(id);
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    return invoice;
  }

  async analyzeInvoice(documentUrl) {
    if (!documentUrl) {
      throw new Error("documentUrl is required");
    }
  
    try {
      console.log("Processing PDF...");
      const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
      let poller;
  
      // Gunakan parameter documentUrl (bukan variabel source)
      if (typeof documentUrl === 'string') {
        poller = await client.beginAnalyzeDocument(modelId, documentUrl);
      } else if (Buffer.isBuffer(documentUrl)) {
        poller = await client.beginAnalyzeDocument(modelId, documentUrl);
      } else {
        throw new Error("Invalid document source type");
      }
      
      const azureResult = await poller.pollUntilDone();
      console.log("Analysis completed");
  
      // Untuk keperluan test, kembalikan objek dengan properti message dan data.
      if (!azureResult) {
        return { message: "PDF processed successfully", data: null };
      }
      return {
        message: "PDF processed successfully",
        data: azureResult
      };
    } catch (error) {
      if (error.message === 'Invalid date format') {
        throw new Error("Invoice contains invalid date format");
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
    }
  }
}

module.exports = new InvoiceService();