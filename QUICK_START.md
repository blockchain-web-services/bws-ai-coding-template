# Quick Start - Publish to GitHub Packages

## 🚀 Complete in 3 Commands

### 1. Authenticate (one-time setup)

```bash
# Paste your GitHub token when prompted:
read -s GITHUB_TOKEN && echo "//npm.pkg.github.com/:_authToken=$GITHUB_TOKEN" >> ~/.npmrc && echo "✅ Authenticated!"
```

> Get token at: https://github.com/settings/tokens (needs `write:packages` scope)

### 2. Publish

```bash
cd /mnt/x/Git/blockchain-web-services/utils/bws-ai-coding-template
npm publish
```

### 3. Verify

```bash
# Check package page
open https://github.com/blockchain-web-services/bws-ai-coding-template/packages

# Try installing
npx @blockchain-web-services/bws-ai-coding-template --help
```

## ✅ Done!

Your package is now live at:
- **GitHub**: https://github.com/blockchain-web-services/bws-ai-coding-template
- **Packages**: https://github.com/orgs/blockchain-web-services/packages

## 📦 Users Install With

```bash
# Configure registry
echo "@blockchain-web-services:registry=https://npm.pkg.github.com" >> .npmrc

# Install
npm install @blockchain-web-services/bws-ai-coding-template

# Or use directly
npx @blockchain-web-services/bws-ai-coding-template
```

## 🔄 Future Updates

```bash
# Quick update and publish
./publish.sh patch  # or minor, or major

# Or manually
npm version patch
git push origin staging --tags
npm publish
```

## 📚 Full Documentation

- **PUBLISHING.md** - Complete publishing guide
- **UPDATE_BEHAVIOR.md** - How updates work
- **CLAUDE.md** - Architecture guide
- **README.md** - User documentation

---

**Current Status**: Ready to publish v1.0.0! 🎉
