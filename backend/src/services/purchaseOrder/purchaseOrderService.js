const { v4: uuidv4 } = require('uuid');
const FinancialDocumentService = require('../financialDocumentService');
const Sentry = require("../../instrument");
const PurchaseOrderRepository = require('../../repositories/purchaseOrderRepository');
const PurchaseOrderValidator = require('./purchaseOrderValidator');
const PurchaseOrderResponseFormatter = require('./purchaseOrderResponseFormatter');

class PurchaseOrderService extends FinancialDocumentService {
  constructor() {
    super("Purchase Order");
    this.purchaseOrderRepository = new PurchaseOrderRepository();
    this.validator = new PurchaseOrderValidator();
    this.responseFormatter = new PurchaseOrderResponseFormatter();
  }

  async uploadPurchaseOrder(fileData) {
    let purchaseOrderId;
    try {
      this.validator.validateFileData(fileData);
      const { buffer, originalname, partnerId } = fileData;

      purchaseOrderId = uuidv4();

      // Upload file to storage
      let s3Result;
      try {
        s3Result = await this.uploadFile(fileData);
      } catch (error) {
        console.error("Error uploading to S3:", error);
        throw new Error("Failed to upload file to S3");
      }

      // Create basic purchase order record with UUID
      await this.purchaseOrderRepository.createInitial({
        id: purchaseOrderId,
        status: "Processing",
        partner_id: partnerId,
        file_url: s3Result.fileUrl,
        original_filename: originalname,
        file_size: buffer.length,
        analysis_json_url: s3Result.analysisJsonUrl
      });
      
      // Process in the background
      this.processPurchaseOrderAsync(purchaseOrderId, buffer, partnerId);
      
      console.log(`Purchase order upload initiated with ID: ${purchaseOrderId}`);
      
      return {
        message: "Purchase Order upload initiated",
        id: purchaseOrderId,
        status: "Processing"
      };
    } catch (error) {
      if (purchaseOrderId) {
        await this.purchaseOrderRepository.updateStatus(purchaseOrderId, "Failed");
      }
      console.error("Error processing purchase order:", error);
      throw new Error("Failed to process purchase order: " + error.message);
    }
  }

  async processPurchaseOrderAsync(purchaseOrderId, buffer, partnerId) {
    try {
      Sentry.addBreadcrumb({
        category: "purchaseOrderProcessing",
        message: `Starting async processing for purchase order ${purchaseOrderId}`,
        level: "info"
      });

      // Here you would add document analysis and data extraction
      // For now, we'll just update the status to show the process completed
      
      await this.purchaseOrderRepository.updateStatus(purchaseOrderId, "Analyzed");

      Sentry.captureMessage(`Successfully completed processing purchase order ${purchaseOrderId}`);
    } catch (error) {
      console.error(`Error in async processing for purchase order ${purchaseOrderId}:`, error);
      Sentry.captureException(error);

      await this.purchaseOrderRepository.updateStatus(purchaseOrderId, "Failed");
    }
  }

  async getPurchaseOrderById(id) {
    try {
      const purchaseOrder = await this.purchaseOrderRepository.findById(id);
      
      if (!purchaseOrder) {
        throw new Error("Purchase order not found");
      }
      
      return this.responseFormatter.formatPurchaseOrderResponse(purchaseOrder);
    } catch (error) {
      console.error("Error retrieving purchase order:", error);
      throw error;
    }
  }
}

module.exports = new PurchaseOrderService();
