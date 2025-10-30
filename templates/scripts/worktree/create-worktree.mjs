#!/usr/bin/env node

/**
 * Create a new git worktree with automatic test environment configuration
 * Usage: npm run worktree:create <branch-name>
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

/**
 * Prompt user for input using readline
 */
function promptUser(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

/**
 * Prompt for multi-line input
 */
async function promptMultiline(question, promptPrefix = '> ') {
    console.log(question);
    console.log('(Enter empty line when done)');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: promptPrefix
    });

    const lines = [];

    return new Promise((resolve) => {
        rl.prompt();

        rl.on('line', (line) => {
            if (line.trim() === '') {
                rl.close();
                resolve(lines.join('\n'));
            } else {
                lines.push(line);
                rl.prompt();
            }
        });
    });
}

// Get branch name from arguments
const branchName = process.argv[2];

if (!branchName) {
    console.error('❌ Error: Please provide a branch name');
    console.error('Usage: npm run worktree:create <branch-name>');
    process.exit(1);
}

// Validate branch name (alphanumeric, hyphens, underscores only)
if (!/^[a-zA-Z0-9_-]+$/.test(branchName)) {
    console.error('❌ Error: Branch name must contain only alphanumeric characters, hyphens, and underscores');
    process.exit(1);
}

const worktreePath = join(rootDir, '.trees', branchName);

// Check if worktree already exists
if (existsSync(worktreePath)) {
    console.error(`❌ Error: Worktree already exists at ${worktreePath}`);
    console.error('Use "npm run worktree:remove ' + branchName + '" to remove it first');
    process.exit(1);
}

console.log(`🌳 Creating worktree for branch: ${branchName}`);

