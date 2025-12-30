# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**bws-ai-coding-template** is an NPM package that adds git worktree management and parallel testing infrastructure to Node.js projects. It provides a CLI tool that installs template files, documentation, and AWS deployment infrastructure into existing projects.

**Current Status**: CLI implementation in progress. Template files are complete but the interactive installer needs to be built.

## Key Commands

### Development & Testing
```bash
# Install dependencies
npm install

# Test locally with npm link
npm link
cd /path/to/test/project
worktree-init

# Or test with npx
npx /mnt/x/Git/blockchain-web-services/utils/bws-ai-coding-template
```

### No Build/Lint/Test Scripts
⚠️ This project currently has placeholder test scripts. No build process or test suite exists yet.

## Architecture

### CLI Flow (lib/cli.js - NOT YET IMPLEMENTED)

The main CLI follows this workflow:
1. Display welcome message
2. Validate Git repository exists (lib/validators.js)
3. Detect project info from package.json
4. Run interactive prompts for project name, GitHub username, AWS deployment (lib/prompts.js)
5. Validate no file conflicts (lib/validators.js)
6. Show installation summary and confirm
7. Copy template files with variable replacement (lib/file-copier.js + lib/template-processor.js)
8. Update package.json with worktree scripts
9. Update .gitignore with worktree patterns
10. Display success message with next steps

### Template Variable Replacement

The installer must replace these placeholders in template files:
- `{{PROJECT_NAME}}` - From user input or package.json
- `{{GITHUB_USERNAME}}` - From user input
- `{{REPOSITORY_NAME}}` - Same as PROJECT_NAME
- `{{REPOSITORY_OWNER}}` - Same as GITHUB_USERNAME

Files requiring replacement:
- `templates/package.json`
- `templates/README.md`
- `templates/devops.yml`
- `templates/.deploy/IaC/db/configs/*.json`
- `templates/.deploy/IaC/infra/configs/*.json`

### Directory Structure

```
bws-ai-coding-template/
├── bin/
│   └── init.js              # Entry point (calls lib/cli.js)
├── lib/
│   ├── cli.js              # Main CLI flow (STUB - needs implementation)
│   ├── prompts.js          # Interactive questions (STUB - needs implementation)
│   ├── file-copier.js      # File operations (STUB - needs implementation)
│   ├── validators.js       # Pre-flight checks (STUB - needs implementation)
│   └── template-processor.js # NOT CREATED YET - variable replacement logic
└── templates/              # Files that get installed into target projects
    ├── .deploy/            # CloudFormation templates (optional, AWS-only)
    ├── scripts/worktree/   # Worktree management scripts (always installed)
    ├── test/               # Test infrastructure (optional, AWS-only)
    ├── docs/               # NOT CREATED YET - documentation files
    ├── devops.yml          # CI/CD pipeline (optional, AWS-only)
    ├── package.json        # NPM scripts to add
    └── .gitignore          # Patterns to append
```

### Worktree Configuration System

The core innovation is **MD5 hash-based port allocation** (`templates/test/helpers/worktree/config-generator.mjs`):

```javascript
// Each worktree gets unique, reproducible ports based on branch name hash
const hash = crypto.createHash('md5').update(branchName).digest();
const offset = (hash[0] + hash[1]) % 30; // 0-29 range

ports: {
    localstack: 4567 + offset,   // AWS LocalStack
    playwright: 8080 + offset,   // Web server
    debug: 9229 + offset         // Node.js debugger
}
```

This allows multiple worktrees to run tests in parallel without port conflicts.

### AWS Infrastructure Templates

**Database Stack** (`.deploy/IaC/db/db.yml`):
- CloudFormation template for DynamoDB tables
- Uses `${RepositoryBranchName}` prefix for table names
- Example tables: DEMO_ITEMS, DEMO_USERS, DEMO_SESSIONS
- PAY_PER_REQUEST billing mode

**Infrastructure Stack** (`.deploy/IaC/infra/infra.yml`):
- Lambda functions, Step Functions, S3 buckets
- Template should be customized per project

