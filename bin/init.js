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

import { Command } from 'commander';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runCLI } from '../lib/cli.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packagePath = join(__dirname, '..', 'package.json');
const packageData = JSON.parse(await readFile(packagePath, 'utf8'));

// Configure CLI
const program = new Command();

program
    .name('bws-ai-coding-template')
    .description('Add git worktree management and parallel testing to your Node.js project')
    .version(packageData.version)
    .option('--dry-run', 'Preview what would be installed without making changes')
    .option('--add-aws', 'Include AWS deployment files and test infrastructure')
    .option('--force', 'Force update all files, including AWS templates (use with caution)')
    .action(async (options) => {
        try {
            await runCLI({
                dryRun: options.dryRun || false,
                addAWS: options.addAws || false,
                forceUpdate: options.force || false
            });
        } catch (error) {
            console.error('Fatal error:', error.message);
            process.exit(1);
        }
    });

// Parse arguments
program.parse(process.argv);
