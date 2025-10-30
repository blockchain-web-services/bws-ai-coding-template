# Test Suite

Comprehensive testing setup with LocalStack, Vitest, and Playwright for parallel worktree testing.

## Quick Start

### 1. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Install dependencies
npm install

# Start LocalStack
npm run docker:up

# Create AWS resources (tables, buckets)
npm run setup
```

### 2. Run Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Playwright browser tests
npm run test:playwright

# Watch mode (for development)
npm run test:watch

# With coverage
npm run test:coverage
```

## Test Structure

```
test/
├── helpers/
│   ├── worktree/          # Worktree configuration and port management
│   └── aws/               # AWS/LocalStack setup helpers
├── tests/
│   ├── unit/              # Unit tests (no external dependencies)
│   ├── integration/       # Integration tests (uses LocalStack)
│   └── playwright/        # E2E browser tests
├── docker-compose.yml     # LocalStack configuration
├── vitest.config.mjs      # Vitest test runner config
└── playwright.config.cjs  # Playwright E2E config
```

## Parallel Worktree Testing

This setup supports running tests in multiple worktrees simultaneously without port conflicts.

### How It Works

1. **MD5 Hash-Based Port Allocation**: Each worktree gets unique ports based on branch name hash
   - LocalStack: 4567-4596 (30-port range)
   - Playwright: 8080-8109 (30-port range)

2. **Docker Isolation**: Each worktree uses unique containers and networks
   - Container names: `${WORKTREE_CONTAINER_PREFIX}-localstack`
   - Network names: `${WORKTREE_NETWORK}`

3. **Environment-Specific Resources**: DynamoDB tables and S3 buckets use branch name prefix

### Port Ranges

| Service    | Main | Worktree Range |
|------------|------|----------------|
| LocalStack | 4567 | 4567-4596      |
| Playwright | 8080 | 8080-8109      |
| Debug      | 9229 | 9229-9258      |

## LocalStack

### Start/Stop

```bash
# Start LocalStack
npm run docker:up

# Stop LocalStack
npm run docker:down

# View logs
npm run docker:logs

# Complete cleanup (removes volumes)
npm run docker:clean
```

### Available Services

- DynamoDB
- S3
- Lambda
- Step Functions
- IAM
- STS
- EventBridge

### Accessing LocalStack

- **Endpoint**: `http://localhost:${LOCALSTACK_PORT}` (default: 4567)
- **AWS CLI**: Use `--endpoint-url http://localhost:4567`
- **Dashboard**: http://localhost:4567/_localstack/health

## Writing Tests

### Unit Test Example

```javascript
// tests/unit/example.test.mjs
import { describe, it, expect } from 'vitest';

describe('Example Unit Test', () => {
    it('should pass', () => {
        expect(true).toBe(true);
    });
});
```

### Integration Test Example

```javascript
// tests/integration/dynamodb-example.test.mjs
import { describe, it, expect } from 'vitest';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDBClient({
    endpoint: process.env.AWS_ENDPOINT_URL,
    region: 'us-east-1',
    credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
    }
});

describe('DynamoDB Integration', () => {
    it('should write to DynamoDB', async () => {
        const result = await dynamodb.send(new PutItemCommand({
            TableName: `${process.env.TABLE_PREFIX}-DEMO_ITEMS`,
            Item: {
                ITEM_ID: { S: 'test-1' },
                name: { S: 'Test Item' }
            }
        }));

        expect(result.$metadata.httpStatusCode).toBe(200);
    });
});
```

### Playwright Test Example

```javascript
// tests/playwright/example.spec.js
import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Home/);
});
```

## Worktree Workflow

When working in a worktree, the test environment is automatically isolated:

```bash
# From root: create worktree
npm run worktree:create feature-name

# In worktree: install and run tests
cd .trees/feature-name/test
npm install
npm run docker:up
npm run setup
npm test
```

Each worktree maintains:
- Unique LocalStack port
- Unique Docker containers
- Separate DynamoDB tables
- Isolated S3 buckets

## Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
lsof -i :4567

# Or use a different port in .env
LOCALSTACK_PORT=4568
```

### LocalStack Not Starting

```bash
# Check Docker is running
docker ps

# View LocalStack logs
npm run docker:logs

# Restart LocalStack
npm run docker:down && npm run docker:up
```

### Tests Connecting to Real AWS

Make sure `AWS_ENDPOINT_URL` is set:

```bash
echo $AWS_ENDPOINT_URL
# Should show: http://localhost:4567
```

### Clean Start

```bash
# Complete cleanup and restart
npm run docker:clean
npm run docker:up
npm run setup
npm test
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOCALSTACK_PORT` | LocalStack port | 4567 |
| `PLAYWRIGHT_PORT` | Test server port | 8080 |
| `ENVIRONMENT` | Environment name | local-tests |
| `TABLE_PREFIX` | DynamoDB table prefix | local-tests |
| `S3_BUCKET_NAME` | S3 bucket name | local-tests-app-cache |
| `AWS_ENDPOINT_URL` | LocalStack endpoint | http://localhost:4567 |

## CI/CD Integration

```yaml
# Example GitHub Actions workflow
- name: Setup LocalStack
  run: |
    cd test
    npm install
    npm run docker:up

- name: Run Tests
  run: |
    cd test
    npm run setup
    npm test
```

## References

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [LocalStack Documentation](https://docs.localstack.cloud/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
