---
name: devops
description: Deploy and monitor AWS CloudFormation stacks, GitHub Actions workflows, and CI/CD pipelines. Use when deploying infrastructure, checking deployment logs, investigating deployment failures, pushing code changes, merging worktrees, or managing AWS resources. Discovers project configuration (templates, workflows, stacks) before operations.
---

Specialized deployment operations with intelligent project discovery and log monitoring.

## Phase 1: Project Discovery

Before any deployment operation, discover what resources exist in the project.

### Discover GitHub Actions Workflows

**Find all workflow files:**
```bash
find .github/workflows -name "*.yml" -o -name "*.yaml" 2>/dev/null
```

**Inspect workflow triggers and jobs:**
```bash
# List workflows in repository
gh workflow list --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}

# View workflow details
gh workflow view <workflow-name> --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}
```

**Example Output Analysis:**
- Workflow: `ci.yml` - Runs on: push to main
- Workflow: `deploy-staging.yml` - Runs on: push to staging
- Workflow: `deploy-prod.yml` - Runs on: manual dispatch

### Discover CloudFormation Templates

**Find all CloudFormation templates:**
```bash
find .deploy -name "*.yml" -o -name "*.yaml" 2>/dev/null
```

**Expected structure:**
- `.deploy/IaC/db/db.yml` - Database stack
- `.deploy/IaC/infra/infra.yml` - Infrastructure stack
- `.deploy/IaC/infra/.build/pre-infra.yml` - Pre-deployment hooks
- `.deploy/IaC/infra/.build/post-infra.yml` - Post-deployment hooks

**Inspect template resources:**
```bash
# Validate template syntax
aws cloudformation validate-template \
  --template-body file://.deploy/IaC/db/db.yml

# List all resources defined in template
aws cloudformation get-template-summary \
  --template-body file://.deploy/IaC/db/db.yml
```

### Discover Existing CloudFormation Stacks

**Check what's already deployed:**
```bash
# List all stacks for this project
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query "StackSummaries[?contains(StackName, '{{PROJECT_NAME}}')]" \
  --region us-east-1

# Get detailed stack information
aws cloudformation describe-stacks \
  --stack-name {{PROJECT_NAME}}-db-staging \
  --region us-east-1
```

### Discover Pipeline Configuration

**Find pipeline config files:**
```bash
# Look for devops.yml (AWS CodePipeline definition)
ls -la devops.yml 2>/dev/null

# Check for other CI/CD configs
find . -name "devops.yml" -o -name ".gitlab-ci.yml" -o -name "azure-pipelines.yml"
```

## Phase 2: Git Deployment Workflow

### CRITICAL RULE: Rebase Before Merging to Deployment Branches

When preparing to deploy/merge changes:

**Step 1: Fetch latest changes**
```bash
cd /path/to/root/project
git fetch origin
```

**Step 2: Switch to worktree and rebase**
```bash
cd .trees/{{BRANCH_NAME}}
git rebase origin/{{PARENT_BRANCH}}
```

**Step 3: Resolve conflicts if any**
```bash
# If conflicts occur:
git status  # See conflicted files
# Edit files to resolve conflicts
git add .
git rebase --continue
```

**Step 4: Return to root and merge**
```bash
cd ../..  # Back to root
git checkout {{PARENT_BRANCH}}
git merge --no-ff {{BRANCH_NAME}} -m "Merge {{BRANCH_NAME}} into {{PARENT_BRANCH}}"
```

**Step 5: Push to origin (triggers CI/CD)**
```bash
git push origin {{PARENT_BRANCH}}

# This push will trigger GitHub Actions workflows
# Monitor with: gh run watch
```

### Branch Protection Rules

- **NEVER** use `git push --force` on main/staging/production
- **ALWAYS** use `--no-ff` merge to preserve history
- **ALWAYS** fetch and rebase before merge
- Tag releases: `git tag -a v1.2.3 -m "Release 1.2.3"`

## Phase 3: CloudFormation Deployment Workflow

