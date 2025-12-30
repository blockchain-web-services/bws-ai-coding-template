/**
 * Worktree Configuration Generator
 * Generates unique, reproducible configuration for each git worktree
 */

import crypto from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Generate a reproducible hash from branch name
 * @param {string} branchName - The branch name
 * @returns {Buffer} MD5 hash buffer
 */
function getBranchHash(branchName) {
    return crypto.createHash('md5').update(branchName).digest();
}

/**
 * Calculate unique ports based on branch hash
 * @param {Buffer} hash - The branch hash
 * @returns {Object} Port configuration
 */
function calculatePorts(hash) {
    // Use first two bytes for better distribution
    const offset = (hash[0] + hash[1]) % 30; // 0-29 range

    return {
        localstack: 4567 + offset,  // Range: 4567-4596
        playwright: 8080 + offset,  // Range: 8080-8109
        debug: 9229 + offset,       // Range: 9229-9258 (Node.js debugging)
    };
}

/**
 * Generate safe container/resource names from branch name
 * @param {string} branchName - The branch name
 * @returns {string} Safe name for Docker/AWS resources
 */
function getSafeName(branchName) {
    // Ensure names are valid for Docker containers and AWS resources
    // Max length considerations:
    // - Docker container names: 63 characters
    // - AWS Lambda function names: 64 characters
    // - DynamoDB table names: 255 characters

    const maxBranchLength = 20; // Leave room for prefixes/suffixes

    let safeBranch = branchName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/--+/g, '-')
        .replace(/^-|-$/g, '');

    if (safeBranch.length > maxBranchLength) {
        // Use first part + hash for long names
        const hash = crypto.createHash('md5').update(branchName).digest('hex').substring(0, 4);
        safeBranch = safeBranch.substring(0, 15) + hash;
    }

    return safeBranch;
}

/**
 * Generate complete configuration for a worktree
 * @param {string} branchName - The branch name
 * @param {string} projectPrefix - Optional project prefix (default: 'app')
 * @returns {Object} Complete worktree configuration
 */
export function generateWorktreeConfig(branchName, projectPrefix = 'app') {
    const hash = getBranchHash(branchName);
    const ports = calculatePorts(hash);
    const safeName = getSafeName(branchName);

    return {
        branchName,
        safeName,
        hash: hash.toString('hex').substring(0, 8), // Short hash for display

        ports,

        docker: {
            containerPrefix: `${projectPrefix}-${safeName}`,
            networkName: `${projectPrefix}-network-${safeName}`,
            volumePrefix: `${projectPrefix}-volume-${safeName}`,
            labels: {
                'worktree.enabled': 'true',
                'worktree.branch': branchName,
                'worktree.created': new Date().toISOString()
            }
        },

        aws: {
            s3BucketName: `${safeName}-${projectPrefix}-cache`,
            tablePrefix: `${safeName}`,
            lambdaPrefix: `${safeName}`,
            stepFunctionPrefix: `${safeName}`
        },

        environment: {
            ENVIRONMENT: `${safeName}`,
            NODE_ENV: 'test',
            AWS_REGION: 'us-east-1',
            AWS_ACCESS_KEY_ID: 'test',
            AWS_SECRET_ACCESS_KEY: 'test',
            AWS_ENDPOINT_URL: `http://localhost:${ports.localstack}`,
            LOCALSTACK_PORT: String(ports.localstack),
            PLAYWRIGHT_PORT: String(ports.playwright),
            PORT: String(ports.playwright),
            DEBUG_PORT: String(ports.debug),
            IS_WORKTREE: 'true',
            WORKTREE_NAME: branchName,
            WORKTREE_SAFE_NAME: safeName
        }
    };
}

/**
 * Load existing worktree configuration if present
 * @param {string} worktreePath - Path to the worktree
 * @returns {Object|null} Configuration object or null if not found
 */
export function loadWorktreeConfig(worktreePath) {
    const infoPath = join(worktreePath, 'test', '.worktree-info.json');

    if (!existsSync(infoPath)) {
        return null;
    }

    try {
        const content = readFileSync(infoPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Error loading worktree config:', error.message);
        return null;
    }
}

/**
 * Get current worktree configuration from environment
 * @returns {Object|null} Current configuration or null if not in worktree
 */
export function getCurrentWorktreeConfig() {
    if (process.env.IS_WORKTREE !== 'true') {
        return null;
    }

    const branchName = process.env.WORKTREE_NAME;
    if (!branchName) {
        return null;
    }

    return generateWorktreeConfig(branchName);
}

/**
 * Check if current environment is a worktree
 * @returns {boolean} True if in a worktree environment
 */
export function isWorktree() {
    return process.env.IS_WORKTREE === 'true';
}

/**
 * Validate that ports are available
 * @param {Object} ports - Port configuration object
 * @returns {boolean} True if all ports are available
 */
export async function validatePortsAvailable(ports) {
    const net = await import('net');

    const checkPort = (port) => {
        return new Promise((resolve) => {
            const server = net.createServer();

            server.once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });

            server.once('listening', () => {
                server.close();
                resolve(true);
            });

            server.listen(port, '127.0.0.1');
        });
    };

    for (const [name, port] of Object.entries(ports)) {
        const isAvailable = await checkPort(port);
        if (!isAvailable) {
            console.error(`❌ Port ${port} (${name}) is already in use`);
            return false;
        }
    }

    return true;
}

export default {
    generateWorktreeConfig,
    loadWorktreeConfig,
    getCurrentWorktreeConfig,
    isWorktree,
    validatePortsAvailable
};
