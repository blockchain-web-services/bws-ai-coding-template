---
name: devops
description: Executes git commands (fetch, rebase, commit, merge, push) following worktree workflow, then monitors ALL resulting deployments with temporal boundaries and cascade detection. After git push, monitors all workflows from the last 5 minutes including cascading workflows (e.g., Test → Deploy chains). Automatically tracks multiple parallel workflows and waits for triggered workflows. Use /devops-check for comprehensive monitoring with automatic fixing. All deployments are triggered by git push, not manual AWS CLI commands.
---

# DevOps

Deployment operations with git workflow execution and automated deployment monitoring.

## AWS Profile Selection

**IMPORTANT:** AWS CLI commands must use the correct profile based on the target environment:

- **Staging deployments:** Use `--profile staging` when working with the `staging` branch
- **Production deployments:** Use `--profile prod` when working with the `prod` branch
- **Default:** If no branch/environment is specified, use `--profile staging`

**Examples:**
```bash
# Deploying to staging
git push origin staging
aws codepipeline get-pipeline-state --name devops-{{REPOSITORY_NAME}}-staging --profile staging --region us-east-1

# Deploying to production
git push origin prod
aws codepipeline get-pipeline-state --name devops-{{REPOSITORY_NAME}}-prod --profile prod --region us-east-1
```

## ⚠️ Pre-Flight Safety Checks

**CRITICAL:** Before ANY file modification operation, verify your workspace location to prevent accidentally modifying root repository files.

### Workspace Verification Commands

Run these commands before modifying files:

```bash
# Check if you're in a worktree
pwd | grep -q "\.trees/" && echo "✓ In worktree" || echo "⚠️ In root repository"

# Get current working directory
CURRENT_DIR=$(pwd)
echo "Working in: $CURRENT_DIR"

# If in worktree, extract branch name
if [[ "$CURRENT_DIR" =~ \.trees/([^/]+) ]]; then
    WORKTREE_BRANCH="${BASH_REMATCH[1]}"
    echo "Worktree branch: $WORKTREE_BRANCH"
fi
```

### Safety Rules

1. **If in a worktree (`.trees/*/`):**
   - ✅ **ONLY modify files within the worktree directory**
   - ✅ All file paths should be relative to the worktree root
   - ❌ **NEVER modify files in `../../` (root repository)**
   - ❌ **NEVER use absolute paths to root repository files**

2. **If in root repository:**
   - ⚠️ Be aware that changes affect ALL worktrees
   - ✅ Safe operations: creating worktrees, merging worktrees, configuration changes
   - ⚠️ Risky operations: modifying source code (should be done in worktrees)

3. **Before any Edit or Write tool usage:**
   - Verify the file path is within your current workspace
   - Confirm with user if you need to modify root repository files from a worktree

### Quick Verification

```bash
# Verify file is in current workspace
FILE_PATH="path/to/file"
[[ "$FILE_PATH" != *".."* ]] && echo "✓ Safe path" || echo "⚠️ Path escapes workspace"
```

**Rule:** If user asks to modify files and you're in a worktree, ALL file operations must stay within the worktree directory. If you need to modify root files, ask the user to confirm first.

## Table of Contents

