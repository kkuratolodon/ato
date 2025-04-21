const { v4: uuidv4 } = require('uuid');
const FinancialDocumentService = require('../financialDocumentService');
const Sentry = require("../../instrument");
const PurchaseOrderRepository = require('../../repositories/purchaseOrderRepository');
const CustomerRepository = require('../../repositories/customerRepository.js');
const VendorRepository = require('../../repositories/vendorRepository.js');
const ItemRepository = require('../../repositories/itemRepository.js');
const AzureDocumentAnalyzer = require('../analysis/azureDocumentAnalyzer');
const PurchaseOrderValidator = require('./purchaseOrderValidator');
const PurchaseOrderResponseFormatter = require('./purchaseOrderResponseFormatter');
const DocumentStatus = require('../../models/enums/DocumentStatus');

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
        status: DocumentStatus.PROCESSING,
        partner_id: partnerId,
        file_url: s3Result.file_url,
        original_filename: originalname,
        file_size: buffer.length,
        analysis_json_url: s3Result.analysisJsonUrl
      });
      
      // Process in the background
      this.processPurchaseOrderAsync(purchaseOrderId, buffer, partnerId, originalname, purchaseOrderId);
      
      console.log(`Purchase order upload initiated with ID: ${purchaseOrderId}`);
      
      return {
        message: "Purchase Order upload initiated",
        id: purchaseOrderId,
        status: DocumentStatus.PROCESSING
      };
    } catch (error) {
      if (purchaseOrderId) {
        await this.purchaseOrderRepository.updateStatus(purchaseOrderId, DocumentStatus.FAILED);
      }
      console.error("Error processing purchase order:", error);
      throw new Error("Failed to process purchase order: " + error.message);
    }
  }

  async processPurchaseOrderAsync(purchaseOrderId, buffer, partnerId, originalname, uuid) {
    try {
      Sentry.addBreadcrumb({
        category: "purchaseOrderProcessing",
        message: `Starting async processing for purchase order ${uuid}`,
        level: "info"
      });

      // 1. Analyze purchase order using Azure
      const analysisResult = await this.analyzeDocument(buffer);

      // 2. Upload OCR results to S3 as JSON and get the URL
      const jsonUrl = await this.uploadAnalysisResults(analysisResult, purchaseOrderId);

      // 3. Map analysis results to data model
      const { purchaseOrderData, customerData, vendorData, itemsData } =
        this.mapAnalysisResult(analysisResult, partnerId, originalname, buffer.length);

      // 4. Update purchase order record with analysis data and JSON URL
      await this.updatePurchaseOrderRecord(purchaseOrderId, {
        ...purchaseOrderData,
        analysis_json_url: jsonUrl
      });

      // 5. Update customer and vendor data
      await this.updateCustomerAndVendorData(purchaseOrderId, customerData, vendorData);

      // 6. Save purchase order items
      await this.saveInvoiceItems(purchaseOrderId, itemsData);

      // 7. Update status to "Analyzed"
      await this.purchaseOrderRepository.updateStatus(purchaseOrderId, DocumentStatus.ANALYZED);

      Sentry.captureMessage(`Successfully completed processing purchase order ${uuid}`);
    } catch (error) {
      console.error(`Error in async processing for purchase order ${uuid}:`, error);
      Sentry.captureException(error);

      await this.purchaseOrderRepository.updateStatus(purchaseOrderId, "Failed");
    }
  }

  /**
   * Analyzes a purchase order document using Azure Form Recognizer
   * @param {Buffer|string} document - The document buffer or URL to analyze
   * @returns {Promise<Object>} - The analysis result
   */
  async analyzeDocument(document) {
    try {
      const result = await this.documentAnalyzer.analyzeDocument(document);
      return result;
    } catch (error) {
      console.error("Error analyzing purchase order document:", error);
      throw error;
    }
  }

  /**
   * Analyzes a purchase order document from a URL and saves the results to the database
   * @param {string} documentUrl - URL of the document to analyze
   * @param {string} partnerId - Partner ID for the user requesting analysis
   * @returns {Promise<Object>} Analysis results and saved purchase order data
   */
  async analyzePurchaseOrder(documentUrl, partnerId) {
    try {
      // 1. Analyze the document using Azure Document Intelligence
      const analysisResult = await this.documentAnalyzer.analyzeDocument(documentUrl);
      if (!analysisResult || !analysisResult.data) {
        throw new Error('Failed to process the document');
      }

      // 2. Map the analysis results to our data model
      const { purchaseOrderData, customerData, vendorData, itemsData } = 
        this.mapAnalysisResult(analysisResult, partnerId, 'external-analysis.pdf', 0);

      // 3. Save the purchase order data to the database
      const purchaseOrderId = uuidv4();
      
      // 4. Create basic purchase order record with mapped data
      const savedPurchaseOrder = await this.purchaseOrderRepository.createInitial({
        id: purchaseOrderId,
        ...purchaseOrderData,
        status: "Analyzed",
        partner_id: partnerId,
        file_url: documentUrl
      });

      // 5. Update customer and vendor relationships
      await this.updateCustomerAndVendorData(purchaseOrderId, customerData, vendorData);
      
      // 6. Save line items
      await this.saveInvoiceItems(purchaseOrderId, itemsData);

      // 7. Return the results
      return {
        message: "Purchase order analyzed successfully",
        rawData: analysisResult.data,
        purchaseOrderData,
        savedPurchaseOrder
      };

    } catch (error) {
      console.error("Error analyzing purchase order:", error);
      throw error;
    }
  }

  /**
   * Maps Azure OCR analysis result to purchase order data model
   * @param {Object} analysisResult - The raw analysis result
   * @param {string} partnerId - The partner ID
   * @param {string} originalname - The original filename
   * @param {number} fileSize - The file size
   * @returns {Object} Mapped purchase order data
   */
  mapAnalysisResult(analysisResult, partnerId, originalname, fileSize) {
    if (!analysisResult) {
      throw new TypeError("Cannot read properties of undefined (reading 'data')");
    }

    const mappedData = this.azureMapper.mapToPurchaseOrderModel(analysisResult.data, partnerId);
    
    // Add file metadata
    mappedData.purchaseOrderData.original_filename = originalname;
    mappedData.purchaseOrderData.file_size = fileSize;
    
    console.log("Purchase order data mapped:", JSON.stringify(mappedData, null, 2).substring(0, 500) + "...");
    
    return mappedData;
  }

  /**
   * Updates purchase order record with data from analysis
   * @param {string} purchaseOrderId - The purchase order ID
   * @param {Object} purchaseOrderData - The purchase order data to update
   */
  async updatePurchaseOrderRecord(purchaseOrderId, purchaseOrderData) {
    try {
      await this.purchaseOrderRepository.update(purchaseOrderId, purchaseOrderData);
    } catch (error) {
      console.error(`Error updating purchase order ${purchaseOrderId}:`, error);
      throw error;
    }
  }

  /**
   * Updates customer and vendor data for a purchase order
   * @param {string} purchaseOrderId - The purchase order ID
   * @param {Object} customerData - The customer data
   * @param {Object} vendorData - The vendor data
   */
  async updateCustomerAndVendorData(purchaseOrderId, customerData, vendorData) {
    // Implementation similar to invoice service
    // First handle customer data
    if (customerData && Object.keys(customerData).length > 0) {
      try {
        const customer = await this.findOrCreateCustomer(customerData);
        if (customer) {
          await this.purchaseOrderRepository.updateCustomerId(purchaseOrderId, customer.uuid);
        }
      } catch (error) {
        console.error("Error processing customer data:", error);
      }
    }

    // Then handle vendor data
    if (vendorData && Object.keys(vendorData).length > 0) {
      try {
        const vendor = await this.findOrCreateVendor(vendorData);
        if (vendor) {
          await this.purchaseOrderRepository.updateVendorId(purchaseOrderId, vendor.uuid);
        }
      } catch (error) {
        console.error("Error processing vendor data:", error);
      }
    }
  }

  /**
   * Save purchase order items to the database
   * @param {string} purchaseOrderId - The ID of the purchase order
   * @param {Array} itemsData - Array of item data objects
   */
  async saveInvoiceItems(purchaseOrderId, itemsData) {
    if (!itemsData || !Array.isArray(itemsData) || itemsData.length === 0) {
      console.log("No items to save");
      return;
    }

    try {
      for (const itemData of itemsData) {
        const item = await this.itemRepository.findOrCreateItem(itemData.description);

        await this.itemRepository.createDocumentItem(
          'PurchaseOrder',
          purchaseOrderId,
          item.uuid,
          {
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

  async getPurchaseOrderById(id) {
    try {
      const purchaseOrder = await this.purchaseOrderRepository.findById(id);
      
      if (!purchaseOrder) {
        throw new Error("Purchase order not found");
      }
      
      // Get the items associated with this purchase order
      const items = await this.getItems(id);
      
      // Get the customer associated with this purchase order
      let customer = null;
      if (purchaseOrder.customer_id) {
        customer = await this.getCustomer(purchaseOrder.customer_id);
      }
      
      // Get the vendor associated with this purchase order
      let vendor = null;
      if (purchaseOrder.vendor_id) {
        vendor = await this.getVendor(purchaseOrder.vendor_id);
      }
      
      // Format and return the response
      return this.responseFormatter.formatPurchaseOrderResponse(purchaseOrder, items, customer, vendor);
    } catch (error) {
      console.error("Error retrieving purchase order:", error);
      throw error;
    }
  }

  /**
   * Get partner ID from purchase order
   * @param {string} id - The purchase order ID
   * @returns {Promise<string>} - The partner ID
   */
  async getPartnerId(id) {
    const purchaseOrder = await this.purchaseOrderRepository.findById(id);
    if (!purchaseOrder) {
      throw new Error("Purchase order not found");
    }
    return purchaseOrder.partner_id;
  }

  /**
   * Delete purchase order by ID
   * @param {string} id - The purchase order ID
   */
  async deletePurchaseOrderById(id) {
    return this.purchaseOrderRepository.delete(id);
  }

  /**
   * Get items for a purchase order
   * @param {string} purchaseOrderId - The purchase order ID
   * @returns {Promise<Array>} - Array of items
   */
  async getItems(purchaseOrderId) {
    try {
      return await this.itemRepository.findItemsByDocumentId(purchaseOrderId, 'PurchaseOrder');
    } catch (error) {
      console.error(`Error fetching items for purchase order ${purchaseOrderId}:`, error);
      return [];
    }
  }

  /**
   * Get customer by ID
   * @param {string} customerId - The customer ID
   * @returns {Promise<Object|null>} - Customer data
   */
  async getCustomer(customerId) {
    try {
      return await this.customerRepository.findById(customerId);
    } catch (error) {
      console.error(`Error fetching customer ${customerId}:`, error);
      return null;
    }
  }

  /**
   * Get vendor by ID
   * @param {string} vendorId - The vendor ID
   * @returns {Promise<Object|null>} - Vendor data
   */
  async getVendor(vendorId) {
    try {
      return await this.vendorRepository.findById(vendorId);
    } catch (error) {
      console.error(`Error fetching vendor ${vendorId}:`, error);
      return null;
    }
  }

  /**
   * Find or create a customer based on provided data
   * @param {Object} customerData - Customer data to find or create
   * @returns {Promise<Object|null>} - Customer object or null
   */
  async findOrCreateCustomer(customerData) {
    if (!customerData?.name) {
      return null;
    }

    try {
      let customer = await this.customerRepository.findByAttributes({
        name: customerData.name,
        ...(customerData.tax_id && { tax_id: customerData.tax_id }),
        ...(customerData.address && { address: customerData.address })
      });

      if (!customer) {
        customer = await this.customerRepository.create(customerData);
      }

      return customer;
    } catch (error) {
      console.error("Error finding or creating customer:", error);
      return null;
    }
  }

  /**
   * Find or create a vendor based on provided data
   * @param {Object} vendorData - Vendor data to find or create
   * @returns {Promise<Object|null>} - Vendor object or null
   */
  async findOrCreateVendor(vendorData) {
    if (!vendorData?.name) {
      return null;
    }

    try {
      let vendor = await this.vendorRepository.findByAttributes({
        name: vendorData.name,
        ...(vendorData.tax_id && { tax_id: vendorData.tax_id }),
        ...(vendorData.address && { address: vendorData.address })
      });

      if (!vendor) {
        vendor = await this.vendorRepository.create(vendorData);
      }

      return vendor;
    } catch (error) {
      console.error("Error finding or creating vendor:", error);
      return null;
    }
  }
}

module.exports = new PurchaseOrderService();
