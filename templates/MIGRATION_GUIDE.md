# Migration Guide

This guide explains how to add the worktree and parallel testing infrastructure to an **existing** project.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Automatic Migration](#automatic-migration-recommended)
3. [Manual Migration](#manual-migration)
4. [Post-Migration Setup](#post-migration-setup)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

Before migrating, ensure your project has:

- **Git repository** initialized (`git init`)
- **Node.js** 20.x or later
- **npm** 9.x or later
- **Docker** installed (for parallel testing)

## Automatic Migration (Recommended)

The migration script will interactively guide you through the setup:

```bash
# From your project root
node migrate-to-template.mjs
```

The script will:

1. **Ask for project details**:
   - Project name
   - Repository owner
   - Description
   - Whether to include AWS infrastructure

2. **Copy necessary files**:
   - Worktree management scripts (`scripts/worktree/`)
   - Testing infrastructure (`test/` directory)
   - AWS CloudFormation templates (`.deploy/` - optional)
   - Documentation (`docs/`)

3. **Update configurations**:
   - Add npm scripts to `package.json`
   - Create/update `.gitignore`
   - Append worktree rules to `CLAUDE.md` (if exists)

4. **Validate setup**:
   - Check Git repository
   - Verify Docker installation
   - Test worktree creation

## Manual Migration

If you prefer manual migration or need to customize the setup:

### Step 1: Copy Worktree Scripts

```bash
# Create scripts directory
mkdir -p scripts

# Copy worktree management scripts
cp -r <template-path>/scripts/worktree scripts/
```

### Step 2: Update package.json

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "worktree:create": "node scripts/worktree/create-worktree.mjs",
    "worktree:list": "node scripts/worktree/list-worktrees.mjs",
    "worktree:merge": "node scripts/worktree/merge-worktree.mjs",
    "worktree:remove": "node scripts/worktree/remove-worktree.mjs"
  }
}
```

### Step 3: Copy Testing Infrastructure (Optional)

If you want parallel testing with LocalStack:

```bash
# Copy test infrastructure
cp -r <template-path>/test ./

# Update test/package.json with your project name
# Update test/.env with your settings
```

### Step 4: Copy AWS Infrastructure (Optional)

If you need AWS CloudFormation templates:

```bash
# Copy .deploy folder
cp -r <template-path>/.deploy ./

# Copy devops.yml
cp <template-path>/devops.yml ./

# Update with your project-specific resources
```

### Step 5: Update .gitignore

Add these patterns to your `.gitignore`:

```gitignore
# Worktree-specific files
.env.worktree
.worktree-info.json
docker-compose.worktree.yml
WORKTREE_CONTEXT.md

test/.env.worktree
test/.worktree-info.json
test/docker-compose.worktree.yml

*/.env.worktree
*/.worktree-info.json
*/docker-compose.worktree.yml
*/WORKTREE_CONTEXT.md
.trees/*/WORKTREE_CONTEXT.md

# Test artifacts
localstack-data/
localstack-data-*/
playwright-report/
test/.temp/
```

### Step 6: Copy Documentation

```bash
# Create docs directory
mkdir -p docs

# Copy documentation
cp <template-path>/docs/*.md docs/
```

### Step 7: Update CLAUDE.md (Optional)

If you use Claude Code, append the Git workflow rules:

```bash
cat <template-path>/docs/CLAUDE_INSTRUCTIONS.md >> CLAUDE.md
```

## Post-Migration Setup

After migration (automatic or manual), complete these steps:

### 1. Install Dependencies

```bash
# Root project
npm install

# Test infrastructure (if included)
cd test
npm install
cd ..
```

### 2. Customize AWS Templates (if included)

Edit `.deploy/IaC/db/db.yml` to add your DynamoDB tables:

```yaml
Resources:
  YourTableName:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub "${RepositoryBranchName}-YOUR_TABLE_NAME"
      # ... table configuration
```

Edit `.deploy/IaC/infra/infra.yml` to add your Lambda functions:

```yaml
Resources:
  YourFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub "${RepositoryBranchName}-your-function"
      # ... function configuration
```

### 3. Configure Environment Variables

Create `test/.env` (if using parallel testing):

```bash
# Copy template
cp test/.env.example test/.env

# Update with your settings
# ENVIRONMENT, PROJECT_NAME, etc.
```

### 4. Test Worktree Creation

```bash
# Create a test worktree
npm run worktree:create test-feature

# Verify it was created
npm run worktree:list

# Remove test worktree
npm run worktree:remove test-feature
```

## Verification

Verify your migration was successful:

### 1. Check Worktree Scripts

```bash
# Should list available worktree commands
npm run worktree:list
```

### 2. Test Parallel Testing (if included)

```bash
cd test

# Start LocalStack
npm run docker:up

# Create AWS resources
npm run setup

# Run tests
npm test

# Cleanup
npm run docker:clean
```

### 3. Create a Real Worktree

```bash
# Create worktree for actual feature
npm run worktree:create my-feature

# Navigate to worktree
cd .trees/my-feature

# Verify isolation (should have unique ports)
cat test/.env.worktree
```

## Troubleshooting

### Issue: "Permission denied" when running scripts

**Solution**: Make scripts executable:
```bash
chmod +x scripts/worktree/*.mjs
```

### Issue: "Docker not found"

**Solution**: Install Docker:
- **macOS**: Install Docker Desktop
- **Ubuntu**: `sudo apt install docker.io`
- **Windows**: Install Docker Desktop with WSL2

### Issue: Port conflicts when creating worktrees

**Solution**: The system uses hash-based port allocation, but if you have conflicts:
1. Check running Docker containers: `docker ps`
2. Stop conflicting containers
3. Or edit `test/helpers/worktree/config-generator.mjs` to use different port ranges

### Issue: "Git worktree not supported"

**Solution**: Update Git to version 2.5 or later:
```bash
git --version  # Check current version
# Install newer version from official Git website
```

### Issue: Cannot find module errors

**Solution**: Install dependencies:
```bash
npm install          # Root project
cd test && npm install  # Test infrastructure
```

### Issue: AWS resources not created in LocalStack

**Solution**: Verify LocalStack is running:
```bash
docker ps | grep localstack
# Should show running container

# Check LocalStack health
curl http://localhost:4566/_localstack/health
```

## Next Steps

After successful migration:

1. **Read the documentation**:
   - [Worktree Management Guide](docs/WORKTREES.md)
   - [Git Workflow Rules](docs/GIT_WORKFLOW.md)
   - [Parallel Testing Setup](docs/PARALLEL_TESTING.md)

2. **Create your first worktree**:
   ```bash
   npm run worktree:create my-first-feature
   ```

3. **Set up CI/CD** (if using AWS):
   - Deploy `devops.yml` stack to AWS
   - Configure GitHub webhook
   - Test deployment pipeline

4. **Configure your team**:
   - Share documentation with team members
   - Establish branching strategy
   - Set up Claude Code (if using AI assistance)

## Rollback

If you need to remove the migration:

```bash
# Remove worktree scripts
rm -rf scripts/worktree

# Remove test infrastructure
rm -rf test

# Remove AWS templates
rm -rf .deploy
rm devops.yml

# Remove documentation
rm -rf docs

# Manually remove npm scripts from package.json
# Manually remove patterns from .gitignore
```

## Support

For issues or questions:
- Check [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
- Review [Documentation](docs/)
- Open an issue on GitHub
