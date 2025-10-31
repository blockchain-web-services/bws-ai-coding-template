# Claude Code Instructions

Guidelines for Claude Code (and other AI assistants) when working with this project.

## Table of Contents

- [Project Context](#project-context)
- [Worktree Context Files](#worktree-context-files)
- [Git Workflow Rules](#git-workflow-rules)
- [Testing Guidelines](#testing-guidelines)
- [AWS Access](#aws-access)
- [Code Patterns](#code-patterns)
- [File Structure](#file-structure)
- [Common Tasks](#common-tasks)

## Project Context

This project uses **git worktrees** for parallel feature development with isolated test environments.

### Key Concepts

1. **Main Worktree**: Located at project root, tracks `main` branch
2. **Feature Worktrees**: Located in `.trees/<branch-name>/`, each tracks a feature branch
3. **Port Allocation**: MD5 hash-based, deterministic per branch name
4. **Docker Isolation**: Each worktree has unique containers and networks
5. **AWS Resources**: Environment-specific prefixes (staging-*, prod-*)

### Before Making Changes

1. **Check current worktree**:
   ```bash
   git branch --show-current
   pwd
   ```

2. **Read Claude instructions** (if exists):
   ```bash
   cat CLAUDE_INSTRUCTIONS.md
   ```

3. **Verify environment**:
   ```bash
   echo $WORKTREE_NAME
   echo $LOCALSTACK_PORT
   ```

## Worktree Instructions Files

### CLAUDE_INSTRUCTIONS.md

Each worktree has a `CLAUDE_INSTRUCTIONS.md` file at its root with:

```markdown
# Claude Code Instructions - Worktree: feature-name

**Created**: 2024-01-15T10:30:00Z
**Branch**: feature-name
**Parent Branch**: main

## Feature/Fix Description

[What and why]

## Task List

- [ ] Task 1
- [ ] Task 2
- [x] Completed task

## Technical Approach

[How it's being implemented]

## Testing Strategy

[How to verify it works]

## Git Workflow for This Worktree

### 1. Rebase from root branch
```bash
git fetch origin
git rebase origin/main
```

### 2. Commit your changes
```bash
git add .
git commit -m "feat: description"
```

### 3. Run tests before merging
```bash
cd test
npm test
```

### 4. Merge to root (from root directory)
```bash
cd ../..  # Return to root
git checkout main
git merge --no-ff feature-name
```

### 5. Push to origin
```bash
git push origin main
```

### 6. Remove worktree when done
```bash
npm run worktree:remove feature-name
```
```

### Reading Instructions

**Always read this file first** when working in a worktree to understand:
- What feature is being developed
- What still needs to be done
- Technical decisions already made
- Testing requirements
- Git workflow specific to this worktree

### Updating Context

When making significant progress, update the task list:

```bash
# Mark completed tasks
sed -i 's/- \[ \] Implemented auth endpoint/- \[x\] Implemented auth endpoint/' CLAUDE_INSTRUCTIONS.md
```

## Git Workflow Rules

### Rule 1: Always Rebase Before Committing

When asked to commit changes in a worktree:

```bash
# 1. Fetch latest
git fetch origin

# 2. Rebase onto main
git rebase origin/main

# 3. If conflicts, resolve them
# 4. Run tests
cd test && npm test

# 5. Then commit
git add .
git commit -m "feat: implement feature"
```

**Never skip the rebase step** unless explicitly told to.

### Rule 2: Use --no-ff for Merges

When merging branches:

```bash
# Good - preserves history
git merge --no-ff feature-branch

# Bad - loses context
git merge feature-branch
```

The `npm run worktree:merge` command handles this automatically.

### Rule 3: Descriptive Commit Messages

Format:

```
<type>: <short description>

[Optional detailed explanation]
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

Examples:

```bash
git commit -m "feat: add user authentication endpoint"
git commit -m "fix: prevent duplicate email registration"
git commit -m "refactor: extract validation to separate module"
```

### Rule 4: Don't Commit Worktree-Specific Files

These files are gitignored and should never be committed:
- `.env.worktree`
- `.worktree-info.json`
- `docker-compose.worktree.yml`
- `CLAUDE_INSTRUCTIONS.md`
- `test/.env.worktree`

## Testing Guidelines

### Before Running Tests

1. **Verify LocalStack is running**:
   ```bash
   docker ps | grep localstack
   ```

2. **Check test environment**:
   ```bash
   cd test
   cat .env.worktree
   echo $LOCALSTACK_PORT
   ```

3. **Ensure resources exist**:
   ```bash
   npm run setup
   ```

### Running Tests

```bash
# All tests
npm test

# Specific test file
npm test -- tests/integration/users.test.mjs

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### After Code Changes

**Always run tests** before committing:

```bash
cd test
npm test
cd ..
git add .
git commit -m "feat: add feature"
```

### Test Failures

If tests fail:

1. **Check LocalStack**:
   ```bash
   docker logs app-$(git branch --show-current)-localstack
   ```

2. **Verify resources**:
   ```bash
   aws --endpoint-url=http://localhost:$LOCALSTACK_PORT dynamodb list-tables
   ```

3. **Restart if needed**:
   ```bash
   npm run docker:down
   npm run docker:up
   npm run setup
   ```

## AWS Access

### LocalStack (Development/Testing)

Access local AWS emulation:

```bash
# Use endpoint URL
aws --endpoint-url=http://localhost:4567 dynamodb scan \
  --table-name main-USERS

# Or set environment variable
export AWS_ENDPOINT_URL=http://localhost:4567
aws dynamodb scan --table-name main-USERS
```

### Real AWS (Staging/Production)

**Read-only access** for debugging with special IAM user:

```bash
# Configure profile
aws configure --profile claude-code

# Query staging
aws dynamodb scan \
  --table-name staging-USERS \
  --profile claude-code \
  --max-items 10

# View Lambda logs
aws logs tail /aws/lambda/staging-my-function \
  --profile claude-code \
  --follow

# Check CloudFormation stack
aws cloudformation describe-stacks \
  --stack-name my-app-db-staging \
  --profile claude-code
```

**Never**:
- Modify production data
- Delete resources
- Update configurations
- Deploy changes

**Only**:
- Read data for debugging
- View logs
- Check resource configurations
- Query metrics

## Code Patterns

### Loading Worktree Environment

```javascript
// test/vitest.setup.mjs
import { loadWorktreeEnvironment } from './helpers/worktree/env-loader.mjs';

// Load before tests
await loadWorktreeEnvironment();
```

### Using Environment-Specific Resources

```javascript
// Get table name with environment prefix
const tableName = `${process.env.TABLE_PREFIX}-USERS`;

// Or use helper
import { getCurrentWorktreeConfig } from './helpers/worktree/config-generator.mjs';
const config = getCurrentWorktreeConfig();
const tableName = `${config.aws.tablePrefix}-USERS`;
```

### Connecting to LocalStack

```javascript
// DynamoDB client
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  endpoint: process.env.AWS_ENDPOINT_URL,
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  }
});
```

### Docker Compose in Worktree

```javascript
// test/helpers/worktree/docker-wrapper.mjs
import { generateDockerComposeConfig } from './helpers/worktree/docker-wrapper.mjs';

// Generate worktree-specific compose file
const config = generateDockerComposeConfig(branchName);
```

## File Structure

### Important Files to Check

When making changes, be aware of:

```
project/
├── .trees/                      # Worktree directories (gitignored)
│   └── feature-name/
│       ├── CLAUDE.md            # Reference to CLAUDE_INSTRUCTIONS.md
│       └── CLAUDE_INSTRUCTIONS.md  # Feature documentation + git workflow
├── scripts/worktree/            # Worktree management scripts
│   ├── create-worktree.mjs
│   ├── list-worktrees.mjs
│   ├── merge-worktree.mjs
│   └── remove-worktree.mjs
├── test/                        # Test infrastructure
│   ├── .env.worktree            # Worktree-specific env (gitignored)
│   ├── helpers/worktree/        # Worktree helpers
│   │   ├── config-generator.mjs
│   │   ├── env-loader.mjs
│   │   └── docker-wrapper.mjs
│   └── tests/
├── .deploy/                     # AWS CloudFormation templates
│   └── IaC/
│       ├── db/                  # Database stack
│       └── infra/               # Infrastructure stack
└── docs/                        # Documentation
    ├── WORKTREES.md
    ├── GIT_WORKFLOW.md
    ├── PARALLEL_TESTING.md
    └── AWS_INFRASTRUCTURE.md
```

### Files That Should Never Be Modified

- `.git/worktrees/` - Git internal worktree data
- `.trees/` - Worktree directories (managed by scripts)
- `.worktree-info.json` - Generated worktree metadata
- `CLAUDE_INSTRUCTIONS.md` - Auto-generated instructions (edit manually if needed, but won't be committed)

### Files to Update Carefully

- `package.json` - Check worktree scripts don't get removed
- `.gitignore` - Maintain worktree patterns
- `test/helpers/worktree/*.mjs` - Core worktree functionality

## Common Tasks

### Task: Add New Feature

```bash
# 1. Create worktree
npm run worktree:create feature-name

# 2. Move to worktree
cd .trees/feature-name

# 3. Check instructions file
cat CLAUDE_INSTRUCTIONS.md

# 4. Implement feature
# ... make changes ...

# 5. Run tests
cd test
npm run docker:up
npm run setup
npm test

# 6. Commit
cd ..
git add .
git commit -m "feat: implement feature"

# 7. Merge when done
cd ../..
npm run worktree:merge feature-name
npm run worktree:remove feature-name
```

### Task: Fix Bug in Worktree

```bash
# 1. Go to worktree
cd .trees/fix-bug

# 2. Rebase first
git fetch origin
git rebase origin/main

# 3. Fix bug
# ... make changes ...

# 4. Test fix
cd test && npm test

# 5. Commit
cd ..
git add .
git commit -m "fix: resolve issue with validation"

# 6. Merge
cd ../..
npm run worktree:merge fix-bug
```

### Task: Debug Test Failure

```bash
# 1. Check LocalStack
docker ps | grep localstack
docker logs app-feature-name-localstack

# 2. Check environment
cat test/.env.worktree
echo $LOCALSTACK_PORT

# 3. Verify resources
aws --endpoint-url=http://localhost:$LOCALSTACK_PORT dynamodb list-tables

# 4. Restart if needed
cd test
npm run docker:down
npm run docker:up
npm run setup

# 5. Run specific test
npm test -- tests/integration/problematic-test.mjs
```

### Task: Review CloudFormation Template

```bash
# 1. Read current template
cat .deploy/IaC/db/db.yml

# 2. Check parameters
cat .deploy/IaC/db/configs/db-staging.json

# 3. Validate template
aws cloudformation validate-template \
  --template-body file://.deploy/IaC/db/db.yml

# 4. Suggest improvements
# (based on AWS best practices)
```

### Task: Update Worktree Scripts

When modifying worktree management scripts:

1. **Test in a disposable worktree first**
2. **Don't break existing worktrees**
3. **Update documentation** if behavior changes
4. **Test create, list, merge, remove** workflow

## Safety Checks

Before executing commands, verify:

### ✓ Check Current Directory

```bash
pwd
# Are you in the right worktree?
```

### ✓ Check Current Branch

```bash
git branch --show-current
# Are you on the right branch?
```

### ✓ Check for Uncommitted Changes

```bash
git status
# Will this operation lose work?
```

### ✓ Check Worktree Instructions

```bash
cat CLAUDE_INSTRUCTIONS.md 2>/dev/null
# Does this align with what you're doing?
```

### ✗ Never

- Force push to main/staging/prod
- Delete worktrees with uncommitted changes (without confirmation)
- Commit secrets or credentials
- Modify production AWS resources
- Skip tests before merging

## See Also

- [WORKTREES.md](./WORKTREES.md) - Complete worktree workflow
- [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) - Git best practices
- [PARALLEL_TESTING.md](./PARALLEL_TESTING.md) - Testing infrastructure
- [AWS_INFRASTRUCTURE.md](./AWS_INFRASTRUCTURE.md) - CloudFormation templates
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues
