const AWS = require("aws-sdk");
const s3Service = require("../../src/services/s3Service"); 

const DUMMY_LOCATION = "https://s3-bucket-url.com/file.pdf";

jest.mock("aws-sdk", () => {
    const mockS3 = {
        upload: jest.fn().mockReturnThis(),
        promise: jest.fn().mockResolvedValue({ Location: DUMMY_LOCATION }),
        listObjectsV2: jest.fn().mockImplementation(() => ({
            promise: jest.fn().mockResolvedValue({
                Contents: [{ Key: "test-file.pdf" }] 
            }),
        })),
        deleteObject: jest.fn().mockImplementation(() => ({
            promise: jest.fn().mockResolvedValue({}),
        })),
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
        const result = await s3Service.uploadFile(fileContent);
        expect(s3.upload).toHaveBeenCalledWith({
            Bucket: bucketName,
            Key: expect.any(String),
            Body: fileContent,
        });
        expect(result).toEqual(DUMMY_LOCATION);
    });
    test("Upload a file to S3 failure", async () => {
        const fileContent = Buffer.from("test file content");            
        s3.upload.mockImplementationOnce(() => {
            throw new Error("Upload failed");
        });

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
        s3.deleteObject.mockImplementationOnce(() => {
            throw new Error("Delete failed");
        });

        const response = await s3Service.deleteFile(fileKey);
        expect(s3.deleteObject).toHaveBeenCalledWith({
            Bucket: bucketName,
            Key: fileKey,
        });
        expect(response.success).toBe(false);
        expect(response.error).toBe("Delete failed");
    });
});