const invoiceService = require('../../../src/services/invoice/invoiceService');

// Mock repositories directly
jest.mock('../../../src/repositories/itemRepository', () => {
  return jest.fn().mockImplementation(() => ({
    findOrCreateItem: jest.fn(),
    createDocumentItem: jest.fn(),
    findItemsByDocumentId: jest.fn()
  }));
});

jest.mock('../../../src/repositories/invoiceRepository');
jest.mock('../../../src/repositories/customerRepository');
jest.mock('../../../src/repositories/vendorRepository');

// Mock other dependencies
jest.mock('@azure/ai-form-recognizer');
jest.mock('../../../src/services/s3Service', () => ({ uploadFile: jest.fn() }));
jest.mock('../../../src/services/analysis/azureDocumentAnalyzer');
jest.mock('../../../src/services/invoice/invoiceValidator');
jest.mock('../../../src/services/invoice/invoiceResponseFormatter');
jest.mock('../../../src/services/invoiceMapperService');

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mocked-uuid-123')
}));

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

describe('saveInvoiceItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  
    // Set up mock return values
    invoiceService.itemRepository.findOrCreateItem.mockResolvedValue({ 
      uuid: 'item-123', 
      description: 'Test Item' 
    });
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should successfully save invoice items', async () => {
    // Arrange
    const invoiceId = '1';
    const itemsData = [
      { description: 'Item 1', quantity: 2, unit: 'pcs', unitPrice: 10.5, amount: 21 },
      { description: 'Item 2', quantity: 1, unit: 'kg', unitPrice: 15.75, amount: 15.75 }
    ];

    // Act
    await invoiceService.saveInvoiceItems(invoiceId, itemsData);

    // Assert
    // Check first item
    expect(invoiceService.itemRepository.findOrCreateItem).toHaveBeenCalledWith('Item 1');
    expect(invoiceService.itemRepository.createDocumentItem).toHaveBeenCalledWith(
      'Invoice',
      invoiceId,
      'item-123',
      {
        quantity: 2,
        unit: 'pcs',
        unit_price: 10.5,
        amount: 21
      }
    );

    // Check second item
    expect(invoiceService.itemRepository.findOrCreateItem).toHaveBeenCalledWith('Item 2');
    expect(invoiceService.itemRepository.createDocumentItem).toHaveBeenCalledWith(
      'Invoice',
      invoiceId,
      'item-123',
      {
        quantity: 1,
        unit: 'kg',
        unit_price: 15.75,
        amount: 15.75
      }
    );
  });

  test('should handle empty itemsData array', async () => {
    // Arrange
    const invoiceId = '1';
    const itemsData = [];

    // Act
    await invoiceService.saveInvoiceItems(invoiceId, itemsData);

    // Assert
    expect(invoiceService.itemRepository.findOrCreateItem).not.toHaveBeenCalled();
    expect(invoiceService.itemRepository.createDocumentItem).not.toHaveBeenCalled();
  });

  test('should handle undefined itemsData', async () => {
    // Arrange
    const invoiceId = '1';
    const itemsData = undefined;

    // Act
    await invoiceService.saveInvoiceItems(invoiceId, itemsData);

    // Assert
    expect(invoiceService.itemRepository.findOrCreateItem).not.toHaveBeenCalled();
    expect(invoiceService.itemRepository.createDocumentItem).not.toHaveBeenCalled();
  });

  test('should handle database error when saving item', async () => {
    // Arrange
    const invoiceId = '1';
    const itemsData = [
      { description: 'Error Item', quantity: 1, unit: 'ea', unitPrice: 10, amount: 10 }
    ];

    // Mock a database error
    invoiceService.itemRepository.findOrCreateItem.mockRejectedValue(new Error('Database error'));

    // Act & Assert
    await expect(invoiceService.saveInvoiceItems(invoiceId, itemsData))
      .rejects.toThrow('Failed to save invoice items: Database error');

    expect(invoiceService.itemRepository.findOrCreateItem).toHaveBeenCalledWith('Error Item');
    expect(invoiceService.itemRepository.createDocumentItem).not.toHaveBeenCalled();
  });

  test('should apply fallback values when item data fields are missing or falsy', async () => {
    // Arrange
    const invoiceId = '1';
    const itemsWithMissingValues = [
      {
        description: 'Item with missing values'
        // quantity, unit, unit_price, and amount are missing
      },
      {
        description: 'Item with null values',
        quantity: null,
        unit: null,
        unitPrice: null,
        amount: null
      },
      {
        description: 'Item with zero values',
        quantity: 0,
        unitPrice: 0,
        amount: 0
      }
    ];

    // Act
    await invoiceService.saveInvoiceItems(invoiceId, itemsWithMissingValues);

    // Assert
    expect(invoiceService.itemRepository.findOrCreateItem).toHaveBeenCalledTimes(3);

    // Check first call (missing values)
    expect(invoiceService.itemRepository.createDocumentItem.mock.calls[0][3]).toEqual({
      quantity: 0,            // Default value applied
      unit: null,             // Default value applied
      unit_price: 0,          // Default value applied
      amount: 0               // Default value applied
    });

    // Check second call (null values)
    expect(invoiceService.itemRepository.createDocumentItem.mock.calls[1][3]).toEqual({
      quantity: 0,            // Default value applied
      unit: null,             // Null preserved
      unit_price: 0,          // Default value applied
      amount: 0               // Default value applied
    });

    // Check third call (zero values)
    expect(invoiceService.itemRepository.createDocumentItem.mock.calls[2][3]).toEqual({
      quantity: 0,            // Zero preserved
      unit: null,             // Default value applied
      unit_price: 0,          // Zero preserved
      amount: 0               // Zero preserved
    });

    // Should have been called 3 times (once per item)
    expect(invoiceService.itemRepository.createDocumentItem).toHaveBeenCalledTimes(3);
  });

  test('should correctly handle item data with all fields present', async () => {
    // Arrange
    const invoiceId = '1';
    const completeItemData = {
      description: 'Complete Item',
      quantity: 5,
      unit: 'kg',
      unitPrice: 10.99,
      amount: 54.95
    };

    // Act
    await invoiceService.saveInvoiceItems(invoiceId, [completeItemData]);

    // Assert
    expect(invoiceService.itemRepository.findOrCreateItem).toHaveBeenCalledWith('Complete Item');
    expect(invoiceService.itemRepository.createDocumentItem).toHaveBeenCalledWith(
      'Invoice',
      invoiceId,
      'item-123',
      {
        quantity: 5,
        unit: 'kg',
        unit_price: 10.99,
        amount: 54.95
      }
    );
  });
});