const express = require('express');
const router = express.Router();
const os = require('os');
const { version } = require('../../package.json');

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Get application health status
 *     description: Returns application health status and system information
 *     responses:
 *       200:
 *         description: Application is healthy
 */
router.get('/', (req, res) => {
    const healthData = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        version: version,
        environment: process.env.NODE_ENV || 'development',
        memory: {
            free: Math.round(os.freemem() / 1024 / 1024) + 'MB',
            total: Math.round(os.totalmem() / 1024 / 1024) + 'MB'
        },
        cpu: os.cpus().length
    };

    res.status(200).json(healthData);
});

module.exports = router;