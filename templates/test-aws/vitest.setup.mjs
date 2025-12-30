/**
 * Vitest Setup File
 *
 * Sets up environment variables for all tests to properly connect to LocalStack
 * This ensures AWS SDK calls from test code use LocalStack instead of real AWS
 */

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment configuration
const envPath = join(__dirname, '.env');

if (!existsSync(envPath)) {
    console.error('❌ Missing .env file. Please create one first.');
    console.error('   Copy .env.example and customize for your environment.');
    process.exit(1);
}

// Load the .env file
const dotenvOptions = { path: envPath, override: true };
if (process.env.CI === 'true') {
    dotenvOptions.quiet = true;
}
config(dotenvOptions);

// Set LocalStack environment variables for ALL tests
process.env.ENVIRONMENT = process.env.ENVIRONMENT || 'local-tests';
process.env.TABLE_PREFIX = process.env.TABLE_PREFIX || process.env.ENVIRONMENT || 'local-tests';

// Use dynamic port from LOCALSTACK_PORT environment variable
const localstackPort = process.env.LOCALSTACK_PORT || '4567';
process.env.AWS_ENDPOINT_URL = process.env.AWS_ENDPOINT_URL || `http://localhost:${localstackPort}`;
process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'test';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'test';
process.env.LOCALSTACK_PORT = localstackPort;

// Set Node options for better error handling
process.env.NODE_OPTIONS = '--experimental-vm-modules --no-warnings';

// Disable AWS SDK credential warnings for LocalStack
process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = '1';

// Set S3 bucket name for tests
process.env.S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || `${process.env.ENVIRONMENT}-app-cache`;

// Log setup confirmation (only in debug mode)
if (process.env.DEBUG || process.env.VITEST_DEBUG) {
    console.log('✅ Vitest setup complete with LocalStack credentials:');
    console.log('  - ENVIRONMENT:', process.env.ENVIRONMENT);
    console.log('  - AWS_ENDPOINT_URL:', process.env.AWS_ENDPOINT_URL);
    console.log('  - AWS_REGION:', process.env.AWS_REGION);
    console.log('  - LocalStack Port:', process.env.LOCALSTACK_PORT);
}

// Global test timeout (can be overridden per test)
if (typeof globalThis.testTimeout === 'undefined') {
    globalThis.testTimeout = 30000; // 30 seconds default
}

// Ensure LocalStack endpoint is used by AWS SDK v3
if (!process.env.AWS_ENDPOINT_URL) {
    console.warn('⚠️ AWS_ENDPOINT_URL not set - tests may try to connect to real AWS!');
}
