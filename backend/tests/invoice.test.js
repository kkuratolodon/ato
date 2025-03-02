const request = require('supertest')
const app = require('../src/app')
const path = require('path')
const invoiceService = require('../src/services/invoiceServices')

describe("Invoice Upload Endpoint",() => {
    afterEach(()=> {
        jest.restoreAllMocks();
    });
    test("Invoice upload service called success (real function)",async() => {
        const mockFileName = "test-invoice.pdf"

        const filePath = path.join(__dirname,'test-files',mockFileName)
        const response = await request(app).post('/api/invoices/upload').attach("file",filePath);

        expect(response.status).toBe(501);
        expect(response.body.message).toBe("Invoice upload service called");
        expect(response.body.filename).toBe(mockFileName)
    })
    test("Invoice upload service called success (mocked)",async() => {
        const mockFileName = "test-invoice.pdf"

        jest.spyOn(invoiceService,'uploadInvoice').mockResolvedValue({
                message: "Invoice upload service called",
                filename: mockFileName
        })

        const filePath = path.join(__dirname,'test-files',mockFileName)
        const response = await request(app).post('/api/invoices/upload').attach("file",filePath);

        expect(response.status).toBe(501);
        expect(response.body.message).toBe("Invoice upload service called");
        expect(response.body.filename).toBe(mockFileName)
    })
    test("Invoice upload service without file",async() => {
        const response = await request(app).post('/api/invoices/upload').send();

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("No file uploaded");
        
    })

    test("Invoice upload service called error",async() => {
        const mockFileName = "test-invoice.pdf"

        jest.spyOn(invoiceService,'uploadInvoice').mockRejectedValue(new Error("Error"))
        
        const filePath = path.join(__dirname,'test-files',mockFileName)
        const response = await request(app).post('/api/invoices/upload').attach("file",filePath);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe("Internal server error");
    })


})