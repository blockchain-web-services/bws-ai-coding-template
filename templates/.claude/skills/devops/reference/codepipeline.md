## AWS CodePipeline Workflow

**Important:** CodePipeline naming convention is `devops-<repository-name>-<branch>`.

**AWS Profile Selection:**

Profile naming pattern: `<repo-name>-<environment>`

Always detect the profile dynamically:
```bash
REPO_NAME=$(node -p "const name = require('./package.json').name; name.startsWith('@') ? name.split('/')[1] : name")
ENVIRONMENT=$(git branch --show-current)
AWS_PROFILE="${REPO_NAME}-${ENVIRONMENT}"
```

Examples:
- Repository: `bws-backoffice`, Branch: `staging` → Profile: `bws-backoffice-staging`
- Repository: `bws-api`, Branch: `prod` → Profile: `bws-api-prod`

### Step 1: Discover Pipeline

```bash
# Set up AWS profile
REPO_NAME=$(node -p "const name = require('./package.json').name; name.startsWith('@') ? name.split('/')[1] : name")
ENVIRONMENT=$(git branch --show-current)
AWS_PROFILE="${REPO_NAME}-${ENVIRONMENT}"

# List all pipelines for this project
aws codepipeline list-pipelines --profile $AWS_PROFILE --region us-east-1 | \
  grep "devops-${REPO_NAME}"

# Get current environment's pipeline details
aws codepipeline get-pipeline \
  --name devops-${REPO_NAME}-${ENVIRONMENT} \
  --profile $AWS_PROFILE --region us-east-1
```

### Step 2: Monitor Pipeline Execution

```bash
# Set up AWS profile
REPO_NAME=$(node -p "const name = require('./package.json').name; name.startsWith('@') ? name.split('/')[1] : name")
ENVIRONMENT=$(git branch --show-current)
AWS_PROFILE="${REPO_NAME}-${ENVIRONMENT}"

# Check current pipeline state
aws codepipeline get-pipeline-state \
  --name devops-${REPO_NAME}-${ENVIRONMENT} \
  --profile $AWS_PROFILE --region us-east-1

# List recent executions
aws codepipeline list-pipeline-executions \
  --pipeline-name devops-${REPO_NAME}-${ENVIRONMENT} \
  --max-items 10 \
  --profile $AWS_PROFILE --region us-east-1
```

### Step 3: Check Stage-Specific Logs

```bash
# Set up AWS profile
REPO_NAME=$(node -p "const name = require('./package.json').name; name.startsWith('@') ? name.split('/')[1] : name")
ENVIRONMENT=$(git branch --show-current)
AWS_PROFILE="${REPO_NAME}-${ENVIRONMENT}"

# Get execution details
aws codepipeline get-pipeline-execution \
  --pipeline-name devops-${REPO_NAME}-${ENVIRONMENT} \
  --pipeline-execution-id <execution-id> \
  --profile $AWS_PROFILE --region us-east-1

# Check action details (CloudFormation deploy action)
aws codepipeline list-action-executions \
  --pipeline-name devops-${REPO_NAME}-${ENVIRONMENT} \
  --filter pipelineExecutionId=<execution-id> \
  --profile $AWS_PROFILE --region us-east-1
```

### Step 4: Discover CloudFormation Stack Names from Pipeline

**Important:** CloudFormation stack names are configured in the pipeline stages. Do NOT assume stack names - discover them from the pipeline configuration.

```bash
# Set up AWS profile
REPO_NAME=$(node -p "const name = require('./package.json').name; name.startsWith('@') ? name.split('/')[1] : name")
ENVIRONMENT=$(git branch --show-current)
AWS_PROFILE="${REPO_NAME}-${ENVIRONMENT}"

# Get pipeline configuration and extract CloudFormation stack names
aws codepipeline get-pipeline \
  --name devops-${REPO_NAME}-${ENVIRONMENT} \
  --profile $AWS_PROFILE --region us-east-1 \
  --query 'pipeline.stages[*].actions[?actionTypeId.provider==`CloudFormation`].configuration' \
  --output json

# Extract just the stack names
aws codepipeline get-pipeline \
  --name devops-${REPO_NAME}-${ENVIRONMENT} \
  --profile $AWS_PROFILE --region us-east-1 \
  --query 'pipeline.stages[*].actions[?actionTypeId.provider==`CloudFormation`].configuration.StackName' \
  --output table
```

