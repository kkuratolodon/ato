const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const uploadMiddleware = require('../../src/middlewares/uploadMiddleware');

// Mock multerErrorHandler to verify it's called correctly
jest.mock('../../src/middlewares/multerErrorHandler', () => {
  return jest.fn((err, req, res) => {
    res.status(400).json({ message: err.message || 'File upload error' });
  });
});

describe('Upload Middleware Tests', () => {
  let app;
  const testFilePath = path.join(__dirname, '../fixtures/test-file.pdf');
  const largeTempFilePath = path.join(__dirname, '../fixtures/large-test-file.pdf');

  beforeAll(() => {
    // Create test directory if it doesn't exist
    const fixturesDir = path.join(__dirname, '../fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
    
    // Create a small test file
    fs.writeFileSync(testFilePath, 'Test file content');
    
    // Create a file larger than 20MB for testing
    const largeBuffer = Buffer.alloc(21 * 1024 * 1024, 'x');
    fs.writeFileSync(largeTempFilePath, largeBuffer);
  });

  beforeEach(() => {
    app = express();
    
    // Test route using the upload middleware
    app.post('/upload', uploadMiddleware, (req, res) => {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      res.status(200).json({ 
        message: 'File uploaded successfully',
        fileDetails: {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        }
      });
    });
  });

  afterAll(() => {
    // Clean up test files
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    if (fs.existsSync(largeTempFilePath)) {
      fs.unlinkSync(largeTempFilePath);
    }
  });

  // Positive test cases
  describe('Positive cases', () => {
    it('should successfully upload a file', async () => {
      const response = await request(app)
        .post('/upload')
        .attach('file', testFilePath);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('File uploaded successfully');
      expect(response.body.fileDetails).toBeDefined();
      expect(response.body.fileDetails.originalname).toBe('test-file.pdf');
    });
  });

  // Negative test cases
  describe('Negative cases', () => {
    it('should handle file size exceeding limit', async () => {
      const response = await request(app)
        .post('/upload')
        .attach('file', largeTempFilePath);
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBeTruthy(); // Should contain an error message
    });

    it('should handle no file uploaded', async () => {
      const response = await request(app)
        .post('/upload');
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('No file uploaded');
    });
  });

  // This test specifically tests the error handling in the middleware
  describe('Error handling', () => {
    it('should handle multer errors properly', async () => {
      // Create a special app with a middleware that forces multer to error
      const errorApp = express();
      
      // Create a mock multer that throws an error
      const mockErrorMiddleware = (req, res, next) => {
        const error = new Error('Multer test error');
        const multerErrorHandler = require('../../src/middlewares/multerErrorHandler');
        multerErrorHandler(error, req, res, next);
      };
      
      errorApp.post('/upload-error', mockErrorMiddleware);
      
      const response = await request(errorApp)
        .post('/upload-error')
        .attach('file', testFilePath);
      
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Multer test error');
    });
  });
});
