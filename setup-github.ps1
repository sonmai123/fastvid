# FastVid GitHub Setup Script (Windows PowerShell)

Write-Host "🚀 FastVid GitHub Setup" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan

# Step 1: Configure Git
Write-Host ""
Write-Host "Step 1: Configure Git" -ForegroundColor Yellow
$gitName = Read-Host "Enter your name"
$gitEmail = Read-Host "Enter your email"

git config --global user.name $gitName
git config --global user.email $gitEmail

Write-Host "✅ Git configured" -ForegroundColor Green

# Step 2: Initialize repository
Write-Host ""
Write-Host "Step 2: Initialize Repository" -ForegroundColor Yellow
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath

git init
Write-Host "✅ Repository initialized" -ForegroundColor Green

# Step 3: Add remote
Write-Host ""
Write-Host "Step 3: Add Remote" -ForegroundColor Yellow
$repoUrl = Read-Host "Enter GitHub repository URL (e.g., https://github.com/username/fastvid.git)"

git remote add origin $repoUrl
git remote -v

Write-Host "✅ Remote added" -ForegroundColor Green

# Step 4: Create .gitignore
Write-Host ""
Write-Host "Step 4: Create .gitignore" -ForegroundColor Yellow

$gitignoreContent = @"
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
"@

Set-Content -Path ".gitignore" -Value $gitignoreContent
git add .gitignore
git commit -m "Add .gitignore"
Write-Host "✅ .gitignore created" -ForegroundColor Green

# Step 5: Add all files
Write-Host ""
Write-Host "Step 5: Adding all files" -ForegroundColor Yellow
git add .

Write-Host "Files to commit:" -ForegroundColor Gray
git diff --cached --name-only | Select-Object -First 20

$proceed = Read-Host "Proceed with commit? (y/n)"

if ($proceed -eq "y") {
  git commit -m "Initial commit: FastVid application with all features"
  Write-Host "✅ Files committed" -ForegroundColor Green
} else {
  Write-Host "❌ Commit cancelled" -ForegroundColor Red
  exit 1
}

# Step 6: Set main branch
Write-Host ""
Write-Host "Step 6: Set main branch" -ForegroundColor Yellow
git branch -M main
Write-Host "✅ Main branch set" -ForegroundColor Green

# Step 7: Push to GitHub
Write-Host ""
Write-Host "Step 7: Push to GitHub" -ForegroundColor Yellow
Write-Host "You may be prompted for authentication" -ForegroundColor Gray

git push -u origin main

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
  Write-Host ""
  Write-Host "🎉 Setup Complete!" -ForegroundColor Green
  Write-Host "Your code is now on GitHub" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "Next steps:" -ForegroundColor Yellow
  Write-Host "1. Connect to Vercel: https://vercel.com/new"
  Write-Host "2. Connect to Railway: https://railway.app"
  Write-Host ""
  Write-Host "Repository URL: $repoUrl" -ForegroundColor Cyan
} else {
  Write-Host ""
  Write-Host "❌ Push failed. Check your credentials and try again." -ForegroundColor Red
  exit 1
}
