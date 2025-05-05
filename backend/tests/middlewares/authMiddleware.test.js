const { mockRequest, mockResponse } = require('jest-mock-req-res');
const authMiddleware = require('../../src/middlewares/authMiddleware');
const authService = require('../../src/services/authService');

jest.mock('../../src/services/authService');

describe('authMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Pastikan req.headers didefinisikan
    req = mockRequest({
      headers: {}
    });
    res = mockResponse();
    next = jest.fn();
    
    jest.clearAllMocks();
  });

  test('harus mengembalikan 401 jika tidak ada credentials di headers', async () => {
    // req.headers kosong
    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unauthorized: Missing credentials'
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('harus mengembalikan 401 jika authService mengembalikan null (invalid credentials)', async () => {
    // Sekarang req.headers sudah ada
    req.headers.client_id = 'invalid_id';
    req.headers.client_secret = 'invalid_secret';

    authService.authenticate.mockResolvedValue(null);

    await authMiddleware(req, res, next);

    expect(authService.authenticate).toHaveBeenCalledWith('invalid_id', 'invalid_secret');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unauthorized: Invalid credentials'
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('harus memanggil next() jika authService mengembalikan partner yang valid', async () => {
    req.headers.client_id = 'valid_id';
    req.headers.client_secret = 'valid_secret';

    const mockPartner = { uuid: 'partner-uuid-123', client_id: 'valid_id', client_secret: 'valid_secret' };
    authService.authenticate.mockResolvedValue(mockPartner);

    await authMiddleware(req, res, next);

    expect(authService.authenticate).toHaveBeenCalledWith('valid_id', 'valid_secret');
    expect(req.user).toEqual(mockPartner);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('harus mengembalikan 500 jika terjadi error tak terduga', async () => {
    req.headers.client_id = 'some_id';
    req.headers.client_secret = 'some_secret';

    authService.authenticate.mockRejectedValue(new Error('Database error'));

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Internal Server Error'
    });
    expect(next).not.toHaveBeenCalled();
  });
});