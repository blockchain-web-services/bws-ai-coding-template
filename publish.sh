#!/bin/bash

# Quick publish script for GitHub Packages
# Usage: ./publish.sh [patch|minor|major]

set -e

VERSION_TYPE=${1:-patch}

echo "📦 Publishing to GitHub Packages (@blockchain-web-services)"
echo "============================================================"
echo ""

# Check if authenticated
if ! grep -q "npm.pkg.github.com" ~/.npmrc 2>/dev/null; then
    echo "❌ Not authenticated with GitHub Packages"
    echo ""
    echo "Please authenticate first:"
    echo "  1. Create GitHub Personal Access Token with write:packages"
    echo "  2. Run: echo '//npm.pkg.github.com/:_authToken=YOUR_TOKEN' >> ~/.npmrc"
    echo ""
    echo "See PUBLISHING.md for detailed instructions"
    exit 1
fi

echo "✅ Authenticated with GitHub Packages"
echo ""

# Check if on main/staging branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "staging" ]]; then
    echo "⚠️  Warning: You're on branch '$CURRENT_BRANCH'"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo "❌ You have uncommitted changes"
    git status -s
    exit 1
fi

echo "✅ No uncommitted changes"
echo ""

# Bump version
echo "📝 Bumping version ($VERSION_TYPE)..."
OLD_VERSION=$(node -p "require('./package.json').version")
npm version $VERSION_TYPE --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")

echo "   $OLD_VERSION → $NEW_VERSION"
echo ""

# Commit version bump
echo "💾 Committing version bump..."
git add package.json
git commit -m "chore: bump version to $NEW_VERSION"

# Create tag
echo "🏷️  Creating git tag v$NEW_VERSION..."
git tag "v$NEW_VERSION"

# Push changes
echo "⬆️  Pushing to GitHub..."
git push origin $CURRENT_BRANCH
git push origin "v$NEW_VERSION"

# Publish to GitHub Packages
echo ""
echo "📤 Publishing to GitHub Packages..."
npm publish

echo ""
echo "✅ Successfully published!"
echo ""
echo "📊 Package Details:"
echo "   Name: @blockchain-web-services/bws-ai-coding-template"
echo "   Version: $NEW_VERSION"
echo "   Registry: https://npm.pkg.github.com"
echo ""
echo "🔗 View package:"
echo "   https://github.com/blockchain-web-services/bws-ai-coding-template/packages"
echo ""
echo "📥 Install with:"
echo "   npm install @blockchain-web-services/bws-ai-coding-template"
echo ""
