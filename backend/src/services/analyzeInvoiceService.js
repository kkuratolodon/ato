const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");

const endpoint = process.env.AZURE_ENDPOINT;
const key = process.env.AZURE_KEY;
const modelId = process.env.AZURE_INVOICE_MODEL;

const analyzeInvoice = async (documentUrl) => {
    if (!documentUrl) {
        throw new Error("documentUrl is required");
    }

    try {
        console.log("PDF uploaded successfully, processing PDF...");

        const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
        const poller = await client.beginAnalyzeDocument(modelId, documentUrl);
        const result = await poller.pollUntilDone();

        console.log("Analysis results:", JSON.stringify(result, null, 2));
        return { message: "PDF processed successfully", data: result };
    } catch (error) {
        if (error.statusCode === 503) {
            console.error("Service Unavailable:", error);
            throw new Error("Service is temporarily unavailable. Please try again later.");
        } else if (error.statusCode === 409) {
            console.error("Conflict Error:", error);
            throw new Error("Conflict error occurred. Please check the document and try again.");
        } else {
            console.error("Error:", error);
            throw new Error("Failed to process the document");
        }
    }
};

module.exports = { analyzeInvoice };