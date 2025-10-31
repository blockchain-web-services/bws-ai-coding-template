#!/bin/bash

# Dual Registry Publishing Script
# Publishes to both npmjs.org and GitHub Packages

set -e

echo "🚀 Dual Registry Publishing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Load environment variables
if [ -f .env ]; then
    source .env
else
    echo "❌ Error: .env file not found"
    exit 1
fi

# Check for required tokens
if [ -z "$NPM_TOKEN" ]; then
    echo "❌ Error: NPM_TOKEN not found in .env"
    exit 1
fi

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: GITHUB_TOKEN not found in .env"
    exit 1
fi

# Get current version
VERSION=$(node -p "require('./package.json').version")
echo "📦 Version: $VERSION"

# Configure npm authentication
echo ""
echo "🔐 Configuring npm authentication..."
npm config set //registry.npmjs.org/:_authToken="${NPM_TOKEN}"
npm config set //npm.pkg.github.com/:_authToken="${GITHUB_TOKEN}"

# Publish to npmjs.org
echo ""
echo "📤 Publishing to npmjs.org..."
npm publish --registry https://registry.npmjs.org

echo "✅ Published to npmjs.org"

# Publish to GitHub Packages
echo ""
echo "📤 Publishing to GitHub Packages..."
npm publish --registry https://npm.pkg.github.com || echo "⚠️  Already published to GitHub Packages (skipping)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Publishing complete!"
echo ""
echo "📍 Package locations:"
echo "   • npmjs.org: https://www.npmjs.com/package/@blockchain-web-services/bws-ai-coding-template"
echo "   • GitHub: https://github.com/blockchain-web-services/bws-ai-coding-template/packages"
echo ""
echo "📥 Install with:"
echo "   npm install @blockchain-web-services/bws-ai-coding-template@${VERSION}"
echo ""
