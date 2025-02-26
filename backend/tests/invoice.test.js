const request = require("supertest");
const app = require("../src/app");
const fs = require("fs");
const path = require("path");
const mockFs = require("mock-fs");
const invoiceService = require("../src/services/invoiceServices");

describe("Invoice Upload Endpoint",() => {
    test("Invoice upload service called success",async() => {
        const response = await request(app).post('/api/invoices/upload').send();

        expect(response.status).toBe(501);
        expect(response.body.message).toBe("Invoice upload service called");
        
    })

    test("Invoice upload service called error",async() => {
        jest.spyOn(invoiceService,'uploadInvoice').mockRejectedValue(new Error("Error"))

        const response = await request(app).post('/api/invoices/upload').send();
        expect(response.status).toBe(500);
        expect(response.body.message).toBe("Internal server error");
    })


})


describe("PDF Validation Format", () => {
    const validPdfBuffer = Buffer.from("%PDF-1.4 Valid PDF File");
    const invalidPdfBuffer = Buffer.from("This is not a PDF");

    beforeAll(() => {
        mockFs({
            "samples/valid.pdf": validPdfBuffer,
            "samples/invalid.pdf": invalidPdfBuffer,
        });
    });

    afterAll(() => {
        mockFs.restore();
    });

    test("Should accept valid PDF file", async () => {
        const filePath = path.resolve("samples/valid.pdf");
        const fileBuffer = fs.readFileSync(filePath);

        const result = await invoiceService.validatePDF(fileBuffer, "application/pdf", "valid.pdf");
        expect(result).toBe(true);
    });

    test("Should reject non-PDF MIME type", async () => {
        const filePath = path.resolve("samples/valid.pdf");
        const fileBuffer = fs.readFileSync(filePath);

        await expect(
            invoiceService.validatePDF(fileBuffer, "image/png", "valid.png")
        ).rejects.toThrow("Invalid MIME type");
    });

    test("Should reject non-PDF extension", async () => {
        const filePath = path.resolve("samples/valid.pdf");
        const fileBuffer = fs.readFileSync(filePath);

        await expect(
            invoiceService.validatePDF(fileBuffer, "application/pdf", "document.txt")
        ).rejects.toThrow("Invalid file extension");
    });

    test("Should reject invalid PDF content", async () => {
        const filePath = path.resolve("samples/invalid.pdf");
        const fileBuffer = fs.readFileSync(filePath);

        await expect(
            invoiceService.validatePDF(fileBuffer, "application/pdf", "invalid.pdf")
        ).rejects.toThrow("Invalid PDF file");
    });
});