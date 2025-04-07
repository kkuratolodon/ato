const FinancialDocumentService = require('../../src/services/financialDocumentService');
const s3Service = require('../../src/services/s3Service');

// Mock the s3Service with a more sophisticated implementation
jest.mock('../../src/services/s3Service', () => ({
  uploadFile: jest.fn(),
  uploadJsonResult: jest.fn().mockImplementation((jsonData, documentId) => {
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

describe('FinancialDocumentService - uploadAnalysisResults', () => {
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

  // Positive Cases - No changes needed
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

  // Negative Cases - No changes needed
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

  // Corner Cases - Fixed Tests
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