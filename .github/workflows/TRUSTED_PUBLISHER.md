# npm Trusted Publisher Setup

## Overview

This repository uses npm's **Trusted Publisher** feature for secure, token-free publishing to npmjs.org from GitHub Actions.

## What is npm Trusted Publisher?

Trusted Publisher is npm's implementation of OpenID Connect (OIDC) authentication for CI/CD systems. Instead of using long-lived API tokens, it allows GitHub Actions to authenticate with npm using short-lived, automatically-generated credentials.

### Benefits

✅ **No Token Management**: No need to create, store, or rotate npm access tokens
✅ **Enhanced Security**: Short-lived credentials that expire automatically
✅ **Provenance Attestation**: Published packages include cryptographic proof of their origin
✅ **Audit Trail**: Clear record of which workflow published each version
✅ **Zero Configuration**: No GitHub secrets required for npm publishing

## How It Works

```
┌─────────────────┐
│ GitHub Actions  │
│   Workflow      │
└────────┬────────┘
         │
         │ 1. Request OIDC token
         ▼
┌─────────────────┐
│ GitHub OIDC     │
│   Provider      │
└────────┬────────┘
         │
         │ 2. Issue short-lived JWT
         ▼
┌─────────────────┐
│ npm Registry    │
│ (npmjs.org)     │
└────────┬────────┘
         │
         │ 3. Verify JWT & workflow identity
         │ 4. Allow publish with provenance
         ▼
┌─────────────────┐
│ Package         │
│ Published! 📦   │
└─────────────────┘
```

## Configuration Details

### npm Package Settings

- **Package**: `@blockchain-web-services/bws-ai-coding-template`
- **Registry**: https://registry.npmjs.org
- **Provenance**: Enabled (automatic with `--provenance` flag)

### GitHub Configuration

- **Repository**: `blockchain-web-services/bws-ai-coding-template`
- **Workflow File**: `.github/workflows/publish.yml`
- **Branch**: `master`
- **Required Permission**: `id-token: write`

### Workflow Configuration

The workflow includes these key elements for Trusted Publisher:

```yaml
permissions:
  contents: read
  packages: write
  id-token: write  # Required for OIDC authentication

steps:
  - name: Setup Node.js
    uses: actions/setup-node@v4
    with:
      node-version: '18'
      registry-url: 'https://registry.npmjs.org'

  - name: Publish to npmjs.org
    run: npm publish --provenance --access public
    # No NODE_AUTH_TOKEN needed - OIDC handles authentication
```

## Provenance Attestation

When packages are published with `--provenance`, npm creates a signed attestation that includes:

- **Source Repository**: Where the code came from
- **Workflow**: Which GitHub Action published it
- **Commit SHA**: Exact code version that was published
- **Actor**: Who triggered the workflow
- **Timestamp**: When it was published

Users can verify this with:

```bash
npm view @blockchain-web-services/bws-ai-coding-template --json | jq .dist.attestations
```

Or view on npm:
https://www.npmjs.com/package/@blockchain-web-services/bws-ai-coding-template?activeTab=code

## Initial Setup (Already Completed)

The Trusted Publisher configuration was set up on npm with these steps:

1. **Login to npm**
   - Go to https://www.npmjs.com
   - Login with organization credentials

2. **Navigate to Package Settings**
   - Visit: https://www.npmjs.com/package/@blockchain-web-services/bws-ai-coding-template/access
   - Or: Package → Settings → Publishing Access

3. **Configure Trusted Publisher**
   - Click "Add trusted publisher"
   - Provider: **GitHub Actions**
   - Repository owner: `blockchain-web-services`
   - Repository name: `bws-ai-coding-template`
   - Workflow filename: `publish.yml`
   - Environment name: (leave empty for any environment)

4. **Save Configuration**
   - Click "Add" to save the trusted publisher

## Verifying the Configuration

### Check npm Configuration

Visit the package access page:
```
https://www.npmjs.com/package/@blockchain-web-services/bws-ai-coding-template/access
```

