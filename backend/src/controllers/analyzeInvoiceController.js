const analyzeInvoiceService = require('../services/analyzeInvoiceService');

exports.analyzeInvoice = async (req, res) => {
    const { documentUrl } = req.body;

    if (!documentUrl) {
        return res.status(400).json({ message: "documentUrl is required" });
    }

    try {
        const result = await analyzeInvoiceService.analyzeInvoice(documentUrl);
        res.status(200).json(result);
    } catch (error) {
        if (error.message === "documentUrl is required") {
            res.status(400).json({ message: error.message });
        } else if (error.message === "Invalid PDF URL") {
            res.status(400).json({ message: error.message });
        } else {
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
};