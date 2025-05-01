require("module-alias/register");
const express = require('express');
const invoiceRoutes = require('./routes/invoiceRoute')
const purchaseOrderRoutes = require('./routes/purchaseOrderRoute')
const app = express();
app.disable("x-powered-by");

app.use(express.json());

app.use('/api/invoices', invoiceRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.disable('x-powered-by');
module.exports = app;