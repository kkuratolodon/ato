const invoiceService = require('../../src/services/invoiceServices');

describe('invoiceServices', () => {
  test('harus mengembalikan objek yang benar ketika uploadInvoice dipanggil', async () => {
    const mockFile = { originalname: 'test-file.pdf' };
    const result = await invoiceService.uploadInvoice(mockFile);

    expect(result).toEqual({
      message: "Invoice upload service called",
      filename: "test-file.pdf"
    });
  });

});
