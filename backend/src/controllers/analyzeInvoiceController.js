const analyzeInvoiceService = require('../services/analyzeInvoiceService');

exports.analyzeInvoice = async (req, res) => {
    try{
        const result = await analyzeInvoiceService.analyzeInvoice();
        return res.status(501).json(result); // status 501 = not implemented  
    } catch(error){
        return res.status(500).json({message: "internal Server Error"})
    }
}