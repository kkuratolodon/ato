const express = require('express');
const helloRoute = require('./routes/helloRoute');
const invoiceRoute = require('./routes/invoiceRoutes');

const app = express();

app.use(express.json());

app.use('/api/hello', helloRoute);
app.use('/api/invoices', invoiceRoute);

module.exports = app;
