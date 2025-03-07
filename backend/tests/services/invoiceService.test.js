const invoiceService = require('../../src/services/invoiceServices');
const s3Service = require('../../src/services/s3Service');
const { Invoice } = require('../../src/models')
const fs = require("fs");
const path = require("path");
const mockFs = require('mock-fs')

jest.mock('../../src/services/s3Service', () => ({
  uploadFile: jest.fn()
}));

jest.mock('../../src/models', () => ({
  Invoice: {
    findByPk: jest.fn(),
    create: jest.fn()
  }
}));

describe('uploadInvoice', () => {
  const TEST_FILE_PATH = path.join(__dirname, '..', 'controllers', 'test-files', 'test-invoice.pdf');
  const TEST_FILE = { buffer: fs.readFileSync(TEST_FILE_PATH) };
  const TEST_S3_URL = 'https://s3.amazonaws.com/test-bucket/test-file.pdf';

  beforeEach(() => {
    jest.clearAllMocks();
  })

  test('should return invoice object when upload is successful', async () => {
    s3Service.uploadFile.mockResolvedValue(TEST_S3_URL);

    const mockPartnerId = '123';
    const mockInvoiceData = {
      partner_id: mockPartnerId,
      file_url: TEST_S3_URL,
      status: 'pending'
    };
    Invoice.create.mockResolvedValue(mockInvoiceData);

    const invoice = await invoiceService.uploadInvoice(TEST_FILE, mockPartnerId);
    expect(s3Service.uploadFile).toHaveBeenCalledWith(TEST_FILE.buffer);
    expect(Invoice.create).toHaveBeenCalledWith({ ...mockInvoiceData });
    expect(invoice).toMatchObject({
      ...mockInvoiceData
    });
  });

  test('should raise error when S3 upload fails', async () => {
    s3Service.uploadFile.mockRejectedValue(new Error('Failed to upload file to S3'));

    await expect(invoiceService.uploadInvoice(TEST_FILE)).rejects.toThrow('Failed to upload file to S3');
  });

  test('should raise error when saving to database fails', async () => {
    s3Service.uploadFile.mockResolvedValue(TEST_S3_URL);
    Invoice.create.mockRejectedValue(new Error('Failed to save invoice to database'));

    await expect(invoiceService.uploadInvoice(TEST_FILE)).rejects.toThrow('Failed to save invoice to database');
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

describe("getInvoiceById", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Should return an invoice when given a valid ID", async () => {
    const mockInvoice = {
      id: 1,
      invoice_date: "2025-02-01",
      due_date: "2025-03-01",
      purchase_order_id: 1,
      total_amount: 500.00,
      subtotal_amount: 450.00,
      discount_amount: 50.00,
      payment_terms: "Net 30",
      file_url: 'https://example.com/invoice.pdf',
      status: "Paid",
    };

    Invoice.findByPk.mockResolvedValue(mockInvoice);

    const invoice = await invoiceService.getInvoiceById(1);

    expect(invoice).toEqual(mockInvoice);
  });

  test("Should throw an error when invoice is not found", async () => {
    Invoice.findByPk.mockResolvedValue(null);

    await expect(invoiceService.getInvoiceById(99999999)).rejects.toThrow("Invoice not found");
  });

  test("Should throw an error when database fails", async () => {
    Invoice.findByPk.mockRejectedValue(new Error("Database error"));

    await expect(invoiceService.getInvoiceById(1)).rejects.toThrow("Database error");
  });
});    