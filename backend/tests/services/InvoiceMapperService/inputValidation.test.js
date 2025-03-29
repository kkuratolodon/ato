const { getMapper, partnerId } = require('./setupAzureInvoiceMapper');
const { mockAzureOcrResult } = require('../../mocks/azure-ocr-result');

describe('Input Validation', () => {
    it('should throw error when OCR result is invalid', () => {
        const mapper = getMapper();
        expect(() => mapper.mapToInvoiceModel(null, partnerId))
        .toThrow('Invalid OCR result format');
        
        expect(() => mapper.mapToInvoiceModel({}, partnerId))
        .toThrow('Invalid OCR result format');
        
        expect(() => mapper.mapToInvoiceModel({ documents: [] }, partnerId))
        .toThrow('Invalid OCR result format');
    });

    it('should throw error when partnerId is missing', () => {
        const mapper = getMapper();
        const ocrResult = mockAzureOcrResult();
        
        expect(() => mapper.mapToInvoiceModel(ocrResult))
        .toThrow('Partner ID is required');
        
        expect(() => mapper.mapToInvoiceModel(ocrResult, null))
        .toThrow('Partner ID is required');
        
        expect(() => mapper.mapToInvoiceModel(ocrResult, ''))
        .toThrow('Partner ID is required');
    });
});