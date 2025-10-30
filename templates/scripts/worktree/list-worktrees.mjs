#!/usr/bin/env node

/**
 * List all git worktrees
 * Usage: npm run worktree:list
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');
const treesDir = join(rootDir, '.trees');

console.log('🌳 Git Worktrees\n');

try {
    // Get git worktree list
    const gitWorktrees = execSync('git worktree list', {
        cwd: rootDir,
        encoding: 'utf8'
    });

    console.log(gitWorktrees);

    // If .trees directory exists, show additional details
    if (existsSync(treesDir)) {
        const entries = readdirSync(treesDir, { withFileTypes: true });
        const worktrees = entries.filter(e => e.isDirectory());

        if (worktrees.length > 0) {
            console.log('\n📊 Worktree Details:');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            for (const entry of worktrees) {
                const infoPath = join(treesDir, entry.name, 'test', '.worktree-info.json');

                if (existsSync(infoPath)) {
                    try {
                        const info = JSON.parse(readFileSync(infoPath, 'utf8'));
                        const config = info.configuration;

                        console.log(`\n  ${entry.name}:`);
                        console.log(`    Created:      ${new Date(info.createdAt).toLocaleString()}`);
                        console.log(`    LocalStack:   localhost:${config.ports.localstack}`);
                        console.log(`    Playwright:   localhost:${config.ports.playwright}`);
                        console.log(`    Container:    ${config.docker.containerPrefix}-localstack`);

                        // Check if container is running
                        try {
                            const containerName = `${config.docker.containerPrefix}-localstack`;
                            const result = execSync(`docker ps --filter "name=${containerName}" --format "{{.Status}}"`, {
                                encoding: 'utf8'
                            }).trim();

                            if (result) {
                                console.log(`    Status:       🟢 Running (${result})`);
                            } else {
                                console.log(`    Status:       ⚫ Stopped`);
                            }
                        } catch {
                            console.log(`    Status:       ⚫ Stopped`);
                        }
                    } catch (error) {
                        console.log(`\n  ${entry.name}: (configuration not available)`);
                    }
                } else {
                    console.log(`\n  ${entry.name}: (no test configuration)`);
                }
            }

            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
    }

    console.log('\n💡 Commands:');
    console.log('  Create:  npm run worktree:create <branch-name>');
    console.log('  Remove:  npm run worktree:remove <branch-name>');
    console.log('  Merge:   npm run worktree:merge <branch-name>');

} catch (error) {
    console.error('❌ Error listing worktrees:', error.message);
    process.exit(1);
}
