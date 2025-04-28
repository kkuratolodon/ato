const { mockRequest, mockResponse } = require("jest-mock-req-res");
const { controller: invoiceController } = require("../../src/controllers/invoiceController");
const InvoiceService = require("../../src/services/invoice/invoiceService");
const s3Service = require("../../src/services/s3Service");
const validateDeletion = require("../../src/services/validateDeletion");
const Sentry = require("../../src/instrument");

jest.mock("../../src/services/validateDeletion");
jest.mock("../../src/services/invoice/invoiceService");
jest.mock("../../src/services/s3Service");
jest.mock("../../src/instrument");

describe("Invoice Controller - deleteInvoiceById (Unit Test)", () => {
  let req, res;
  const invoiceId = "0e95828d-b306-4be1-bd5f-f01cbe933b88";
  const userId = "16ff99be-abca-4b75-a4a5-f0480e690eac";
  const fileUrl = "https://s3.bucket.com/path/to/file.pdf";
  const fileKey = "file.pdf";

  const mockInvoiceWithFile = {
    id: invoiceId,
    user_uuid: userId,
    file_url: fileUrl,
    status: "Analyzed",
  };

  const mockInvoiceWithoutFile = {
    id: invoiceId,
    user_uuid: userId,
    file_url: null,
    status: "Analyzed",
  };

  beforeEach(() => {
    req = mockRequest({
      params: { id: invoiceId },
      user: { uuid: userId },
    });
    res = mockResponse(); 
    jest.clearAllMocks();
  });

  test("should return 404 if validation throws 'Invoice not found'", () => { 
    return new Promise(resolve => {
        const error = new Error("Invoice not found");
        validateDeletion.validateInvoiceDeletion.mockRejectedValue(error);

        res.json.mockImplementation(() => {
            expect(validateDeletion.validateInvoiceDeletion).toHaveBeenCalledWith(userId, invoiceId);
            expect(Sentry.captureException).toHaveBeenCalledWith(error);
            expect(Sentry.addBreadcrumb).toHaveBeenCalled(); 
            expect(s3Service.deleteFile).not.toHaveBeenCalled();
            expect(InvoiceService.deleteInvoiceById).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(404);
            resolve(); 
        });
        res.status.mockImplementation(() => res); 
        invoiceController.deleteInvoiceById(req, res);
    });
  });

  test("should return 403 if validation throws 'Unauthorized'", () => { 
     return new Promise(resolve => {
        const error = new Error("Unauthorized: You do not own this invoice");
        validateDeletion.validateInvoiceDeletion.mockRejectedValue(error);

        res.json.mockImplementation(() => {
             expect(validateDeletion.validateInvoiceDeletion).toHaveBeenCalledWith(userId, invoiceId);
             expect(Sentry.captureException).toHaveBeenCalledWith(error);
             expect(s3Service.deleteFile).not.toHaveBeenCalled();
             expect(InvoiceService.deleteInvoiceById).not.toHaveBeenCalled();
             expect(res.status).toHaveBeenCalledWith(403);
             resolve();
        });
        res.status.mockImplementation(() => res);

        invoiceController.deleteInvoiceById(req, res);
     });
  });

  test("should return 409 if validation throws 'Invoice cannot be deleted'", () => { 
    return new Promise(resolve => {
        const error = new Error("Invoice cannot be deleted unless it is Analyzed");
        validateDeletion.validateInvoiceDeletion.mockRejectedValue(error);

        res.json.mockImplementation(() => {
            expect(validateDeletion.validateInvoiceDeletion).toHaveBeenCalledWith(userId, invoiceId);
            expect(Sentry.captureException).toHaveBeenCalledWith(error);
            expect(s3Service.deleteFile).not.toHaveBeenCalled();
            expect(InvoiceService.deleteInvoiceById).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(409);
            resolve();
        });
        res.status.mockImplementation(() => res);

        invoiceController.deleteInvoiceById(req, res);
    });
  });

  test("should return 500 if validation throws an unexpected error", () => { 
     return new Promise(resolve => {
        const error = new Error("Some unexpected validation error");
        validateDeletion.validateInvoiceDeletion.mockRejectedValue(error);

        res.json.mockImplementation(() => {
             expect(validateDeletion.validateInvoiceDeletion).toHaveBeenCalledWith(userId, invoiceId);
             expect(Sentry.captureException).toHaveBeenCalledWith(error);
             expect(s3Service.deleteFile).not.toHaveBeenCalled();
             expect(InvoiceService.deleteInvoiceById).not.toHaveBeenCalled();
             expect(res.status).toHaveBeenCalledWith(500);
             resolve();
        });
        res.status.mockImplementation(() => res);

        invoiceController.deleteInvoiceById(req, res);
     });
  });

  test("should return 200 and delete file if invoice has file_url and S3 deletion succeeds", () => { 
    return new Promise(resolve => {
      res.json.mockImplementation((responseBody) => {
        expect(validateDeletion.validateInvoiceDeletion).toHaveBeenCalledWith(userId, invoiceId);
        expect(s3Service.deleteFile).toHaveBeenCalledWith(fileKey);
        
        expect(InvoiceService.deleteInvoiceById).toHaveBeenCalledWith(invoiceId);
        expect(Sentry.captureMessage).toHaveBeenCalledWith(
          `Invoice ${invoiceId} successfully deleted by ${userId}`
        );
        expect(Sentry.captureException).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(responseBody).toEqual({ message: "Invoice successfully deleted" });
        
        resolve(); 
      });

      res.status.mockImplementation(() => res);

      validateDeletion.validateInvoiceDeletion.mockResolvedValue(mockInvoiceWithFile);
      s3Service.deleteFile.mockResolvedValue({ success: true });
      InvoiceService.deleteInvoiceById.mockResolvedValue({ affectedRows: 1 });

      invoiceController.deleteInvoiceById(req, res);
    });
  });

  test("should return 500 if S3 file deletion fails", () => { 
     return new Promise(resolve => {
        const s3Error = { code: 'SomeS3Error', message: 'Failed accessing S3' };
        const expectedErrorInS3Logic = expect.objectContaining({ message: "Failed to delete file from S3" });
      
        res.json.mockImplementation((responseBody) => {
             expect(validateDeletion.validateInvoiceDeletion).toHaveBeenCalledWith(userId, invoiceId);
             expect(s3Service.deleteFile).toHaveBeenCalledWith(fileKey);

             expect(Sentry.captureException).toHaveBeenCalledWith(expectedErrorInS3Logic);

             expect(Sentry.captureException).toHaveBeenCalledTimes(2); 

             expect(InvoiceService.deleteInvoiceById).not.toHaveBeenCalled();
             expect(res.status).toHaveBeenCalledWith(500);
             expect(responseBody).toEqual({ message: "Internal server error" });
             resolve();
        });
        res.status.mockImplementation(() => res);

        validateDeletion.validateInvoiceDeletion.mockResolvedValue(mockInvoiceWithFile);
        s3Service.deleteFile.mockResolvedValue({ success: false, error: s3Error });

        invoiceController.deleteInvoiceById(req, res);
     });
  });

  test("should return 200 and NOT call S3 delete if invoice has no file_url", () => { 
    return new Promise(resolve => {
      res.json.mockImplementation((responseBody) => {
        expect(validateDeletion.validateInvoiceDeletion).toHaveBeenCalledWith(userId, invoiceId);
        expect(s3Service.deleteFile).not.toHaveBeenCalled(); 
        expect(InvoiceService.deleteInvoiceById).toHaveBeenCalledWith(invoiceId);
        expect(Sentry.captureMessage).toHaveBeenCalledWith(
          `Invoice ${invoiceId} successfully deleted by ${userId}`
        );
        expect(Sentry.captureException).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(responseBody).toEqual({ message: "Invoice successfully deleted" });
        resolve();
      });
      res.status.mockImplementation(() => res);

      validateDeletion.validateInvoiceDeletion.mockResolvedValue(mockInvoiceWithoutFile);
      InvoiceService.deleteInvoiceById.mockResolvedValue({ affectedRows: 1 });

      invoiceController.deleteInvoiceById(req, res);
    });
  });

  test("should return 500 if InvoiceService.deleteInvoiceById fails (after successful validation/S3)", () => { 
    return new Promise(resolve => {
      const dbError = new Error("Database deletion failed");

      res.json.mockImplementation((responseBody) => {
        expect(validateDeletion.validateInvoiceDeletion).toHaveBeenCalledWith(userId, invoiceId);
        expect(s3Service.deleteFile).not.toHaveBeenCalled(); 
        expect(InvoiceService.deleteInvoiceById).toHaveBeenCalledWith(invoiceId); 
        expect(Sentry.captureException).toHaveBeenCalledWith(dbError); 
        expect(Sentry.captureMessage).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(responseBody).toEqual({ message: "Internal server error" });
        resolve();
      });
      res.status.mockImplementation(() => res);

      validateDeletion.validateInvoiceDeletion.mockResolvedValue(mockInvoiceWithoutFile);
      InvoiceService.deleteInvoiceById.mockRejectedValue(dbError);

      invoiceController.deleteInvoiceById(req, res);
    });
  });


});