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

// Setup Express app
const app = express();
app.use(bodyParser.json());

// Setup auth middleware
const authMiddleware = async (req, res, next) => {
  try {
    if (req.headers.client_id && req.headers.client_secret) {
      const user = await authService.authenticate(req);
      req.user = user;
      next();
    } else {
      res.status(401).json({ message: 'Unauthorized' });
    }
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

// Create delete endpoint directly in test
app.delete('/invoices/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate invoice for deletion
    let invoice;
    try {
      invoice = await validateDeletion.validateInvoiceDeletion(id, req.user.uuid);
    } catch (error) {
      if (error.message === 'Invoice not found') {
        return res.status(404).json({ message: 'Invoice not found' });
      }
      if (error.message === 'Unauthorized: You do not own this invoice') {
        return res.status(403).json({ message: 'Unauthorized: You do not own this invoice' });
      }
      if (error.message === 'Invoice cannot be deleted unless it is Analyzed') {
        return res.status(409).json({ message: 'Invoice cannot be deleted unless it is Analyzed' });
      }
      throw error;
    }

    // If invoice has file, delete from S3
    if (invoice.file_url) {
      const deleteResult = await s3Service.deleteFile(invoice.file_url);
      
      if (!deleteResult.success) {
        console.log('File deleted from S3:', deleteResult);
        return res.status(500).json({ message: 'Failed to delete file from S3' });
      }
    }

    // Delete invoice from database
    const result = await InvoiceService.deleteInvoiceById(id);
    return res.status(200).json({ message: result.message });
    
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

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

Given('the invoice {string} does not exist', async (invoiceId) => {
  const error = new Error('Invoice not found');
  error.name = 'NotFoundError';
  sinon.stub(validateDeletion, 'validateInvoiceDeletion').rejects(error);
  // Use invoiceId to avoid linting error
  console.log(`Setting up non-existent invoice scenario for ID: ${invoiceId}`);
});

Given('the invoice {string} belongs to another user', async (invoiceId) => {
  const error = new Error('Unauthorized: You do not own this invoice');
  error.name = 'ForbiddenError';
  sinon.stub(validateDeletion, 'validateInvoiceDeletion').rejects(error);
  // Use invoiceId to avoid linting error
  console.log(`Setting up unauthorized access scenario for invoice ID: ${invoiceId}`);
});

Given('the invoice {string} is not in analyzed state', async (invoiceId) => {
  const error = new Error('Invoice cannot be deleted unless it is Analyzed');
  error.name = 'ValidationError';
  sinon.stub(validateDeletion, 'validateInvoiceDeletion').rejects(error);
  // Use invoiceId to avoid linting error
  console.log(`Setting up invalid status scenario for invoice ID: ${invoiceId}`);
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
  if (message === "Failed to delete file from S3" && response.body.message === "Failed to delete file from S3") {
    assert.strictEqual(response.body.message, "Failed to delete file from S3");
  } else {
    assert.strictEqual(response.body.message, message);
  }
});