- [Project Discovery](#project-discovery)
- [Git Workflow](#git-workflow-for-worktrees)
- [Deployment Monitoring](#deployment-monitoring)
- [CloudFormation Reference](reference/cloudformation.md)
- [GitHub Actions Reference](reference/github-actions.md)
- [CodePipeline Reference](reference/codepipeline.md)
- [Common Scenarios](reference/scenarios.md)
- [Troubleshooting](troubleshooting.md)

## Project Discovery

Before deployment operations, discover project resources:

**Find GitHub Actions workflows:**
```bash
find .github/workflows -name "*.yml" 2>/dev/null
gh workflow list --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}
```

**Find CloudFormation templates:**
```bash
find .deploy -name "*.yml" 2>/dev/null
```

**Check existing stacks:**
```bash
# List all active stacks (use --profile staging or --profile prod based on target environment)
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --profile staging --region us-east-1 \
  --query 'StackSummaries[*].[StackName,StackStatus]' \
  --output table
```

## Git Workflow for Worktrees

Complete workflow when asked to commit and deploy changes.

### Understanding Parent Branches

Each worktree is created from a **parent branch** (also called root branch). The parent branch is automatically detected and stored when the worktree is created.

**Common parent branches:**
- `staging` - For feature development and testing
- `prod` - For production hotfixes
- `main` or `master` - For general development

**How parent branch is determined:**
1. Automatically detected from current branch when worktree is created
2. Stored in `.trees/{BRANCH_NAME}/test/.worktree-info.json`
3. Also documented in `.trees/{BRANCH_NAME}/CLAUDE_INSTRUCTIONS.md`

**The merge script validates** that you're on the correct parent branch before merging. If you're on the wrong branch, it will show an error and tell you which branch to checkout.

### Step 1: Fetch and Rebase

```bash
cd .trees/{{BRANCH_NAME}}
git fetch origin
git rebase origin/{{PARENT_BRANCH}}
```

If conflicts occur:
```bash
git status  # See conflicted files
# Edit files (look for <<<<<<< HEAD, =======, >>>>>>> markers)
git add .
git rebase --continue
```

### Step 2: Commit Changes

```bash
git add .
git commit -m "feat: description of changes"
```

Use conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`

### Step 3: Merge to Parent Branch

**IMPORTANT:** You must be in the project root directory (not inside `.trees/`) when running the merge command.

```bash
cd ../..  # Return to project root (if inside worktree)
npm run worktree:merge {{BRANCH_NAME}} [--update] [--force] [--no-push]
```

**What the merge script does:**
1. **Validates parent branch** - Ensures you're on the correct branch before merging
2. **Uses `--no-ff`** - Preserves feature branch history in git log
3. **Excludes worktree-specific files** - Automatically skips:
   - `.env.worktree` - Unique worktree environment config
   - `docker-compose.worktree.yml` - Worktree-specific containers
   - `CLAUDE_INSTRUCTIONS.md` - Worktree context file
   - `.worktree-info.json` - Worktree metadata
4. **Preserves main branch files** - Keeps main branch version of:
   - `test/.env` - Main environment config
   - `test/package.json` - Main test dependencies
   - `.gitignore` - Worktree patterns
5. **Pushes automatically** - By default, pushes to origin after merge (unless `--no-push` is used)

**Script flags:**
- `--update` - Automatically rebase the worktree branch before merging (recommended)
- `--force` - Merge even if worktree branch is outdated (risky)
- `--no-push` - Skip automatic push to origin after merge

**Examples:**
```bash
# Recommended: Auto-rebase and merge
npm run worktree:merge feature-auth --update

# Merge without auto-push (manual push later)
npm run worktree:merge feature-auth --no-push

# Force merge outdated branch (not recommended)
npm run worktree:merge feature-auth --force
```

### Step 4: Push to Origin (Triggers Deployment)

**Note:** If you used the merge command WITHOUT `--no-push`, the push happens automatically and you can skip to Step 5 (Monitor Deployment).

If you used `--no-push`, manually push now:

```bash
git push origin staging  # Push to staging branch to deploy to staging environment
# OR
git push origin prod     # Push to prod branch to deploy to production environment
```

**IMPORTANT:** Pushing to `staging` or `prod` branches automatically triggers CI/CD pipelines and CloudFormation deployments. Proceed to deployment monitoring immediately.

### Step 5: Monitor Deployment

Immediately after push, monitor **ALL workflows** including cascading deployments.

**IMPORTANT MONITORING STRATEGY:**

**For comprehensive monitoring, use the `/devops-check` command:**
```bash
# This automatically monitors ALL workflows with temporal boundaries and cascade detection
/devops-check
```

The `/devops-check` command will:
- Monitor all workflows from the last 5 minutes (temporal boundary)
- Wait for cascading workflows (e.g., Test → Deploy chains)
- Track multiple parallel workflows (Test + Lint simultaneously)
- Automatically fix failures and re-monitor
- Iterate up to 5 times until all pipelines pass

**For manual monitoring** (if not using `/devops-check`):

**GitHub Actions - Monitor ALL recent workflows:**
```bash
# Define temporal boundary - last 5 minutes
MONITORING_START=$(date -u -d '5 minutes ago' '+%Y-%m-%dT%H:%M:%SZ')
CURRENT_BRANCH=$(git branch --show-current)

# Get all recent workflow runs
gh run list --branch $CURRENT_BRANCH --limit 50 \
  --json databaseId,status,conclusion,name,workflowName,createdAt \
  --jq "[.[] | select(.createdAt >= \"$MONITORING_START\")]"

# Monitor each workflow found
for RUN_ID in {extracted_run_ids}; do
    echo "Monitoring workflow run: $RUN_ID"
    gh run watch $RUN_ID
done

# After workflows complete, check for cascading workflows (wait 30-60 seconds)
sleep 30
gh run list --branch $CURRENT_BRANCH --limit 20 \
  --json databaseId,status,conclusion,name,workflowName,createdAt \
  --jq "[.[] | select(.createdAt >= \"$MONITORING_START\")]"
```

**Why monitor ALL workflows:**
- Multiple workflows may trigger in parallel (Test + Lint)
- Successful workflows may trigger additional workflows (Test → Deploy)
- Need to ensure entire deployment chain succeeds

**CloudFormation deployments:**
```bash
# First, discover stack names from the pipeline
# Use --profile staging for staging deployments, --profile prod for production
aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[*].actions[?actionTypeId.provider==`CloudFormation`].configuration.StackName' \
  --output table

# Then monitor stack events (use actual stack name and matching profile)
aws cloudformation describe-stack-events \
  --stack-name <actual-stack-name> \
  --query 'StackEvents[*].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId]' \
  --output table --profile staging --region us-east-1
```

See [GitHub Actions Reference](reference/github-actions.md) for detailed monitoring commands.

### Step 6: Clean Up Worktree

After successful deployment:
```bash
npm run worktree:remove {{BRANCH_NAME}}
```

## Deployment Monitoring

### After Git Push

**RECOMMENDED:** Use `/devops-check` command for comprehensive monitoring:
```bash
/devops-check
```

This handles all monitoring automatically including temporal boundaries, cascade detection, and automatic fixing.

### Manual Monitoring (Alternative)

**Monitor ALL GitHub Actions workflows** (not just the latest):

```bash
# Get current branch and define temporal boundary
CURRENT_BRANCH=$(git branch --show-current)
MONITORING_START=$(date -u -d '5 minutes ago' '+%Y-%m-%dT%H:%M:%SZ')

# List ALL recent runs within the monitoring window
gh run list --branch $CURRENT_BRANCH --limit 50 --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}} \
  --json databaseId,status,conclusion,name,workflowName,createdAt \
  --jq "[.[] | select(.createdAt >= \"$MONITORING_START\")]"

# Monitor each workflow (extract IDs from above)
for RUN_ID in {run_ids}; do
    gh run watch $RUN_ID --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}
