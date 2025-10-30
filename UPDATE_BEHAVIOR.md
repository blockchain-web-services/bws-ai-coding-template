# Update Behavior

This document explains how the installer handles updates when run on a project that already has the tool installed.

## TL;DR

✅ **Scripts and Docs are ALWAYS updated** (safe)
⚠️ **AWS files are protected by default** (use `--force` to update)

## Automatic Updates (Default Behavior)

When you run the installer on a project that already has the tool installed:

### Always Updated (No Flag Needed)

These files are **owned by the tool** and should always be kept up to date:

1. **`scripts/worktree/`** - Worktree management scripts
   - `create-worktree.mjs`
   - `list-worktrees.mjs`
   - `merge-worktree.mjs`
   - `remove-worktree.mjs`

2. **`docs/`** - Documentation files
   - `WORKTREES.md`
   - `GIT_WORKFLOW.md`
   - `PARALLEL_TESTING.md`
   - `AWS_INFRASTRUCTURE.md`
   - `CICD_PIPELINE.md`
   - `TROUBLESHOOTING.md`
   - `CLAUDE_INSTRUCTIONS.md`

3. **`package.json` scripts** - NPM scripts
   - Will update if script command changed
   - Won't overwrite if you modified the script

4. **`.gitignore` patterns** - Worktree ignore patterns
   - Only appends once (idempotent)

**Rationale**: These files contain tool logic and documentation. Users shouldn't customize them. Updates bring bug fixes and improvements.

### Protected by Default

These files are **project-specific** and may contain customizations:

1. **`.deploy/`** - CloudFormation templates
2. **`test/`** - Test infrastructure
3. **`devops.yml`** - CI/CD pipeline

**Rationale**: You may have customized these for your project's specific needs.

## Update Modes

### Mode 1: Normal Update (Default)

```bash
# Run installer again
npx @blockchain-web-services/bws-ai-coding-template
```

**Updates**:
- ✅ `scripts/worktree/` (always)
- ✅ `docs/` (always)
- ✅ `package.json` scripts (if changed)
- ✅ `.gitignore` patterns (if missing)

**Skips**:
- ⏭️ `.deploy/` (if exists)
- ⏭️ `test/` (if exists)
- ⏭️ `devops.yml` (if exists)

### Mode 2: Force Update (Use with Caution)

```bash
# Force update ALL files
npx @blockchain-web-services/bws-ai-coding-template --force
```

**Updates**:
- ✅ `scripts/worktree/` (always)
- ✅ `docs/` (always)
- ✅ `.deploy/` ⚠️ **OVERWRITES**
- ✅ `test/` ⚠️ **OVERWRITES**
- ✅ `devops.yml` ⚠️ **OVERWRITES**
- ✅ `package.json` scripts (if changed)
- ✅ `.gitignore` patterns (if missing)

**Warning**: This will overwrite your customizations in AWS files!

### Mode 3: Dry Run

```bash
# Preview what would be updated
npx @blockchain-web-services/bws-ai-coding-template --dry-run
```

Shows what would be copied/updated without making changes.

## Common Update Scenarios

### Scenario 1: Bug Fix in Worktree Scripts

**Problem**: A bug was fixed in `create-worktree.mjs`

**Solution**:
```bash
# Just run installer again
npx @blockchain-web-services/bws-ai-coding-template
```

Result: Scripts automatically updated ✅

### Scenario 2: New Documentation

**Problem**: New troubleshooting guide added

**Solution**:
```bash
# Run installer
npx @blockchain-web-services/bws-ai-coding-template
```

Result: New docs copied, existing docs updated ✅

### Scenario 3: CloudFormation Template Update

**Problem**: You want the latest CloudFormation templates but have customizations

**Options**:

**Option A: Manual merge (recommended)**
```bash
# 1. Back up your customizations
cp -r .deploy .deploy.backup

# 2. Force update
npx @blockchain-web-services/bws-ai-coding-template --force

# 3. Manually merge your customizations back
diff -r .deploy.backup .deploy
# Merge important changes
```

**Option B: Cherry-pick updates**
```bash
# 1. View what changed
npx @blockchain-web-services/bws-ai-coding-template --dry-run

# 2. Manually update specific files you want
```

**Option C: Start fresh**
```bash
# 1. Remove old AWS files
rm -rf .deploy test devops.yml

# 2. Reinstall
npx @blockchain-web-services/bws-ai-coding-template
```

