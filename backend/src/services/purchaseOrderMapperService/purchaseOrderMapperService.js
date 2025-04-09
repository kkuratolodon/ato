'use strict';
const FieldParser = require('../invoiceMapperService/FieldParserService');
const EntityExtractor = require('../invoiceMapperService/entityExtractorService');

class AzurePurchaseOrderMapper {
  constructor() {
    this.fieldParser = new FieldParser();
    this.EntityExtractor = new EntityExtractor(this.fieldParser);
  }
  /**
   * Maps Azure OCR result to PurchaseOrder model format
   * @param {Object} ocrResult - Raw Azure OCR result
   * @param {string} partnerId - UUID of the user uploading the purchase order
   * @returns {Object} PurchaseOrder and customer data ready for database
   */
  mapToPurchaseOrderModel(ocrResult, partnerId) {
    if (!ocrResult?.documents?.[0]) {
      throw new Error('Invalid OCR result format');
    }

    if (!partnerId) {
      throw new Error('Partner ID is required');
    }

    const document = ocrResult.documents[0];
    const fields = document.fields || {};
    
    // Extract and validate dates
    const poNumber = this.fieldParser.getFieldContent(fields.PurchaseOrder || fields.PONumber);
    const poDate = this.fieldParser.parseDate(fields.InvoiceDate || fields.PODate);

    // Extract monetary values
    const totalAmount = this.fieldParser.parseCurrency(fields.InvoiceTotal || fields.Total);
    const subtotalAmount = this.fieldParser.parseCurrency(fields.SubTotal) || totalAmount;
    const discountAmount = this.fieldParser.parseCurrency(fields.TotalDiscount || fields.Discount);
    const taxAmount = this.fieldParser.parseCurrency(fields.TotalTax || fields.Tax);

    const totalAmountAmount = totalAmount.amount;
    const subtotalAmountAmount = subtotalAmount.amount || totalAmountAmount;
    const discountAmountAmount = discountAmount.amount;
    const taxAmountAmount = taxAmount.amount;

    const totalAmountCurrency = totalAmount.currency;
    const subtotalAmountCurrency = subtotalAmount.currency || totalAmountCurrency;
    const discountAmountCurrency = discountAmount.currency;
    const taxAmountCurrency = taxAmount.currency;

    const currency = totalAmountCurrency || subtotalAmountCurrency || discountAmountCurrency || taxAmountCurrency || { currencySymbol: null, currencyCode: null };

    // Extract payment terms
    const paymentTerms = this.fieldParser.getFieldContent(fields.PaymentTerm);

    // Extract line items
    const itemsData = this.EntityExtractor.extractLineItems(fields.Items);
    
    // Extract customer data into a separate object
    const customerData = this.EntityExtractor.extractCustomerData(fields);

    // Extract vendor data
    const vendorData = this.EntityExtractor.extractVendorData(fields);

    // Build purchase order data object matching our model requirements
    const purchaseOrderData = {
      po_number: poNumber, 
      po_date: poDate,
      due_date: null,
      total_amount: totalAmountAmount,
      subtotal_amount: subtotalAmountAmount,
      discount_amount: discountAmountAmount,
      payment_terms: paymentTerms,
      status: 'Analyzed',
      partner_id: partnerId,

      // Additional data
      tax_amount: taxAmountAmount,
      currency_symbol: currency.currencySymbol,
      currency_code: currency.currencyCode
    };

    console.log('Mapped Purchase Order Data:', purchaseOrderData);
    console.log('Mapped Customer Data:', customerData);
    console.log('Mapped Vendor Data:', vendorData);
    console.log('Mapped Items Data:', itemsData);

    return {
      purchaseOrderData,
      customerData,
      vendorData,
      itemsData
    };
  }
}

module.exports = { AzurePurchaseOrderMapper };