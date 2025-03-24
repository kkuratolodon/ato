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
jest.mock('../../../src/services/invoiceMapperService');

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
      status: "Analyzed"
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
      status: "Analyzed"
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
      status: "Analyzed"
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
      status: "Analyzed"
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
      status: "Analyzed"
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
      status: "Analyzed"
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
      status: "Analyzed"
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
      status: "Analyzed"
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
});