### Scenario 4: NPM Script Update

**Problem**: Worktree command syntax changed

**Solution**:
```bash
# Run installer
npx @blockchain-web-services/bws-ai-coding-template
```

Result: Scripts in package.json automatically updated if changed ✅

## Visual Update Flow

```
Run installer in existing project
         ↓
   Check files
         ↓
    ┌────┴────┐
    │         │
scripts/  docs/    AWS files
worktree/         (.deploy, test, etc.)
    │         │         │
    ↓         ↓         ↓
 ALWAYS    ALWAYS   Conditional
 UPDATE    UPDATE      ↓
                    ┌──┴──┐
                    │     │
                 Default  --force
                    ↓     ↓
                  Skip   Update
```

## Update Messages

### Normal Update (No --force)

```
📦 Installing Template Files...

Copying scripts/worktree/...
  ↻ Updated: create-worktree.mjs
  ↻ Updated: list-worktrees.mjs
  • Unchanged: merge-worktree.mjs
  • Unchanged: remove-worktree.mjs

Copying docs/...
  ↻ Updated: TROUBLESHOOTING.md (3 files updated)
  • Unchanged: WORKTREES.md (4 files unchanged)

Copying .deploy/...
  ⚠ Skipped: db/db.yml (already exists)
  ⚠ Skipped: infra/infra.yml (already exists)

📝 Updating package.json...
  ↻ Updated scripts: worktree:create
  • Unchanged scripts: worktree:list, worktree:merge, worktree:remove
```

### Force Update

```
⚠️  WARNING: --force flag enabled
    This will overwrite ALL existing files, including AWS templates.
    Your customizations may be lost!

📦 Installing Template Files...

Copying scripts/worktree/...
  ↻ Updated: create-worktree.mjs (4 files)

Copying docs/...
  ↻ Updated: TROUBLESHOOTING.md (7 files)

Copying .deploy/...
  ↻ Updated: db/db.yml (12 files) ⚠️

Copying test/...
  ↻ Updated: vitest.config.mjs (23 files) ⚠️
```

## Version Tracking (Future Enhancement)

Currently, version tracking is not implemented. Future versions may include:

- `.bws-ai-coding-template.version` file
- Smart diff-based merging
- Migration scripts
- Changelog display

## Best Practices

### For Regular Updates

1. **Update often**: Run installer after package updates
2. **Review changes**: Use `git diff` to see what changed
3. **Test after update**: Ensure worktree commands still work

### For Major Updates

1. **Back up first**: `git commit -a -m "Before update"`
2. **Read changelog**: Check for breaking changes
3. **Test in worktree first**: Create test worktree, update there
4. **Use --dry-run**: Preview changes before applying

### For Customized Projects

1. **Track customizations**: Document what you changed
2. **Use git branches**: Create update branch first
3. **Manual merge**: Don't use --force blindly
4. **Consider contributing**: Submit your improvements upstream

## Troubleshooting Updates

### Scripts Not Updating

**Symptom**: Run installer but scripts unchanged

**Cause**: Scripts haven't actually changed in new version

**Verify**:
```bash
cat scripts/worktree/create-worktree.mjs | head -5
# Check version in comments if present
```

### Documentation Not Updating

**Symptom**: Docs showing as "unchanged"

**Cause**: Docs are identical to new version

**Verify**: This is normal if docs haven't changed

### AWS Files Not Updating

**Symptom**: `.deploy/` not updating

**Cause**: Protected by default (intentional)

**Solution**: Use `--force` if you really want to update

### Package Scripts Not Updating

**Symptom**: NPM scripts not updating

**Cause**: Script command is identical

**Verify**:
```bash
npm run worktree:create -- --help
# Test if it works correctly
```

## Related Documentation

- [README.md](./README.md) - Installation guide
- [CLAUDE.md](./CLAUDE.md) - Project architecture
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Implementation details

## Summary

The update mechanism is designed to be **safe and smart**:

- ✅ Tool-owned files (scripts, docs) update automatically
- ⚠️ Project-specific files (AWS) protected by default
- 🔧 Use `--force` when you need full control
- 📝 Package.json scripts update when changed
- 🔍 Use `--dry-run` to preview updates

This ensures you get bug fixes and improvements without losing customizations.
