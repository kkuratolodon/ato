const AWS = require("aws-sdk");
const s3Service = require("../src/services/s3Service"); // Adjust the path based on your structure

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
        const key = "test.pdf";

        const result = await s3Service.uploadFile(fileContent, key);

        expect(s3.upload).toHaveBeenCalledWith({
            Bucket: bucketName,
            Key: key,
            Body: fileContent,
        });

        expect(result).toEqual({ Location: DUMMY_LOCATION });
    });

    test("Upload a file to S3 failed (empty file name)", async () => {
        const fileContent = Buffer.from("test file content");
        const key = "";

        await expect(s3Service.uploadFile(fileContent, key)).rejects.toThrow("File name is required");
    });

    test("Upload a file to s3 failed (duplicate file name)", async () => {
        const fileContent = Buffer.from("test file content");
        const key = "test.pdf";

        s3.upload.mockRejectedValue(new Error("File already exists"));

        await expect(s3Service.uploadFile(fileContent, key)).rejects.toThrow("File already exists");
    }); 
});
