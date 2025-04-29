const QpdfDecryption = require('../../src/strategies/qpdfDecryption');
const PDFDecryptionStrategy = require('../../src/strategies/pdfDecryptionStrategy');
const fs = require('fs');
const { exec } = require('child_process');

// Mock dependencies
jest.mock('child_process', () => ({ exec: jest.fn() }));
jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue(Buffer.from('decrypted pdf content')),
  existsSync: jest.fn().mockReturnValue(true),
  unlinkSync: jest.fn(),
  rmSync: jest.fn(),
  lstatSync: jest.fn().mockReturnValue({ isDirectory: jest.fn().mockReturnValue(false) })
}));

describe('QpdfDecryption', () => {
  let qpdfDecryption;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default exec mock that simulates QPDF availability
    exec.mockImplementation((command, callback) => {
      callback(null, 'QPDF version 10.6.3', '');
      return { on: jest.fn() };
    });
    
    qpdfDecryption = new QpdfDecryption();
    
    // Set qpdf as available for most tests
    qpdfDecryption.isQpdfAvailable = true;
  });
  
  test('initialization and availability detection', () => {
    // Test initial state
    exec.mockImplementation(() => ({ on: jest.fn() }));
    const freshDecryption = new QpdfDecryption();
    expect(freshDecryption.isQpdfAvailable).toBe(false);
    
    // Test availability detection - must create separate instances to test callbacks
    const availableInstance = new QpdfDecryption();
    const unavailableInstance = new QpdfDecryption();
    
    // Reset mock to properly capture callback functions
    const availableCallback = exec.mock.calls[exec.mock.calls.length - 2][1];
    const unavailableCallback = exec.mock.calls[exec.mock.calls.length - 1][1];
    
    // QPDF available
    availableCallback(null, 'QPDF version 10.6.3', '');
    expect(availableInstance.isQpdfAvailable).toBe(true);
    
    // QPDF not available
    unavailableCallback(new Error('Command not found'), '', 'Command not found');
    expect(unavailableInstance.isQpdfAvailable).toBe(false);
  });
  
  test('execCommand functionality', async () => {
    // Success case
    await expect(qpdfDecryption.execCommand('qpdf --decrypt')).resolves.not.toThrow();
    
    // QPDF not available
    qpdfDecryption.isQpdfAvailable = false;
    await expect(qpdfDecryption.execCommand('qpdf --decrypt')).rejects.toThrow('QPDF is not installed');
    
    // Command failure
    qpdfDecryption.isQpdfAvailable = true;
    exec.mockImplementation((command, callback) => {
      callback(new Error('Command failed'), '', 'Error output');
      return { on: jest.fn() };
    });
    await expect(qpdfDecryption.execCommand('qpdf --decrypt')).rejects.toThrow('Failed to decrypt PDF: Error output');
  });
  
  test('decrypt method scenarios', async () => {
    const pdfBuffer = Buffer.from('encrypted pdf content');
    const password = 'password123';
    
    // Mock execCommand to isolate tests
    qpdfDecryption.execCommand = jest.fn().mockResolvedValue(undefined);
    
    // Input validation
    await expect(qpdfDecryption.decrypt('not a buffer', password)).rejects.toThrow('Invalid input: Expected a Buffer.');
    
    // Successful decryption
    const result = await qpdfDecryption.decrypt(pdfBuffer, password);
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(qpdfDecryption.execCommand).toHaveBeenCalledWith(expect.stringContaining(`--password=${password} --decrypt`));
    expect(result).toEqual(Buffer.from('decrypted pdf content'));
    
    // Output file missing
    fs.existsSync.mockImplementation(path => !path.includes('decrypted.pdf'));
    await expect(qpdfDecryption.decrypt(pdfBuffer, password)).rejects.toThrow('Output file not created');
    
    // Error handling
    const errorCases = [
      { error: 'Invalid password', expectedMessage: 'Incorrect password' },
      { error: 'PDF header not found', expectedMessage: 'Corrupted file' },
      { error: 'not a PDF file', expectedMessage: 'Corrupted file' },
      { error: 'Unknown error', expectedMessage: 'Unknown error' }
    ];
    
    for (const { error, expectedMessage } of errorCases) {
      qpdfDecryption.execCommand = jest.fn().mockRejectedValue(new Error(error));
      await expect(qpdfDecryption.decrypt(pdfBuffer, password)).rejects.toThrow(expectedMessage);
    }
    
    // Cleanup is called even on error
    const cleanupSpy = jest.spyOn(qpdfDecryption, 'cleanupFiles');
    qpdfDecryption.execCommand = jest.fn().mockRejectedValue(new Error('Decryption failed'));
    try { await qpdfDecryption.decrypt(pdfBuffer, password); } catch (e) { /* ignore */ }
    expect(cleanupSpy).toHaveBeenCalled();
  });
  
  test('cleanupFiles functionality', () => {
    // File removal
    qpdfDecryption.cleanupFiles(['/tmp/test.pdf']);
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/test.pdf');
    
    // Directory removal
    fs.lstatSync.mockReturnValue({ isDirectory: jest.fn().mockReturnValue(true) });
    qpdfDecryption.cleanupFiles(['/tmp/test-dir']);
    expect(fs.rmSync).toHaveBeenCalledWith('/tmp/test-dir', { recursive: true, force: true });
    
    // Non-existent path
    fs.existsSync.mockReturnValue(false);
    qpdfDecryption.cleanupFiles(['/non-existent']);
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1); // Should not increase
    
    // Error handling
    fs.existsSync.mockReturnValue(true);
    fs.lstatSync.mockReturnValue({ isDirectory: jest.fn().mockReturnValue(false) });
    fs.unlinkSync.mockImplementation(() => { throw new Error('Permission denied'); });
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    qpdfDecryption.cleanupFiles(['/tmp/test.pdf']);
    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });
  
  test('class inheritance', () => {
    expect(qpdfDecryption).toBeInstanceOf(PDFDecryptionStrategy);
  });
});