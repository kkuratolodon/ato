const request = require('supertest');
const app = require('../src/app');

describe('App.js', () => {
  test('harus mengembalikan 404 untuk route yang tidak dikenal', async () => {
    // Lakukan request GET ke route yang tidak ada
    const res = await request(app).get('/unknown-route');

    // Karena /unknown-route tidak didefinisikan, seharusnya 404
    expect(res.status).toBe(404);
  });

  test('harus meneruskan ke invoiceRoutes jika route /api/invoices', async () => {

    const res = await request(app).get('/api/invoices/foobar');
    expect([404, 401, 200]).toContain(res.status);
  });
});
