const mysql = require('mysql2/promise');
require('dotenv').config();

describe("Database Authentication", () => {
  let connection;

  // Buka koneksi ke database
  beforeAll(async () => {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
  });

  // Menutup koneksi 
  afterAll(async () => {
    if (connection) {
      await connection.end();
    }
  });

  // Fungsi untuk memeriksa kredensial
  async function authenticate(clientId, clientSecret) {
    const query = `
      SELECT client_id, client_secret 
      FROM partner 
      WHERE client_id = ? AND client_secret = ?
    `;
    const [rows] = await connection.execute(query, [clientId, clientSecret]);
    return rows.length > 0 ? 200 : 401;
  }

  test("should return 200 OK if client_id and client_secret match the database", async () => {
    const status = await authenticate(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET
    );
    expect(status).toBe(200);
  });

  test("should return 401 Unauthorized if client_id and client_secret do not match", async () => {
    const status = await authenticate("invalid_id", "invalid_secret");
    expect(status).toBe(401);
  });
});
