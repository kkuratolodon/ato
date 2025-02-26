const request = require('supertest')
const app = require('../src/app')
const InvoiceService = require('../src/services/invoiceServices')

describe("Invoice Upload Endpoint",() => {
    test("Invoice upload service called success",async() => {
        const response = await request(app).post('/api/invoices/upload').send();

        expect(response.status).toBe(501);
        expect(response.body.message).toBe("Invoice upload service called");
        
    })

    test("Invoice upload service called error",async() => {
        jest.spyOn(InvoiceService,'uploadInvoice').mockRejectedValue(new Error("Error"))

        const response = await request(app).post('/api/invoices/upload').send();
        expect(response.status).toBe(500);
        expect(response.body.message).toBe("Internal server error");
    })


})