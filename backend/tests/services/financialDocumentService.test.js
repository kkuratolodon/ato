const FinancialDocumentService = require('../../src/services/financialDocumentService');
const s3Service = require('../../src/services/s3Service');

// Mock s3Service
jest.mock('../../src/services/s3Service');

describe('FinancialDocumentService', () => {
    let financialDocumentService;
    
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        financialDocumentService = new FinancialDocumentService('invoice');
    });

    describe('constructor', () => {
        it('should set document type correctly', () => {
            expect(financialDocumentService.documentType).toBe('invoice');
        });
    });

    describe('uploadFile', () => {
        const mockBuffer = Buffer.from('test file');
        const mockPartnerId = '12345';
        const mockS3Url = 'https://s3-bucket.amazonaws.com/file.pdf';

        it('should upload a file successfully and return the correct object', async () => {
            // Setup mock
            s3Service.uploadFile.mockResolvedValue(mockS3Url);

            // Execute
            const result = await financialDocumentService.uploadFile({
                buffer: mockBuffer,
                partnerId: mockPartnerId
            });

            // Assert
            expect(s3Service.uploadFile).toHaveBeenCalledWith(mockBuffer);
            expect(result).toEqual({
                status: 'Processing',
                partner_id: mockPartnerId,
                file_url: mockS3Url
            });
        });

        it('should throw an error if partnerId is not provided', async () => {
            await expect(
                financialDocumentService.uploadFile({ buffer: mockBuffer })
            ).rejects.toThrow('Partner ID is required');
            
            expect(s3Service.uploadFile).not.toHaveBeenCalled();
        });

        it('should throw an error if uploadFile to S3 fails', async () => {
            // Setup mock to return null (failure case)
            s3Service.uploadFile.mockResolvedValue(null);

            await expect(
                financialDocumentService.uploadFile({ 
                    buffer: mockBuffer, 
                    partnerId: mockPartnerId 
                })
            ).rejects.toThrow('Failed to upload file to S3');
            
            expect(s3Service.uploadFile).toHaveBeenCalledWith(mockBuffer);
        });

        it('should throw an error if S3 service throws an error', async () => {
            // Setup mock to throw error
            const errorMessage = 'S3 upload error';
            s3Service.uploadFile.mockRejectedValue(new Error(errorMessage));

            await expect(
                financialDocumentService.uploadFile({ 
                    buffer: mockBuffer, 
                    partnerId: mockPartnerId 
                })
            ).rejects.toThrow(errorMessage);
            
            expect(s3Service.uploadFile).toHaveBeenCalledWith(mockBuffer);
        });
    });
});