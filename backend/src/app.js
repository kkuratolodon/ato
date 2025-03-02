const express = require('express');
const helloRoute = require('./routes/helloRoute');
const invoiceRoutes = require('./routes/invoiceRoutes')
const app = express();
app.disable("x-powered-by");

app.use(express.json());

app.use('/api/hello', helloRoute);
app.use('/api/invoices',invoiceRoutes);

module.exports = app;
