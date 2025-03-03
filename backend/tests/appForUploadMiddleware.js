const express = require('express');
const { uploadMiddleware } = require('../src/controllers/invoiceController');
const app = express();

app.post('/test-upload', uploadMiddleware, (req, res) => {
  return res.status(200).json({ message: 'File uploaded successfully' });
});

module.exports = app;