done

# Check for cascading workflows after 30 seconds
sleep 30
gh run list --branch $CURRENT_BRANCH --limit 20 --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}} \
  --json databaseId,status,conclusion,name,workflowName,createdAt
```

**Key principles:**
- **Temporal boundary**: Monitor workflows from last 5 minutes, not just "latest"
- **Multiple workflows**: A push can trigger multiple parallel workflows
- **Cascade detection**: Successful workflows may trigger additional workflows
- **Wait and recheck**: After workflows complete, wait 30s and check for new ones

**If workflow deploys CloudFormation:** Monitor stack events
```bash
# First, get stack name from pipeline (use matching profile for target environment)
# For staging: --profile staging, for prod: --profile prod
STACK_NAME=$(aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[0].actions[?actionTypeId.provider==`CloudFormation`].configuration.StackName' \
  --output text | head -1)

# Then watch deployment progress (use same profile)
watch -n 5 "aws cloudformation describe-stack-events \
  --stack-name $STACK_NAME \
  --max-items 10 --query 'StackEvents[*].[Timestamp,ResourceStatus,LogicalResourceId]' \
  --output table --profile staging --region us-east-1"
```

**Check for failures:**
```bash
# Failed GitHub Actions
gh run list --status=failure --limit 1

# Failed CloudFormation resources (discover stack name from pipeline first)
# Use --profile staging or --profile prod based on target environment
STACK_NAME=$(aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[0].actions[?actionTypeId.provider==`CloudFormation`].configuration.StackName' \
  --output text | head -1)

aws cloudformation describe-stack-events \
  --stack-name $STACK_NAME \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED' || ResourceStatus=='UPDATE_FAILED']" \
  --profile staging --region us-east-1
```

See [Troubleshooting](troubleshooting.md) for common deployment issues.

## GitHub Actions Workflows

### Monitor Workflow Execution

```bash
# Watch in real-time
gh run watch --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}

# View specific run logs
gh run view <run-id> --log --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}
```

### Re-run Failed Workflow

```bash
gh run rerun <run-id> --failed --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}
```

For detailed GitHub Actions commands, see [GitHub Actions Reference](reference/github-actions.md).

## AWS CodePipeline

**Pipeline naming:** `devops-{{REPOSITORY_NAME}}-staging` or `devops-{{REPOSITORY_NAME}}-prod`

### Check Pipeline Status

```bash
# Staging pipeline
aws codepipeline get-pipeline-state \
  --name devops-{{REPOSITORY_NAME}}-staging --profile staging --region us-east-1

# Production pipeline
aws codepipeline get-pipeline-state \
  --name devops-{{REPOSITORY_NAME}}-prod --profile prod --region us-east-1
```

### List Recent Executions

```bash
# Staging pipeline executions
aws codepipeline list-pipeline-executions \
  --pipeline-name devops-{{REPOSITORY_NAME}}-staging --max-items 5 --profile staging --region us-east-1

# Production pipeline executions
aws codepipeline list-pipeline-executions \
  --pipeline-name devops-{{REPOSITORY_NAME}}-prod --max-items 5 --profile prod --region us-east-1
