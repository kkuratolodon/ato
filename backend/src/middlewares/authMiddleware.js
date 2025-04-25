const authService = require('../services/authService');
const Sentry = require("../instrument");

module.exports = async (req, res, next) => {
  try {
    // Ambil client_id dan client_secret dari headers
    const { client_id, client_secret } = req.headers;

    Sentry.addBreadcrumb({
      category: 'auth',
      message: `Authentication attempt for client_id: ${client_id}`,
      level: 'info'
    });

    // 1. Pastikan kredensial ada
    if (!client_id || !client_secret) {
      return res.status(401).json({ message: 'Unauthorized: Missing credentials' });
    }

    // 2. Panggil authService untuk cek ke DB
    const partner = await authService.authenticate(client_id, client_secret);
    if (!partner) {
      return res.status(401).json({ message: 'Unauthorized: Invalid credentials' });
    }

    // 3. Simpan data partner yaitu uuid ke req.user
    req.user = partner;

    Sentry.setUser({ id: partner.uuid });
    next();

  } catch (error) {
    console.error('Error in authMiddleware:', error);

    Sentry.captureException(error, {
      extra: {
        client_id: req.headers.client_id,
        path: req.path
      }
    });

    return res.status(500).json({ message: 'Internal Server Error' });
  }
};
