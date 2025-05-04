const { v4: uuidv4 } = require('uuid');
const { from } = require('rxjs');
const { catchError, map, switchMap } = require('rxjs/operators');
const FinancialDocumentService = require('../financialDocumentService');
const Sentry = require("../../instrument");
const PurchaseOrderRepository = require('../../repositories/purchaseOrderRepository');
const CustomerRepository = require('../../repositories/customerRepository.js');
const VendorRepository = require('../../repositories/vendorRepository.js');
const ItemRepository = require('../../repositories/itemRepository.js');
const AzureDocumentAnalyzer = require('../analysis/azureDocumentAnalyzer');
const PurchaseOrderValidator = require('./purchaseOrderValidator');
const PurchaseOrderResponseFormatter = require('./purchaseOrderResponseFormatter');
const { AzurePurchaseOrderMapper } = require('../purchaseOrderMapperService/purchaseOrderMapperService');
const DocumentStatus = require('../../models/enums/DocumentStatus');
const {NotFoundError } = require('../../utils/errors');

class PurchaseOrderService extends FinancialDocumentService {
  constructor() {
    super("Purchase Order");
    this.purchaseOrderRepository = new PurchaseOrderRepository();
    this.customerRepository = new CustomerRepository();
    this.vendorRepository = new VendorRepository();
    this.itemRepository = new ItemRepository();
    this.documentAnalyzer = new AzureDocumentAnalyzer();
    this.validator = new PurchaseOrderValidator();
    this.responseFormatter = new PurchaseOrderResponseFormatter();
    this.azureMapper = new AzurePurchaseOrderMapper();
  }

  async uploadPurchaseOrder(fileData) {
    try {
      this.validator.validateFileData(fileData);
      const { buffer, originalname, partnerId } = fileData;

      const purchaseOrderId = uuidv4();
      // Logger

      let s3Result;
      try {
        s3Result = await this.uploadFile(fileData);
        // Logger
      } catch (error) {
        // Logger
        throw new Error("Failed to upload file to S3");
      }

      await this.purchaseOrderRepository.createInitial({
        id: purchaseOrderId,
        status: DocumentStatus.PROCESSING,
        partner_id: partnerId,
        file_url: s3Result.file_url,
        original_filename: originalname,
        file_size: buffer.length,
      });

      this.processPurchaseOrderAsync(purchaseOrderId, buffer, partnerId, originalname, purchaseOrderId);
      console.log(`Purchase order upload initiated with ID: ${purchaseOrderId}`);
      return {
        message: "Purchase Order upload initiated",
        id: purchaseOrderId,
        status: DocumentStatus.PROCESSING
      };
    } catch (error) {
      // Logger
      throw new Error(`Failed to process purchase order: ${error.message}`);
    }
  }

  /**
   * Process purchase order asynchronously in background
   * @private
   */
  async processPurchaseOrderAsync(purchaseOrderId, buffer, partnerId, originalname, uuid) {
    try {
      // Logger
      Sentry.addBreadcrumb({
        category: "purchaseOrderProcessing",
        message: `Starting async processing for purchase order ${uuid}`,
        level: "info"
      });

      // 1. Analyze purchase order using Azure
      const analysisResult = await this.analyzePurchaseOrder(buffer);

      // 2. Upload OCR results to S3 as JSON and get the URL
      const jsonUrl = await this.uploadAnalysisResults(analysisResult, purchaseOrderId);
      // We'll add logger here later

      // 3. Map analysis results to data model
      const { purchaseOrderData, customerData, vendorData, itemsData } =
        this.mapAnalysisResult(analysisResult, partnerId, originalname, buffer.length);

      // We'll add logger here later

      // 4. Update purchase order record with analysis data and JSON URL
      await this.updatePurchaseOrderRecord(purchaseOrderId, {
        ...purchaseOrderData,
        analysis_json_url: jsonUrl
      });

      // 5. Update customer and vendor data
      await this.updateCustomerAndVendorData(purchaseOrderId, customerData, vendorData);

      // 6. Save purchase order items
      await this.savePurchaseOrderItems(purchaseOrderId, itemsData);

      // 7. Update status to "Analyzed"
      await this.purchaseOrderRepository.update(purchaseOrderId, { status: DocumentStatus.ANALYZED });

      // We'll add logger here later
      Sentry.captureMessage(`Successfully completed processing purchase order ${uuid}`);
    } catch (error) {
      // We'll add logger here later
      Sentry.captureException(error);

      // Update status to "Failed" if processing fails
      await this.purchaseOrderRepository.update(purchaseOrderId, { status: DocumentStatus.FAILED });
    }
  }

  mapAnalysisResult(analysisResult, partnerId, originalname, fileSize) {
    const { purchaseOrderData, customerData, vendorData, itemsData } =
      this.azureMapper.mapToPurchaseOrderModel(analysisResult.data, partnerId);

    purchaseOrderData.original_filename = originalname;
    purchaseOrderData.file_size = fileSize;

    console.log("Purchase order data mapped:", JSON.stringify(purchaseOrderData, null, 2));

    return { purchaseOrderData, customerData, vendorData, itemsData };
  }

