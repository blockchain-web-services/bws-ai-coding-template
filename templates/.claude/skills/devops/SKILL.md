---
name: devops
description: Executes git commands (fetch, rebase, commit, merge, push) following worktree workflow, then monitors resulting deployments. After git push, automatically checks GitHub Actions workflows and CloudFormation deployment logs. Deploys and troubleshoots AWS infrastructure stacks. Use when performing git operations, pushing code, merging worktrees, deploying infrastructure, or checking deployment status.
---

# DevOps

Deployment operations with git workflow execution and automated deployment monitoring.

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
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query "StackSummaries[?contains(StackName, '{{PROJECT_NAME}}')]" --region us-east-1
```

## Git Workflow for Worktrees

Complete workflow when asked to commit and deploy changes.

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

```bash
cd ../..  # Return to project root
npm run worktree:merge {{BRANCH_NAME}}
```

This automatically uses `--no-ff` to preserve feature branch history.

### Step 4: Push to Origin (Triggers Deployment)

```bash
git push origin {{PARENT_BRANCH}}
```

**IMPORTANT:** This push triggers CI/CD pipelines. Proceed to deployment monitoring.

### Step 5: Monitor Deployment

Immediately after push, monitor deployments:

```bash
# Watch GitHub Actions
gh run watch --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}

# View deployment logs
gh run view <run-id> --log
```

For CloudFormation deployments triggered by pipeline:
```bash
# Monitor stack events
aws cloudformation describe-stack-events \
  --stack-name {{PROJECT_NAME}}-infra-staging \
  --query 'StackEvents[*].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId]' \
  --output table --region us-east-1
```

See [GitHub Actions Reference](reference/github-actions.md) for detailed monitoring commands.

### Step 6: Clean Up Worktree

After successful deployment:
```bash
npm run worktree:remove {{BRANCH_NAME}}
```

## Deployment Monitoring

### After Git Push

**Primary action:** Check GitHub Actions workflows
```bash
# List recent runs
gh run list --limit 5 --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}

# Watch latest run
gh run watch --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}
```

**If workflow deploys CloudFormation:** Monitor stack events
```bash
# Watch deployment progress
watch -n 5 "aws cloudformation describe-stack-events \
  --stack-name {{PROJECT_NAME}}-infra-staging \
  --max-items 10 --query 'StackEvents[*].[Timestamp,ResourceStatus,LogicalResourceId]' \
  --output table"
```

**Check for failures:**
```bash
# Failed GitHub Actions
gh run list --status=failure --limit 1

# Failed CloudFormation resources
aws cloudformation describe-stack-events \
  --stack-name {{PROJECT_NAME}}-infra-staging \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED' || ResourceStatus=='UPDATE_FAILED']"
```

See [Troubleshooting](troubleshooting.md) for common deployment issues.

## CloudFormation Deployments

### Deploy Database Stack

```bash
aws cloudformation deploy \
  --template-file .deploy/IaC/db/db.yml \
  --stack-name {{PROJECT_NAME}}-db-staging \
  --parameter-overrides file://.deploy/IaC/db/configs/db-staging.json \
  --capabilities CAPABILITY_IAM --region us-east-1
```

### Deploy Infrastructure Stack

```bash
aws cloudformation deploy \
  --template-file .deploy/IaC/infra/infra.yml \
  --stack-name {{PROJECT_NAME}}-infra-staging \
  --parameter-overrides file://.deploy/IaC/infra/configs/infra-staging.json \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --region us-east-1
```

### Monitor Deployment

```bash
# Watch for completion
aws cloudformation wait stack-create-complete \
  --stack-name {{PROJECT_NAME}}-infra-staging --region us-east-1

# Check stack outputs
aws cloudformation describe-stacks \
  --stack-name {{PROJECT_NAME}}-infra-staging \
  --query 'Stacks[0].Outputs' --output table --region us-east-1
```

For detailed CloudFormation commands, see [CloudFormation Reference](reference/cloudformation.md).

## GitHub Actions Workflows

### Trigger Manual Workflow

```bash
gh workflow run deploy-staging.yml --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}
```

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

### Check Pipeline Status

```bash
aws codepipeline get-pipeline-state \
  --name {{PROJECT_NAME}}-pipeline --region us-east-1
