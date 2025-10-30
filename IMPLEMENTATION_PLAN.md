# Implementation Plan for bws-ai-coding-template

## Current Status

✅ **Completed:**
- Repository created: https://github.com/blockchain-web-services/bws-ai-coding-template
- Template files moved from bws-api-telegram-xbot
- NPM package structure created (bin/, lib/, templates/)
- Initial package.json configured
- Stub files created for CLI components

## Project Overview

This is an NPM package that adds worktree management and parallel testing infrastructure to any Node.js project.

**Package Name**: `@blockchain-web-services/bws-ai-coding-template`

**CLI Commands**:
- `npx @blockchain-web-services/bws-ai-coding-template` (recommended)
- `worktree-init` (if installed globally)

---

## Remaining Work

### 1. CLI Implementation (Priority: HIGH)

#### bin/init.js
- [x] Created with basic structure
- [ ] Add command-line argument parsing (--dry-run, --skip-aws, --skip-test)
- [ ] Add error handling and graceful exit

#### lib/cli.js
**Current Status**: Stub created with TODO comments

**Tasks**:
- [ ] Implement main CLI flow:
  1. Display welcome message with ASCII art
  2. Check if in Git repository (call validators.js)
  3. Detect existing package.json (call validators.js)
  4. Run interactive prompts (call prompts.js)
  5. Validate no conflicts (call validators.js)
  6. Show summary of what will be installed
  7. Ask for confirmation
  8. Copy template files (call file-copier.js)
  9. Update package.json with scripts (call file-copier.js)
  10. Update .gitignore (call file-copier.js)
  11. Show success message with next steps

**Example Flow**:
```javascript
export async function runCLI(options = {}) {
    const { dryRun = false, skipAWS = false, skipTest = false } = options;

    // 1. Welcome
    displayWelcome();

    // 2. Validate Git repo
    if (!await validateGitRepository(process.cwd())) {
        console.error('Not a git repository');
        process.exit(1);
    }

    // 3. Get project info from prompts
    const config = await askProjectInfo();

    // 4. Validate no conflicts
    const { valid, conflicts } = await validateNoConflicts(
        process.cwd(),
        config.useAWS && !skipAWS
    );

    if (!valid) {
        displayConflicts(conflicts);
        process.exit(1);
    }

    // 5. Show summary and confirm
    const confirmed = await confirmInstallation(config);
    if (!confirmed) {
        console.log('Installation cancelled');
        process.exit(0);
    }

    // 6. Copy files
    if (!dryRun) {
        await copyAllFiles(config);
        await updatePackageJson(process.cwd(), getWorktreeScripts());
        await updateGitignore(process.cwd(), getWorktreePatterns());
    }

    // 7. Success message
    displaySuccessMessage(config);
}
```

#### lib/prompts.js
**Current Status**: Stub created with TODO comments

**Tasks**:
- [ ] Implement `askProjectInfo()`:
  ```javascript
  export async function askProjectInfo() {
      // Auto-detect project name from package.json
      const defaultName = await detectProjectName();

      const answers = await inquirer.prompt([
          {
              type: 'input',
              name: 'projectName',
              message: 'Project name:',
              default: defaultName,
              validate: (input) => input.length > 0
          },
          {
              type: 'input',
              name: 'githubUsername',
              message: 'GitHub username or organization:',
              validate: (input) => input.length > 0
          },
          {
              type: 'confirm',
              name: 'useAWS',
              message: 'Does your project use AWS deployments?',
              default: false
          }
      ]);

      return answers;
  }
  ```

- [ ] Implement `confirmInstallation(config)`:
  ```javascript
  export async function confirmInstallation(config) {
      console.log('\n📋 Installation Summary:');
      console.log(`   Project: ${config.projectName}`);
      console.log(`   GitHub: ${config.githubUsername}`);
      console.log(`   AWS: ${config.useAWS ? 'Yes' : 'No'}`);
      console.log('\n📁 Will install:');
      console.log('   ✅ scripts/worktree/ - Worktree management');
      console.log('   ✅ docs/ - Documentation');
      if (config.useAWS) {
          console.log('   ✅ .deploy/ - CloudFormation templates');
          console.log('   ✅ test/ - Testing infrastructure');
          console.log('   ✅ devops.yml - CI/CD pipeline');
      }

      const { confirmed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmed',
          message: 'Proceed with installation?',
          default: true
      }]);

      return confirmed;
  }
  ```

#### lib/file-copier.js
**Current Status**: Stub created with TODO comments

