# Git Workflow Guide

Best practices for Git workflows when using worktrees in your project.

## Table of Contents

- [Core Principles](#core-principles)
- [Commit Guidelines](#commit-guidelines)
- [Rebase Before Commit](#rebase-before-commit)
- [Merge with --no-ff](#merge-with---no-ff)
- [Branch Naming](#branch-naming)
- [Conflict Resolution](#conflict-resolution)
- [Worktree-Specific Patterns](#worktree-specific-patterns)

## Core Principles

### 1. Always Rebase Before Committing

Keep your branch up to date with the root branch before creating commits:

```bash
git fetch origin
git rebase origin/{{ROOT_BRANCH}}
```

This ensures:
- Linear history
- Easier conflict resolution
- Clean merge commits
- Better bisect-ability

### 2. Always Use --no-ff for Merges

Never fast-forward merge feature branches:

```bash
# Good - preserves feature branch history
git merge --no-ff feature-branch

# Bad - loses branch context
git merge feature-branch
```

The `npm run worktree:merge` command automatically uses `--no-ff`.

### 3. One Commit = One Logical Change

Each commit should represent a single logical change:

```bash
# Good
git commit -m "Add user authentication endpoint"
git commit -m "Add authentication tests"
git commit -m "Update API documentation"

# Bad
git commit -m "WIP"
git commit -m "Fixed stuff"
git commit -m "Changes"
```

## Commit Guidelines

### Commit Message Format

```
<type>: <short description>

[Optional longer description explaining the what and why]

[Optional footer with references]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring without behavior change
- `test`: Adding or updating tests
- `docs`: Documentation changes
- `chore`: Build process, dependencies, etc.
- `perf`: Performance improvements
- `style`: Code style changes (formatting, etc.)

### Examples

```bash
# Feature
git commit -m "feat: add user registration endpoint

Implements POST /api/users with email validation and password hashing.
Includes input validation and error handling."

# Bug fix
git commit -m "fix: prevent duplicate user emails

Check for existing email before creating user.
Returns 409 Conflict if email already exists."

# Refactor
git commit -m "refactor: extract validation logic to separate module

Moved all input validation functions to lib/validation.js
for better reusability and testing."
```

## Rebase Before Commit

### Standard Workflow

```bash
# 1. Make sure you're in your worktree
cd .trees/feature-name

# 2. Fetch latest changes
git fetch origin

# 3. Rebase your branch onto main
git rebase origin/{{ROOT_BRANCH}}

# 4. Resolve any conflicts (if needed)
# Edit conflicting files, then:
git add .
git rebase --continue

# 5. Run tests to ensure nothing broke
cd test && npm test

# 6. Now commit your changes
git add .
git commit -m "feat: add new feature"
```

### Why Rebase First?

1. **Ensures compatibility**: Your code works with the latest main branch
2. **Easier conflict resolution**: Fix conflicts before committing
3. **Cleaner history**: Linear progression of commits
4. **Better reviews**: Reviewers see changes in context of current main

### Interactive Rebase for Cleanup

Before merging, clean up your commit history:

```bash
# Review and edit last 5 commits
git rebase -i HEAD~5
```

Options:
- `pick`: Keep commit as-is
- `reword`: Change commit message
- `squash`: Combine with previous commit
- `fixup`: Like squash but discard this commit's message
- `drop`: Remove commit entirely

Example:

```bash
# Before
git log --oneline
abc123 WIP
def456 Fix typo
ghi789 Add feature
jkl012 Fix bug in feature
mno345 Final version

# Interactive rebase to clean up
git rebase -i HEAD~5

# After
git log --oneline
xyz789 feat: add user authentication with email validation
```

## Merge with --no-ff

### Why --no-ff?

The `--no-ff` (no fast-forward) flag creates a merge commit even when Git could fast-forward:

```bash
# Without --no-ff (fast-forward)
* abc123 (main) feat: new feature

# With --no-ff (merge commit)
*   def456 (main) Merge branch 'feature-name'
|\
| * abc123 feat: new feature
|/
```

### Benefits

1. **Preserve Branch History**: Can see which commits were part of a feature
2. **Easy Rollback**: Revert entire feature with one command
3. **Better Visibility**: Clear boundaries between features
4. **Traceability**: Know when feature was integrated

### Using the Merge Command

```bash
# The worktree:merge command automatically uses --no-ff
npm run worktree:merge feature-name

# Equivalent to:
git merge --no-ff feature-name
```

### Manual Merge (if needed)

```bash
# 1. Switch to target branch (root branch)
git checkout {{ROOT_BRANCH}}

# 2. Pull latest changes
git pull origin {{ROOT_BRANCH}}

# 3. Merge with --no-ff
git merge --no-ff feature-name

# 4. Push
git push origin {{ROOT_BRANCH}}
```

## Branch Naming

### Naming Convention

Use descriptive, hyphenated lowercase names:

```bash
# Format: <type>-<description>

# Features
feature-user-authentication
feature-payment-integration
feature-admin-dashboard

# Bugfixes
fix-login-redirect
fix-payment-validation
fix-email-template

# Hotfixes (urgent production fixes)
hotfix-security-vulnerability
hotfix-memory-leak

# Refactoring
refactor-database-queries
refactor-api-endpoints

# Experiments
experiment-new-algorithm
experiment-caching-strategy
```

### Naming Rules

1. **Use lowercase**: `feature-name`, not `Feature-Name`
2. **Use hyphens**: `feature-name`, not `feature_name`
3. **Be descriptive**: `feature-user-auth`, not `feature1`
4. **Include type prefix**: `feature-`, `fix-`, `hotfix-`, `refactor-`
5. **Keep it short**: Aim for 2-4 words

## Conflict Resolution

### When Conflicts Occur

During rebase or merge, Git may find conflicts:

```bash
Auto-merging src/api/users.js
CONFLICT (content): Merge conflict in src/api/users.js
```

### Resolution Steps

1. **Open the conflicting file**:

```javascript
<<<<<<< HEAD
// Your changes
function authenticate(user) {
    return jwt.sign(user, secret);
}
=======
// Incoming changes
function authenticate(credentials) {
    return createToken(credentials);
}
>>>>>>> feature-branch
```

2. **Decide what to keep**:

```javascript
// Resolved - combining both approaches
function authenticate(credentials) {
    return jwt.sign(credentials, secret);
}
```

3. **Mark as resolved**:

```bash
git add src/api/users.js
```

4. **Continue rebase/merge**:

```bash
git rebase --continue
# Or
git merge --continue
```

5. **Test thoroughly**:

```bash
cd test && npm test
```

### Conflict Prevention

1. **Rebase frequently**: Don't let branches diverge too long
2. **Communicate**: Coordinate with team on overlapping work
3. **Small commits**: Easier to resolve conflicts
4. **Feature flags**: Deploy incomplete features behind flags

## Worktree-Specific Patterns

### Pattern 1: Main + Feature Worktrees

```bash
# Main worktree (stable)
/project                    # main branch

# Feature worktrees
/project/.trees/feature-a   # feature-a branch
/project/.trees/feature-b   # feature-b branch
/project/.trees/hotfix-1    # hotfix-1 branch
```

### Pattern 2: Starting Work

```bash
# 1. Ensure root branch is up to date
cd /project
git pull origin {{ROOT_BRANCH}}

# 2. Create feature worktree
npm run worktree:create feature-name
cd .trees/feature-name

# 3. Start working
# ... make changes ...

# 4. Commit regularly
git add .
git commit -m "feat: implement feature part 1"
```

### Pattern 3: Keeping Worktree Updated

```bash
# Inside worktree
cd .trees/feature-name

# Rebase regularly (at least daily)
git fetch origin
git rebase origin/{{ROOT_BRANCH}}

# Run tests after rebase
cd test && npm test
```

### Pattern 4: Finishing Work

```bash
# 1. Final rebase
cd .trees/feature-name
git fetch origin
git rebase origin/{{ROOT_BRANCH}}

# 2. Final tests
cd test && npm test

# 3. Return to main
cd ../..

# 4. Merge feature
npm run worktree:merge feature-name

# 5. Push to remote
git push origin {{ROOT_BRANCH}}

# 6. Clean up worktree
npm run worktree:remove feature-name
```

### Pattern 5: Long-Running Features

For features that take multiple days:

```bash
# Push worktree branch to remote for backup
cd .trees/feature-name
git push -u origin feature-name

# Other developers can check it out
cd /project
npm run worktree:create feature-name
# Will automatically track the remote branch
```

### Pattern 6: Code Review

```bash
# Reviewer creates worktree from PR branch
npm run worktree:create pr-123-feature-name

# Review code in isolation
cd .trees/pr-123-feature-name

# Run tests
cd test
npm install
npm test

# When done reviewing
cd ../..
npm run worktree:remove pr-123-feature-name
```

## Gitignore for Worktrees

The installer automatically adds these patterns to `.gitignore`:

```gitignore
# Worktree-specific files
.env.worktree
.worktree-info.json
docker-compose.worktree.yml
CLAUDE_INSTRUCTIONS.md
test/.env.worktree
test/.worktree-info.json
.trees/*/CLAUDE_INSTRUCTIONS.md
```

These files are specific to each worktree and should not be committed.

## See Also

- [WORKTREES.md](./WORKTREES.md) - Complete worktree workflow guide
- [PARALLEL_TESTING.md](./PARALLEL_TESTING.md) - Testing in parallel worktrees
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common Git issues and solutions
