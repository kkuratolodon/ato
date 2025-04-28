const pdfValidationService = require("../../src/services/pdfValidationService");
const fs = require("fs");
const path = require("path");
const pdfjsLib = require("pdfjs-dist");

describe("PDF Validation Format", () => {
  const validPdfBuffer = Buffer.from("%PDF-1.4 Valid PDF File");
  const invalidPdfBuffer = Buffer.from("This is not a PDF");

  beforeEach(() => {
    // Gunakan jest.spyOn untuk mock fs.readFileSync
    jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
      if (filePath.includes('valid.pdf')) {
        return validPdfBuffer;
      }
      if (filePath.includes('invalid.pdf')) {
        return invalidPdfBuffer;
      }
      throw new Error(`Unexpected file path: ${filePath}`);
    });

    // Mock path.resolve untuk mengembalikan path yang sama
    jest.spyOn(path, 'resolve').mockImplementation((filePath) => filePath);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Should accept valid PDF file", async () => {
    const result = await pdfValidationService.validatePDF(
      validPdfBuffer, 
      "application/pdf", 
      "valid.pdf"
    );
    expect(result).toBe(true);
  });

  test("Should reject non-PDF MIME type", async () => {
    await expect(
      pdfValidationService.validatePDF(validPdfBuffer, "image/png", "valid.png")
    ).rejects.toThrow("Invalid MIME type");
  });

  test("Should reject non-PDF extension", async () => {
    await expect(
      pdfValidationService.validatePDF(validPdfBuffer, "application/pdf", "document.txt")
    ).rejects.toThrow("Invalid file extension");
  });

  test("Should reject invalid PDF content", async () => {
    await expect(
      pdfValidationService.validatePDF(invalidPdfBuffer, "application/pdf", "invalid.pdf")
    ).rejects.toThrow("Invalid PDF file");
  });
});

describe("PDF File Size Validation", () => {
  const validPdfBuffer = Buffer.alloc(10 * 1024 * 1024, "%PDF-1.4 Valid PDF File");
  const largePdfBuffer = Buffer.alloc(21 * 1024 * 1024, "%PDF-1.4 Valid PDF File");
  const edgePdfBuffer = Buffer.alloc(20 * 1024 * 1024, "%PDF-1.4 Valid PDF File");

  beforeEach(() => {
    jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
      if (filePath.includes('valid.pdf')) {
        return validPdfBuffer;
      }
      if (filePath.includes('large.pdf')) {
        return largePdfBuffer;
      }
      if (filePath.includes('edge.pdf')) {
        return edgePdfBuffer;
      }
      throw new Error(`Unexpected file path: ${filePath}`);
    });

    jest.spyOn(path, 'resolve').mockImplementation((filePath) => filePath);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Should accept a valid PDF file under 20MB", async () => {
    const result = await pdfValidationService.validateSizeFile(validPdfBuffer);
    expect(result).toBe(true);
  });

  test("Should reject a PDF file larger than 20MB", async () => {
    await expect(
      pdfValidationService.validateSizeFile(largePdfBuffer)
    ).rejects.toThrow("File exceeds maximum allowed size of 20MB");
  });

  test("Should accept a PDF file exactly 20MB (Edge Case)", async () => {
    const result = await pdfValidationService.validateSizeFile(edgePdfBuffer);
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

  beforeEach(() => {
    jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
      if (filePath.includes('unencrypted.pdf')) {
        return unencryptedPdfBuffer;
      }
      if (filePath.includes('encrypted.pdf')) {
        return encryptedPdfBuffer;
      }
      throw new Error(`Unexpected file path: ${filePath}`);
    });

    jest.spyOn(path, 'resolve').mockImplementation((filePath) => filePath);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Should detect unencrypted PDF correctly", async () => {
    const result = await pdfValidationService.isPdfEncrypted(unencryptedPdfBuffer);
    expect(result).toBe(false);
  });

  test("Should detect encrypted PDF correctly", async () => {
    const result = await pdfValidationService.isPdfEncrypted(encryptedPdfBuffer);
    expect(result).toBe(true);
  });
});

jest.mock("pdfjs-dist", () => ({
  getDocument: jest.fn()
}));

