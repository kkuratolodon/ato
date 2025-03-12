const models = require('../../src/models');

const invoiceService = require('../../src/services/invoiceService');
const FinancialDocumentService = require('../../src/services/financialDocumentService');
const s3Service = require('../../src/services/s3Service');
const { Invoice, Vendor } = require('../../src/models')
const fs = require("fs");
const path = require("path");
const { DocumentAnalysisClient } = require("@azure/ai-form-recognizer");

jest.mock("@azure/ai-form-recognizer");

jest.mock('../../src/services/s3Service', () => ({
  uploadFile: jest.fn()
}));

jest.mock('../../src/models', () => {
  // Create shared mock objects
  const mockInvoice = {
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  };

  const mockCustomer = {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn()
  };

  const mockVendor = {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn()
  };

  return {
    Invoice: mockInvoice,
    Customer: mockCustomer,
    Vendor: mockVendor
  };
});


describe('uploadInvoice', () => {
  const TEST_FILE_PATH = path.join(__dirname, '..', 'controllers', 'test-files', 'test-invoice.pdf');
  const TEST_FILE = { buffer: fs.readFileSync(TEST_FILE_PATH) };
  const TEST_S3_URL = 'https://s3.amazonaws.com/test-bucket/test-file.pdf';

  let mockParams, mockPartnerId, mockClient;
  let originalAnalyzeInvoice;

  beforeEach(() => {
    // Simpan original method sebelum di-mock
    originalAnalyzeInvoice = invoiceService.analyzeInvoice;

    mockPartnerId = '123';
    mockParams = {
      buffer: TEST_FILE.buffer,
      partnerId: mockPartnerId,
      originalname: 'test-invoice.pdf'
    };
    jest.clearAllMocks();

    mockClient = {
      beginAnalyzeDocument: jest.fn().mockResolvedValue({
        pollUntilDone: jest.fn().mockResolvedValue(null),
      }),
    };

    // Tambahkan mock untuk azureMapper
    invoiceService.azureMapper = {
      mapToInvoiceModel: jest.fn().mockReturnValue({
        invoiceData: {
          invoice_number: 'INV-001',
          invoice_date: '2023-01-01',
          due_date: '2023-02-01',
          total_amount: 1000,
          status: 'Analyzed'
        },
        customerData: {} // Include empty customer data
      })
    };

    // Mock untuk analyzeInvoice
    invoiceService.analyzeInvoice = jest.fn().mockResolvedValue({
      data: {
        invoices: [
          {
            invoiceId: 'INV-001',
            invoiceDate: '2023-01-01',
            dueDate: '2023-02-01',
            totalAmount: 1000
          }
        ]
      },
      message: "PDF processed successfully"
    });
    DocumentAnalysisClient.mockImplementation(() => mockClient);
  });

  afterEach(() => {
    invoiceService.analyzeInvoice = originalAnalyzeInvoice;
    jest.restoreAllMocks();
  });

  test('should return invoice object when upload is successful', async () => {
    jest.spyOn(FinancialDocumentService.prototype, 'uploadFile').mockResolvedValue({
      partner_id: mockPartnerId,
      file_url: TEST_S3_URL
    });

    const mockInvoiceData = {
      id: 1,
      partner_id: mockPartnerId,
      file_url: TEST_S3_URL,
      status: "Processing",
      invoice_number: 'INV-001',
      invoice_date: '2023-01-01',
      due_date: '2023-02-01',
      total_amount: 1000,
      created_at: new Date()
    };

    // Tambahkan mock untuk Invoice.create
    Invoice.create.mockResolvedValue(mockInvoiceData);

    // Tambahkan mock untuk Invoice.update jika digunakan
    Invoice.update.mockResolvedValue([1]);

    const result = await invoiceService.uploadInvoice(mockParams);
    expect(FinancialDocumentService.prototype.uploadFile).toHaveBeenCalledWith(mockParams);
    expect(Invoice.create).toHaveBeenCalledWith({
      partner_id: mockPartnerId,
      file_url: TEST_S3_URL,
      status: "Processing"
    });
    expect(result).toHaveProperty('message', 'Invoice successfully processed and saved');
  });

  test('should raise error when S3 upload fails', async () => {
    s3Service.uploadFile.mockRejectedValue(new Error('Failed to upload file to S3'));

    await expect(invoiceService.uploadInvoice(mockParams)).rejects.toThrow('Failed to upload file to S3');
  });
  test('should throw error when partnerId is missing', async () => {
    const fileData = {
      buffer: Buffer.from('test')
    };

    await expect(invoiceService.uploadFile(fileData)).rejects.toThrow('Partner ID is required');
  });
  test('should raise error when saving to database fails', async () => {
    s3Service.uploadFile.mockResolvedValue(TEST_S3_URL);
    Invoice.create.mockRejectedValue(new Error('Failed to save invoice to database'));

    await expect(invoiceService.uploadInvoice(mockParams)).rejects.toThrow('Failed to save invoice to database');
  });
});

