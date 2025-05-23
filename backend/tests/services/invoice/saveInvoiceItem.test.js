const invoiceService = require('../../../src/services/invoice/invoiceService');

// Mock repositories directly
jest.mock('../../../src/repositories/itemRepository', () => {
  return jest.fn().mockImplementation(() => ({
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
jest.mock('../../../src/services/invoiceMapperService/invoiceMapperService');

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
    // Reassign mocked ItemRepository instance to service (ensure mock applies)
    const ItemRepository = require('../../../src/repositories/itemRepository');
    invoiceService.itemRepository = new ItemRepository();
    // Ensure createDocumentItem resolves by default
    invoiceService.itemRepository.createDocumentItem.mockResolvedValue();
  });
  
  afterEach(() => {
    // Remove restoreAllMocks to preserve mock implementations
    jest.clearAllMocks();
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
    // Should call createDocumentItem twice with correct item data
    expect(invoiceService.itemRepository.createDocumentItem).toHaveBeenCalledTimes(2);
    expect(invoiceService.itemRepository.createDocumentItem).toHaveBeenNthCalledWith(
      1,
      'Invoice',
      invoiceId,
      {description: "Item 1", quantity: 2, unit: 'pcs', unit_price: 10.5, amount: 21 }
    );
    expect(invoiceService.itemRepository.createDocumentItem).toHaveBeenNthCalledWith(
      2,
      'Invoice',
      invoiceId,
      {description: "Item 2", quantity: 1, unit: 'kg', unit_price: 15.75, amount: 15.75 }
    );
  });

  test('should handle empty itemsData array', async () => {
    // Arrange
    const invoiceId = '1';
    const itemsData = [];

    // Act
    await invoiceService.saveInvoiceItems(invoiceId, itemsData);

    // Assert
    expect(invoiceService.itemRepository.createDocumentItem).not.toHaveBeenCalled();
  });

  test('should handle undefined itemsData', async () => {
    // Arrange
    const invoiceId = '1';
    const itemsData = undefined;

    // Act
    await invoiceService.saveInvoiceItems(invoiceId, itemsData);

    // Assert
    expect(invoiceService.itemRepository.createDocumentItem).not.toHaveBeenCalled();
  });

  test('should handle database error when saving item', async () => {
    // Arrange
    const invoiceId = '1';
    const itemsData = [
      { description: 'Error Item', quantity: 1, unit: 'ea', unitPrice: 10, amount: 10 }
    ];

    // Mock a database error on createDocumentItem
    invoiceService.itemRepository.createDocumentItem.mockRejectedValue(new Error('Database error'));

    // Act & Assert
    await expect(invoiceService.saveInvoiceItems(invoiceId, itemsData))
      .rejects.toThrow('Failed to save invoice items: Database error');

    expect(invoiceService.itemRepository.createDocumentItem).toHaveBeenCalledWith(
      'Invoice',
      invoiceId,
      {description: "Error Item", quantity: 1, unit: 'ea', unit_price: 10, amount: 10 }
    );
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
      },
      {
        description: null,
        quantity: 0,
        unitPrice: 0,
        amount: 0
      }
    ];
    console.log(`itemsWithMissingValues: ${JSON.stringify(itemsWithMissingValues)}`);
    // Act
    await invoiceService.saveInvoiceItems(invoiceId, itemsWithMissingValues);
    console.log(`masuk: ${JSON.stringify(itemsWithMissingValues)}`);
    // Assert
    expect(invoiceService.itemRepository.createDocumentItem).toHaveBeenCalledTimes(4);

    // Check first call (missing values)
    expect(invoiceService.itemRepository.createDocumentItem.mock.calls[0][2]).toEqual({
      description: 'Item with missing values',
      quantity: 0,            // Default value applied
      unit: null,             // Default value applied
      unit_price: 0,          // Default value applied
      amount: 0               // Default value applied
    });

    // Check second call (null values)
    expect(invoiceService.itemRepository.createDocumentItem.mock.calls[1][2]).toEqual({
      description: 'Item with null values',
      quantity: 0,            // Default value applied
      unit: null,             // Null preserved
      unit_price: 0,          // Default value applied
      amount: 0               // Default value applied
    });

    // Check third call (zero values)
    expect(invoiceService.itemRepository.createDocumentItem.mock.calls[2][2]).toEqual({
      description: 'Item with zero values',
      quantity: 0,            // Zero preserved
      unit: null,             // Default value applied
      unit_price: 0,          // Zero preserved
      amount: 0               // Zero preserved
    });
    expect(invoiceService.itemRepository.createDocumentItem.mock.calls[3][2]).toEqual({
      description: null,
      quantity: 0,            // Zero preserved
      unit: null,             // Default value applied
      unit_price: 0,          // Zero preserved
      amount: 0               // Zero preserved
    });
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
    expect(invoiceService.itemRepository.createDocumentItem).toHaveBeenCalledWith(
      'Invoice',
      invoiceId,
      {description: 'Complete Item', quantity: 5, unit: 'kg', unit_price: 10.99, amount: 54.95 }
    );
  });
  test('should handle items with undefined description correctly', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const itemsData = [
      {
        // No description property
        quantity: 2,
        unit: 'pc',
        unitPrice: 10.5,
        amount: 21.0
      }
    ];

    // Act
    await invoiceService.saveInvoiceItems(invoiceId, itemsData);

    // Assert
    expect(invoiceService.itemRepository.createDocumentItem).toHaveBeenCalledWith(
      'Invoice',
      invoiceId,
      {
        description: null,
        quantity: 2,
        unit: 'pc',
        unit_price: 10.5,
        amount: 21.0
      }
    );
  });
});