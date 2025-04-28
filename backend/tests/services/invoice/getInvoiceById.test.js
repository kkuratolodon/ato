const DocumentStatus = require('../../../src/models/enums/DocumentStatus');
const invoiceService = require('../../../src/services/invoice/invoiceService');

// Mock the repositories
jest.mock('../../../src/repositories/invoiceRepository');
jest.mock('../../../src/repositories/customerRepository');
jest.mock('../../../src/repositories/vendorRepository');
jest.mock('../../../src/repositories/itemRepository');
jest.mock('../../../src/services/invoice/invoiceResponseFormatter');

// Other mocks needed for invoiceService to initialize properly
jest.mock('../../../src/services/analysis/azureDocumentAnalyzer');
jest.mock('../../../src/services/invoice/invoiceValidator');
jest.mock('../../../src/services/invoiceMapperService/invoiceMapperService');

// Sentry mock
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

describe("getInvoiceById", () => {
  // Setup common response format
  const mockFormattedResponse = {
    data: {
      documents: [{
        header: {
          invoice_details: {
            invoice_number: "INV-001",
            invoice_date: "2025-02-01"
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
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock behavior
    invoiceService.responseFormatter.formatInvoiceResponse = jest.fn().mockReturnValue(mockFormattedResponse);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Should return an invoice when given a valid ID", async () => {
    // Arrange
    const mockInvoice = {
      id: '1',
      invoice_number: "INV-001",
      status: DocumentStatus.ANALYZED
    };

    invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);
    invoiceService.itemRepository.findItemsByDocumentId.mockResolvedValue([]);

    // Act
    const result = await invoiceService.getInvoiceById('1');

    // Assert
    expect(invoiceService.invoiceRepository.findById).toHaveBeenCalledWith('1');
    expect(invoiceService.itemRepository.findItemsByDocumentId).toHaveBeenCalledWith('1', 'Invoice');
    expect(invoiceService.responseFormatter.formatInvoiceResponse).toHaveBeenCalledWith(
      mockInvoice, 
      [],  // empty items array
      null, // no customer
      null  // no vendor
    );
    
    expect(result).toHaveProperty('data');
    expect(result.data).toHaveProperty('documents');
    expect(Array.isArray(result.data.documents)).toBe(true);
    expect(result.data.documents.length).toBe(1);
    expect(result.data.documents[0]).toHaveProperty('header');
    expect(result.data.documents[0]).toHaveProperty('items');
  });

  test("Should throw an error when invoice is not found", async () => {
    // Arrange
    invoiceService.invoiceRepository.findById.mockResolvedValue(null);

    // Act & Assert
    await expect(invoiceService.getInvoiceById('99999999')).rejects.toThrow("Invoice not found");
  });

  test("Should throw an error when database fails", async () => {
    // Arrange
    invoiceService.invoiceRepository.findById.mockRejectedValue(new Error("Database error"));

    // Act & Assert
    await expect(invoiceService.getInvoiceById('1')).rejects.toThrow("Failed to retrieve invoice: Database error");
  });

  test("Should handle case where customer_id exists but customer isn't found", async () => {
    // Arrange
    const mockInvoice = {
      id: '1',
      invoice_date: "2025-02-01",
      customer_id: "missing-customer-uuid",
      status: DocumentStatus.ANALYZED
    };

    invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);
    invoiceService.customerRepository.findById.mockResolvedValue(null);
    invoiceService.itemRepository.findItemsByDocumentId.mockResolvedValue([]);

    // Customize formatted response for this test
    const customResponse = JSON.parse(JSON.stringify(mockFormattedResponse));
    customResponse.data.documents[0].header.invoice_details.invoice_date = "2025-02-01";
    invoiceService.responseFormatter.formatInvoiceResponse.mockReturnValue(customResponse);

    // Act
    const result = await invoiceService.getInvoiceById('1');

    // Assert
    expect(invoiceService.customerRepository.findById).toHaveBeenCalledWith("missing-customer-uuid");
    expect(invoiceService.responseFormatter.formatInvoiceResponse).toHaveBeenCalledWith(
      mockInvoice,
      [],
      null,
      null
    );
    
    expect(result.data.documents[0].header.invoice_details.invoice_date).toEqual("2025-02-01");
  });

  test("Should handle case where vendor_id exists but vendor isn't found", async () => {
    // Arrange
    const mockInvoice = {
      id: '1',
      invoice_date: "2025-02-01",
      vendor_id: "missing-vendor-uuid",
      status: DocumentStatus.ANALYZED
    };

    invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);
    invoiceService.vendorRepository.findById.mockResolvedValue(null);
    invoiceService.itemRepository.findItemsByDocumentId.mockResolvedValue([]);

    // Act
    await invoiceService.getInvoiceById('1');

    // Assert
    expect(invoiceService.vendorRepository.findById).toHaveBeenCalledWith("missing-vendor-uuid");
    expect(invoiceService.responseFormatter.formatInvoiceResponse).toHaveBeenCalledWith(
      mockInvoice,
      [],
      null,
      null
    );
  });

  test("Should include customer data when customer exists", async () => {
    // Arrange
    const mockInvoice = {
      id: '1',
      invoice_date: "2025-02-01",
      customer_id: "existing-customer-uuid",
      status: DocumentStatus.ANALYZED
    };

    const mockCustomer = {
      uuid: "existing-customer-uuid",
      name: "Existing Customer",
      address: "123 Test St"
    };

    invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);
    invoiceService.customerRepository.findById.mockResolvedValue(mockCustomer);
    invoiceService.itemRepository.findItemsByDocumentId.mockResolvedValue([]);

    // Customize formatter response for this test
    const customResponse = JSON.parse(JSON.stringify(mockFormattedResponse));
    customResponse.data.documents[0].header.customer_details = {
      id: "existing-customer-uuid",
      name: "Existing Customer",
      address: "123 Test St",
      recipient_name: null,
      tax_id: null
    };
    invoiceService.responseFormatter.formatInvoiceResponse.mockReturnValue(customResponse);

    // Act
    const result = await invoiceService.getInvoiceById('1');

    // Assert
    expect(invoiceService.customerRepository.findById).toHaveBeenCalledWith("existing-customer-uuid");
    expect(invoiceService.responseFormatter.formatInvoiceResponse).toHaveBeenCalledWith(
      mockInvoice,
      [],
      mockCustomer,
      null
    );
    
    expect(result.data.documents[0].header.customer_details.name).toBe('Existing Customer');
    expect(result.data.documents[0].header.customer_details.id).toBe('existing-customer-uuid');
    expect(result.data.documents[0].header.customer_details.address).toBe('123 Test St');
  });

  test("Should include vendor data when vendor exists", async () => {
    // Arrange
    const mockInvoice = {
      id: '1',
      invoice_date: "2025-02-01",
      vendor_id: "existing-vendor-uuid",
      status: DocumentStatus.ANALYZED
    };

    const mockVendor = {
      uuid: "existing-vendor-uuid",
      name: "Existing Vendor",
      address: "456 Vendor St"
    };

    invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);
    invoiceService.vendorRepository.findById.mockResolvedValue(mockVendor);
    invoiceService.itemRepository.findItemsByDocumentId.mockResolvedValue([]);

    // Customize formatter response for this test
    const customResponse = JSON.parse(JSON.stringify(mockFormattedResponse));
    customResponse.data.documents[0].header.vendor_details = {
      name: "Existing Vendor",
      address: "456 Vendor St",
      recipient_name: null,
      tax_id: null
    };
    invoiceService.responseFormatter.formatInvoiceResponse.mockReturnValue(customResponse);

    // Act
    const result = await invoiceService.getInvoiceById('1');

    // Assert
    expect(invoiceService.vendorRepository.findById).toHaveBeenCalledWith("existing-vendor-uuid");
    expect(invoiceService.responseFormatter.formatInvoiceResponse).toHaveBeenCalledWith(
      mockInvoice,
      [],
      null,
      mockVendor
    );
    
    expect(result.data.documents[0].header.vendor_details.name).toBe('Existing Vendor');
    expect(result.data.documents[0].header.vendor_details.address).toBe('456 Vendor St');
  });

  test("Should correctly transform items data to the required format", async () => {
    // Arrange
    const mockInvoice = {
      id: '1',
      status: DocumentStatus.ANALYZED
    };

    const mockItems = [
      {
        amount: 21.00,
        description: "Test Item",
        quantity: 2,
        unit: "pcs",
        unit_price: 10.50
      }
    ];

    invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);
    invoiceService.itemRepository.findItemsByDocumentId.mockResolvedValue(mockItems);

    // Customize formatter response for this test
    const customResponse = JSON.parse(JSON.stringify(mockFormattedResponse));
    customResponse.data.documents[0].items = mockItems;
    invoiceService.responseFormatter.formatInvoiceResponse.mockReturnValue(customResponse);

    // Act
    const result = await invoiceService.getInvoiceById('1');

    // Assert
    expect(invoiceService.responseFormatter.formatInvoiceResponse).toHaveBeenCalledWith(
      mockInvoice,
      mockItems,
      null,
      null
    );

    expect(result.data.documents[0].items).toEqual(mockItems);
  });

  test("Should handle null address for customer", async () => {
    // Arrange
    const mockInvoice = {
      id: '1',
      invoice_date: "2025-02-01",
      customer_id: "customer-with-null-address",
      status: DocumentStatus.ANALYZED
    };

    const mockCustomer = {
      uuid: "customer-with-null-address",
      name: "Customer With Null Address",
      address: null,
      recipient_name: "John Doe",
      tax_id: "123-45-6789"
    };

    invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);
    invoiceService.customerRepository.findById.mockResolvedValue(mockCustomer);
    invoiceService.itemRepository.findItemsByDocumentId.mockResolvedValue([]);

    // Customize formatter response for this test
    const customResponse = JSON.parse(JSON.stringify(mockFormattedResponse));
    customResponse.data.documents[0].header.customer_details = {
      id: "customer-with-null-address",
      name: "Customer With Null Address",
      address: "", // Should be empty string
      recipient_name: "John Doe",
      tax_id: "123-45-6789"
    };
    invoiceService.responseFormatter.formatInvoiceResponse.mockReturnValue(customResponse);

    // Act
    const result = await invoiceService.getInvoiceById('1');

    // Assert
    expect(invoiceService.responseFormatter.formatInvoiceResponse).toHaveBeenCalledWith(
      mockInvoice,
      [],
      mockCustomer,
      null
    );
    
    expect(result.data.documents[0].header.customer_details.address).toBe('');
  });

  test("Should handle null address for vendor", async () => {
    // Arrange
    const mockInvoice = {
      id: '1',
      invoice_date: "2025-02-01",
      vendor_id: "vendor-with-null-address",
      status: DocumentStatus.ANALYZED
    };

    const mockVendor = {
      uuid: "vendor-with-null-address",
      name: "Vendor With Null Address",
      address: null,
      recipient_name: "Jane Smith",
      tax_id: "987-65-4321"
    };

    invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);
    invoiceService.vendorRepository.findById.mockResolvedValue(mockVendor);
    invoiceService.itemRepository.findItemsByDocumentId.mockResolvedValue([]);

    // Customize formatter response for this test
    const customResponse = JSON.parse(JSON.stringify(mockFormattedResponse));
    customResponse.data.documents[0].header.vendor_details = {
      name: "Vendor With Null Address",
      address: "", // Should be empty string
      recipient_name: "Jane Smith",
      tax_id: "987-65-4321"
    };
    invoiceService.responseFormatter.formatInvoiceResponse.mockReturnValue(customResponse);

    // Act
    const result = await invoiceService.getInvoiceById('1');

    // Assert
    expect(invoiceService.responseFormatter.formatInvoiceResponse).toHaveBeenCalledWith(
      mockInvoice,
      [],
      null,
      mockVendor
    );
    
    expect(result.data.documents[0].header.vendor_details.address).toBe('');
  });

  describe("Invoice Status Handling", () => {
    // Positive tests - Each possible status scenario
    test("Should return processing message when invoice status is PROCESSING", async () => {
      // Arrange
      const mockInvoice = {
        id: '1',
        invoice_date: "2025-02-01",
        status: DocumentStatus.PROCESSING
      };

      invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);

      // Act
      const result = await invoiceService.getInvoiceById('1');

      // Assert
      expect(invoiceService.invoiceRepository.findById).toHaveBeenCalledWith('1');
      expect(invoiceService.itemRepository.findItemsByDocumentId).not.toHaveBeenCalled();
      expect(invoiceService.customerRepository.findById).not.toHaveBeenCalled();
      expect(invoiceService.vendorRepository.findById).not.toHaveBeenCalled();
      expect(invoiceService.responseFormatter.formatInvoiceResponse).not.toHaveBeenCalled();
      
      expect(result).toEqual({
        message: "Invoice is still being processed. Please try again later.",
        data: { documents: [] }
      });
    });

    test("Should return failed message when invoice status is FAILED", async () => {
      // Arrange
      const mockInvoice = {
        id: '1',
        invoice_date: "2025-02-01",
        status: DocumentStatus.FAILED
      };

      invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);

      // Act
      const result = await invoiceService.getInvoiceById('1');

      // Assert
      expect(invoiceService.invoiceRepository.findById).toHaveBeenCalledWith('1');
      expect(invoiceService.itemRepository.findItemsByDocumentId).not.toHaveBeenCalled();
      expect(invoiceService.customerRepository.findById).not.toHaveBeenCalled();
      expect(invoiceService.vendorRepository.findById).not.toHaveBeenCalled();
      expect(invoiceService.responseFormatter.formatInvoiceResponse).not.toHaveBeenCalled();
      
      expect(result).toEqual({
        message: "Invoice processing failed. Please re-upload the document.",
        data: { documents: [] }
      });
    });

    test("Should process invoice normally when status is ANALYZED", async () => {
      // Arrange
      const mockInvoice = {
        id: '1',
        invoice_date: "2025-02-01",
        status: DocumentStatus.ANALYZED,
        // Other invoice properties
        invoice_number: "INV-001"
      };

      invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);
      invoiceService.itemRepository.findItemsByDocumentId.mockResolvedValue([]);
      invoiceService.responseFormatter.formatInvoiceResponse.mockReturnValue(mockFormattedResponse);

      // Act
      await invoiceService.getInvoiceById('1');

      // Assert
      expect(invoiceService.invoiceRepository.findById).toHaveBeenCalledWith('1');
      expect(invoiceService.itemRepository.findItemsByDocumentId).toHaveBeenCalled();
      expect(invoiceService.responseFormatter.formatInvoiceResponse).toHaveBeenCalled();
    });
    
    // Additional positive test with fully populated data
    test("Should process invoice with all properties when status is ANALYZED", async () => {
      // Arrange
      const mockInvoice = {
        id: '1',
        invoice_date: "2025-02-01",
        due_date: "2025-03-01",
        invoice_number: "INV-001",
        total_amount: 1500.00,
        status: DocumentStatus.ANALYZED,
        customer_id: "customer-123",
        vendor_id: "vendor-456"
      };

      const mockItems = [
        { description: "Item 1", quantity: 2, unit: "pcs", unit_price: 500, amount: 1000 },
        { description: "Item 2", quantity: 1, unit: "ea", unit_price: 500, amount: 500 }
      ];

      invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);
      invoiceService.itemRepository.findItemsByDocumentId.mockResolvedValue(mockItems);
      invoiceService.customerRepository.findById.mockResolvedValue({ uuid: "customer-123", name: "Test Customer" });
      invoiceService.vendorRepository.findById.mockResolvedValue({ uuid: "vendor-456", name: "Test Vendor" });
      
      // Act
      await invoiceService.getInvoiceById('1');

      // Assert
      expect(invoiceService.invoiceRepository.findById).toHaveBeenCalledWith('1');
      expect(invoiceService.itemRepository.findItemsByDocumentId).toHaveBeenCalled();
      expect(invoiceService.customerRepository.findById).toHaveBeenCalled();
      expect(invoiceService.vendorRepository.findById).toHaveBeenCalled();
      expect(invoiceService.responseFormatter.formatInvoiceResponse).toHaveBeenCalled();
    });

    // Negative tests
    test("Should handle case when status property is missing", async () => {
      // Arrange
      const mockInvoice = {
        id: '1',
        invoice_date: "2025-02-01",
        // status is intentionally missing
      };

      invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);
      invoiceService.itemRepository.findItemsByDocumentId.mockResolvedValue([]);

      // Act
      await invoiceService.getInvoiceById('1');

      // Assert - Should proceed with normal processing
      expect(invoiceService.invoiceRepository.findById).toHaveBeenCalledWith('1');
      expect(invoiceService.itemRepository.findItemsByDocumentId).toHaveBeenCalled();
      expect(invoiceService.responseFormatter.formatInvoiceResponse).toHaveBeenCalled();
    });

    // Corner cases
    test("Should handle undefined status gracefully", async () => {
      // Arrange
      const mockInvoice = {
        id: '1',
        invoice_date: "2025-02-01",
        status: undefined
      };

      invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);
      invoiceService.itemRepository.findItemsByDocumentId.mockResolvedValue([]);

      // Act
      await invoiceService.getInvoiceById('1');

      // Assert - Should proceed with normal processing
      expect(invoiceService.invoiceRepository.findById).toHaveBeenCalledWith('1');
      expect(invoiceService.itemRepository.findItemsByDocumentId).toHaveBeenCalled();
      expect(invoiceService.responseFormatter.formatInvoiceResponse).toHaveBeenCalled();
    });

    test("Should handle null status gracefully", async () => {
      // Arrange
      const mockInvoice = {
        id: '1',
        invoice_date: "2025-02-01",
        status: null
      };

      invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);
      invoiceService.itemRepository.findItemsByDocumentId.mockResolvedValue([]);

      // Act
      await invoiceService.getInvoiceById('1');

      // Assert - Should proceed with normal processing
      expect(invoiceService.invoiceRepository.findById).toHaveBeenCalledWith('1');
      expect(invoiceService.itemRepository.findItemsByDocumentId).toHaveBeenCalled();
      expect(invoiceService.responseFormatter.formatInvoiceResponse).toHaveBeenCalled();
    });

    test("Should handle non-standard status values", async () => {
      // Arrange
      const mockInvoice = {
        id: '1',
        invoice_date: "2025-02-01",
        status: "INVALID_STATUS"  // Non-standard status
      };

      invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);
      invoiceService.itemRepository.findItemsByDocumentId.mockResolvedValue([]);

      // Act
      await invoiceService.getInvoiceById('1');

      // Assert - Should proceed with normal processing
      expect(invoiceService.invoiceRepository.findById).toHaveBeenCalledWith('1');
      expect(invoiceService.itemRepository.findItemsByDocumentId).toHaveBeenCalled();
      expect(invoiceService.responseFormatter.formatInvoiceResponse).toHaveBeenCalled();
    });

    test("Should handle case-insensitive status comparisons", async () => {
      // Arrange
      const mockInvoice = {
        id: '1',
        invoice_date: "2025-02-01",
        status: "processing"  // Lowercase version of PROCESSING
      };

      invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);
      invoiceService.itemRepository.findItemsByDocumentId.mockResolvedValue([]);

      // Act
      await invoiceService.getInvoiceById('1');

      // Assert - Should proceed with normal processing (not match PROCESSING)
      expect(invoiceService.invoiceRepository.findById).toHaveBeenCalledWith('1');
      expect(invoiceService.itemRepository.findItemsByDocumentId).toHaveBeenCalled();
      expect(invoiceService.responseFormatter.formatInvoiceResponse).toHaveBeenCalled();
    });
  });
});