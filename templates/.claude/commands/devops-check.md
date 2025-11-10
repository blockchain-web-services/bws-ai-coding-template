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
3. **Monitors temporal window** - For GitHub Actions, monitors all workflows from the last 5 minutes
4. **Tracks cascading workflows** - Waits for and monitors workflows triggered by other workflows (e.g., Test → Deploy chains)
5. **Waits** for all deployments to complete (even if they take 10+ minutes per workflow)
6. **Collects** failure logs from any failed deployments
7. **Fixes** issues automatically based on the logs
8. **Re-monitors** automatically after applying fixes with a fresh monitoring window
9. **Iterates** until all pipelines pass (up to 5 attempts)

**Key Features:**
- **Comprehensive monitoring**: Doesn't just check the latest action, monitors ALL recent workflows
- **Cascade detection**: Automatically detects and waits for workflows triggered by other workflows
- **Temporal boundary**: Monitors workflows from the last 5 minutes + any future cascading workflows
- **Example**: If a "Test" workflow succeeds and triggers a "Deploy" workflow, both are monitored and reported

## Workflow

### Step 1: Detect Current Branch and Repository Info

Determine the current deployment context:

```bash
# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

# Get repository name from package.json (remove scope if exists)
REPO_NAME=$(node -p "const name = require('./package.json').name; name.startsWith('@') ? name.split('/')[1] : name")

# Construct AWS CLI profile name: <repo-name>-<environment>
AWS_PROFILE="${REPO_NAME}-${CURRENT_BRANCH}"

# Examples:
# - Repository: bws-backoffice, Branch: staging → Profile: bws-backoffice-staging
# - Repository: bws-api, Branch: prod → Profile: bws-api-prod
```

**AWS Profile Naming Pattern:**
- Format: `<repo-name>-<environment>`
- Repository name is extracted from `package.json` (scope removed)
- Environment is the current branch name
- Examples:
  - `bws-backoffice-staging`
  - `bws-backoffice-prod`
  - `bws-api-staging`

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
You are a GitHub Actions monitoring agent. Your job is to monitor ALL GitHub Actions workflow runs within a time window and wait for cascading workflows.

**Branch:** {CURRENT_BRANCH}
**Repository:** {OWNER}/{REPO}
**Monitoring Window:** Last 5 minutes + future cascading workflows

**Your tasks:**

**Step 1: Define Temporal Boundary**

Get the timestamp for "5 minutes ago" to establish the monitoring window:
```bash
# Get timestamp for 5 minutes ago (ISO 8601 format)
MONITORING_START=$(date -u -d '5 minutes ago' '+%Y-%m-%dT%H:%M:%SZ')
echo "Monitoring workflows since: $MONITORING_START"
```

**Step 2: Get ALL Recent Workflow Runs**

Get all workflow runs that started within the monitoring window:
```bash
# Get all runs from the last 5 minutes for this branch
gh run list --branch {CURRENT_BRANCH} --limit 50 \
  --json databaseId,status,conclusion,name,workflowName,createdAt \
  --jq "[.[] | select(.createdAt >= \"$MONITORING_START\")]"
```

**IMPORTANT:** This may return multiple workflows:
- Initial workflow (e.g., "Test")
- Cascading workflows (e.g., "Deploy" triggered by "Test" success)
- Re-runs or multiple pushes

**Step 3: Monitor All Workflows Until Completion**

For each workflow run found:
1. Track its status
2. Wait for completion
3. After completion, check if new workflows were triggered

```bash
# For each run ID from Step 2:
for RUN_ID in {RUN_IDS}; do
    echo "Monitoring workflow run: $RUN_ID"

    # Watch the run (this command waits for completion)
    gh run watch $RUN_ID

    echo "Workflow $RUN_ID completed"
done
```

**IMPORTANT:** This monitoring may take 10+ minutes per workflow.

**Step 4: Check for Newly Triggered Workflows**

After workflows complete, check if any new workflows were triggered:
```bash
# Wait 30 seconds for any cascade triggers
sleep 30

# Get current timestamp
CURRENT_TIME=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

# Check for new workflows created after our last check
gh run list --branch {CURRENT_BRANCH} --limit 20 \
  --json databaseId,status,conclusion,name,workflowName,createdAt \
  --jq "[.[] | select(.createdAt >= \"$LAST_CHECK_TIME\")]"
```

**If new workflows found:**
- Add them to monitoring list
- Repeat Step 3 for new workflows
- Continue checking for cascades until no new workflows appear for 1 minute

