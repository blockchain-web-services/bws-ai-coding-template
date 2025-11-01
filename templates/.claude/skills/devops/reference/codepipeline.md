## AWS CodePipeline Workflow

**Important:** CodePipeline naming convention is `devops-<repository-name>-<branch>`.

**AWS Profile Selection:**
- Use `--profile staging` when monitoring staging pipeline (staging branch)
- Use `--profile prod` when monitoring production pipeline (prod branch)
- **Default:** If no environment is specified, use `--profile staging`

### Step 1: Discover Pipeline

```bash
# List all pipelines for this project
# Use --profile staging by default, or --profile prod if checking production
aws codepipeline list-pipelines --profile staging --region us-east-1 | \
  grep "devops-{{REPOSITORY_NAME}}"

# Get staging pipeline details
aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1

# Get production pipeline details
aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-prod \
  --profile prod --region us-east-1
```

### Step 2: Monitor Pipeline Execution

**Check current pipeline state:**
```bash
# Staging pipeline
aws codepipeline get-pipeline-state \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1

# Production pipeline
aws codepipeline get-pipeline-state \
  --name devops-{{REPOSITORY_NAME}}-prod \
  --profile prod --region us-east-1
```

**List recent executions:**
```bash
# Staging pipeline executions
aws codepipeline list-pipeline-executions \
  --pipeline-name devops-{{REPOSITORY_NAME}}-staging \
  --max-items 10 \
  --profile staging --region us-east-1

# Production pipeline executions
aws codepipeline list-pipeline-executions \
  --pipeline-name devops-{{REPOSITORY_NAME}}-prod \
  --max-items 10 \
  --profile prod --region us-east-1
```

### Step 3: Check Stage-Specific Logs

**Get execution details:**
```bash
aws codepipeline get-pipeline-execution \
  --pipeline-name devops-{{REPOSITORY_NAME}}-staging \
  --pipeline-execution-id <execution-id> \
  --profile staging --region us-east-1
```

**Check action details (CloudFormation deploy action):**
```bash
# Find CloudFormation action execution
aws codepipeline list-action-executions \
  --pipeline-name devops-{{REPOSITORY_NAME}}-staging \
  --filter pipelineExecutionId=<execution-id> \
  --profile staging --region us-east-1
```

### Step 4: Discover CloudFormation Stack Names from Pipeline

**Important:** CloudFormation stack names are configured in the pipeline stages. Do NOT assume stack names - discover them from the pipeline configuration.

```bash
# Get pipeline configuration and extract CloudFormation stack names
# Use --profile staging for staging, --profile prod for production
aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[*].actions[?actionTypeId.provider==`CloudFormation`].configuration' \
  --output json

# Extract just the stack names (use matching profile)
aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[*].actions[?actionTypeId.provider==`CloudFormation`].configuration.StackName' \
  --output table
```

### Step 5: View CloudFormation Logs from Pipeline

After discovering stack names from the pipeline, monitor stack events:

```bash
# First, get the stack name from the pipeline (use matching profile)
# For staging: --profile staging, for prod: --profile prod
STACK_NAME=$(aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[0].actions[?actionTypeId.provider==`CloudFormation`].configuration.StackName' \
  --output text)

# Then monitor that stack (use same profile)
aws cloudformation describe-stack-events \
  --stack-name $STACK_NAME \
  --max-items 50 \
  --profile staging --region us-east-1
```

### Step 6: Monitor Pipeline Execution with CloudFormation Details

```bash
# 1. Get pipeline execution status
aws codepipeline get-pipeline-state \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'stageStates[*].[stageName,latestExecution.status]' \
  --output table

# 2. For CloudFormation stages, get the action details
aws codepipeline get-pipeline-state \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'stageStates[*].actionStates[?actionName==`DeployDB`].[actionName,latestExecution.status,latestExecution.errorDetails]' \
  --output json

# 3. List all CloudFormation stacks deployed by the pipeline
aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[*].actions[?actionTypeId.provider==`CloudFormation`].[actionName,configuration.StackName]' \
  --output table
```

### Common Pipeline States

**Stage States:**
- `InProgress` - Stage is currently executing
- `Succeeded` - Stage completed successfully
- `Failed` - Stage failed (check action details)

**Action States:**
- `InProgress` - Action is running
- `Succeeded` - Action completed
- `Failed` - Action failed (check errorDetails)

### Troubleshooting Pipeline Failures

```bash
# 1. Get latest execution ID
EXECUTION_ID=$(aws codepipeline list-pipeline-executions \
  --pipeline-name devops-{{REPOSITORY_NAME}}-staging \
  --max-items 1 \
  --profile staging --region us-east-1 \
  --query 'pipelineExecutionSummaries[0].pipelineExecutionId' \
  --output text)

# 2. Get detailed execution info
aws codepipeline get-pipeline-execution \
  --pipeline-name devops-{{REPOSITORY_NAME}}-staging \
  --pipeline-execution-id $EXECUTION_ID \
  --profile staging --region us-east-1

# 3. List all actions for this execution
aws codepipeline list-action-executions \
  --pipeline-name devops-{{REPOSITORY_NAME}}-staging \
  --filter pipelineExecutionId=$EXECUTION_ID \
  --profile staging --region us-east-1 \
  --query 'actionExecutionDetails[?status==`Failed`].[actionName,status,output.executionResult.externalExecutionSummary]' \
  --output table
```
