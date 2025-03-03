const AWS = require("aws-sdk");
const { v4: uuidv4 } = require('uuid');
const bucketName = process.env.AWS_BUCKET_NAME;

const s3 = new AWS.S3({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const generateFileKey = (userId) => {
    const timestamp = Date.now(); 
    return `${userId}-${timestamp}.pdf`;
};


/**
 * Upload a file to S3
 * @param {Buffer} fileBuffer - File content as a buffer
 * @param {string} userId - User ID of the file uploader
 * @returns {Promise} - Resolves to the uploaded file URL
 */
const uploadFile = async (fileBuffer, userId) => {
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

module.exports = { uploadFile };