**CI/CD Pipeline** (`templates/devops.yml`):
- CodePipeline with GitHub webhook
- Stages: Source → DB → Infrastructure → Post-deployment
- Uses CodeBuild for pre/post build hooks

### Safety Mechanisms

The installer must be **non-destructive**:
- ❌ Abort if `.deploy/` exists (when AWS is enabled)
- ❌ Abort if `test/` or `tests/` exists (when AWS is enabled)
- ⚠️ Warn before overwriting `scripts/worktree/`
- ✅ Never overwrite existing files without explicit confirmation

### Git Workflow Integration

Worktree scripts in `templates/scripts/worktree/`:

**create-worktree.mjs**:
- Creates `.trees/<branch-name>/` directory
- Generates unique ports and container names
- Creates `WORKTREE_CONTEXT.md` for feature documentation
- Optionally prompts for feature description, task list, technical approach

**list-worktrees.mjs**: Show all worktrees with their branch info

**merge-worktree.mjs**: Merge worktree to current branch (enforces --no-ff)

**remove-worktree.mjs**: Clean up worktree and Docker containers

## Implementation Priority

Based on IMPLEMENTATION_PLAN.md:

1. **HIGH**: Complete lib/*.js stubs (cli.js, prompts.js, validators.js, file-copier.js)
2. **HIGH**: Create lib/template-processor.js for variable replacement
3. **MEDIUM**: Create templates/docs/ folder with 7 documentation files
4. **MEDIUM**: Add CLI flags (--dry-run, --add-aws, --force, --help)
5. **LOW**: Testing and NPM publishing

## Development Guidelines

### When implementing the CLI:

1. **Use inquirer** for interactive prompts (already in dependencies)
2. **Use chalk** for colored output (already in dependencies)
3. **Use fs-extra** for file operations (already in dependencies)
4. **Use commander** for CLI argument parsing (already in dependencies)

### File Operations:

- Use `fs-extra` methods (readJson, writeJson, copy, pathExists)
- Always check file existence before copying
- Preserve exact content when copying (no line ending changes)
- Handle both Windows and Unix paths correctly

### Variable Replacement:

- Create `lib/template-processor.js` with `replaceVariables(content, replacements)`
- Use global regex replacement: `new RegExp('{{KEY}}', 'g')`
- Process files during copy, not after

### Error Handling:

- Graceful failures with helpful error messages
- Suggest remediation steps (e.g., "Run 'git init' first")
- Clean up partial installations on error
- Use proper exit codes

## Important Context

### This is NOT a user project
This repository is the **template installer package itself**, not a project that uses the templates. The templates in `templates/` are what get installed into user projects.

### Main vs Worktree Environments
When templates are installed:
- **Main branch** gets LocalStack on port 4567, Playwright on port 8080
- **feature-a worktree** gets different ports based on MD5('feature-a')
- Each worktree is completely isolated with separate Docker containers

### LocalStack Integration
The test infrastructure uses LocalStack for AWS service emulation:
- DynamoDB tables with branch-specific prefixes
- S3 buckets with branch-specific names
- All configured via environment variables in `.env.worktree`

## Missing Pieces

### To be created:

1. **lib/template-processor.js** - Variable replacement logic
2. **templates/docs/** folder with 7 files:
   - WORKTREES.md - Worktree workflow guide
   - GIT_WORKFLOW.md - Rebase and merge rules
   - PARALLEL_TESTING.md - MD5 port allocation explained
   - AWS_INFRASTRUCTURE.md - CloudFormation templates
   - CICD_PIPELINE.md - CodePipeline setup
   - TROUBLESHOOTING.md - Common issues
   - CLAUDE_INSTRUCTIONS.md - AI assistant integration

### To be implemented in stubs:

All lib/*.js files have TODO comments with detailed implementation examples from IMPLEMENTATION_PLAN.md. Refer to that file for complete code examples.

## Node Version

Requires Node.js 18.0.0 or later (specified in package.json engines field).

## Package Entry Points

- **bin/init.js**: CLI entry point, executable via `npx` or `worktree-init`
- **lib/cli.js**: Main export, `runCLI()` function
