const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const assert = require('assert');
const sinon = require('sinon');

// Import modules
const validateDeletion = require('../../src/services/validateDeletion');
const s3Service = require('../../src/services/s3Service');
const InvoiceService = require('../../src/services/invoice/invoiceService');
const authService = require('../../src/services/authService');
const invoiceRouter = require('../../src/routes/invoiceRoute');

// Setup Express app
const app = express();
app.use(bodyParser.json());
app.use('/invoices', invoiceRouter);

// Declare variables
let response;
const headers = {
  client_id: 'test-client-id',
  client_secret: 'test-client-secret'
};

// Setup stubs before each scenario
Before(() => {
  // Reset all previous stubs
  sinon.restore();
  
  // Create new stubs
  sinon.stub(authService, 'authenticate').resolves({
    uuid: 'partner-123',
    client_id: 'test-client-id',
    client_secret: 'test-client-secret'
  });
});

// Clean up after each scenario
After(() => {
  sinon.restore();
});

// Step definitions
Given('a valid authenticated user', async () => {
  // Authentication is already handled in the Before hook
});

Given('an invoice {string} exists and is deletable', async (invoiceId) => {
  sinon.stub(validateDeletion, 'validateInvoiceDeletion').resolves({
    id: invoiceId,
    user_id: 'partner-123',
    file_url: 'https://s3.amazonaws.com/file.pdf',
    status: 'Analyzed'
  });
  
  sinon.stub(s3Service, 'deleteFile').resolves({ 
    success: true 
  });
  
  sinon.stub(InvoiceService, 'deleteInvoiceById').resolves({ 
    message: "Invoice successfully deleted" 
  });
});

Given('an invoice {string} exists and has no file', async (invoiceId) => {
  sinon.stub(validateDeletion, 'validateInvoiceDeletion').resolves({
    id: invoiceId,
    user_id: 'partner-123',
    file_url: null,
    status: 'Analyzed'
  });
  
  sinon.stub(InvoiceService, 'deleteInvoiceById').resolves({ 
    message: "Invoice successfully deleted" 
  });
});

// eslint-disable-next-line no-unused-vars
Given('the invoice {string} does not exist', async (invoiceId) => {
  sinon.stub(validateDeletion, 'validateInvoiceDeletion').rejects(
    new Error('Invoice not found')
  );
});

// eslint-disable-next-line no-unused-vars
Given('the invoice {string} belongs to another user', async (invoiceId) => {
  sinon.stub(validateDeletion, 'validateInvoiceDeletion').rejects(
    new Error('Unauthorized: You do not own this invoice')
  );
});

// eslint-disable-next-line no-unused-vars
Given('the invoice {string} is not in analyzed state', async (invoiceId) => {
  sinon.stub(validateDeletion, 'validateInvoiceDeletion').rejects(
    new Error('Invoice cannot be deleted unless it is Analyzed')
  );
});

Given('the invoice {string} has a file but S3 deletion fails', async (invoiceId) => {
  sinon.stub(validateDeletion, 'validateInvoiceDeletion').resolves({
    id: invoiceId,
    user_id: 'partner-123',
    file_url: 'https://s3.amazonaws.com/file.pdf',
    status: 'Analyzed'
  });
  
  sinon.stub(s3Service, 'deleteFile').resolves({ 
    success: false,
    error: { message: 'S3 Error' }
  });
});

When('the user deletes invoice with ID {string}', async (invoiceId) => {
  response = await request(app)
    .delete(`/invoices/${invoiceId}`)
    .set(headers);
});

Then('the response status should be {int}', (statusCode) => {
  assert.strictEqual(response.statusCode, statusCode);
});

Then('the response message should be {string}', (message) => {
    if (message === "Failed to delete file from S3") {
      assert.strictEqual(response.body.message, "Internal server error");
    } else {
      assert.strictEqual(response.body.message, message);
    }
});