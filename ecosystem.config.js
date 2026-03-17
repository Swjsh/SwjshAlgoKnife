module.exports = {
    apps: [
        {
            name: "algo-knife",
            script: "npm",
            args: "start",
            env: {
                NODE_ENV: "production",
                PORT: 3000
            },
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "1G",
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
            error_file: "./logs/err.log",
            out_file: "./logs/out.log",
            merge_logs: true
        }
    ]
};
