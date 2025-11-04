# CI/CD Pipeline Guide

Setting up automated deployment with AWS CodePipeline and GitHub integration.

## Table of Contents

- [Overview](#overview)
- [Pipeline Architecture](#pipeline-architecture)
- [Initial Setup](#initial-setup)
- [GitHub Integration](#github-integration)
- [Pipeline Stages](#pipeline-stages)
- [CodeBuild Projects](#codebuild-projects)
- [Deployment Process](#deployment-process)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Overview

The `devops.yml` CloudFormation template creates a complete CI/CD pipeline that:

1. Monitors GitHub repository for changes
2. Automatically triggers on push to `staging` or `prod` branches
3. Deploys database stack first
4. Deploys infrastructure stack second
5. Runs post-deployment validation

## Pipeline Architecture

```
┌──────────────┐
│   GitHub     │
│  Repository  │
└──────┬───────┘
       │ Push to staging/prod
       ▼
┌──────────────┐
│   Webhook    │
│  Triggers    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│        AWS CodePipeline                  │
├──────────────────────────────────────────┤
│                                          │
│  ┌─────────┐   ┌────┐   ┌──────────┐   │
│  │ Source  │ → │ DB │ → │  Infra   │   │
│  │ (GitHub)│   │    │   │          │   │
│  └─────────┘   └────┘   └──────────┘   │
│                   │           │         │
│              ┌────▼───────────▼────┐    │
│              │  Post-Deployment    │    │
│              │     Validation      │    │
│              └─────────────────────┘    │
└──────────────────────────────────────────┘
```

## Initial Setup

### Prerequisites

1. AWS Account with appropriate permissions
2. GitHub repository
3. GitHub Personal Access Token

### Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Select scopes:
   - `repo` (Full control of private repositories)
   - `admin:repo_hook` (Full control of repository hooks)
4. Copy the token (you won't see it again!)

### Deploy the Pipeline

```bash
# Create the pipeline stack
aws cloudformation create-stack \
  --stack-name my-app-devops-staging \
  --template-body file://devops.yml \
  --parameters \
    ParameterKey=RepositoryOwner,ParameterValue=your-github-username \
    ParameterKey=RepositoryName,ParameterValue=your-repo-name \
    ParameterKey=RepositoryBranchName,ParameterValue=staging \
    ParameterKey=GitHubSecret,ParameterValue=your-github-token \
  --capabilities CAPABILITY_IAM

# Wait for creation
aws cloudformation wait stack-create-complete \
  --stack-name my-app-devops-staging

# Repeat for production
aws cloudformation create-stack \
  --stack-name my-app-devops-prod \
  --template-body file://devops.yml \
  --parameters \
    ParameterKey=RepositoryOwner,ParameterValue=your-github-username \
    ParameterKey=RepositoryName,ParameterValue=your-repo-name \
    ParameterKey=RepositoryBranchName,ParameterValue=prod \
    ParameterKey=GitHubSecret,ParameterValue=your-github-token \
  --capabilities CAPABILITY_IAM
```

## GitHub Integration

### Webhook Registration

The pipeline automatically:
1. Creates a webhook in your GitHub repository
2. Configures it to trigger on push events
3. Filters for specific branch (staging or prod)

### Webhook Configuration

```json
{
  "url": "https://webhooks.aws.dev/trigger",
  "content_type": "json",
  "events": ["push"],
  "active": true
}
```

### Branch Filtering

The webhook only triggers when you push to the configured branch:

```bash
# Example: Triggers staging pipeline
git push origin staging

# Example: Triggers production pipeline
git push origin prod

# Does not trigger (feature branch)
git push origin feature-name
```

## Pipeline Stages

### Stage 1: Source

Fetches code from GitHub when webhook triggers.

```yaml
- Name: Source
  Actions:
    - Name: SourceAction
      ActionTypeId:
        Category: Source
        Owner: ThirdParty
        Version: "1"
        Provider: GitHub
      Configuration:
        Owner: !Ref RepositoryOwner
        Repo: !Ref RepositoryName
        Branch: !Ref RepositoryBranchName
        OAuthToken: !Ref GitHubSecret
```

**Artifacts**: Source code → `SourceOutput`

### Stage 2: Database Deployment

Deploys DynamoDB tables and other database resources.

#### Pre-Database Hook (Optional)

```yaml
- Name: PreDB
  ActionTypeId:
    Category: Build
    Provider: CodeBuild
  Configuration:
    ProjectName: !Ref PreDBBuildProject
```

Run custom commands before database deployment:
- Database migrations
- Backup existing data
- Validation checks

#### Database Deployment

```yaml
- Name: DeployDB
  ActionTypeId:
    Category: Deploy
    Provider: CloudFormation
  Configuration:
    ActionMode: CREATE_UPDATE
    StackName: !Sub "app-db-${RepositoryBranchName}"
    TemplatePath: SourceOutput::.deploy/IaC/db/db.yml
    ParameterOverrides: !Sub |
      {
        "RepositoryName": "${RepositoryName}",
        "RepositoryBranchName": "${RepositoryBranchName}"
      }
```

#### Post-Database Hook (Optional)

```yaml
- Name: PostDB
  ActionTypeId:
    Category: Build
    Provider: CodeBuild
  Configuration:
    ProjectName: !Ref PostDBBuildProject
```

Run commands after database deployment:
- Seed test data
- Create indexes
- Validate table structure

### Stage 3: Infrastructure Deployment

Deploys Lambda functions, S3 buckets, Step Functions, etc.

#### Pre-Infrastructure Hook (Optional)

```yaml
- Name: PreInfra
  ActionTypeId:
    Category: Build
    Provider: CodeBuild
  Configuration:
    ProjectName: !Ref PreInfraBuildProject
```

Tasks before infrastructure deployment:
- Run tests
- Build Lambda packages
- Validate templates

#### Infrastructure Deployment

```yaml
- Name: DeployInfra
  ActionTypeId:
    Category: Deploy
    Provider: CloudFormation
  Configuration:
    ActionMode: CREATE_UPDATE
    StackName: !Sub "app-infra-${RepositoryBranchName}"
    TemplatePath: SourceOutput::.deploy/IaC/infra/infra.yml
```

#### Post-Infrastructure Hook (Optional)

```yaml
- Name: PostInfra
  ActionTypeId:
    Category: Build
    Provider: CodeBuild
  Configuration:
    ProjectName: !Ref PostInfraBuildProject
```

Post-deployment tasks:
- Smoke tests
- Warm up Lambda functions
- Update DNS records
- Notify team

## CodeBuild Projects

### Build Specification (buildspec.yml)

Create `buildspec.yml` files for each hook:

#### Pre-Database (buildspec-pre-db.yml)

```yaml
version: 0.2

phases:
  install:
    runtime-versions:
      nodejs: 18
    commands:
      - echo "Installing dependencies..."
      - npm install

  pre_build:
    commands:
      - echo "Running database validation..."
      - npm run validate:schema

  build:
    commands:
      - echo "Pre-database checks complete"

artifacts:
  files:
    - '**/*'
```

#### Post-Database (buildspec-post-db.yml)

```yaml
version: 0.2

phases:
  build:
    commands:
      - echo "Seeding database..."
      - npm run db:seed
      - echo "Creating indexes..."
      - npm run db:indexes

  post_build:
    commands:
      - echo "Database setup complete"
```

#### Post-Infrastructure (buildspec-post-infra.yml)

```yaml
version: 0.2

phases:
  install:
    runtime-versions:
      nodejs: 18
    commands:
      - npm install

  build:
    commands:
      - echo "Running smoke tests..."
      - npm run test:smoke
      - echo "Warming up Lambda functions..."
      - npm run lambda:warmup

  post_build:
    commands:
      - echo "Deployment complete!"
      - echo "Sending notification..."
      - aws sns publish --topic-arn $SNS_TOPIC --message "Deployment successful"
```

### CodeBuild Environment Variables

Set in the buildspec or CodeBuild project:

```yaml
env:
  variables:
    ENVIRONMENT: staging
    AWS_REGION: us-east-1
  parameter-store:
    DB_PASSWORD: /app/staging/db-password
    API_KEY: /app/staging/api-key
```

## Deployment Process

### Automatic Deployment Flow

1. **Developer pushes to deployment branch** (staging or prod):

```bash
# Example for staging environment:
git checkout staging
git merge --no-ff feature-name
git push origin staging

# Example for production environment:
# git checkout prod
# git merge --no-ff staging
# git push origin prod
```

2. **GitHub webhook triggers CodePipeline**

3. **Pipeline executes**:
   - Source: Fetch code from GitHub
   - Pre-DB: Run validation scripts (if configured)
   - Deploy DB: Update DynamoDB tables
   - Post-DB: Seed data (if configured)
   - Pre-Infra: Run tests (if configured)
   - Deploy Infra: Update Lambda functions, S3, etc.
   - Post-Infra: Run smoke tests (if configured)

4. **Monitor progress**:

```bash
# View pipeline status
aws codepipeline get-pipeline-state \
  --name devops-my-app-staging

# View build logs
aws codebuild batch-get-builds \
  --ids $(aws codepipeline get-pipeline-state \
    --name devops-my-app-staging \
    --query 'stageStates[*].actionStates[*].latestExecution.externalExecutionId' \
    --output text)
```

5. **Deployment completes** (or fails with detailed logs)

### Manual Approval (Production)

For production, add manual approval:

```yaml
- Name: ApprovalStage
  Actions:
    - Name: ManualApproval
      ActionTypeId:
        Category: Approval
        Owner: AWS
        Provider: Manual
        Version: "1"
      Configuration:
        CustomData: "Please review and approve production deployment"
        NotificationArn: !Ref ApprovalSNSTopic
```

## Environment Variables

### Available in CodeBuild

```bash
# AWS provided
$AWS_DEFAULT_REGION
$AWS_ACCOUNT_ID
$CODEBUILD_BUILD_ID
$CODEBUILD_SOURCE_VERSION  # Git commit SHA

# Custom (from parameter overrides)
$REPOSITORY_NAME
$REPOSITORY_BRANCH_NAME
$ENVIRONMENT
```

### Use in Scripts

```javascript
// In npm scripts
const env = process.env.REPOSITORY_BRANCH_NAME || 'dev';
const tableName = `${env}-USERS`;
```

## Troubleshooting

### Pipeline Fails at Source Stage

**Problem**: Can't fetch from GitHub

**Solutions**:
1. Verify GitHub token is valid
2. Check token has correct permissions (repo, admin:repo_hook)
3. Verify repository name and owner are correct

```bash
# Test token
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/owner/repo
```

### Pipeline Fails at Deploy Stage

**Problem**: CloudFormation deployment error

**Check CloudFormation events**:

```bash
aws cloudformation describe-stack-events \
  --stack-name app-db-staging \
  --max-items 10
```

**Common issues**:
- Missing IAM permissions
- Resource already exists with different configuration
- Parameter validation failed

### CodeBuild Fails

**View build logs**:

```bash
aws codebuild batch-get-builds --ids YOUR_BUILD_ID
```

**Common issues**:
- Missing dependencies (add to buildspec install phase)
- Environment variables not set
- Tests failing
- Timeout (increase build timeout in CodeBuild project)

### Webhook Not Triggering

**Verify webhook exists**:

```bash
# Via AWS CLI
aws codepipeline list-webhooks

# Via GitHub
# Go to repo Settings → Webhooks
# Check recent deliveries
```

**Solutions**:
1. Delete and recreate webhook
2. Verify branch filter matches push branch
3. Check GitHub webhook delivery logs for errors

### Deployment Succeeds but Application Broken

**Check Lambda logs**:

```bash
aws logs tail /aws/lambda/staging-my-function --follow
```

**Check CloudWatch metrics**:

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=staging-my-function \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-01T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

### Rollback Deployment

```bash
# Rollback to previous version
aws cloudformation update-stack \
  --stack-name app-infra-staging \
  --use-previous-template

# Or delete and recreate with old code
aws cloudformation delete-stack --stack-name app-infra-staging
# Then redeploy from last known good commit
```

## See Also

- [AWS_INFRASTRUCTURE.md](./AWS_INFRASTRUCTURE.md) - CloudFormation templates
- [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) - Branch strategy and merging
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - More debugging tips
