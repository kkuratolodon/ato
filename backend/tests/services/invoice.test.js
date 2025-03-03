const fs = require("fs");
const path = require("path");
const mockFs = require("mock-fs");
const request = require("supertest");
const app = require("../../src/app");
const invoiceService = require("../../src/services/invoiceServices");
const authService = require('../../src/services/authService');


describe("Invoice Upload Endpoint", () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.spyOn(authService, 'authenticate').mockResolvedValue(true);
    });
        
    afterEach(() => {
        jest.restoreAllMocks();
        mockFs.restore();
    });

    test("Invoice upload service called success (real function)", async () => {
        const mockFileName = "test-invoice.pdf";
        const filePath = path.join(__dirname, "../test-files", mockFileName);

        const response = await request(app)
        .post("/api/invoices/upload")
        .attach("file", filePath, "test-invoice.pdf"); 

        expect(response.status).toBe(501);
    });

    test("Invoice upload service called success (mocked)",async() => {
        const mockFileName = "test-invoice.pdf"

        jest.spyOn(invoiceService,'uploadInvoice').mockResolvedValue({
                message: "Invoice upload service called",
                filename: mockFileName
        })

        const filePath = path.join(__dirname,'../test-files',mockFileName)
        const response = await request(app).post('/api/invoices/upload').attach("file",filePath);

        expect(response.status).toBe(501);
        expect(response.body.message).toBe("Invoice upload service called");
        expect(response.body.filename).toBe(mockFileName)
    })

    test("Invoice upload service called error",async() => {
        const mockFileName = "test-invoice.pdf"

        jest.spyOn(invoiceService,'uploadInvoice').mockRejectedValue(new Error("Error"))
        
        const filePath = path.join(__dirname,'../test-files',mockFileName)
        const response = await request(app).post('/api/invoices/upload').attach("file",filePath);

        expect(response.status).toBe(500);
        expect(response.body.message).toBe("Internal server error");
    })

    test("Invoice upload service without file",async() => {
        const response = await request(app).post('/api/invoices/upload').send();

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("No file uploaded");
        
    })

    test("Returns 415 when file is not a PDF", async () => {
        const mockFileName = "test-invoice.pdf";
        jest.spyOn(invoiceService, 'validatePDF').mockRejectedValue(new Error("Error"))

        const filePath = path.join(__dirname,'../test-files',mockFileName)
        const response = await request(app).post('/api/invoices/upload').attach("file",filePath);
        
        expect(response.status).toBe(415);
        expect(response.body.message).toBe("File format is not PDF");
    });

    test("Returns 400 when PDF is corrupted", async () => {
      const mockFileName = "corrupted.pdf";
      const filePath = path.join(__dirname, "../test-files", mockFileName);
      
      jest.spyOn(invoiceService, "isPdfEncrypted").mockResolvedValue(true);
      
      const response = await request(app)
          .post("/api/invoices/upload")
          .attach("file", filePath);
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("pdf is encrypted");
      expect(invoiceService.isPdfEncrypted).toHaveBeenCalled();
    });

    test("Returns 504 when upload times out", async () => {
      const mockFileName = "test-invoice.pdf";
      const filePath = path.join(__dirname, "../test-files", mockFileName);
      
      const response = await request(app)
          .post("/api/invoices/upload")
          .query({ simulateTimeout: 'true' })
          .attach("file", filePath);
      
      expect(response.status).toBe(504);
      expect(response.body.message).toBe("Server timeout during upload");
    });

    test("Returns 400 when PDF file is invalid", async () => {
      const mockFileName = "test-invoice.pdf";
      const filePath = path.join(__dirname, "../test-files", mockFileName);
      
      jest.spyOn(invoiceService, "checkPdfIntegrity").mockResolvedValue(false);

      const response = await request(app)
          .post("/api/invoices/upload")
          .attach("file", filePath);
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe("PDF file is invalid");
      expect(invoiceService.checkPdfIntegrity).toHaveBeenCalled();
    });

    test("Returns 413 when file is too large", async () => {
      const mockFileName = "test-invoice.pdf";
      const filePath = path.join(__dirname, "../test-files", mockFileName);
      
      jest.spyOn(invoiceService, "validateSizeFile").mockRejectedValue(
          new Error("File size exceeds maximum limit")
      );
      
      const response = await request(app)
          .post("/api/invoices/upload")
          .attach("file", filePath);
      
      expect(response.status).toBe(413);
      expect(response.body.message).toBe("File size exceeds maximum limit");
      expect(invoiceService.validateSizeFile).toHaveBeenCalled();
  });

});