describe('uploadInvoice - Corner Cases', () => {
  let originalAnalyzeInvoice;

  beforeEach(() => {
    originalAnalyzeInvoice = invoiceService.analyzeInvoice;
    jest.clearAllMocks();
  });

  afterEach(() => {
    invoiceService.analyzeInvoice = originalAnalyzeInvoice;
    jest.restoreAllMocks();
  });

  test('should throw error when partnerId is missing', async () => {
    const mockParams = {
      buffer: Buffer.from('test'),
      originalname: 'test.pdf'
      // partnerId intentionally missing
    };

    await expect(invoiceService.uploadInvoice(mockParams)).rejects.toThrow('Partner ID is required');
  });

  test('should throw error when s3 upload returns null url', async () => {
    const mockParams = {
      buffer: Buffer.from('test'),
      originalname: 'test.pdf',
      partnerId: '123'
    };

    s3Service.uploadFile.mockResolvedValue(null);

    await expect(invoiceService.uploadInvoice(mockParams)).rejects.toThrow('Failed to upload file to S3');
  });

  test("Should handle case where vendor_id exists but vendor isn't found", async () => {
    const mockInvoiceData = {
      id: 1,
      invoice_date: "2025-02-01",
      vendor_id: "missing-vendor-uuid",
      status: "Analyzed",
    };

    const mockInvoice = {
      ...mockInvoiceData,
      get: jest.fn().mockReturnValue(mockInvoiceData)
    };

    Invoice.findByPk.mockResolvedValue(mockInvoice);
    Vendor.findByPk.mockResolvedValue(null);

    const result = await invoiceService.getInvoiceById(1);

    // Updated expectations for the new format
    expect(result).toHaveProperty('header');
    expect(result).toHaveProperty('items');
    expect(result.header.invoice_details.invoice_date).toEqual("2025-02-01");
    expect(result.header.vendor_details).toEqual({
      name: null,
      address: {},
      recipient_name: null,
      tax_id: null
    });
    expect(Vendor.findByPk).toHaveBeenCalledWith("missing-vendor-uuid");
  });

  test('should throw error when analyzeInvoice returns no data', async () => {
    const mockParams = {
      buffer: Buffer.from('test'),
      originalname: 'test.pdf',
      partnerId: '123'
    };

    s3Service.uploadFile.mockResolvedValue('https://s3.amazonaws.com/test-bucket/test-file.pdf');

    const mockInvoiceData = {
      id: 1,
      partner_id: '123',
      file_url: 'https://s3.amazonaws.com/test-bucket/test-file.pdf',
      status: "Processing"
    };

    Invoice.create.mockResolvedValue(mockInvoiceData);

    // Mock analyzeInvoice to return a response without data
    invoiceService.analyzeInvoice = jest.fn().mockResolvedValue({
      message: "PDF processed successfully"
      // No data property
    });

    await expect(invoiceService.uploadInvoice(mockParams))
      .rejects.toThrow('Failed to process invoice: Failed to analyze invoice: No data returned');

    expect(Invoice.update).toHaveBeenCalledWith(
      { status: "Failed" },
      { where: { id: 1 } }
    );
  });
  test('should handle errors when invoice is null during error handling', async () => {
    // Create a scenario where invoice is null when an error occurs
    const mockParams = {
      buffer: Buffer.from('test'),
      originalname: 'test.pdf',
      partnerId: '123'
    };

    Invoice.create.mockRejectedValue(new Error('Database connection error'));

    s3Service.uploadFile.mockResolvedValue('https://example.com/test.pdf');

    await expect(invoiceService.uploadInvoice(mockParams))
      .rejects.toThrow('Failed to process invoice: Database connection error');

    expect(Invoice.update).not.toHaveBeenCalled();
  });
});

