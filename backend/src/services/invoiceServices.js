class InvoiceService {
    constructor() {}
  
    async uploadInvoice(file) {
      return {
        message: "Invoice upload service called",
        filename: file.originalname
      };
    }
  }
  
module.exports = new InvoiceService();
  