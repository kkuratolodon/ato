const https = require("https");
const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");
const dotenv = require('dotenv');

dotenv.config();

const endpoint = process.env.AZURE_ENDPOINT;
const key = process.env.AZURE_KEY;
const modelId = process.env.AZURE_MODEL_ID;

const isValidPdfUrl = (documentUrl) => {
    // TODO
};

const analyzeInvoice = async (documentUrl) => {
    // TODO
};

module.exports = { analyzeInvoice, isValidPdfUrl };