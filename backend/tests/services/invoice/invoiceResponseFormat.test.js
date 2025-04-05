const InvoiceResponseFormatter = require('../../../src/services/invoice/invoiceResponseFormatter');

describe('InvoiceResponseFormatter', () => {
    let formatter;

    beforeEach(() => {
        formatter = new InvoiceResponseFormatter();
    });

    describe('formatInvoiceResponse', () => {
        // Positive case: Full data available
        test('should format invoice data correctly with all data provided', () => {
            const invoice = {
                invoice_number: 'INV-001',
                purchase_order_id: 'PO-001',
                invoice_date: '2023-05-01',
                due_date: '2023-05-31',
                payment_terms: 'Net 30',
                currency_symbol: '$',
                currency_code: 'USD',
                total_amount: 1000,
                subtotal_amount: 900,
                discount_amount: 50,
                tax_amount: 150
            };

            const items = [
                {
                    amount: 500,
                    description: 'Item 1',
                    quantity: 5,
                    unit: 'pcs',
                    unit_price: 100
                },
                {
                    amount: 400,
                    description: 'Item 2',
                    quantity: 2,
                    unit: 'box',
                    unit_price: 200
                }
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

            const expectedResponse = {
                data: {
                    documents: [
                        {
                            header: {
                                invoice_details: {
                                    invoice_number: 'INV-001',
                                    purchase_order_id: 'PO-001',
                                    invoice_date: '2023-05-01',
                                    due_date: '2023-05-31',
                                    payment_terms: 'Net 30'
                                },
                                vendor_details: {
                                    name: 'Vendor Company',
                                    address: '456 Vendor Ave',
                                    recipient_name: 'Jane Smith',
                                    tax_id: 'TAX-VEND-456'
                                },
                                customer_details: {
                                    id: 'cust-123',
                                    name: 'Customer Company',
                                    recipient_name: 'John Doe',
                                    address: '123 Customer St',
                                    tax_id: 'TAX-CUST-123'
                                },
                                financial_details: {
                                    currency: {
                                        currency_symbol: '$',
                                        currency_code: 'USD'
                                    },
                                    total_amount: 1000,
                                    subtotal_amount: 900,
                                    discount_amount: 50,
                                    total_tax_amount: 150
                                }
                            },
                            items: [
                                {
                                    amount: 500,
                                    description: 'Item 1',
                                    quantity: 5,
                                    unit: 'pcs',
                                    unit_price: 100
                                },
                                {
                                    amount: 400,
                                    description: 'Item 2',
                                    quantity: 2,
                                    unit: 'box',
                                    unit_price: 200
                                }
                            ]
                        }
                    ]
                }
            };

            const result = formatter.formatInvoiceResponse(invoice, items, customer, vendor);
            expect(result).toEqual(expectedResponse);
        });

        // Negative case: Missing vendor and customer
        test('should handle missing vendor and customer data', () => {
            const invoice = {
                invoice_number: 'INV-001',
                purchase_order_id: 'PO-001',
                invoice_date: '2023-05-01',
                due_date: '2023-05-31',
                payment_terms: 'Net 30',
                currency_symbol: '$',
                currency_code: 'USD',
                total_amount: 1000,
                subtotal_amount: 900,
                discount_amount: 50,
                tax_amount: 150
            };

            const items = [
                {
                    amount: 500,
                    description: 'Item 1',
                    quantity: 5,
                    unit: 'pcs',
                    unit_price: 100
                }
            ];

            const result = formatter.formatInvoiceResponse(invoice, items, null, null);
            
            expect(result.data.documents[0].header.vendor_details).toEqual({
                name: null,
                address: "",
                recipient_name: null,
                tax_id: null
            });
            
            expect(result.data.documents[0].header.customer_details).toEqual({
                id: null,
                name: null,
                recipient_name: null,
                address: "",
                tax_id: null
            });
        });

        // Negative case: Missing items array
        test('should handle missing or invalid items data', () => {
            const invoice = {
                invoice_number: 'INV-001',
                purchase_order_id: 'PO-001',
                invoice_date: '2023-05-01',
                due_date: '2023-05-31',
                payment_terms: 'Net 30',
                currency_symbol: '$',
                currency_code: 'USD',
                total_amount: 1000,
                subtotal_amount: 900,
                discount_amount: 50,
                tax_amount: 150
            };

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

            // Test with null items
            let result = formatter.formatInvoiceResponse(invoice, null, customer, vendor);
            expect(result.data.documents[0].items).toEqual([]);

            // Test with non-array items
            result = formatter.formatInvoiceResponse(invoice, "not an array", customer, vendor);
            expect(result.data.documents[0].items).toEqual([]);
        });

        // Edge case: Empty address fields
        test('should handle empty address fields in vendor and customer', () => {
            const invoice = {
                invoice_number: 'INV-001',
                purchase_order_id: 'PO-001',
                invoice_date: '2023-05-01',
                due_date: '2023-05-31',
                payment_terms: 'Net 30',
                currency_symbol: '$',
                currency_code: 'USD',
                total_amount: 1000,
                subtotal_amount: 900,
                discount_amount: 50,
                tax_amount: 150
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

            const result = formatter.formatInvoiceResponse(invoice, [], customer, vendor);
            
            expect(result.data.documents[0].header.vendor_details.address).toBe("");
            expect(result.data.documents[0].header.customer_details.address).toBe("");
        });
    });
});