describe("getInvoiceById", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Should return an invoice when given a valid ID", async () => {
    const mockInvoiceData = {
      id: 1,
      invoice_id: "INV-001",
      invoice_date: "2025-02-01",
      due_date: "2025-03-01",
      purchase_order_id: 1,
      total_amount: 500.00,
      subtotal_amount: 450.00,
      discount_amount: 50.00,
      payment_terms: "Net 30",
      file_url: 'https://example.com/invoice.pdf',
      status: "Analyzed",
      currency_symbol: "$",
      currency_code: "USD"
    };

    // Create a mock Sequelize model instance with a get method
    const mockInvoice = {
      ...mockInvoiceData,
      get: jest.fn().mockReturnValue(mockInvoiceData)
    };

    Invoice.findByPk.mockResolvedValue(mockInvoice);

    const result = await invoiceService.getInvoiceById(1);

    // Update expectations to match the new format
    expect(result).toHaveProperty('header');
    expect(result).toHaveProperty('items');
    expect(result.header.invoice_details).toEqual({
      invoice_id: "INV-001",
      purchase_order_id: 1,
      invoice_date: "2025-02-01",
      due_date: "2025-03-01",
      payment_terms: "Net 30"
    });
    expect(result.header.financial_details).toEqual({
      currency: {
        "currency_code": "USD",
        "currency_symbol": "$",
      },
      total_amount: 500.00,
      subtotal_amount: 450.00,
      discount_amount: 50.00,
      total_tax_amount: null
    });
  });
  test("Should throw an error when invoice is not found", async () => {
    Invoice.findByPk.mockResolvedValue(null);

    await expect(invoiceService.getInvoiceById(99999999)).rejects.toThrow("Invoice not found");
  });

  test("Should throw an error when database fails", async () => {
    Invoice.findByPk.mockRejectedValue(new Error("Database error"));

    await expect(invoiceService.getInvoiceById(1)).rejects.toThrow("Database error");
  });
  // Add these tests to the "getInvoiceById" describe block

  test("Should handle case where customer_id exists but customer isn't found", async () => {
    const mockInvoiceData = {
      id: 1,
      invoice_date: "2025-02-01",
      customer_id: "missing-customer-uuid",
      status: "Analyzed",
    };

    const mockInvoice = {
      ...mockInvoiceData,
      get: jest.fn().mockReturnValue(mockInvoiceData)
    };

    models.Invoice.findByPk.mockResolvedValue(mockInvoice);
    models.Customer.findByPk.mockResolvedValue(null);

    const result = await invoiceService.getInvoiceById(1);

    // Updated expectations for the new format
    expect(result).toHaveProperty('header');
    expect(result).toHaveProperty('items');
    expect(result.header.invoice_details.invoice_date).toEqual("2025-02-01");
    expect(result.header.customer_details).toEqual({
      id: null,
      name: null,
      recipient_name: null,
      address: {},
      tax_id: null
    });
    expect(models.Customer.findByPk).toHaveBeenCalledWith("missing-customer-uuid");
  });

  test("Should handle case where customer_id exists but customer isn't found", async () => {
    const mockInvoiceData = {
      id: 1,
      invoice_date: "2025-02-01",
      customer_id: "missing-customer-uuid",
      status: "Analyzed",
    };

    const mockInvoice = {
      ...mockInvoiceData,
      get: jest.fn().mockReturnValue(mockInvoiceData)
    };

    models.Invoice.findByPk.mockResolvedValue(mockInvoice);
    models.Customer.findByPk.mockResolvedValue(null);

    const result = await invoiceService.getInvoiceById(1);

    // Updated expectations for the new format
    expect(result).toHaveProperty('header');
    expect(result).toHaveProperty('items');
    expect(result.header.invoice_details.invoice_date).toEqual("2025-02-01");
    expect(result.header.customer_details).toEqual({
      id: null,
      name: null,
      recipient_name: null,
      address: {},
      tax_id: null
    });
    expect(models.Customer.findByPk).toHaveBeenCalledWith("missing-customer-uuid");
  });

  test("Should include customer data when customer exists", async () => {
    const mockInvoiceData = {
      id: 1,
      invoice_date: "2025-02-01",
      customer_id: "existing-customer-uuid",
      status: "Analyzed",
    };

    const mockCustomerData = {
      uuid: "existing-customer-uuid",
      name: "Existing Customer",
      street_address: "123 Test St"
    };

    const mockInvoice = {
      ...mockInvoiceData,
      get: jest.fn().mockReturnValue(mockInvoiceData)
    };

    const mockCustomer = {
      ...mockCustomerData,
      get: jest.fn().mockReturnValue(mockCustomerData)
    };

    models.Invoice.findByPk.mockResolvedValue(mockInvoice);
    models.Customer.findByPk.mockResolvedValue(mockCustomer);

    const result = await invoiceService.getInvoiceById(1);

    // Updated expectations for the new format
    expect(result).toHaveProperty('header');
    expect(result.header).toHaveProperty('customer_details');
    expect(result.header.customer_details).toHaveProperty('name', 'Existing Customer');
    expect(result.header.customer_details).toHaveProperty('id', 'existing-customer-uuid');
    expect(result.header.customer_details.address).toHaveProperty('street_address', '123 Test St');
    expect(mockCustomer.get).toHaveBeenCalledWith({ plain: true });
  });

  test("Should include vendor data when vendor exists", async () => {
    const mockInvoiceData = {
      id: 1,
      invoice_date: "2025-02-01",
      vendor_id: "existing-vendor-uuid",
      status: "Analyzed",
    };

    const mockVendorData = {
      uuid: "existing-vendor-uuid",
      name: "Existing Vendor",
      street_address: "456 Vendor St"
    };

    const mockInvoice = {
      ...mockInvoiceData,
      get: jest.fn().mockReturnValue(mockInvoiceData)
    };

    const mockVendor = {
      ...mockVendorData,
      get: jest.fn().mockReturnValue(mockVendorData)
    };

    models.Invoice.findByPk.mockResolvedValue(mockInvoice);
    models.Vendor.findByPk.mockResolvedValue(mockVendor);

    const result = await invoiceService.getInvoiceById(1);

    // Updated expectations for the new format
    expect(result).toHaveProperty('header');
    expect(result.header).toHaveProperty('vendor_details');
    expect(result.header.vendor_details).toHaveProperty('name', 'Existing Vendor');
    expect(result.header.vendor_details.address).toHaveProperty('street_address', '456 Vendor St');
    expect(mockVendor.get).toHaveBeenCalledWith({ plain: true });
  });
});

