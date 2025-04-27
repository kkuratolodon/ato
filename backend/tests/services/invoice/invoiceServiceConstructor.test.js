const { InvoiceService } = require('../../../src/services/invoice/invoiceService');
const InvoiceRepository = require('../../../src/repositories/invoiceRepository');
const CustomerRepository = require('../../../src/repositories/customerRepository');
const VendorRepository = require('../../../src/repositories/vendorRepository');
const ItemRepository = require('../../../src/repositories/itemRepository');
const AzureDocumentAnalyzer = require('../../../src/services/analysis/azureDocumentAnalyzer');
const InvoiceValidator = require('../../../src/services/invoice/invoiceValidator');
const InvoiceResponseFormatter = require('../../../src/services/invoice/invoiceResponseFormatter');
const { AzureInvoiceMapper } = require('../../../src/services/invoiceMapperService/invoiceMapperService');
const InvoiceLogger = require('../../../src/services/invoice/invoiceLogger');

// Mock all dependencies
jest.mock('../../../src/repositories/invoiceRepository');
jest.mock('../../../src/repositories/customerRepository');
jest.mock('../../../src/repositories/vendorRepository');
jest.mock('../../../src/repositories/itemRepository');
jest.mock('../../../src/services/analysis/azureDocumentAnalyzer');
jest.mock('../../../src/services/invoice/invoiceValidator');
jest.mock('../../../src/services/invoice/invoiceResponseFormatter');
jest.mock('../../../src/services/invoiceMapperService/invoiceMapperService', () => ({
    AzureInvoiceMapper: jest.fn()
}));
jest.mock('../../../src/services/s3Service');

describe('InvoiceService Constructor', () => {
    // Reset all mocks before each test
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should create instance with default dependencies when no parameters provided', () => {
        // Act
        const service = new InvoiceService();

        // Assert
        expect(InvoiceRepository).toHaveBeenCalledTimes(1);
        expect(CustomerRepository).toHaveBeenCalledTimes(1);
        expect(VendorRepository).toHaveBeenCalledTimes(1);
        expect(ItemRepository).toHaveBeenCalledTimes(1);
        expect(AzureDocumentAnalyzer).toHaveBeenCalledTimes(1);
        expect(InvoiceValidator).toHaveBeenCalledTimes(1);
        expect(InvoiceResponseFormatter).toHaveBeenCalledTimes(1);
        expect(AzureInvoiceMapper).toHaveBeenCalledTimes(1);
    });

    test('should create instance with default dependencies when empty object provided', () => {
        // Act
        const service = new InvoiceService({});

        // Assert
        expect(InvoiceRepository).toHaveBeenCalledTimes(1);
        expect(CustomerRepository).toHaveBeenCalledTimes(1);
        expect(VendorRepository).toHaveBeenCalledTimes(1);
        expect(ItemRepository).toHaveBeenCalledTimes(1);
        expect(AzureDocumentAnalyzer).toHaveBeenCalledTimes(1);
        expect(InvoiceValidator).toHaveBeenCalledTimes(1);
        expect(InvoiceResponseFormatter).toHaveBeenCalledTimes(1);
        expect(AzureInvoiceMapper).toHaveBeenCalledTimes(1);
    });

    test('should use provided dependencies when they are supplied', () => {
        // Arrange
        const mockInvoiceRepo = { findById: jest.fn() };
        const mockCustomerRepo = { findByAttributes: jest.fn() };
        const mockValidator = { validateFileData: jest.fn() };
        const mockS3 = { uploadFile: jest.fn() };

        // Act
        const service = new InvoiceService({
            invoiceRepository: mockInvoiceRepo,
            customerRepository: mockCustomerRepo,
            validator: mockValidator,
            s3Service: mockS3
        });

        // Assert - repositories that were provided should not be instantiated
        expect(InvoiceRepository).not.toHaveBeenCalled();
        expect(CustomerRepository).not.toHaveBeenCalled();
        expect(InvoiceValidator).not.toHaveBeenCalled();

        // But repositories that weren't provided should be instantiated
        expect(VendorRepository).toHaveBeenCalledTimes(1);
        expect(ItemRepository).toHaveBeenCalledTimes(1);
        expect(AzureDocumentAnalyzer).toHaveBeenCalledTimes(1);
        expect(InvoiceResponseFormatter).toHaveBeenCalledTimes(1);
        expect(AzureInvoiceMapper).toHaveBeenCalledTimes(1);

        // Check that the service has the correct dependencies
        expect(service.invoiceRepository).toBe(mockInvoiceRepo);
        expect(service.customerRepository).toBe(mockCustomerRepo);
        expect(service.validator).toBe(mockValidator);
    });

    test('should use custom logger when provided', () => {
        // Arrange
        const mockLogger = {
            logUploadStart: jest.fn(),
            logUploadSuccess: jest.fn(),
            logError: jest.fn()
        };

        // Act
        const service = new InvoiceService({ logger: mockLogger });

        // Assert
        expect(service.logger).toBe(mockLogger);
    });

    test('should use all custom dependencies when all are provided', () => {
        // Arrange
        const mockDependencies = {
            invoiceRepository: { findById: jest.fn() },
            customerRepository: { findByAttributes: jest.fn() },
            vendorRepository: { findByAttributes: jest.fn() },
            itemRepository: { createDocumentItem: jest.fn() },
            documentAnalyzer: { analyzeDocument: jest.fn() },
            validator: { validateFileData: jest.fn() },
            responseFormatter: { formatInvoiceResponse: jest.fn() },
            azureMapper: { mapToInvoiceModel: jest.fn() },
            logger: { logUploadStart: jest.fn() },
            s3Service: { uploadFile: jest.fn() }
        };

        // Act
        const service = new InvoiceService(mockDependencies);

        // Assert - none of the default implementations should be instantiated
        expect(InvoiceRepository).not.toHaveBeenCalled();
        expect(CustomerRepository).not.toHaveBeenCalled();
        expect(VendorRepository).not.toHaveBeenCalled();
        expect(ItemRepository).not.toHaveBeenCalled();
        expect(AzureDocumentAnalyzer).not.toHaveBeenCalled();
        expect(InvoiceValidator).not.toHaveBeenCalled();
        expect(InvoiceResponseFormatter).not.toHaveBeenCalled();
        expect(AzureInvoiceMapper).not.toHaveBeenCalled();

        // Check that the service has the custom dependencies
        expect(service.invoiceRepository).toBe(mockDependencies.invoiceRepository);
        expect(service.customerRepository).toBe(mockDependencies.customerRepository);
        expect(service.vendorRepository).toBe(mockDependencies.vendorRepository);
        expect(service.itemRepository).toBe(mockDependencies.itemRepository);
        expect(service.documentAnalyzer).toBe(mockDependencies.documentAnalyzer);
        expect(service.validator).toBe(mockDependencies.validator);
        expect(service.responseFormatter).toBe(mockDependencies.responseFormatter);
        expect(service.azureMapper).toBe(mockDependencies.azureMapper);
        expect(service.logger).toBe(mockDependencies.logger);
    });
});