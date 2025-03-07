exports.mockAzureOcrResult = () => ({
  documents: [{
    docType: 'invoice',
    fields: {
      InvoiceId: { content: 'INV-2023-001', confidence: 0.99 },
      InvoiceDate: { content: '2023-05-15', confidence: 0.99 },
      DueDate: { content: '2023-06-15', confidence: 0.98 },
      PurchaseOrder: { content: '12345', confidence: 0.97 },
      VendorName: { content: 'CONTOSO LTD.', confidence: 0.99 },
      VendorAddress: { content: '123 456th St, New York, NY 10001', confidence: 0.95 },
      CustomerName: { content: 'Microsoft Corp', confidence: 0.98 },
      CustomerAddress: { content: '123 Other St, Redmond WA, 98052', confidence: 0.96 },
      SubTotal: { content: '$100.00', confidence: 0.99 },
      TotalDiscount: { content: '$5.00', confidence: 0.98 },
      TotalTax: { content: '$10.00', confidence: 0.99 },
      InvoiceTotal: { content: '$110.00', confidence: 0.99 },
      AmountDue: { content: '$610.00', confidence: 0.98 },
      PaymentTerm: { content: 'Null', confidence: 0.95 },
      Items: {
        valueArray: [
          {
            valueObject: {
              Description: { content: 'Consulting Services', confidence: 0.95 },
              Quantity: { content: '2', confidence: 0.99 },
              Unit: { content: 'hours', confidence: 0.98 },
              UnitPrice: { content: '$30.00', confidence: 0.99 },
              Amount: { content: '$60.00', confidence: 0.99 },
              Tax: { content: '10%', confidence: 0.98 },
              ProductCode: { content: 'A123', confidence: 0.97 },
              Date: { content: '3/4/2021', confidence: 0.96 }
            },
            confidence: 0.97
          }
        ],
        confidence: 0.98
      }
    }
  }]
});