**Step 5: Collect Results from All Workflows**

After all workflows complete and no new ones are triggered:

```bash
# For each monitored run:
for RUN_ID in {ALL_RUN_IDS}; do
    echo "Getting results for run: $RUN_ID"

    # Get final status
    gh run view $RUN_ID --json conclusion,status,jobs,name,workflowName

    # If failed, get detailed logs
    if [ "$CONCLUSION" == "failure" ]; then
        gh run view $RUN_ID --log-failed
    fi
done
```

**Step 6: Return to Main Thread**

Return a comprehensive report:

```
GitHub Actions Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Monitoring Window: {MONITORING_START} to {CURRENT_TIME}
Total Workflows Monitored: {COUNT}

Workflow Results:
1. {WORKFLOW_NAME} (Run #{RUN_ID}): {SUCCESS/FAILURE}
2. {WORKFLOW_NAME} (Run #{RUN_ID}): {SUCCESS/FAILURE}
   → Triggered: {CASCADED_WORKFLOW_NAME} (Run #{RUN_ID}): {SUCCESS/FAILURE}

Overall Status: {SUCCESS if all passed, FAILED if any failed}

{If any failures, include:}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FAILURE LOGS:

Workflow: {WORKFLOW_NAME}
Run ID: {RUN_ID}
Failed Jobs:
  - {JOB_NAME}:
      {Error messages}
      {File paths mentioned}
      {Stack traces}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Examples of Cascade Scenarios:**

**Scenario 1: Test → Deploy Chain**
```
1. Push triggers "CI Test" workflow
2. Monitor "CI Test" (5 minutes)
3. "CI Test" succeeds → triggers "Deploy to Staging"
4. Detect new "Deploy to Staging" workflow
5. Monitor "Deploy to Staging" (8 minutes)
6. Both complete → return combined results
```

**Scenario 2: Multiple Independent Workflows**
```
1. Push triggers both "Test" and "Lint" workflows (parallel)
2. Monitor both simultaneously
3. "Test" succeeds → triggers "Deploy"
4. "Lint" succeeds (no cascade)
5. Monitor "Deploy" until complete
6. All three workflows complete → return combined results
```

**Scenario 3: Failed Test (No Cascade)**
```
1. Push triggers "Test" workflow
2. Monitor "Test"
3. "Test" fails → no "Deploy" triggered
4. Wait 1 minute to confirm no cascade
5. Return failure with logs
```

**Do not attempt to fix issues yourself. Just collect and return the information for ALL workflows in the monitoring window.**
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
     --profile $AWS_PROFILE --region us-east-1 \
     --query 'stageStates[*].[stageName,latestExecution.pipelineExecutionId,latestExecution.status]' \
     --output json
   ```

2. Extract the latest execution ID

3. Poll the pipeline status every 30 seconds until completion:
   ```bash
   while true; do
       STATUS=$(aws codepipeline get-pipeline-state \
         --name devops-{REPOSITORY_NAME}-{CURRENT_BRANCH} \
         --profile $AWS_PROFILE --region us-east-1 \
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
     --profile $AWS_PROFILE --region us-east-1
   ```

5. Check for failed stages and get their details:
   ```bash
   # For each failed stage, get the action execution details
   aws codepipeline list-action-executions \
     --pipeline-name devops-{REPOSITORY_NAME}-{CURRENT_BRANCH} \
     --profile $AWS_PROFILE --region us-east-1 \
     --filter pipelineExecutionId={EXECUTION_ID} \
     --query 'actionExecutionDetails[?status==`Failed`]'
   ```

6. For failed CloudFormation stages, get stack events:
   ```bash
   # First, get the stack names from pipeline configuration
   aws codepipeline get-pipeline \
     --name devops-{REPOSITORY_NAME}-{CURRENT_BRANCH} \
     --profile $AWS_PROFILE --region us-east-1 \
     --query 'pipeline.stages[*].actions[?actionTypeId.provider==`CloudFormation`].configuration.StackName' \
     --output text

   # For each failed stack, get events
   aws cloudformation describe-stack-events \
     --stack-name {STACK_NAME} \
     --profile $AWS_PROFILE --region us-east-1 \
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

**GitHub Actions results will include:**
- Monitoring window (start/end time)
- List of ALL workflows monitored (initial + cascading)
- Success/failure status for each workflow
- Indication of which workflows triggered which (cascade relationships)
- Detailed failure logs if any workflow failed

**Example GitHub Actions result:**
```
GitHub Actions Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Monitoring Window: 2024-01-15T14:20:00Z to 2024-01-15T14:35:00Z
Total Workflows Monitored: 3

