const path = require("path");

const { Invoice } = require("../models");
const s3Service = require("./s3Service");
const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");
const { AzureInvoiceMapper } = require("./invoiceMapperService");
const dotenv = require("dotenv");
const Sentry = require("../instrument");
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
    let invoice;
    try {
      // Check if file data exists
      if (!fileData) {
        throw new Error("File not found");
      }
      
      // Destructure setelah validasi
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
  
      invoice = await Invoice.create(invoiceData);
  
      // 1. Gunakan method analyzeInvoice untuk memproses dokumen
      const analysisResult = await this.analyzeInvoice(buffer);
      
      if (!analysisResult || !analysisResult.data) {
        throw new Error("Failed to analyze invoice: No data returned");
      }
      
      // 2. Map hasil Azure ke model invoice kita
      const invoiceData2 = this.azureMapper.mapToInvoiceModel(analysisResult.data, partnerId);
      
      // 3. Tambahkan informasi tambahan
      invoiceData2.original_filename = originalname;
      invoiceData2.file_size = buffer.length;
      invoiceData2.status = "Analyzed";
      
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
      if (invoice && invoice.id) {
        await Invoice.update({ status: "Failed" }, { where: { id: invoice.id } });
      }
      console.error("Error processing invoice:", error);
      throw new Error("Failed to process invoice: " + error.message);
    }
  }

  async getInvoiceById(id) {
    try{
      const invoice = await Invoice.findByPk(id);
      if(!invoice){
        throw new Error("Invoice not found");
      }
      return invoice;
    }
    catch(error){
      if(error.message === "Invoice not found") throw error;
      throw new Error("Database error");
    }
  }

  /**
   * Validates if a file is a valid PDF
   * This function checks three criteria to determine if a file is a valid PDF:
   * 1. The MIME type must be "application/pdf"
   * 2. The file extension must be ".pdf"
   * 3. The file content must begin with the PDF signature "%PDF-"
   * 
   * @param {Buffer} fileBuffer - The file content as a buffer
   * @param {string} mimeType - The MIME type of the file
   * @param {string} fileName - The original filename with extension
   * @returns {Promise<boolean>} Returns true if validation passes, throws an error otherwise
   * @throws {Error} Throws an error with a specific message if validation fails
   */
  async validatePDF(fileBuffer, mimeType, fileName) {
      if (mimeType !== "application/pdf") {
          throw new Error("Invalid MIME type");
      }

      const validExtensions = [".pdf"];
      const fileExtension = path.extname(fileName).toLowerCase();
      if (!validExtensions.includes(fileExtension)) {
          throw new Error("Invalid file extension");
      }

        const pdfSignature = "%PDF-";
        const fileHeader = fileBuffer.subarray(0, 5).toString();
        if (fileHeader !== pdfSignature) {
            throw new Error("Invalid PDF file");
        }

      return true;
  }

    /**
     * Validates the size of a file
     * @param {Buffer} fileBuffer - The file buffer to validate
     * @returns {Promise<boolean>} - Returns true if validation passes
     * @throws {Error} - Throws an error if validation fails
     */
    async validateSizeFile(fileBuffer) {
        const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
        
        if (fileBuffer.length > MAX_FILE_SIZE) {
          throw new Error(`File exceeds maximum allowed size of 20MB`);
        }
    
        return true;
    }

    /**
     * Checks if a PDF file is encrypted.
     * 
     * This function analyzes a PDF buffer to determine if it's encrypted
     * by searching for the '/Encrypt' entry in the PDF trailer section.
     * 
     * @param {Buffer} pdfBuffer - Buffer containing the PDF file data to check
     * @returns {boolean} - Returns true if the PDF is encrypted, false otherwise
     */
    async isPdfEncrypted(pdfBuffer) {
        const bufferSize = pdfBuffer.length;
        const searchSize = Math.min(bufferSize, 8192); 
        
        const pdfTrailer = pdfBuffer.subarray(bufferSize - searchSize).toString('utf-8');
        return pdfTrailer.includes('/Encrypt');
    }

    /**
     * Checks the integrity of a PDF file.
     * 
     * This function validates that a PDF file has the proper structure
     * by checking for required PDF components including trailer, xref table,
     * startxref position, and proper EOF marker placement.
     * 
     * @param {Buffer} buffer - Buffer containing the PDF file data to check
     * @returns {Promise<boolean>} - Returns true if the PDF has proper structure, false otherwise
     */
    async checkPdfIntegrity(buffer) {
        if (!buffer || buffer.length === 0) {
          return false;
        }
    
        const content = buffer.toString('utf-8');
        
        const hasTrailer = content.includes('trailer');
        const hasEOF = content.includes('%%EOF');
        const hasXref = content.includes('xref');
        const hasStartXref = content.includes('startxref');
        
        if (!hasTrailer || !hasEOF || !hasXref || !hasStartXref) {
          return false;
        }
    
        const startXrefPos = content.lastIndexOf('startxref');
        const eofPos = content.lastIndexOf('%%EOF');
    
        const startXrefSection = content.substring(startXrefPos, eofPos);
        const regex = /startxref\s*(\d+)/;
        const matches = regex.exec(startXrefSection);;
    
        return !!(matches?.[1] && /\d{1,10} \d{1,10} obj/.test(content));
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
            span.end(); // Ensure transaction is always finished
          }
        }
      );
    }
}

module.exports = new InvoiceService();