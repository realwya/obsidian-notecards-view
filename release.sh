#!/bin/bash

# Obsidian Plugin Release Script
# Usage: npm run release 1.2.0

set -e  # Exit on error

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "❌ Error: Version number is required"
  echo "Usage: npm run release <version>"
  echo "Example: npm run release 1.2.0"
  exit 1
fi

# Validate version format (basic check for semver)
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌ Error: Invalid version format. Use semantic versioning (e.g., 1.2.0)"
  exit 1
fi

echo "🚀 Starting release for version $VERSION"

# Step 1: Update version using npm version
echo "📝 Updating package.json to $VERSION..."
npm version $VERSION --no-git-tag-version

# Step 2: Run version-bump script to update manifest.json and versions.json
echo "📝 Updating manifest.json and versions.json..."
node version-bump.mjs

# Step 3: Commit changes
echo "💾 Committing version changes..."
git add package.json manifest.json versions.json
git commit -m "release $VERSION"

# Step 4: Delete existing tag if it exists and create annotated tag
echo "🏷️  Creating annotated tag $VERSION..."
if git rev-parse "$VERSION" >/dev/null 2>&1; then
  git tag -d $VERSION
  git push origin :refs/tags/$VERSION 2>/dev/null || true
fi
git tag -a $VERSION -m "Release $VERSION"

# Step 5: Push commit and tag
echo "📤 Pushing to GitHub..."
git push origin master
git push origin $VERSION

echo ""
echo "✅ Release $VERSION completed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Wait for GitHub Actions to build the draft release"
echo "   2. Visit: https://github.com/realwya/obsidian-sample-plugin/releases"
echo "   3. Review and publish the draft release"
echo ""
