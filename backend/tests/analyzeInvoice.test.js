const request = require('supertest');
const app = require('../src/app');

describe("Invoice analysis endpoint", () => {
    test('should return 501 not implemented', async () => {
        const response = await request(app)
            .post('/api/invoices/analyze')
            .send({ documentUrl: '' });
        expect(response.status).toBe(501);
        expect(response.body.message).toBe("Analyze invoice service called");
    });

    test('should return 500 internal server error', async () => {
        const response = await request(app)
            .post('/api/invoices/analyze')
            .send({ documentUrl: '' });
        expect(response.status).toBe(500);
        expect(response.body.message).toBe("Internal Server Error");
    });

    test('should return 400 bad request for missing documentUrl', async () => {
        const response = await request(app)
            .post('/api/invoices/analyze')
            .send({});
        expect(response.status).toBe(400);
        expect(response.body.message).toBe("documentUrl is required");
    });

    test('should return 200 and analysis result for valid documentUrl', async () => {
        const response = await request(app)
            .post('/api/invoices/analyze')
            .send({ documentUrl: 'https://slicedinvoices.com/pdf/wordpress-pdf-invoice-plugin-sample.pdf' });
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('text');
    });

    test('should return 404 not found for invalid endpoint', async () => {
        const response = await request(app)
            .post('/api/invoices/invalid-endpoint')
            .send({ documentUrl: 'http://example.com/invoice.pdf' });
        expect(response.status).toBe(404);
        expect(response.body.message).toBe("Endpoint not found");
    });
});