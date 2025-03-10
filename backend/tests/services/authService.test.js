const authService = require('../../src/services/authService');
const mysql = require('mysql2/promise');

// Mock mysql2/promise agar tidak benar-benar terhubung ke DB
jest.mock('mysql2/promise');

describe('authService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('harus mengembalikan null jika clientId atau clientSecret undefined', async () => {
    const result1 = await authService.authenticate(undefined, 'secret');
    const result2 = await authService.authenticate('clientId', undefined);

    expect(result1).toBeNull();
    expect(result2).toBeNull();
  });

  test('harus mengembalikan objek partner jika hasil query mengembalikan rows > 0', async () => {
    const mockConnection = {
      execute: jest.fn().mockResolvedValue([
        [{ uuid: 'uuid1', client_id: 'client1', client_secret: 'secret1' }] // 1 row
      ]),
      end: jest.fn()
    };
    mysql.createConnection.mockResolvedValue(mockConnection);

    const result = await authService.authenticate('client1', 'secret1');
    // Kode authService mengembalikan rows[0] => objek partner
    expect(result).toEqual({
      uuid: 'uuid1',
      client_id: 'client1',
      client_secret: 'secret1'
    });
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.any(String),
      ['client1', 'secret1']
    );
    expect(mockConnection.end).toHaveBeenCalled();
  });

  test('harus mengembalikan null jika hasil query mengembalikan rows = 0', async () => {
    const mockConnection = {
      execute: jest.fn().mockResolvedValue([[]]), // 0 row
      end: jest.fn()
    };
    mysql.createConnection.mockResolvedValue(mockConnection);

    const result = await authService.authenticate('client2', 'secret2');
    expect(result).toBeNull();
    expect(mockConnection.execute).toHaveBeenCalledWith(
      expect.any(String),
      ['client2', 'secret2']
    );
    expect(mockConnection.end).toHaveBeenCalled();
  });

  test('harus melempar error jika createConnection gagal', async () => {
    mysql.createConnection.mockRejectedValue(new Error('DB Connection Error'));

    await expect(
      authService.authenticate('client', 'secret')
    ).rejects.toThrow('DB Connection Error');
  });
});
