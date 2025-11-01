## CloudFormation Deployment Monitoring

**Important:**
- All CloudFormation deployments are triggered automatically when you push to `staging` or `prod` branches
- CloudFormation stack names are NOT predictable - discover them from the CodePipeline configuration
- Pipeline naming: `devops-{{REPOSITORY_NAME}}-staging` or `devops-{{REPOSITORY_NAME}}-prod`

**AWS Profile Selection:**
- Use `--profile staging` when monitoring staging deployments (staging branch)
- Use `--profile prod` when monitoring production deployments (prod branch)
- **Default:** If no environment is specified, use `--profile staging`

### Step 1: Discover CloudFormation Stack Names from CodePipeline

**First, always discover the actual stack names from the pipeline:**

```bash
# List all CloudFormation stacks deployed by staging pipeline
aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[*].actions[?actionTypeId.provider==`CloudFormation`].[actionName,configuration.StackName]' \
  --output table

# List all CloudFormation stacks deployed by prod pipeline
aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-prod \
  --profile prod --region us-east-1 \
  --query 'pipeline.stages[*].actions[?actionTypeId.provider==`CloudFormation`].[actionName,configuration.StackName]' \
  --output table
```

### Step 2: List All Existing Stacks

```bash
# List all stacks (use --profile staging or --profile prod based on target environment)
aws cloudformation list-stacks \
  --profile staging --region us-east-1 \
  --query 'StackSummaries[*].[StackName,StackStatus,LastUpdatedTime]' \
  --output table

# Filter for active stacks only
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_IN_PROGRESS \
  --profile staging --region us-east-1 \
  --query 'StackSummaries[*].[StackName,StackStatus]' \
  --output table

# Find CloudFormation templates in the project
find .deploy/IaC -type f \( -name "*.yml" -o -name "*.yaml" \)
```

### Step 3: Monitor Deployment Progress (After Git Push)

After pushing to staging or prod branches and discovering stack names from Step 1:

```bash
# First, get the stack name from pipeline
# Use --profile staging for staging, --profile prod for production
STACK_NAME=$(aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[0].actions[?actionTypeId.provider==`CloudFormation`].configuration.StackName' \
  --output text | head -1)

echo "Monitoring stack: $STACK_NAME"

# Continuously monitor stack events (use matching profile)
aws cloudformation describe-stack-events \
  --stack-name $STACK_NAME \
  --profile staging --region us-east-1 \
  --max-items 20

# Watch for completion (blocks until complete/failed)
aws cloudformation wait stack-update-complete \
  --stack-name $STACK_NAME \
  --profile staging --region us-east-1
```

### Step 4: View Stack Events with Details

```bash
# Get detailed event log with timestamps (use actual stack name and matching profile)
# For staging: --profile staging, for prod: --profile prod
aws cloudformation describe-stack-events \
  --stack-name <actual-stack-name> \
  --query 'StackEvents[*].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId,ResourceStatusReason]' \
  --output table \
  --profile staging --region us-east-1

# Watch events in real-time (refresh every 5 seconds, use matching profile)
watch -n 5 "aws cloudformation describe-stack-events \
  --stack-name <actual-stack-name> \
  --max-items 10 \
  --profile staging --region us-east-1 \
  --output table"
```

### Step 5: Check for Deployment Failures

```bash
# Check for failed resources (use actual stack name)
aws cloudformation describe-stack-events \
  --stack-name <actual-stack-name> \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED' || ResourceStatus=='UPDATE_FAILED']" \
  --profile staging --region us-east-1

# Get detailed failure reason for latest event
aws cloudformation describe-stack-events \
  --stack-name <actual-stack-name> \
  --query "StackEvents[0].[LogicalResourceId,ResourceStatus,ResourceStatusReason]" \
  --output table \
  --profile staging --region us-east-1

# Check stack status
aws cloudformation describe-stacks \
  --stack-name <actual-stack-name> \
  --query 'Stacks[0].[StackName,StackStatus,StackStatusReason]' \
  --output table \
  --profile staging --region us-east-1
```

### Step 6: Verify Stack Outputs

After deployment completes, check stack outputs:

```bash
# Get stack outputs (API endpoints, resource ARNs, etc.)
aws cloudformation describe-stacks \
  --stack-name <actual-stack-name> \
  --query 'Stacks[0].Outputs' \
  --output table \
  --profile staging --region us-east-1

# Get all stack details
aws cloudformation describe-stacks \
  --stack-name <actual-stack-name> \
  --profile staging --region us-east-1
```

### Step 7: Monitor Multiple Stacks from Pipeline

When pipeline deploys multiple stacks (e.g., DB + Infrastructure):

```bash
# Get all stack names from the pipeline
aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[*].actions[?actionTypeId.provider==`CloudFormation`].configuration.StackName' \
  --output text

# Store them in variables
DB_STACK=$(aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[*].actions[?contains(actionName,`DB`) && actionTypeId.provider==`CloudFormation`].configuration.StackName' \
  --output text | head -1)

INFRA_STACK=$(aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[*].actions[?contains(actionName,`Infra`) && actionTypeId.provider==`CloudFormation`].configuration.StackName' \
  --output text | head -1)

# Monitor both stacks
echo "DB Stack: $DB_STACK"
echo "Infrastructure Stack: $INFRA_STACK"

aws cloudformation describe-stack-events \
  --stack-name $DB_STACK \
  --max-items 10 \
  --profile staging --region us-east-1

aws cloudformation describe-stack-events \
  --stack-name $INFRA_STACK \
  --max-items 10 \
  --profile staging --region us-east-1
```

### Step 8: Check CloudFormation Drift

Detect if resources have been modified outside of CloudFormation:

```bash
# Detect drift (use actual stack name)
aws cloudformation detect-stack-drift \
  --stack-name <actual-stack-name> \
  --profile staging --region us-east-1

# View drift results
aws cloudformation describe-stack-drift-detection-status \
  --stack-drift-detection-id <detection-id> \
  --profile staging --region us-east-1
```

### Complete Monitoring Workflow

```bash
# 1. Discover stack names from pipeline
echo "=== Discovering stacks from pipeline ==="
aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[*].actions[?actionTypeId.provider==`CloudFormation`].[actionName,configuration.StackName]' \
  --output table

# 2. Get the first stack name
STACK_NAME=$(aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[0].actions[?actionTypeId.provider==`CloudFormation`].configuration.StackName' \
  --output text | head -1)

# 3. Monitor that stack
echo -e "\n=== Monitoring $STACK_NAME ==="
aws cloudformation describe-stack-events \
  --stack-name $STACK_NAME \
  --max-items 10 \
  --profile staging --region us-east-1 \
  --output table

# 4. Check stack status
echo -e "\n=== Stack Status ==="
aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].[StackName,StackStatus]' \
  --output table \
  --profile staging --region us-east-1
```

### Common Stack Status Values

**In Progress:**
- `CREATE_IN_PROGRESS` - Stack is being created
- `UPDATE_IN_PROGRESS` - Stack is being updated
- `ROLLBACK_IN_PROGRESS` - Failed deployment rolling back

**Success:**
- `CREATE_COMPLETE` - Stack created successfully
- `UPDATE_COMPLETE` - Stack updated successfully

**Failure:**
- `CREATE_FAILED` - Stack creation failed
- `UPDATE_FAILED` - Stack update failed
- `ROLLBACK_COMPLETE` - Rollback finished
- `ROLLBACK_FAILED` - Rollback failed (manual intervention needed)
