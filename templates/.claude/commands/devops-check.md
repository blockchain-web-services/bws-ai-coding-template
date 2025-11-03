---
description: Monitor deployments and fix failures automatically by launching parallel monitoring agents
allowed-tools: Bash(git:*), Bash(gh:*), Bash(aws:*), Task(*)
model: sonnet
---

# DevOps Check Command

Launches specialized monitoring agents to watch deployments and automatically fixes any failures that occur. This command is designed to handle long-running deployments (10+ minutes) and process failure logs to implement fixes.

## Overview

This command:
1. **Detects** what deployment systems are configured (GitHub Actions, AWS CodePipeline)
2. **Launches** parallel monitoring agents for each system
3. **Waits** for all deployments to complete (even if they take 10+ minutes)
4. **Collects** failure logs from any failed deployments
5. **Fixes** issues automatically based on the logs

## Workflow

### Step 1: Detect Current Branch and Repository Info

Determine the current deployment context:

```bash
# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

# Get repository name from git remote
REPO_URL=$(git config --get remote.origin.url)
# Extract owner and repo name from URL
# Example: git@github.com:owner/repo.git -> owner/repo
```

**Determine deployment environment:**
- Branch `staging` → Staging environment → `--profile staging`
- Branch `prod` → Production environment → `--profile prod`
- Branch `main` or `master` → Staging environment (default) → `--profile staging`
- Other branches → Check if branch has remote tracking

### Step 2: Detect Configured Systems

Check what deployment systems are configured:

**GitHub Actions:**
```bash
# Check if .github/workflows/ exists
if [ -d ".github/workflows" ]; then
    echo "GitHub Actions detected"
fi
```

**AWS CodePipeline:**
```bash
# Check if .worktree-config.json indicates AWS is used
# Or check if .deploy/ directory exists
if [ -f ".worktree-config.json" ]; then
    USE_AWS=$(jq -r '.config.useAWS' .worktree-config.json)
fi

# Also check for .deploy/IaC directory
if [ -d ".deploy/IaC" ]; then
    USE_AWS="true"
fi
```

### Step 3: Launch Monitoring Agents in Parallel

**IMPORTANT:** Launch agents using the Task tool with multiple calls in a **single message** to run them in parallel.

Create monitoring agents based on what's configured:

#### Agent 1: GitHub Actions Monitor

**Task agent with the following prompt:**

```
You are a GitHub Actions monitoring agent. Your job is to monitor the latest GitHub Actions workflow run and wait for it to complete.

**Branch:** {CURRENT_BRANCH}
**Repository:** {OWNER}/{REPO}

**Your tasks:**

1. Get the latest workflow run for this branch:
   ```bash
   gh run list --branch {CURRENT_BRANCH} --limit 1 --json databaseId,status,conclusion,name,workflowName
   ```

2. Extract the run ID from the output

3. Monitor the workflow run until it completes:
   ```bash
   # Watch the run (this command waits for completion)
   gh run watch {RUN_ID}
   ```

   **IMPORTANT:** This command may take 10+ minutes. Wait for it to complete.

4. After completion, get the final status:
   ```bash
   gh run view {RUN_ID} --json conclusion,status,jobs
   ```

5. If the conclusion is "failure", get the detailed logs:
   ```bash
   gh run view {RUN_ID} --log-failed
   ```

6. **Return to main thread:**
   - If **successful**: Return "GitHub Actions: SUCCESS"
   - If **failed**: Return "GitHub Actions: FAILED" followed by the complete failure logs

   Include:
   - Which jobs failed
   - Error messages from logs
   - File paths mentioned in errors
   - Stack traces if present

**Do not attempt to fix issues yourself. Just collect and return the information.**
```

#### Agent 2: CodePipeline Monitor (if AWS configured)

**Task agent with the following prompt:**

