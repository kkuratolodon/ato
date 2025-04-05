// Mock repositories instead of direct models
jest.mock('../../../src/repositories/customerRepository', () => {
  return jest.fn().mockImplementation(() => ({
    findByAttributes: jest.fn(),
    create: jest.fn()
  }));
});

jest.mock('../../../src/repositories/vendorRepository', () => {
  return jest.fn().mockImplementation(() => ({
    findByAttributes: jest.fn(),
    create: jest.fn()
  }));
});

jest.mock('../../../src/repositories/invoiceRepository', () => {
  return jest.fn().mockImplementation(() => ({
    updateCustomerId: jest.fn(),
    updateVendorId: jest.fn()
  }));
});

// Mock other repositories and dependencies
jest.mock('../../../src/repositories/itemRepository');
jest.mock('../../../src/services/analysis/azureDocumentAnalyzer');
jest.mock('../../../src/services/invoice/invoiceValidator');
jest.mock('../../../src/services/invoice/invoiceResponseFormatter');
jest.mock('../../../src/services/invoiceMapperService/invoiceMapperService');

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

// Now require the service
const invoiceService = require('../../../src/services/invoice/invoiceService');

describe('updateCustomerAndVendorData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle case when customer already exists', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const customerData = {
      name: 'Existing Customer',
      tax_id: '123456',
      address: '123 Test St'
    };
    
    const mockCustomer = {
      uuid: 'customer-uuid-123',
      name: customerData.name
    };
    
    invoiceService.customerRepository.findByAttributes.mockResolvedValue(mockCustomer);
    
    // Act
    await invoiceService.updateCustomerAndVendorData(invoiceId, customerData, null);
    
    // Assert
    expect(invoiceService.customerRepository.findByAttributes).toHaveBeenCalledWith({
      name: customerData.name,
      tax_id: customerData.tax_id,
      address: customerData.address
    });
    expect(invoiceService.customerRepository.create).not.toHaveBeenCalled();
    expect(invoiceService.invoiceRepository.updateCustomerId).toHaveBeenCalledWith(
      invoiceId,
      mockCustomer.uuid
    );
  });

  test('should handle case when customer does not exist and needs to be created', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const customerData = {
      name: 'New Customer',
      tax_id: '7890',
      street_address: '456 New St'
    };
    
    invoiceService.customerRepository.findByAttributes.mockResolvedValue(null);
    const mockCreatedCustomer = {
      uuid: 'new-customer-uuid-456',
      name: customerData.name
    };
    invoiceService.customerRepository.create.mockResolvedValue(mockCreatedCustomer);
    
    // Act
    await invoiceService.updateCustomerAndVendorData(invoiceId, customerData, null);
    
    // Assert
    expect(invoiceService.customerRepository.findByAttributes).toHaveBeenCalled();
    expect(invoiceService.customerRepository.create).toHaveBeenCalledWith(customerData);
    expect(invoiceService.invoiceRepository.updateCustomerId).toHaveBeenCalledWith(
      invoiceId,
      mockCreatedCustomer.uuid
    );
  });

  test('should handle case when vendor already exists', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const vendorData = {
      name: 'Existing Vendor',
      tax_id: 'V12345'
    };
    
    const mockVendor = {
      uuid: 'vendor-uuid-789',
      name: vendorData.name
    };
    
    invoiceService.vendorRepository.findByAttributes.mockResolvedValue(mockVendor);
    
    // Act
    await invoiceService.updateCustomerAndVendorData(invoiceId, null, vendorData);
    
    // Assert
    expect(invoiceService.vendorRepository.findByAttributes).toHaveBeenCalledWith({
      name: vendorData.name,
      tax_id: vendorData.tax_id
    });
    expect(invoiceService.vendorRepository.create).not.toHaveBeenCalled();
    expect(invoiceService.invoiceRepository.updateVendorId).toHaveBeenCalledWith(
      invoiceId,
      mockVendor.uuid
    );
  });

  test('should handle case when vendor does not exist and needs to be created', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const vendorData = {
      name: 'New Vendor',
      postal_code: '20001',
      street_address: '123 Test St'
    };
    
    invoiceService.vendorRepository.findByAttributes.mockResolvedValue(null);
    const mockCreatedVendor = {
      uuid: 'new-vendor-uuid-101',
      name: vendorData.name
    };
    invoiceService.vendorRepository.create.mockResolvedValue(mockCreatedVendor);
    
    // Act
    await invoiceService.updateCustomerAndVendorData(invoiceId, null, vendorData);
    
    // Assert
    expect(invoiceService.vendorRepository.findByAttributes).toHaveBeenCalled();
    expect(invoiceService.vendorRepository.create).toHaveBeenCalledWith(vendorData);
    expect(invoiceService.invoiceRepository.updateVendorId).toHaveBeenCalledWith(
      invoiceId,
      mockCreatedVendor.uuid
    );
  });

  test('should handle case when both customer and vendor data are provided', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const customerData = { name: 'Test Customer' };
    const vendorData = { name: 'Test Vendor' };
    
    const mockCustomer = { uuid: 'customer-uuid-123' };
    const mockVendor = { uuid: 'vendor-uuid-456' };
    
    invoiceService.customerRepository.findByAttributes.mockResolvedValue(mockCustomer);
    invoiceService.vendorRepository.findByAttributes.mockResolvedValue(mockVendor);
    
    // Act
    await invoiceService.updateCustomerAndVendorData(invoiceId, customerData, vendorData);
    
    // Assert
    expect(invoiceService.customerRepository.findByAttributes).toHaveBeenCalled();
    expect(invoiceService.vendorRepository.findByAttributes).toHaveBeenCalled();
    expect(invoiceService.invoiceRepository.updateCustomerId).toHaveBeenCalled();
    expect(invoiceService.invoiceRepository.updateVendorId).toHaveBeenCalled();
  });

  test('should handle case when neither customer nor vendor data is provided', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    
    // Act
    await invoiceService.updateCustomerAndVendorData(invoiceId, null, null);
    
    // Assert
    expect(invoiceService.customerRepository.findByAttributes).not.toHaveBeenCalled();
    expect(invoiceService.vendorRepository.findByAttributes).not.toHaveBeenCalled();
    expect(invoiceService.customerRepository.create).not.toHaveBeenCalled();
    expect(invoiceService.vendorRepository.create).not.toHaveBeenCalled();
    expect(invoiceService.invoiceRepository.updateCustomerId).not.toHaveBeenCalled();
    expect(invoiceService.invoiceRepository.updateVendorId).not.toHaveBeenCalled();
  });
  
  test('should handle customer name without other fields', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const customerData = { name: 'Customer Name Only' };
    
    const mockCustomer = { uuid: 'customer-uuid-simple' };
    invoiceService.customerRepository.findByAttributes.mockResolvedValue(mockCustomer);
    
    // Act
    await invoiceService.updateCustomerAndVendorData(invoiceId, customerData, null);
    
    // Assert
    expect(invoiceService.customerRepository.findByAttributes).toHaveBeenCalledWith({
      name: customerData.name
    });
    expect(invoiceService.invoiceRepository.updateCustomerId).toHaveBeenCalledWith(
      invoiceId,
      mockCustomer.uuid
    );
  });
  
  test('should handle database errors during customer lookup', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const customerData = { name: 'Error Customer' };
    const error = new Error('Database error');
    
    // Mock the rejection
    invoiceService.customerRepository.findByAttributes.mockRejectedValue(error);
    
    // Act & Assert
    await expect(
      invoiceService.updateCustomerAndVendorData(invoiceId, customerData, null)
    ).rejects.toThrow('Database error');
    
    expect(invoiceService.customerRepository.findByAttributes).toHaveBeenCalled();
    expect(invoiceService.customerRepository.create).not.toHaveBeenCalled();
  });
  
  test('should handle database errors during vendor creation', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const vendorData = { name: 'Error Vendor' };
    const error = new Error('Creation error');
    
    invoiceService.vendorRepository.findByAttributes.mockResolvedValue(null);
    invoiceService.vendorRepository.create.mockRejectedValue(error);
    
    // Act & Assert
    await expect(
      invoiceService.updateCustomerAndVendorData(invoiceId, null, vendorData)
    ).rejects.toThrow('Creation error');
    
    expect(invoiceService.vendorRepository.findByAttributes).toHaveBeenCalled();
    expect(invoiceService.vendorRepository.create).toHaveBeenCalled();
    expect(invoiceService.invoiceRepository.updateVendorId).not.toHaveBeenCalled();
  });
  
  test('should include address in vendor where clause when address is provided', async () => {
    // Arrange
    const invoiceId = 'test-invoice-address';
    const vendorData = {
      name: 'Vendor With Address',
      tax_id: 'V-ADDRESS-123',
      address: '789 Vendor Boulevard, Business District'
    };
    
    const mockVendor = {
      uuid: 'vendor-uuid-with-address',
      name: vendorData.name
    };
    
    invoiceService.vendorRepository.findByAttributes.mockResolvedValue(mockVendor);
    
    // Act
    await invoiceService.updateCustomerAndVendorData(invoiceId, null, vendorData);
    
    // Assert
    expect(invoiceService.vendorRepository.findByAttributes).toHaveBeenCalledWith({
      name: vendorData.name,
      tax_id: vendorData.tax_id,
      address: vendorData.address
    });
    expect(invoiceService.invoiceRepository.updateVendorId).toHaveBeenCalledWith(
      invoiceId,
      mockVendor.uuid
    );
  });
  
  test('should NOT include address in vendor where clause when address is null', async () => {
    // Arrange
    const invoiceId = 'test-invoice-no-address';
    const vendorData = {
      name: 'Vendor Without Address',
      tax_id: 'V-NO-ADDRESS-456',
      address: null
    };
    
    const mockVendor = {
      uuid: 'vendor-uuid-without-address',
      name: vendorData.name
    };
    
    invoiceService.vendorRepository.findByAttributes.mockResolvedValue(mockVendor);
    
    // Act
    await invoiceService.updateCustomerAndVendorData(invoiceId, null, vendorData);
    
    // Assert
    expect(invoiceService.vendorRepository.findByAttributes).toHaveBeenCalledWith({
      name: vendorData.name,
      tax_id: vendorData.tax_id
    });
    expect(invoiceService.invoiceRepository.updateVendorId).toHaveBeenCalledWith(
      invoiceId,
      mockVendor.uuid
    );
  });
});