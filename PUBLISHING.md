# Publishing to npm and GitHub Packages

This guide explains how to publish this package to BOTH npm (public registry) and GitHub Packages.

## Prerequisites

1. **GitHub Repository**: Repository must exist at `https://github.com/blockchain-web-services/bws-ai-coding-template`
2. **Organization Access**: You must have write access to the @blockchain-web-services organization
3. **npm Account**: With publish access to @blockchain-web-services scope
4. **Tokens Required**:
   - **NPM_TOKEN**: npm access token with publish permission
   - **GITHUB_TOKEN**: GitHub PAT with `write:packages` permission

## Step 1: Create npm Access Token

1. Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Click "Generate New Token" → "Classic Token"
3. Name it: `bws-ai-coding-template publishing`
4. Select type: **Automation** (for CI/CD) or **Publish** (for manual publishing)
5. Click "Generate Token"
6. **Copy the token** (starts with `npm_...`)

## Step 2: Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Name it: `NPM Package Publishing`
4. Select scopes:
   - ✅ `write:packages` - Upload packages to GitHub Package Registry
   - ✅ `read:packages` - Download packages from GitHub Package Registry
   - ✅ `delete:packages` - Delete packages from GitHub Package Registry (optional)
   - ✅ `repo` - Required for private repositories (optional)
5. Click "Generate token"
6. **Copy the token** (starts with `ghp_...`)

## Step 3: Configure Tokens in .env

Create or update `.env` file in the project root:

```bash
# .env file
NPM_TOKEN=npm_...your_npm_token...
GITHUB_TOKEN=ghp_...your_github_token...
```

**Important**: This file is gitignored and won't be committed.

## Step 4: Verify Package Configuration

Check that package.json is correctly configured:

```bash
cat package.json | grep -A 2 publishConfig
```

Should show:
```json
"publishConfig": {
  "access": "public"
}
```

This allows publishing to both npm (public) and GitHub Packages.

## Step 4: Ensure Repository Exists on GitHub

Make sure the repository exists and you have access:

```bash
# Check remote
git remote -v

# Should show:
# origin  https://github.com/blockchain-web-services/bws-ai-coding-template.git
```

If not set up:

```bash
# Initialize git if needed
git init

# Add remote
git remote add origin https://github.com/blockchain-web-services/bws-ai-coding-template.git

# Push to GitHub
git add .
git commit -m "Initial commit"
git branch -M main
git push -u origin main
```

## Step 5: Pre-publish Checks

Run these checks before publishing:

```bash
# 1. Check package contents
npm pack --dry-run

# 2. Verify files to be published
cat package.json | grep -A 5 '"files"'

# Should include:
# - bin/
# - lib/
# - templates/

# 3. Test the CLI locally
node bin/init.js --help

# 4. Verify version
cat package.json | grep version
```

## Step 6: Publish to Both Registries

### Using the Dual Publishing Script (Recommended)

The `publish-dual.sh` script automatically publishes to both npm and GitHub Packages:

```bash
# Run dual publishing script
npm run publish:dual
```

This will:
1. Configure npm authentication for both registries
2. Publish to npmjs.org
3. Publish to GitHub Packages
4. Display package URLs

### Manual Publishing

If you need to publish to only one registry:

**Publish to npm only:**
```bash
npm publish --registry https://registry.npmjs.org
```

**Publish to GitHub Packages only:**
```bash
npm publish --registry https://npm.pkg.github.com

# Publish to GitHub Packages
npm publish
```

### Publishing Updates

```bash
# 1. Update version in package.json
npm version patch  # 1.0.0 -> 1.0.1
# or
npm version minor  # 1.0.0 -> 1.1.0
# or
npm version major  # 1.0.0 -> 2.0.0

# 2. Push changes and tag (npm version auto-commits)
git push origin staging
git push origin --tags

# 3. Publish to both registries
npm run publish:dual
```

## Step 7: Verify Publication

After publishing, verify on both registries:

```bash
# Check npm registry
open https://www.npmjs.com/package/@blockchain-web-services/bws-ai-coding-template

# Check GitHub Packages
open https://github.com/blockchain-web-services/bws-ai-coding-template/packages
```

## Using the Published Package

### From npm (Public - No Authentication Required)

```bash
# Install from npm (recommended for most users)
npm install @blockchain-web-services/bws-ai-coding-template
```

### From GitHub Packages (Requires Authentication)

Create `.npmrc` in project root:

```
@blockchain-web-services:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then install:

```bash
# Set token in environment
export GITHUB_TOKEN=your_github_token

