#!/usr/bin/env node

/**
 * Docker wrapper for worktree environments
 * Automatically uses worktree-specific configuration if available
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDir = join(__dirname, '../..');

// Get command from arguments
const command = process.argv[2];
if (!command) {
    console.error('Usage: node docker-wrapper.mjs <command> [args...]');
    process.exit(1);
}

// Load environment configuration
const envPath = join(testDir, '.env');

if (!existsSync(envPath)) {
    console.error('❌ Missing .env file. Please create one first.');
    process.exit(1);
}

console.log('📁 Using configuration from .env');
config({ path: envPath });

// Always use the base docker-compose.yml with override if it exists
const composeFile = 'docker-compose.yml';
const overrideFile = 'docker-compose.override.yml';
const composeFiles = existsSync(join(testDir, overrideFile))
    ? `-f ${composeFile} -f ${overrideFile}`
    : `-f ${composeFile}`;

// Build docker-compose command
const dockerCommand = `docker compose ${composeFiles}`;

// Map common commands
const commandMap = {
    'up': `${dockerCommand} up -d`,
    'down': `${dockerCommand} down`,
    'stop': `${dockerCommand} stop`,
    'start': `${dockerCommand} start`,
    'restart': `${dockerCommand} restart`,
    'logs': `${dockerCommand} logs -f`,
    'ps': `${dockerCommand} ps`,
    'clean': `${dockerCommand} down -v --remove-orphans`
};

// Get the full command
const fullCommand = commandMap[command] || `${dockerCommand} ${command}`;

// Add any additional arguments
const additionalArgs = process.argv.slice(3).join(' ');
const finalCommand = additionalArgs ? `${fullCommand} ${additionalArgs}` : fullCommand;

// Display configuration info if in worktree
if (process.env.IS_WORKTREE === 'true') {
    console.log(`📍 Worktree: ${process.env.WORKTREE_NAME}`);
    console.log(`🔌 LocalStack Port: ${process.env.LOCALSTACK_PORT}`);
    console.log(`📦 Container Prefix: ${process.env.WORKTREE_CONTAINER_PREFIX}`);
    console.log('');
}

// Execute the command
try {
    console.log(`Executing: ${finalCommand}`);
    execSync(finalCommand, {
        cwd: testDir,
        stdio: 'inherit',
        env: process.env
    });
} catch (error) {
    if (error.status !== undefined) {
        process.exit(error.status);
    }
    console.error('Error executing docker command:', error.message);
    process.exit(1);
}
