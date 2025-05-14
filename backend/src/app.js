const express = require('express');
const invoiceRoutes = require('./routes/invoiceRoute');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoute');
const healthRoutes = require('./routes/healthRoute');

const app = express();
app.disable("x-powered-by");

app.use(express.json());

app.use('/health', healthRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);

module.exports = app;
halo2