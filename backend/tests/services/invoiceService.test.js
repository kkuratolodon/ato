const invoiceService = require('../../src/services/invoiceServices');
const s3Service = require('../../src/services/s3Service');
const { Invoice } = require('../../src/models/invoice')

jest.mock('../../src/services/s3Service');
jest.mock('../../src/models/invoice', () => ({
  Invoice: {
    create: jest.fn()
  }
}))

const fs = require('fs');
const path = require('path');

const TEST_FILE_PATH = path.join(__dirname, '..', 'test-files', 'test-invoice.pdf');
const TEST_FILE = { originalname: 'test-file.pdf', buffer: fs.readFileSync(TEST_FILE_PATH) };
const TEST_S3_URL = 'https://s3.amazonaws.com/test-bucket/test-file.pdf'; 


describe('Invoice Service - Upload Invoice', () => {
    test('should return invoice object when upload is success', async () => {
      const mockS3Url = TEST_S3_URL; 
      s3Service.uploadFile.mockResolvedValue(mockS3Url);

      const mockInvoice = { 
        partner_id: 1, 
        file_url: 'test-file.pdf', 
        status: 'uploading'
      };
      Invoice.create.mockResolvedValue(mockInvoice); 

      const fileBuffer = Buffer.from("dummy file data"); 
      const result = await invoiceService.uploadInvoice(fileBuffer); 

      expect(s3Service.uploadFile).toHaveBeenCalledWith(fileBuffer);
      expect(Invoice.create).toHaveBeenCalledWith({ ...invoiceData, file_url: mockS3Url });
      expect(result).toEqual(mockInvoice);
    });

    test('should raise error when no file provided', async () => {
      const mockFile = null;

      await expect(invoiceService.uploadInvoice(mockFile)).rejects.toThrow("File not found");
    });

    test('should raise error when SS3 upload fails', async () => {
      s3Service.uploadFile.mockRejectedValue(new Error("Failed to upload file to S3"));

      const mockFile = TEST_FILE;
      await expect(invoiceService.uploadInvoice(mockFile)).rejects.toThrow("Failed to upload file to S3");
    });

    test('should raise error when saving to database fails', async () => {
      const mockS3Url = TEST_S3_URL; 
      s3Service.uploadFile.mockResolvedValue(mockS3Url);
      
      Invoice.create.mockRejectedValue("Failed to save file to database")

      const mockFile = TEST_FILE;
      await expect(invoiceService.uploadInvoice(mockFile)).rejects.toThrow("Failed to save file to database");
    });
});