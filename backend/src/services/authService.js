require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

exports.authenticate = async (clientId, clientSecret) => {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const query = `
      SELECT client_id, client_secret 
      FROM partner 
      WHERE client_id = ? AND client_secret = ?
    `;
    const [rows] = await connection.execute(query, [clientId, clientSecret]);
    return rows.length > 0;
  } finally {
    await connection.end();
  }
};