### Step 1: Discover Templates (if not already done)

```bash
# List all templates
find .deploy/IaC -type f \( -name "*.yml" -o -name "*.yaml" \)
```

### Step 2: Validate Templates Before Deployment

```bash
# Validate each template
aws cloudformation validate-template \
  --template-body file://.deploy/IaC/db/db.yml

aws cloudformation validate-template \
  --template-body file://.deploy/IaC/infra/infra.yml
```

### Step 3: Deploy Database Stack

```bash
# Deploy to staging
aws cloudformation deploy \
  --template-file .deploy/IaC/db/db.yml \
  --stack-name {{PROJECT_NAME}}-db-staging \
  --parameter-overrides file://.deploy/IaC/db/configs/db-staging.json \
  --capabilities CAPABILITY_IAM \
  --region us-east-1

# Deploy to production
aws cloudformation deploy \
  --template-file .deploy/IaC/db/db.yml \
  --stack-name {{PROJECT_NAME}}-db-prod \
  --parameter-overrides file://.deploy/IaC/db/configs/db-prod.json \
  --capabilities CAPABILITY_IAM \
  --region us-east-1
```

### Step 4: Monitor Deployment Progress

**Watch stack events in real-time:**
```bash
# Continuously monitor stack events
aws cloudformation describe-stack-events \
  --stack-name {{PROJECT_NAME}}-db-staging \
  --region us-east-1 \
  --max-items 20

# Watch for completion (blocks until complete/failed)
aws cloudformation wait stack-create-complete \
  --stack-name {{PROJECT_NAME}}-db-staging \
  --region us-east-1
```

**Check deployment logs:**
```bash
# Get detailed event log with timestamps
aws cloudformation describe-stack-events \
  --stack-name {{PROJECT_NAME}}-db-staging \
  --query 'StackEvents[*].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId,ResourceStatusReason]' \
  --output table \
  --region us-east-1
```

### Step 5: Deploy Infrastructure Stack

```bash
aws cloudformation deploy \
  --template-file .deploy/IaC/infra/infra.yml \
  --stack-name {{PROJECT_NAME}}-infra-staging \
  --parameter-overrides file://.deploy/IaC/infra/configs/infra-staging.json \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region us-east-1
```

### Step 6: Monitor Infrastructure Deployment Logs

```bash
# Watch deployment progress
aws cloudformation describe-stack-events \
  --stack-name {{PROJECT_NAME}}-infra-staging \
  --query 'StackEvents[*].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId,ResourceStatusReason]' \
  --output table \
  --region us-east-1

# Check for failures
aws cloudformation describe-stack-events \
  --stack-name {{PROJECT_NAME}}-infra-staging \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED' || ResourceStatus=='UPDATE_FAILED']" \
  --region us-east-1
```

### Step 7: Verify Stack Outputs

```bash
# Get stack outputs (API endpoints, resource ARNs, etc.)
aws cloudformation describe-stacks \
  --stack-name {{PROJECT_NAME}}-infra-staging \
  --query 'Stacks[0].Outputs' \
  --output table \
  --region us-east-1
```

### Step 8: Check CloudFormation Drift

```bash
# Detect drift (changes made outside CloudFormation)
aws cloudformation detect-stack-drift \
  --stack-name {{PROJECT_NAME}}-infra-staging \
  --region us-east-1

# View drift results
aws cloudformation describe-stack-drift-detection-status \
  --stack-drift-detection-id <detection-id> \
  --region us-east-1
```

## Phase 4: GitHub Actions Deployment Workflow

### Step 1: Discover Active Workflows (if not already done)

```bash
# List all workflows
gh workflow list --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}
```

### Step 2: Trigger Deployment Workflow

**If workflow runs on push:**
```bash
# Already triggered by git push in Phase 2
# Just monitor the run
```

**If workflow requires manual trigger:**
```bash
gh workflow run deploy-staging.yml --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}
```

### Step 3: Monitor Workflow Execution

