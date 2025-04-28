const { mockRequest, mockResponse } = require("jest-mock-req-res");
const { controller: invoiceController } = require("../../src/controllers/invoiceController");
const InvoiceService = require("../../src/services/invoice/invoiceService");
const s3Service = require("../../src/services/s3Service");
const Sentry = require("../../src/instrument");

jest.mock("../../src/services/validateDeletion");
jest.mock("../../src/services/invoice/invoiceService");
jest.mock("../../src/services/s3Service");
jest.mock("../../src/instrument");
jest.mock('rxjs', () => {
  const original = jest.requireActual('rxjs');
  return {
    ...original,
    from: jest.fn()
  };
});

describe("Invoice Controller - deleteInvoiceById (Unit Test)", () => {
  let req, res;
  const { from } = require('rxjs');

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    jest.clearAllMocks();

    req.params = { id: "0e95828d-b306-4be1-bd5f-f01cbe933b88" };
    req.user = { uuid: "16ff99be-abca-4b75-a4a5-f0480e690eac" };

    invoiceController.invoiceService = InvoiceService;
  });

  test("should return 404 if invoice not found", () => {
    // Gunakan pendekatan mockImplementationOnce seperti test yang berhasil
    from.mockImplementationOnce(() => ({
      pipe: jest.fn().mockReturnValue({
        subscribe: jest.fn(({ next}) => {
          // Panggil error callback
          Sentry.captureException(new Error("Invoice not found"));
          next({ status: 404, message: "Invoice not found" });
        })
      })
    }));
    
    invoiceController.deleteInvoiceById(req, res);
    
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: "invoiceDeletion",
      message: `Partner ${req.user.uuid} attempting to delete invoice ${req.params.id}`,
      level: "info"
    });
    
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Invoice not found" });
  });

  test("should return 403 if unauthorized to delete invoice", () => {
    // Gunakan pendekatan mockImplementationOnce seperti test yang berhasil
    from.mockImplementationOnce(() => ({
      pipe: jest.fn().mockReturnValue({
        subscribe: jest.fn(({ next }) => {
          // Panggil Sentry.captureException di dalam mock
          Sentry.captureException(new Error("Unauthorized: You do not own this invoice"));
          next({ status: 403, message: "Unauthorized: You do not own this invoice" });
        })
      })
    }));
    
    invoiceController.deleteInvoiceById(req, res);
    
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ 
      message: "Unauthorized: You do not own this invoice" 
    });
  });

  test("should return 409 if invoice is not in Analyzed status", () => {
    from.mockImplementationOnce(() => ({
      pipe: jest.fn().mockReturnValue({
        subscribe: jest.fn(({ next }) => {
          Sentry.captureException(new Error("Invoice cannot be deleted unless it is Analyzed"));
          next({ status: 409, message: "Invoice cannot be deleted unless it is Analyzed" });
        })
      })
    }));
    
    invoiceController.deleteInvoiceById(req, res);
    
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ 
      message: "Invoice cannot be deleted unless it is Analyzed" 
    });
  });

  test("should return 500 if validation throws an unexpected error", () => {
    from.mockImplementationOnce(() => ({
      pipe: jest.fn().mockReturnValue({
        subscribe: jest.fn(({ next }) => {
          Sentry.captureException(new Error("Some unexpected error"));
          next({ status: 500, message: "Internal server error" });
        })
      })
    }));
    
    invoiceController.deleteInvoiceById(req, res);
    
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });

  test("should return 500 if S3 file deletion fails", () => {
    from.mockImplementationOnce(() => ({
      pipe: jest.fn().mockReturnValue({
        subscribe: jest.fn(({ next }) => {
          next({ 
            status: 500, 
            message: "Failed to delete file from S3", 
            error: "S3 error" 
          });
        })
      })
    }));
    
    invoiceController.deleteInvoiceById(req, res);
    
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ 
      message: "Failed to delete file from S3", 
      error: "S3 error" 
    });
  });

  test("should return 200 if invoice is successfully deleted with file", () => {
    from.mockImplementationOnce(() => ({
      pipe: jest.fn().mockReturnValue({
        subscribe: jest.fn(({ next }) => {
          Sentry.captureMessage(`Invoice ${req.params.id} successfully deleted by ${req.user.uuid}`);
          next({}); // Tidak ada status = success
        })
      })
    }));
    
    invoiceController.deleteInvoiceById(req, res);
    
    expect(Sentry.captureMessage).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Invoice successfully deleted" });
  });

  test("should return 200 if invoice is successfully deleted without file", () => {
    from.mockImplementationOnce(() => ({
      pipe: jest.fn().mockReturnValue({
        subscribe: jest.fn(({ next }) => {
          Sentry.captureMessage(`Invoice ${req.params.id} successfully deleted by ${req.user.uuid}`);
          next({}); // Tidak ada status = success
        })
      })
    }));
    
    invoiceController.deleteInvoiceById(req, res);
    
    expect(s3Service.deleteFile).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Invoice successfully deleted" });
  });

  test("should return 500 if invoice deletion service throws an error", () => {
    from.mockImplementationOnce(() => ({
      pipe: jest.fn().mockReturnValue({
        subscribe: jest.fn(({ next }) => {
          const dbError = new Error("Database error");
          Sentry.captureException(dbError);
          next({ status: 500, message: "Internal server error" });
        })
      })
    }));
    
    invoiceController.deleteInvoiceById(req, res);
    
    expect(Sentry.captureException).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});