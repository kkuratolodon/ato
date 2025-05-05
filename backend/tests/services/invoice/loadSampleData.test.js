const fs = require('fs').promises;
const path = require('path');
const invoiceService = require('../../../src/services/invoice/invoiceService');

// Use spyOn instead of completely mocking the modules
describe('loadSampleData', () => {
  beforeEach(() => {
    // Use spyOn to mock specific methods instead of replacing the entire modules
    jest.spyOn(fs, 'readFile').mockImplementation(() => Promise.resolve('{"test":"data"}'));
    jest.spyOn(path, 'resolve').mockReturnValue('/mocked/path/to/sample-invoice.json');
    
    // Mock console.error to avoid cluttering test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original implementations
    jest.restoreAllMocks();
  });

  test('should successfully load sample data from file', async () => {
    // Arrange
    const sampleData = { test: 'data' };
    
    // Act
    const result = await invoiceService.loadSampleData();
    
    // Assert
    expect(path.resolve).toHaveBeenCalled();
    expect(fs.readFile).toHaveBeenCalledWith('/mocked/path/to/sample-invoice.json', 'utf8');
    expect(result).toEqual({ data: sampleData });
  });

  test('should throw error when file cannot be read', async () => {
    // Arrange
    const error = new Error('File not found');
    fs.readFile.mockRejectedValue(error);
    
    // Act & Assert
    await expect(invoiceService.loadSampleData())
      .rejects.toThrow('Failed to load sample data: File not found');
    
    expect(console.error).toHaveBeenCalled();
  });

  test('should throw error when JSON is invalid', async () => {
    // Arrange
    fs.readFile.mockResolvedValue('{ "key": "value", invalid json }');
    
    // Act & Assert
    await expect(invoiceService.loadSampleData()).rejects.toThrow();
    expect(console.error).toHaveBeenCalled();
  });
});
