# Git Worktrees Guide

This guide explains how to use git worktrees for parallel feature development in your project.

## Table of Contents

- [What are Git Worktrees?](#what-are-git-worktrees)
- [Why Use Worktrees?](#why-use-worktrees)
- [Quick Start](#quick-start)
- [Available Commands](#available-commands)
- [Parallel Development Workflow](#parallel-development-workflow)
- [Best Practices](#best-practices)
- [Common Issues](#common-issues)

## What are Git Worktrees?

Git worktrees allow you to have multiple branches checked out simultaneously in separate directories. Each worktree is an independent working directory with its own files, but they all share the same Git repository.

## Why Use Worktrees?

- **Parallel Development**: Work on multiple features simultaneously without switching branches
- **Isolated Environments**: Each worktree is a separate working directory
- **Context Preservation**: No need to stash changes when switching between features
- **Faster Development**: Work on multiple features in parallel
- **Independent Testing**: Run tests in different worktrees simultaneously

## Quick Start

### Create Your First Worktree

```bash
npm run worktree:create feature-name
```

This creates a new worktree in `.trees/feature-name/` with:
- Independent branch checkout
- Separate working directory
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

# Run tests
cd test
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

Creates a new worktree with the specified branch name.

### List All Worktrees

```bash
npm run worktree:list
```

Shows all worktrees with their branch information and status.

### Merge a Worktree

```bash
npm run worktree:merge <branch-name>
```

Merges the worktree's branch into your current branch using `--no-ff` (preserves merge history).

### Remove a Worktree

```bash
npm run worktree:remove <branch-name>
```

Removes the worktree and deletes the branch (with confirmation).

## Parallel Development Workflow

### Scenario: Working on Multiple Features

```bash
# Create worktrees for different features
npm run worktree:create auth-system
npm run worktree:create payment-flow
npm run worktree:create ui-redesign

# Work on auth in one terminal
cd .trees/auth-system
# ... make changes ...
git commit -m "Implement auth"
cd test && npm test

# Work on payments in another terminal
cd .trees/payment-flow
# ... make changes ...
git commit -m "Add payment"
cd test && npm test

# Work on UI in a third terminal
cd .trees/ui-redesign
# ... make changes ...
git commit -m "Update UI"
cd test && npm test
```

Each worktree operates independently without conflicts.

## Best Practices

### 1. Use Descriptive Branch Names

```bash
# Good
npm run worktree:create feature/user-authentication
npm run worktree:create fix/login-error
npm run worktree:create refactor/database-layer

# Avoid
npm run worktree:create temp
npm run worktree:create test123
```

### 2. Document Your Work

When creating a worktree, you'll be prompted to add:
- Feature description
- Task list
- Technical approach

This creates `CLAUDE_INSTRUCTIONS.md` with your plan.

### 3. Keep Worktrees Short-Lived

- Create worktrees for specific features
- Merge and remove when done
- Don't let worktrees become stale

### 4. Regular Commits

Make small, frequent commits in your worktree:

```bash
git add .
git commit -m "Add login form"
git commit -m "Add validation"
git commit -m "Add tests"
```

### 5. Test Before Merging

Always run tests in the worktree before merging:

```bash
cd test
npm test
cd ..
npm run worktree:merge feature-name
```

### 6. Clean Up Regularly

Remove merged worktrees:

```bash
npm run worktree:list  # See what's there
npm run worktree:remove old-feature
```

## Common Issues

### Issue: "Branch already exists"

**Cause**: Trying to create a worktree with an existing branch name.

**Solution**:
```bash
# Use a different name
npm run worktree:create feature-login-v2

# Or delete the old branch first
git branch -D feature-login
npm run worktree:create feature-login
```

### Issue: "Worktree directory not empty"

**Cause**: Directory `.trees/feature-name/` already exists.

**Solution**:
```bash
# Remove the directory
rm -rf .trees/feature-name

# Or use a different name
npm run worktree:create feature-name-v2
```

### Issue: "Cannot merge: uncommitted changes"

**Cause**: Trying to merge when you have uncommitted changes in current branch.

**Solution**:
```bash
# Commit your changes first
git add .
git commit -m "WIP: current work"

# Or stash them
git stash

# Then merge
npm run worktree:merge feature-name
```

### Issue: "Merge conflicts"

**Cause**: Changes in the worktree conflict with current branch.

**Solution**:
```bash
# The merge command will pause and show conflicts
# Resolve conflicts in your editor
# Then complete the merge
git add .
git commit -m "Merge feature-name with conflict resolution"
```

## See Also

- [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) - Git best practices and workflow
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions
- [CLAUDE_INSTRUCTIONS.md](../../CLAUDE_INSTRUCTIONS.md) - AI assistant context

## Additional Resources

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [Parallel Development with Worktrees](https://morgan.cugerone.com/blog/how-to-use-git-worktree-and-in-a-clean-way/)
