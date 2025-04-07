const AWS = require("aws-sdk");
const { v4: uuidv4 } = require('uuid');
const bucketName = process.env.AWS_BUCKET_NAME;

const s3 = new AWS.S3({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});


/**
 * Upload a file to S3
 * @param {Buffer} fileBuffer - File content as a buffer 
 * @returns {Promise} - Resolves to the uploaded file URL
 */
const uploadFile = async (fileBuffer) => {
    const fileName = `${uuidv4()}.pdf`;
    const params = {
        Bucket: bucketName,
        Key: fileName,
        Body: fileBuffer,        
    };

    try {
        const data = await s3.upload(params).promise();
        const fileURL = data.Location; 
        return fileURL; 
    } catch (error) {
        console.error("S3 Upload Error:", error);
        throw error;
    }
};

/**
 * Upload a JSON result from OCR analysis to S3
 * @param {Object} jsonData - JSON object containing OCR analysis results
 * @param {string} documentId - Optional identifier to link JSON with original document
 * @returns {Promise} - Resolves to the uploaded JSON file URL
 */
const uploadJsonResult = async (jsonData, documentId = null) => {
    // Create a unique filename with optional reference to original document
    const prefix = documentId ? `${documentId}-analysis-` : 'analysis-';
    const fileName = `${prefix}${uuidv4()}.json`;
    
    // Convert JSON object to string
    const jsonString = JSON.stringify(jsonData, null, 2);
    
    const params = {
        Bucket: bucketName,
        Key: `analysis/${fileName}`, // Store in 'analysis' folder for organization
        Body: jsonString,
        ContentType: 'application/json' // Set proper content type
    };

    try {
        const data = await s3.upload(params).promise();
        const jsonURL = data.Location;
        return jsonURL;
    } catch (error) {
        console.error("S3 JSON Upload Error:", error);
        throw error;
    }
};

module.exports = { uploadFile, uploadJsonResult };