const { uploadInvoice } = require('../src/controllers/invoiceController');
const invoiceService = require('../src/services/invoiceService');
const { mockRequest, mockResponse } = require('jest-mock-req-res');

jest.mock('../src/services/invoiceService');

describe('Invoice Controller - uploadInvoice', () => {
  let req, res;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
  });

  test('should return 200 OK if authentication is successful', async () => {
    req.body = { client_id: 'valid_id', client_secret: 'valid_secret' };
    invoiceService.authenticate.mockResolvedValue(true);

    await uploadInvoice(req, res);

    expect(invoiceService.authenticate).toHaveBeenCalledWith('valid_id', 'valid_secret');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Invoice upload service called" });
  });

  test('should return 401 Unauthorized if authentication fails', async () => {
    req.body = { client_id: 'invalid_id', client_secret: 'invalid_secret' };
    invoiceService.authenticate.mockResolvedValue(false);

    await uploadInvoice(req, res);

    expect(invoiceService.authenticate).toHaveBeenCalledWith('invalid_id', 'invalid_secret');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });

  test('should return 500 Internal Server Error if an error occurs', async () => {
    req.body = { client_id: 'any_id', client_secret: 'any_secret' };
    invoiceService.authenticate.mockRejectedValue(new Error('Test error'));

    await uploadInvoice(req, res);

    expect(invoiceService.authenticate).toHaveBeenCalledWith('any_id', 'any_secret');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });
});