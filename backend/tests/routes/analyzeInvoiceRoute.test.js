const request = require('supertest');
const express = require('express');
const router = require('../../src/routes/analyzeInvoiceRoute');
const analyzeInvoiceController = require('../../src/controllers/analyzeInvoiceController');

jest.mock('../../src/controllers/analyzeInvoiceController');

const app = express();
app.use(express.json());
app.use('/api/invoices', router);

describe('Invoice Route - Analysis', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Positive Cases', () => {
        test('should return 200 when posting valid data to /analyze', async () => {
            analyzeInvoiceController.analyzeInvoice.mockImplementation(async (req, res) => {
                res.status(200).json({ success: true });
            });

            const response = await request(app)
                .post('/api/invoices/analyze')
                .send({ documentUrl: "https://slicedinvoices.com/pdf/wordpress-pdf-invoice-plugin-sample.pdf" });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ success: true });
            expect(analyzeInvoiceController.analyzeInvoice).toHaveBeenCalledTimes(1);
        });
    });

    describe('Negative Cases', () => {
        test('should return 405 when using unsupported methods on /analyze', async () => {
            const methods = ['get', 'put', 'delete', 'patch'];
            for (const method of methods) {
                const response = await request(app)[method]('/api/invoices/analyze');
                expect(response.status).toBe(405);
                expect(response.body).toEqual({ message: "Method not allowed" });
            }
        });

        test('should return 404 for unknown routes', async () => {
            const response = await request(app).get('/api/invoices/unknown');
            expect(response.status).toBe(404);
            expect(response.body).toEqual({ message: "Endpoint not found" });
        });
    });

    describe('Corner Cases', () => {
        test('should return 404 when accessing a deeply nested unknown route', async () => {
            const response = await request(app).get('/api/invoices/unknown/path/to/resource');
            expect(response.status).toBe(404);
            expect(response.body).toEqual({ message: "Endpoint not found" });
        });
    });
});
