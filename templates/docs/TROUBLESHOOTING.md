# Troubleshooting Guide

Common issues and solutions when working with worktrees and testing infrastructure.

## Table of Contents

- [Worktree Issues](#worktree-issues)
- [Port Conflicts](#port-conflicts)
- [Docker Issues](#docker-issues)
- [LocalStack Problems](#localstack-problems)
- [Git Issues](#git-issues)
- [Test Failures](#test-failures)
- [AWS/CloudFormation Issues](#awscloudformation-issues)
- [General Tips](#general-tips)

## Worktree Issues

### Cannot Create Worktree: Already Exists

```bash
Error: Worktree already exists at .trees/feature-name
```

**Cause**: Worktree directory wasn't properly cleaned up.

**Solution**:

```bash
# Option 1: Remove with script
npm run worktree:remove feature-name

# Option 2: Manual cleanup
git worktree remove .trees/feature-name --force
rm -rf .trees/feature-name

# Option 3: Prune orphaned worktrees
git worktree prune
```

### Cannot Remove Worktree: Uncommitted Changes

```bash
Error: Worktree has uncommitted changes
```

**Solution**:

```bash
# View changes
cd .trees/feature-name
git status

# Option 1: Commit changes
git add .
git commit -m "Save work"

# Option 2: Stash changes
git stash

# Option 3: Discard changes (careful!)
git reset --hard HEAD

# Then remove
cd ../..
npm run worktree:remove feature-name
```

### Worktree is Locked

```bash
Error: Worktree is locked
```

**Cause**: Git crashed or was force-killed while using the worktree.

**Solution**:

```bash
# Remove lock file
rm -f .git/worktrees/feature-name/locked

# If that doesn't work, prune and recreate
git worktree prune
npm run worktree:create feature-name
```

### Cannot Switch Branches in Worktree

```bash
fatal: 'feature-name' is already checked out at '.trees/feature-name'
```

**Cause**: A branch can only be checked out in one place at a time.

**Solution**: This is expected behavior. Each branch should have its own worktree. If you need to work on a branch that's already checked out, use that worktree or remove it first.

## Port Conflicts

### Port Already in Use

```bash
Error: Port 4567 already in use
Error: Port 8080 already in use
```

**Cause**: Another process or worktree is using the port.

**Diagnose**:

```bash
# Check what's using the port
lsof -i :4567
# Or
netstat -tuln | grep 4567
# Or
ss -tuln | grep 4567
```

**Solutions**:

```bash
# Option 1: Kill the process
kill <PID>

# Option 2: Stop old Docker containers
docker ps
docker stop app-old-branch-localstack

# Option 3: Stop all LocalStack containers
docker stop $(docker ps -q --filter ancestor=localstack/localstack)

# Option 4: Remove the worktree using that port
npm run worktree:list
npm run worktree:remove old-branch
```

### Port Randomly Assigned to Different Number

**Cause**: You're testing port allocation logic or recreated a worktree with a different name.

**Remember**: Port assignment is based on branch name hash. Same name = same port.

```bash
# These always get the same ports
npm run worktree:create feature-auth  # Port 4579
npm run worktree:remove feature-auth
npm run worktree:create feature-auth  # Port 4579 again

# Different name = different port
npm run worktree:create feature-authentication  # Port 4583 (different!)
```

### All Ports Exhausted (Rare)

**Cause**: More than 30 active worktrees (very rare).

**Solution**: Clean up old worktrees:

```bash
npm run worktree:list
npm run worktree:remove old-1
npm run worktree:remove old-2
npm run worktree:remove old-3
```

## Docker Issues

### Docker Daemon Not Running

```bash
Error: Cannot connect to Docker daemon
```

**Solution**:

```bash
# Start Docker Desktop (Mac/Windows)
# Or start Docker service (Linux)
sudo systemctl start docker

# Verify
docker ps
```

### Container Name Conflict

```bash
Error: Container name 'app-feature-name-localstack' already in use
```

**Cause**: Previous container wasn't removed.

**Solution**:

```bash
# Stop and remove container
docker stop app-feature-name-localstack
docker rm app-feature-name-localstack

# Or use docker-compose
cd test
npm run docker:down
npm run docker:up
```

### Cannot Pull LocalStack Image

```bash
Error: Unable to pull localstack/localstack image
```

**Solution**:

```bash
# Check Docker Hub connection
docker pull hello-world

# Pull LocalStack manually
docker pull localstack/localstack:latest

# If behind proxy, configure Docker proxy
# Edit ~/.docker/config.json or Docker Desktop settings
```

### Container Exits Immediately

```bash
Error: LocalStack container keeps exiting
```

**Diagnose**:

```bash
# Check container logs
docker logs app-feature-name-localstack

# Check if port is already in use
lsof -i :4567
```

**Solution**:

```bash
# Stop conflicting services
# Restart with fresh container
npm run docker:down
npm run docker:up
```

### Permission Denied

```bash
Error: Permission denied while connecting to Docker daemon socket
```

**Solution (Linux)**:

```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and log back in, or:
newgrp docker

# Verify
docker ps
```

## LocalStack Problems

### LocalStack Services Not Starting

```bash
Error: Service DynamoDB not available
```

**Diagnose**:

```bash
# Check LocalStack logs
docker logs app-main-localstack

# Check LocalStack health
curl http://localhost:4567/_localstack/health
```

**Solution**:

```bash
# Restart LocalStack
cd test
npm run docker:down
npm run docker:up

# Wait for services to start (can take 30-60 seconds)
sleep 30

# Verify services are ready
aws --endpoint-url=http://localhost:4567 dynamodb list-tables
```

### Cannot Create DynamoDB Table

```bash
Error: ResourceInUseException: Table already exists
```

**Cause**: Table wasn't cleaned up from previous run.

**Solution**:

```bash
# Delete old table
aws --endpoint-url=http://localhost:4567 dynamodb delete-table \
  --table-name feature-name-USERS

# Or restart LocalStack (clears all data)
npm run docker:down
npm run docker:up
npm run setup
```

### Connection Timeout

```bash
Error: Could not connect to LocalStack endpoint
```

**Diagnose**:

```bash
# Check if LocalStack is running
docker ps | grep localstack

# Check if port is correct
echo $LOCALSTACK_PORT
echo $AWS_ENDPOINT_URL

# Try connecting
curl http://localhost:4567/_localstack/health
```

**Solution**:

```bash
# Verify environment variables
cat test/.env.worktree

# Restart LocalStack
npm run docker:down
npm run docker:up
```

### LocalStack Data Persisted Between Runs

**Cause**: LocalStack volumes not being cleaned up.

**Solution**:

```bash
# Remove volumes when stopping
docker-compose down -v

# Or manually remove volumes
docker volume ls
docker volume rm app-feature-name-volume-localstack
```

## Git Issues

### Detached HEAD State

```bash
Warning: You are in 'detached HEAD' state
```

**Cause**: Checked out a specific commit instead of a branch.

**Solution**:

```bash
# Create branch from current state
git checkout -b recovery-branch

# Or go back to a known branch
git checkout main
```

### Merge Conflicts

```bash
CONFLICT (content): Merge conflict in file.js
```

**Solution**: See [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) for detailed conflict resolution steps.

Quick fix:

```bash
# 1. Edit conflicting files
vim file.js

# 2. Remove conflict markers (<<<<<<<, =======, >>>>>>>)
# 3. Keep the code you want

# 4. Mark as resolved
git add file.js

# 5. Continue operation
git merge --continue
# or
git rebase --continue
```

### Cannot Push: Branch Diverged

```bash
Error: Updates were rejected because the tip of your current branch is behind
```

**Solution**:

```bash
# Rebase onto remote branch
git fetch origin
git rebase origin/{{ROOT_BRANCH}}

# Resolve conflicts if any
# Then push
git push origin feature-name
```

### Accidentally Deleted Branch

**Solution**:

```bash
# Find the commit SHA
git reflog

# Recreate branch
git checkout -b feature-name <commit-sha>
```

## Test Failures

### Tests Pass Locally but Fail in Worktree

**Cause**: Environment differences.

**Diagnose**:

```bash
# Compare environments
cd test
cat .env.worktree

# Check ports
echo $LOCALSTACK_PORT
```

**Solution**:

```bash
# Ensure LocalStack is running
npm run docker:up

# Recreate resources
npm run setup

# Install dependencies (might differ)
npm install

# Run tests
npm test
```

### Tests Timeout

```bash
Error: Timeout of 5000ms exceeded
```

**Cause**: LocalStack not responding or slow startup.

**Solution**:

```bash
# Increase timeout in test files
// vitest.config.mjs
export default {
  testTimeout: 30000  // 30 seconds
};

# Or wait for LocalStack to fully start
sleep 30
npm test
```

### Cannot Find Table/Resource

```bash
Error: ResourceNotFoundException: Requested resource not found
```

**Cause**: Resources not created in LocalStack.

**Solution**:

```bash
# Run setup script
npm run setup

# Verify resources exist
aws --endpoint-url=http://localhost:4567 dynamodb list-tables
```

### Tests Interfere with Each Other

**Cause**: Tests not cleaning up data.

**Solution**: Add cleanup in test hooks:

```javascript
// In test files
import { beforeEach, afterEach } from 'vitest';

beforeEach(async () => {
  // Clean state before each test
  await clearDatabase();
});

afterEach(async () => {
  // Clean up after test
  await clearDatabase();
});
```

## AWS/CloudFormation Issues

### Stack Creation Failed

```bash
Error: Stack creation failed
```

**Diagnose**:

```bash
# View stack events
aws cloudformation describe-stack-events \
  --stack-name my-stack \
  --max-items 20

# Check specific resource failure
aws cloudformation describe-stack-resources \
  --stack-name my-stack
```

**Common causes**:
- IAM permissions missing
- Resource limits exceeded
- Invalid template syntax
- Parameter validation failed

### Resource Already Exists

```bash
Error: Resource already exists
```

**Solution**:

```bash
# Option 1: Delete existing resource manually
# Then retry stack creation

# Option 2: Import existing resource into stack
aws cloudformation import-stack-resources ...

# Option 3: Delete stack and recreate
aws cloudformation delete-stack --stack-name my-stack
aws cloudformation wait stack-delete-complete --stack-name my-stack
# Then create again
```

### Stack Stuck in UPDATE_ROLLBACK_FAILED

**Solution**:

```bash
# Continue rollback
aws cloudformation continue-update-rollback \
  --stack-name my-stack

# If that fails, delete and recreate
aws cloudformation delete-stack --stack-name my-stack
```

## General Tips

### Enable Debug Logging

```bash
# Git debug
GIT_TRACE=1 git worktree list

# Docker debug
docker run --rm -e DEBUG=1 localstack/localstack

# AWS CLI debug
aws dynamodb list-tables --debug

# Node.js debug
NODE_DEBUG=* npm test
```

### Clean Slate Reset

When everything is broken and you want to start fresh:

```bash
# 1. Stop all Docker containers
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)

# 2. Remove all worktrees
git worktree list
npm run worktree:remove feature-1
npm run worktree:remove feature-2
# ... repeat for all

# 3. Prune Git worktrees
git worktree prune

# 4. Clear Docker volumes
docker volume prune -f

# 5. Reinstall dependencies
npm install
cd test && npm install

# 6. Start fresh
npm run worktree:create new-feature
```

### Check System Resources

```bash
# Disk space
df -h

# Memory
free -h

# Docker resources
docker system df

# Clean up Docker
docker system prune -a --volumes
```

### Getting Help

1. **Check logs first**:
   - Git: `git worktree list`, `git status`
   - Docker: `docker logs <container-name>`
   - LocalStack: `curl http://localhost:4567/_localstack/health`
   - CloudFormation: `aws cloudformation describe-stack-events`

2. **Search documentation**:
   - [WORKTREES.md](./WORKTREES.md)
   - [PARALLEL_TESTING.md](./PARALLEL_TESTING.md)
   - [GIT_WORKFLOW.md](./GIT_WORKFLOW.md)
   - [AWS_INFRASTRUCTURE.md](./AWS_INFRASTRUCTURE.md)

3. **Common patterns**:
   - Most issues are due to: stale state, port conflicts, or missing resources
   - Solution usually involves: restarting Docker, recreating resources, or removing old worktrees

## See Also

- [WORKTREES.md](./WORKTREES.md) - Worktree workflow guide
- [PARALLEL_TESTING.md](./PARALLEL_TESTING.md) - Testing setup and configuration
- [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) - Git best practices
- [AWS_INFRASTRUCTURE.md](./AWS_INFRASTRUCTURE.md) - CloudFormation templates
- [CICD_PIPELINE.md](./CICD_PIPELINE.md) - CI/CD pipeline setup
