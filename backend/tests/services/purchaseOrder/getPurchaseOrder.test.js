const purchaseOrderService = require('../../../src/services/purchaseOrder/purchaseOrderService');
const DocumentStatus = require('../../../src/models/enums/DocumentStatus');

// Mock repositories
jest.mock('../../../src/repositories/purchaseOrderRepository', () => {
  return jest.fn().mockImplementation(() => ({
    findById: jest.fn()
  }));
});

// Mock other dependencies
jest.mock('../../../src/repositories/customerRepository');
jest.mock('../../../src/repositories/vendorRepository');
jest.mock('../../../src/repositories/itemRepository');

// Mock formatter
jest.mock('../../../src/services/purchaseOrder/purchaseOrderResponseFormatter', () => {
  return jest.fn().mockImplementation(() => ({
    formatPurchaseOrderResponse: jest.fn()
  }));
});

// Mock Sentry
jest.mock('../../../src/instrument', () => ({
  init: jest.fn(),
  startSpan: jest.fn((_, callback) => callback({
    setAttribute: jest.fn(),
    setStatus: jest.fn(),
    end: jest.fn()
  })),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

describe('Purchase Order Service - getPurchaseOrderById', () => {
  // Setup common response format
  const mockFormattedResponse = {
    data: {
      documents: [{
        header: {
          purchase_order_details: {
            purchase_order_id: 'PO-123',
            purchase_order_date: "2025-02-01"
          },
          vendor_details: {
            name: null,
            address: "",
            recipient_name: null,
            tax_id: null
          },
          customer_details: {
            id: null,
            name: null,
            recipient_name: null,
            address: "",
            tax_id: null
          },
          financial_details: {
            currency: { currency_symbol: "$", currency_code: "USD" },
            total_amount: 0,
            subtotal_amount: 0,
            discount_amount: 0,
            total_tax_amount: 0
          }
        },
        items: []
      }]
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console to prevent cluttering test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Setup default mock behavior
    purchaseOrderService.responseFormatter.formatPurchaseOrderResponse = jest.fn().mockReturnValue(mockFormattedResponse);
  });

  afterEach(() => {
    console.error.mockRestore();
    jest.restoreAllMocks();
  });

  test('should return formatted purchase order when found', async () => {
    // Arrange
    const purchaseOrderId = 'test-po-123';
    const mockPurchaseOrder = {
      id: purchaseOrderId,
      status: DocumentStatus.ANALYZED,
      po_number: 'PO-123',
      partner_id: 'partner-abc'
    };

    purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
    purchaseOrderService.itemRepository.findItemsByDocumentId = jest.fn().mockResolvedValue([]);
    purchaseOrderService.customerRepository.findById = jest.fn().mockResolvedValue(null);
    purchaseOrderService.vendorRepository.findById = jest.fn().mockResolvedValue(null);

    // Act
    const result = await purchaseOrderService.getPurchaseOrderById(purchaseOrderId);

    // Assert
    expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith(purchaseOrderId);
    expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalledWith(
      mockPurchaseOrder,
      [],
      null,
      null
    );
    expect(result).toEqual(mockFormattedResponse);
  });

  test('should throw error when purchase order not found', async () => {
    // Arrange
    const purchaseOrderId = 'non-existent-po';
    purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(null);

    // Act & Assert
    await expect(purchaseOrderService.getPurchaseOrderById(purchaseOrderId))
      .rejects.toThrow('Purchase order not found');
    expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith(purchaseOrderId);
    expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).not.toHaveBeenCalled();
  });

  test('should propagate repository errors', async () => {
    // Arrange
    const purchaseOrderId = 'test-po-123';
    const dbError = new Error('Database connection failed');
    purchaseOrderService.purchaseOrderRepository.findById.mockRejectedValue(dbError);

    // Act & Assert
    await expect(purchaseOrderService.getPurchaseOrderById(purchaseOrderId))
      .rejects.toThrow('Database connection failed');
    expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith(purchaseOrderId);
    expect(console.error).toHaveBeenCalledWith('Error retrieving purchase order:', dbError);
  });

  test('should handle case where customer_id exists but customer is not found', async () => {
    // Arrange
    const purchaseOrderId = 'po-with-missing-customer';
    const mockPurchaseOrder = {
      id: purchaseOrderId,
      status: DocumentStatus.ANALYZED,
      po_number: 'PO-123',
      customer_id: 'missing-customer-uuid'
    };

    purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
    purchaseOrderService.customerRepository.findById = jest.fn().mockResolvedValue(null);
    purchaseOrderService.vendorRepository.findById = jest.fn().mockResolvedValue(null);
    purchaseOrderService.itemRepository.findItemsByDocumentId = jest.fn().mockResolvedValue([]);

    // Customize formatted response for this test
    const customResponse = JSON.parse(JSON.stringify(mockFormattedResponse));
    customResponse.data.documents[0].header.purchase_order_details.purchase_order_date = "2025-02-01";
    purchaseOrderService.responseFormatter.formatPurchaseOrderResponse.mockReturnValue(customResponse);

    // Act
    const result = await purchaseOrderService.getPurchaseOrderById(purchaseOrderId);

    // Assert
    expect(purchaseOrderService.customerRepository.findById).toHaveBeenCalledWith('missing-customer-uuid');
    expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalledWith(
      mockPurchaseOrder,
      [],
      null,
      null
    );
    expect(result.data.documents[0].header.purchase_order_details.purchase_order_date).toEqual("2025-02-01");
  });

  test('should handle case where vendor_id exists but vendor is not found', async () => {
    // Arrange
    const purchaseOrderId = 'po-with-missing-vendor';
    const mockPurchaseOrder = {
      id: purchaseOrderId,
      status: DocumentStatus.ANALYZED,
      po_number: 'PO-123',
      vendor_id: 'missing-vendor-uuid'
    };

    purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
    purchaseOrderService.vendorRepository.findById = jest.fn().mockResolvedValue(null);
    purchaseOrderService.customerRepository.findById = jest.fn().mockResolvedValue(null);
    purchaseOrderService.itemRepository.findItemsByDocumentId = jest.fn().mockResolvedValue([]);

    // Act
    await purchaseOrderService.getPurchaseOrderById(purchaseOrderId);

    // Assert
    expect(purchaseOrderService.vendorRepository.findById).toHaveBeenCalledWith('missing-vendor-uuid');
    expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalledWith(
      mockPurchaseOrder,
      [],
      null,
      null
    );
  });

  test('should include customer data when customer exists', async () => {
    // Arrange
    const purchaseOrderId = 'po-with-customer';
    const mockPurchaseOrder = {
      id: purchaseOrderId,
      po_date: "2025-02-01",
      status: DocumentStatus.ANALYZED,
      customer_id: 'existing-customer-uuid'
    };

    const mockCustomer = {
      uuid: 'existing-customer-uuid',
      name: 'Existing Customer',
      address: '123 Test St'
    };

    purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
    purchaseOrderService.customerRepository.findById = jest.fn().mockResolvedValue(mockCustomer);
    purchaseOrderService.vendorRepository.findById = jest.fn().mockResolvedValue(null);
    purchaseOrderService.itemRepository.findItemsByDocumentId = jest.fn().mockResolvedValue([]);

    // Customize formatter response for this test
    const customResponse = JSON.parse(JSON.stringify(mockFormattedResponse));
    customResponse.data.documents[0].header.customer_details = {
      id: 'existing-customer-uuid',
      name: 'Existing Customer',
      address: '123 Test St',
      recipient_name: null,
      tax_id: null
    };
    purchaseOrderService.responseFormatter.formatPurchaseOrderResponse.mockReturnValue(customResponse);

    // Act
    const result = await purchaseOrderService.getPurchaseOrderById(purchaseOrderId);

    // Assert
    expect(purchaseOrderService.customerRepository.findById).toHaveBeenCalledWith('existing-customer-uuid');
    expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalledWith(
      mockPurchaseOrder,
      [],
      mockCustomer,
      null
    );
    expect(result.data.documents[0].header.customer_details.name).toBe('Existing Customer');
    expect(result.data.documents[0].header.customer_details.id).toBe('existing-customer-uuid');
    expect(result.data.documents[0].header.customer_details.address).toBe('123 Test St');
  });

  test('should include vendor data when vendor exists', async () => {
    // Arrange
    const purchaseOrderId = 'po-with-vendor';
    const mockPurchaseOrder = {
      id: purchaseOrderId,
      po_date: "2025-02-01",
      status: DocumentStatus.ANALYZED,
      vendor_id: 'existing-vendor-uuid'
    };

    const mockVendor = {
      uuid: 'existing-vendor-uuid',
      name: 'Existing Vendor',
      address: '456 Vendor St'
    };

    purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
    purchaseOrderService.vendorRepository.findById = jest.fn().mockResolvedValue(mockVendor);
    purchaseOrderService.customerRepository.findById = jest.fn().mockResolvedValue(null);
    purchaseOrderService.itemRepository.findItemsByDocumentId = jest.fn().mockResolvedValue([]);

    // Customize formatter response for this test
    const customResponse = JSON.parse(JSON.stringify(mockFormattedResponse));
    customResponse.data.documents[0].header.vendor_details = {
      name: 'Existing Vendor',
      address: '456 Vendor St',
      recipient_name: null,
      tax_id: null
    };
    purchaseOrderService.responseFormatter.formatPurchaseOrderResponse.mockReturnValue(customResponse);

    // Act
    const result = await purchaseOrderService.getPurchaseOrderById(purchaseOrderId);

    // Assert
    expect(purchaseOrderService.vendorRepository.findById).toHaveBeenCalledWith('existing-vendor-uuid');
    expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalledWith(
      mockPurchaseOrder,
      [],
      null,
      mockVendor
    );
    expect(result.data.documents[0].header.vendor_details.name).toBe('Existing Vendor');
    expect(result.data.documents[0].header.vendor_details.address).toBe('456 Vendor St');
  });

  test('should correctly transform items data to the required format', async () => {
    // Arrange
    const purchaseOrderId = 'po-with-items';
    const mockPurchaseOrder = {
      id: purchaseOrderId,
      status: DocumentStatus.ANALYZED
    };

    const mockItems = [
      {
        amount: 21.00,
        description: 'Test Item',
        quantity: 2,
        unit: 'pcs',
        unit_price: 10.50
      }
    ];

    purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
    purchaseOrderService.itemRepository.findItemsByDocumentId = jest.fn().mockResolvedValue(mockItems);
    purchaseOrderService.customerRepository.findById = jest.fn().mockResolvedValue(null);
    purchaseOrderService.vendorRepository.findById = jest.fn().mockResolvedValue(null);

    // Customize formatter response for this test
    const customResponse = JSON.parse(JSON.stringify(mockFormattedResponse));
    customResponse.data.documents[0].items = mockItems;
    purchaseOrderService.responseFormatter.formatPurchaseOrderResponse.mockReturnValue(customResponse);

    // Act
    const result = await purchaseOrderService.getPurchaseOrderById(purchaseOrderId);

    // Assert
    expect(purchaseOrderService.itemRepository.findItemsByDocumentId).toHaveBeenCalledWith(purchaseOrderId, 'PurchaseOrder');
    expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalledWith(
      mockPurchaseOrder,
      mockItems,
      null,
      null
    );
    expect(result.data.documents[0].items).toEqual(mockItems);
  });

  test('should handle null address for customer', async () => {
    // Arrange
    const purchaseOrderId = 'po-customer-null-address';
    const mockPurchaseOrder = {
      id: purchaseOrderId,
      po_date: '2025-02-01',
      status: DocumentStatus.ANALYZED,
      customer_id: 'customer-with-null-address'
    };

    const mockCustomer = {
      uuid: 'customer-with-null-address',
      name: 'Customer With Null Address',
      address: null,
      recipient_name: 'John Doe',
      tax_id: '123-45-6789'
    };

    purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
    purchaseOrderService.customerRepository.findById = jest.fn().mockResolvedValue(mockCustomer);
    purchaseOrderService.vendorRepository.findById = jest.fn().mockResolvedValue(null);
    purchaseOrderService.itemRepository.findItemsByDocumentId = jest.fn().mockResolvedValue([]);

    // Customize formatter response for this test
    const customResponse = JSON.parse(JSON.stringify(mockFormattedResponse));
    customResponse.data.documents[0].header.customer_details = {
      id: 'customer-with-null-address',
      name: 'Customer With Null Address',
      address: '', // Should be empty string
      recipient_name: 'John Doe',
      tax_id: '123-45-6789'
    };
    purchaseOrderService.responseFormatter.formatPurchaseOrderResponse.mockReturnValue(customResponse);

    // Act
    const result = await purchaseOrderService.getPurchaseOrderById(purchaseOrderId);

    // Assert
    expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalledWith(
      mockPurchaseOrder,
      [],
      mockCustomer,
      null
    );
    expect(result.data.documents[0].header.customer_details.address).toBe('');
  });

  test('should handle null address for vendor', async () => {
    // Arrange
    const purchaseOrderId = 'po-vendor-null-address';
    const mockPurchaseOrder = {
      id: purchaseOrderId,
      po_date: '2025-02-01',
      status: DocumentStatus.ANALYZED,
      vendor_id: 'vendor-with-null-address'
    };

    const mockVendor = {
      uuid: 'vendor-with-null-address',
      name: 'Vendor With Null Address',
      address: null,
      recipient_name: 'Jane Smith',
      tax_id: '987-65-4321'
    };

    purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
    purchaseOrderService.vendorRepository.findById = jest.fn().mockResolvedValue(mockVendor);
    purchaseOrderService.customerRepository.findById = jest.fn().mockResolvedValue(null);
    purchaseOrderService.itemRepository.findItemsByDocumentId = jest.fn().mockResolvedValue([]);

    // Customize formatter response for this test
    const customResponse = JSON.parse(JSON.stringify(mockFormattedResponse));
    customResponse.data.documents[0].header.vendor_details = {
      name: 'Vendor With Null Address',
      address: '', // Should be empty string
      recipient_name: 'Jane Smith',
      tax_id: '987-65-4321'
    };
    purchaseOrderService.responseFormatter.formatPurchaseOrderResponse.mockReturnValue(customResponse);

    // Act
    const result = await purchaseOrderService.getPurchaseOrderById(purchaseOrderId);

    // Assert
    expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalledWith(
      mockPurchaseOrder,
      [],
      null,
      mockVendor
    );
    expect(result.data.documents[0].header.vendor_details.address).toBe('');
  });

  describe('Purchase Order Status Handling', () => {
    // Positive tests - Each possible status scenario
    test('should return processing message when purchase order status is PROCESSING', async () => {
      // Arrange
      const mockPurchaseOrder = {
        id: 'processing-po',
        po_date: '2025-02-01',
        status: DocumentStatus.PROCESSING
      };

      purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
      purchaseOrderService.itemRepository.findItemsByDocumentId = jest.fn();
      purchaseOrderService.customerRepository.findById = jest.fn();
      purchaseOrderService.vendorRepository.findById = jest.fn();

      // Act
      const result = await purchaseOrderService.getPurchaseOrderById('processing-po');

      // Assert
      expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith('processing-po');
      expect(purchaseOrderService.itemRepository.findItemsByDocumentId).not.toHaveBeenCalled();
      expect(purchaseOrderService.customerRepository.findById).not.toHaveBeenCalled();
      expect(purchaseOrderService.vendorRepository.findById).not.toHaveBeenCalled();
      expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).not.toHaveBeenCalled();
      
      expect(result).toEqual({
        message: 'Purchase order is still being processed. Please try again later.',
        data: { documents: [] }
      });
    });

    test('should return failed message when purchase order status is FAILED', async () => {
      // Arrange
      const mockPurchaseOrder = {
        id: 'failed-po',
        po_date: '2025-02-01',
        status: DocumentStatus.FAILED
      };

      purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
      purchaseOrderService.itemRepository.findItemsByDocumentId = jest.fn();
      purchaseOrderService.customerRepository.findById = jest.fn();
      purchaseOrderService.vendorRepository.findById = jest.fn();

      // Act
      const result = await purchaseOrderService.getPurchaseOrderById('failed-po');

      // Assert
      expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith('failed-po');
      expect(purchaseOrderService.itemRepository.findItemsByDocumentId).not.toHaveBeenCalled();
      expect(purchaseOrderService.customerRepository.findById).not.toHaveBeenCalled();
      expect(purchaseOrderService.vendorRepository.findById).not.toHaveBeenCalled();
      expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).not.toHaveBeenCalled();
      
      expect(result).toEqual({
        message: 'Purchase order processing failed. Please re-upload the document.',
        data: { documents: [] }
      });
    });

    test('should process purchase order normally when status is ANALYZED', async () => {
      // Arrange
      const mockPurchaseOrder = {
        id: 'analyzed-po',
        po_date: '2025-02-01',
        status: DocumentStatus.ANALYZED,
        po_number: 'PO-001'
      };

      purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
      purchaseOrderService.itemRepository.findItemsByDocumentId = jest.fn().mockResolvedValue([]);
      purchaseOrderService.customerRepository.findById = jest.fn().mockResolvedValue(null);
      purchaseOrderService.vendorRepository.findById = jest.fn().mockResolvedValue(null);

      // Act
      await purchaseOrderService.getPurchaseOrderById('analyzed-po');

      // Assert
      expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith('analyzed-po');
      expect(purchaseOrderService.itemRepository.findItemsByDocumentId).toHaveBeenCalled();
      expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalled();
    });
    
    // Additional positive test with fully populated data
    test('should process purchase order with all properties when status is ANALYZED', async () => {
      // Arrange
      const mockPurchaseOrder = {
        id: 'complete-po',
        po_date: '2025-02-01',
        po_number: 'PO-001',
        total_amount: 1500.00,
        status: DocumentStatus.ANALYZED,
        customer_id: 'customer-123',
        vendor_id: 'vendor-456'
      };

      const mockItems = [
        { description: 'Item 1', quantity: 2, unit: 'pcs', unit_price: 500, amount: 1000 },
        { description: 'Item 2', quantity: 1, unit: 'ea', unit_price: 500, amount: 500 }
      ];

      purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
      purchaseOrderService.itemRepository.findItemsByDocumentId = jest.fn().mockResolvedValue(mockItems);
      purchaseOrderService.customerRepository.findById = jest.fn().mockResolvedValue({ uuid: 'customer-123', name: 'Test Customer' });
      purchaseOrderService.vendorRepository.findById = jest.fn().mockResolvedValue({ uuid: 'vendor-456', name: 'Test Vendor' });
      
      // Act
      await purchaseOrderService.getPurchaseOrderById('complete-po');

      // Assert
      expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith('complete-po');
      expect(purchaseOrderService.itemRepository.findItemsByDocumentId).toHaveBeenCalled();
      expect(purchaseOrderService.customerRepository.findById).toHaveBeenCalled();
      expect(purchaseOrderService.vendorRepository.findById).toHaveBeenCalled();
      expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalled();
    });

    // Negative tests
    test('should handle case when status property is missing', async () => {
      // Arrange
      const mockPurchaseOrder = {
        id: 'no-status-po',
        po_date: '2025-02-01',
        // status is intentionally missing
      };

      purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
      purchaseOrderService.itemRepository.findItemsByDocumentId = jest.fn().mockResolvedValue([]);
      purchaseOrderService.customerRepository.findById = jest.fn().mockResolvedValue(null);
      purchaseOrderService.vendorRepository.findById = jest.fn().mockResolvedValue(null);

      // Act
      await purchaseOrderService.getPurchaseOrderById('no-status-po');

      // Assert - Should proceed with normal processing
      expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith('no-status-po');
      expect(purchaseOrderService.itemRepository.findItemsByDocumentId).toHaveBeenCalled();
      expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalled();
    });

    // Corner cases
    test('should handle undefined status gracefully', async () => {
      // Arrange
      const mockPurchaseOrder = {
        id: 'undefined-status-po',
        po_date: '2025-02-01',
        status: undefined
      };

      purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
      purchaseOrderService.itemRepository.findItemsByDocumentId = jest.fn().mockResolvedValue([]);
      purchaseOrderService.customerRepository.findById = jest.fn().mockResolvedValue(null);
      purchaseOrderService.vendorRepository.findById = jest.fn().mockResolvedValue(null);

      // Act
      await purchaseOrderService.getPurchaseOrderById('undefined-status-po');

      // Assert - Should proceed with normal processing
      expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith('undefined-status-po');
      expect(purchaseOrderService.itemRepository.findItemsByDocumentId).toHaveBeenCalled();
      expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalled();
    });

    test('should handle null status gracefully', async () => {
      // Arrange
      const mockPurchaseOrder = {
        id: 'null-status-po',
        po_date: '2025-02-01',
        status: null
      };

      purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
      purchaseOrderService.itemRepository.findItemsByDocumentId = jest.fn().mockResolvedValue([]);
      purchaseOrderService.customerRepository.findById = jest.fn().mockResolvedValue(null);
      purchaseOrderService.vendorRepository.findById = jest.fn().mockResolvedValue(null);

      // Act
      await purchaseOrderService.getPurchaseOrderById('null-status-po');

      // Assert - Should proceed with normal processing
      expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith('null-status-po');
      expect(purchaseOrderService.itemRepository.findItemsByDocumentId).toHaveBeenCalled();
      expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalled();
    });

    test('should handle non-standard status values', async () => {
      // Arrange
      const mockPurchaseOrder = {
        id: 'invalid-status-po',
        po_date: '2025-02-01',
        status: 'INVALID_STATUS'  // Non-standard status
      };

      purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
      purchaseOrderService.itemRepository.findItemsByDocumentId = jest.fn().mockResolvedValue([]);
      purchaseOrderService.customerRepository.findById = jest.fn().mockResolvedValue(null);
      purchaseOrderService.vendorRepository.findById = jest.fn().mockResolvedValue(null);

      // Act
      await purchaseOrderService.getPurchaseOrderById('invalid-status-po');

      // Assert - Should proceed with normal processing
      expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith('invalid-status-po');
      expect(purchaseOrderService.itemRepository.findItemsByDocumentId).toHaveBeenCalled();
      expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalled();
    });

    test('should handle case-insensitive status comparisons', async () => {
      // Arrange
      const mockPurchaseOrder = {
        id: 'lowercase-status-po',
        po_date: '2025-02-01',
        status: 'processing'  // Lowercase version of PROCESSING
      };

      purchaseOrderService.purchaseOrderRepository.findById.mockResolvedValue(mockPurchaseOrder);
      purchaseOrderService.itemRepository.findItemsByDocumentId = jest.fn().mockResolvedValue([]);
      purchaseOrderService.customerRepository.findById = jest.fn().mockResolvedValue(null);
      purchaseOrderService.vendorRepository.findById = jest.fn().mockResolvedValue(null);

      // Act
      await purchaseOrderService.getPurchaseOrderById('lowercase-status-po');

      // Assert - Should proceed with normal processing (not match PROCESSING)
      expect(purchaseOrderService.purchaseOrderRepository.findById).toHaveBeenCalledWith('lowercase-status-po');
      expect(purchaseOrderService.itemRepository.findItemsByDocumentId).toHaveBeenCalled();
      expect(purchaseOrderService.responseFormatter.formatPurchaseOrderResponse).toHaveBeenCalled();
    });
  });
});