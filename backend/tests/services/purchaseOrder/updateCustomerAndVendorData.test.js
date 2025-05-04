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

jest.mock('../../../src/repositories/purchaseOrderRepository', () => {
  return jest.fn().mockImplementation(() => ({
    updateCustomerId: jest.fn(),
    updateVendorId: jest.fn()
  }));
});

// Mock other repositories and dependencies
jest.mock('../../../src/repositories/itemRepository');
jest.mock('../../../src/services/analysis/azureDocumentAnalyzer');
jest.mock('../../../src/services/purchaseOrder/purchaseOrderValidator');
jest.mock('../../../src/services/purchaseOrder/purchaseOrderResponseFormatter');
jest.mock('../../../src/services/purchaseOrderMapperService/purchaseOrderMapperService');

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
const purchaseOrderService = require('../../../src/services/purchaseOrder/purchaseOrderService');

describe('updateCustomerAndVendorData for purchase orders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle case when customer already exists', async () => {
    // Arrange
    const purchaseOrderId = 'test-purchase-order-123';
    const customerData = {
      name: 'Existing Customer',
      tax_id: '123456',
      address: '123 Test St'
    };
    
    const mockCustomer = {
      uuid: 'customer-uuid-123',
      name: customerData.name
    };
    
    purchaseOrderService.customerRepository.findByAttributes.mockResolvedValue(mockCustomer);
    
    // Act
    await purchaseOrderService.updateCustomerAndVendorData(purchaseOrderId, customerData, null);
    
    // Assert
    expect(purchaseOrderService.customerRepository.findByAttributes).toHaveBeenCalledWith({
      name: customerData.name,
      tax_id: customerData.tax_id,
      address: customerData.address
    });
    expect(purchaseOrderService.customerRepository.create).not.toHaveBeenCalled();
    expect(purchaseOrderService.purchaseOrderRepository.updateCustomerId).toHaveBeenCalledWith(
      purchaseOrderId,
      mockCustomer.uuid
    );
  });

  test('should handle case when customer does not exist and needs to be created', async () => {
    // Arrange
    const purchaseOrderId = 'test-purchase-order-123';
    const customerData = {
      name: 'New Customer',
      tax_id: '7890',
      street_address: '456 New St'
    };
    
    purchaseOrderService.customerRepository.findByAttributes.mockResolvedValue(null);
    const mockCreatedCustomer = {
      uuid: 'new-customer-uuid-456',
      name: customerData.name
    };
    purchaseOrderService.customerRepository.create.mockResolvedValue(mockCreatedCustomer);
    
    // Act
    await purchaseOrderService.updateCustomerAndVendorData(purchaseOrderId, customerData, null);
    
    // Assert
    expect(purchaseOrderService.customerRepository.findByAttributes).toHaveBeenCalled();
    expect(purchaseOrderService.customerRepository.create).toHaveBeenCalledWith(customerData);
    expect(purchaseOrderService.purchaseOrderRepository.updateCustomerId).toHaveBeenCalledWith(
      purchaseOrderId,
      mockCreatedCustomer.uuid
    );
  });

  test('should handle case when vendor already exists', async () => {
    // Arrange
    const purchaseOrderId = 'test-purchase-order-123';
    const vendorData = {
      name: 'Existing Vendor',
      tax_id: 'V12345'
    };
    
    const mockVendor = {
      uuid: 'vendor-uuid-789',
      name: vendorData.name
    };
    
    purchaseOrderService.vendorRepository.findByAttributes.mockResolvedValue(mockVendor);
    
    // Act
    await purchaseOrderService.updateCustomerAndVendorData(purchaseOrderId, null, vendorData);
    
    // Assert
    expect(purchaseOrderService.vendorRepository.findByAttributes).toHaveBeenCalledWith({
      name: vendorData.name,
      tax_id: vendorData.tax_id
    });
    expect(purchaseOrderService.vendorRepository.create).not.toHaveBeenCalled();
    expect(purchaseOrderService.purchaseOrderRepository.updateVendorId).toHaveBeenCalledWith(
      purchaseOrderId,
      mockVendor.uuid
    );
  });

  test('should handle case when vendor does not exist and needs to be created', async () => {
    // Arrange
    const purchaseOrderId = 'test-purchase-order-123';
    const vendorData = {
      name: 'New Vendor',
      postal_code: '20001',
      street_address: '123 Test St'
    };
    
    purchaseOrderService.vendorRepository.findByAttributes.mockResolvedValue(null);
    const mockCreatedVendor = {
      uuid: 'new-vendor-uuid-101',
      name: vendorData.name
    };
    purchaseOrderService.vendorRepository.create.mockResolvedValue(mockCreatedVendor);
    
    // Act
    await purchaseOrderService.updateCustomerAndVendorData(purchaseOrderId, null, vendorData);
    
    // Assert
    expect(purchaseOrderService.vendorRepository.findByAttributes).toHaveBeenCalled();
    expect(purchaseOrderService.vendorRepository.create).toHaveBeenCalledWith(vendorData);
    expect(purchaseOrderService.purchaseOrderRepository.updateVendorId).toHaveBeenCalledWith(
      purchaseOrderId,
      mockCreatedVendor.uuid
    );
  });

  test('should handle case when both customer and vendor data are provided', async () => {
    // Arrange
    const purchaseOrderId = 'test-purchase-order-123';
    const customerData = { name: 'Test Customer' };
    const vendorData = { name: 'Test Vendor' };
    
    const mockCustomer = { uuid: 'customer-uuid-123' };
    const mockVendor = { uuid: 'vendor-uuid-456' };
    
    purchaseOrderService.customerRepository.findByAttributes.mockResolvedValue(mockCustomer);
    purchaseOrderService.vendorRepository.findByAttributes.mockResolvedValue(mockVendor);
    
    // Act
    await purchaseOrderService.updateCustomerAndVendorData(purchaseOrderId, customerData, vendorData);
    
    // Assert
    expect(purchaseOrderService.customerRepository.findByAttributes).toHaveBeenCalled();
    expect(purchaseOrderService.vendorRepository.findByAttributes).toHaveBeenCalled();
    expect(purchaseOrderService.purchaseOrderRepository.updateCustomerId).toHaveBeenCalled();
    expect(purchaseOrderService.purchaseOrderRepository.updateVendorId).toHaveBeenCalled();
  });

  test('should handle case when neither customer nor vendor data is provided', async () => {
    // Arrange
    const purchaseOrderId = 'test-purchase-order-123';
    
    // Act
    await purchaseOrderService.updateCustomerAndVendorData(purchaseOrderId, null, null);
    
    // Assert
    expect(purchaseOrderService.customerRepository.findByAttributes).not.toHaveBeenCalled();
    expect(purchaseOrderService.vendorRepository.findByAttributes).not.toHaveBeenCalled();
    expect(purchaseOrderService.customerRepository.create).not.toHaveBeenCalled();
    expect(purchaseOrderService.vendorRepository.create).not.toHaveBeenCalled();
    expect(purchaseOrderService.purchaseOrderRepository.updateCustomerId).not.toHaveBeenCalled();
    expect(purchaseOrderService.purchaseOrderRepository.updateVendorId).not.toHaveBeenCalled();
  });
  
  test('should handle customer name without other fields', async () => {
    // Arrange
    const purchaseOrderId = 'test-purchase-order-123';
    const customerData = { name: 'Customer Name Only' };
    
    const mockCustomer = { uuid: 'customer-uuid-simple' };
    purchaseOrderService.customerRepository.findByAttributes.mockResolvedValue(mockCustomer);
    
    // Act
    await purchaseOrderService.updateCustomerAndVendorData(purchaseOrderId, customerData, null);
    
    // Assert
    expect(purchaseOrderService.customerRepository.findByAttributes).toHaveBeenCalledWith({
      name: customerData.name
    });
    expect(purchaseOrderService.purchaseOrderRepository.updateCustomerId).toHaveBeenCalledWith(
      purchaseOrderId,
      mockCustomer.uuid
    );
  });
  
  test('should handle database errors during customer lookup', async () => {
    // Arrange
    const purchaseOrderId = 'test-purchase-order-123';
    const customerData = { name: 'Error Customer' };
    const error = new Error('Database error');
    
    // Mock the rejection
    purchaseOrderService.customerRepository.findByAttributes.mockRejectedValue(error);
    
    // Act & Assert
    await expect(
      purchaseOrderService.updateCustomerAndVendorData(purchaseOrderId, customerData, null)
    ).rejects.toThrow('Database error');
    
    expect(purchaseOrderService.customerRepository.findByAttributes).toHaveBeenCalled();
    expect(purchaseOrderService.customerRepository.create).not.toHaveBeenCalled();
  });
  
  test('should handle database errors during vendor creation', async () => {
    // Arrange
    const purchaseOrderId = 'test-purchase-order-123';
    const vendorData = { name: 'Error Vendor' };
    const error = new Error('Creation error');
    
    purchaseOrderService.vendorRepository.findByAttributes.mockResolvedValue(null);
    purchaseOrderService.vendorRepository.create.mockRejectedValue(error);
    
    // Act & Assert
    await expect(
      purchaseOrderService.updateCustomerAndVendorData(purchaseOrderId, null, vendorData)
    ).rejects.toThrow('Creation error');
    
    expect(purchaseOrderService.vendorRepository.findByAttributes).toHaveBeenCalled();
    expect(purchaseOrderService.vendorRepository.create).toHaveBeenCalled();
    expect(purchaseOrderService.purchaseOrderRepository.updateVendorId).not.toHaveBeenCalled();
  });
  test('should include address in vendor where clause when address is provided', async () => {
    // Arrange
    const purchaseOrderId = 'test-purchase-order-address';
    const vendorData = {
      name: 'Vendor With Address',
      tax_id: 'V-ADDRESS-123',
      address: '789 Vendor Boulevard, Business District'
    };
    
    const mockVendor = {
      uuid: 'vendor-uuid-with-address',
      name: vendorData.name
    };
    
    purchaseOrderService.vendorRepository.findByAttributes.mockResolvedValue(mockVendor);
    
    // Act
    await purchaseOrderService.updateCustomerAndVendorData(purchaseOrderId, null, vendorData);
    
    // Assert
    expect(purchaseOrderService.vendorRepository.findByAttributes).toHaveBeenCalledWith({
      name: vendorData.name,
      tax_id: vendorData.tax_id,
      address: vendorData.address
    });
    expect(purchaseOrderService.purchaseOrderRepository.updateVendorId).toHaveBeenCalledWith(
      purchaseOrderId,
      mockVendor.uuid
    );
  });
  
  test('should NOT include address in vendor where clause when address is null', async () => {
    // Arrange
    const purchaseOrderId = 'test-purchase-order-no-address';
    const vendorData = {
      name: 'Vendor Without Address',
      tax_id: 'V-NO-ADDRESS-456',
      address: null
    };
    
    const mockVendor = {
      uuid: 'vendor-uuid-without-address',
      name: vendorData.name
    };
    
    purchaseOrderService.vendorRepository.findByAttributes.mockResolvedValue(mockVendor);
    
    // Act
    await purchaseOrderService.updateCustomerAndVendorData(purchaseOrderId, null, vendorData);
    
    // Assert
    expect(purchaseOrderService.vendorRepository.findByAttributes).toHaveBeenCalledWith({
      name: vendorData.name,
      tax_id: vendorData.tax_id
      // address should not be included when null
    });
    expect(purchaseOrderService.purchaseOrderRepository.updateVendorId).toHaveBeenCalledWith(
      purchaseOrderId,
      mockVendor.uuid
    );
  });
});