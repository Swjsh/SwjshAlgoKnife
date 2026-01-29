module.exports = {
    apps: [
        {
            name: "AK-Dashboard",
            script: "npm",
            args: "run start",
            env: {
                NODE_ENV: "production",
                PORT: 3000
            },
            watch: false,
            autorestart: true,
            max_memory_restart: "1G"
        },
        {
            name: "AK-Runner",
            script: "npx",
            args: "ts-node scripts/agent_runner.ts",
            env: {
                NODE_ENV: "production"
            },
            watch: false,
            autorestart: true,
            max_memory_restart: "500M"
        }
    ]
};
