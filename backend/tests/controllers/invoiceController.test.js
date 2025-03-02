const { uploadInvoice } = require('../../src/controllers/invoiceController'); 
const invoiceService = require('../../src/services/invoiceServices'); 
const authService = require('../../src/services/authService');      
const { mockRequest, mockResponse } = require('jest-mock-req-res');

jest.mock('../../src/services/invoiceServices');
jest.mock('../../src/services/authService');

describe('Invoice Controller - uploadInvoice', () => {
  let req, res;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
  });

  test('harus mengembalikan status 400 jika tidak ada file yang di-upload', async () => {
    req.file = undefined; 
    req.body = { client_id: 'some_id', client_secret: 'some_secret' };

    await uploadInvoice(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "No file uploaded" });
  });

  test('harus mengembalikan status 401 jika autentikasi gagal', async () => {
    req.file = { originalname: 'test.pdf' };
    req.body = { client_id: 'invalid_id', client_secret: 'invalid_secret' };
    
    authService.authenticate.mockResolvedValue(false);

    await uploadInvoice(req, res);

    expect(authService.authenticate).toHaveBeenCalledWith('invalid_id', 'invalid_secret');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });

  test('harus mengembalikan status 200 dan memanggil invoiceService jika autentikasi berhasil', async () => {
    req.file = { originalname: 'test.pdf' };
    req.body = { client_id: 'valid_id', client_secret: 'valid_secret' };

    authService.authenticate.mockResolvedValue(true);

    invoiceService.uploadInvoice.mockResolvedValue({
      message: 'Invoice upload service called',
      filename: 'test.pdf'
    });

    await uploadInvoice(req, res);

    expect(authService.authenticate).toHaveBeenCalledWith('valid_id', 'valid_secret');
    expect(invoiceService.uploadInvoice).toHaveBeenCalledWith({ originalname: 'test.pdf' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invoice upload service called',
      filename: 'test.pdf'
    });
  });

  test('harus mengembalikan status 500 jika terjadi error saat autentikasi', async () => {
    req.file = { originalname: 'test.pdf' };
    req.body = { client_id: 'any_id', client_secret: 'any_secret' };

    authService.authenticate.mockRejectedValue(new Error('Test error'));

    await uploadInvoice(req, res);

    expect(authService.authenticate).toHaveBeenCalledWith('any_id', 'any_secret');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });
});
