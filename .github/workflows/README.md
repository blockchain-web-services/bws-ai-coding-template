# GitHub Actions Workflows

## Automated Publishing

### Overview

The `publish.yml` workflow automatically publishes the package to both **npmjs.org** and **GitHub Packages** when changes are merged to the `master` branch.

### How It Works

1. **Trigger**: Runs when changes are pushed to `master` branch that affect:
   - `package.json` (version changes)
   - `bin/**` (CLI code)
   - `lib/**` (library code)
   - `templates/**` (template files)
   - `.github/workflows/publish.yml` (workflow itself)

2. **Version Check**: Checks if the current version already exists on npmjs.org
   - If version exists → Skip publishing
   - If version is new → Publish to both registries

3. **Dual Publishing**:
   - First publishes to **npmjs.org** (public registry)
   - Then publishes to **GitHub Packages**

### Setup Requirements

#### 1. npm Trusted Publisher (OIDC) - Already Configured ✅

This workflow uses npm's **Trusted Publisher** feature, which uses OpenID Connect (OIDC) for secure, token-free authentication. This has already been configured for this repository.

**Benefits of Trusted Publisher:**
- 🔒 No manual token management required
- 🛡️ Enhanced security with short-lived tokens
- 📜 Automatic provenance attestation for package integrity
- 🚀 Seamless integration with GitHub Actions

**How it works:**
- npm authenticates the GitHub Action using OIDC
- Workflow gets temporary publishing credentials automatically
- Published packages include provenance information proving they came from this repository

**Configuration details** (already set up):
- npm package: `@blockchain-web-services/bws-ai-coding-template`
- GitHub repository: `blockchain-web-services/bws-ai-coding-template`
- Workflow: `.github/workflows/publish.yml`

#### 2. GITHUB_TOKEN (Automatic)

The `GITHUB_TOKEN` is automatically provided by GitHub Actions and has permission to publish to GitHub Packages (no setup needed).

### Publishing Workflow

#### Standard Release Process

1. **Make changes on a feature branch**
   ```bash
   git checkout -b feature/my-feature
   # Make your changes
   git add .
   git commit -m "feat: Add new feature"
   git push origin feature/my-feature
   ```

2. **Bump version**
   ```bash
   # Choose appropriate version bump
   npm version patch  # 1.3.13 -> 1.3.14 (bug fixes)
   npm version minor  # 1.3.13 -> 1.4.0  (new features)
   npm version major  # 1.3.13 -> 2.0.0  (breaking changes)
   ```

3. **Push version change**
   ```bash
   git push origin feature/my-feature
   ```

4. **Create and merge pull request**
   - Create PR to merge feature branch into `master`
   - Get approval and merge
   - **The GitHub Action will automatically publish!**

#### Alternative: Direct to Master (Not Recommended)

If you have direct push access to `master`:

```bash
# On master branch
npm version patch
git push origin master

# GitHub Action publishes automatically
```

### Monitoring

#### Check Workflow Status

1. Go to repository → Actions tab
2. Find the "Publish Package" workflow
3. View logs for each publishing attempt

#### Verify Publication

After workflow completes:

1. **npmjs.org**:
   ```bash
   npm view @blockchain-web-services/bws-ai-coding-template version
   ```
   Or visit: https://www.npmjs.com/package/@blockchain-web-services/bws-ai-coding-template

2. **GitHub Packages**:
   Visit: https://github.com/blockchain-web-services/bws-ai-coding-template/packages

### Troubleshooting

#### Workflow Not Running

**Cause**: No relevant files changed or workflow disabled

**Solution**:
- Check if `package.json` version was actually changed
- Verify workflow file is in `.github/workflows/publish.yml`
- Check Actions tab → Workflows → Ensure "Publish Package" is enabled

#### Publishing Failed: 403 Forbidden (npm)

**Cause**: Trusted Publisher configuration issue or OIDC authentication failure

**Solution**:
1. Verify npm Trusted Publisher is configured:
   - Go to https://www.npmjs.com/package/@blockchain-web-services/bws-ai-coding-template/access
   - Check that GitHub Actions integration is properly set up
2. Verify workflow has `id-token: write` permission
3. Check that repository and workflow names match the Trusted Publisher configuration
4. Ensure the action is running from the `master` branch (if configured that way)

#### Publishing Failed: Version Already Exists

**Cause**: Trying to publish a version that already exists

**Solution**:
```bash
# Bump to a new version
npm version patch
git push origin main
```

#### GitHub Packages Publish Failed

**Cause**: GITHUB_TOKEN lacks permissions or package visibility issue

**Solution**:
1. Check workflow permissions:
   - Repository Settings → Actions → General
   - Workflow permissions → "Read and write permissions"
2. Verify package visibility (should be public)

### Manual Publishing (Fallback)

If GitHub Action fails or you need to publish manually:

```bash
# Using dual publishing script
npm run publish:dual

# Or manually with tokens in .env
./publish-dual.sh
```

See [PUBLISHING.md](../../PUBLISHING.md) for manual setup instructions.

### Workflow Features

#### Smart Version Detection
- Checks if version already exists before attempting publish
- Prevents duplicate publish errors
- Saves CI minutes

#### Path Filtering
- Only runs when relevant files change
- Ignores documentation-only changes
- Reduces unnecessary workflow runs

#### Dual Registry Support
- Single workflow publishes to both registries
- Uses native GitHub Actions features
- No third-party actions needed

#### npm Trusted Publisher (OIDC)
- Token-free authentication with npm
- Enhanced security with short-lived credentials
- Automatic provenance attestation
- Package integrity verification for consumers

### Semantic Versioning Guide

Follow semantic versioning (semver) when bumping versions:

- **Patch** (1.3.x): Bug fixes, documentation, no API changes
  ```bash
  npm version patch
  ```

- **Minor** (1.x.0): New features, backwards compatible
  ```bash
  npm version minor
  ```

- **Major** (x.0.0): Breaking changes, API incompatibility
  ```bash
  npm version major
  ```

### Pre-release Versions

For testing before official release:

```bash
# Create pre-release version
npm version prerelease --preid=beta  # 1.3.13 -> 1.3.14-beta.0

# Publish with tag
npm publish --tag beta

# Users install with:
npm install @blockchain-web-services/bws-ai-coding-template@beta
```

**Note**: The GitHub Action will publish pre-release versions if pushed to `main`, but it's recommended to use manual publishing for pre-releases.

### Related Documentation

- [PUBLISHING.md](../../PUBLISHING.md) - Complete publishing guide
- [README.md](../../README.md) - Package overview
- [CLAUDE.md](../../CLAUDE.md) - Development guidelines

### Quick Reference

```bash
# Standard release workflow
git checkout -b feature/my-feature
# ... make changes ...
git add .
git commit -m "feat: Description"
npm version patch
git push origin feature/my-feature
# Create PR, merge to master → Auto-publish!

# Check published version
npm view @blockchain-web-services/bws-ai-coding-template version

# Install published package
npm install @blockchain-web-services/bws-ai-coding-template
```