```

For detailed CodePipeline commands, see [CodePipeline Reference](reference/codepipeline.md).

## Deployment Workflow Checklist

When asked to deploy:

1. **Discover Resources**
   - [ ] Find CloudFormation templates: `find .deploy -name "*.yml"`
   - [ ] Find GitHub workflows: `find .github/workflows -name "*.yml"`
   - [ ] Check existing stacks: `aws cloudformation list-stacks`

2. **Execute Git Workflow**
   - [ ] Fetch and rebase: `git fetch origin && git rebase origin/{{ROOT_BRANCH}}`
   - [ ] Commit changes: `git commit -m "feat: description"`
   - [ ] Merge with --no-ff: `npm run worktree:merge <branch>`
   - [ ] Push to staging or prod: `git push origin staging` (triggers deployment)

3. **Monitor Deployment**
   - [ ] **Recommended:** Use `/devops-check` for comprehensive monitoring
   - [ ] Or manually: Monitor ALL workflows with temporal boundaries (last 5 mins)
   - [ ] Check for cascading workflows (Test → Deploy chains)
   - [ ] Monitor CloudFormation events (if applicable)
   - [ ] Verify all workflows in chain succeed

4. **Handle Failures**
   - [ ] Check failed runs: `gh run list --status=failure`
   - [ ] View CloudFormation failures
   - [ ] See [Troubleshooting](troubleshooting.md) for solutions

## Safety Rules

- **NEVER** use `git push --force` on main/staging/prod branches
- **ALWAYS** use `--no-ff` merge to preserve feature branch history
- **ALWAYS** fetch and rebase before committing
- **ALWAYS** monitor deployment logs after pushing to staging or prod
- **Deployments are automatic:** Pushing to staging or prod branches triggers CI/CD pipelines
- **No manual deployments:** Never use `aws cloudformation deploy` - all deployments happen via git push

## Common Deployment Scenarios

### Scenario 1: Code Change → Deployment

```bash
# 1. Make changes in worktree
cd .trees/feature-name

# 2. Commit and merge to parent branch
git fetch origin && git rebase origin/{{ROOT_BRANCH}}
git add . && git commit -m "feat: implement feature"
cd ../.. && npm run worktree:merge feature-name

# 3. Push to staging (triggers deployment)
git push origin staging

# 4. Monitor ALL workflows with cascade detection
/devops-check

# This will:
# - Monitor all workflows from last 5 minutes
# - Wait for cascading workflows (e.g., Test → Deploy)
# - Track multiple parallel workflows
# - Automatically fix failures and re-monitor
# - Iterate until all pipelines pass
```

### Scenario 2: Investigate Failed Deployment

```bash
# 1. Find failed workflow
gh run list --status=failure --limit 1

# 2. View logs
gh run view <run-id> --log | grep -i "error"

# 3. Check CloudFormation failures
aws cloudformation describe-stack-events \
  --stack-name myapp-infra-staging \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED']" \
  --profile staging --region us-east-1
```

For more scenarios, see [Common Scenarios](reference/scenarios.md).

## Quick Reference

### Git Commands
- Fetch: `git fetch origin`
- Rebase: `git rebase origin/{{ROOT_BRANCH}}`
- Commit: `git commit -m "type: description"`
- Merge: `npm run worktree:merge <branch>`
- Push: `git push origin staging` or `git push origin prod` (triggers deployment)

### Deployment Monitoring
- GitHub Actions: `gh run watch`
- CodePipeline: `aws codepipeline get-pipeline-state --name devops-{{REPOSITORY_NAME}}-staging --profile staging --region us-east-1`
- CloudFormation: Discover stack names from pipeline first (see CloudFormation Reference)

### Troubleshooting
- Failed runs: `gh run list --status=failure`
- Failed pipeline: `aws codepipeline get-pipeline-state --name devops-{{REPOSITORY_NAME}}-staging --profile staging`
- Failed stacks: Discover stack name from pipeline, then check events (see CloudFormation Reference)
- See [Troubleshooting](troubleshooting.md) for solutions

## Related Documentation

- [CloudFormation Reference](reference/cloudformation.md) - Detailed CloudFormation commands
- [GitHub Actions Reference](reference/github-actions.md) - Complete GitHub Actions guide
- [CodePipeline Reference](reference/codepipeline.md) - AWS CodePipeline operations
- [Common Scenarios](reference/scenarios.md) - Real-world deployment examples
- [Troubleshooting](troubleshooting.md) - Common issues and solutions

Project documentation:
- `docs/worktrees/GIT_WORKFLOW.md` - Git workflow guide
- `docs/worktrees/AWS_INFRASTRUCTURE.md` - Infrastructure architecture
- `.deploy/IaC/` - CloudFormation templates
- `.github/workflows/` - GitHub Actions workflows
