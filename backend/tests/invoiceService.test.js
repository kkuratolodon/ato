const mysql = require('mysql2/promise');
const invoiceService = require('../src/services/invoiceService');

jest.mock('mysql2/promise');

describe('Invoice Service - authenticate', () => {
  let mockConnection, mockExecute;

  beforeEach(() => {
    mockExecute = jest.fn();
    mockConnection = {
      execute: mockExecute,
      end: jest.fn()
    };
    mysql.createConnection.mockResolvedValue(mockConnection);
  });

  test('should return true if client_id and client_secret match the database', async () => {
    mockExecute.mockResolvedValue([[{ client_id: 'valid_id', client_secret: 'valid_secret' }]]);
    
    const result = await invoiceService.authenticate('valid_id', 'valid_secret');
    
    expect(mysql.createConnection).toHaveBeenCalledWith({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    expect(mockExecute).toHaveBeenCalledWith(expect.any(String), ['valid_id', 'valid_secret']);
    expect(result).toBe(true);
  });

  test('should return false if client_id and client_secret do not match the database', async () => {
    mockExecute.mockResolvedValue([[]]);
    
    const result = await invoiceService.authenticate('invalid_id', 'invalid_secret');
    
    expect(mysql.createConnection).toHaveBeenCalledWith({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    expect(mockExecute).toHaveBeenCalledWith(expect.any(String), ['invalid_id', 'invalid_secret']);
    expect(result).toBe(false);
  });

  test('should throw an error if there is a problem with the database connection', async () => {
    mockExecute.mockRejectedValue(new Error('Test error'));
    
    await expect(invoiceService.authenticate('any_id', 'any_secret')).rejects.toThrow('Test error');
    
    expect(mysql.createConnection).toHaveBeenCalledWith({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    expect(mockExecute).toHaveBeenCalledWith(expect.any(String), ['any_id', 'any_secret']);
  });
});