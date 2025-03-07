const { Invoice } = require('../models');

class AzureInvoiceMapper {
  /**
   * Maps Azure OCR result to Invoice model format
   * @param {Object} ocrResult - Raw Azure OCR result
   * @returns {Object} Invoice data ready for database
   */
  mapToInvoiceModel(ocrResult) {
    if (!ocrResult || !ocrResult.documents || !ocrResult.documents[0]) {
      throw new Error('Invalid OCR result format');
    }
    
    const document = ocrResult.documents[0];
    const fields = document.fields || {};
    
    // Extract and validate dates
    const invoiceDate = this.parseDate(fields.InvoiceDate);
    const dueDate = this.parseDate(fields.DueDate, true);
    
    // Extract purchase order ID (convert to number)
    const purchaseOrderId = this.parsePurchaseOrderId(fields.PurchaseOrder);
    
    // Extract monetary values
    const totalAmount = this.parseCurrency(fields.InvoiceTotal);
    const subtotalAmount = this.parseCurrency(fields.SubTotal) || totalAmount;
    const discountAmount = this.parseCurrency(fields.TotalDiscount) || 0;
    
    // Extract vendor/partner info
    const vendorName = this.getFieldContent(fields.VendorName);
    const partnerId = this.generatePartnerId(vendorName);
    
    // Extract payment terms
    const paymentTerms = this.getFieldContent(fields.PaymentTerm) || 'Net 30';
    
    // Extract line items
    const lineItems = this.extractLineItems(fields.Items);
    
    // Build invoice data object matching our model requirements
    return {
      invoice_date: invoiceDate,
      due_date: dueDate || this.calculateDueDate(invoiceDate, paymentTerms),
      purchase_order_id: purchaseOrderId,
      total_amount: totalAmount,
      subtotal_amount: subtotalAmount,
      discount_amount: discountAmount,
      payment_terms: paymentTerms,
      status: 'Pending', 
      partner_id: partnerId,
      
      // Store additional extracted data as JSON
      invoice_number: this.getFieldContent(fields.InvoiceId),
      customer_name: this.getFieldContent(fields.CustomerName),
      customer_address: this.getFieldContent(fields.CustomerAddress),
      vendor_name: vendorName,
      vendor_address: this.getFieldContent(fields.VendorAddress),
      tax_amount: this.parseCurrency(fields.TotalTax),
      line_items: lineItems
    };
  }
  
  /**
   * Parse date field from OCR result
   * @param {Object} field - Date field from OCR
   * @param {boolean} optional - Whether the field is optional
   * @returns {Date|null} Parsed date or null if optional and missing
   * @throws {Error} If date format is invalid and not optional
   */
  parseDate(field, optional = false) {
    const dateStr = this.getFieldContent(field);
    
    if (!dateStr && optional) {
      return null;
    }
    
    if (!dateStr) {
      return new Date(); // Default to current date if missing
    }
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
    }
    
    return date;
  }
  
  /**
   * Parse purchase order ID from OCR result
   * @param {Object} field - Purchase order field from OCR
   * @returns {number} Parsed purchase order ID or 0 if missing/invalid
   */
  parsePurchaseOrderId(field) {
    const poStr = this.getFieldContent(field);
    if (!poStr) return 0;
    
    // Extract numeric part only
    const numericValue = poStr.replace(/\D/g, '');
    if (!numericValue) return 0;
    
    const poNumber = parseInt(numericValue, 10);
    return isNaN(poNumber) ? 0 : poNumber;
  }
  
  /**
   * Parse currency field from OCR result
   * @param {Object} field - Currency field from OCR
   * @returns {number|null} Parsed amount or null if missing
   */
  parseCurrency(field) {
    const amountStr = this.getFieldContent(field);
    if (!amountStr) return null;
    
    // Remove currency symbols, commas, etc.
    const numericStr = amountStr.replace(/[^\d.-]/g, '');
    const amount = parseFloat(numericStr);
    
    return isNaN(amount) ? null : amount;
  }
  
  /**
   * Calculate due date based on invoice date and payment terms
   * @param {Date} invoiceDate - Invoice date
   * @param {string} paymentTerms - Payment terms string (e.g., "Net 30")
   * @returns {Date} Calculated due date
   */
  calculateDueDate(invoiceDate, paymentTerms) {
    const dueDate = new Date(invoiceDate);
    
    // Extract days from payment terms (default to 30 if not found)
    const termDays = parseInt((paymentTerms.match(/\d+/) || ['30'])[0], 10);
    dueDate.setDate(dueDate.getDate() + termDays);
    
    return dueDate;
  }
  
  /**
   * Generate partner ID from vendor name
   * @param {string} vendorName - Vendor name from OCR
   * @returns {string} Generated partner ID
   */
  generatePartnerId(vendorName) {
    if (!vendorName) return 'unknown-vendor';
    
    // Create a URL-friendly slug
    return vendorName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumerics with hyphens
      .replace(/--+/g, '-')       // Replace multiple hyphens with single
      .replace(/^-|-$/g, '')      // Remove leading/trailing hyphens
      .substring(0, 44);          // Truncate to fit partner_id field
  }
  
  /**
   * Extract line items from OCR result
   * @param {Object} itemsField - Items field from OCR
   * @returns {Array} Extracted line items
   */
  extractLineItems(itemsField) {
    if (!itemsField || !itemsField.valueArray) {
      return [];
    }
    
    return itemsField.valueArray.map(item => {
      const fields = item.valueObject || {};
      
      return {
        description: this.getFieldContent(fields.Description),
        quantity: this.parseNumeric(fields.Quantity),
        unit: this.getFieldContent(fields.Unit),
        unitPrice: this.parseCurrency(fields.UnitPrice),
        amount: this.parseCurrency(fields.Amount),
        productCode: this.getFieldContent(fields.ProductCode),
        taxRate: this.getFieldContent(fields.TaxRate) || this.getFieldContent(fields.Tax),
        date: this.getFieldContent(fields.Date)
      };
    });
  }
  
  /**
   * Parse numeric field from OCR result
   * @param {Object} field - Numeric field from OCR
   * @returns {number|null} Parsed number or null if missing/invalid
   */
  parseNumeric(field) {
    const numStr = this.getFieldContent(field);
    if (!numStr) return null;
    
    const num = parseFloat(numStr);
    return isNaN(num) ? null : num;
  }
  
  /**
   * Get content safely from OCR field
   * @param {Object} field - Field from OCR
   * @returns {string|null} Field content or null if missing
   */
  getFieldContent(field) {
    return field?.content || null;
  }
}

module.exports = { AzureInvoiceMapper };
