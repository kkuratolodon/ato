// ecosystem.staging.js
module.exports = {
    apps: [
        {
            name: 'invoice-ocr-staging',
            script: 'server.js',
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            watch: false,
            ignore_watch: ['node_modules', 'uploads', 'logs'],
            max_memory_restart: '512M',
            env_file: '.env',
            env: {
                NODE_ENV: 'staging',
                PORT: 3000
            },
            error_file: './logs/staging-err.log',
            out_file: './logs/staging-out.log',
            log_file: './logs/staging-combined.log',
            time: true,
            merge_logs: true
        }
    ]
};