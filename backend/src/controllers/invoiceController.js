const  InvoiceService = require('../services/invoiceServices');

exports.uploadInvoice = async (req,res) => {
    try{
        const result = await InvoiceService.uploadInvoice();
        return res.status(501).json(result); // status 501 = not implemented  
    } catch(error){
        return res.status(500).json({message: "Internal server error"})
    }
}