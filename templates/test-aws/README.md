# AWS Test Infrastructure

This directory contains AWS-specific test infrastructure using LocalStack for local AWS service emulation.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+

## Setup

1. Install dependencies:
```bash
cd test
npm install
```

2. Start LocalStack:
```bash
npm run docker:up
```

3. Set up AWS infrastructure (DynamoDB tables, S3 buckets, etc.):
```bash
npm run setup:aws
```

## Running AWS Tests

```bash
# Run all tests (unit + integration)
npm test

# Run integration tests only (requires LocalStack)
npm run test:integration

# Run unit tests only
npm run test:unit

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Complete Test Suite

Run everything (LocalStack + setup + all tests):
```bash
npm run test:all
```

## Docker Commands

```bash
# Start LocalStack
npm run docker:up

# Stop LocalStack
npm run docker:down

# View logs
npm run docker:logs

# Clean up (removes volumes)
npm run docker:clean
```

## Environment Configuration

The test infrastructure uses `.env` files for configuration:

- `.env` - Main environment file (gitignored)
- `.env.example` - Template with all variables

Copy `.env.example` to `.env` and customize as needed.

## AWS Services

LocalStack provides the following AWS services:

- **DynamoDB** - NoSQL database
- **S3** - Object storage
- **Lambda** - Serverless functions
- **Step Functions** - Workflow orchestration

See `helpers/aws/setup-infrastructure.mjs` for table/bucket creation.

## Worktree Configuration

Each worktree gets unique ports for LocalStack to avoid conflicts:

- Main branch: Port 4567
- Feature branches: Port 4567 + MD5 offset

See `helpers/worktree/config-generator.mjs` for details.

## Test Structure

```
test/
├── helpers/
│   ├── aws/              # AWS infrastructure helpers
│   └── worktree/         # Worktree-specific configuration
├── tests/
│   ├── integration/      # AWS integration tests
│   └── unit/             # Unit tests (no AWS)
├── docker-compose.yml    # LocalStack configuration
├── vitest.config.mjs     # Vitest configuration
└── vitest.setup.mjs      # Test setup
```

## Troubleshooting

### LocalStack won't start

```bash
# Clean up and restart
npm run docker:clean
npm run docker:up
```

### Port conflicts

Each worktree uses different ports. Check `helpers/worktree/config-generator.mjs` for your branch's port.

### AWS SDK errors

Ensure LocalStack is running:
```bash
npm run docker:logs
```

## Related Documentation

- [LocalStack Documentation](https://docs.localstack.cloud/)
- [Vitest Documentation](https://vitest.dev/)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/)
