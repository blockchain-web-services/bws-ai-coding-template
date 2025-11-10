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
 * Detect parent branch from root directory
 * @returns {string} Parent branch name
 */
function detectParentBranch() {
    try {
        const branch = execSync('git branch --show-current', {
            cwd: rootDir,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();

        return branch || 'main';
    } catch (error) {
        return 'main';
    }
}

/**
 * Get repository name from package.json
 * @returns {string} Repository name (without scope)
 */
function getRepoName() {
    try {
        const packageJsonPath = join(rootDir, 'package.json');
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        let name = packageJson.name;

        // Remove scope prefix if exists (@org/repo-name → repo-name)
        if (name && name.startsWith('@')) {
            name = name.split('/')[1] || name;
        }

        return name || 'project';
    } catch (error) {
        return 'project';
    }
}

/**
 * Generate AWS CLI profile name based on repo and environment
 * @param {string} environment - Environment name (staging, prod, etc.)
 * @returns {string} AWS profile name
 */
function getAwsProfileName(environment) {
    const repoName = getRepoName();
    return `${repoName}-${environment}`;
}

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

    // Detect parent branch
    const parentBranch = detectParentBranch();

    // Create worktree info file
    const infoContent = {
        branchName,
        parentBranch,
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

    // Step 4: Create Claude Code integration files
    console.log('\n📝 Claude Code Integration');
    console.log('━'.repeat(50));

    const wantsContext = await promptUser(`Would you like to add context/description for this worktree?
This helps Claude Code understand the feature's purpose and approach.

Press Enter to skip, or type 'y' to add context: `);

    let featureDesc = '';
    let taskList = '';
    let technicalApproach = '';
    let testingStrategy = '';

    if (wantsContext.toLowerCase() === 'y' || wantsContext.toLowerCase() === 'yes') {
        console.log('\n');

        // Feature description
        console.log('📋 Feature/Fix Description');
        console.log('━'.repeat(50));
        console.log('Describe WHAT you\'re building and WHY it\'s needed.');
        console.log('Focus on the problem and solution, not specific tasks.');
        console.log('Claude will use this to understand the overall goal.\n');
        console.log('Example: "Add user authentication to protect admin routes');
        console.log('         because currently anyone can access admin features."\n');
        featureDesc = await promptMultiline('What and why:');

        // Task list
        console.log('\n✅ Task List');
        console.log('━'.repeat(50));
        console.log('List specific tasks/steps needed (one per line).');
        console.log('Be concrete and actionable - these become checkboxes.');
        console.log('Claude will use this to track progress and know what\'s left.\n');
        console.log('Example tasks:');
        console.log('  Create login form component');
        console.log('  Add JWT token validation');
        console.log('  Protect admin routes with middleware\n');
        taskList = await promptMultiline('Tasks (one per line):');

        // Technical approach
        console.log('\n🔧 Technical Approach/Design Decisions');
        console.log('━'.repeat(50));
        console.log('Explain HOW you\'ll implement this technically.');
        console.log('Include frameworks, libraries, patterns, or architecture.');
        console.log('Claude will use this to stay consistent with your approach.\n');
        console.log('Example: "Using JWT tokens stored in httpOnly cookies,');
        console.log('         express-jwt middleware for validation,');
        console.log('         and React Context for auth state."\n');
        technicalApproach = await promptMultiline('How you\'ll build it:');

        // Testing strategy
        console.log('\n🧪 Testing Strategy/Acceptance Criteria');
        console.log('━'.repeat(50));
        console.log('Describe how to verify it works correctly.');
        console.log('Include test cases, manual steps, or success criteria.');
        console.log('Claude will use this to validate the implementation.\n');
        console.log('Example: "User can login with valid credentials,');
        console.log('         invalid login shows error message,');
        console.log('         protected routes redirect to login when not authenticated."\n');
        testingStrategy = await promptMultiline('How to verify it works:');
    }

    // Build CLAUDE_INSTRUCTIONS.md content
    const awsProfile = getAwsProfileName(parentBranch);
    const claudeInstructionsContent = `# Claude Code Instructions - Worktree: ${branchName}

**Created**: ${new Date().toISOString()}
**Branch**: ${branchName}
**Parent Branch**: ${parentBranch}
**AWS CLI Profile**: \`${awsProfile}\`

---

## AWS CLI Profile

When running AWS CLI commands, always use the correct profile for this environment:

\`\`\`bash
# Profile naming pattern: <repo-name>-<environment>
# Current profile: ${awsProfile}

# Example AWS CLI commands:
aws cloudformation describe-stacks --profile ${awsProfile}
aws codepipeline get-pipeline-state --name devops-${getRepoName()}-${parentBranch} --profile ${awsProfile}
aws s3 ls --profile ${awsProfile}
\`\`\`

**Profile Detection:**
- Repository: \`${getRepoName()}\`
- Environment: \`${parentBranch}\`
- AWS Profile: \`${awsProfile}\`

---

## ⚠️ CRITICAL: Working Directory Boundaries

**YOU ARE IN A WORKTREE** (\`.trees/${branchName}/\`)

**IMPORTANT RULES:**

1. ✅ **ONLY modify files within THIS worktree directory**
   - Current worktree path: \`${worktreePath}\`
   - All your work happens HERE

2. ❌ **NEVER modify files in the root repository**
   - Root repository path: \`${rootDir}\`
   - DO NOT EDIT files outside the worktree

3. 🔍 **Always verify your working directory before file operations**
   \`\`\`bash
   pwd  # Should show: ${worktreePath}
   \`\`\`

4. 🚫 **If you need to modify root files, STOP and ask the user first**

**Why this matters:**
- Worktrees share the same git repository but have separate working directories
- Changes to root files affect ALL worktrees and could break parallel development
- The merge script handles bringing changes back to root safely

**Safe operations from worktree:**
- ✅ Modify any file in \`.trees/${branchName}/\`
- ✅ Run tests in \`test/\` directory
- ✅ Commit changes with \`git commit\`
- ✅ Run \`npm run worktree:merge ${branchName}\` from root (script handles it)

**Unsafe operations:**
- ❌ Modifying \`../../\` files (root directory)
- ❌ Running \`cd ../..\` and editing files there
- ❌ Using absolute paths to root repository files

---

## Feature/Fix Description

${featureDesc || 'TODO: Add feature description'}

## Task List

${taskList ? taskList.split('\n').map(task => task.trim() ? `- [ ] ${task}` : '').filter(t => t).join('\n') : '- [ ] TODO: Add tasks'}

## Technical Approach

${technicalApproach || 'TODO: Add technical notes'}

## Testing Strategy

${testingStrategy || 'TODO: Add testing strategy'}

## Git Workflow for This Worktree

### 1. Rebase from root branch
\`\`\`bash
git fetch origin
git rebase origin/${parentBranch}
\`\`\`

### 2. Commit your changes
\`\`\`bash
git add .
git commit -m "feat: description"
\`\`\`

### 3. Run tests before merging
\`\`\`bash
cd test
npm test
\`\`\`

### 4. Merge to root (from root directory)
\`\`\`bash
cd ../..  # Return to root
git checkout ${parentBranch}
git merge --no-ff ${branchName}
\`\`\`

### 5. Push to origin
\`\`\`bash
git push origin ${parentBranch}
\`\`\`

### 6. Remove worktree when done
\`\`\`bash
npm run worktree:remove ${branchName}
\`\`\`

---

⚠️ **Note**: This file is gitignored and won't be committed. It's for your local context while working in this worktree.
`;

    // Write CLAUDE_INSTRUCTIONS.md to worktree root
    const claudeInstructionsPath = join(worktreePath, 'CLAUDE_INSTRUCTIONS.md');
    writeFileSync(claudeInstructionsPath, claudeInstructionsContent);
    console.log(`\n✅ Created CLAUDE_INSTRUCTIONS.md`);

    // Create CLAUDE.md with explicit workspace boundary warnings
    const claudeMdContent = `# ⚠️ WORKTREE WORKSPACE BOUNDARY

**Current Location:** \`.trees/${branchName}/\`
**Working Directory:** \`${worktreePath}\`

---

## 🚨 CRITICAL RULES

### 1. STAY IN THIS WORKTREE
**ONLY modify files within this directory**
- ✅ Safe: Any file in \`${worktreePath}\`
- ❌ Forbidden: Any file in \`${rootDir}\` (root repository)

### 2. VERIFY BEFORE EDITING
**Always check your working directory before file operations:**
\`\`\`bash
pwd  # Must show: ${worktreePath}
\`\`\`

### 3. DO NOT MODIFY ROOT
**Never change files in \`../../\` (the root repository)**
- Root files affect ALL worktrees and other developers
- Changes must go through the merge process
- If you need to modify root files, ASK THE USER FIRST

### 4. READ INSTRUCTIONS FIRST
**See \`CLAUDE_INSTRUCTIONS.md\` for:**
- ✓ What you're building and why
- ✓ Task checklist
- ✓ Technical approach
- ✓ Git workflow for this worktree
- ✓ Complete workspace boundary rules

---

## When to Access Root Repository

**Only these operations should touch root:**

1. **Merging worktree** (script handles boundaries):
   \`\`\`bash
   cd ../..
   npm run worktree:merge ${branchName}
   \`\`\`

2. **Listing worktrees** (read-only):
   \`\`\`bash
   npm run worktree:list
   \`\`\`

3. **Creating new worktrees** (from root):
   \`\`\`bash
   npm run worktree:create
   \`\`\`

**All development work happens HERE in the worktree.**

---

⚠️ **If Claude Code suggests modifying root files, STOP and confirm with the user first.**
`;

    const claudeMdPath = join(worktreePath, 'CLAUDE.md');
    writeFileSync(claudeMdPath, claudeMdContent);
    console.log(`✅ Created CLAUDE.md`);

    // Step 5: Copy Claude Code skills to worktree
    console.log('\n🎯 Setting up Claude Code skills...');
    const claudeSource = join(rootDir, '.claude');
    const claudeDest = join(worktreePath, '.claude');

    if (existsSync(claudeSource)) {
        try {
            cpSync(claudeSource, claudeDest, { recursive: true });
            console.log('  ✅ Copied Claude Code skills');
        } catch (error) {
            console.warn('  ⚠️  Could not copy Claude Code skills:', error.message);
        }
    }

    // Step 5b: Create/Update .gitignore in worktree
    console.log('\n📝 Configuring worktree .gitignore...');
    const gitignorePath = join(worktreePath, '.gitignore');
    const gitignorePatterns = `
# Worktree-specific files (should not be committed)
.env.worktree
.worktree-info.json
docker-compose.worktree.yml
CLAUDE_INSTRUCTIONS.md
CLAUDE.md
test/.env.worktree
test/.worktree-info.json
test/docker-compose.worktree.yml

# Ignore nested .trees/ directory (prevents tracking nested worktrees)
.trees/
`;

    let existingGitignore = '';
    if (existsSync(gitignorePath)) {
        existingGitignore = readFileSync(gitignorePath, 'utf8');
    }

    // Only add patterns if not already present
    if (!existingGitignore.includes('# Worktree-specific files')) {
        writeFileSync(gitignorePath, existingGitignore + gitignorePatterns);
        console.log('  ✅ Added worktree patterns to .gitignore');
    } else {
        console.log('  ℹ️  Worktree patterns already in .gitignore');
    }

    // Step 6: Copy helper files (if they exist)
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

    // Step 7: Display configuration summary
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
        console.log('  3. cd test && npm install     # Install test dependencies (when ready)');
        console.log('  4. npm run docker:up          # Start LocalStack container');
        console.log('  5. npm run setup              # Create AWS resources');
        console.log('  6. npm test                   # Run tests');
    }

    console.log('\n💡 Tips:');
    console.log(`  • Remove worktree:    npm run worktree:remove ${branchName}`);
    console.log('  • List all worktrees: npm run worktree:list');
    console.log(`  • Merge when done:    npm run worktree:merge ${branchName}`);

    // Workspace boundary warning
    console.log('\n⚠️  IMPORTANT: Workspace Boundaries');
    console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
    console.log('┃                                                          ┃');
    console.log('┃  🚨 CRITICAL: Stay Within This Worktree                 ┃');
    console.log('┃                                                          ┃');
    console.log('┃  When working in this worktree:                          ┃');
    console.log('┃                                                          ┃');
    console.log('┃  ✅ ONLY modify files in:                               ┃');
    console.log(`┃     ${worktreePath.padEnd(54)} ┃`);
    console.log('┃                                                          ┃');
    console.log('┃  ❌ NEVER modify files in:                              ┃');
    console.log(`┃     ${rootDir.padEnd(54)} ┃`);
    console.log('┃     (root repository - affects ALL worktrees)            ┃');
    console.log('┃                                                          ┃');
    console.log('┃  📖 See CLAUDE_INSTRUCTIONS.md and CLAUDE.md for         ┃');
    console.log('┃     complete workspace boundary rules                    ┃');
    console.log('┃                                                          ┃');
    console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
    console.log('');

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
