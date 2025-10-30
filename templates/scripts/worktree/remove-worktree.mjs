#!/usr/bin/env node

/**
 * Remove a git worktree and clean up its resources
 * Usage: npm run worktree:remove <branch-name>
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

// Get branch name from arguments
const branchName = process.argv[2];

if (!branchName) {
    console.error('❌ Error: Please provide a branch name');
    console.error('Usage: npm run worktree:remove <branch-name>');
    process.exit(1);
}

const worktreePath = join(rootDir, '.trees', branchName);

// Check if worktree exists
if (!existsSync(worktreePath)) {
    console.error(`❌ Error: Worktree not found at ${worktreePath}`);
    process.exit(1);
}

console.log(`🗑️  Removing worktree for branch: ${branchName}`);

try {
    // Step 1: Load worktree configuration to get container names
    const infoPath = join(worktreePath, 'test', '.worktree-info.json');
    let config = null;

    if (existsSync(infoPath)) {
        try {
            const info = JSON.parse(readFileSync(infoPath, 'utf8'));
            config = info.configuration;
            console.log('📋 Loaded worktree configuration');
        } catch (error) {
            console.warn('⚠️  Could not load worktree configuration:', error.message);
        }
    }

    // Step 2: Stop and remove Docker containers if configuration exists
    if (config) {
        console.log('🐳 Cleaning up Docker resources...');

        const containerPrefix = config.docker.containerPrefix;
        const networkName = config.docker.networkName;

        // Stop and remove containers
        try {
            // Check if container exists
            const containerName = `${containerPrefix}-localstack`;
            const checkCmd = `docker ps -a --filter "name=${containerName}" --format "{{.Names}}"`;
            const containerExists = execSync(checkCmd, { encoding: 'utf8' }).trim();

            if (containerExists) {
                console.log(`  Stopping container: ${containerName}`);
                execSync(`docker stop ${containerName} 2>/dev/null || true`, { stdio: 'pipe' });

                console.log(`  Removing container: ${containerName}`);
                execSync(`docker rm ${containerName} 2>/dev/null || true`, { stdio: 'pipe' });
            }
        } catch (error) {
            console.warn('  ⚠️  Could not remove Docker containers:', error.message);
        }

        // Remove network
        try {
            const checkNetCmd = `docker network ls --filter "name=${networkName}" --format "{{.Name}}"`;
            const networkExists = execSync(checkNetCmd, { encoding: 'utf8' }).trim();

            if (networkExists) {
                console.log(`  Removing network: ${networkName}`);
                execSync(`docker network rm ${networkName} 2>/dev/null || true`, { stdio: 'pipe' });
            }
        } catch (error) {
            console.warn('  ⚠️  Could not remove Docker network:', error.message);
        }

        // Remove volumes (if volume prefix exists in config)
        if (config.docker.volumePrefix) {
            try {
                const volumePrefix = config.docker.volumePrefix;
                console.log(`  Cleaning up volumes with prefix: ${volumePrefix}`);
                execSync(`docker volume ls --filter "name=${volumePrefix}" --format "{{.Name}}" | xargs -r docker volume rm 2>/dev/null || true`, {
                    shell: true,
                    stdio: 'pipe'
                });
            } catch (error) {
                console.warn('  ⚠️  Could not remove Docker volumes:', error.message);
            }
        }

        console.log('✅ Docker cleanup complete');
    }

    // Step 3: Clean up LocalStack data directory
    const localstackDataDir = join(worktreePath, 'test', `localstack-data-${config?.environment || branchName}`);
    if (existsSync(localstackDataDir)) {
        console.log('📁 Removing LocalStack data directory...');
        rmSync(localstackDataDir, { recursive: true, force: true });
    }

    // Step 4: Remove git worktree
    console.log('🌳 Removing git worktree...');

    // First try normal removal
    try {
        execSync(`git worktree remove "${worktreePath}"`, {
            cwd: rootDir,
            stdio: 'pipe'
        });
    } catch (error) {
        // If normal removal fails, try force removal
        console.log('  Using force removal...');
        try {
            execSync(`git worktree remove "${worktreePath}" --force`, {
                cwd: rootDir,
                stdio: 'pipe'
            });
        } catch (forceError) {
            // If git command fails, manually remove and prune
            console.log('  Manually cleaning up worktree...');

            // Remove directory if it still exists
            if (existsSync(worktreePath)) {
                rmSync(worktreePath, { recursive: true, force: true });
            }

            // Prune worktree references
            execSync('git worktree prune', {
                cwd: rootDir,
                stdio: 'pipe'
            });
        }
    }

    console.log('✅ Git worktree removed');

    // Step 5: Summary
    console.log('\n🎉 Worktree removed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Branch:     ${branchName}`);
    console.log(`  Path:       ${worktreePath}`);

    if (config) {
        console.log(`  Freed Ports:`);
        console.log(`    - LocalStack: ${config.ports.localstack}`);
        console.log(`    - Playwright: ${config.ports.playwright}`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Show remaining worktrees
    console.log('\n📋 Remaining worktrees:');
    try {
        const result = execSync('git worktree list', {
            cwd: rootDir,
            encoding: 'utf8'
        });
        console.log(result);
    } catch {
        console.log('  (none or could not list)');
    }

} catch (error) {
    console.error('❌ Error removing worktree:', error.message);
    console.error('\nYou may need to manually clean up:');
    console.error(`  1. Remove directory: rm -rf "${worktreePath}"`);
    console.error('  2. Prune git worktrees: git worktree prune');

    if (config) {
        console.error(`  3. Remove Docker container: docker rm -f ${config.docker.containerPrefix}-localstack`);
        console.error(`  4. Remove Docker network: docker network rm ${config.docker.networkName}`);
    }

    process.exit(1);
}
