const { getMapper, partnerId } = require('./setupAzurePurchaseOrderMapper');
const { mockAzureOcrResult } = require('../../mocks/azure-ocr-result');

describe('PO Input Validation', () => {
    it('should throw error when OCR result is invalid', () => {
        const mapper = getMapper();
        expect(() => mapper.mapToPurchaseOrderModel(null, partnerId))
        .toThrow('Invalid OCR result format');
        
        expect(() => mapper.mapToPurchaseOrderModel({}, partnerId))
        .toThrow('Invalid OCR result format');
        
        expect(() => mapper.mapToPurchaseOrderModel({ documents: [] }, partnerId))
        .toThrow('Invalid OCR result format');
    });

    it('should throw error when partnerId is missing', () => {
        const mapper = getMapper();
        const ocrResult = mockAzureOcrResult();
        
        expect(() => mapper.mapToPurchaseOrderModel(ocrResult))
        .toThrow('Partner ID is required');
        
        expect(() => mapper.mapToPurchaseOrderModel(ocrResult, null))
        .toThrow('Partner ID is required');
        
        expect(() => mapper.mapToPurchaseOrderModel(ocrResult, ''))
        .toThrow('Partner ID is required');
    });
});