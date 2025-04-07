const AWS = require("aws-sdk");
const { v4: uuidv4 } = require('uuid');

class s3Service {
    constructor() {
        this.s3 = new AWS.S3({
            region: process.env.AWS_REGION,
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        });
        this.bucketName = process.env.AWS_BUCKET_NAME;
    }

    /**
     * Upload a file to S3
     * @param {Buffer} fileBuffer - File content as a buffer 
     * @returns {Promise<string>} - Resolves to the uploaded file URL
     */
    async uploadFile(fileBuffer) {
        const fileName = `${uuidv4()}.pdf`;
        const params = {
            Bucket: this.bucketName,
            Key: fileName,
            Body: fileBuffer,        
        };

        try {
            const data = await this.s3.upload(params).promise();
            return data.Location;
        } catch (error) {
            console.error("S3 Upload Error:", error);
            throw error;
        }
    }

    /**
   * Delete a file from S3
   * @param {string} fileKey - The key (path) of the file to delete
   * @returns {Promise<object>} - Object with success status and message or error
   */
    async deleteFile(fileKey) {
        const params = {
            Bucket: this.bucketName,
            Key: fileKey
        };

        try {
        await this.s3.deleteObject(params).promise();
        return {
            success: true,
            message: `Successfully deleted file: ${fileKey} from bucket: ${this.bucketName}`
        };
        } catch (error) {
        console.error(`S3 Delete Error: ${error}`);
        return {
            success: false,
            error: error.message,
            code: error.code || 'UnknownError'
        };
        }
    }
}

module.exports = new s3Service();