# Install
npm install @blockchain-web-services/bws-ai-coding-template
```

#### Option 2: Global .npmrc

Add to `~/.npmrc`:

```
@blockchain-web-services:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=your_github_token
```

Then install normally:

```bash
npm install -g @blockchain-web-services/bws-ai-coding-template
```

#### Option 3: Use npx with authentication

```bash
# Set token first
export GITHUB_TOKEN=your_github_token

# Run with npx
npx @blockchain-web-services/bws-ai-coding-template
```

### Public Access (Optional)

To make the package publicly accessible without authentication:

1. Go to: https://github.com/blockchain-web-services/bws-ai-coding-template/packages
2. Click on the package
3. Go to "Package settings"
4. Scroll to "Danger Zone"
5. Click "Change visibility" → "Public"

Then users can install without a token:

```bash
npm install @blockchain-web-services/bws-ai-coding-template --registry=https://npm.pkg.github.com
```

## Troubleshooting

### Error: 404 Not Found

**Cause**: Repository doesn't exist or you don't have access

**Solution**:
```bash
# Verify repository exists
curl https://api.github.com/repos/blockchain-web-services/bws-ai-coding-template

# Check your access
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/blockchain-web-services/bws-ai-coding-template
```

### Error: 401 Unauthorized

**Cause**: Invalid or missing authentication token

**Solution**:
```bash
# Verify token is set
echo $GITHUB_TOKEN  # If using environment variable

# Or check ~/.npmrc
cat ~/.npmrc | grep npm.pkg.github.com
```

### Error: 403 Forbidden

**Cause**: Token doesn't have `write:packages` permission

**Solution**:
1. Go to GitHub token settings
2. Edit the token
3. Enable `write:packages` scope
4. Regenerate token if needed

### Error: Package already exists

**Cause**: Version already published

**Solution**:
```bash
# Bump version
npm version patch

# Publish new version
npm publish
```

### Package shows wrong version

**Cause**: Cached registry data

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Verify version
npm view @blockchain-web-services/bws-ai-coding-template version
```

## Version Management

### Semantic Versioning

Follow semantic versioning (semver):

- **Patch** (1.0.x): Bug fixes, documentation updates
  ```bash
  npm version patch
  ```

- **Minor** (1.x.0): New features, backwards compatible
  ```bash
  npm version minor
  ```

- **Major** (x.0.0): Breaking changes
  ```bash
  npm version major
  ```

### Pre-release Versions

For testing:

```bash
# Alpha version: 1.0.0-alpha.0
npm version prerelease --preid=alpha

# Beta version: 1.0.0-beta.0
npm version prerelease --preid=beta

# Publish with tag
npm publish --tag beta
```

Users can install:
```bash
npm install @blockchain-web-services/bws-ai-coding-template@beta
```

## Automated Publishing (GitHub Actions)

Create `.github/workflows/publish.yml`:

```yaml
name: Publish Package

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://npm.pkg.github.com'
          scope: '@blockchain-web-services'

      - name: Install dependencies
        run: npm ci

      - name: Publish to GitHub Packages
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Then publish by creating a tag:

```bash
npm version patch
git push origin main --tags
```

GitHub Actions will automatically publish!

## Checklist

Before publishing:

- [ ] Repository exists on GitHub
- [ ] You have write access to @blockchain-web-services
- [ ] GitHub PAT created with write:packages
- [ ] Authentication configured (~/.npmrc or env var)
- [ ] All tests pass (if applicable)
- [ ] Version number updated
- [ ] CHANGELOG.md updated (optional)
- [ ] Git committed and pushed
- [ ] Tag created (optional)

After publishing:

- [ ] Verify on GitHub Packages page
- [ ] Test installation in clean project
- [ ] Update documentation with installation instructions
- [ ] Announce to team

## Quick Command Reference

```bash
# Setup
npm login --registry=https://npm.pkg.github.com

# Publish flow
npm version patch
git add package.json
git commit -m "Bump version"
git tag v$(node -p "require('./package.json').version")
git push origin main --tags
npm publish

# Verify
npm view @blockchain-web-services/bws-ai-coding-template

# Install
npm install @blockchain-web-services/bws-ai-coding-template
```

## Support

If you encounter issues:

1. Check GitHub Packages documentation: https://docs.github.com/en/packages
2. Verify token permissions
3. Check repository access
4. Review GitHub Package registry status: https://www.githubstatus.com/

## Related Documentation

- [README.md](./README.md) - Package overview
- [UPDATE_BEHAVIOR.md](./UPDATE_BEHAVIOR.md) - Update mechanism
- [CLAUDE.md](./CLAUDE.md) - Development guide
