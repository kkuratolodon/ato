'use strict';

class FieldParser {
    /**
   * Get content safely from OCR field
   * @param {Object} field - Field from OCR
   * @returns {string|null} Field content or null if missing
   */
    getFieldContent(field) {
        if (!field) return null;

        if (typeof field.content === 'string') {
            return field.content.trim().replace(/\n/g, " ");
        }

        if (field.value && typeof field.value === 'string') {
            return field.value.trim().replace(/\n/g, " ");
        }

        if (field?.value?.text) {
            return field.value.text.trim().replace(/\n/g, " ");
        }

        return null;
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
            return new Date();
        }
        const ddmmyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/;
        if (ddmmyyRegex.test(dateStr)) {
            const [, day, month, year] = ddmmyyRegex.exec(dateStr);
            const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
            const formattedDate = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            return new Date(formattedDate);
        }

        const ddmmyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        if (ddmmyyyyRegex.test(dateStr)) {
            const [, day, month, year] = ddmmyyyyRegex.exec(dateStr);
            const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            return new Date(formattedDate);
        }

        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            console.warn(`Invalid date format: ${dateStr}, using current date`);
            return new Date();
        }

        return date;
    }

    /**
     * Parse currency field from OCR result
     * @param {Object} field - Currency field from OCR
     * @returns {number|null} Parsed amount or null if missing
     */
    parseCurrency(field) {
        // Default result for empty field
        if (!field) {
            return {
                amount: null,
                currency: { currencySymbol: null, currencyCode: null }
            };
        }

        // Initialize result object
        const result = {
            amount: null,
            currency: {
                currencySymbol: null,
                currencyCode: null
            }
        };

        if (field?.value !== undefined && typeof field.value === 'number') {
            result.amount = field.value;
            return result;
        }

        if (field?.value?.amount && typeof field.value.amount === 'number') {
            const currencyContent = this.getFieldContent(field);

            if (currencyContent?.includes('Rp')) {
                const numericStr = currencyContent.replace(/Rp/i, '')
                    .replace(/\./g, '')
                    .replace(/,/g, '.')
                    .trim();
                const amount = parseFloat(numericStr);

                result.amount = amount;
                result.currency.currencySymbol = 'Rp';
                result.currency.currencyCode = 'IDR';
            } else {
                result.amount = field.value.amount;
                result.currency.currencySymbol = field.value.currencySymbol || null;
                result.currency.currencyCode = field.value.currencyCode || null;
            }
            return result;
        }

        // String content case
        const amountStr = this.getFieldContent(field);
        if (!amountStr) return result;

        // Parse amount value first to check if it's a valid number
        const numericStr = amountStr.replace(/[^\d.-]/g, '');
        const amount = parseFloat(numericStr);
        result.amount = isNaN(amount) ? null : amount;

        // Only extract currency symbol if we have a valid number
        if (!isNaN(amount)) {
            const currencyMatch = /^([^\d]+)/.exec(amountStr);
            if (currencyMatch?.[1]) {
                result.currency.currencySymbol = currencyMatch[1].trim();
            }
        }

        return result;
    }

    /**
     * Parse numeric field from OCR result
     * @param {Object} field - Numeric field from OCR
     * @returns {number|null} Parsed number or null if missing/invalid
     */
    parseNumeric(field) {
        if (field?.value && typeof field.value === 'number') {
            return field.value;
        }

        const numStr = this.getFieldContent(field);
        if (!numStr) return null;
        const cleaned = numStr.replace(/[^\d.-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
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
            const netMatch = /net\s+(\d{1,4})/i.exec(paymentTerms);
            const daysMatch = /\b(\d{1,4})\s*(?:days?\b|d\b)/i.exec(paymentTerms);
            const numericMatch = /^\s*(\d{1,4})\s*$/.exec(paymentTerms);

            if (netMatch) {
                termDays = parseInt(netMatch[1], 10);
            } else if (daysMatch) {
                termDays = parseInt(daysMatch[1], 10);
            } else if (numericMatch) {
                termDays = parseInt(numericMatch[1], 10);
            }
        }

        if (isNaN(termDays) || termDays <= 0) {
            termDays = 30;
        }

        dueDate.setDate(dueDate.getDate() + termDays);
        return dueDate;
    }
}

module.exports = FieldParser;