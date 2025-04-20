const { mockRequest, mockResponse } = require("jest-mock-req-res");
const { controller: invoiceController } = require("@controllers/invoiceController");
const validateDeletion = require("@services/validateDeletion");
const InvoiceService = require("@services/invoice/invoiceService");
const s3Service = require("@services/s3Service");
const Sentry = require("../../src/instrument");

jest.mock("@services/validateDeletion");
jest.mock("@services/invoice/invoiceService");
jest.mock("@services/s3Service");
jest.mock("../../src/instrument");

describe("Invoice Controller - deleteInvoiceById (Unit Test)", () => {
  let req, res;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.clearAllMocks();

    req.params = { id: "0e95828d-b306-4be1-bd5f-f01cbe933b88" };
    req.user = { uuid: "16ff99be-abca-4b75-a4a5-f0480e690eac" };

    Sentry.addBreadcrumb = jest.fn();
    Sentry.captureException = jest.fn();
    Sentry.captureMessage = jest.fn();

    validateDeletion.validateInvoiceDeletion.mockResolvedValue({
      id: "0e95828d-b306-4be1-bd5f-f01cbe933b88",
      file_url: "https://example.com/invoice2.pdf",
    });

    s3Service.deleteFile.mockResolvedValue({ success: true });

    InvoiceService.deleteInvoiceById.mockResolvedValue(true);
  });

  test("should return 404 if invoice not found", async () => {
    validateDeletion.validateInvoiceDeletion.mockRejectedValue(new Error("Invoice not found"));

    await invoiceController.deleteInvoiceById(req, res);

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: "invoiceDeletion",
      message: `Partner ${req.user.uuid} attempting to delete invoice ${req.params.id}`,
      level: "info"
    });
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Invoice not found" });
  });

  test("should return 403 if unauthorized to delete invoice", async () => {
    validateDeletion.validateInvoiceDeletion.mockRejectedValue(
      new Error("Unauthorized: You do not own this invoice")
    );

    await invoiceController.deleteInvoiceById(req, res);

    expect(Sentry.addBreadcrumb).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ 
      message: "Unauthorized: You do not own this invoice" 
    });
  });

  test("should return 409 if invoice is not in Analyzed status", async () => {
    validateDeletion.validateInvoiceDeletion.mockRejectedValue(
      new Error("Invoice cannot be deleted unless it is Analyzed")
    );

    await invoiceController.deleteInvoiceById(req, res);

    expect(Sentry.addBreadcrumb).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ 
      message: "Invoice cannot be deleted unless it is Analyzed" 
    });
  });

  test("should return 500 if validation throws an unexpected error", async () => {
    validateDeletion.validateInvoiceDeletion.mockRejectedValue(
      new Error("Some unexpected error")
    );

    await invoiceController.deleteInvoiceById(req, res);

    expect(Sentry.addBreadcrumb).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });

  test("should return 500 if S3 file deletion fails", async () => {
    s3Service.deleteFile.mockResolvedValue({ 
      success: false, 
      error: "S3 error" 
    });

    await invoiceController.deleteInvoiceById(req, res);

    expect(Sentry.addBreadcrumb).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ 
      message: "Failed to delete file from S3", 
      error: "S3 error" 
    });
  });

  test("should return 200 if invoice is successfully deleted with file", async () => {
    await invoiceController.deleteInvoiceById(req, res);

    expect(Sentry.addBreadcrumb).toHaveBeenCalled();
    expect(s3Service.deleteFile).toHaveBeenCalledWith("invoice2.pdf");
    expect(InvoiceService.deleteInvoiceById).toHaveBeenCalledWith(req.params.id);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      `Invoice ${req.params.id} successfully deleted by ${req.user.uuid}`
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Invoice successfully deleted" });
  });

  test("should return 200 if invoice is successfully deleted without file", async () => {
    validateDeletion.validateInvoiceDeletion.mockResolvedValue({
      id: "0e95828d-b306-4be1-bd5f-f01cbe933b88",
      file_url: null,
    });

    await invoiceController.deleteInvoiceById(req, res);

    expect(Sentry.addBreadcrumb).toHaveBeenCalled();
    expect(s3Service.deleteFile).not.toHaveBeenCalled();
    expect(InvoiceService.deleteInvoiceById).toHaveBeenCalledWith(req.params.id);
    expect(Sentry.captureMessage).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Invoice successfully deleted" });
  });

  test("should return 500 if invoice deletion service throws an error", async () => {
    InvoiceService.deleteInvoiceById.mockRejectedValue(new Error("Database error"));

    await invoiceController.deleteInvoiceById(req, res);

    expect(Sentry.addBreadcrumb).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});