const fs = require('fs').promises;
const path = require('path');
const AzureDocumentAnalyzer = require('@services/analysis/azureDocumentAnalyzer');
const { AzureInvoiceMapper } = require('@services/invoiceMapperService/invoiceMapperService');

// Initialize services
const documentAnalyzer = new AzureDocumentAnalyzer();
const azureMapper = new AzureInvoiceMapper(); // We'll reuse the invoice mapper for now

// Define paths
const SAMPLE_DIR = path.join(__dirname, '../../sample_file/purchase_order');
const OUTPUT_DIR = path.join(__dirname, '../../sample_file_result/purchase_order');

/**
 * Process a single purchase order file
 * @param {string} filePath - Path to the purchase order PDF file
 */
async function processPurchaseOrder(filePath) {
    const filename = path.basename(filePath);
    const outputFilename = filename.replace('.pdf', '.json');
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    
    console.log(`Processing ${filename}...`);
    
    try {
        // Read file buffer
        const buffer = await fs.readFile(filePath);
        
        // Analyze document using Azure
        console.log(`  Analyzing ${filename} with Azure...`);
        const analysisResult = await documentAnalyzer.analyzeDocument(buffer);
        
        // Map analysis results to structured data
        // For now, we'll use the invoice mapper but this should be replaced
        // with a dedicated purchase order mapper in the future
        console.log(`  Mapping analysis results for ${filename}...`);
        const { invoiceData } = azureMapper.mapToInvoiceModel(analysisResult.data, 'sample-partner-id');
        
        // Add additional metadata
        const resultData = {
            metadata: {
                filename,
                processedAt: new Date().toISOString(),
                analysisType: 'purchase_order'
            },
            analysisResult: analysisResult,
            mappedData: invoiceData
        };
        
        // Create output directory if it doesn't exist
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        
        // Write results to file
        await fs.writeFile(
            outputPath, 
            JSON.stringify(resultData, null, 2)
        );
        
        console.log(`  ✅ Saved results to ${outputPath}`);
        
        return {
            filename,
            success: true,
            outputPath,
            error: null
        };
    } catch (error) {
        console.error(`  ❌ Error processing ${filename}:`, error);
        
        return {
            filename,
            success: false,
            outputPath: null,
            error: error.message
        };
    }
}

/**
 * Process all purchase order files in the sample directory
 */
async function processAllPurchaseOrders() {
    try {
        // Get all PDF files in the sample directory
        const files = await fs.readdir(SAMPLE_DIR);
        const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
        
        console.log(`Found ${pdfFiles.length} purchase order samples to process`);
        
        // Process each file
        const results = [];
        for (const file of pdfFiles) {
            const filePath = path.join(SAMPLE_DIR, file);
            const result = await processPurchaseOrder(filePath);
            results.push(result);
        }
        
        // Print summary
        const successful = results.filter(r => r.success).length;
        console.log('\nProcessing Summary:');
        console.log(`✅ Successfully processed ${successful} of ${results.length} purchase orders`);
        console.log(`❌ Failed to process ${results.length - successful} purchase orders`);
        
        if (results.length - successful > 0) {
            console.log('\nFailed files:');
            results.filter(r => !r.success).forEach(r => {
                console.log(`  - ${r.filename}: ${r.error}`);
            });
        }
    } catch (error) {
        console.error('Error processing purchase orders:', error);
    }
}

// Create a function to process a single file
async function processSingleFile(filename) {
    const filePath = path.join(SAMPLE_DIR, filename);
    console.log(`Processing single file: ${filename}`);
    
    try {
        // Check if file exists
        await fs.access(filePath);
        
        // Process the file
        const result = await processPurchaseOrder(filePath);
        
        if (result.success) {
            console.log(`\n✅ Successfully processed ${filename}`);
        } else {
            console.log(`\n❌ Failed to process ${filename}: ${result.error}`);
        }
    } catch (error) {
        console.error(`File not found: ${filename}`);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length > 0) {
    // Process a specific file if provided
    processSingleFile(args[0]);
} else {
    // Process all files if no specific file is provided
    processAllPurchaseOrders();
}