```
You are an AWS CodePipeline monitoring agent. Your job is to monitor the CodePipeline execution and wait for it to complete.

**Branch:** {CURRENT_BRANCH}
**Repository:** {REPOSITORY_NAME}
**AWS Profile:** {staging or prod based on branch}
**Pipeline Name:** devops-{REPOSITORY_NAME}-{CURRENT_BRANCH}

**Your tasks:**

1. Get the latest pipeline execution:
   ```bash
   aws codepipeline get-pipeline-state \
     --name devops-{REPOSITORY_NAME}-{CURRENT_BRANCH} \
     --profile {staging|prod} --region us-east-1 \
     --query 'stageStates[*].[stageName,latestExecution.pipelineExecutionId,latestExecution.status]' \
     --output json
   ```

2. Extract the latest execution ID

3. Poll the pipeline status every 30 seconds until completion:
   ```bash
   while true; do
       STATUS=$(aws codepipeline get-pipeline-state \
         --name devops-{REPOSITORY_NAME}-{CURRENT_BRANCH} \
         --profile {staging|prod} --region us-east-1 \
         --query 'stageStates[*].latestExecution.status' \
         --output text)

       echo "Current status: $STATUS"

       # Check if all stages are in terminal state (Succeeded or Failed)
       if ! echo "$STATUS" | grep -q "InProgress"; then
           break
       fi

       sleep 30
   done
   ```

   **IMPORTANT:** This polling may take 10+ minutes. Continue until pipeline completes.

4. Get final pipeline state:
   ```bash
   aws codepipeline get-pipeline-state \
     --name devops-{REPOSITORY_NAME}-{CURRENT_BRANCH} \
     --profile {staging|prod} --region us-east-1
   ```

5. Check for failed stages and get their details:
   ```bash
   # For each failed stage, get the action execution details
   aws codepipeline list-action-executions \
     --pipeline-name devops-{REPOSITORY_NAME}-{CURRENT_BRANCH} \
     --profile {staging|prod} --region us-east-1 \
     --filter pipelineExecutionId={EXECUTION_ID} \
     --query 'actionExecutionDetails[?status==`Failed`]'
   ```

6. For failed CloudFormation stages, get stack events:
   ```bash
   # First, get the stack names from pipeline configuration
   aws codepipeline get-pipeline \
     --name devops-{REPOSITORY_NAME}-{CURRENT_BRANCH} \
     --profile {staging|prod} --region us-east-1 \
     --query 'pipeline.stages[*].actions[?actionTypeId.provider==`CloudFormation`].configuration.StackName' \
     --output text

   # For each failed stack, get events
   aws cloudformation describe-stack-events \
     --stack-name {STACK_NAME} \
     --profile {staging|prod} --region us-east-1 \
     --query 'StackEvents[?ResourceStatus==`CREATE_FAILED` || ResourceStatus==`UPDATE_FAILED` || ResourceStatus==`DELETE_FAILED`]' \
     --output json
   ```

7. **Return to main thread:**
   - If **successful**: Return "CodePipeline: SUCCESS"
   - If **failed**: Return "CodePipeline: FAILED" followed by:
     - Failed stage names
     - Failed action names
     - Error messages
     - CloudFormation stack events (if applicable)
     - Any resource creation/update failures

**Do not attempt to fix issues yourself. Just collect and return the information.**
```

### Step 4: Launch Both Agents in Parallel

**CRITICAL:** Use a single message with multiple Task tool calls:

```
I'm launching monitoring agents for GitHub Actions and CodePipeline in parallel.

<uses Task tool for GitHub Actions agent with prompt from above>
<uses Task tool for CodePipeline agent with prompt from above (if AWS configured)>
```

This ensures agents run concurrently, not sequentially.

### Step 5: Wait for Agent Results

After launching agents, Claude will receive their results back. Each agent will return either:
- Success message
- Failure message with detailed logs

**Processing agent results:**

1. Display status for each system:
   ```
   ✅ GitHub Actions: SUCCESS
   ❌ CodePipeline: FAILED
   ```

2. If any failures detected, proceed to fixing

### Step 6: Analyze and Fix Failures

For each failed system, analyze the logs and implement fixes:

#### GitHub Actions Failures

**Common failure patterns to look for:**

1. **Test failures:**
   - Error: "Test suite failed"
   - Fix: Read test files, understand what's failing, fix the code

2. **Build errors:**
   - Error: "npm run build failed"
   - Fix: Check build errors, fix TypeScript/ESLint issues

3. **Linting errors:**
   - Error: "ESLint found problems"
   - Fix: Run ESLint, fix reported issues

4. **Type errors:**
   - Error: "Type error in file.ts"
   - Fix: Read file, fix type issues

5. **Missing dependencies:**
   - Error: "Cannot find module 'xyz'"
   - Fix: Install missing dependencies

**Fixing process:**
```bash
# 1. Read the relevant files mentioned in errors
# 2. Understand the issue
# 3. Apply fix
# 4. Commit changes
# 5. Push to trigger new workflow
```

#### CodePipeline Failures

**Common failure patterns:**

