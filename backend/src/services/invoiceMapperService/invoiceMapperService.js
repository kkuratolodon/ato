'use strict';
const DocumentStatus = require('@models/enums/DocumentStatus');
const FieldParser = require('./FieldParserService');
const EntityExtractor = require('./entityExtractorService');

class AzureInvoiceMapper {
  constructor() {
    this.fieldParser = new FieldParser();
    this.EntityExtractor = new EntityExtractor(this.fieldParser);
  }
  /**
   * Maps Azure OCR result to Invoice model format
   * @param {Object} ocrResult - Raw Azure OCR result
   * @param {string} partnerId - UUID of the user uploading the invoice
   * @returns {Object} Invoice and customer data ready for database
   */
  mapToInvoiceModel(ocrResult, partnerId) {
    if (!ocrResult?.documents?.[0]) {
      throw new Error('Invalid OCR result format');
    }

    if (!partnerId) {
      throw new Error('Partner ID is required');
    }


    const document = ocrResult.documents[0];
    const fields = document.fields || {};
    // Extract and validate dates
    const invoiceId = this.fieldParser.getFieldContent(fields.InvoiceId);
    const invoiceDate = this.fieldParser.parseDate(fields.InvoiceDate);
    const dueDate = this.fieldParser.parseDate(fields.DueDate, true);

    // Extract purchase order ID
    const purchaseOrderId = this.fieldParser.getFieldContent(fields.PurchaseOrder);
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

    const vendorData = this.EntityExtractor.extractVendorData(fields);

    // Build invoice data object matching our model requirements
    const invoiceData = {
      invoice_number: invoiceId, 
      invoice_date: invoiceDate,
      due_date: dueDate || this.fieldParser.calculateDueDate(invoiceDate, paymentTerms),
      purchase_order_id: purchaseOrderId,
      total_amount: totalAmountAmount,
      subtotal_amount: subtotalAmountAmount,
      discount_amount: discountAmountAmount,
      payment_terms: paymentTerms,
      status: DocumentStatus.ANALYZED,
      partner_id: partnerId,

      // Additional data
      tax_amount: taxAmountAmount,
      currency_symbol: currency.currencySymbol,
      currency_code: currency.currencyCode
    };

    return {
      invoiceData,
      customerData,
      vendorData,
      itemsData
    };
  }
}

module.exports = { AzureInvoiceMapper };