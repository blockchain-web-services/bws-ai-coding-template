#!/usr/bin/env node

/**
 * CLI Entry Point for bws-ai-coding-template
 *
 * This tool adds worktree management and parallel testing infrastructure
 * to any existing Node.js project.
 *
 * Usage:
 *   npx @blockchain-web-services/bws-ai-coding-template
 *   or
 *   worktree-init
 */

import { runCLI } from '../lib/cli.js';

// Run the CLI
runCLI().catch((error) => {
    console.error('Fatal error:', error.message);
    process.exit(1);
});
