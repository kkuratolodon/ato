const PurchaseOrderResponseFormatter = require('../../../src/services/purchaseOrder/purchaseOrderResponseFormatter');

describe('PurchaseOrderResponseFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new PurchaseOrderResponseFormatter();
  });

  test('should format purchase order response with all data provided', () => {
    const purchaseOrder = {
      po_number: 'PO-001',
      po_date: '2023-05-01',
      status: 'Processed',
      partner_id: 'partner-123',
      original_filename: 'test.pdf',
      file_size: 1024,
      file_url: 'https://example.com/test.pdf'
    };

    const items = [
      { amount: 100, description: 'Item 1', quantity: 2, unit: 'pcs', unit_price: 50 },
      { amount: 200, description: 'Item 2', quantity: 4, unit: 'pcs', unit_price: 50 }
    ];

    const result = formatter.formatPurchaseOrderResponse(purchaseOrder, items);

    expect(result).toEqual({
      data: {
        documents: [
          {
            header: {
              purchase_order_details: {
                po_number: 'PO-001',
                po_date: '2023-05-01',
                status: 'Processed'
              },
              partner_details: { id: 'partner-123' },
              file_details: {
                original_filename: 'test.pdf',
                file_size: 1024,
                file_url: 'https://example.com/test.pdf'
              }
            },
            items: [
              { amount: 100, description: 'Item 1', quantity: 2, unit: 'pcs', unit_price: 50 },
              { amount: 200, description: 'Item 2', quantity: 4, unit: 'pcs', unit_price: 50 }
            ]
          }
        ]
      }
    });
  });

  test('should handle missing or invalid items', () => {
    const purchaseOrder = {
      po_number: 'PO-001',
      po_date: '2023-05-01',
      status: 'Processed',
      partner_id: 'partner-123',
      original_filename: 'test.pdf',
      file_size: 1024,
      file_url: 'https://example.com/test.pdf'
    };

    const result = formatter.formatPurchaseOrderResponse(purchaseOrder, null);

    expect(result.data.documents[0].items).toEqual([]);
  });

  test('should handle when items parameter is omitted entirely', () => {
    const purchaseOrder = {
      po_number: 'PO-001',
      po_date: '2023-05-01',
      status: 'Processed',
      partner_id: 'partner-123',
      original_filename: 'test.pdf',
      file_size: 1024,
      file_url: 'https://example.com/test.pdf'
    };

    // Call the function without providing the items parameter
    const result = formatter.formatPurchaseOrderResponse(purchaseOrder);

    // Check that items is an empty array
    expect(result.data.documents[0].items).toEqual([]);
    
    // Verify the rest of the structure is still correct
    expect(result.data.documents[0].header).toEqual({
      purchase_order_details: {
        po_number: 'PO-001',
        po_date: '2023-05-01',
        status: 'Processed'
      },
      partner_details: { id: 'partner-123' },
      file_details: {
        original_filename: 'test.pdf',
        file_size: 1024,
        file_url: 'https://example.com/test.pdf'
      }
    });
  });
  
});
