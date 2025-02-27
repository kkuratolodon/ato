class InvoiceService {
    constructor() {}
  
    async uploadInvoice(file) {
      return {
        message: "Invoice upload service called"
      };
    }
  }
  
module.exports = new InvoiceService();
  