const PurchaseOrderResponseFormatter = require('@services/purchaseOrder/purchaseOrderResponseFormatter');

describe('PurchaseOrderResponseFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new PurchaseOrderResponseFormatter();
  });

  test('should format purchase order response with all data provided', () => {
    // Positive case: Full data available
    const purchaseOrder = {
      po_number: 'PO-001',
      due_date: '2023-05-01',
      status: 'Processed',
      partner_id: 'partner-123',
      original_filename: 'test.pdf',
      file_size: 1024,
      file_url: 'https://example.com/test.pdf',
      payment_terms: 'Net 30',
      currency_code: 'USD',
      total_amount: 300,
      subtotal_amount: 280,
      discount_amount: 20,
      tax_amount: 40
    };

    const items = [
      { amount: 100, description: 'Item 1', quantity: 2, unit: 'pcs', unit_price: 50 },
      { amount: 200, description: 'Item 2', quantity: 4, unit: 'pcs', unit_price: 50 }
    ];

    const customer = {
      uuid: 'cust-123',
      name: 'Customer Company',
      recipient_name: 'John Doe',
      address: '123 Customer St',
      tax_id: 'TAX-CUST-123'
    };

    const vendor = {
      name: 'Vendor Company',
      address: '456 Vendor Ave',
      recipient_name: 'Jane Smith',
      tax_id: 'TAX-VEND-456'
    };

    const result = formatter.formatPurchaseOrderResponse(purchaseOrder, items, customer, vendor);

    expect(result).toEqual({
      data: {
        documents: [
          {
            header: {
              purchase_order_details: {
                purchase_order_id: 'PO-001',
                due_date: '2023-05-01',
                payment_terms: 'Net 30'
              },
              vendor_details: {
                name: 'Vendor Company',
                address: '456 Vendor Ave',
                contact_name: 'Jane Smith',
                tax_id: 'TAX-VEND-456'
              },
              customer_details: {
                id: 'cust-123',
                name: 'Customer Company',
                contact_name: 'John Doe',
                address: '123 Customer St',
                tax_id: 'TAX-CUST-123'
              },
              financial_details: {
                currency: 'USD',
                total_amount: 300,
                subtotal_amount: 280,
                discount_amount: 20,
                total_tax_amount: 40
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
      due_date: '2023-05-01',
      status: 'Processed',
      partner_id: 'partner-123',
      original_filename: 'test.pdf',
      file_size: 1024,
      file_url: 'https://example.com/test.pdf',
      currency_code: 'USD',
      total_amount: 0,
      subtotal_amount: 0,
      discount_amount: 0,
      tax_amount: 0
    };

    // Test with null items
    let result = formatter.formatPurchaseOrderResponse(purchaseOrder, null);
    expect(result.data.documents[0].items).toEqual([]);

    // Test with empty array
    result = formatter.formatPurchaseOrderResponse(purchaseOrder, []);
    expect(result.data.documents[0].items).toEqual([]);

    // Test with non-array
    result = formatter.formatPurchaseOrderResponse(purchaseOrder, "not an array");
    expect(result.data.documents[0].items).toEqual([]);
  });

  test('should handle missing vendor and customer data', () => {
    const purchaseOrder = {
      po_number: 'PO-001',
      due_date: '2023-05-01',
      status: 'Processed',
      partner_id: 'partner-123',
      original_filename: 'test.pdf',
      file_size: 1024,
      file_url: 'https://example.com/test.pdf',
      currency_code: 'USD',
      total_amount: 500,
      subtotal_amount: 450,
      discount_amount: 50,
      tax_amount: 100
    };

    const items = [
      { amount: 500, description: 'Item 1', quantity: 5, unit: 'pcs', unit_price: 100 }
    ];

    const result = formatter.formatPurchaseOrderResponse(purchaseOrder, items);
    
    expect(result.data.documents[0].header.vendor_details).toEqual({
      name: null,
      address: "",
      contact_name: null,
      tax_id: null
    });
    
    expect(result.data.documents[0].header.customer_details).toEqual({
      id: null,
      name: null,
      contact_name: null,
      address: "",
      tax_id: null
    });
  });

  test('should handle empty address fields in vendor and customer', () => {
    const purchaseOrder = {
      po_number: 'PO-001',
      due_date: '2023-05-01',
      status: 'Processed',
      partner_id: 'partner-123',
      original_filename: 'test.pdf',
      file_size: 1024,
      file_url: 'https://example.com/test.pdf',
      currency_code: 'USD',
      total_amount: 500,
      subtotal_amount: 450,
      discount_amount: 50,
      tax_amount: 100
    };

    const customer = {
      uuid: 'cust-123',
      name: 'Customer Company',
      recipient_name: 'John Doe',
      tax_id: 'TAX-CUST-123'
      // address is missing
    };

    const vendor = {
      name: 'Vendor Company',
      recipient_name: 'Jane Smith',
      tax_id: 'TAX-VEND-456'
      // address is missing
    };

    const result = formatter.formatPurchaseOrderResponse(purchaseOrder, [], customer, vendor);
    
    expect(result.data.documents[0].header.vendor_details.address).toBe("");
    expect(result.data.documents[0].header.customer_details.address).toBe("");
  });

  test('should handle when items parameter is omitted entirely', () => {
    const purchaseOrder = {
      po_number: 'PO-001',
      due_date: '2023-05-01',
      status: 'Processed',
      partner_id: 'partner-123',
      original_filename: 'test.pdf',
      file_size: 1024,
      file_url: 'https://example.com/test.pdf',
      payment_terms: 'Net 30'
    };

    // Call the function without providing the items parameter
    const result = formatter.formatPurchaseOrderResponse(purchaseOrder);

    // Check that items is an empty array
    expect(result.data.documents[0].items).toEqual([]);
    
    // Verify the rest of the structure is still correct
    expect(result.data.documents[0].header.purchase_order_details).toEqual({
      purchase_order_id: 'PO-001',
      due_date: '2023-05-01',
      payment_terms: 'Net 30'
    });
  });
});
