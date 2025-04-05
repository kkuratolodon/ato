'use strict';

class EntityExtractor {
    constructor(fieldParser) {
        this.fieldParser = fieldParser;
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
}

module.exports = EntityExtractor;