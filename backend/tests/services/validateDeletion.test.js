jest.mock('../../src/models/invoice', () => ({
    findByPk: jest.fn()
}));

const validateDeletion = require('../../src/services/validateDeletion');
const Invoice = require('../../src/models/invoice');

describe('validateInvoiceDeletion', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should return invoice when partner owns the invoice and status is Analyzed', async () => {
        const partnerId = 123;
        const invoiceId = 456;
        const mockInvoice = {
        id: invoiceId,
        partner_id: partnerId,
        status: "Analyzed"
        };

        Invoice.findByPk.mockResolvedValue(mockInvoice);

        const result = await validateDeletion.validateInvoiceDeletion(partnerId, invoiceId);

        expect(result).toEqual(mockInvoice);
        expect(Invoice.findByPk).toHaveBeenCalledWith(invoiceId);
    });

    test('should throw error when invoice status is not Analyzed', async () => {
        const partnerId = 123;
        const invoiceId = 456;
        const mockInvoice = {
        id: invoiceId,
        partner_id: partnerId,
        status: "Processing"
        };

        Invoice.findByPk.mockResolvedValue(mockInvoice);

        await expect(validateDeletion.validateInvoiceDeletion(partnerId, invoiceId))
        .rejects.toThrow("Invoice cannot be deleted unless it is Analyzed");
    });

    test('should throw error when invoice is not found', async () => {
        const partnerId = 123;
        const invoiceId = 456;

        Invoice.findByPk.mockResolvedValue(null);

        await expect(validateDeletion.validateInvoiceDeletion(partnerId, invoiceId))
        .rejects.toThrow("Invoice not found");
    });

    test('should throw error when partner does not own the invoice', async () => {
        const partnerId = 123;
        const invoiceId = 456;
        const mockInvoice = {
        id: invoiceId,
        partner_id: 789,
        status: "Analyzed"
        };

        Invoice.findByPk.mockResolvedValue(mockInvoice);

        await expect(validateDeletion.validateInvoiceDeletion(partnerId, invoiceId))
        .rejects.toThrow("Unauthorized: You do not own this invoice");
    });

    test('should throw error when invoice status is null or undefined', async () => {
        const partnerId = 123;
        const invoiceId = 456;
        const mockInvoice = {
        id: invoiceId,
        partner_id: partnerId,
        status: null
        };

        Invoice.findByPk.mockResolvedValue(mockInvoice);

        await expect(validateDeletion.validateInvoiceDeletion(partnerId, invoiceId))
        .rejects.toThrow("Invoice cannot be deleted unless it is Analyzed");
    });

    test('should throw error when invoice ID is null or undefined', async () => {
        const partnerId = 123;
        const invoiceId = null;

        await expect(validateDeletion.validateInvoiceDeletion(partnerId, invoiceId))
        .rejects.toThrow("Invalid invoice ID");
    });
});