function safeResponse(res, status, message) {
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  }
  
module.exports = { safeResponse };
  