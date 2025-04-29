const invoiceService = require('@services/invoice/invoiceService');
const DocumentStatus = require('../../../src/models/enums/DocumentStatus');

// Mock repositories
jest.mock('@repositories/invoiceRepository', () => {
  return jest.fn().mockImplementation(() => ({
    findById: jest.fn()
  }));
});

// Mock other dependencies
jest.mock('@repositories/customerRepository');
jest.mock('@repositories/vendorRepository');
jest.mock('@repositories/itemRepository');

describe('getInvoiceStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return invoice status for valid ID', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const mockInvoice = {
      id: invoiceId,
      status: DocumentStatus.ANALYZED,
      partner_id: 'partner-abc'
    };

    invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);

    // Act
    const result = await invoiceService.getInvoiceStatus(invoiceId);

    // Assert
    expect(invoiceService.invoiceRepository.findById).toHaveBeenCalledWith(invoiceId);
    expect(result).toEqual({
      id: invoiceId,
      status: DocumentStatus.ANALYZED
    });
  });

  test('should return PROCESSING status when invoice is still processing', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const mockInvoice = {
      id: invoiceId,
      status: DocumentStatus.PROCESSING,
      partner_id: 'partner-abc'
    };

    invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);

    // Act
    const result = await invoiceService.getInvoiceStatus(invoiceId);

    // Assert
    expect(result).toEqual({
      id: invoiceId,
      status: DocumentStatus.PROCESSING
    });
  });

  test('should return FAILED status when invoice processing failed', async () => {
    // Arrange
    const invoiceId = 'test-invoice-123';
    const mockInvoice = {
      id: invoiceId,
      status: DocumentStatus.FAILED,
      partner_id: 'partner-abc'
    };

    invoiceService.invoiceRepository.findById.mockResolvedValue(mockInvoice);

    // Act
    const result = await invoiceService.getInvoiceStatus(invoiceId);

    // Assert
    expect(result).toEqual({
      id: invoiceId,
      status: DocumentStatus.FAILED
    });
  });

  test('should throw error when invoice not found', async () => {
    // Arrange
    const invoiceId = 'non-existent-invoice';
    invoiceService.invoiceRepository.findById.mockResolvedValue(null);

    // Act & Assert
    await expect(invoiceService.getInvoiceStatus(invoiceId))
      .rejects.toThrow('Invoice not found');
    expect(invoiceService.invoiceRepository.findById).toHaveBeenCalledWith(invoiceId);
  });

  test('should propagate repository errors', async () => {
    // Arrange
    const invoiceId = 'test-invoice-error';
    const dbError = new Error('Database connection error');
    invoiceService.invoiceRepository.findById.mockRejectedValue(dbError);

    // Act & Assert
    await expect(invoiceService.getInvoiceStatus(invoiceId))
      .rejects.toThrow('Database connection error');
    expect(invoiceService.invoiceRepository.findById).toHaveBeenCalledWith(invoiceId);
  });
});