describe("Invoice Analysis Service", () => {
  const documentUrl = "https://slicedinvoices.com/pdf/wordpress-pdf-invoice-plugin-sample.pdf";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Positive Cases", () => {
    test("should successfully process a valid PDF", async () => {
      const mockClient = {
        beginAnalyzeDocument: jest.fn().mockResolvedValue({
          pollUntilDone: jest.fn().mockResolvedValue({ success: true }),
        }),
      };

      DocumentAnalysisClient.mockImplementation(() => mockClient);

      const result = await invoiceService.analyzeInvoice(documentUrl);
      expect(result).toEqual({
        message: "PDF processed successfully",
        data: { success: true },
      });
    });
    test("should successfully process a PDF from buffer data", async () => {
      const pdfBuffer = Buffer.from("test PDF data");

      const mockClient = {
        beginAnalyzeDocument: jest.fn().mockResolvedValue({
          pollUntilDone: jest.fn().mockResolvedValue({ success: true }),
        }),
      };

      DocumentAnalysisClient.mockImplementation(() => mockClient);

      const result = await invoiceService.analyzeInvoice(pdfBuffer);

      expect(mockClient.beginAnalyzeDocument).toHaveBeenCalledWith(
        process.env.AZURE_INVOICE_MODEL,
        pdfBuffer
      );
      expect(result).toEqual({
        message: "PDF processed successfully",
        data: { success: true },
      });
    });
  });

  describe("Negative Cases", () => {
    test("should throw an error if documentUrl is missing", async () => {
      await expect(invoiceService.analyzeInvoice()).rejects.toThrow("documentUrl is required");
    });

    test("should throw 'Service is temporarily unavailable' if API returns 503", async () => {
      const mockError = new Error("Service Unavailable");
      mockError.statusCode = 503;

      const mockClient = {
        beginAnalyzeDocument: jest.fn().mockRejectedValue(mockError),
      };

      DocumentAnalysisClient.mockImplementation(() => mockClient);

      await expect(invoiceService.analyzeInvoice(documentUrl)).rejects.toThrow(
        "Service is temporarily unavailable. Please try again later."
      );
    });

    test("should throw 'Conflict error occurred' if API returns 409", async () => {
      const mockError = new Error("Conflict Error");
      mockError.statusCode = 409;

      const mockClient = {
        beginAnalyzeDocument: jest.fn().mockRejectedValue(mockError),
      };

      DocumentAnalysisClient.mockImplementation(() => mockClient);

      await expect(invoiceService.analyzeInvoice(documentUrl)).rejects.toThrow(
        "Conflict error occurred. Please check the document and try again."
      );
    });

    test("should throw 'Failed to process the document' for any other API error", async () => {
      const mockError = new Error("Unknown Error");
      mockError.statusCode = 500;

      const mockClient = {
        beginAnalyzeDocument: jest.fn().mockRejectedValue(mockError),
      };

      DocumentAnalysisClient.mockImplementation(() => mockClient);

      await expect(invoiceService.analyzeInvoice(documentUrl)).rejects.toThrow(
        "Failed to process the document"
      );
    });
  });

  describe("Corner Cases", () => {
    test("should handle empty response from API gracefully", async () => {
      const mockClient = {
        beginAnalyzeDocument: jest.fn().mockResolvedValue({
          pollUntilDone: jest.fn().mockResolvedValue(null),
        }),
      };

      DocumentAnalysisClient.mockImplementation(() => mockClient);

      const result = await invoiceService.analyzeInvoice(documentUrl);
      expect(result).toEqual({
        message: "PDF processed successfully",
        data: null,
      });
    });

    test("should handle API response with missing fields", async () => {
      const mockClient = {
        beginAnalyzeDocument: jest.fn().mockResolvedValue({
          pollUntilDone: jest.fn().mockResolvedValue({}),
        }),
      };

      DocumentAnalysisClient.mockImplementation(() => mockClient);

      const result = await invoiceService.analyzeInvoice(documentUrl);
      expect(result).toEqual({
        message: "PDF processed successfully",
        data: {},
      });
    });
    test('should throw error for invalid document source type', async () => {
      const invalidInput = { notValid: true };

      await expect(invoiceService.analyzeInvoice(invalidInput)).rejects.toThrow('Invalid document source type');
    });

    test('should throw error for invalid date format', async () => {
      const mockError = new Error('Invalid date format');

      const mockClient = {
        beginAnalyzeDocument: jest.fn().mockRejectedValue(mockError),
      };

      DocumentAnalysisClient.mockImplementation(() => mockClient);

      await expect(invoiceService.analyzeInvoice('test-url')).rejects.toThrow('Invoice contains invalid date format');
    });
  });

});

