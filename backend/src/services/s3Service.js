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
     * Upload a JSON result from OCR analysis to S3
     * @param {Object} jsonData - JSON object containing OCR analysis results
     * @param {string} documentId - Optional identifier to link JSON with original document
     * @returns {Promise<string>} - Resolves to the uploaded JSON file URL
     */
    async uploadJsonResult(jsonData, documentId = null) {
        // Create a unique filename with optional reference to original document
        const prefix = documentId ? `${documentId}-analysis-` : 'analysis-';
        const fileName = `${prefix}${uuidv4()}.json`;
        
        // Convert JSON object to string
        const jsonString = JSON.stringify(jsonData, null, 2);
        
        const params = {
            Bucket: this.bucketName,
            Key: `analysis/${fileName}`, // Store in 'analysis' folder for organization
            Body: jsonString,
            ContentType: 'application/json' // Set proper content type
        };

        try {
            const data = await this.s3.upload(params).promise();
            return data.Location;
        } catch (error) {
            console.error("S3 JSON Upload Error:", error);
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
