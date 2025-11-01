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