1. **CloudFormation CREATE_FAILED:**
   - Error: "Resource creation failed"
   - Fix: Check stack events, fix template issues in .deploy/IaC/

2. **CloudFormation UPDATE_FAILED:**
   - Error: "Resource update failed"
   - Fix: Check if resource requires replacement, adjust template

3. **Pre/Post build hook failures:**
   - Error: "BuildError: Command failed"
   - Fix: Check .deploy/IaC/infra/.build/ scripts

4. **IAM permission issues:**
   - Error: "AccessDenied" or "User is not authorized"
   - Fix: Update IAM policies in templates

5. **Parameter validation errors:**
   - Error: "Parameter validation failed"
   - Fix: Check configs in .deploy/IaC/*/configs/*.json

**Fixing process:**
```bash
# 1. Read CloudFormation templates and configs
# 2. Understand the failure from stack events
# 3. Apply fix to templates or configs
# 4. Commit changes
# 5. Push to trigger new pipeline execution
```

### Step 7: Commit and Re-deploy Fixes

After implementing fixes:

```bash
git add .
git commit -m "fix: Address deployment failures

Issues fixed:
- [describe GitHub Actions fixes]
- [describe CodePipeline fixes]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin {CURRENT_BRANCH}
```

### Step 8: Re-run Monitoring (Optional)

Ask user if they want to re-run the monitoring to verify fixes:

```
✅ Fixes have been committed and pushed.

The deployment has been triggered again. Would you like me to monitor it?
- Yes: Re-run /devops-check
- No: You can check manually or run /devops-check later
```

## Error Handling

### If Pipeline/Workflow Not Found

```
❌ No recent deployments found on branch '{BRANCH}'

Possible reasons:
1. No push has been made to this branch recently
2. Workflows/pipeline not triggered yet
3. Branch name mismatch

💡 To trigger a deployment:
   git commit --allow-empty -m "chore: trigger deployment"
   git push origin {BRANCH}
```

### If Agents Timeout

```
⚠️ Monitoring agent timed out

This might mean:
1. Deployment is taking exceptionally long (>10 minutes)
2. Pipeline/workflow is stuck
3. Network connectivity issues

💡 Check manually:
   # GitHub Actions
   gh run list --branch {BRANCH}

   # CodePipeline
   aws codepipeline get-pipeline-state \
     --name devops-{REPO}-{BRANCH} \
     --profile {staging|prod} --region us-east-1
```

### If Multiple Failures

Prioritize fixes:
1. Fix GitHub Actions first (usually faster feedback)
2. Then fix CodePipeline issues
3. Commit all fixes together if they're related

## Example Execution Flow

```
🚀 DevOps Check Starting...

📍 Branch: staging
📦 Repository: blockchain-web-services/bws-api-telegram-xbot

🔍 Detected systems:
  ✓ GitHub Actions
  ✓ AWS CodePipeline

🤖 Launching monitoring agents in parallel...

⏳ Monitoring deployments (this may take several minutes)...

[Wait for agents to complete - may take 10+ minutes]

📊 Results:
  ✅ GitHub Actions: SUCCESS (completed in 3m 42s)
  ❌ CodePipeline: FAILED

📋 CodePipeline Failure Details:
  Stage: Deploy-Infrastructure
  Action: DeployInfraStack
  Error: CREATE_FAILED - Resource DemoTable (AWS::DynamoDB::Table)
  Reason: Table already exists with different key schema

🔧 Analyzing failure...

The DynamoDB table 'DemoTable' exists with a different key schema.
Options:
1. Delete existing table (data loss!)
2. Rename new table
3. Update template to match existing schema

I recommend option 2: Rename the new table to 'DemoTable-v2'

Applying fix to .deploy/IaC/db/db.yml...

✅ Fix applied
📝 Committing changes...
📤 Pushing to staging...

✅ Fixes have been deployed

Would you like me to monitor the new deployment? [y/N]:
```

## Best Practices

1. **Always run this command after pushing to staging/prod**
2. **Don't interrupt while agents are monitoring** (they may be waiting for 10+ minute deployments)
3. **Review proposed fixes** before they're committed (command will show what it's changing)
4. **Use with worktree merge workflow**: After merging with `/worktree-merge`, run `/devops-check` to verify deployment

## Notes

- This command uses long-running Task agents that may take 10+ minutes
- Agents run in parallel for faster results
- Main thread waits for all agents before processing results
- Fixes are automatic but can be reviewed before committing
- Re-running the command after fixes will verify they worked
