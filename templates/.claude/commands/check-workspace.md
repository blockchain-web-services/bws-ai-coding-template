---
description: Verify current workspace location and check for workspace boundary violations
enabled: true
---

# Check Workspace Location

You are being asked to verify the current workspace location and validate that file operations will stay within appropriate boundaries.

## Your Task

Perform a comprehensive workspace check with the following steps:

### 1. Verify Current Working Directory

```bash
pwd
```

Determine if you're in:
- **Root repository**: Path does NOT contain `.trees/`
- **Worktree**: Path CONTAINS `.trees/{branch-name}/`

### 2. Display Current Workspace Information

If in root repository, show:
```
📍 Workspace: ROOT REPOSITORY
   Path: {current_directory}

⚠️  Warning: Changes made here affect ALL worktrees
   Consider working in a worktree for feature development
```

If in worktree, show:
```
📍 Workspace: WORKTREE
   Branch: {branch_name}
   Path: {worktree_path}
   Root: {root_repository_path}

✅ Safe workspace for development
   All file changes should stay within this directory
```

### 3. Check for Workspace Boundary Files

Verify that workspace boundary documentation exists:

```bash
# If in worktree, check for:
ls -la CLAUDE_INSTRUCTIONS.md
ls -la CLAUDE.md

# Both files should exist and contain workspace boundary information
```

If files are missing, warn the user:
```
⚠️  Missing workspace boundary documentation
   Expected files:
   - CLAUDE_INSTRUCTIONS.md (workspace context and rules)
   - CLAUDE.md (Claude Code instructions)

   These files are created automatically when the worktree is created.
   If missing, consider recreating the worktree.
```

### 4. Validate Recent File Operations (Optional)

If the user has concerns about recent changes, check git status:

```bash
git status --short
```

Analyze the output:
- Files should be within the current workspace
- If in worktree, files should NOT start with `../../` (escaping to root)
- Highlight any suspicious paths that escape the workspace

### 5. Provide Safety Recommendations

Based on the workspace check, provide specific recommendations:

**If in root repository:**
- "To develop features safely, create a worktree: `npm run worktree:create`"
- "Root repository changes affect all worktrees - proceed with caution"
- "Review changes with: `git diff`"

**If in worktree:**
- "✅ You're in a safe workspace for development"
- "All file modifications should stay within: `{worktree_path}`"
- "DO NOT modify files in: `{root_path}` (use `../../` with extreme caution)"
- "When ready to merge: `cd ../.. && npm run worktree:merge {branch_name}`"

**If workspace violations detected:**
- "🚨 STOP: Detected file paths escaping workspace"
- "Files attempting to modify root: {list_of_files}"
- "This could affect other worktrees and developers"
- "Please confirm with user before proceeding"

## Example Output

### Example 1: In Worktree (Safe)
```
Running workspace check...

📍 Workspace: WORKTREE
   Branch: feature-auth
   Path: /project/.trees/feature-auth
   Root: /project

✅ Safe workspace for development
   All file changes should stay within this directory

📋 Workspace Files:
   ✓ CLAUDE_INSTRUCTIONS.md exists
   ✓ CLAUDE.md exists

📊 Git Status:
   M  src/auth/login.js
   M  src/auth/register.js

✅ All changed files are within workspace

💡 Recommendations:
   • Continue development in this worktree
   • All file operations will stay isolated
   • Merge when ready: cd ../.. && npm run worktree:merge feature-auth
```

### Example 2: In Root Repository (Warning)
```
Running workspace check...

📍 Workspace: ROOT REPOSITORY
   Path: /project

⚠️  Warning: Changes made here affect ALL worktrees
   Consider working in a worktree for feature development

📊 Git Status:
   M  src/core/config.js
   M  src/core/database.js

⚠️  Changes to root repository affect all worktrees

💡 Recommendations:
   • Create a worktree for feature development: npm run worktree:create
   • Root changes should be configuration or infrastructure updates
   • If developing a feature, use a worktree instead
```

### Example 3: Workspace Violation Detected (Critical)
```
Running workspace check...

📍 Workspace: WORKTREE
   Branch: feature-api
   Path: /project/.trees/feature-api
   Root: /project

🚨 WORKSPACE BOUNDARY VIOLATION DETECTED

   The following files escape the worktree workspace:

   ❌ ../../src/config.js (root repository)
   ❌ ../../package.json (root repository)

   These changes would affect ALL worktrees and other developers!

⚠️  CRITICAL: Do NOT proceed with these changes

   Options:
   1. Modify only files within the worktree: /project/.trees/feature-api
   2. If root changes are necessary, ask user for confirmation first
   3. Consider if these changes belong in the worktree at all

💡 Recommended Actions:
   • Review which files actually need changes
   • Revert root repository modifications: git checkout ../../src/config.js
   • Make equivalent changes within worktree if needed
```

## Important Notes

- **Always run this check before committing** if you're unsure about workspace boundaries
- **This is a diagnostic tool** - it doesn't modify any files
- **If violations are detected**, stop and confirm with the user before proceeding
- **Read CLAUDE_INSTRUCTIONS.md** for context about what you're building in this worktree

## When to Use This Command

- After starting a new Claude Code session in a worktree
- Before committing changes if you're unsure about file locations
- When user reports unexpected changes to root repository files
- Before running `/devops-check` or `/worktree-merge` commands
- Any time you need to verify your working location

---

Remember: **Worktrees are isolated workspaces**. Changes should stay within the worktree directory and only be merged back through the proper workflow.