describe('uploadInvoice - Customer Data Handling', () => {
  let originalAnalyzeInvoice;
  const models = require('../../src/models');

  beforeEach(() => {
    originalAnalyzeInvoice = invoiceService.analyzeInvoice;
    jest.clearAllMocks();
  });

  afterEach(() => {
    invoiceService.analyzeInvoice = originalAnalyzeInvoice;
    jest.restoreAllMocks();
  });

  test('should create new customer when customer data is provided but not found', async () => {
    const mockParams = {
      buffer: Buffer.from('test'),
      originalname: 'test.pdf',
      partnerId: '123'
    };

    s3Service.uploadFile.mockResolvedValue('https://example.com/test.pdf');

    const mockInvoice = {
      id: 1,
      status: 'Processing'
    };
    models.Invoice.create.mockResolvedValue(mockInvoice);

    // Mock customer not found, then creation
    models.Customer.findOne.mockResolvedValue(null);
    models.Customer.create.mockResolvedValue({
      uuid: 'cust-123',
      name: 'Test Customer'
    });

    // Mock analyzeInvoice to return valid data
    invoiceService.analyzeInvoice = jest.fn().mockResolvedValue({
      data: { someField: 'value' },
      message: "PDF processed successfully"
    });

    // Mock azureMapper to return customer data
    invoiceService.azureMapper = {
      mapToInvoiceModel: jest.fn().mockReturnValue({
        invoiceData: {
          invoice_number: 'INV-001',
          invoice_date: '2023-01-01',
          due_date: '2023-02-01',
          total_amount: 1000
        },
        customerData: {
          name: 'Test Customer',
          street_address: '123 Main St',
          city: 'Test City',
          state: 'TS',
          postal_code: '12345',
          tax_id: 'TAX123',
          recipient_name: 'John Doe'
        }
      })
    };

    await invoiceService.uploadInvoice(mockParams);

    expect(models.Customer.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        name: 'Test Customer'
      })
    }));

    expect(models.Customer.create).toHaveBeenCalledWith({
      name: 'Test Customer',
      street_address: '123 Main St',
      city: 'Test City',
      state: 'TS',
      postal_code: '12345',
      house: undefined,
      tax_id: 'TAX123',
      recipient_name: 'John Doe'
    });

    expect(models.Invoice.update).toHaveBeenCalledWith(
      { customer_id: 'cust-123' },
      { where: { id: 1 } }
    );
  });

  test('should use existing customer when customer data matches existing record', async () => {
    const mockParams = {
      buffer: Buffer.from('test'),
      originalname: 'test.pdf',
      partnerId: '123'
    };

    s3Service.uploadFile.mockResolvedValue('https://example.com/test.pdf');

    const mockInvoice = {
      id: 1,
      status: 'Processing'
    };
    models.Invoice.create.mockResolvedValue(mockInvoice);

    // Mock existing customer found
    const existingCustomer = {
      uuid: 'existing-123',
      name: 'Existing Customer'
    };
    models.Customer.findOne.mockResolvedValue(existingCustomer);

    // Mock analyzeInvoice to return valid data
    invoiceService.analyzeInvoice = jest.fn().mockResolvedValue({
      data: { someField: 'value' },
      message: "PDF processed successfully"
    });

    // Mock azureMapper to return customer data
    invoiceService.azureMapper = {
      mapToInvoiceModel: jest.fn().mockReturnValue({
        invoiceData: {
          invoice_number: 'INV-001',
          invoice_date: '2023-01-01',
          due_date: '2023-02-01',
          total_amount: 1000
        },
        customerData: {
          name: 'Existing Customer',
          tax_id: 'TAX123',
          postal_code: '12345'
        }
      })
    };

    await invoiceService.uploadInvoice(mockParams);

    expect(models.Customer.findOne).toHaveBeenCalled();
    expect(models.Customer.create).not.toHaveBeenCalled();

    expect(models.Invoice.update).toHaveBeenCalledWith(
      { customer_id: 'existing-123' },
      { where: { id: 1 } }
    );
  });

  test('should proceed without customer data when azureMapper returns no customerData', async () => {
    const mockParams = {
      buffer: Buffer.from('test'),
      originalname: 'test.pdf',
      partnerId: '123'
    };

    s3Service.uploadFile.mockResolvedValue('https://example.com/test.pdf');

    const mockInvoice = {
      id: 1,
      status: 'Processing'
    };
    models.Invoice.create.mockResolvedValue(mockInvoice);

    // Mock analyzeInvoice to return valid data
    invoiceService.analyzeInvoice = jest.fn().mockResolvedValue({
      data: { someField: 'value' },
      message: "PDF processed successfully"
    });

    // Mock azureMapper to return NO customer data
    invoiceService.azureMapper = {
      mapToInvoiceModel: jest.fn().mockReturnValue({
        invoiceData: {
          invoice_number: 'INV-001',
          invoice_date: '2023-01-01',
          due_date: '2023-02-01',
          total_amount: 1000
        }
        // No customerData key
      })
    };

    await invoiceService.uploadInvoice(mockParams);

    expect(models.Customer.findOne).not.toHaveBeenCalled();
    expect(models.Customer.create).not.toHaveBeenCalled();

    // Should still update the invoice with "Analyzed" status
    expect(models.Invoice.update).toHaveBeenCalledWith(
      { status: "Analyzed" },
      { where: { id: 1 } }
    );
  });

  test('should handle customer data without name property', async () => {
    const mockParams = {
      buffer: Buffer.from('test'),
      originalname: 'test.pdf',
      partnerId: '123'
    };

    s3Service.uploadFile.mockResolvedValue('https://example.com/test.pdf');

    const mockInvoice = {
      id: 1,
      status: 'Processing'
    };
    models.Invoice.create.mockResolvedValue(mockInvoice);

    // Mock analyzeInvoice to return valid data
    invoiceService.analyzeInvoice = jest.fn().mockResolvedValue({
      data: { someField: 'value' },
      message: "PDF processed successfully"
    });

    // Mock azureMapper to return incomplete customer data
    invoiceService.azureMapper = {
      mapToInvoiceModel: jest.fn().mockReturnValue({
        invoiceData: {
          invoice_number: 'INV-001',
          invoice_date: '2023-01-01',
          due_date: '2023-02-01',
          total_amount: 1000
        },
        customerData: {
          // No name property
          address: '123 Main St'
        }
      })
    };

    await invoiceService.uploadInvoice(mockParams);

    expect(models.Customer.findOne).not.toHaveBeenCalled();
    expect(models.Customer.create).not.toHaveBeenCalled();

    // Should still update the invoice with "Analyzed" status
    expect(models.Invoice.update).toHaveBeenCalledWith(
      { status: "Analyzed" },
      { where: { id: 1 } }
    );
  });
});

