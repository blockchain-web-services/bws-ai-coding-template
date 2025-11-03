## Common Deployment Scenarios

**Important:**
- All deployments are triggered by pushing to `staging` or `prod` branches. Manual AWS CLI deployments are not used.
- **AWS Profile Selection:** Use `--profile staging` for staging deployments, `--profile prod` for production deployments
- **Default:** If no environment is specified, use `--profile staging`

### Scenario 1: Deploy Code Changes to Staging

Complete workflow from feature branch to staging deployment:

```bash
# 1. Work in feature branch worktree
cd .trees/feature-name

# 2. Fetch and rebase on parent branch
git fetch origin
git rebase origin/{{ROOT_BRANCH}}

# 3. Commit changes
git add .
git commit -m "feat: implement new feature"

# 4. Return to root and merge
cd ../..
npm run worktree:merge feature-name

# 5. Push to staging (triggers deployment)
git push origin staging

# 6. Watch GitHub Actions workflow
gh run watch --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}

# 7. Discover and monitor CloudFormation stacks from staging pipeline
# Using --profile staging because we're deploying to staging
aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[*].actions[?actionTypeId.provider==`CloudFormation`].[actionName,configuration.StackName]' \
  --output table

# 8. Monitor specific stack (use actual stack name and staging profile)
STACK_NAME=$(aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[0].actions[?actionTypeId.provider==`CloudFormation`].configuration.StackName' \
  --output text | head -1)

aws cloudformation describe-stack-events \
  --stack-name $STACK_NAME \
  --max-items 20 \
  --profile staging --region us-east-1
```

### Scenario 2: Promote Staging to Production

Deploy staging changes to production:

```bash
# 1. Merge staging into prod
git checkout prod
git merge staging --no-ff -m "chore: promote staging to production"

# 2. Push to prod (triggers production deployment)
git push origin prod

# 3. Watch GitHub Actions workflow
gh run watch --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}

# 4. Discover production CloudFormation stacks from production pipeline
# Using --profile prod because we're deploying to production
aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-prod \
  --profile prod --region us-east-1 \
  --query 'pipeline.stages[*].actions[?actionTypeId.provider==`CloudFormation`].[actionName,configuration.StackName]' \
  --output table

# 5. Monitor and verify stack outputs (use actual stack name and prod profile)
STACK_NAME=$(aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-prod \
  --profile prod --region us-east-1 \
  --query 'pipeline.stages[0].actions[?actionTypeId.provider==`CloudFormation`].configuration.StackName' \
  --output text | head -1)

aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs' \
  --output table \
  --profile prod --region us-east-1
```

### Scenario 3: Investigate Failed Deployment

When a deployment fails after git push:

```bash
# 1. Find failed GitHub workflow
gh run list --status=failure --limit 1 --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}

# 2. View failure logs
gh run view <run-id> --log --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}} | grep -i "error"

# 3. Discover and check CloudFormation stack failures
# Get stack name from staging pipeline (use --profile staging for staging environment)
STACK_NAME=$(aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[0].actions[?actionTypeId.provider==`CloudFormation`].configuration.StackName' \
  --output text | head -1)

# Check which CloudFormation resources failed
aws cloudformation describe-stack-events \
  --stack-name $STACK_NAME \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED' || ResourceStatus=='UPDATE_FAILED']" \
  --profile staging --region us-east-1

# 4. Get detailed failure reason
aws cloudformation describe-stack-events \
  --stack-name $STACK_NAME \
  --query "StackEvents[0].[LogicalResourceId,ResourceStatus,ResourceStatusReason]" \
  --output table \
  --profile staging --region us-east-1

# 5. Check GitHub Actions logs for the failing step
gh run view <run-id> --log-failed --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}
```

### Scenario 4: Monitor Multi-Stack Deployment

When deployment includes both database and infrastructure stacks:

```bash
# 1. Push to trigger deployment
git push origin staging

# 2. Watch GitHub Actions orchestrate both stacks
gh run watch --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}

# 3. Discover all stacks from staging pipeline
# Using --profile staging because we're monitoring staging deployment
aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[*].actions[?actionTypeId.provider==`CloudFormation`].[actionName,configuration.StackName]' \
  --output table

# 4. Get stack names into variables (using staging profile)
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

# 5. Monitor both stacks
aws cloudformation describe-stack-events \
  --stack-name $DB_STACK \
  --max-items 10 \
  --profile staging --region us-east-1

aws cloudformation describe-stack-events \
  --stack-name $INFRA_STACK \
  --max-items 10 \
  --profile staging --region us-east-1
```

### Scenario 5: Rollback Failed Deployment

When a deployment fails and you need to rollback:

```bash
# 1. Discover stack name from staging pipeline and check deployment status
# Using --profile staging for staging environment
STACK_NAME=$(aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[0].actions[?actionTypeId.provider==`CloudFormation`].configuration.StackName' \
  --output text | head -1)

aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query 'Stacks[0].StackStatus' \
  --profile staging --region us-east-1

# 2. If status is ROLLBACK_COMPLETE or UPDATE_ROLLBACK_COMPLETE, deployment has auto-rolled back

# 3. Revert the git commit that caused the failure
git revert HEAD

# 4. Push the revert (triggers new deployment with previous working code)
git push origin staging

# 5. Monitor the rollback deployment
gh run watch --repo {{GITHUB_USERNAME}}/{{REPOSITORY_NAME}}
```

### Quick Deployment Checklist

Before pushing to staging or prod:

- [ ] All changes committed in feature branch
- [ ] Rebased on latest staging/prod
- [ ] Merged to staging/prod with `--no-ff`
- [ ] Ready to monitor deployment (gh CLI available)
- [ ] Know which stacks will be deployed

After pushing:

- [ ] Watch GitHub Actions workflow: `gh run watch`
- [ ] Monitor CloudFormation events
- [ ] Check for failures
- [ ] Verify stack outputs after completion
- [ ] Clean up feature branch worktree if successful
