# Publishing to GitHub Packages

This guide explains how to publish this package to GitHub Packages under the @blockchain-web-services organization.

## Prerequisites

1. **GitHub Repository**: Repository must exist at `https://github.com/blockchain-web-services/bws-ai-coding-template`
2. **Organization Access**: You must have write access to the @blockchain-web-services organization
3. **GitHub Personal Access Token (PAT)**: With `write:packages` permission

## Step 1: Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Name it: `NPM Package Publishing`
4. Select scopes:
   - ✅ `write:packages` - Upload packages to GitHub Package Registry
   - ✅ `read:packages` - Download packages from GitHub Package Registry
   - ✅ `delete:packages` - Delete packages from GitHub Package Registry (optional)
   - ✅ `repo` - Required for private repositories (optional)
5. Click "Generate token"
6. **Copy the token** (you won't see it again!)

## Step 2: Authenticate with GitHub Packages

### Option A: Using .npmrc (Recommended)

Create a `.npmrc` file in your home directory:

```bash
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> ~/.npmrc
```

Replace `YOUR_GITHUB_TOKEN` with your actual token.

### Option B: Using npm login

```bash
npm login --registry=https://npm.pkg.github.com
```

When prompted:
- Username: Your GitHub username
- Password: Your GitHub Personal Access Token
- Email: Your GitHub email

## Step 3: Verify Package Configuration

Check that package.json is correctly configured:

```bash
cat package.json | grep -A 2 publishConfig
```

Should show:
```json
"publishConfig": {
  "registry": "https://npm.pkg.github.com"
}
```

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

## Step 6: Publish the Package

### First Time Publishing

```bash
# Make sure you're in the package directory
cd /mnt/x/Git/blockchain-web-services/utils/bws-ai-coding-template

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

# 2. Commit version change
git add package.json
git commit -m "Bump version to $(node -p "require('./package.json').version")"

# 3. Create git tag
git tag v$(node -p "require('./package.json').version")

# 4. Push changes and tag
git push origin main
git push origin --tags

# 5. Publish to GitHub Packages
npm publish
```

## Step 7: Verify Publication

After publishing:

```bash
# Check package page
open https://github.com/blockchain-web-services/bws-ai-coding-template/packages

# Try installing from GitHub Packages
npm install @blockchain-web-services/bws-ai-coding-template
```

## Using the Published Package

### For Users

Users need to configure npm to use GitHub Packages for @blockchain-web-services scope:

#### Option 1: Project .npmrc

Create `.npmrc` in project root:

```
@blockchain-web-services:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then:

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
