# AWS Infrastructure Guide

Understanding and customizing the CloudFormation templates in your project.

## Table of Contents

- [Overview](#overview)
- [Directory Structure](#directory-structure)
- [Database Stack (db.yml)](#database-stack-dbyml)
- [Infrastructure Stack (infra.yml)](#infrastructure-stack-infrayml)
- [Parameter Files](#parameter-files)
- [Deployment](#deployment)
- [Resource Naming](#resource-naming)
- [Customization](#customization)
- [Claude Code IAM User](#claude-code-iam-user)

## Overview

The `.deploy/IaC/` directory contains AWS CloudFormation templates that define your infrastructure as code. These templates are organized into two main stacks:

1. **Database Stack** (db.yml) - DynamoDB tables
2. **Infrastructure Stack** (infra.yml) - Lambda functions, S3, Step Functions, etc.

This separation allows:
- Independent deployment and rollback
- Faster updates (only deploy what changed)
- Clear separation of concerns

## Directory Structure

```
.deploy/
└── IaC/
    ├── db/
    │   ├── db.yml                    # Database CloudFormation template
    │   └── configs/
    │       ├── db-staging.json       # Staging parameters
    │       └── db-prod.json          # Production parameters
    └── infra/
        ├── infra.yml                 # Infrastructure CloudFormation template
        └── configs/
            ├── infra-staging.json    # Staging parameters
            └── infra-prod.json       # Production parameters
```

## Database Stack (db.yml)

### Overview

The database stack defines DynamoDB tables for your application. The template includes example tables that you should customize for your project.

### Template Structure

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Transform: "AWS::Serverless-2016-10-31"

Description: >
  CloudFormation template for DynamoDB tables.

Parameters:
  RepositoryName:
    Type: String
    Description: The Git repo name.

  RepositoryBranchName:
    Type: String
    Description: Environment stage (e.g. staging, prod).

Resources:
  # Your DynamoDB tables here

Outputs:
  # Table names for other stacks to reference
```

### Example Tables

#### Simple Table (Hash Key Only)

```yaml
DEMOITEMSDynamoDBTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: !Sub "${RepositoryBranchName}-DEMO_ITEMS"
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: "ITEM_ID"
        AttributeType: "S"
    KeySchema:
      - AttributeName: "ITEM_ID"
        KeyType: "HASH"
    Tags:
      - Key: Environment
        Value: !Ref RepositoryBranchName
      - Key: Project
        Value: !Ref RepositoryName
```

#### Table with Hash and Range Key

```yaml
DEMOSESSIONSDynamoDBTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: !Sub "${RepositoryBranchName}-DEMO_SESSIONS"
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: "USER_ID"
        AttributeType: "S"
      - AttributeName: "SESSION_ID"
        AttributeType: "S"
    KeySchema:
      - AttributeName: "USER_ID"
        KeyType: "HASH"
      - AttributeName: "SESSION_ID"
        KeyType: "RANGE"
    TimeToLiveSpecification:
      Enabled: true
      AttributeName: "TTL"
```

### Customization

Replace the example tables with your actual data model:

```yaml
# Example: Users table
UsersDynamoDBTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: !Sub "${RepositoryBranchName}-USERS"
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: "USER_ID"
        AttributeType: "S"
      - AttributeName: "EMAIL"
        AttributeType: "S"
    KeySchema:
      - AttributeName: "USER_ID"
        KeyType: "HASH"
    GlobalSecondaryIndexes:
      - IndexName: "EmailIndex"
        KeySchema:
          - AttributeName: "EMAIL"
            KeyType: "HASH"
        Projection:
          ProjectionType: "ALL"
```

## Infrastructure Stack (infra.yml)

### Overview

The infrastructure stack defines Lambda functions, S3 buckets, Step Functions, and other AWS resources.

### Common Resources

#### Lambda Function

```yaml
MyLambdaFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: !Sub "${RepositoryBranchName}-my-function"
    Runtime: nodejs18.x
    Handler: index.handler
    CodeUri: ../../src/lambda/my-function/
    Environment:
      Variables:
        ENVIRONMENT: !Ref RepositoryBranchName
        TABLE_NAME: !Sub "${RepositoryBranchName}-USERS"
    Policies:
      - DynamoDBCrudPolicy:
          TableName: !Sub "${RepositoryBranchName}-USERS"
```

#### S3 Bucket

```yaml
MyBucket:
  Type: AWS::S3::Bucket
  Properties:
    BucketName: !Sub "${RepositoryBranchName}-my-app-bucket"
    VersioningConfiguration:
      Status: Enabled
    LifecycleConfiguration:
      Rules:
        - Id: DeleteOldVersions
          Status: Enabled
          NoncurrentVersionExpirationInDays: 30
```

#### Step Functions State Machine

```yaml
MyStateMachine:
  Type: AWS::Serverless::StateMachine
  Properties:
    Name: !Sub "${RepositoryBranchName}-workflow"
    DefinitionUri: ../../src/statemachine/workflow.asl.json
    DefinitionSubstitutions:
      FunctionArn: !GetAtt MyLambdaFunction.Arn
    Policies:
      - LambdaInvokePolicy:
          FunctionName: !Ref MyLambdaFunction
```

## Parameter Files

### Staging Parameters (db-staging.json)

```json
[
  {
    "ParameterKey": "RepositoryName",
    "ParameterValue": "{{REPOSITORY_NAME}}"
  },
  {
    "ParameterKey": "RepositoryBranchName",
    "ParameterValue": "staging"
  }
]
```

### Production Parameters (db-prod.json)

```json
[
  {
    "ParameterKey": "RepositoryName",
    "ParameterValue": "{{REPOSITORY_NAME}}"
  },
  {
    "ParameterKey": "RepositoryBranchName",
    "ParameterValue": "prod"
  }
]
```

The `{{REPOSITORY_NAME}}` placeholder is automatically replaced during installation.

## Deployment

### AWS Profile Selection

**IMPORTANT:** Always use the correct AWS CLI profile for your environment.

**Profile Naming Pattern:** `<repo-name>-<environment>`

Profile detection:
```bash
REPO_NAME=$(node -p "const name = require('./package.json').name; name.startsWith('@') ? name.split('/')[1] : name")
ENVIRONMENT=$(git branch --show-current)
AWS_PROFILE="${REPO_NAME}-${ENVIRONMENT}"
```

Examples:
- Repository: `bws-backoffice`, Branch: `staging` → Profile: `bws-backoffice-staging`
- Repository: `bws-api`, Branch: `prod` → Profile: `bws-api-prod`

### Manual Deployment

#### Deploy Database Stack

```bash
# Set up AWS profile
REPO_NAME=$(node -p "const name = require('./package.json').name; name.startsWith('@') ? name.split('/')[1] : name")
ENVIRONMENT=$(git branch --show-current)
AWS_PROFILE="${REPO_NAME}-${ENVIRONMENT}"

# Deploy to current environment
aws cloudformation deploy \
  --template-file .deploy/IaC/db/db.yml \
  --stack-name my-app-db-${ENVIRONMENT} \
  --parameter-overrides file://.deploy/IaC/db/configs/db-${ENVIRONMENT}.json \
  --capabilities CAPABILITY_IAM \
  --profile $AWS_PROFILE
```

#### Deploy Infrastructure Stack

```bash
# Set up AWS profile
REPO_NAME=$(node -p "const name = require('./package.json').name; name.startsWith('@') ? name.split('/')[1] : name")
ENVIRONMENT=$(git branch --show-current)
AWS_PROFILE="${REPO_NAME}-${ENVIRONMENT}"

# Deploy to current environment
aws cloudformation deploy \
  --template-file .deploy/IaC/infra/infra.yml \
  --stack-name my-app-infra-${ENVIRONMENT} \
  --parameter-overrides file://.deploy/IaC/infra/configs/infra-${ENVIRONMENT}.json \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --profile $AWS_PROFILE
```

### Automated Deployment (CI/CD)

The `devops.yml` file defines a CodePipeline that automatically deploys on git push.

See [CICD_PIPELINE.md](./CICD_PIPELINE.md) for details.

## Resource Naming

### Environment Prefixes

All resources are prefixed with the environment name:

```
staging-USERS          # Staging environment
prod-USERS             # Production environment
```

This allows:
- Multiple environments in the same AWS account
- Clear resource identification
- Safe parallel deployments

### Examples

```yaml
# DynamoDB table
staging-USERS
prod-USERS

# Lambda function
staging-process-payment
prod-process-payment

# S3 bucket
staging-my-app-cache
prod-my-app-cache

# Step Function
staging-order-workflow
prod-order-workflow
```

### LocalStack (Testing)

LocalStack uses worktree-specific prefixes:

```
main-USERS               # Main worktree
feature-auth-USERS       # feature-auth worktree
fix-bug-USERS            # fix-bug worktree
```

## Customization

### Adding a New Table

1. Edit `.deploy/IaC/db/db.yml`
2. Add resource:

```yaml
MyNewTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: !Sub "${RepositoryBranchName}-MY_NEW_TABLE"
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: "ID"
        AttributeType: "S"
    KeySchema:
      - AttributeName: "ID"
        KeyType: "HASH"
```

3. Add output:

```yaml
Outputs:
  MyNewTableName:
    Description: "Name of MY_NEW_TABLE"
    Value: !Ref MyNewTable
    Export:
      Name: !Sub "${AWS::StackName}-MyNewTable"
```

4. Deploy:

```bash
# Set up AWS profile
REPO_NAME=$(node -p "const name = require('./package.json').name; name.startsWith('@') ? name.split('/')[1] : name")
ENVIRONMENT=$(git branch --show-current)
AWS_PROFILE="${REPO_NAME}-${ENVIRONMENT}"

aws cloudformation deploy \
  --template-file .deploy/IaC/db/db.yml \
  --stack-name my-app-db-${ENVIRONMENT} \
  --parameter-overrides file://.deploy/IaC/db/configs/db-${ENVIRONMENT}.json \
  --capabilities CAPABILITY_IAM \
  --profile $AWS_PROFILE
```

### Adding a Lambda Function

1. Create Lambda code:

```bash
mkdir -p src/lambda/my-function
```

2. Edit `.deploy/IaC/infra/infra.yml`:

```yaml
MyFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: !Sub "${RepositoryBranchName}-my-function"
    Runtime: nodejs18.x
    Handler: index.handler
    CodeUri: ../../src/lambda/my-function/
```

3. Deploy:

```bash
# Set up AWS profile
REPO_NAME=$(node -p "const name = require('./package.json').name; name.startsWith('@') ? name.split('/')[1] : name")
ENVIRONMENT=$(git branch --show-current)
AWS_PROFILE="${REPO_NAME}-${ENVIRONMENT}"

aws cloudformation deploy \
  --template-file .deploy/IaC/infra/infra.yml \
  --stack-name my-app-infra-${ENVIRONMENT} \
  --parameter-overrides file://.deploy/IaC/infra/configs/infra-${ENVIRONMENT}.json \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --profile $AWS_PROFILE
```

### Using Outputs from Other Stacks

Reference database stack outputs in infrastructure stack:

```yaml
Parameters:
  UsersTableName:
    Type: String
    Default: ""
    Description: "Import from database stack"

Resources:
  MyFunction:
    Type: AWS::Serverless::Function
    Properties:
      Environment:
        Variables:
          USERS_TABLE: !Ref UsersTableName
```

Deploy with:

```bash
# Set up AWS profile
REPO_NAME=$(node -p "const name = require('./package.json').name; name.startsWith('@') ? name.split('/')[1] : name")
ENVIRONMENT=$(git branch --show-current)
AWS_PROFILE="${REPO_NAME}-${ENVIRONMENT}"

aws cloudformation deploy \
  --template-file .deploy/IaC/infra/infra.yml \
  --profile $AWS_PROFILE \
  --parameter-overrides UsersTableName=$(aws cloudformation describe-stacks \
    --stack-name my-app-db-${ENVIRONMENT} \
    --profile $AWS_PROFILE \
    --query 'Stacks[0].Outputs[?OutputKey==`UsersTableName`].OutputValue' \
    --output text)
```

## Claude Code IAM User

For read-only debugging access with Claude Code, create an IAM user with these permissions:

### IAM Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:DescribeTable",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:GetItem",
        "dynamodb:BatchGetItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetObject"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:ListFunctions",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:GetLogEvents",
        "logs:FilterLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

### Usage

```bash
# Configure AWS CLI profile for Claude Code read-only access
# Use the same profile naming pattern: <repo-name>-<environment>
REPO_NAME=$(node -p "const name = require('./package.json').name; name.startsWith('@') ? name.split('/')[1] : name")
ENVIRONMENT="staging"  # or "prod" for production
AWS_PROFILE="${REPO_NAME}-${ENVIRONMENT}"

aws configure --profile $AWS_PROFILE
AWS Access Key ID: AKIA...
AWS Secret Access Key: ...
Default region: us-east-1

# Claude Code can now read data for debugging
aws dynamodb scan --table-name ${ENVIRONMENT}-USERS --profile $AWS_PROFILE
```

## See Also

- [CICD_PIPELINE.md](./CICD_PIPELINE.md) - Automated deployment with CodePipeline
- [PARALLEL_TESTING.md](./PARALLEL_TESTING.md) - Testing with LocalStack
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common deployment issues
