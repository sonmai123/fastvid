# 🎯 Git & GitHub Quick Start

## ⚡ CÁCH NHANH NHẤT (5 phút)

### Nếu bạn dùng Windows PowerShell:
```powershell
# 1. Mở PowerShell ở fastvid folder
cd C:\Users\ADMIN\fastvid

# 2. Chạy script
.\setup-github.ps1

# 3. Follow prompts
```

### Nếu bạn dùng Git Bash / Command Line:
```bash
# 1. Mở terminal ở fastvid
cd C:\Users\ADMIN\fastvid

# 2. Chạy script
bash setup-github.sh

# 3. Follow prompts
```

---

## 📝 Hoặc làm thủ công (Step by Step)

### Step 1: Setup Git
```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

### Step 2: Init & Commit
```bash
cd C:\Users\ADMIN\fastvid
git init
git add .
git commit -m "Initial commit"
```

### Step 3: Add Remote
```bash
# Copy URL từ GitHub (Create new repo https://github.com/new)
git remote add origin https://github.com/YOUR-USERNAME/fastvid.git
git branch -M main
```

### Step 4: Push
```bash
git push -u origin main
```

---

## ✅ Kết Quả Kì Vọng

✔️ Code được push lên GitHub  
✔️ All folders/files visible trên GitHub  
✔️ Ready để Vercel/Railway access  

---

## 🔗 Tiếp Theo

1. **Vercel Setup**
   - Go to vercel.com/new
   - Import fastvid repo
   - Select "client" folder
   - Deploy!

2. **Railway Setup**
   - Go to railway.app
   - New Project → Deploy from GitHub
   - Select "server" folder
   - Deploy!

---

Chi tiết xem: `GITHUB_SETUP.md`
