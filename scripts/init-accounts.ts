/**
 * Initialize Agent Accounts
 * Creates individual accounts for all agents and allocates starting capital
 */

import fs from 'fs';
import path from 'path';
import {
    initializeAccountSystem,
    createAccount,
    transfer,
    getAccount,
    getSystemSummary
} from '../src/lib/accounts';

const AGENTS_DB_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'agents', 'agents_db.json');

interface AgentConfig {
    meta: {
        name: string;
        type: string;
    };
}

function main() {
    console.log('🚀 Initializing Account Management System...\n');

    // Initialize system with $100k master account
    initializeAccountSystem(100000);
    console.log('✓ Master account created with $100,000\n');

    // Load agent configurations
    if (!fs.existsSync(AGENTS_DB_PATH)) {
        console.log('⚠️  agents_db.json not found, skipping agent account creation');
        return;
    }

    const agentsData = JSON.parse(fs.readFileSync(AGENTS_DB_PATH, 'utf8'));

    // Define capital allocation per agent type
    const ALLOCATIONS: Record<string, number> = {
        'fx': 15000,        // Sterling - Forex
        'crypto': 10000,    // Bitcoin Bob - Crypto
        'futures': 15000,   // Pivot Pete - Futures
        'boba': 10000,      // Boba - Options
        'spx': 10000,       // SPX Sniper - 0DTE Options
        'orb': 15000,       // ORB Runner - Futures
    };

    const tradingAgents = Object.entries(agentsData)
        .filter(([id]) => !['professor', 'auditor', 'overseer'].includes(id));

    console.log(`Found ${tradingAgents.length} trading agents:\n`);

    // Create accounts for each agent
    for (const [agent_id, agent] of tradingAgents) {
        const agentData = agent as AgentConfig;
        const agentName = agentData.meta?.name || agent_id;
        const allocation = ALLOCATIONS[agent_id] || 5000;

        // Check if account already exists
        let account = getAccount(agent_id);

        if (account) {
            console.log(`  ⏭️  ${agentName} (${agent_id}) - Account already exists`);
            console.log(`     Balance: $${account.current_balance.toLocaleString()}`);
            console.log(`     Equity: $${account.total_equity.toLocaleString()}\n`);
            continue;
        }

        // Create new account
        account = createAccount({
            id: agent_id,
            name: `${agentName} Account`,
            type: 'AGENT',
            initial_balance: 0
        });

        console.log(`  ✓ Created account for ${agentName} (${agent_id})`);

        // Transfer funds from master
        try {
            transfer('master', agent_id, allocation, `Initial allocation to ${agentName}`);
            console.log(`     Allocated: $${allocation.toLocaleString()}\n`);
        } catch (error: any) {
            console.log(`     ❌ Transfer failed: ${error.message}\n`);
        }
    }

    // Display system summary
    console.log('─'.repeat(60));
    console.log('📊 System Summary:\n');

    const summary = getSystemSummary();

    console.log(`  Total System Equity:    $${summary.total_equity.toLocaleString()}`);
    console.log(`  Master Account Balance: $${summary.master_account?.current_balance.toLocaleString()}`);
    console.log(`  Agent Accounts:         ${summary.agent_count}`);
    console.log(`  Total Allocated:        $${summary.total_allocated.toLocaleString()}`);
    console.log(`  Total Available:        $${summary.total_available.toLocaleString()}`);
    console.log(`  Capital Utilization:    ${summary.utilization_rate.toFixed(2)}%`);

    console.log('\n✨ Account initialization complete!\n');
    console.log('Next steps:');
    console.log('  1. Run `npm run dev` to start the dashboard');
    console.log('  2. Visit http://localhost:3000/accounts to view accounts');
    console.log('  3. Visit http://localhost:3000/command-center for live monitoring\n');
}

// Run initialization
try {
    main();
} catch (error: any) {
    console.error('❌ Error during initialization:', error.message);
    console.error(error.stack);
    process.exit(1);
}