### Step 5: View CloudFormation Logs from Pipeline

After discovering stack names from the pipeline, monitor stack events:

```bash
# Set up AWS profile
REPO_NAME=$(node -p "const name = require('./package.json').name; name.startsWith('@') ? name.split('/')[1] : name")
ENVIRONMENT=$(git branch --show-current)
AWS_PROFILE="${REPO_NAME}-${ENVIRONMENT}"

# Get the stack name from the pipeline
STACK_NAME=$(aws codepipeline get-pipeline \
  --name devops-${REPO_NAME}-${ENVIRONMENT} \
  --profile $AWS_PROFILE --region us-east-1 \
  --query 'pipeline.stages[0].actions[?actionTypeId.provider==`CloudFormation`].configuration.StackName' \
  --output text)

# Monitor that stack
aws cloudformation describe-stack-events \
  --stack-name $STACK_NAME \
  --max-items 50 \
  --profile $AWS_PROFILE --region us-east-1
```

### Step 6: Monitor Pipeline Execution with CloudFormation Details

```bash
# Set up AWS profile
REPO_NAME=$(node -p "const name = require('./package.json').name; name.startsWith('@') ? name.split('/')[1] : name")
ENVIRONMENT=$(git branch --show-current)
AWS_PROFILE="${REPO_NAME}-${ENVIRONMENT}"

# 1. Get pipeline execution status
aws codepipeline get-pipeline-state \
  --name devops-${REPO_NAME}-${ENVIRONMENT} \
  --profile $AWS_PROFILE --region us-east-1 \
  --query 'stageStates[*].[stageName,latestExecution.status]' \
  --output table

# 2. For CloudFormation stages, get the action details
aws codepipeline get-pipeline-state \
  --name devops-${REPO_NAME}-${ENVIRONMENT} \
  --profile $AWS_PROFILE --region us-east-1 \
  --query 'stageStates[*].actionStates[?actionName==`DeployDB`].[actionName,latestExecution.status,latestExecution.errorDetails]' \
  --output json

# 3. List all CloudFormation stacks deployed by the pipeline
aws codepipeline get-pipeline \
  --name devops-${REPO_NAME}-${ENVIRONMENT} \
  --profile $AWS_PROFILE --region us-east-1 \
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
# Set up AWS profile
REPO_NAME=$(node -p "const name = require('./package.json').name; name.startsWith('@') ? name.split('/')[1] : name")
ENVIRONMENT=$(git branch --show-current)
AWS_PROFILE="${REPO_NAME}-${ENVIRONMENT}"

# 1. Get latest execution ID
EXECUTION_ID=$(aws codepipeline list-pipeline-executions \
  --pipeline-name devops-${REPO_NAME}-${ENVIRONMENT} \
  --max-items 1 \
  --profile $AWS_PROFILE --region us-east-1 \
  --query 'pipelineExecutionSummaries[0].pipelineExecutionId' \
  --output text)

# 2. Get detailed execution info
aws codepipeline get-pipeline-execution \
  --pipeline-name devops-${REPO_NAME}-${ENVIRONMENT} \
  --pipeline-execution-id $EXECUTION_ID \
  --profile $AWS_PROFILE --region us-east-1

# 3. List all actions for this execution
aws codepipeline list-action-executions \
  --pipeline-name devops-${REPO_NAME}-${ENVIRONMENT} \
  --filter pipelineExecutionId=$EXECUTION_ID \
  --profile $AWS_PROFILE --region us-east-1 \
  --query 'actionExecutionDetails[?status==`Failed`].[actionName,status,output.executionResult.externalExecutionSummary]' \
  --output table
```
