const { getMapper, partnerId } = require('./setupAzurePurchaseOrderMapper');
const { mockAzureOcrResult } = require('../../mocks/azure-ocr-result');

describe('Core PO Mapping Basic Functionality', () => {
  it('should map Azure OCR result to Purchase Order model format', () => {
    const mapper = getMapper();
    const ocrResult = mockAzureOcrResult();
    const { purchaseOrderData } = mapper.mapToPurchaseOrderModel(ocrResult, partnerId);

    expect(purchaseOrderData).toBeDefined();
    expect(purchaseOrderData.po_number).toBe("12345"); // Assuming mockAzureOcrResult provides this
    expect(purchaseOrderData.po_date).toBeDefined();
    expect(purchaseOrderData.total_amount).toBe(110);
    expect(purchaseOrderData.subtotal_amount).toBe(100);
    expect(purchaseOrderData.discount_amount).toBe(5);
    expect(purchaseOrderData.payment_terms).toBe('Null');
    expect(purchaseOrderData.status).toBe('Analyzed');
    expect(purchaseOrderData.partner_id).toBe(partnerId);
  });

  it('should handle missing fields with default values', () => {
    const mapper = getMapper();
    const partialOcrResult = {
      documents: [{
        fields: {
          PONumber: { content: 'PO-2023-001' },
          PODate: { content: '2023-05-15' },
          VendorName: { content: 'ABC Corp' },
          Total: { content: '$500.00' }
        }
      }]
    };

    const { purchaseOrderData } = mapper.mapToPurchaseOrderModel(partialOcrResult, "abc-corp-partner");

    expect(purchaseOrderData.po_date).toEqual(new Date('2023-05-15'));
    expect(purchaseOrderData.total_amount).toBe(500);
    expect(purchaseOrderData.subtotal_amount).toBe(500);
    expect(purchaseOrderData.po_number).toBe('PO-2023-001');
    expect(purchaseOrderData.payment_terms).toBeNull();
    expect(purchaseOrderData.status).toBe('Analyzed');
    expect(purchaseOrderData.partner_id).toBe("abc-corp-partner");
  });

  it('should handle document without fields property', () => {
    const mapper = getMapper();
    const ocrWithoutFields = { documents: [{}] };
    const { purchaseOrderData } = mapper.mapToPurchaseOrderModel(ocrWithoutFields, partnerId);
    
    expect(purchaseOrderData).toBeDefined();
    expect(purchaseOrderData.partner_id).toBe(partnerId);
  });
});