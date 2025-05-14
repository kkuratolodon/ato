// ecosystem.production.js
module.exports = {
    apps: [
        {
            name: 'invoice-ocr-production',
            script: 'server.js',
            instances: 2,
            exec_mode: 'cluster',
            autorestart: true,
            watch: false,
            ignore_watch: ['node_modules', 'uploads', 'logs'],
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            },
            error_file: './logs/production-err.log',
            out_file: './logs/production-out.log',
            log_file: './logs/production-combined.log',
            time: true,
            merge_logs: true
        }
    ]
};