const request = require('supertest')
const app = require('../src/app')

describe("Invoice Upload Endpoint",() => {
    test("Invoice upload service called",async() => {
        const response = await request(app).post('/api/invoices/upload').send();

        expect(response.status).toBe(501);
        expect(response.body.message).toBe("Invoice upload service called");
        
    })
})