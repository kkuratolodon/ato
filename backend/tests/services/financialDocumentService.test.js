const DocumentStatus = require('../../src/models/enums/documentStatus');
const FinancialDocumentService = require('../../src/services/financialDocumentService');
const s3Service = require('../../src/services/s3Service');

// Mock the s3Service with a sophisticated implementation
jest.mock('../../src/services/s3Service', () => ({
  uploadFile: jest.fn(),
  uploadJsonResult: jest.fn().mockImplementation((jsonData) => {
    // Handle null/undefined cases for analysis results
    if (jsonData === null || jsonData === undefined) {
      return Promise.reject(new Error('JSON data cannot be null or undefined'));
    }
    
    try {
      // Test for circular references
      const circularCheck = jsonData && jsonData.self === jsonData;
      if (circularCheck) {
        return Promise.reject(new Error('Cannot convert circular structure to JSON'));
      }
      
      // Try to stringify - another way to catch circular references
      JSON.stringify(jsonData);
      
      // Return successful result for all valid cases (including null/undefined documentId)
      return Promise.resolve('https://example.com/analysis/doc-123-analysis.json');
    } catch (error) {
      // If JSON.stringify fails
      return Promise.reject(new Error('Cannot convert circular structure to JSON'));
    }
  })
}));

describe('FinancialDocumentService', () => {
  let financialDocumentService;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('constructor', () => {
    it('should set document type correctly', () => {
      financialDocumentService = new FinancialDocumentService('invoice');
      expect(financialDocumentService.documentType).toBe('invoice');
    });
  });
  
  describe('uploadFile', () => {
    const mockBuffer = Buffer.from('test file');
    const mockPartnerId = '12345';
    const mockS3Url = 'https://s3-bucket.amazonaws.com/file.pdf';
    
    beforeEach(() => {
      financialDocumentService = new FinancialDocumentService('invoice');
    });

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
        status: DocumentStatus.PROCESSING, 
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
  
  describe('uploadAnalysisResults', () => {
    let service;
    const mockAnalysisResults = { 
      data: { 
        fields: { 
          invoiceId: { text: 'INV-001' },
          total: { text: '100.00' }
        } 
      }
    };
    const mockDocumentId = 'doc-123';
    const mockS3Url = 'https://example.com/analysis/doc-123-analysis.json';

    beforeEach(() => {
      jest.clearAllMocks();
      service = new FinancialDocumentService('TestDocument');
    });

    // Positive Cases
    test('should upload analysis results to S3 and return URL', async () => {
      const result = await service.uploadAnalysisResults(mockAnalysisResults, mockDocumentId);
      
      expect(s3Service.uploadJsonResult).toHaveBeenCalledWith(mockAnalysisResults, mockDocumentId);
      expect(result).toBe(mockS3Url);
    });

    test('should work with minimal valid analysis data', async () => {
      const minimalResults = { data: {} };
      await service.uploadAnalysisResults(minimalResults, mockDocumentId);
      
      expect(s3Service.uploadJsonResult).toHaveBeenCalledWith(minimalResults, mockDocumentId);
    });

    // Negative Cases
    test('should throw error when analysis results are null', async () => {
      await expect(service.uploadAnalysisResults(null, mockDocumentId))
        .rejects.toThrow('Analysis results are required');
    });

    test('should throw error when analysis results are undefined', async () => {
      await expect(service.uploadAnalysisResults(undefined, mockDocumentId))
        .rejects.toThrow('Analysis results are required');
    });

    test('should throw error when S3 upload fails', async () => {
      s3Service.uploadJsonResult.mockRejectedValueOnce(new Error('Upload failed'));
      
      await expect(service.uploadAnalysisResults(mockAnalysisResults, mockDocumentId))
        .rejects.toThrow('Failed to store analysis results: Upload failed');
    });

    test('should throw error when S3 returns no URL', async () => {
      s3Service.uploadJsonResult.mockResolvedValueOnce(null);
      
      await expect(service.uploadAnalysisResults(mockAnalysisResults, mockDocumentId))
        .rejects.toThrow('Failed to upload analysis results to S3');
    });

    // Corner Cases
    test('should work when documentId is null', async () => {
      // Reset mock to ensure it returns success for this test
      s3Service.uploadJsonResult.mockResolvedValueOnce(mockS3Url);
      
      const result = await service.uploadAnalysisResults(mockAnalysisResults, null);
      
      expect(s3Service.uploadJsonResult).toHaveBeenCalledWith(mockAnalysisResults, null);
      expect(result).toBe(mockS3Url);
    });

    test('should work when documentId is undefined', async () => {
      // Reset mock to ensure it returns success for this test
      s3Service.uploadJsonResult.mockResolvedValueOnce(mockS3Url);
      
      const result = await service.uploadAnalysisResults(mockAnalysisResults);
      
      expect(s3Service.uploadJsonResult).toHaveBeenCalledWith(mockAnalysisResults, undefined);
      expect(result).toBe(mockS3Url);
    });

    test('should handle large analysis results', async () => {
      // Create large analysis results (50 items)
      const largeResults = { 
        data: { 
          fields: {},
          pages: Array(50).fill(0).map((_, i) => ({ 
            pageNumber: i+1,
            lines: Array(100).fill({ text: `Line ${i}` })
          }))
        }
      };
      
      // Reset mock to ensure it returns success for this test
      s3Service.uploadJsonResult.mockResolvedValueOnce(mockS3Url);
      
      const result = await service.uploadAnalysisResults(largeResults, mockDocumentId);
      
      expect(s3Service.uploadJsonResult).toHaveBeenCalledWith(largeResults, mockDocumentId);
      expect(result).toBe(mockS3Url);
    });
    
    // Fixed circular reference test
    test('should handle circular references in analysis results', async () => {
      // Create object with circular reference
      const circularObj = { name: 'circular' };
      circularObj.self = circularObj;
      
      // Explicitly mock the specific behavior for this test case
      s3Service.uploadJsonResult.mockRejectedValueOnce(
        new Error('Cannot convert circular structure to JSON')
      );
      
      // This should now throw an error due to circular reference
      await expect(service.uploadAnalysisResults(circularObj, mockDocumentId))
        .rejects.toThrow('Failed to store analysis results: Cannot convert circular structure to JSON');
    });
  });
});