**Watch workflow in real-time:**
```bash
# Watch latest run
gh run watch --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}

# List recent runs
gh run list --workflow=deploy-staging.yml --limit 5 --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}
```

### Step 4: Check Workflow Logs

**View logs for specific run:**
```bash
# Get run ID from list
gh run list --workflow=deploy-staging.yml --limit 1 --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}

# View full logs
gh run view <run-id> --log --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}

# View logs for specific job
gh run view <run-id> --log --job <job-id> --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}
```

**Check for failures:**
```bash
# View only failed runs
gh run list --workflow=deploy-staging.yml --status=failure --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}

# View failed run details
gh run view <failed-run-id> --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}
```

### Step 5: Analyze Deployment Job Logs

When checking logs, look for:
- CloudFormation deployment commands
- AWS CLI output
- Error messages
- Stack creation/update status
- Resource creation failures

**Example log analysis:**
```bash
# View logs and grep for errors
gh run view <run-id> --log --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}} | grep -i "error\|failed\|exception"

# Check CloudFormation-specific logs
gh run view <run-id> --log --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}} | grep "cloudformation"
```

## Phase 5: AWS CodePipeline Workflow

### Step 1: Discover Pipeline

```bash
# List all pipelines
aws codepipeline list-pipelines --region us-east-1

# Get pipeline details
aws codepipeline get-pipeline \
  --name {{PROJECT_NAME}}-pipeline \
  --region us-east-1
```

### Step 2: Monitor Pipeline Execution

**Check current pipeline state:**
```bash
aws codepipeline get-pipeline-state \
  --name {{PROJECT_NAME}}-pipeline \
  --region us-east-1
```

**List recent executions:**
```bash
aws codepipeline list-pipeline-executions \
  --pipeline-name {{PROJECT_NAME}}-pipeline \
  --max-items 10 \
  --region us-east-1
```

### Step 3: Check Stage-Specific Logs

**Get execution details:**
```bash
aws codepipeline get-pipeline-execution \
  --pipeline-name {{PROJECT_NAME}}-pipeline \
  --pipeline-execution-id <execution-id> \
  --region us-east-1
```

**Check action details (CloudFormation deploy action):**
```bash
# Find CloudFormation action execution
aws codepipeline list-action-executions \
  --pipeline-name {{PROJECT_NAME}}-pipeline \
  --filter pipelineExecutionId=<execution-id> \
  --region us-east-1
```

### Step 4: View CloudFormation Logs from Pipeline

When pipeline uses CloudFormation actions, check stack events:

```bash
# Pipeline typically creates stacks with predictable names
# Check stack events during pipeline execution
aws cloudformation describe-stack-events \
  --stack-name {{PROJECT_NAME}}-db-staging \
  --max-items 50 \
  --region us-east-1
```

## Deployment Workflow Checklist

When asked to deploy:

1. **Discovery Phase:**
   - [ ] Find all CloudFormation templates: `find .deploy -name "*.yml"`
   - [ ] Find all GitHub workflows: `find .github/workflows -name "*.yml"`
   - [ ] Check existing stacks: `aws cloudformation list-stacks`
   - [ ] List pipelines: `aws codepipeline list-pipelines`

2. **Pre-Deployment:**
   - [ ] Validate CloudFormation templates
   - [ ] Verify git branch is correct
   - [ ] Check AWS credentials and region
   - [ ] Review parameter files

3. **Deployment:**
   - [ ] Deploy stacks in order (database first, then infrastructure)
   - [ ] Monitor CloudFormation events in real-time
   - [ ] Watch GitHub Actions workflow execution
   - [ ] Check CodePipeline progress

4. **Log Monitoring:**
   - [ ] Check CloudFormation stack events for errors
   - [ ] Review GitHub Actions job logs
   - [ ] Monitor CodePipeline stage status
   - [ ] Grep logs for failures: `grep -i "error\|failed"`

