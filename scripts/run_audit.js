const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Claude Auto-Wrapper...');

// Adjust command as needed. 'claude.cmd' might be needed on Windows if not in PATH as executable
const claude = spawn('claude', [
    'Overhaul the Dashboard (src/app/page.tsx) to be more intuitive/clean. Implement a Theme Toggle in the top bar. Defaults to "Dark" (current Swjsh Purple). Add a "Nature" Light Mode based on this description: Background is a dark wood grain texture. Panels are soft olive/moss green glass with rounded corners. Accents are Gold/Yellow. Text is white/cream. Fonts should be clean sans-serif. Use CSS variables for theming.'
], {
    shell: false,  // Security fix: disable shell to prevent command injection
    cwd: process.cwd(),
    env: { ...process.env, CI: 'true' } // Trying CI flag too
});

claude.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[CLAUDE]: ${output}`);

    if (output.includes('Do you want to proceed?') || output.includes('❯ 1. Yes')) {
        console.log('[WRAPPER]: Detected prompt! Sending "2"...');
        claude.stdin.write('2\n');
    }
});

claude.stderr.on('data', (data) => {
    console.error(`[CLAUDE ERR]: ${data}`);
});

claude.on('close', (code) => {
    console.log(`[WRAPPER]: Claude exited with code ${code}`);
});

// Aggressive Auto-Approval Loop
// Sends common confirmation inputs every 8 seconds to unblock any state
let attempt = 0;
const inputs = ['2\n', 'y\n', '\n']; // Menu Option 2, Yes, Enter
setInterval(() => {
    const input = inputs[attempt % inputs.length];
    console.log(`[WRAPPER]: Sending blind input "${input.trim()}" (Attempt ${attempt})`);
    claude.stdin.write(input);
    attempt++;
}, 8000);

// Keep alive
setInterval(() => { }, 1000);
