# 📤 Hướng Dẫn Push Code lên GitHub

## 🎯 Bước 1: Tạo Repository trên GitHub

1. **Truy cập GitHub**
   - Go to https://github.com/new
   - Đăng nhập GitHub account

2. **Tạo Repository mới**
   - Repository name: `fastvid`
   - Description: `FastVid - Quick Video Editor`
   - Chọn: **Public** (để Vercel/Railway access được)
   - ❌ Không check "Add .gitignore" (sẽ add sau)
   - ❌ Không check "Add README" (đã có sẵn trong project)
   - Click "Create repository"

3. **Copy Repository URL**
   - Lấy HTTPS URL: `https://github.com/your-username/fastvid.git`

---

## 🔧 Bước 2: Cấu Hình Git Locally

### 2.1: Cài đặt Git (nếu chưa có)
```bash
# Windows - Download từ https://git-scm.com
# macOS
brew install git

# Linux
sudo apt-get install git

# Verify
git --version
```

### 2.2: Cấu hình Git Config
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@gmail.com"

# Verify
git config --global --list
```

---

## 📁 Bước 3: Initialize Git trong Project

```bash
# Vào thư mục fastvid
cd C:\Users\ADMIN\fastvid

# Initialize repository
git init

# Thêm GitHub remote
git remote add origin https://github.com/your-username/fastvid.git

# Verify
git remote -v
```

---

## 🛑 Bước 4: Tạo/Update .gitignore

**File: `.gitignore` (root project)**

```
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
```

```bash
# Add to Git
git add .gitignore
git commit -m "Add .gitignore"
```

---

## 📝 Bước 5: Add Tất Cả Files

```bash
# Xem status
git status

# Add tất cả files
git add .

# Xem staging area
git diff --cached

# Commit lần đầu tiên
git commit -m "Initial commit: FastVid application with all features"
```

---

## 🚀 Bước 6: Push lên GitHub

```bash
# Set default branch (main hoặc master)
git branch -M main

# Push lên GitHub
git push -u origin main

# Hoặc nếu branch là master
git push -u origin master
```

**Kết quả:**
- Code sẽ được push lên GitHub
- GitHub sẽ yêu cầu xác thực nếu cần

---

## 🔐 Bước 7: Xác Thực GitHub (Nếu Cần)

### Option A: HTTPS Token
```bash
# GitHub sẽ yêu cầu personal access token
# Go to: https://github.com/settings/tokens
# Create New Token → Select "repo" scope → Copy token
# Paste token khi GitHub hỏi password
```

### Option B: SSH Key (Recommended)
```bash
# Tạo SSH key
ssh-keygen -t ed25519 -C "your.email@gmail.com"

# Add to ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Copy public key
cat ~/.ssh/id_ed25519.pub

# Go to: https://github.com/settings/ssh/new
# Paste public key
# Test: ssh -T git@github.com
```

---

## ✅ Bước 8: Verify Upload

```bash
# Kiểm tra trên GitHub
https://github.com/your-username/fastvid

# Hoặc verify từ terminal
git log
git branch -a
```

---

## 📋 Files được Push

```
fastvid/
├── client/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   ├── Dockerfile
│   ├── vercel.json
│   └── .env.example
├── server/
│   ├── index.js
│   ├── package.json
│   ├── Dockerfile
│   ├── railway.json
│   ├── .dockerignore
│   ├── prisma/
│   └── .env.example
├── .github/
│   └── workflows/
│       └── deploy.yml
├── docker-compose.yml
├── .gitignore
├── DEPLOYMENT_GUIDE.md
├── DEPLOYMENT_SUMMARY.md
├── DEPLOY_README.md
├── DEPLOYMENT_CHECKLIST.md
└── README.md
```

---

## 🔄 Câu Lệnh Git Thường Dùng

```bash
# Xem status
git status

# Xem history
git log
git log --oneline

# Thêm files cụ thể
git add client/src/
git add server/index.js

# Commit với message
git commit -m "Feature: add dark mode toggle"

# Push lên GitHub
git push origin main

# Pull từ GitHub
git pull origin main

# Tạo branch mới
git checkout -b feature/new-feature

# Switch branch
git checkout main

# Rename branch
git branch -m old-name new-name

# Delete branch
git branch -d branch-name
```

---

## 🔌 Kết Nối với Vercel & Railway

### After Push to GitHub:

**Vercel:**
1. Go to https://vercel.com
2. Click "New Project"
3. "Import Git Repository"
4. Select `fastvid` repo
5. Select `client` folder as root
6. Deploy!

**Railway:**
1. Go to https://railway.app
2. "New Project"
3. "Deploy from GitHub"
4. Select `fastvid` repo
5. Select `server` folder
6. Deploy!

---

## ⚠️ Important Notes

1. **Never commit `.env` files**
   - GitHub will reject if you try
   - Use `.env.example` instead

2. **Large files**
   - FFmpeg files: Add to `.gitignore`
   - Media files: Add to `.gitignore`

3. **Private repository?**
   - For production: Maybe use Private repo
   - For Vercel/Railway: They can access Private repos if authorized

4. **Credentials**
   - Never hardcode secrets
   - Use environment variables only

---

## 🆘 Troubleshooting

### Error: Permission denied (publickey)
```bash
# SSH issue - use HTTPS instead
git remote set-url origin https://github.com/your-username/fastvid.git
```

### Error: Repository not found
```bash
# Check remote URL
git remote -v

# Update if wrong
git remote set-url origin https://github.com/your-username/fastvid.git
```

### Error: Please commit or stash
```bash
# Stash uncommitted changes
git stash

# Or commit them
git add .
git commit -m "WIP"
```

---

## ✨ After GitHub Push

Your code is now ready for:
- ✅ Deploy to Vercel (Frontend)
- ✅ Deploy to Railway (Backend)
- ✅ Collaborate with team
- ✅ Version control
- ✅ CI/CD with GitHub Actions

**Next: Connect repos to Vercel & Railway!**
