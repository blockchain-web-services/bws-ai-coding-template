# BWS AI Coding Template

> Git worktree management and parallel testing toolkit for Node.js projects

[![npm version](https://badge.fury.io/js/%40blockchain-web-services%2Fbws-ai-coding-template.svg)](https://www.npmjs.com/package/@blockchain-web-services/bws-ai-coding-template)
[![Publish Package](https://github.com/blockchain-web-services/bws-ai-coding-template/actions/workflows/publish.yml/badge.svg?branch=master)](https://github.com/blockchain-web-services/bws-ai-coding-template/actions/workflows/publish.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🌳 **Git Worktree Management** - Work on multiple features simultaneously with isolated environments
- 🧪 **Parallel Testing** - Run tests in multiple worktrees without port conflicts (LocalStack + Playwright)
- ☁️ **AWS Infrastructure** - Optional CloudFormation templates for DynamoDB, Lambda, S3, Step Functions
- 🚀 **CI/CD Pipeline** - Optional CodePipeline setup with GitHub integration
- 🔒 **Claude Code IAM** - Read-only debugging access for AI assistant
- 📦 **Non-Destructive** - Won't overwrite existing files

## Quick Start

```bash
# Install and run in your project directory
npx @blockchain-web-services/bws-ai-coding-template

# Or install globally
npm install -g @blockchain-web-services/bws-ai-coding-template
worktree-init
```

## What Gets Installed

### Always Installed:
- ✅ Worktree management scripts (`scripts/worktree/`)
- ✅ Documentation (`docs/worktrees/`)
- ✅ Basic test setup with Playwright (`test/`)
- ✅ GitHub Actions workflow for testing (`.github/workflows/test.yml`)
- ✅ `.gitignore` patterns for worktrees
- ✅ NPM scripts for worktree commands

### Optional (with --add-aws flag):
- ✅ LocalStack test infrastructure (added to `test/`)
- ✅ CloudFormation templates (`.deploy/`)
- ✅ CI/CD pipeline (`devops.yml`)

## Interactive Setup

The installer will ask you:

1. **Project name** - Auto-detected from `package.json` or directory name
2. **GitHub username** - For repository configuration

**Note**: To include AWS infrastructure, use the `--add-aws` flag when running the installer.

## Safety Features

- ❌ **Won't overwrite** existing `.deploy/` folder
- ❌ **Won't overwrite** existing `test/` or `tests/` folder
- ⚠️ **Warns** before overwriting `scripts/worktree/`
- ✅ **Dry run** mode available (`--dry-run`)

## Usage After Installation

### Create a Worktree

```bash
npm run worktree:create feature-name
```

Each worktree gets:
- Unique LocalStack port (4567-4596)
- Unique Playwright port (8080-8109)
- Isolated Docker containers
- Separate DynamoDB tables

### Manage Worktrees

```bash
npm run worktree:list          # List all worktrees
npm run worktree:merge <name>  # Merge to current branch
npm run worktree:remove <name> # Remove a worktree
```

### Run Tests (if AWS enabled)

```bash
cd test
npm install
npm run docker:up    # Start LocalStack
npm run setup        # Create AWS resources
npm test             # Run all tests
```

## Parallel Testing

Multiple worktrees can run tests simultaneously:

```
Main branch:    LocalStack on port 4567
feature-a:      LocalStack on port 4579
feature-b:      LocalStack on port 4580
fix-bug:        LocalStack on port 4581
```

Each environment is completely isolated with unique:
- Ports
- Docker containers
- DynamoDB tables
- S3 buckets

## Documentation

After installation, see `docs/` folder for:
- `WORKTREES.md` - Complete worktree workflow
- `GIT_WORKFLOW.md` - Rebase, commit, merge best practices
- `PARALLEL_TESTING.md` - LocalStack, Docker, port isolation
- `AWS_INFRASTRUCTURE.md` - CloudFormation templates explained
- `CICD_PIPELINE.md` - CodePipeline and CodeBuild setup
- `TROUBLESHOOTING.md` - Common issues and solutions
- `CLAUDE_INSTRUCTIONS.md` - AI assistant integration

## Requirements

- **Node.js**: 18.x or later
- **Git**: 2.5+ (for worktree support)
- **Docker**: For LocalStack (if using AWS features)

## CLI Options

```bash
# Dry run (see what would be installed)
npx @blockchain-web-services/bws-ai-coding-template --dry-run

# Include AWS infrastructure and test templates (optional)
npx @blockchain-web-services/bws-ai-coding-template --add-aws

# Force update all files (use with caution)
npx @blockchain-web-services/bws-ai-coding-template --force
```

## Development Status

⚠️ **Currently in development** - Core functionality is complete but CLI implementation is pending.

See `IMPLEMENTATION_PLAN.md` for details on remaining work.

## Contributing

Contributions welcome! Please see the [contribution guidelines](CONTRIBUTING.md).

## License

MIT © Blockchain Web Services

## Support

- 📖 [Documentation](docs/)
- 🐛 [Report Issues](https://github.com/blockchain-web-services/bws-ai-coding-template/issues)
- 💬 [Discussions](https://github.com/blockchain-web-services/bws-ai-coding-template/discussions)
