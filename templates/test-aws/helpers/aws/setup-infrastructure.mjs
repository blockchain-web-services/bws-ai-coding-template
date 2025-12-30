#!/usr/bin/env node

/**
 * Complete infrastructure setup for LocalStack
 * Creates all AWS resources needed for testing
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const helpersDir = dirname(__dirname);

// Load environment
const LOCALSTACK_PORT = process.env.LOCALSTACK_PORT || '4567';
const AWS_ENDPOINT = process.env.AWS_ENDPOINT_URL || `http://localhost:${LOCALSTACK_PORT}`;

console.log('\n🚀 Setting up AWS Infrastructure');
console.log('━'.repeat(50));
console.log(`Endpoint: ${AWS_ENDPOINT}`);
console.log(`Environment: ${process.env.ENVIRONMENT || 'local-tests'}`);
console.log('');

/**
 * Execute a script and handle errors
 */
function runScript(scriptPath, description) {
    console.log(`\n📦 ${description}...`);
    try {
        execSync(`node ${scriptPath}`, {
            stdio: 'inherit',
            env: process.env
        });
        console.log(`✅ ${description} completed`);
        return true;
    } catch (error) {
        console.error(`❌ ${description} failed`);
        return false;
    }
}

/**
 * Main setup
 */
async function main() {
    const steps = [
        {
            script: join(__dirname, 'create-buckets.mjs'),
            description: 'Creating S3 buckets',
            required: true
        },
        {
            script: join(__dirname, 'create-tables.mjs'),
            description: 'Creating DynamoDB tables',
            required: true
        }
    ];

    let successCount = 0;
    let failCount = 0;

    for (const step of steps) {
        if (!existsSync(step.script)) {
            console.log(`⏭️  Skipping: ${step.description} (script not found)`);
            continue;
        }

        const success = runScript(step.script, step.description);
        if (success) {
            successCount++;
        } else {
            failCount++;
            if (step.required) {
                console.error('\n❌ Required step failed. Aborting setup.');
                process.exit(1);
            }
        }
    }

    console.log('\n━'.repeat(50));
    console.log('🎉 Infrastructure Setup Complete!');
    console.log(`✅ Success: ${successCount}`);
    if (failCount > 0) {
        console.log(`⚠️  Failed:  ${failCount}`);
    }
    console.log('━'.repeat(50));

    process.exit(failCount > 0 ? 1 : 0);
}

main();