Workflow Results:
1. CI Tests (Run #12345): SUCCESS (5m 30s)
   → Triggered: Deploy to Staging (Run #12346): SUCCESS (8m 15s)
2. Lint Checks (Run #12347): SUCCESS (2m 10s)

Overall Status: SUCCESS
```

**Example with failure:**
```
GitHub Actions Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Monitoring Window: 2024-01-15T14:20:00Z to 2024-01-15T14:35:00Z
Total Workflows Monitored: 2

Workflow Results:
1. CI Tests (Run #12345): FAILED (3m 45s)
   (No cascading workflows triggered due to failure)
2. Lint Checks (Run #12347): SUCCESS (2m 10s)

Overall Status: FAILED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FAILURE LOGS:

Workflow: CI Tests
Run ID: 12345
Failed Jobs:
  - test-backend:
      Error: Test suite failed with 2 failures
      File: test/api/auth.test.js:45
      TypeError: Cannot read property 'token' of undefined
```

**Display comprehensive status:**

1. For GitHub Actions, show status for each workflow:
   ```
   📊 GitHub Actions Results:
      ✅ CI Tests (Run #12345) - 5m 30s
      ✅ Deploy to Staging (Run #12346) - 8m 15s [triggered by CI Tests]
      ✅ Lint Checks (Run #12347) - 2m 10s

   Overall: ✅ SUCCESS
   ```

2. For CodePipeline:
   ```
   📊 CodePipeline Results:
      ❌ FAILED
   ```

3. If any failures detected in any workflow or pipeline, proceed to fixing

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
git commit -m "fix: Address deployment failures (Iteration {N})

Issues fixed:
- [describe GitHub Actions fixes]
- [describe CodePipeline fixes]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin {CURRENT_BRANCH}
```

### Step 8: Automatic Re-monitoring and Iteration

**IMPORTANT:** After pushing fixes, automatically re-launch monitoring agents to verify the fixes worked.

**Iteration Loop:**

```
ITERATION = 1
MAX_ITERATIONS = 5
ALL_FIXES = []

LOOP until all pipelines pass OR max iterations reached:
    1. Show iteration status:
       "🔄 Iteration {ITERATION}/{MAX_ITERATIONS}: Monitoring deployments..."

    2. Re-launch monitoring agents (same as Step 3)
       - Launch GitHub Actions monitor with NEW monitoring window
         * Window starts from current time (when agent launches)
         * Agent will monitor all workflows in the last 5 minutes
         * Agent will wait for cascading workflows (Test → Deploy chains)
         * Agent returns results for ALL workflows found in window + cascades

       - Launch CodePipeline monitor (if configured)
         * Monitors the latest execution triggered by the push

       - Wait for both agents to complete

    3. Process results (including all workflows from monitoring window):
       IF all pipelines SUCCESS:
           ✅ All deployments successful!
           BREAK loop

       ELSE IF failures found:
           IF ITERATION >= MAX_ITERATIONS:
               ❌ Max iterations reached. Manual intervention required.
               SHOW summary of all fixes attempted
               BREAK loop

           ELSE:
               📋 Collecting failure logs...
               🔧 Analyzing and implementing fixes...
               💾 Commit and push (Step 7)
               INCREMENT ITERATION
               CONTINUE loop
```

**Implementation Details:**

1. **Track all fixes across iterations:**
   ```
   ALL_FIXES.append({
       iteration: ITERATION,
       system: "GitHub Actions" or "CodePipeline",
       issue: "Description of issue",
       fix: "Description of fix applied",
       files_changed: ["file1.js", "file2.yml"]
   })
   ```

2. **Show progress during iterations:**
   ```
   🔄 Iteration 1/5: Monitoring deployments...

   📊 GitHub Actions Agent Results:
      Monitoring Window: 2024-01-15T14:20:00Z to 2024-01-15T14:35:00Z
      Workflows Monitored: 3

      ✅ CI Tests (Run #12345) - 5m 30s
      ❌ Deploy to Staging (Run #12346) - FAILED - 2m 15s [triggered by CI Tests]
      ✅ Lint Checks (Run #12347) - 2m 10s

      Overall: ❌ FAILED (1 of 3 workflows failed)

   📊 CodePipeline Results:
      ✅ SUCCESS - All stages passed

   🔧 Analyzing failures...
      - Deploy to Staging failed: Missing environment variable API_KEY

   🔧 Applying fixes...
      - Adding API_KEY to GitHub Actions secrets configuration

   📝 Committed and pushed fixes

   🔄 Iteration 2/5: Re-monitoring after fixes...

   📊 GitHub Actions Agent Results:
      Monitoring Window: 2024-01-15T14:36:00Z to 2024-01-15T14:48:00Z
      Workflows Monitored: 3

      ✅ CI Tests (Run #12348) - 5m 25s
      ✅ Deploy to Staging (Run #12349) - 8m 05s [triggered by CI Tests]
      ✅ Lint Checks (Run #12350) - 2m 08s

      Overall: ✅ SUCCESS (all workflows passed)

   ✅ All deployments successful!
   ```

3. **Display final summary after loop exits:**
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ✅ ALL DEPLOYMENTS SUCCESSFUL!
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   📊 Summary:
   - Total iterations: 2
   - GitHub Actions: SUCCESS (after 2 fixes)
   - CodePipeline: SUCCESS (no fixes needed)

   📝 Fixes Applied:

   Iteration 1:
   - [GitHub Actions] Fixed TypeScript error in api/handler.ts
     Files: api/handler.ts

   - [GitHub Actions] Added missing dependency 'axios'
     Files: package.json

   Iteration 2:
   - [GitHub Actions] Fixed test assertion in tests/api.test.ts
     Files: tests/api.test.ts

   🎉 All pipelines are now passing!
   ```

4. **If max iterations reached:**
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ⚠️ MAX ITERATIONS REACHED (5/5)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   Some deployments are still failing after 5 attempts.

   📊 Final Status:
   - GitHub Actions: FAILED
   - CodePipeline: SUCCESS

   📝 Fixes Attempted (5 iterations):
   [Show all fixes from ALL_FIXES list]

   ⚠️ Remaining Issues:
   - GitHub Actions: [Current failure description]

   💡 Next Steps:
   1. Review the logs manually: gh run view {RUN_ID} --log
   2. The issue may require architectural changes
   3. Check if external dependencies are causing failures
   4. Consider reaching out for help if issue persists
   ```

**Automatic vs Manual Control:**

- **Default:** Automatically iterate until all pass (up to 5 times)
- **Max iterations:** Configurable (default: 5)
- **No user prompts:** Runs fully automated
- **Timeout protection:** Each iteration has same timeout limits as initial run

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
     --profile $AWS_PROFILE --region us-east-1
```

### If Multiple Failures

Prioritize fixes:
1. Fix GitHub Actions first (usually faster feedback)
2. Then fix CodePipeline issues
3. Commit all fixes together if they're related

## Example Execution Flow

### Example 1: Single Iteration (All Pass)

```
🚀 DevOps Check Starting...

📍 Branch: staging
📦 Repository: blockchain-web-services/bws-api-telegram-xbot

🔍 Detected systems:
  ✓ GitHub Actions
  ✓ AWS CodePipeline

🔄 Iteration 1/5: Monitoring deployments...
🤖 Launching monitoring agents in parallel...

⏳ Monitoring (this may take several minutes)...

📊 Results:
  ✅ GitHub Actions: SUCCESS (3m 42s)
  ✅ CodePipeline: SUCCESS (8m 15s)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ALL DEPLOYMENTS SUCCESSFUL!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Summary:
- Total iterations: 1
- GitHub Actions: SUCCESS
- CodePipeline: SUCCESS

🎉 All pipelines passed on first attempt!
```

### Example 2: Multiple Iterations with Fixes

```
🚀 DevOps Check Starting...

📍 Branch: staging
📦 Repository: blockchain-web-services/bws-api-telegram-xbot

🔍 Detected systems:
  ✓ GitHub Actions
  ✓ AWS CodePipeline

🔄 Iteration 1/5: Monitoring deployments...
🤖 Launching monitoring agents in parallel...

⏳ Monitoring (this may take several minutes)...

📊 Results (Iteration 1):
  ❌ GitHub Actions: FAILED
  ❌ CodePipeline: FAILED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Failure Details:

[GitHub Actions]
Job: test
Error: TypeError: Cannot read property 'id' of undefined
File: src/api/handler.ts:42

[CodePipeline]
Stage: Deploy-Infrastructure
Error: CREATE_FAILED - DynamoDB table key schema mismatch
Resource: DemoTable

🔧 Analyzing failures and applying fixes...

Fix 1: [GitHub Actions] Added null check in handler.ts
  Files: src/api/handler.ts

Fix 2: [CodePipeline] Renamed table to DemoTable-v2
  Files: .deploy/IaC/db/db.yml

📝 Committing: "fix: Address deployment failures (Iteration 1)"
📤 Pushing to staging...
✅ Fixes deployed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 Iteration 2/5: Re-monitoring after fixes...
🤖 Launching monitoring agents in parallel...

⏳ Monitoring (this may take several minutes)...

📊 Results (Iteration 2):
  ❌ GitHub Actions: FAILED
  ✅ CodePipeline: SUCCESS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Failure Details:

[GitHub Actions]
Job: test
Error: Test suite failed - Expected 200, got 404
File: tests/api.test.ts:25

🔧 Analyzing failure and applying fix...

Fix 3: [GitHub Actions] Updated test expectation to match new endpoint
  Files: tests/api.test.ts

📝 Committing: "fix: Address deployment failures (Iteration 2)"
📤 Pushing to staging...
✅ Fixes deployed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 Iteration 3/5: Re-monitoring after fixes...
🤖 Launching monitoring agents in parallel...

⏳ Monitoring (this may take several minutes)...

📊 Results (Iteration 3):
  ✅ GitHub Actions: SUCCESS (3m 28s)
  ✅ CodePipeline: SUCCESS (already passed)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ALL DEPLOYMENTS SUCCESSFUL!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Summary:
- Total iterations: 3
- GitHub Actions: SUCCESS (after 3 fixes)
- CodePipeline: SUCCESS (after 1 fix)

📝 All Fixes Applied:

Iteration 1:
  ✓ [GitHub Actions] Added null check in handler.ts
    Files: src/api/handler.ts

  ✓ [CodePipeline] Renamed table to DemoTable-v2
    Files: .deploy/IaC/db/db.yml

Iteration 2:
  ✓ [GitHub Actions] Updated test expectation to match new endpoint
    Files: tests/api.test.ts

🎉 All pipelines are now passing!
```

### Example 3: Max Iterations Reached

```
🚀 DevOps Check Starting...

[... monitoring and fixes for iterations 1-4 ...]

🔄 Iteration 5/5: Re-monitoring after fixes...
🤖 Launching monitoring agents in parallel...

⏳ Monitoring (this may take several minutes)...

📊 Results (Iteration 5):
  ❌ GitHub Actions: FAILED
  ✅ CodePipeline: SUCCESS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ MAX ITERATIONS REACHED (5/5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Some deployments are still failing after 5 attempts.

📊 Final Status:
  ❌ GitHub Actions: FAILED
  ✅ CodePipeline: SUCCESS

📝 Fixes Attempted (5 iterations):
  Iteration 1: Fixed handler.ts null check, renamed DynamoDB table
  Iteration 2: Updated test expectations
  Iteration 3: Fixed linting errors
  Iteration 4: Added missing type definitions
  Iteration 5: Fixed async/await handling

⚠️ Remaining Issue:
[GitHub Actions] Integration test still failing
Error: Connection timeout to external API
File: tests/integration/api.test.ts

💡 Next Steps:
1. The external API may be down or rate-limiting
2. Check if API credentials are properly configured
3. Consider mocking external API calls in tests
4. Review logs manually: gh run view {RUN_ID} --log
5. This may require architectural changes to test setup
```

## Best Practices

1. **Always run this command after pushing to staging/prod**
2. **Don't interrupt during iterations** - The command may take 30+ minutes if multiple iterations are needed
3. **Trust the iteration loop** - The command will automatically retry until success or max iterations
4. **Use with worktree merge workflow**: After merging with `/worktree-merge`, run `/devops-check` to verify deployment
5. **Monitor iteration progress** - Each iteration shows clear status and what's being fixed
6. **Review final summary** - Shows all fixes applied across all iterations

## Notes

**Automatic Iteration:**
- Command automatically re-monitors after each fix (up to 5 times)
- No user intervention needed between iterations
- Fully automated fix-and-verify loop
- Stops when all pipelines pass OR max iterations reached

**Timing:**
- First iteration: 10-15 minutes (initial deployment monitoring)
- Each retry iteration: 10-15 minutes (re-deployment monitoring)
- Total time for 3 iterations: ~30-45 minutes
- Max time (5 iterations): ~50-75 minutes

**Agent Behavior:**
- Agents run in parallel for faster results
- Each iteration launches fresh monitoring agents
- Agents wait patiently for 10+ minute deployments
- Main thread processes all agent results together

**Fix Tracking:**
- All fixes tracked across iterations in ALL_FIXES array
- Commit messages include iteration number
- Final summary shows complete fix history
- Easy to understand what was changed and when