describe("PDF Page Count Validation", () => {
  beforeEach(() => {
      jest.clearAllMocks();
  });

  test("Valid PDF with 100 pages", async () => {
      pdfjsLib.getDocument.mockReturnValue({
          promise: Promise.resolve({ numPages: 100 })
      });

      const mockBuffer = Buffer.from("mock pdf data");
      await expect(pdfValidationService.validatePdfPageCount(mockBuffer)).resolves.toBe(true);
  });

  test("PDF with 101 pages", async () => {
      pdfjsLib.getDocument.mockReturnValue({
          promise: Promise.resolve({ numPages: 101 })
      });

      const mockBuffer = Buffer.from("mock pdf data");
      await expect(pdfValidationService.validatePdfPageCount(mockBuffer)).rejects.toThrow("PDF exceeds the maximum allowed pages (100).");
  });

  test("Empty PDF with 0 pages", async () => {
      pdfjsLib.getDocument.mockReturnValue({
          promise: Promise.resolve({ numPages: 0 })
      });

      const mockBuffer = Buffer.from("mock pdf data");
      await expect(pdfValidationService.validatePdfPageCount(mockBuffer)).rejects.toThrow("PDF has no pages.");
  });

  test("Error reading PDF", async () => {
      pdfjsLib.getDocument.mockReturnValue({
          promise: Promise.reject(new Error("Failed to parse PDF"))
      });

      const mockBuffer = Buffer.from("mock pdf data");
      await expect(pdfValidationService.validatePdfPageCount(mockBuffer)).rejects.toThrow("Failed to read PDF page count.");
  });

  describe("All Validations", () => {
    const dummyPdfBuffer = Buffer.from("%PDF-1.4 Dummy PDF File");

    beforeEach(() => {
      jest.spyOn(pdfValidationService, "validatePDF").mockResolvedValue(true);
      jest.spyOn(pdfValidationService, "validateSizeFile").mockResolvedValue(true);
      jest.spyOn(pdfValidationService, "validatePdfPageCount").mockResolvedValue(true);
      jest.spyOn(pdfValidationService, "isPdfEncrypted").mockResolvedValue(false);      
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test("Should pass all validations for a valid PDF", async () => {
      await expect(
        pdfValidationService.allValidations(dummyPdfBuffer, "application/pdf", "valid.pdf")
      ).resolves.toEqual({ isValid: true, isEncrypted: false });
    });

    test("Should fail if MIME type is invalid", async () => {
      jest.spyOn(pdfValidationService, "validatePDF").mockRejectedValue(new Error("Invalid MIME type"));
      await expect(
        pdfValidationService.allValidations(dummyPdfBuffer, "image/png", "valid.pdf")
      ).rejects.toThrow("Invalid MIME type");
    });

    test("Should fail if file extension is invalid", async () => {
      jest.spyOn(pdfValidationService, "validatePDF").mockRejectedValue(new Error("Invalid file extension"));
      await expect(
        pdfValidationService.allValidations(dummyPdfBuffer, "application/pdf", "invalid.txt")
      ).rejects.toThrow("Invalid file extension");
    });

    test("Should fail if file size exceeds 20MB", async () => {
      jest.spyOn(pdfValidationService, "validateSizeFile").mockRejectedValue(new Error("File exceeds maximum allowed size of 20MB"));
      await expect(
        pdfValidationService.allValidations(dummyPdfBuffer, "application/pdf", "large.pdf")
      ).rejects.toThrow("File exceeds maximum allowed size of 20MB");
    });

    test("Should identify encrypted PDF and return encryption status", async () => {
      jest.spyOn(pdfValidationService, "isPdfEncrypted").mockResolvedValue(true);
      await expect(
        pdfValidationService.allValidations(dummyPdfBuffer, "application/pdf", "encrypted.pdf")
      ).resolves.toEqual({ isValid: true, isEncrypted: true });
    });    

    test("Should fail if PDF has no pages", async () => {
      jest.spyOn(pdfValidationService, "validatePdfPageCount").mockRejectedValue(new Error("PDF has no pages."));

      await expect(
        pdfValidationService.allValidations(dummyPdfBuffer, "application/pdf", "empty.pdf")
      ).rejects.toThrow("PDF has no pages.");
    });

    test("Should fail if PDF exceeds maximum page count", async () => {
      jest.spyOn(pdfValidationService, "validatePdfPageCount").mockRejectedValue(new Error("PDF exceeds the maximum allowed pages (100)."));

      await expect(
        pdfValidationService.allValidations(dummyPdfBuffer, "application/pdf", "largePageCount.pdf")
      ).rejects.toThrow("PDF exceeds the maximum allowed pages (100).");
    });
  });
});