  async updatePurchaseOrderRecord(purchaseOrderId, purchaseOrderData) {
    try {
      if (!purchaseOrderData) {
        console.error("Purchase order data is undefined!");
        return;
      }

      await this.purchaseOrderRepository.update(purchaseOrderId, purchaseOrderData);
      console.log(`Purchase order data updated for ${purchaseOrderId}`);
    } catch (error) {
      console.error("Error updating purchase order:", error);
      throw new Error(`Failed to update purchase order: ${error.message}`);
    }
  }

  async updateCustomerAndVendorData(purchaseOrderId, customerData, vendorData) {
    if (customerData?.name) {
      let customer = await this.customerRepository.findByAttributes({
        name: customerData.name,
        ...(customerData.tax_id && { tax_id: customerData.tax_id }),
        ...(customerData.address && { address: customerData.address })
      });

      if (!customer) {
        customer = await this.customerRepository.create(customerData);
      }

      await this.purchaseOrderRepository.updateCustomerId(purchaseOrderId, customer.uuid);
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

      await this.purchaseOrderRepository.updateVendorId(purchaseOrderId, vendor.uuid);
    }
  }

  async savePurchaseOrderItems(purchaseOrderId, itemsData) {
    console.log("Saving purchase order items...", itemsData);
    if (!itemsData || !Array.isArray(itemsData) || itemsData.length === 0) {
      console.log("No items to save");
      return;
    }

    try {
      for (const itemData of itemsData) {
        await this.itemRepository.createDocumentItem(
          'PurchaseOrder',
          purchaseOrderId,
          {
            description: itemData.description || null,
            quantity: itemData.quantity || 0,
            unit: itemData.unit || null,
            unit_price: itemData.unitPrice || 0,
            amount: itemData.amount || 0
          }
        );
      }

      console.log(`Saved ${itemsData.length} items for purchase order ${purchaseOrderId}`);
    } catch (error) {
      console.error('Error saving purchase order items:', error);
      throw new Error(`Failed to save purchase order items: ${error.message}`);
    }
  }

  async getPartnerId(id) {
    const purchaseOrder = await this.purchaseOrderRepository.findById(id);

    if (!purchaseOrder) {
      throw new NotFoundError("Purchase order not found");
    }
    return purchaseOrder.partner_id;
  }
  
  async analyzePurchaseOrder(documentUrl) {
    return this.documentAnalyzer.analyzeDocument(documentUrl);
  }
  
  async getPurchaseOrderById(id) {
    try {
      const purchaseOrder = await this.purchaseOrderRepository.findById(id);
      
      // Return early with appropriate message for PROCESSING and FAILED states
      if (purchaseOrder.status === DocumentStatus.PROCESSING) {
        return {
          message: "Purchase order is still being processed. Please try again later.",
          data: { documents: [] }
        };
      }
      
      if (purchaseOrder.status === DocumentStatus.FAILED) {
        return {
          message: "Purchase order processing failed. Please re-upload the document.",
          data: { documents: [] }
        };
      }
      
      // Fetch related data for ANALYZED purchase orders
      const items = await this.itemRepository.findItemsByDocumentId(id, 'PurchaseOrder');
      
      // Get customer data if available
      let customer = null;
      if (purchaseOrder.customer_id) {
        customer = await this.customerRepository.findById(purchaseOrder.customer_id);
      }
      
      // Get vendor data if available
      let vendor = null;
      if (purchaseOrder.vendor_id) {
        vendor = await this.vendorRepository.findById(purchaseOrder.vendor_id);
      }
      
      return this.responseFormatter.formatPurchaseOrderResponse(purchaseOrder, items, customer, vendor);
    } catch (error) {
      console.error("Error retrieving purchase order:", error);
      throw error;
    }
  }

  /**
   * @description Get the status of a purchase order by ID
   * @param {string} id - Purchase order ID
   * @returns {Object} Purchase order status information
   * @throws {NotFoundError} If purchase order not found
   */
  async getPurchaseOrderStatus(id) {
    try {
      
      const purchaseOrder = await this.purchaseOrderRepository.findById(id);
      
      if (!purchaseOrder) {
        throw new NotFoundError("Purchase order not found");
      }
      
      return {
        id: purchaseOrder.id,
        status: purchaseOrder.status
      };
    } catch (error) {
      // Re-throw NotFoundError and ValidationError as is
      if (error.name === "NotFoundError" || error.name === "ValidationError") {
        throw error;
      }
      
      console.error(`Error getting purchase order status: ${error.message}`, error);
      Sentry.captureException(error);
      
      // Wrap other errors
      throw new Error(`Failed to get purchase order status: ${error.message}`);
    }
  }

  /**
   * Delete a purchase order by ID
   * @param {string} id - Purchase order ID to delete
   * @returns {Observable} Observable with success message or error
   */
  deletePurchaseOrderById(id) {
    return from(Promise.resolve())
      .pipe(
        switchMap(() => from(this.purchaseOrderRepository.delete(id))),
        map(result => {
          if (result === 0) {
            const err = new Error(`Failed to delete purchase order with ID: ${id}`);
            Sentry.captureException(err);
            throw err;
          }
          return { message: "Purchase order successfully deleted" };
        }),
        catchError(error => {
          Sentry.captureException(error);
          throw new Error(error.message);
        })
      );
  }
}

module.exports = new PurchaseOrderService();