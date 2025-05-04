const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");
const Sentry = require("@instrument");
const dotenv = require("dotenv");

dotenv.config();

class AzureDocumentAnalyzer {
  constructor() {
    this.endpoint = process.env.AZURE_ENDPOINT;
    this.key = process.env.AZURE_KEY;
    this.modelId = process.env.AZURE_INVOICE_MODEL;
  }

  async analyzeDocument(documentSource) {
    if (!documentSource) {
      throw new Error("documentSource is required");
    }

    return Sentry.startSpan(
      {
        name: "analyzeDocument",
        attributes: {
          documentSource: typeof documentSource === "string" ? documentSource : "Buffer data",
        },
      },
      async (span) => {
        try {
          Sentry.captureMessage(`analyzeDocument() called with documentSource: ${typeof documentSource === 'string' ? documentSource : 'Buffer data'}`);

          Sentry.addBreadcrumb({
            category: "documentAnalysis",
            message: `Starting document analysis for: ${typeof documentSource === "string" ? documentSource : "Binary Buffer"}`,
            level: "info",
          });

          console.log("Processing document...");
          const client = new DocumentAnalysisClient(
            this.endpoint, 
            new AzureKeyCredential(this.key)
          );
          let poller;

          if (typeof documentSource === 'string') {
            poller = await client.beginAnalyzeDocument(this.modelId, documentSource);
          } else if (Buffer.isBuffer(documentSource)) {
            poller = await client.beginAnalyzeDocument(this.modelId, documentSource);
          } else {
            throw new Error("Invalid document source type");
          }

          Sentry.addBreadcrumb({
            category: "documentAnalysis",
            message: "Azure analysis started...",
            level: "info",
          });

          const azureResult = await poller.pollUntilDone();
          console.log("Analysis completed");

          Sentry.addBreadcrumb({
            category: "documentAnalysis",
            message: "Azure analysis completed successfully",
            level: "info",
          });

          Sentry.captureMessage("analyzeDocument() completed successfully");

          return {
            message: "Document processed successfully",
            data: azureResult,
          };
        } catch (error) {
          Sentry.addBreadcrumb({
            category: "documentAnalysis",
            message: `Error encountered: ${error.message}`,
            level: "error",
          });

          Sentry.captureException(error);
          
          if (error.message === 'Invalid document source type') {
            throw error;
          }
          if (error.statusCode === 503) {
            console.error("Service Unavailable:", error);
            throw new Error("Service is temporarily unavailable. Please try again later.");
          } else if (error.statusCode === 409) {
            console.error("Conflict Error:", error);
            throw new Error("Conflict error occurred. Please check the document and try again.");
          } else {
            console.error(error);
            throw new Error("Failed to process the document");
          }
        } finally {
          span.end(); 
        }
      }
    );
  }
}

module.exports = AzureDocumentAnalyzer;