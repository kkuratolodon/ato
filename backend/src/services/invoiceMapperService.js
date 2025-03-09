'use strict';

class AzureInvoiceMapper {
  /**
   * Maps Azure OCR result to Invoice model format
   * @param {Object} ocrResult - Raw Azure OCR result
   * @param {string} partnerId - UUID of the user uploading the invoice
   * @returns {Object} Invoice and customer data ready for database
   */
  mapToInvoiceModel(ocrResult, partnerId) {
    if (!ocrResult || !ocrResult.documents || !ocrResult.documents[0]) {
      throw new Error('Invalid OCR result format');
    }
    
    if (!partnerId) {
      throw new Error('Partner ID is required');
    }
    
    const document = ocrResult.documents[0];
    const fields = document.fields || {};
    
    console.log("=== Processing OCR Result ===");
    console.log("Available fields:", Object.keys(fields).join(", "));
    
    // Extract and validate dates
    const invoiceDate = this.parseDate(fields.InvoiceDate);
    const dueDate = this.parseDate(fields.DueDate, true);
    console.log("Invoice Date:", invoiceDate);
    console.log("Due Date:", dueDate);
    
    // Extract invoice number (check multiple possible field names)
    const invoiceNumber = this.extractInvoiceNumber(fields);
    console.log("Invoice Number:", invoiceNumber);
    
    // Extract purchase order ID
    const purchaseOrderId = this.parsePurchaseOrderId(fields.PurchaseOrder);
    console.log("Purchase Order ID:", purchaseOrderId);
    
    // Extract monetary values
    const totalAmount = this.parseCurrency(fields.InvoiceTotal || fields.Total) || 0;
    const subtotalAmount = this.parseCurrency(fields.SubTotal) || totalAmount || 0;
    const discountAmount = this.parseCurrency(fields.TotalDiscount || fields.Discount) || 0;
    const taxAmount = this.parseCurrency(fields.TotalTax || fields.Tax) || 0;

    // Extract vendor info
    const vendorName = this.getFieldContent(fields.VendorName);
    const vendorAddress = this.extractVendorAddress(fields.VendorAddress);
    
    // Extract payment terms
    const paymentTerms = this.getFieldContent(fields.PaymentTerm);
    
    // Extract line items
    const lineItems = this.extractLineItems(fields.Items);
    
    // Extract customer data into a separate object
    const customerData = this.extractCustomerData(fields);
    
    // Build invoice data object matching our model requirements
    const invoiceData = {
      invoice_date: invoiceDate,
      invoice_number: invoiceNumber,
      due_date: dueDate || this.calculateDueDate(invoiceDate, paymentTerms),
      purchase_order_id: purchaseOrderId,
      total_amount: totalAmount,
      subtotal_amount: subtotalAmount,
      discount_amount: discountAmount,
      payment_terms: paymentTerms,
      status: 'Analyzed', 
      partner_id: partnerId,
      
      // Vendor data
      vendor_name: vendorName,
      vendor_address: vendorAddress,
      
      // Additional data
      tax_amount: taxAmount,
      line_items: lineItems
    };
    
    console.log("=== Mapped Invoice Data ===");
    console.log(JSON.stringify(invoiceData, null, 2));
    console.log("=== End of Processing ===");

    return {
      invoiceData,
      customerData
    };
  }
  
  /**
   * Extract invoice number from multiple possible fields
   * @param {Object} fields - OCR result fields
   * @returns {string} Extracted invoice number
   */
  extractInvoiceNumber(fields) {
    // Check multiple possible field names
    return this.getFieldContent(fields.InvoiceId) || 
           this.getFieldContent(fields.InvoiceNumber) || 
           this.getFieldContent(fields["Invoice number"]) ||
           this.getFieldContent(fields["Invoice #"]) || 
           this.getFieldContent(fields["Invoice No"]) || 
           this.getFieldContent(fields["Invoice No."]) ||
           '';
  }
  
  /**
   * Extract customer data from OCR fields into a structured object
   * @param {Object} fields - OCR fields
   * @returns {Object} Structured customer data
   */
  extractCustomerData(fields) {
    const addressData = this.extractCustomerAddress(fields.CustomerAddress || fields.BillingAddress);
    
    return {
      name: this.getFieldContent(fields.CustomerName) || this.getFieldContent(fields.BillingAddressRecipient),
      street_address: addressData.street_address,
      city: addressData.city,
      state: addressData.state ,
      postal_code: addressData.postal_code,
      house: addressData.house,
      recipient_name: this.getFieldContent(fields.CustomerAddressRecipient) || 
                     this.getFieldContent(fields.CustomerContactName) || 
                     this.getFieldContent(fields.CustomerName),
      tax_id: this.getFieldContent(fields.CustomerTaxId) || 
              this.getFieldContent(fields.VatNumber) ||
              this.getFieldContent(fields.TaxId)
    };
  }
  