**Tasks**:
- [ ] Implement `copyTemplateFiles(sourceDir, destDir, replacements)`:
  - Use fs-extra to copy files
  - Replace template variables: {{PROJECT_NAME}}, {{GITHUB_USERNAME}}, etc.
  - Skip files that already exist (with warnings)
  - Handle .gitignore and hidden files correctly

- [ ] Implement `updatePackageJson(projectRoot, scripts)`:
  ```javascript
  export async function updatePackageJson(projectRoot, scripts) {
      const pkgPath = path.join(projectRoot, 'package.json');
      const pkg = await fs.readJson(pkgPath);

      // Add scripts without overwriting existing ones
      pkg.scripts = {
          ...pkg.scripts,
          ...scripts
      };

      await fs.writeJson(pkgPath, pkg, { spaces: 2 });
  }
  ```

- [ ] Implement `updateGitignore(projectRoot, patterns)`:
  ```javascript
  export async function updateGitignore(projectRoot, patterns) {
      const gitignorePath = path.join(projectRoot, '.gitignore');

      let content = '';
      if (await fs.pathExists(gitignorePath)) {
          content = await fs.readFile(gitignorePath, 'utf8');
      }

      // Check if worktree section already exists
      if (content.includes('# Worktree-specific files')) {
          return; // Already added
      }

      // Append worktree patterns
      content += '\n' + patterns.join('\n') + '\n';
      await fs.writeFile(gitignorePath, content);
  }
  ```

#### lib/validators.js
**Current Status**: Stub created with TODO comments

**Tasks**:
- [ ] Implement `validateGitRepository(projectRoot)`:
  ```javascript
  export async function validateGitRepository(projectRoot) {
      const gitDir = path.join(projectRoot, '.git');
      return await fs.pathExists(gitDir);
  }
  ```

- [ ] Implement `validateNoConflicts(projectRoot, useAWS)`:
  ```javascript
  export async function validateNoConflicts(projectRoot, useAWS) {
      const conflicts = [];

      // Check for .deploy folder if AWS is enabled
      if (useAWS) {
          const deployDir = path.join(projectRoot, '.deploy');
          if (await fs.pathExists(deployDir)) {
              conflicts.push({
                  path: '.deploy/',
                  message: 'AWS deployment folder already exists'
              });
          }

          // Check for test or tests folder
          const testDir = path.join(projectRoot, 'test');
          const testsDir = path.join(projectRoot, 'tests');
          if (await fs.pathExists(testDir) || await fs.pathExists(testsDir)) {
              conflicts.push({
                  path: 'test/ or tests/',
                  message: 'Test folder already exists'
              });
          }
      }

      // Check for scripts/worktree (warning, not blocker)
      const worktreeDir = path.join(projectRoot, 'scripts', 'worktree');
      if (await fs.pathExists(worktreeDir)) {
          conflicts.push({
              path: 'scripts/worktree/',
              message: 'Worktree scripts already exist',
              severity: 'warning'
          });
      }

      return {
          valid: conflicts.filter(c => c.severity !== 'warning').length === 0,
          conflicts
      };
  }
  ```

---

### 2. Template Variable Replacement (Priority: HIGH)

**Create**: `lib/template-processor.js`

**Purpose**: Replace placeholders in template files with actual values

**Placeholders to support**:
- `{{PROJECT_NAME}}` - Project name from prompts
- `{{GITHUB_USERNAME}}` - GitHub username from prompts
- `{{REPOSITORY_NAME}}` - Same as project name
- `{{REPOSITORY_OWNER}}` - Same as GitHub username

**Implementation**:
```javascript
export function replaceVariables(content, replacements) {
    let result = content;
    for (const [key, value] of Object.entries(replacements)) {
        const placeholder = `{{${key}}}`;
        result = result.replace(new RegExp(placeholder, 'g'), value);
    }
    return result;
}

export async function processTemplateFile(sourcePath, destPath, replacements) {
    let content = await fs.readFile(sourcePath, 'utf8');
    content = replaceVariables(content, replacements);
    await fs.writeFile(destPath, content);
}
```

**Files that need variable replacement**:
- `templates/package.json` → {{PROJECT_NAME}}
- `templates/README.md` → {{PROJECT_NAME}}
- `templates/devops.yml` → {{GITHUB_USERNAME}}, {{REPOSITORY_NAME}}
- `templates/.deploy/IaC/db/configs/*.json` → {{REPOSITORY_NAME}}
- `templates/.deploy/IaC/infra/configs/*.json` → {{REPOSITORY_NAME}}

---

### 3. Documentation Files (Priority: MEDIUM)

**Location**: `templates/docs/`

**Files to create** (7 total):