describe("Invoice Service Core Functions", () => {
  test("uploadInvoice should throw error when file is not provided", async () => {

    await expect(invoiceService.uploadInvoice(null))
      .rejects.toThrow("File not found");
  });
});

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

describe("PDF File Size Validation", () => {
    const validPdfBuffer = Buffer.alloc(10 * 1024 * 1024, "%PDF-1.4 Valid PDF File"); 
    const largePdfBuffer = Buffer.alloc(21 * 1024 * 1024, "%PDF-1.4 Valid PDF File"); 
    const edgePdfBuffer = Buffer.alloc(20 * 1024 * 1024, "%PDF-1.4 Valid PDF File"); 
  
    beforeAll(() => {
      mockFs({
        "samples/valid.pdf": validPdfBuffer,
        "samples/large.pdf": largePdfBuffer,
        "samples/edge.pdf": edgePdfBuffer,
      });
    });
  
    afterAll(() => {
      mockFs.restore();
    });
  
    test("Should accept a valid PDF file under 20MB", async () => {
      const filePath = path.resolve("samples/valid.pdf");
      const fileBuffer = fs.readFileSync(filePath);
  
      const result = await invoiceService.validateSizeFile(fileBuffer);
      expect(result).toBe(true);
    });
  
    test("Should reject a PDF file larger than 20MB", async () => {
      const filePath = path.resolve("samples/large.pdf");
      const fileBuffer = fs.readFileSync(filePath);
  
      await expect(
        invoiceService.validateSizeFile(fileBuffer)
      ).rejects.toThrow("File exceeds maximum allowed size of 20MB");
    });
  
    test("Should accept a PDF file exactly 20MB (Edge Case)", async () => {
      const filePath = path.resolve("samples/edge.pdf");
      const fileBuffer = fs.readFileSync(filePath);
  
      const result = await invoiceService.validateSizeFile(fileBuffer);
      expect(result).toBe(true);
    });
});

describe("PDF Encryption Check with Real Implementation", () => {
    const unencryptedPdfBuffer = Buffer.from(
      "%PDF-1.3\n" +
      "1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n" +
      "2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n" +
      "3 0 obj\n<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>\nendobj\n" +
      "xref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\n" +
      "trailer\n<</Size 4/Root 1 0 R>>\n" +
      "startxref\n178\n%%EOF"
    );

    const encryptedPdfBuffer = Buffer.from(
      "%PDF-1.3\n" +
      "1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n" +
      "2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n" +
      "3 0 obj\n<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>\nendobj\n" +
      "4 0 obj\n<</Filter/Standard/V 1/R 2/O<1234567890ABCDEF1234567890ABCDEF>/U<ABCDEF1234567890ABCDEF1234567890>/P -3904>>\nendobj\n" +
      "xref\n0 5\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\n0000000183 00000 n\n" +
      "trailer\n<</Size 5/Root 1 0 R/Encrypt 4 0 R>>\n" +
      "startxref\n291\n%%EOF"
    );
    
    beforeAll(() => {
      mockFs({
        "samples/unencrypted.pdf": unencryptedPdfBuffer,
        "samples/encrypted.pdf": encryptedPdfBuffer,
      });
    });
  
    afterAll(() => {
      mockFs.restore();
    });
  
    test("Should detect unencrypted PDF correctly", async () => {
      const filePath = path.resolve("samples/unencrypted.pdf");
      const fileBuffer = fs.readFileSync(filePath);
  
      const result = await invoiceService.isPdfEncrypted(fileBuffer);
      expect(result).toBe(false);
    });
  
    test("Should detect encrypted PDF correctly", async () => {
      const filePath = path.resolve("samples/encrypted.pdf");
      const fileBuffer = fs.readFileSync(filePath);
  
      const result = await invoiceService.isPdfEncrypted(fileBuffer);
      expect(result).toBe(true);
    });
});

