#!/bin/bash

# FastVid GitHub Setup Script

echo "🚀 FastVid GitHub Setup"
echo "========================"

# Step 1: Configure Git
echo ""
echo "Step 1: Configure Git"
read -p "Enter your name: " git_name
read -p "Enter your email: " git_email

git config --global user.name "$git_name"
git config --global user.email "$git_email"

echo "✅ Git configured"

# Step 2: Initialize repository
echo ""
echo "Step 2: Initialize Repository"
cd "$(dirname "$0")"

git init
echo "✅ Repository initialized"

# Step 3: Add remote
echo ""
echo "Step 3: Add Remote"
read -p "Enter GitHub repository URL (e.g., https://github.com/username/fastvid.git): " repo_url

git remote add origin "$repo_url"
git remote -v

echo "✅ Remote added"

# Step 4: Create .gitignore
echo ""
echo "Step 4: Create .gitignore"

cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log
yarn-error.log
pnpm-error.log

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Build
dist/
build/

# Logs
logs/
*.log

# Project
server/tmp/
server/media/
tmp/
media/

# Other
.cache/
.next/
out/
EOF

git add .gitignore
git commit -m "Add .gitignore"
echo "✅ .gitignore created"

# Step 5: Add all files
echo ""
echo "Step 5: Adding all files"
git add .

echo "Files to commit:"
git diff --cached --name-only | head -20

read -p "Proceed with commit? (y/n) " proceed

if [ "$proceed" = "y" ]; then
  git commit -m "Initial commit: FastVid application with all features"
  echo "✅ Files committed"
else
  echo "❌ Commit cancelled"
  exit 1
fi

# Step 6: Set main branch
echo ""
echo "Step 6: Set main branch"
git branch -M main
echo "✅ Main branch set"

# Step 7: Push to GitHub
echo ""
echo "Step 7: Push to GitHub"
echo "You may be prompted for authentication"

git push -u origin main

if [ $? -eq 0 ]; then
  echo "✅ Successfully pushed to GitHub!"
  echo ""
  echo "🎉 Setup Complete!"
  echo "Your code is now on GitHub"
  echo ""
  echo "Next steps:"
  echo "1. Connect to Vercel: https://vercel.com/new"
  echo "2. Connect to Railway: https://railway.app"
  echo ""
  echo "Repository URL: $repo_url"
else
  echo "❌ Push failed. Check your credentials and try again."
  exit 1
fi