You should see:
- ✅ Trusted publishers section showing the GitHub Actions integration
- Repository: `blockchain-web-services/bws-ai-coding-template`
- Workflow: `publish.yml`

### Check Workflow Permissions

Review `.github/workflows/publish.yml`:

```yaml
permissions:
  contents: read
  packages: write
  id-token: write  # Must be present
```

### Test Publishing

Trigger a publish by bumping version and pushing to master:

```bash
npm version patch
git push origin master
```

Watch the workflow at:
```
https://github.com/blockchain-web-services/bws-ai-coding-template/actions
```

## Troubleshooting

### Error: OIDC token validation failed

**Cause**: Workflow doesn't have `id-token: write` permission

**Solution**:
```yaml
permissions:
  id-token: write  # Add this to workflow
```

### Error: Not authorized to publish

**Cause**: Trusted Publisher configuration doesn't match workflow details

**Solution**:
1. Verify repository name matches exactly
2. Verify workflow filename matches exactly (case-sensitive)
3. Check branch requirements if configured

### Error: Provenance generation failed

**Cause**: Missing `--provenance` flag or incompatible npm version

**Solution**:
```bash
# Ensure npm version supports provenance (npm 9.5.0+)
npm --version

# Use provenance flag
npm publish --provenance
```

### Workflow runs but publish fails silently

**Cause**: OIDC token not being issued

**Solution**:
1. Check repository settings → Actions → General
2. Ensure "Allow GitHub Actions to create and approve pull requests" is enabled
3. Verify no repository-level restrictions on OIDC

## Security Considerations

### What Trusted Publisher Prevents

✅ **Stolen Token Risk**: No long-lived tokens to steal
✅ **Token Exposure**: No tokens in logs or secrets
✅ **Unauthorized Publishing**: Only configured workflows can publish
✅ **Supply Chain Attacks**: Provenance proves package origin

### What You Still Need to Protect

⚠️ **Repository Access**: Protect `main` branch with required reviews
⚠️ **Workflow Changes**: Review changes to `.github/workflows/publish.yml`
⚠️ **Package.json Changes**: Monitor version bumps and dependencies
⚠️ **npm Organization**: Manage organization member permissions

## Migrating from Token-Based Auth

If you previously used `NPM_TOKEN`:

1. ✅ Remove `NPM_TOKEN` from GitHub secrets (optional, no longer used)
2. ✅ Add `id-token: write` permission to workflow
3. ✅ Remove `NODE_AUTH_TOKEN` environment variable from publish step
4. ✅ Add `--provenance` flag to `npm publish`
5. ✅ Configure Trusted Publisher on npm
6. ✅ Test publishing

**Note**: The old manual scripts (`publish.sh`, `publish-dual.sh`) still use token-based auth and will continue to work for local/manual publishing.

## Comparison: Automated vs Manual Publishing

| Method | Authentication | Provenance | Use Case |
|--------|---------------|------------|----------|
| **GitHub Actions** (Trusted Publisher) | OIDC (token-free) | ✅ Automatic | Recommended for releases |
| **Manual** (`publish-dual.sh`) | NPM_TOKEN + GITHUB_TOKEN | ❌ Not included | Local testing, hotfixes |

## Additional Resources

- [npm Trusted Publishers Announcement](https://github.blog/2023-04-19-introducing-npm-package-provenance/)
- [npm Provenance Documentation](https://docs.npmjs.com/generating-provenance-statements)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [Sigstore Project](https://www.sigstore.dev/) (underlying technology)

## Support

If you encounter issues with Trusted Publisher:

1. Check workflow logs in GitHub Actions
2. Verify configuration at npm package settings
3. Review this document's troubleshooting section
4. Contact npm support for registry-side issues
5. File an issue in this repository for workflow-specific problems

---

**Status**: ✅ Configured and Active
**Last Updated**: 2025-12-16
**Configuration Version**: v1.0
