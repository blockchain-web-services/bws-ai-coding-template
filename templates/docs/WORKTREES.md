# Git Worktrees Guide

This guide explains how to use git worktrees for parallel feature development in your project.

## Table of Contents

- [What are Git Worktrees?](#what-are-git-worktrees)
- [Why Use Worktrees?](#why-use-worktrees)
- [Quick Start](#quick-start)
- [Available Commands](#available-commands)
- [Port Allocation](#port-allocation)
- [Parallel Development Workflow](#parallel-development-workflow)
- [Best Practices](#best-practices)
- [Common Issues](#common-issues)

## What are Git Worktrees?

Git worktrees allow you to have multiple branches checked out simultaneously in separate directories. Each worktree is an independent working directory with its own files, but they all share the same Git repository.

## Why Use Worktrees?

- **Parallel Development**: Work on multiple features simultaneously without switching branches
- **Isolated Environments**: Each worktree has unique ports and Docker containers
- **No Port Conflicts**: Run tests in multiple worktrees at the same time
- **Context Preservation**: No need to stash changes when switching between features
- **Faster Testing**: Test multiple branches in parallel using LocalStack

## Quick Start

### Create Your First Worktree

```bash
npm run worktree:create feature-name
```

This creates a new worktree in `.trees/feature-name/` with:
- Unique LocalStack port (4567-4596 range)
- Unique Playwright port (8080-8109 range)
- Unique Docker container names
- Isolated DynamoDB tables and S3 buckets
- `CLAUDE_INSTRUCTIONS.md` file for feature documentation and git workflow
- `CLAUDE.md` file with reference to instructions

### Switch to the Worktree

```bash
cd .trees/feature-name
```

### Work Normally

```bash
# Make changes
git add .
git commit -m "Add feature"

# Run tests (if AWS enabled)
cd test
npm run docker:up
npm test
```

### Merge When Done

```bash
# Return to main worktree
cd ../..

# Merge the feature
npm run worktree:merge feature-name
```

### Clean Up

```bash
npm run worktree:remove feature-name
```

## Available Commands

### Create a Worktree

```bash
npm run worktree:create <branch-name>
```

Creates a new git worktree with:
- Automatic port assignment based on branch name hash
- Environment configuration in `test/.env.worktree`
- Instructions file at `CLAUDE_INSTRUCTIONS.md` (with feature context and git workflow)
- Reference file at `CLAUDE.md`
- Isolated Docker setup

### List All Worktrees

```bash
npm run worktree:list
```

Shows all worktrees with their:
- Branch name
- Location
- Assigned ports
- Creation date (if available)

### Merge a Worktree

```bash
npm run worktree:merge <branch-name>

# With flags (note the -- separator for npm flag passing):
npm run worktree:merge <branch-name> -- --update      # Auto-rebase before merge
npm run worktree:merge <branch-name> -- --no-push     # Skip auto-push to origin
npm run worktree:merge <branch-name> -- --force       # Force merge even if outdated
npm run worktree:merge <branch-name> -- --update --no-push  # Combine flags
```

Merges the worktree branch into your current branch using `--no-ff` to preserve history. This command:
- Validates the worktree exists
- Auto-commits any uncommitted changes in the worktree (with message: `chore: Auto-commit before merge to {branch}`)
- Performs the merge
- Preserves merge commit for traceability
- Automatically pushes to origin (unless `-- --no-push` is used)

### Remove a Worktree

```bash
npm run worktree:remove <branch-name>
```

Removes a worktree and cleans up:
- Git worktree directory
- Docker containers
- LocalStack data
- Environment files

## Port Allocation

Worktrees use **MD5 hash-based port allocation** to ensure:
1. **Deterministic**: Same branch name = same ports every time
2. **Unique**: Different branches get different ports
3. **No Conflicts**: Multiple worktrees can run tests simultaneously

### Port Ranges

- **LocalStack**: 4567-4596 (30 unique ports)
- **Playwright**: 8080-8109 (30 unique ports)
- **Debug**: 9229-9258 (30 unique ports)

### How It Works

```javascript
// Simplified algorithm
const hash = md5(branchName);
const offset = (hash[0] + hash[1]) % 30;
const localstackPort = 4567 + offset;
```

### Example

```bash
# Main branch
LocalStack: 4567
Playwright: 8080

# feature-auth
LocalStack: 4579 (offset: 12)
Playwright: 8092

# fix-bug-123
LocalStack: 4581 (offset: 14)
Playwright: 8094
```

## Parallel Development Workflow

### Scenario: Working on Two Features

```bash
# Start in main branch
cd /project

# Create first feature worktree
npm run worktree:create feature-auth
cd .trees/feature-auth
# Work on authentication feature...

# Open new terminal, create second feature
cd /project
npm run worktree:create feature-payment
cd .trees/feature-payment
# Work on payment feature...

# Both can run tests simultaneously without conflicts!
```

### Scenario: Urgent Bugfix While Developing

```bash
# You're working on a feature
cd .trees/feature-complex

# Urgent bug reported! Create hotfix worktree
cd ../..
npm run worktree:create hotfix-critical

# Fix bug in hotfix worktree
cd .trees/hotfix-critical
# make changes, commit, test

# Merge hotfix immediately
cd ../..
npm run worktree:merge hotfix-critical
npm run worktree:remove hotfix-critical

# Return to feature development
cd .trees/feature-complex
# Continue where you left off
```

## Best Practices

### 1. Use Descriptive Branch Names

```bash
# Good
npm run worktree:create feature-user-authentication
npm run worktree:create fix-payment-validation
npm run worktree:create refactor-database-layer

# Avoid
npm run worktree:create test
npm run worktree:create temp
npm run worktree:create foo
```

### 2. Document Your Work

When creating a worktree, the script prompts you to fill out the `CLAUDE_INSTRUCTIONS.md` file with:
- What feature/fix are you working on?
- What tasks need to be completed?
- What's your technical approach?
- How will you test it?

The file also includes git workflow instructions specific to your root branch.

### 3. Clean Up Regularly

Remove worktrees when done to avoid clutter:

```bash
npm run worktree:list
npm run worktree:remove old-feature
```

### 4. Sync with Main Branch

Before finishing work in a worktree:

```bash
# Inside worktree
git fetch origin
git rebase origin/{{ROOT_BRANCH}}

# Run tests again after rebase
cd test && npm test
```

### 5. One Worktree = One Feature

Keep worktrees focused on a single feature or bugfix. Don't try to work on multiple unrelated changes in one worktree.

## Common Issues

### Port Already in Use

```bash
# Error: Port 4567 already in use
```

**Solution**: Another process is using the port. Check what's running:

```bash
lsof -i :4567
# Or
netstat -tuln | grep 4567
```

Kill the process or wait for it to finish.

### Worktree Locked

```bash
# Error: Worktree is locked
```

**Solution**: Git crashed while using the worktree. Remove the lock:

```bash
rm -f .git/worktrees/<branch-name>/locked
```

### Docker Container Conflicts

```bash
# Error: Container name already in use
```

**Solution**: Previous container wasn't cleaned up:

```bash
cd test
npm run docker:down
npm run docker:up
```

### Can't Find Worktree

```bash
# Error: Worktree not found
```

**Solution**: List all worktrees to verify:

```bash
npm run worktree:list
# Or use git directly
git worktree list
```

### Tests Failing in Worktree

**Solution**: Make sure you installed test dependencies:

```bash
cd test
npm install
npm run setup  # Create AWS resources in LocalStack
npm test
```

## See Also

- [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) - Git best practices and merge strategies
- [PARALLEL_TESTING.md](./PARALLEL_TESTING.md) - Detailed testing setup and port allocation
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common problems and solutions
- [AWS_INFRASTRUCTURE.md](./AWS_INFRASTRUCTURE.md) - CloudFormation templates and AWS setup
