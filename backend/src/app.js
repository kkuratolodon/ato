const express = require('express');
const analyzeRoute = require('./routes/analyzeInvoiceRoute');

const app = express();

app.use(express.json());

app.use('/api/invoices', analyzeRoute);

app.disable('x-powered-by');

module.exports = app;