describe('uploadInvoice - Vendor Data Handling', () => {
  let originalAnalyzeInvoice;
  const models = require('../../src/models');

  beforeEach(() => {
    originalAnalyzeInvoice = invoiceService.analyzeInvoice;
    jest.clearAllMocks();
  });

  afterEach(() => {
    invoiceService.analyzeInvoice = originalAnalyzeInvoice;
    jest.restoreAllMocks();
  });

  test('should create new vendor when vendor data is provided but not found', async () => {
    const mockParams = {
      buffer: Buffer.from('test'),
      originalname: 'test.pdf',
      partnerId: '123'
    };

    s3Service.uploadFile.mockResolvedValue('https://example.com/test.pdf');

    const mockInvoice = {
      id: 1,
      status: 'Processing'
    };
    models.Invoice.create.mockResolvedValue(mockInvoice);

    // Mock vendor not found, then creation
    models.Vendor.findOne.mockResolvedValue(null);
    models.Vendor.create.mockResolvedValue({
      uuid: 'vendor-123',
      name: 'Test Vendor'
    });

    // Mock analyzeInvoice to return valid data
    invoiceService.analyzeInvoice = jest.fn().mockResolvedValue({
      data: { someField: 'value' },
      message: "PDF processed successfully"
    });

    // Mock azureMapper to return vendor data
    invoiceService.azureMapper = {
      mapToInvoiceModel: jest.fn().mockReturnValue({
        invoiceData: {
          invoice_number: 'INV-001',
          invoice_date: '2023-01-01',
          due_date: '2023-02-01',
          total_amount: 1000
        },
        vendorData: {
          name: 'Test Vendor',
          street_address: '123 Vendor St',
          city: 'Vendor City',
          state: 'VS',
          postal_code: '54321',
          tax_id: 'TAX456',
          recipient_name: 'Jane Doe'
        }
      })
    };

    await invoiceService.uploadInvoice(mockParams);

    expect(models.Vendor.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        name: 'Test Vendor'
      })
    }));

    expect(models.Vendor.create).toHaveBeenCalledWith({
      name: 'Test Vendor',
      street_address: '123 Vendor St',
      city: 'Vendor City',
      state: 'VS',
      postal_code: '54321',
      house: undefined,
      tax_id: 'TAX456',
      recipient_name: 'Jane Doe'
    });

    expect(models.Invoice.update).toHaveBeenCalledWith(
      { vendor_id: 'vendor-123' },
      { where: { id: 1 } }
    );
  });

  test('should use existing vendor when vendor data matches existing record', async () => {
    const mockParams = {
      buffer: Buffer.from('test'),
      originalname: 'test.pdf',
      partnerId: '123'
    };

    s3Service.uploadFile.mockResolvedValue('https://example.com/test.pdf');

    const mockInvoice = {
      id: 1,
      status: 'Processing'
    };
    models.Invoice.create.mockResolvedValue(mockInvoice);

    // Mock existing vendor found
    const existingVendor = {
      uuid: 'existing-vendor-123',
      name: 'Existing Vendor'
    };
    models.Vendor.findOne.mockResolvedValue(existingVendor);

    // Mock analyzeInvoice to return valid data
    invoiceService.analyzeInvoice = jest.fn().mockResolvedValue({
      data: { someField: 'value' },
      message: "PDF processed successfully"
    });

    // Mock azureMapper to return vendor data
    invoiceService.azureMapper = {
      mapToInvoiceModel: jest.fn().mockReturnValue({
        invoiceData: {
          invoice_number: 'INV-001',
          invoice_date: '2023-01-01',
          due_date: '2023-02-01',
          total_amount: 1000
        },
        vendorData: {
          name: 'Existing Vendor',
          tax_id: 'TAX456',
          postal_code: '54321'
        }
      })
    };

    await invoiceService.uploadInvoice(mockParams);

    expect(models.Vendor.findOne).toHaveBeenCalled();
    expect(models.Vendor.create).not.toHaveBeenCalled();

    expect(models.Invoice.update).toHaveBeenCalledWith(
      { vendor_id: 'existing-vendor-123' },
      { where: { id: 1 } }
    );
  });
});
describe('validateFileData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should not throw error when valid file data is provided', () => {
    const fileData = {
      buffer: Buffer.from('test'),
      originalname: 'test.pdf',
      partnerId: '123'
    };

    expect(() => invoiceService.validateFileData(fileData)).not.toThrow();
  });

  test('should throw error when fileData is null', () => {
    expect(() => invoiceService.validateFileData(null)).toThrow('File not found');
  });

  test('should throw error when fileData is undefined', () => {
    expect(() => invoiceService.validateFileData(undefined)).toThrow('File not found');
  });

  test('should throw error when partnerId is missing', () => {
    const fileData = {
      buffer: Buffer.from('test'),
      originalname: 'test.pdf'
      // partnerId is missing
    };

    expect(() => invoiceService.validateFileData(fileData)).toThrow('Partner ID is required');
  });

  test('should throw error when partnerId is null', () => {
    const fileData = {
      buffer: Buffer.from('test'),
      originalname: 'test.pdf',
      partnerId: null
    };

    expect(() => invoiceService.validateFileData(fileData)).toThrow('Partner ID is required');
  });

  test('should throw error when partnerId is empty string', () => {
    const fileData = {
      buffer: Buffer.from('test'),
      originalname: 'test.pdf',
      partnerId: ''
    };

    expect(() => invoiceService.validateFileData(fileData)).toThrow('Partner ID is required');
  });
});