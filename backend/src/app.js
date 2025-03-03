const express = require('express');
const helloRoute = require('./routes/helloRoute');
const analyzeRoute = require('./routes/analyzeInvoiceRoute');

const app = express();

app.use(express.json());

app.use('/api/hello', helloRoute);
app.use('/api/invoices', analyzeRoute);

app.disable('x-powered-by');

module.exports = app;
