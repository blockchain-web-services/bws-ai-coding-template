# Troubleshooting Guide

Common issues and solutions when working with git worktrees.

## Table of Contents

- [Worktree Issues](#worktree-issues)
- [Git Issues](#git-issues)
- [Test Issues](#test-issues)
- [General Tips](#general-tips)

## Worktree Issues

### Cannot create worktree - branch already exists

**Error**:
```
fatal: a branch named 'feature-name' already exists
```

**Cause**: The branch name is already in use.

**Solution**:
```bash
# Option 1: Use a different name
npm run worktree:create feature-name-v2

# Option 2: Delete the existing branch (if safe)
git branch -D feature-name
npm run worktree:create feature-name

# Option 3: List all branches to find a unique name
git branch -a
```

### Directory already exists

**Error**:
```
fatal: '.trees/feature-name' already exists
```

**Cause**: The worktree directory hasn't been cleaned up.

**Solution**:
```bash
# Remove the directory
rm -rf .trees/feature-name

# Then create the worktree
npm run worktree:create feature-name
```

### Cannot remove worktree - uncommitted changes

**Error**:
```
error: Worktree has uncommitted changes
```

**Cause**: The worktree has uncommitted changes.

**Solution**:
```bash
# Go to the worktree
cd .trees/feature-name

# Commit the changes
git add .
git commit -m "Final changes"

# Or discard them (careful!)
git reset --hard

# Return and remove
cd ../..
npm run worktree:remove feature-name
```

### Worktree is locked

**Error**:
```
fatal: 'remove' cannot be used with a locked working tree
```

**Cause**: Git has locked the worktree (usually after a crash).

**Solution**:
```bash
# Unlock the worktree
cd .git/worktrees/feature-name
rm -f gitdir.lock

# Or force remove
git worktree remove --force .trees/feature-name
```

## Git Issues

### Merge conflicts

**Error**:
```
CONFLICT (content): Merge conflict in file.js
Automatic merge failed
```

**Cause**: Changes in the worktree conflict with the current branch.

**Solution**:
```bash
# The merge command will pause
# Edit conflicted files (look for <<<<<<< markers)
# After resolving:
git add .
git commit -m "Merge feature-name with conflict resolution"
```

### Cannot merge - uncommitted changes

**Error**:
```
error: Your local changes would be overwritten by merge
```

**Cause**: You have uncommitted changes in the current branch.

**Solution**:
```bash
# Option 1: Commit your changes
git add .
git commit -m "WIP: current work"

# Option 2: Stash your changes
git stash
# (after merge, retrieve with: git stash pop)

# Then proceed with merge
npm run worktree:merge feature-name
```

### Detached HEAD state

**Error**:
```
You are in 'detached HEAD' state
```

**Cause**: Checked out a specific commit instead of a branch.

**Solution**:
```bash
# Create a new branch from current state
git checkout -b recovery-branch

# Or go back to a known branch
git checkout master
```

## Test Issues

### Tests failing

**Issue**: Tests that pass in main worktree fail in feature worktree.

**Solution**:
```bash
# Install dependencies in the worktree
cd .trees/feature-name/test
npm install

# Run tests again
npm test
```

### Playwright browsers not installed

**Error**:
```
Executable doesn't exist at /path/to/browser
```

**Solution**:
```bash
cd test
npx playwright install
```

### Tests pass locally but fail in CI

**Cause**: Different Node versions or missing dependencies.

**Solution**:
```bash
# Check Node version matches CI
node --version

# Ensure dependencies are up to date
cd test
rm -rf node_modules package-lock.json
npm install
```

## General Tips

### Clean up everything

If things are really broken:

```bash
# Remove all worktrees
npm run worktree:list
npm run worktree:remove <each-name>

# Clean test artifacts
cd test
rm -rf node_modules playwright-report test-results
npm install

# Reset git if needed
git clean -fd
git reset --hard
```

### Check worktree status

```bash
# List all worktrees
git worktree list

# Check for orphaned worktrees
git worktree prune
```

### Get help

```bash
# Git worktree help
git worktree --help

# NPM script help
npm run
```

## Need More Help?

- Check [WORKTREES.md](./WORKTREES.md) for workflow details
- Check [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) for git best practices
- Review git documentation: https://git-scm.com/docs/git-worktree

## Reporting Issues

If you encounter a bug or have a feature request:

1. Check existing issues in the repository
2. Provide detailed reproduction steps
3. Include your environment (Node version, OS, etc.)
4. Share relevant error messages
