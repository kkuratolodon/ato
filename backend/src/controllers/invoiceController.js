const  invoiceService = require('../services/invoiceServices');
const multer = require('multer');

const upload = multer();

exports.uploadInvoice = async (req,res) => {
    try{
        if(!req.file){
            return res.status(400).json({message: "No file uploaded"})
        }
        const result = await invoiceService.uploadInvoice(req.file);
        return res.status(501).json(result); // status 501 = not implemented  
    } catch(error){
        return res.status(500).json({message: "Internal server error"})
    }
}

exports.uploadMiddleware = upload.single('file');