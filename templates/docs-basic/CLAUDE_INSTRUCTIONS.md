# Claude Code Instructions

This file provides context for Claude Code when working in this repository.

## Project Structure

This project uses **git worktrees** for parallel feature development. Each feature is developed in an isolated worktree.

## Current Worktree

- **Branch**: `{{BRANCH_NAME}}`
- **Directory**: `.trees/{{BRANCH_NAME}}/`
- **Root Branch**: `{{ROOT_BRANCH}}`

## Available Commands

```bash
# Worktree management
npm run worktree:create <name>   # Create new worktree
npm run worktree:list            # List all worktrees
npm run worktree:merge <name>    # Merge worktree to current branch
npm run worktree:remove <name>   # Remove a worktree

# Testing
cd test
npm install
npm test                         # Run all tests
npm run test:ui                  # Run tests in UI mode
```

## Git Workflow

### Making Changes

1. Make your changes in this worktree
2. Commit frequently with clear messages
3. Run tests before merging

```bash
# Example workflow
git add .
git commit -m "feat: add new feature"
cd test && npm test
```

### Merging Back

When your feature is complete:

```bash
# Return to root worktree
cd ../..

# Merge the feature (creates merge commit)
npm run worktree:merge {{BRANCH_NAME}}

# Push to remote
git push origin {{ROOT_BRANCH}}
```

### Important Git Rules

- ✅ **Always use `--no-ff`** for merges (preserves feature history)
- ✅ **Rebase feature branches** before merging
- ✅ **Write clear commit messages** following conventional commits
- ❌ **Never rebase public branches** (master, main, staging)
- ❌ **Never force push** to shared branches

## Testing

### Running Tests

```bash
cd test

# Install dependencies (first time)
npm install

# Run tests
npm test

# Run in UI mode
npm run test:ui

# Run in headed mode (see browser)
npm run test:headed
```

### Writing Tests

Tests use Playwright Test framework. Add new tests in `test/tests/`:

```javascript
import { test, expect } from '@playwright/test';

test('my feature', async ({ page }) => {
  // Your test here
});
```

## Documentation

- [WORKTREES.md](docs/worktrees/WORKTREES.md) - Worktree workflow guide
- [GIT_WORKFLOW.md](docs/worktrees/GIT_WORKFLOW.md) - Git best practices
- [TROUBLESHOOTING.md](docs/worktrees/TROUBLESHOOTING.md) - Common issues

## Best Practices

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add user authentication
fix: resolve login error
docs: update API documentation
test: add integration tests
refactor: simplify auth logic
```

### Code Organization

- Keep files focused and modular
- Write tests for new features
- Update documentation when needed
- Follow existing code style

### Before Merging

- [ ] All tests pass
- [ ] Code reviewed (if applicable)
- [ ] Documentation updated
- [ ] No console.log() statements left
- [ ] Commits are clean and well-named

## Worktree Context

This worktree was created for:

**Feature Description**:
_To be filled when creating worktree_

**Tasks**:
- [ ] _Task 1_
- [ ] _Task 2_
- [ ] _Task 3_

**Technical Approach**:
_To be filled when creating worktree_

## See Also

- [Project README](../../README.md) - Main project documentation
- [Git Worktree Docs](https://git-scm.com/docs/git-worktree) - Official git documentation

---

**Note**: This file is gitignored and won't be committed. It's for local context only.