describe("PDF Integrity Check", () => {
    const validPdfBuffer = Buffer.from(
        "%PDF-1.3\n" +
        "1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n" +
        "2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n" +
        "3 0 obj\n<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>\nendobj\n" +
        "xref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\n" +
        "trailer\n<</Size 4/Root 1 0 R>>\n" +
        "startxref\n178\n%%EOF"
    );
    
    const corruptedPdfBuffer = Buffer.from(
        "%PDF-1.3\n" +
        "1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n" +
        "2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n" +
        "3 0 obj\n<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>\nendobj\n" +
        "trailer\n<</Size 4/Root 1 0 R>>\n" +
        "startxref\n" +
        "%%EOF"
    );
    
    const truncatedPdfBuffer = Buffer.from(
        "%PDF-1.3\n" +
        "1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n" +
        "2 0 obj\n<</Type/Pages/Kids[3"
    );
    
    beforeAll(() => {
        mockFs({
        "samples/valid.pdf": validPdfBuffer,
        "samples/corrupted.pdf": corruptedPdfBuffer,
        "samples/truncated.pdf": truncatedPdfBuffer,
        });
    });
    
    afterAll(() => {
        mockFs.restore();
    });
    
    test("Should confirm integrity of a valid PDF file", async () => {
        const filePath = path.resolve("samples/valid.pdf");
        const fileBuffer = fs.readFileSync(filePath);
        
        const result = await invoiceService.checkPdfIntegrity(fileBuffer);
        expect(result).toBe(true);
    });
    
    test("Should return false for a corrupted PDF with missing xref table", async () => {
        const filePath = path.resolve("samples/corrupted.pdf");
        const fileBuffer = fs.readFileSync(filePath);
        
        const result = await invoiceService.checkPdfIntegrity(fileBuffer);
        expect(result).toBe(false);
    });
    
    test("Should return false for a truncated PDF file", async () => {
        const filePath = path.resolve("samples/truncated.pdf");
        const fileBuffer = fs.readFileSync(filePath);
        
        const result = await invoiceService.checkPdfIntegrity(fileBuffer);
        expect(result).toBe(false);
    });
    
    test("Should handle empty buffer correctly", async () => {
        const emptyBuffer = Buffer.alloc(0);
        
        const result = await invoiceService.checkPdfIntegrity(emptyBuffer);
        expect(result).toBe(false);
    });

    test("should handle PDF with malformed startxref in checkPdfIntegrity", async () => {
        const malformedPdfBuffer = Buffer.from(
            "%PDF-1.3\n" +
            "1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n" +
            "trailer\n<</Size 4/Root 1 0 R>>\n" +
            "startxref\nABC\n" + 
            "%%EOF"
        );
        const result = await invoiceService.checkPdfIntegrity(malformedPdfBuffer);
        expect(result).toBe(false);
    });
        
    test("should handle PDF without objects in checkPdfIntegrity", async () => {
        const noObjectsPdfBuffer = Buffer.from(
            "%PDF-1.3\n" +
            "trailer\n<</Size 4/Root 1 0 R>>\n" +
            "startxref\n123\n" +
            "%%EOF"
        );
        const result = await invoiceService.checkPdfIntegrity(noObjectsPdfBuffer);
        expect(result).toBe(false);
    });
});