(async () => {
try {
    // Step 1: Create the git worktree
    console.log('📁 Creating git worktree...');

    // Check if branch exists remotely or locally
    let branchExists = false;
    try {
        execSync(`git show-ref --verify --quiet refs/heads/${branchName}`, { stdio: 'pipe' });
        branchExists = true;
    } catch {
        // Branch doesn't exist locally, check remote
        try {
            execSync(`git show-ref --verify --quiet refs/remotes/origin/${branchName}`, { stdio: 'pipe' });
            branchExists = true;
        } catch {
            // Branch doesn't exist at all
        }
    }

    if (branchExists) {
        // Branch exists, just create worktree
        execSync(`git worktree add .trees/${branchName} ${branchName}`, {
            cwd: rootDir,
            stdio: 'inherit'
        });
    } else {
        // Create new branch with worktree
        execSync(`git worktree add -b ${branchName} .trees/${branchName}`, {
            cwd: rootDir,
            stdio: 'inherit'
        });
    }

    console.log('✅ Git worktree created successfully');

    // Step 2: Generate configuration
    console.log('⚙️  Generating unique configuration...');

    // Import configuration generator
    const { generateWorktreeConfig } = await import('../../test/helpers/worktree/config-generator.mjs').catch(async () => {
        // If module doesn't exist yet, create it inline
        const crypto = await import('crypto');
        return {
            generateWorktreeConfig: (branchName) => {
                const hash = crypto.createHash('md5').update(branchName).digest();
                const offset = (hash[0] + hash[1]) % 30; // 0-29 offset range

                return {
                    branchName,
                    ports: {
                        localstack: 4567 + offset,
                        playwright: 8080 + offset,
                        debug: 9229 + offset
                    },
                    docker: {
                        containerPrefix: `app-${branchName}`,
                        networkName: `app-network-${branchName}`
                    },
                    aws: {
                        s3BucketName: `${branchName}-app-cache`,
                        tablePrefix: `${branchName}`
                    },
                    environment: `${branchName}`
                };
            }
        };
    });

    const config = generateWorktreeConfig(branchName);

    // Step 3: Create environment file
    console.log('📝 Creating environment configuration...');

    const envContent = `# Worktree-specific environment configuration
# Branch: ${branchName}
# Generated: ${new Date().toISOString()}

# Ports
LOCALSTACK_PORT=${config.ports.localstack}
PLAYWRIGHT_PORT=${config.ports.playwright}
PORT=${config.ports.playwright}
DEBUG_PORT=${config.ports.debug}

# Docker
WORKTREE_BRANCH=${branchName}
WORKTREE_SAFE_NAME=${config.environment || config.aws.tablePrefix || branchName}
WORKTREE_CONTAINER_PREFIX=${config.docker.containerPrefix}
WORKTREE_NETWORK=${config.docker.networkName}
COMPOSE_PROJECT_NAME=${config.docker.containerPrefix}

# AWS Resources (for LocalStack)
AWS_ENDPOINT_URL=http://localhost:${config.ports.localstack}
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
NODE_ENV=test
ENVIRONMENT=${config.environment || config.aws.tablePrefix || branchName}
S3_BUCKET_NAME=${config.aws.s3BucketName}
TABLE_PREFIX=${config.aws.tablePrefix}

# Worktree marker
IS_WORKTREE=true
WORKTREE_NAME=${branchName}
`;

    // Write environment configuration
    const worktreeTestDir = join(worktreePath, 'test');

    // Create worktree info file
    const infoContent = {
        branchName,
        createdAt: new Date().toISOString(),
        configuration: config,
        paths: {
            worktree: worktreePath,
            envFile: join(worktreeTestDir, '.env.worktree')
        }
    };

    if (existsSync(worktreeTestDir)) {
        const infoFilePath = join(worktreeTestDir, '.worktree-info.json');
        writeFileSync(infoFilePath, JSON.stringify(infoContent, null, 2));
        console.log('✅ Configuration saved to .worktree-info.json');
    }

    // Step 4: Create worktree context file (optional)
    console.log('\n📝 Worktree Context');
    console.log('━'.repeat(50));

    const wantsContext = await promptUser(`Would you like to add context/description for this worktree?
This helps document the feature's purpose and approach.

Press Enter to skip, or type 'y' to add context: `);

    let contextContent = '';

    if (wantsContext.toLowerCase() === 'y' || wantsContext.toLowerCase() === 'yes') {
        console.log('\n');

        // Feature description
        const featureDesc = await promptMultiline('📋 Feature/Fix Description (what and why):');

        // Task list
        console.log('\n✅ Task List (one per line):');
        const taskList = await promptMultiline('');

        // Technical approach
        console.log('\n🔧 Technical Approach/Design Decisions:');
        const technicalApproach = await promptMultiline('');

        // Testing strategy
        console.log('\n🧪 Testing Strategy/Acceptance Criteria:');
        const testingStrategy = await promptMultiline('');

        // Build context content
        contextContent = `# Worktree Context: ${branchName}

**Created**: ${new Date().toISOString()}
**Branch**: ${branchName}

## Feature/Fix Description

${featureDesc || 'TODO: Add feature description'}

## Task List

${taskList.split('\n').map(task => task.trim() ? `- [ ] ${task}` : '').filter(t => t).join('\n') || '- [ ] TODO: Add tasks'}

## Technical Approach

${technicalApproach || 'TODO: Add technical notes'}

## Testing Strategy

${testingStrategy || 'TODO: Add testing strategy'}

---

**Note**: This file is gitignored and won't be merged. It's for your personal context while working in this worktree.
`;
    } else {
        // Create minimal template
        contextContent = `# Worktree Context: ${branchName}

**Created**: ${new Date().toISOString()}
**Branch**: ${branchName}

## Feature/Fix Description

TODO: Add feature description

## Task List

- [ ] TODO: Add tasks

## Technical Approach

TODO: Add technical notes

## Testing Strategy

TODO: Add testing strategy

---

**Note**: This file is gitignored and won't be merged. It's for your personal context while working in this worktree.
`;
    }

    // Write WORKTREE_CONTEXT.md to worktree root
    const contextFilePath = join(worktreePath, 'WORKTREE_CONTEXT.md');
    writeFileSync(contextFilePath, contextContent);
    console.log(`\n✅ Context saved to WORKTREE_CONTEXT.md`);

    // Step 5: Copy helper files (if they exist)
    console.log('\n📁 Setting up worktree helpers...');
    const helpersSource = join(rootDir, 'test', 'helpers');
    const helpersTarget = join(worktreeTestDir, 'helpers');

    if (existsSync(helpersSource) && existsSync(worktreeTestDir)) {
        try {
            mkdirSync(helpersTarget, { recursive: true });
            cpSync(helpersSource, helpersTarget, { recursive: true });
            console.log('  ✅ Copied helper scripts');
        } catch (error) {
            console.warn('  ⚠️  Could not copy helper scripts:', error.message);
        }
    }

    // Step 6: Display configuration summary
    console.log('\n🎉 Worktree created and configured successfully!\n');
    console.log('📊 Configuration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Branch:           ${branchName}`);
    console.log(`  Location:         ${worktreePath}`);
    console.log(`  LocalStack Port:  ${config.ports.localstack}`);
    console.log(`  Playwright Port:  ${config.ports.playwright}`);
    console.log(`  Container Prefix: ${config.docker.containerPrefix}`);
    console.log(`  S3 Bucket:        ${config.aws.s3BucketName}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n📋 Next steps:');
    console.log(`  1. cd .trees/${branchName}`);
    console.log('  2. Start developing your feature');

    if (existsSync(worktreeTestDir)) {
        console.log(`  3. cd test && npm install     # Install test dependencies (when ready)');
        console.log('  4. npm run docker:up          # Start LocalStack container');
        console.log('  5. npm run setup              # Create AWS resources');
        console.log('  6. npm test                   # Run tests');
    }

    console.log('\n💡 Tips:');
    console.log(`  • Remove worktree:    npm run worktree:remove ${branchName}`);
    console.log('  • List all worktrees: npm run worktree:list');
    console.log(`  • Merge when done:    npm run worktree:merge ${branchName}`);

} catch (error) {
    console.error('❌ Error creating worktree:', error.message);

    // Clean up partial worktree if it was created
    if (existsSync(worktreePath)) {
        try {
            execSync(`git worktree remove ${worktreePath} --force`, {
                cwd: rootDir,
                stdio: 'pipe'
            });
        } catch {
            // Ignore cleanup errors
        }
    }

    process.exit(1);
}
})();
