require('dotenv').config();

module.exports = {
    development: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql'
    },
    test: {
        username: process.env.DB_USER || 'test_user',
        password: process.env.DB_PASSWORD || 'test_pass',
        database: process.env.DB_NAME || 'test_db',
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false
    },
    staging: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql'
    },
    production: {
        username: process.env.DB_USER_PROD,
        password: process.env.DB_PASSWORD_PROD,
        database: process.env.DB_NAME_PROD,
        host: process.env.DB_HOST_PROD,
        port: process.env.DB_PORT_PROD || 3306,
        dialect: 'mysql'
    }
};