5. **Post-Deployment:**
   - [ ] Verify stack outputs
   - [ ] Check resource health
   - [ ] Test deployed endpoints
   - [ ] Document any issues

## Common Deployment Scenarios

### Scenario 1: Deploy After Git Push

```bash
# 1. Merge to staging branch (triggers workflows)
git push origin staging

# 2. Watch GitHub Actions
gh run watch --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}

# 3. Check workflow logs
gh run view <run-id> --log

# 4. If workflow deploys CloudFormation, check stack events
aws cloudformation describe-stack-events \
  --stack-name {{PROJECT_NAME}}-infra-staging \
  --max-items 20
```

### Scenario 2: Manual CloudFormation Deployment

```bash
# 1. Find templates
find .deploy/IaC -name "*.yml"

# 2. Validate
aws cloudformation validate-template --template-body file://.deploy/IaC/db/db.yml

# 3. Deploy
aws cloudformation deploy \
  --template-file .deploy/IaC/db/db.yml \
  --stack-name {{PROJECT_NAME}}-db-staging \
  --parameter-overrides file://.deploy/IaC/db/configs/db-staging.json

# 4. Monitor logs in real-time
watch -n 2 "aws cloudformation describe-stack-events \
  --stack-name {{PROJECT_NAME}}-db-staging \
  --max-items 10 \
  --query 'StackEvents[*].[Timestamp,ResourceStatus,LogicalResourceId]' \
  --output table"
```

### Scenario 3: Investigate Failed Deployment

```bash
# 1. Find failed GitHub workflow
gh run list --status=failure --limit 1

# 2. View failure logs
gh run view <run-id> --log | grep -i "error"

# 3. Check CloudFormation failures
aws cloudformation describe-stack-events \
  --stack-name {{PROJECT_NAME}}-infra-staging \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED' || ResourceStatus=='UPDATE_FAILED']"

# 4. Get detailed failure reason
aws cloudformation describe-stack-events \
  --stack-name {{PROJECT_NAME}}-infra-staging \
  --query "StackEvents[0].ResourceStatusReason"
```

## Troubleshooting Guide

### CloudFormation Deployment Fails

1. **Check stack events:** `aws cloudformation describe-stack-events --stack-name <name>`
2. **Look for failed resources:** Filter by `CREATE_FAILED` or `UPDATE_FAILED`
3. **Read failure reason:** Check `ResourceStatusReason` field
4. **Common causes:**
   - IAM permission issues
   - Resource limits exceeded
   - Invalid parameters
   - Resource naming conflicts

### GitHub Actions Workflow Fails

1. **View workflow run:** `gh run view <run-id>`
2. **Check logs:** `gh run view <run-id> --log`
3. **Look for errors:** Grep for "error", "failed", "exception"
4. **Common causes:**
   - Missing secrets/environment variables
   - AWS credential issues
   - CloudFormation template errors
   - Timeout issues

### Pipeline Stuck

1. **Check pipeline state:** `aws codepipeline get-pipeline-state`
2. **Look for manual approval:** Check if approval action is waiting
3. **Review stage details:** Check which stage is stuck
4. **Check logs:** Review CloudFormation/CodeBuild logs for stuck stage

## Safety Rules

**NEVER:**
- Deploy without checking logs
- Force-push to main/staging/production
- Skip CloudFormation validation
- Ignore drift detection warnings
- Deploy to production without staging verification

**ALWAYS:**
- Discover existing resources before deploying
- Monitor deployment logs in real-time
- Check CloudFormation stack events for errors
- Review GitHub Actions logs for failures
- Verify stack outputs after deployment
- Check resource health post-deployment

## Related Documentation

- CloudFormation templates: `.deploy/IaC/`
- GitHub workflows: `.github/workflows/`
- Pipeline config: `devops.yml`
- See `docs/worktrees/GIT_WORKFLOW.md` for git details
- See `docs/worktrees/AWS_INFRASTRUCTURE.md` for architecture

---

**Note:** This skill emphasizes discovery-first approach and comprehensive log monitoring during deployments.
