#!/usr/bin/env node

/**
 * Environment loader for worktree support
 * Automatically loads .env.worktree if it exists, otherwise uses .env
 * This ensures worktree-specific configuration is used when available
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDir = join(__dirname, '../..');

// Function to load appropriate environment
export function loadWorktreeEnvironment() {
    const worktreeEnvPath = join(testDir, '.env.worktree');
    const defaultEnvPath = join(testDir, '.env');

    if (existsSync(worktreeEnvPath)) {
        console.log('🌳 Loading worktree environment from .env.worktree');
        config({ path: worktreeEnvPath });

        // Ensure AWS_ENDPOINT_URL uses the worktree port
        if (process.env.LOCALSTACK_PORT) {
            process.env.AWS_ENDPOINT_URL = `http://localhost:${process.env.LOCALSTACK_PORT}`;
        }

        return {
            isWorktree: true,
            localstackPort: process.env.LOCALSTACK_PORT || '4567',
            playwrightPort: process.env.PLAYWRIGHT_PORT || '8080',
            environment: process.env.ENVIRONMENT || 'local-tests',
            s3Bucket: process.env.S3_BUCKET_NAME || 'local-tests-app-cache'
        };
    } else if (existsSync(defaultEnvPath)) {
        console.log('📁 Loading default environment from .env');
        config({ path: defaultEnvPath });

        return {
            isWorktree: false,
            localstackPort: process.env.LOCALSTACK_PORT || '4567',
            playwrightPort: process.env.PORT || '8080',
            environment: process.env.ENVIRONMENT || 'local-tests',
            s3Bucket: process.env.S3_BUCKET_NAME || 'local-tests-app-cache'
        };
    }

    // Default configuration if no env files exist
    return {
        isWorktree: false,
        localstackPort: '4567',
        playwrightPort: '8080',
        environment: 'local-tests',
        s3Bucket: 'local-tests-app-cache'
    };
}

// Auto-load when imported
const envConfig = loadWorktreeEnvironment();

// Export for use in other scripts
export default envConfig;
