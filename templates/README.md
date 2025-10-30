# Project Template with Worktrees & Parallel Testing

A comprehensive GitHub template for Node.js projects that includes:

- **Git Worktree Management**: Create isolated development environments for parallel feature work
- **Parallel Testing Infrastructure**: Run tests simultaneously across multiple worktrees with port isolation
- **AWS Infrastructure**: CloudFormation templates for DynamoDB, Lambda, S3, and CI/CD pipelines
- **Migration Script**: Easily add this system to existing projects

## Features

### 1. Worktree Management System

Work on multiple features simultaneously without branch switching:

```bash
# Create a new worktree for a feature
npm run worktree:create feature-name

# List all worktrees
npm run worktree:list

# Merge worktree back to main branch
npm run worktree:merge feature-name

# Remove a worktree
npm run worktree:remove feature-name
```

Each worktree gets:
- Isolated working directory
- Unique Docker containers and ports
- Separate test environment
- Independent AWS resource naming

### 2. Parallel Testing with Port Isolation

Run tests across multiple worktrees simultaneously without conflicts:

- **MD5 Hash-Based Port Allocation**: Deterministic port assignment (same branch = same ports)
- **Docker Container Isolation**: Unique containers, networks, and volumes per worktree
- **LocalStack Integration**: Local AWS emulation for DynamoDB, S3, Lambda, Step Functions
- **Playwright Support**: E2E browser testing with isolated test servers

Port Ranges (30 ports each):
- LocalStack: 4567-4596
- Playwright: 8080-8109
- Debug: 9229-9258

### 3. AWS Infrastructure as Code

CloudFormation templates for complete AWS setup:

- **Database Layer** (`db.yml`): DynamoDB tables with environment-specific naming
- **Infrastructure Layer** (`infra.yml`): Lambda functions, S3 buckets, Step Functions
- **CI/CD Pipeline** (`devops.yml`): CodePipeline, CodeBuild, GitHub integration
- **Claude Code IAM User**: Read-only debugging access for AI assistant

### 4. Git Workflow Best Practices

Built-in rules for clean Git history:

- Always rebase before committing
- Use `--no-ff` for all merges to preserve branch history
- Automatic push to origin after merge (with `--no-push` flag to disable)
- Worktree-specific files automatically excluded from merges

## Quick Start

### For New Projects

1. **Use this template** to create a new repository on GitHub

2. **Clone and install dependencies**:
```bash
git clone <your-repo-url>
cd <your-repo>
npm install
```

3. **Customize for your project**:
   - Update `package.json` with your project name
   - Modify `.deploy/IaC/db/db.yml` with your DynamoDB tables
   - Add your Lambda functions to `.deploy/IaC/infra/infra.yml`

4. **Start developing with worktrees**:
```bash
npm run worktree:create my-feature
cd .trees/my-feature
npm install
cd test && npm install
```

### For Existing Projects

Use the migration script to add this system to your existing project:

```bash
# Download and run the migration script
npx @your-org/migrate-to-template

# Or manually copy and run
node migrate-to-template.mjs
```

The script will:
- Copy worktree management scripts
- Set up parallel testing infrastructure
- Add AWS CloudFormation templates (optional)
- Update package.json with npm scripts
- Append Git workflow rules to CLAUDE.md (if exists)

## Project Structure

```
.
├── scripts/
│   └── worktree/              # Worktree management scripts
│       ├── create-worktree.mjs
│       ├── merge-worktree.mjs
│       ├── remove-worktree.mjs
│       └── list-worktrees.mjs
│
├── test/                      # Parallel testing infrastructure
│   ├── helpers/
│   │   ├── worktree/         # Port allocation and Docker isolation
│   │   └── aws/              # LocalStack setup helpers
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── playwright/
│   └── docker-compose.yml
│
├── .deploy/                   # AWS Infrastructure as Code
│   └── IaC/
│       ├── db/               # DynamoDB tables
│       ├── infra/            # Lambda, S3, Step Functions
│       └── devops.yml        # CI/CD pipeline
│
└── docs/                      # Comprehensive documentation
    ├── WORKTREES.md
    ├── GIT_WORKFLOW.md
    ├── PARALLEL_TESTING.md
    └── AWS_INFRASTRUCTURE.md
```

## Documentation

- [Worktree Management Guide](docs/WORKTREES.md) - Complete worktree workflow
- [Git Workflow Rules](docs/GIT_WORKFLOW.md) - Rebase, commit, merge best practices
- [Parallel Testing Setup](docs/PARALLEL_TESTING.md) - LocalStack, Docker, port isolation
- [AWS Infrastructure](docs/AWS_INFRASTRUCTURE.md) - CloudFormation templates explained
- [CI/CD Pipeline](docs/CICD_PIPELINE.md) - CodePipeline and CodeBuild setup
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Claude Instructions](docs/CLAUDE_INSTRUCTIONS.md) - AI assistant integration

## Requirements

- **Node.js**: 20.x or later
- **Docker**: For LocalStack and parallel testing
- **Git**: 2.5+ (for worktree support)
- **AWS CLI**: For debugging and deployment (optional)
- **npm**: 9.x or later

## NPM Scripts

### Worktree Management
```bash
npm run worktree:create <branch-name>   # Create new worktree
npm run worktree:list                   # List all worktrees
npm run worktree:merge <branch-name>    # Merge worktree to current branch
npm run worktree:remove <branch-name>   # Remove worktree
```

### Testing
```bash
npm run docker:up           # Start LocalStack
npm run setup               # Create AWS resources in LocalStack
npm test                    # Run all tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:playwright     # Browser tests only
npm run docker:down         # Stop LocalStack
npm run docker:clean        # Remove containers and volumes
```

### Deployment
```bash
npm run deploy:staging      # Deploy to staging environment
npm run deploy:prod         # Deploy to production environment
```

## Contributing

1. Create a worktree for your feature: `npm run worktree:create feature-name`
2. Make your changes in `.trees/feature-name/`
3. Run tests: `cd .trees/feature-name/test && npm test`
4. Merge back to main: `npm run worktree:merge feature-name`

## License

MIT

## Support

For issues, questions, or contributions, please visit [GitHub Issues](https://github.com/your-org/your-repo/issues).
