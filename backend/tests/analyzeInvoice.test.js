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
});