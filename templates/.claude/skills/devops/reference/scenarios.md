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

