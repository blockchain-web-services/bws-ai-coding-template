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

