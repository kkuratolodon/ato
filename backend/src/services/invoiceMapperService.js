'use strict';
const FieldParser = require('./invoiceMapperService/FieldParserService');
class AzureInvoiceMapper {
  constructor() {
    this.fieldParser = new FieldParser();
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
    const itemsData = this.extractLineItems(fields.Items);
    
    // Extract customer data into a separate object
    const customerData = this.extractCustomerData(fields);

    const vendorData = this.extractVendorData(fields);

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
      status: 'Analyzed',
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

  /**
   * Extract invoice number from multiple possible fields
   * @param {Object} fields - OCR result fields
   * @returns {string} Extracted invoice number
   */
  extractInvoiceNumber(fields) {
    // Check if fields is null or undefined
    if (!fields) return '';
    
    // Check multiple possible field names
    return this.fieldParser.getFieldContent(fields.InvoiceId) ||
      this.fieldParser.getFieldContent(fields.InvoiceNumber) ||
      this.fieldParser.getFieldContent(fields["Invoice number"]) ||
      this.fieldParser.getFieldContent(fields["Invoice #"]) ||
      this.fieldParser.getFieldContent(fields["Invoice No"]) ||
      this.fieldParser.getFieldContent(fields["Invoice No."]) ||
      '';
  }

  /**
   * Extract customer data from OCR fields into a structured object
   * @param {Object} fields - OCR fields
   * @returns {Object} Structured customer data
   */
  extractCustomerData(fields) {
    const addressData = this.fieldParser.getFieldContent(fields.CustomerAddress || fields.BillingAddress || fields.ShippingAddress);
    return {
      name: this.fieldParser.getFieldContent(fields.CustomerName) || this.fieldParser.getFieldContent(fields.BillingAddressRecipient),
      address: addressData, 
      recipient_name: this.fieldParser.getFieldContent(fields.CustomerAddressRecipient) ||
        this.fieldParser.getFieldContent(fields.CustomerName),
      tax_id: this.fieldParser.getFieldContent(fields.CustomerTaxId) ||
        this.fieldParser.getFieldContent(fields.VatNumber) ||
        this.fieldParser.getFieldContent(fields.TaxId)
    };
  }
  /**
 * Extract vendor data from OCR fields into a structured object
 * @param {Object} fields - OCR fields
 * @returns {Object} Structured vendor data
 */
  extractVendorData(fields) {
    const addressData = this.fieldParser.getFieldContent(fields.VendorAddress);

    return {
      name: this.fieldParser.getFieldContent(fields.VendorName),
      address: addressData,
      recipient_name: this.fieldParser.getFieldContent(fields.VendorAddressRecipient) ||
        this.fieldParser.getFieldContent(fields.VendorName),
      tax_id: this.fieldParser.getFieldContent(fields.VendorTaxId) ||
        this.fieldParser.getFieldContent(fields.VendorVatNumber) ||
        this.fieldParser.getFieldContent(fields.SupplierTaxId)
    };
  }


  /**
   * Extract line items from OCR result with improved handling
   * @param {Object} itemsField - Items field from OCR
   * @returns {Array} Extracted line items
   */
  extractLineItems(itemsField) {
    if (!itemsField) {
      return [];
    }

    // Handle array format
    if (itemsField.values) {
      return itemsField.values.map(item => {
        const fields = item.properties || {};
        return {
          description: this.fieldParser.getFieldContent(fields.Description) || this.fieldParser.getFieldContent(fields.ProductCode),
          quantity: this.fieldParser.parseNumeric(fields.Quantity),
          unit: this.fieldParser.getFieldContent(fields.Unit),
          unitPrice: this.fieldParser.parseCurrency(fields.UnitPrice).amount,
          amount: this.fieldParser.parseCurrency(fields.Amount).amount,
        };
      });
    }

    // Sometimes the items field itself has content but not in valueArray format
    const content = this.fieldParser.getFieldContent(itemsField);
    if (content) {
      return [{
        description: content,
        quantity: null,
        unit: null,
        unitPrice: null,
        amount: null
      }];
    }

    return [];
  }


  /**
   * Process OCR result and prepare data for persistence
   * @param {Object} ocrResult - Raw OCR result
   * @param {string} partnerId - Partner ID
   * @param {string} fileUrl - Optional URL to the stored invoice file
   * @returns {Object} Processed customer and invoice data
   */
  async processInvoiceData(ocrResult, partnerId, fileUrl = null) {
    const { customerData, invoiceData, vendorData } = this.mapToInvoiceModel(ocrResult, partnerId);

    if (fileUrl) {
      invoiceData.file_url = fileUrl;
    }
    else {
      invoiceData.file_url = null;
    }
    return {
      customerData,
      invoiceData,
      vendorData
    };
  }
}

module.exports = { AzureInvoiceMapper };