1. **WORKTREES.md**
   - Complete worktree workflow
   - Creating, switching, merging
   - Port allocation explanation
   - Parallel development examples

2. **GIT_WORKFLOW.md**
   - Rebase before commit rules
   - Always use --no-ff for merges
   - Worktree-specific Git patterns
   - Conflict resolution

3. **PARALLEL_TESTING.md**
   - MD5 hash-based port allocation
   - Docker container isolation
   - LocalStack setup
   - Running multiple test environments

4. **AWS_INFRASTRUCTURE.md**
   - CloudFormation templates explained
   - db.yml structure
   - infra.yml structure
   - Parameter files
   - Claude Code IAM user permissions

5. **CICD_PIPELINE.md**
   - devops.yml explained
   - CodePipeline stages
   - CodeBuild projects
   - GitHub webhook setup
   - Deployment process

6. **TROUBLESHOOTING.md**
   - Port conflicts
   - Docker issues
   - LocalStack problems
   - Git worktree errors
   - Common mistakes

7. **CLAUDE_INSTRUCTIONS.md**
   - Instructions for AI assistant
   - Worktree context files
   - Git workflow rules
   - Testing guidelines
   - AWS CLI debugging access

---

### 4. CLI Features (Priority: MEDIUM)

- [ ] Add `--dry-run` flag
  - Shows what would be installed without actually copying
  - Useful for preview

- [ ] Add `--skip-aws` flag
  - Skip AWS-related files even if user says yes to AWS

- [ ] Add `--skip-test` flag
  - Skip test folder even with AWS

- [ ] Add `--help` command
  - Show usage instructions
  - List all available flags

- [ ] Add progress indicators
  - Use chalk for colored output
  - Show progress during file copying
  - Estimated time remaining

---

### 5. Error Handling (Priority: MEDIUM)

- [ ] Graceful error messages with suggestions
- [ ] Rollback on failure (optional)
- [ ] Detailed logging in debug mode
- [ ] Exit codes for different error types

---

### 6. Testing (Priority: LOW)

- [ ] Unit tests for validators
- [ ] Integration tests for file copying
- [ ] Test on various project configurations
- [ ] Test all CLI flags

---

### 7. Publishing (Priority: LOW)

- [ ] Test locally with `npm link`
- [ ] Create GitHub Actions workflow for publishing
- [ ] Set up semantic versioning
- [ ] Create CHANGELOG.md
- [ ] Publish to NPM registry

---

## Quick Start for Development

```bash
# Install dependencies
cd /mnt/x/Git/blockchain-web-services/utils/bws-ai-coding-template
npm install

# Make bin/init.js executable
chmod +x bin/init.js

# Test locally
npm link
cd /path/to/test/project
worktree-init

# Or test with npx
npx /mnt/x/Git/blockchain-web-services/utils/bws-ai-coding-template
```

---

## Priority Order

1. **HIGH**: CLI implementation (lib/*.js files)
2. **HIGH**: Template variable replacement
3. **MEDIUM**: Documentation files
4. **MEDIUM**: CLI features (flags, progress)
5. **LOW**: Testing
6. **LOW**: Publishing

---

## Next Steps for Claude

**Start with**: Implementing the CLI infrastructure

1. Complete `lib/cli.js` - Main flow
2. Complete `lib/prompts.js` - Interactive questions
3. Complete `lib/validators.js` - Pre-flight checks
4. Complete `lib/file-copier.js` - File operations
5. Create `lib/template-processor.js` - Variable replacement
6. Test the init command locally
7. Create documentation files in `templates/docs/`
8. Add CLI flags and error handling
9. Write tests
10. Prepare for NPM publishing

---

## Current File Structure

```
bws-ai-coding-template/
├── package.json               # ✅ Created
├── README.md                  # ✅ Created
├── IMPLEMENTATION_PLAN.md     # ✅ This file
├── bin/
│   └── init.js               # ✅ Stub created
├── lib/
│   ├── cli.js                # ✅ Stub created - IMPLEMENT FIRST
│   ├── prompts.js            # ✅ Stub created - IMPLEMENT SECOND
│   ├── file-copier.js        # ✅ Stub created - IMPLEMENT THIRD
│   ├── validators.js         # ✅ Stub created - IMPLEMENT FOURTH
│   └── template-processor.js # ❌ Create this
└── templates/                 # ✅ All files copied
    ├── .deploy/
    ├── .gitignore
    ├── MIGRATION_GUIDE.md
    ├── README.md
    ├── devops.yml
    ├── docs/               # ❌ Create documentation files
    ├── package.json
    ├── scripts/
    └── test/
```

---

**This implementation plan should be used as the main reference for continuing development in the new repository.**
