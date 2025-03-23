// Create this as a separate test file to isolate the environment

// Mock modules before requiring the service
jest.mock('../../src/models', () => {
  const mockCustomer = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockVendor = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockInvoice = {
    update: jest.fn(),
  };

  return {
    Customer: mockCustomer,
    Vendor: mockVendor,
    Invoice: mockInvoice,
  };
});

// Now require the models and service
const { Customer, Vendor, Invoice } = require('../../src/models');
const invoiceService = require('../../src/services/invoiceService');

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
      postal_code: '10001',
      street_address: '123 Test St'
    };
    
    const mockCustomer = {
      uuid: 'customer-uuid-123',
      name: customerData.name
    };
    
    Customer.findOne.mockResolvedValue(mockCustomer);
    
    // Act
    await invoiceService.updateCustomerAndVendorData(invoiceId, customerData, null);
    
    // Assert
    expect(Customer.findOne).toHaveBeenCalledWith({
      where: {
        name: customerData.name,
        tax_id: customerData.tax_id,
        postal_code: customerData.postal_code,
        street_address: customerData.street_address
      }
    });
    expect(Customer.create).not.toHaveBeenCalled();
    expect(Invoice.update).toHaveBeenCalledWith(
      { customer_id: mockCustomer.uuid },
      { where: { id: invoiceId } }
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
    
    Customer.findOne.mockResolvedValue(null);
    const mockCreatedCustomer = {
      uuid: 'new-customer-uuid-456',
      name: customerData.name
    };
    Customer.create.mockResolvedValue(mockCreatedCustomer);
    
    // Act
    await invoiceService.updateCustomerAndVendorData(invoiceId, customerData, null);
    
    // Assert
    expect(Customer.findOne).toHaveBeenCalled();
    expect(Customer.create).toHaveBeenCalledWith(customerData);
    expect(Invoice.update).toHaveBeenCalledWith(
      { customer_id: mockCreatedCustomer.uuid },
      { where: { id: invoiceId } }
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
    
    Vendor.findOne.mockResolvedValue(mockVendor);
    
    // Act
    await invoiceService.updateCustomerAndVendorData(invoiceId, null, vendorData);
    
    // Assert
    expect(Vendor.findOne).toHaveBeenCalledWith({
      where: {
        name: vendorData.name,
        tax_id: vendorData.tax_id
      }
    });
    expect(Vendor.create).not.toHaveBeenCalled();
    expect(Invoice.update).toHaveBeenCalledWith(
      { vendor_id: mockVendor.uuid },
      { where: { id: invoiceId } }
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
    
    Vendor.findOne.mockResolvedValue(null);
    const mockCreatedVendor = {
      uuid: 'new-vendor-uuid-101',
      name: vendorData.name
    };
    Vendor.create.mockResolvedValue(mockCreatedVendor);
    
    // Act
    await invoiceService.updateCustomerAndVendorData(invoiceId, null, vendorData);
    
    // Assert
    expect(Vendor.findOne).toHaveBeenCalled();
    expect(Vendor.create).toHaveBeenCalledWith(vendorData);
    expect(Invoice.update).toHaveBeenCalledWith(
      { vendor_id: mockCreatedVendor.uuid },
      { where: { id: invoiceId } }
    );
  });

  test('should handle case when both customer and vendor data are provided', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const customerData = { name: 'Test Customer' };
    const vendorData = { name: 'Test Vendor' };
    
    const mockCustomer = { uuid: 'customer-uuid-123' };
    const mockVendor = { uuid: 'vendor-uuid-456' };
    
    Customer.findOne.mockResolvedValue(mockCustomer);
    Vendor.findOne.mockResolvedValue(mockVendor);
    
    // Act
    await invoiceService.updateCustomerAndVendorData(invoiceId, customerData, vendorData);
    
    // Assert
    expect(Customer.findOne).toHaveBeenCalled();
    expect(Vendor.findOne).toHaveBeenCalled();
    expect(Invoice.update).toHaveBeenCalledTimes(2);
  });

  test('should handle case when neither customer nor vendor data is provided', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    
    // Act
    await invoiceService.updateCustomerAndVendorData(invoiceId, null, null);
    
    // Assert
    expect(Customer.findOne).not.toHaveBeenCalled();
    expect(Vendor.findOne).not.toHaveBeenCalled();
    expect(Customer.create).not.toHaveBeenCalled();
    expect(Vendor.create).not.toHaveBeenCalled();
    expect(Invoice.update).not.toHaveBeenCalled();
  });
  
  test('should handle customer name without other fields', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const customerData = { name: 'Customer Name Only' };
    
    const mockCustomer = { uuid: 'customer-uuid-simple' };
    Customer.findOne.mockResolvedValue(mockCustomer);
    
    // Act
    await invoiceService.updateCustomerAndVendorData(invoiceId, customerData, null);
    
    // Assert
    expect(Customer.findOne).toHaveBeenCalledWith({
      where: { name: customerData.name }
    });
    expect(Invoice.update).toHaveBeenCalledWith(
      { customer_id: mockCustomer.uuid },
      { where: { id: invoiceId } }
    );
  });
  
  test('should handle database errors during customer lookup', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const customerData = { name: 'Error Customer' };
    const error = new Error('Database error');
    
    // Mock the rejection
    Customer.findOne.mockRejectedValue(error);
    
    // Act & Assert
    await expect(
      invoiceService.updateCustomerAndVendorData(invoiceId, customerData, null)
    ).rejects.toThrow('Database error');
    
    expect(Customer.findOne).toHaveBeenCalled();
    expect(Customer.create).not.toHaveBeenCalled();
  });
  
  test('should handle database errors during vendor creation', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const vendorData = { name: 'Error Vendor' };
    const error = new Error('Creation error');
    
    Vendor.findOne.mockResolvedValue(null);
    Vendor.create.mockRejectedValue(error);
    
    // Act & Assert
    await expect(
      invoiceService.updateCustomerAndVendorData(invoiceId, null, vendorData)
    ).rejects.toThrow('Creation error');
    
    expect(Vendor.findOne).toHaveBeenCalled();
    expect(Vendor.create).toHaveBeenCalled();
    expect(Invoice.update).not.toHaveBeenCalled();
  });
});