  /**
   * Parse date field from OCR result
   * @param {Object} field - Date field from OCR
   * @param {boolean} optional - Whether the field is optional
   * @returns {Date|null} Parsed date or null if optional and missing
   */
  parseDate(field, optional = false) {
    const dateStr = this.getFieldContent(field);
    
    if (!dateStr) {
      if (optional) {
        return null;
      }
      console.warn('Date field missing, using current date as fallback');
      return new Date(); // Default to current date if missing
    }
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date format: ${dateStr}, using current date`);
      return new Date();
    }
    
    return date;
  }
  
  /**
   * Parse purchase order ID from OCR result
   * @param {Object} field - Purchase order field from OCR
   * @returns {number|string} Parsed purchase order ID or empty string if missing
   */
  /**
 * Parse purchase order ID from OCR result
 * @param {Object} field - Purchase order field from OCR
 * @returns {number|string} Parsed purchase order ID or empty string if missing
 */
parsePurchaseOrderId(field) {
  const poStr = this.getFieldContent(field);
  if (!poStr) return null;
  
  // Try to convert to number first (for backward compatibility with tests)
  const numValue = parseInt(poStr.replace(/[^0-9]/g, ''), 10);
  
  // If it's a valid number, return it, otherwise return 0
  if (!isNaN(numValue) && numValue !== Infinity) {
    return numValue;
  }
  
  return 0; // Default to 0 for non-numeric values
}
  
  /**
   * Parse currency field from OCR result
   * @param {Object} field - Currency field from OCR
   * @returns {number|null} Parsed amount or null if missing
   */
  parseCurrency(field) {
    // If field.value is directly a number
    if (field && field.value && typeof field.value === 'number') {
      console.log("konz")
      return field.value;
    }
    console.log("konz2")
    
    // If field has structured currency value with amount property
    if (field && field.value && typeof field.value.amount === 'number') {
      return field.value.amount;
    }
    
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
   * @param {string} paymentTerms - Payment terms string 
   * @returns {Date} Calculated due date
   */
  calculateDueDate(invoiceDate, paymentTerms) {
    const dueDate = new Date(invoiceDate);
    
    // Extract days from payment terms (default to 30 if not found)
    let termDays = 30;
    
    // Add null check for paymentTerms
    if (paymentTerms) {
      // Try to parse term days from different formats
      const netMatch = paymentTerms.match(/net\s+(\d+)/i);
      const daysMatch = paymentTerms.match(/(\d+)\s*days?/i);
      const numericMatch = paymentTerms.match(/^\s*(\d+)\s*$/);
      
      if (netMatch) {
        termDays = parseInt(netMatch[1], 10);
      } else if (daysMatch) {
        termDays = parseInt(daysMatch[1], 10);
      } else if (numericMatch) {
        termDays = parseInt(numericMatch[1], 10);
      }
    }
    
    if (isNaN(termDays) || termDays <= 0) {
      termDays = 30; // Fallback to 30 days
    }
    
    dueDate.setDate(dueDate.getDate() + termDays);
    return dueDate;
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
    if (itemsField.valueArray) {
      return itemsField.valueArray.map(item => {
        const fields = item.valueObject || {};
        
        return {
          description: this.getFieldContent(fields.Description) || this.getFieldContent(fields.ProductName),
          quantity: this.parseNumeric(fields.Quantity),
          unit: this.getFieldContent(fields.Unit),
          unitPrice: this.parseCurrency(fields.UnitPrice || fields.Price),
          amount: this.parseCurrency(fields.Amount || fields.LineTotal),
          productCode: this.getFieldContent(fields.ProductCode) || this.getFieldContent(fields.ItemCode),
          taxRate: this.getFieldContent(fields.TaxRate) || this.getFieldContent(fields.Tax),
          date: this.getFieldContent(fields.Date)
        };
      });
    }
    
    // Sometimes the items field itself has content but not in valueArray format
    const content = this.getFieldContent(itemsField);
    if (content) {
      return [{
        description: content,
        quantity: null,
        unitPrice: null,
        amount: null
      }];
    }
    
    return [];
  }

  /**
   * Extract customer address details from OCR result with improved parsing
   * @param {Object} addressField - Customer address field from OCR
   * @returns {Object} Extracted address components
   */
  extractCustomerAddress(addressField) {
    const addressObj = {
      street_address: null,
      city: null,
      state: null,
      postal_code: null,
      house: null
    };

    if (!addressField) {
      return addressObj;
    }

    // Handle structured address from OCR
    if (addressField.value) {
      const value = addressField.value;
      addressObj.street_address = value.streetAddress || value.road || value.street || null;
      addressObj.city = value.city || value.locality || null;
      addressObj.state = value.state || value.region || value.province || null;
      addressObj.postal_code = value.postalCode || value.zipCode || null;
      addressObj.house = value.houseNumber || value.house || value.building || null;
    }

    // Try to extract from content if structured fields are incomplete
    const content = this.getFieldContent(addressField);
    if (content) {
      const lines = content.split('\n');
      
      // If no street address yet, use first line
      if (!addressObj.street_address && lines.length > 0) {
        addressObj.street_address = lines[0].trim();
      }

      // Try various patterns for city/state/postal code
      if (!addressObj.city || !addressObj.state || !addressObj.postal_code) {
        // Pattern: City, STATE ZIPCODE
        const cityStateZipPattern1 = /([A-Za-z\s]+),\s*([A-Z]{2,})\s+(\d{5}(?:-\d{4})?)/i;
        // Pattern: City STATE ZIPCODE (no comma)
        const cityStateZipPattern2 = /([A-Za-z\s]+)\s+([A-Z]{2,})\s+(\d{5}(?:-\d{4})?)/i;
        // Pattern for international: City, Region PostCode
        const internationalPattern = /([A-Za-z\s]+),\s*([A-Za-z\s]+)\s+([A-Z0-9\s]{3,10})/i;
        
        // Look for the pattern in each line and the whole content
        let match = null;
        for (const line of [...lines, content]) {
          match = line.match(cityStateZipPattern1) || 
                 line.match(cityStateZipPattern2) ||
                 line.match(internationalPattern);
          if (match) break;
        }
        
        if (match) {
          if (!addressObj.city) addressObj.city = match[1].trim();
          if (!addressObj.state) addressObj.state = match[2].trim();
          if (!addressObj.postal_code) addressObj.postal_code = match[3].trim();
        }
      }
      
      // Try to extract house number if still missing
      if (!addressObj.house) {
        const streetLine = addressObj.street_address;
        const houseMatch = streetLine.match(/^(?:No\.\s*)?(\d+[A-Za-z]?)[,\s]+/i);
        
        addressObj.house = houseMatch[1];
      }
    }

    return addressObj;
  }
  
  /**
   * Extract vendor address with similar logic to customer address
   * @param {Object} addressField - Vendor address field
   * @returns {string|null} Formatted vendor address or null
   */
  extractVendorAddress(addressField) {
    // We extract but don't break down vendor address since we likely won't create Vendor records
    const addressContent = this.getFieldContent(addressField);
    return addressContent;
  }
  
  /**
   * Parse numeric field from OCR result
   * @param {Object} field - Numeric field from OCR
   * @returns {number|null} Parsed number or null if missing/invalid
   */
  parseNumeric(field) {
    // If field has direct numeric value
    if (field && field.value && typeof field.value === 'number') {
      return field.value;
    }
    
    const numStr = this.getFieldContent(field);
    if (!numStr) return null;
    
    // Remove any non-numeric characters except decimal point
    const cleaned = numStr.replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  
  /**
   * Get content safely from OCR field
   * @param {Object} field - Field from OCR
   * @returns {string|null} Field content or null if missing
   */
  getFieldContent(field) {
    if (!field) return null;
    
    // Some fields provide direct content
    if (typeof field.content === 'string') {
      return field.content.trim();
    }
    
    // Some fields provide value as string
    if (field.value && typeof field.value === 'string') {
      return field.value.trim();
    }
    
    // Some fields have text value inside a nested value object
    if (field.value && field.value.text) {
      return field.value.text.trim();
    }
    
    return null;
  }
  
  /**
   * Process OCR result and prepare data for persistence
   * @param {Object} ocrResult - Raw OCR result
   * @param {string} partnerId - Partner ID
   * @param {string} fileUrl - Optional URL to the stored invoice file
   * @returns {Object} Processed customer and invoice data
   */
  async processInvoiceData(ocrResult, partnerId, fileUrl = null) {
    const { customerData, invoiceData } = this.mapToInvoiceModel(ocrResult, partnerId);
    
    if (fileUrl) {
      invoiceData.file_url = fileUrl;
    }
    else {
      invoiceData.file_url = null;
    }
    return {
      customerData,
      invoiceData
    };
  }
}

module.exports = { AzureInvoiceMapper };