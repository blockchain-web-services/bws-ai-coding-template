# Parallel Testing Guide

How to run tests in multiple worktrees simultaneously without port conflicts.

## Table of Contents

- [Overview](#overview)
- [MD5 Hash-Based Port Allocation](#md5-hash-based-port-allocation)
- [Docker Container Isolation](#docker-container-isolation)
- [LocalStack Setup](#localstack-setup)
- [Running Tests](#running-tests)
- [Environment Variables](#environment-variables)
- [Parallel Testing Examples](#parallel-testing-examples)
- [Troubleshooting](#troubleshooting)

## Overview

This project supports **parallel testing** across multiple git worktrees. Each worktree gets:

- Unique ports (LocalStack, Playwright, Debug)
- Isolated Docker containers
- Separate AWS resources (DynamoDB tables, S3 buckets)
- Independent test environments

### Key Benefits

1. **No Port Conflicts**: Test multiple branches simultaneously
2. **Reproducible**: Same branch always gets same ports
3. **Isolated**: Changes in one worktree don't affect others
4. **Fast**: Run tests in parallel to save time

## MD5 Hash-Based Port Allocation

### How It Works

Each worktree gets unique ports based on its branch name:

```javascript
// Simplified algorithm
const hash = crypto.createHash('md5').update(branchName).digest();
const offset = (hash[0] + hash[1]) % 30;

const ports = {
    localstack: 4567 + offset,  // Range: 4567-4596
    playwright: 8080 + offset,  // Range: 8080-8109
    debug: 9229 + offset        // Range: 9229-9258
};
```

### Port Ranges

| Service     | Base Port | Range      | Total Slots |
|-------------|-----------|------------|-------------|
| LocalStack  | 4567      | 4567-4596  | 30          |
| Playwright  | 8080      | 8080-8109  | 30          |
| Debug       | 9229      | 9229-9258  | 30          |

### Deterministic Assignment

The same branch name always gets the same ports:

```bash
# First time
npm run worktree:create feature-auth
# LocalStack: 4579, Playwright: 8092

# Remove and recreate
npm run worktree:remove feature-auth
npm run worktree:create feature-auth
# LocalStack: 4579, Playwright: 8092 (same!)
```

### Examples

```bash
# main branch
main          → LocalStack: 4567, Playwright: 8080

# Feature branches
feature-auth  → LocalStack: 4579, Playwright: 8092 (offset: 12)
feature-pay   → LocalStack: 4581, Playwright: 8094 (offset: 14)
fix-bug-123   → LocalStack: 4573, Playwright: 8086 (offset: 6)
```

### Collision Handling

With 30 slots, collisions are rare but possible:

```bash
# If two branches hash to same offset
feature-a → offset: 10
feature-b → offset: 10

# Solution: Rename one branch
npm run worktree:remove feature-b
npm run worktree:create feature-b-payment
# Likely gets different offset
```

## Docker Container Isolation

### Container Naming

Each worktree gets unique Docker container names:

```javascript
const containerPrefix = `app-${branchName}`;

// Examples
main          → app-main-localstack
feature-auth  → app-feature-auth-localstack
fix-bug       → app-fix-bug-localstack
```

### Network Isolation

Each worktree has its own Docker network:

```javascript
const networkName = `app-network-${branchName}`;

// Examples
main          → app-network-main
feature-auth  → app-network-feature-auth
```

### Volume Isolation

Persistent data is isolated per worktree:

```javascript
const volumePrefix = `app-volume-${branchName}`;
```

### Docker Compose Configuration

The worktree automatically generates `docker-compose.worktree.yml`:

```yaml
version: '3.8'

services:
  localstack:
    image: localstack/localstack
    container_name: app-feature-auth-localstack
    ports:
      - "4579:4566"  # Unique port
    networks:
      - app-network-feature-auth
    environment:
      - SERVICES=dynamodb,s3,lambda
      - DATA_DIR=/tmp/localstack/data

networks:
  app-network-feature-auth:
    driver: bridge
```

## LocalStack Setup

### What is LocalStack?

LocalStack emulates AWS services locally for testing:
- DynamoDB
- S3
- Lambda
- Step Functions
- And more...

### Starting LocalStack

```bash
cd test
npm run docker:up
```

This starts LocalStack on your worktree's unique port.

### Creating Resources

```bash
npm run setup
```

This creates AWS resources (tables, buckets) in LocalStack with worktree-specific names:

```bash
# Main worktree
Tables: main-DEMO_USERS, main-DEMO_ITEMS
Buckets: main-app-cache

# Feature worktree
Tables: feature-auth-DEMO_USERS, feature-auth-DEMO_ITEMS
Buckets: feature-auth-app-cache
```

### Accessing LocalStack

```bash
# Use AWS CLI with custom endpoint
aws --endpoint-url=http://localhost:4579 dynamodb list-tables

# Or use environment variable
export AWS_ENDPOINT_URL=http://localhost:4579
aws dynamodb list-tables
```

## Running Tests

### Basic Test Run

```bash
cd test
npm test
```

### Test Types

The test suite includes:

1. **Unit Tests**: No external dependencies
2. **Integration Tests**: Uses LocalStack for AWS services
3. **E2E Tests**: Uses Playwright for full system testing

### Running Specific Tests

```bash
# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run only E2E tests
npm run test:e2e

# Run specific test file
npm test -- tests/integration/users.test.mjs
```

### Parallel Test Execution

```bash
# Terminal 1 - main branch
cd test
npm run docker:up
npm test

# Terminal 2 - feature branch (simultaneously)
cd .trees/feature-auth/test
npm run docker:up  # Uses different port!
npm test
```

Both test suites run in complete isolation.

## Environment Variables

### Automatically Set Variables

When you create a worktree, these environment variables are configured:

```bash
# Ports
LOCALSTACK_PORT=4579
PLAYWRIGHT_PORT=8092
PORT=8092
DEBUG_PORT=9241

# Docker
WORKTREE_BRANCH=feature-auth
WORKTREE_SAFE_NAME=feature-auth
WORKTREE_CONTAINER_PREFIX=app-feature-auth
WORKTREE_NETWORK=app-network-feature-auth
COMPOSE_PROJECT_NAME=app-feature-auth

# AWS (LocalStack)
AWS_ENDPOINT_URL=http://localhost:4579
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
NODE_ENV=test
ENVIRONMENT=feature-auth
TABLE_PREFIX=feature-auth
S3_BUCKET_NAME=feature-auth-app-cache

# Worktree markers
IS_WORKTREE=true
WORKTREE_NAME=feature-auth
```

### Loading Environment

Environment is loaded automatically by test helpers:

```javascript
// test/helpers/worktree/env-loader.mjs
import { loadWorktreeEnvironment } from './helpers/worktree/env-loader.mjs';

// In test setup
await loadWorktreeEnvironment();
```

### Custom Environment Variables

Add custom variables to `.env.worktree`:

```bash
# test/.env.worktree
MY_CUSTOM_VAR=value
```

## Parallel Testing Examples

### Example 1: Two Feature Branches

```bash
# Terminal 1: Feature A
cd .trees/feature-user-auth
cd test
npm install
npm run docker:up     # Port 4579
npm run setup
npm test              # Tests run on port 8092

# Terminal 2: Feature B (simultaneously)
cd .trees/feature-payment
cd test
npm install
npm run docker:up     # Port 4581 (different!)
npm run setup
npm test              # Tests run on port 8094 (different!)
```

No conflicts! Both test suites run in parallel.

### Example 2: Testing While Developing

```bash
# Terminal 1: Active development
cd .trees/feature-complex
# ... coding ...

# Terminal 2: Run tests in watch mode
cd .trees/feature-complex/test
npm run test:watch

# Terminal 3: Test main branch (verify no regression)
cd test
npm run docker:up
npm test
```

### Example 3: CI/CD Simulation

```bash
# Test multiple branches in parallel
npm run worktree:create staging
npm run worktree:create prod-candidate
npm run worktree:create hotfix

# Run tests in all three (different terminals or scripts)
cd .trees/staging/test && npm test &
cd .trees/prod-candidate/test && npm test &
cd .trees/hotfix/test && npm test &
wait
```

## Troubleshooting

### Port Already in Use

```bash
# Error: Port 4567 already in use
```

**Check what's using the port**:

```bash
lsof -i :4567
# Or
netstat -tuln | grep 4567
```

**Solutions**:
1. Stop the conflicting process
2. Remove old worktree: `npm run worktree:remove old-branch`
3. Stop old containers: `docker stop app-old-branch-localstack`

### LocalStack Not Starting

```bash
# Error: LocalStack failed to start
```

**Check Docker**:

```bash
docker ps
docker logs app-feature-auth-localstack
```

**Solutions**:
1. Restart Docker daemon
2. Pull latest LocalStack: `docker pull localstack/localstack`
3. Clean up old containers: `npm run docker:down && npm run docker:up`

### Test Resources Not Found

```bash
# Error: Table does not exist
```

**Solution**: Run setup to create resources:

```bash
npm run setup
```

### Tests Pass in Main but Fail in Worktree

**Check environment**:

```bash
# Compare environment variables
cat test/.env.worktree
env | grep LOCALSTACK_PORT
```

**Solution**: Ensure test setup runs in worktree:

```bash
cd test
npm install  # May need worktree-specific deps
npm run setup
npm test
```

### Docker Network Conflicts

```bash
# Error: Network already exists
```

**Solution**: Clean up Docker networks:

```bash
docker network prune
npm run docker:down
npm run docker:up
```

### Out of Port Slots

If you have more than 30 worktrees (rare), you'll run out of unique ports.

**Solution**: Remove unused worktrees:

```bash
npm run worktree:list
npm run worktree:remove old-branch-1
npm run worktree:remove old-branch-2
```

## Performance Tips

### 1. Reuse Containers

Don't stop/start LocalStack unnecessarily:

```bash
# Keep running between test runs
npm run docker:up   # Start once
npm test            # Run tests multiple times
```

### 2. Parallel Test Execution

Use test runner parallelization:

```bash
# vitest runs tests in parallel by default
npm test -- --threads=4
```

### 3. Selective Testing

Only run changed tests:

```bash
npm test -- --changed
```

### 4. Cache Dependencies

Share node_modules between worktrees:

```bash
# In main worktree
cd test && npm install

# Worktrees can reuse (if compatible)
# Otherwise install separately
```

## See Also

- [WORKTREES.md](./WORKTREES.md) - Complete worktree workflow
- [AWS_INFRASTRUCTURE.md](./AWS_INFRASTRUCTURE.md) - LocalStack resource setup
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - More debugging tips
