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
        },
        {
            name: "swjsh-agent-runner",
            script: "npx",
            args: "tsx scripts/agent_runner.ts",
            env: {
                NODE_ENV: "production"
            },
            autorestart: true,
            max_restarts: 10,
            min_uptime: "10s",
            restart_delay: 5000,
            watch: false,
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
            error_file: "./logs/agent-runner-err.log",
            out_file: "./logs/agent-runner-out.log",
            merge_logs: true
        }
    ]
};
