---
description: Merge current worktree into root branch and push to origin with deployment monitoring
allowed-tools: Bash(git:*), Bash(npm:*), Bash(gh:*)
model: sonnet
---

# Worktree Merge Command

Execute the complete worktree merge workflow. This command automates the process of merging a worktree branch into its parent branch, pushing to origin, and monitoring the resulting deployment.

## Workflow Steps

### 1. Detect Current Location and Branch

First, determine if we're in a worktree or the project root:

```bash
pwd
git rev-parse --show-toplevel
git branch --show-current
```

**If inside `.trees/` directory:**
- Extract worktree branch name from path (e.g., `.trees/feature-auth` → `feature-auth`)
- Navigate to project root

**If in project root:**
- Check if user specified a branch name in the command
- If no branch specified, show error: "Please specify a worktree branch name or run this command from within a worktree"

### 2. Determine Parent Branch

The parent branch is automatically stored when the worktree is created. Read it from:
- `.trees/{BRANCH_NAME}/test/.worktree-info.json` - Look for `parentBranch` field
- Fallback: Parse from `.trees/{BRANCH_NAME}/CLAUDE_INSTRUCTIONS.md` - Look for `**Parent Branch**: {name}`

Common parent branches: `staging`, `prod`, `main`, `master`

### 3. Fetch and Rebase in Worktree

Navigate to the worktree and update it against the parent branch:

```bash
cd .trees/{BRANCH_NAME}
git fetch origin
git rebase origin/{PARENT_BRANCH}
```

**If rebase conflicts occur:**
1. Show conflicted files: `git status`
2. Guide user: "Conflicts detected. You need to resolve them manually:"
   ```
   Conflicted files:
   - file1.js
   - file2.js

   To resolve:
   1. Open each file and look for conflict markers (<<<<<<< HEAD, =======, >>>>>>>)
   2. Edit the files to resolve conflicts
   3. Run: git add .
   4. Run: git rebase --continue
   5. Then run this command again
   ```
3. Exit and let user resolve conflicts

**If rebase succeeds:**
- Show: "✅ Worktree branch rebased successfully"
- Continue to next step

### 4. Return to Root and Validate Parent Branch

```bash
cd ../..  # Return to project root
```

The merge script will automatically validate that we're on the correct parent branch. If not, it will show an error.

**Ensure we're on the correct parent branch:**
```bash
# Check current branch
CURRENT_BRANCH=$(git branch --show-current)

# If not on parent branch, checkout parent branch
if [ "$CURRENT_BRANCH" != "$PARENT_BRANCH" ]; then
    echo "Switching to parent branch: $PARENT_BRANCH"
    git checkout $PARENT_BRANCH
fi
```

### 5. Merge Worktree Branch

Run the merge command with `--update` flag (since we already rebased):

```bash
npm run worktree:merge {BRANCH_NAME} --update
```

**What the script does:**
- Validates parent branch (should pass since we're on correct branch)
- Merges with `--no-ff` to preserve history
- Excludes worktree-specific files (`.env.worktree`, `docker-compose.worktree.yml`, etc.)
- Preserves main branch versions of `test/.env`, `test/package.json`, `.gitignore`
- **Automatically pushes to origin** (the parent branch: staging/prod/main/master)

**Expected output:**
```
✅ Merge completed successfully!
✅ Successfully pushed to origin
```

### 6. Monitor Deployment

Immediately after the push, monitor the triggered deployments:

#### A. GitHub Actions (Primary)

```bash
# Watch the latest workflow run
gh run watch

# Or list recent runs
gh run list --limit 5

# View specific run details
gh run view <run-id> --log
```

#### B. AWS CodePipeline (If configured)

Determine which AWS profile to use based on the parent branch:
- `staging` branch → use `--profile staging`
- `prod` branch → use `--profile prod`
- `main`/`master` branch → use `--profile staging` (default)

```bash
# Check CodePipeline status
# For staging:
aws codepipeline get-pipeline-state \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'stageStates[*].[stageName,latestExecution.status]' \
  --output table

# For production:
aws codepipeline get-pipeline-state \
  --name devops-{{REPOSITORY_NAME}}-prod \
  --profile prod --region us-east-1 \
  --query 'stageStates[*].[stageName,latestExecution.status]' \
  --output table
```

#### C. CloudFormation Stacks (If AWS deployment)

First, discover stack names from the pipeline:

```bash
# For staging deployment:
aws codepipeline get-pipeline \
  --name devops-{{REPOSITORY_NAME}}-staging \
  --profile staging --region us-east-1 \
  --query 'pipeline.stages[*].actions[?actionTypeId.provider==`CloudFormation`].[actionName,configuration.StackName]' \
  --output table

# Then monitor specific stack events:
aws cloudformation describe-stack-events \
  --stack-name <actual-stack-name> \
  --profile staging --region us-east-1 \
  --query 'StackEvents[0:10].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId]' \
  --output table
```

### 7. Show Success Message and Next Steps

After successful merge and deployment:

```
✅ Worktree merge complete!

📊 Summary:
- Branch: {BRANCH_NAME}
- Parent: {PARENT_BRANCH}
- Merged and pushed to origin/{PARENT_BRANCH}
- Deployment triggered

🔍 Monitoring:
- GitHub Actions: [show link to workflow run]
- CodePipeline: devops-{{REPOSITORY_NAME}}-{PARENT_BRANCH}

💡 Next steps:
1. Monitor deployment logs above
2. Test changes in {PARENT_BRANCH} environment
3. Clean up worktree when ready:
   npm run worktree:remove {BRANCH_NAME}
```

## Error Handling

### If merge script fails with parent branch mismatch:
- Show the error message (script will indicate expected vs actual branch)
- Guide: "Checkout the correct branch first: `git checkout {expected-branch}`"

### If merge has conflicts:
- The merge script will pause and show conflicted files
- Guide user to resolve conflicts and continue

### If push fails:
- Merge is still successful locally
- Show: "Push failed. Try manually: `git push origin {PARENT_BRANCH}`"

### If deployment monitoring fails:
- Show: "Deployment triggered but monitoring unavailable"
- Guide: "Check deployments manually in GitHub Actions or AWS Console"

## Important Notes

**Automatic Push:**
The `npm run worktree:merge` command **automatically pushes to origin** unless you use `--no-push` flag. This is intentional to trigger CI/CD pipelines immediately.

**Parent Branch Validation:**
The merge script validates you're on the correct parent branch. This prevents accidentally merging to the wrong branch.

**File Exclusions:**
Worktree-specific files are automatically excluded from the merge to prevent port conflicts and environment contamination.

**AWS Profile Selection:**
Always use the profile matching your target environment:
- Staging branch → `--profile staging`
- Production branch → `--profile prod`
