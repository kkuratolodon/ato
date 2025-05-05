const AWS = require('aws-sdk');
const s3Service = require('../../src/services/s3Service');

// Define constants for expected locations
const FILE_UPLOAD_LOCATION = "https://s3-bucket-url.com/file.pdf";
const JSON_UPLOAD_LOCATION = "https://bucket-name.s3.amazonaws.com/analysis/test-doc-12345.json";

// Mock AWS S3 with different behavior based on the upload params
jest.mock('aws-sdk', () => {
  const mockUploadPromise = jest.fn().mockImplementation((params) => {
    // Return different locations based on the type of upload
    if (params && params.Key && params.Key.includes('analysis/')) {
      return Promise.resolve({
        Location: JSON_UPLOAD_LOCATION
      });
    } else {
      return Promise.resolve({
        Location: FILE_UPLOAD_LOCATION
      });
    }
  });

  const mockUpload = jest.fn().mockImplementation((params) => ({
    promise: () => mockUploadPromise(params)
  }));

  const mockDeleteObjectPromise = jest.fn().mockResolvedValue({});
  
  const mockDeleteObject = jest.fn().mockImplementation(() => ({
    promise: mockDeleteObjectPromise
  }));

  return {
    S3: jest.fn().mockImplementation(() => ({
      upload: mockUpload,
      deleteObject: mockDeleteObject,
      listObjectsV2: jest.fn().mockImplementation(() => ({
        promise: jest.fn().mockResolvedValue({
          Contents: [{ Key: "test-file.pdf" }] 
        }),
      }))
    }))
  };
});

describe("S3 Service", () => {
    let s3;
    const bucketName = process.env.AWS_BUCKET_NAME;
    
    beforeEach(() => {
        s3 = new AWS.S3();
        jest.clearAllMocks();
    });

    test("Upload a file to S3 success", async () => {
        const fileContent = Buffer.from("test file content");   
        const result = await s3Service.uploadFile(fileContent);

        expect(s3.upload).toHaveBeenCalledWith({
            Bucket: bucketName,
            Key: expect.any(String),
            Body: fileContent,
        });

        expect(result).toEqual(FILE_UPLOAD_LOCATION);
    });

    test("Upload a file to S3 failure", async () => {
        const fileContent = Buffer.from("test file content");            

        // Override mock for this specific test
        s3.upload.mockImplementationOnce(() => ({
            promise: () => Promise.reject(new Error("Upload failed"))
        }));

        await expect(s3Service.uploadFile(fileContent)).rejects.toThrow("Upload failed");
    });

    test("Delete a file from S3 success", async () => {
        const fileKey = "test-file.pdf";

        const response = await s3Service.deleteFile(fileKey);

        expect(s3.deleteObject).toHaveBeenCalledWith({
            Bucket: bucketName,
            Key: fileKey,
        });

        expect(response).toEqual({
            success: true,
            message: `Successfully deleted file: ${fileKey} from bucket: ${bucketName}`
        });
    });

    test("Delete a file from S3 failure", async () => {
        const fileKey = "test-file.pdf";
        
        s3.deleteObject.mockImplementationOnce(() => ({
            promise: () => Promise.reject(new Error("Delete failed"))
        }));

        const response = await s3Service.deleteFile(fileKey);
        expect(s3.deleteObject).toHaveBeenCalledWith({
            Bucket: bucketName,
            Key: fileKey,
        });
        expect(response.success).toBe(false);
        expect(response.error).toBe("Delete failed");
    });
});

describe('S3Service - uploadJsonResult', () => {
  // Setup
  const mockS3Instance = new AWS.S3();
  const mockJsonData = { 
    results: { items: [{ name: 'Test Item', price: 100 }] },
    metadata: { confidence: 0.95 }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Positive Cases
  test('should upload JSON data and return a valid URL', async () => {
    const result = await s3Service.uploadJsonResult(mockJsonData, '12345');
    
    // Assert S3 upload was called with correct params
    expect(mockS3Instance.upload).toHaveBeenCalledTimes(1);
    
    // Check for correct content type and bucket path
    const uploadParams = mockS3Instance.upload.mock.calls[0][0];
    expect(uploadParams.ContentType).toBe('application/json');
    expect(uploadParams.Key).toMatch(/^analysis\/.+\.json$/);
    
    // Verify return value
    expect(result).toBe(JSON_UPLOAD_LOCATION);
  });

  test('should include documentId in the filename when provided', async () => {
    const docId = 'invoice-xyz';
    await s3Service.uploadJsonResult(mockJsonData, docId);
    
    const uploadParams = mockS3Instance.upload.mock.calls[0][0];
    expect(uploadParams.Key).toMatch(new RegExp(`^analysis\\/${docId}-analysis-.+\\.json$`));
  });

  test('should create generic filename when documentId is not provided', async () => {
    await s3Service.uploadJsonResult(mockJsonData);
    
    const uploadParams = mockS3Instance.upload.mock.calls[0][0];
    expect(uploadParams.Key).toMatch(/^analysis\/analysis-.+\.json$/);
  });

  test('should stringify JSON properly', async () => {
    await s3Service.uploadJsonResult(mockJsonData);
    
    const uploadParams = mockS3Instance.upload.mock.calls[0][0];
    expect(typeof uploadParams.Body).toBe('string');
    
    // Parse the stringified body to verify it matches original data
    const parsedBody = JSON.parse(uploadParams.Body);
    expect(parsedBody).toEqual(mockJsonData);
  });

  // Negative Cases
  test('should throw error when S3 upload fails', async () => {
    // Override the mock for this test to simulate failure
    mockS3Instance.upload.mockReturnValueOnce({
      promise: jest.fn().mockRejectedValue(new Error('S3 upload failed'))
    });

    await expect(s3Service.uploadJsonResult(mockJsonData)).rejects.toThrow('S3 upload failed');
  });

  // Corner Cases
  test('should handle empty JSON object', async () => {
    const emptyJson = {};
    await s3Service.uploadJsonResult(emptyJson);
    
    const uploadParams = mockS3Instance.upload.mock.calls[0][0];
    expect(uploadParams.Body).toBe('{}');
  });

  test('should handle complex nested JSON structures', async () => {
    const complexJson = {
      level1: {
        level2: {
          level3: [1, 2, { level4: 'deep' }]
        },
        array: [{ a: 1 }, { b: 2 }]
      },
      nullValue: null,
      undefinedValue: undefined
    };
    
    await s3Service.uploadJsonResult(complexJson);
    
    const uploadParams = mockS3Instance.upload.mock.calls[0][0];
    const parsedBody = JSON.parse(uploadParams.Body);
    
    // Note: undefined values are dropped during JSON stringification
    expect(parsedBody.level1.level2.level3[2].level4).toBe('deep');
    expect(parsedBody.nullValue).toBeNull();
    expect(parsedBody.undefinedValue).toBeUndefined();
  });
});
