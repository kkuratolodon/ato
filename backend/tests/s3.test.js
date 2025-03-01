const AWS = require("aws-sdk");
const s3Service = require("../src/services/s3.service"); // Adjust the path based on your structure

const DUMMY_LOCATION = "https://s3-bucket-url.com/file.pdf";

// Mock S3
jest.mock("aws-sdk", () => {
    const mockS3 = {
        upload: jest.fn().mockReturnThis(),
        promise: jest.fn().mockResolvedValue({ Location: DUMMY_LOCATION }),
        listObjectsV2: jest.fn().mockReturnThis(),
        deleteObject: jest.fn().mockReturnThis(),
    };

    return {
        S3: jest.fn(() => mockS3),
    };
});

describe("S3 Service", () => {
    let s3;
    const bucketName = process.env.AWS_BUCKET_NAME;
    
    beforeEach(() => {
        s3 = new AWS.S3();
    });

    test("Upload a file to S3 success", async () => {
        const fileContent = Buffer.from("test file content");   
        const userId = "123"; 
        const result = await s3Service.uploadFile(fileContent, userId);

        expect(s3.upload).toHaveBeenCalledWith({
            Bucket: bucketName,
            Key: expect.stringMatching(/^123-.*\.pdf$/),
            Body: fileContent,
        });

        expect(result).toEqual(DUMMY_LOCATION);
    });

    test("Upload a file to S3 failure", async () => {
        const fileContent = Buffer.from("test file content");    
        const key = "1234-456.pdf";

        s3.upload.mockImplementationOnce(() => {
            throw new Error("Upload failed");
        });

        await expect(s3Service.uploadFile(fileContent, key)).rejects.toThrow("Upload failed");
    });

    test("Upload a file to S3 empty user ID", async () => {
        const fileContent = Buffer.from("test file content");    
        const key = "";

        await expect(s3Service.uploadFile(fileContent, key)).rejects.toThrow("Invalid user ID");
    }); 
});