```

### List Recent Executions

```bash
aws codepipeline list-pipeline-executions \
  --pipeline-name {{PROJECT_NAME}}-pipeline --max-items 5 --region us-east-1
```

For detailed CodePipeline commands, see [CodePipeline Reference](reference/codepipeline.md).

## Deployment Workflow Checklist

When asked to deploy:

1. **Discover Resources**
   - [ ] Find CloudFormation templates: `find .deploy -name "*.yml"`
   - [ ] Find GitHub workflows: `find .github/workflows -name "*.yml"`
   - [ ] Check existing stacks: `aws cloudformation list-stacks`

2. **Execute Git Workflow**
   - [ ] Fetch and rebase: `git fetch origin && git rebase origin/main`
   - [ ] Commit changes: `git commit -m "feat: description"`
   - [ ] Merge with --no-ff: `npm run worktree:merge <branch>`
   - [ ] Push to origin: `git push origin main` (triggers deployment)

3. **Monitor Deployment**
   - [ ] Watch GitHub Actions: `gh run watch`
   - [ ] Check workflow logs: `gh run view <run-id> --log`
   - [ ] Monitor CloudFormation events (if applicable)
   - [ ] Verify stack outputs

4. **Handle Failures**
   - [ ] Check failed runs: `gh run list --status=failure`
   - [ ] View CloudFormation failures
   - [ ] See [Troubleshooting](troubleshooting.md) for solutions

## Safety Rules

- **NEVER** use `git push --force` on main/staging/production branches
- **ALWAYS** use `--no-ff` merge to preserve feature branch history
- **ALWAYS** fetch and rebase before committing
- **ALWAYS** monitor deployment logs after pushing
- **NEVER** skip CloudFormation validation
- **NEVER** deploy without checking existing stack status

## Common Deployment Scenarios

### Scenario 1: Code Change → Deployment

```bash
# 1. Make changes in worktree
cd .trees/feature-name

# 2. Commit and merge
git fetch origin && git rebase origin/main
git add . && git commit -m "feat: implement feature"
cd ../.. && npm run worktree:merge feature-name

# 3. Push (triggers deployment)
git push origin main

# 4. Monitor
gh run watch
```

### Scenario 2: Infrastructure Update

```bash
# 1. Find templates
find .deploy/IaC -name "*.yml"

# 2. Validate
aws cloudformation validate-template --template-body file://.deploy/IaC/infra/infra.yml

# 3. Deploy
aws cloudformation deploy \
  --template-file .deploy/IaC/infra/infra.yml \
  --stack-name myapp-infra-staging \
  --parameter-overrides file://.deploy/IaC/infra/configs/infra-staging.json

# 4. Monitor
watch -n 5 "aws cloudformation describe-stack-events --stack-name myapp-infra-staging --max-items 10"
```

### Scenario 3: Investigate Failed Deployment

```bash
# 1. Find failed workflow
gh run list --status=failure --limit 1

# 2. View logs
gh run view <run-id> --log | grep -i "error"

# 3. Check CloudFormation failures
aws cloudformation describe-stack-events \
  --stack-name myapp-infra-staging \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED']"
```

For more scenarios, see [Common Scenarios](reference/scenarios.md).

## Quick Reference

### Git Commands
- Fetch: `git fetch origin`
- Rebase: `git rebase origin/main`
- Commit: `git commit -m "type: description"`
- Merge: `npm run worktree:merge <branch>`
- Push: `git push origin main`

### Deployment Monitoring
- GitHub Actions: `gh run watch`
- CloudFormation: `aws cloudformation describe-stack-events --stack-name <name>`
- CodePipeline: `aws codepipeline get-pipeline-state --name <name>`

### Troubleshooting
- Failed runs: `gh run list --status=failure`
- Failed stacks: `aws cloudformation describe-stack-events --query "StackEvents[?ResourceStatus=='CREATE_FAILED']"`
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
