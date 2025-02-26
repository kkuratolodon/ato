const invoiceService = require('../services/invoiceService');

exports.uploadInvoice = async (req, res) => {
  const { client_id, client_secret } = req.body;
  try {
    const isAuthorized = await invoiceService.authenticate(client_id, client_secret);
    if (isAuthorized) {
      return res.status(200).json({ message: "Invoice upload service called" });
    } else {
      return res.status(401).json({ message: "Unauthorized" });
    }
  } catch (error) {
    console.error("Error in uploadInvoice:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
