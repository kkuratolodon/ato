const { InvoiceService } = require('../../../src/services/invoice/invoiceService');
const { NotFoundError } = require('../../../src/utils/errors');
const DocumentStatus = require('../../../src/models/enums/DocumentStatus');

describe('InvoiceService - getInvoiceById', () => {
  let invoiceService;
  let mockInvoiceRepository;
  let mockItemRepository;
  let mockCustomerRepository;
  let mockVendorRepository;
  let mockResponseFormatter;
  
  // Sample data for testing
  const sampleInvoice = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    status: DocumentStatus.ANALYZED,
    file_url: 'https://example.com/invoice.pdf',
    original_filename: 'invoice.pdf',
    partner_id: 'partner-123',
    customer_id: 'customer-123',
    vendor_id: 'vendor-123',
    invoice_number: 'INV-001',
    due_date: '2023-12-31',
    total_amount: 1000.00
  };
  
  const sampleItems = [
    { id: 'item-1', description: 'Item 1', quantity: 2, unit: 'pcs', unit_price: 100.00, amount: 200.00 },
    { id: 'item-2', description: 'Item 2', quantity: 4, unit: 'pcs', unit_price: 200.00, amount: 800.00 }
  ];
  
  const sampleCustomer = { id: 'customer-123', name: 'Customer Inc', tax_id: 'TAX-123', address: '123 Customer St' };
  const sampleVendor = { id: 'vendor-123', name: 'Vendor Inc', tax_id: 'TAX-456', address: '456 Vendor Ave' };
  
  const formattedResponse = {
    message: "Invoice retrieved successfully",
    data: {
      documents: [{
        id: '123e4567-e89b-12d3-a456-426614174000',
        invoice_number: 'INV-001',
        total_amount: 1000.00,
        items: sampleItems,
        customer: sampleCustomer,
        vendor: sampleVendor
      }]
    }
  };
  
  beforeEach(() => {
    // Create mock repositories
    mockInvoiceRepository = {
      findById: jest.fn()
    };
    
    mockItemRepository = {
      findItemsByDocumentId: jest.fn()
    };
    
    mockCustomerRepository = {
      findById: jest.fn()
    };
    
    mockVendorRepository = {
      findById: jest.fn()
    };
    
    mockResponseFormatter = {
      formatInvoiceResponse: jest.fn()
    };
    
    // Create invoice service with mocked dependencies
    invoiceService = new InvoiceService({
      invoiceRepository: mockInvoiceRepository,
      itemRepository: mockItemRepository,
      customerRepository: mockCustomerRepository,
      vendorRepository: mockVendorRepository,
      responseFormatter: mockResponseFormatter
    });
  });
  
  // Positive test cases
  
  test('should return formatted invoice data when invoice exists and is analyzed', (done) => {
    // Arrange
    mockInvoiceRepository.findById.mockResolvedValue(sampleInvoice);
    mockItemRepository.findItemsByDocumentId.mockResolvedValue(sampleItems);
    mockCustomerRepository.findById.mockResolvedValue(sampleCustomer);
    mockVendorRepository.findById.mockResolvedValue(sampleVendor);
    mockResponseFormatter.formatInvoiceResponse.mockReturnValue(formattedResponse);
    
    // Act
    invoiceService.getInvoiceById(sampleInvoice.id).subscribe({
      next: (result) => {
        // Assert
        expect(mockInvoiceRepository.findById).toHaveBeenCalledWith(sampleInvoice.id);
        expect(mockItemRepository.findItemsByDocumentId).toHaveBeenCalledWith(sampleInvoice.id, 'Invoice');
        expect(mockCustomerRepository.findById).toHaveBeenCalledWith(sampleInvoice.customer_id);
        expect(mockVendorRepository.findById).toHaveBeenCalledWith(sampleInvoice.vendor_id);
        expect(mockResponseFormatter.formatInvoiceResponse).toHaveBeenCalledWith(
          sampleInvoice, sampleItems, sampleCustomer, sampleVendor
        );
        expect(result).toEqual(formattedResponse);
        done();
      },
      error: (error) => {
        done.fail(`Should not have failed with: ${error}`);
      }
    });
  });
  
  test('should return formatted invoice data when invoice has no customer or vendor', (done) => {
    // Arrange
    const invoiceWithoutRelations = { ...sampleInvoice, customer_id: null, vendor_id: null };
    mockInvoiceRepository.findById.mockResolvedValue(invoiceWithoutRelations);
    mockItemRepository.findItemsByDocumentId.mockResolvedValue(sampleItems);
    mockResponseFormatter.formatInvoiceResponse.mockReturnValue({
      ...formattedResponse,
      data: { 
        documents: [{
          ...formattedResponse.data.documents[0],
          customer: null,
          vendor: null
        }]
      }
    });
    
    // Act
    invoiceService.getInvoiceById(sampleInvoice.id).subscribe({
      next: (result) => {
        // Assert
        expect(mockInvoiceRepository.findById).toHaveBeenCalledWith(sampleInvoice.id);
        expect(mockItemRepository.findItemsByDocumentId).toHaveBeenCalledWith(sampleInvoice.id, 'Invoice');
        expect(mockCustomerRepository.findById).not.toHaveBeenCalled();
        expect(mockVendorRepository.findById).not.toHaveBeenCalled();
        expect(mockResponseFormatter.formatInvoiceResponse).toHaveBeenCalledWith(
          invoiceWithoutRelations, sampleItems, null, null
        );
        expect(result.data.documents[0].customer).toBeNull();
        expect(result.data.documents[0].vendor).toBeNull();
        done();
      },
      error: (error) => {
        done.fail(`Should not have failed with: ${error}`);
      }
    });
  });
  
  // Negative test cases
  
  test('should throw NotFoundError when invoice does not exist', (done) => {
    // Arrange
    mockInvoiceRepository.findById.mockResolvedValue(null);
    
    // Act
    invoiceService.getInvoiceById('non-existent-id').subscribe({
      next: () => {
        done.fail('Should not have succeeded');
      },
      error: (error) => {
        // Assert
        expect(error).toBeInstanceOf(NotFoundError);
        expect(error.message).toBe('Invoice not found');
        done();
      }
    });
  });
  
  test('should return processing message when invoice status is PROCESSING', (done) => {
    // Arrange
    const processingInvoice = { ...sampleInvoice, status: DocumentStatus.PROCESSING };
    mockInvoiceRepository.findById.mockResolvedValue(processingInvoice);
    
    // Act
    invoiceService.getInvoiceById(processingInvoice.id).subscribe({
      next: (result) => {
        // Assert
        expect(result).toEqual({
          message: "Invoice is still being processed. Please try again later.",
          data: { documents: [] }
        });
        expect(mockItemRepository.findItemsByDocumentId).not.toHaveBeenCalled();
        done();
      },
      error: (error) => {
        done.fail(`Should not have failed with: ${error}`);
      }
    });
  });
  
  test('should return failed message when invoice status is FAILED', (done) => {
    // Arrange
    const failedInvoice = { ...sampleInvoice, status: DocumentStatus.FAILED };
    mockInvoiceRepository.findById.mockResolvedValue(failedInvoice);
    
    // Act
    invoiceService.getInvoiceById(failedInvoice.id).subscribe({
      next: (result) => {
        // Assert
        expect(result).toEqual({
          message: "Invoice processing failed. Please re-upload the document.",
          data: { documents: [] }
        });
        expect(mockItemRepository.findItemsByDocumentId).not.toHaveBeenCalled();
        done();
      },
      error: (error) => {
        done.fail(`Should not have failed with: ${error}`);
      }
    });
  });
  
  // Edge cases
  
  test('should handle errors from repository', (done) => {
    // Arrange
    const expectedError = new Error('Database connection error');
    mockInvoiceRepository.findById.mockRejectedValue(expectedError);
    
    // Act
    invoiceService.getInvoiceById(sampleInvoice.id).subscribe({
      next: () => {
        done.fail('Should not have succeeded');
      },
      error: (error) => {
        // Assert
        expect(error.message).toContain('Failed to retrieve invoice');
        expect(error.message).toContain(expectedError.message);
        done();
      }
    });
  });
  
  test('should handle when customer exists but vendor does not', (done) => {
    // Arrange
    mockInvoiceRepository.findById.mockResolvedValue(sampleInvoice);
    mockItemRepository.findItemsByDocumentId.mockResolvedValue(sampleItems);
    mockCustomerRepository.findById.mockResolvedValue(sampleCustomer);
    mockVendorRepository.findById.mockResolvedValue(null);
    
    const expectedResponse = {
      ...formattedResponse,
      data: {
        documents: [{
          ...formattedResponse.data.documents[0],
          vendor: null
        }]
      }
    };
    
    mockResponseFormatter.formatInvoiceResponse.mockReturnValue(expectedResponse);
    
    // Act
    invoiceService.getInvoiceById(sampleInvoice.id).subscribe({
      next: (result) => {
        // Assert
        expect(result.data.documents[0].customer).toEqual(sampleCustomer);
        expect(result.data.documents[0].vendor).toBeNull();
        done();
      },
      error: (error) => {
        done.fail(`Should not have failed with: ${error}`);
      }
    });
  });
  
  test('should handle when invoice has no items', (done) => {
    // Arrange
    mockInvoiceRepository.findById.mockResolvedValue(sampleInvoice);
    mockItemRepository.findItemsByDocumentId.mockResolvedValue([]);
    mockCustomerRepository.findById.mockResolvedValue(sampleCustomer);
    mockVendorRepository.findById.mockResolvedValue(sampleVendor);
    
    const expectedResponse = {
      ...formattedResponse,
      data: {
        documents: [{
          ...formattedResponse.data.documents[0],
          items: []
        }]
      }
    };
    
    mockResponseFormatter.formatInvoiceResponse.mockReturnValue(expectedResponse);
    
    // Act
    invoiceService.getInvoiceById(sampleInvoice.id).subscribe({
      next: (result) => {
        // Assert
        expect(result.data.documents[0].items).toEqual([]);
        done();
      },
      error: (error) => {
        done.fail(`Should not have failed with: ${error}`);
      }
    });
  });
});
