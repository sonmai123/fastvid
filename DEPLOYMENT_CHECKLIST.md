# 📋 Pre-Deployment Checklist

## ✅ Code Preparation

- [ ] All errors and warnings fixed in console
- [ ] `.env` files are in `.gitignore` (never commit secrets)
- [ ] `package.json` has all required dependencies
- [ ] Backend starts with `npm start`
- [ ] Frontend builds with `npm run build`
- [ ] Docker builds successfully: `docker build -t fastvid-backend ./server`

---

## ✅ MongoDB Atlas Preparation

- [ ] MongoDB Atlas account created
- [ ] Database cluster created (`cluster0`)
- [ ] Database user created:
  - Username: `mainganson11146_db_user`
  - Password: `f0R5R6YYD09Vm3mq`
- [ ] Connection string test works
- [ ] IP whitelist includes:
  - `0.0.0.0/0` (for open access) OR
  - Specific Railway IP ranges (recommended)

---

## ✅ Vercel Preparation (Frontend)

- [ ] Vercel account created
- [ ] GitHub repository with code pushed
- [ ] Repository is public or authorized to Vercel
- [ ] Node.js version 18+ selected
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`

---

## ✅ Railway Preparation (Backend)

- [ ] Railway account created
- [ ] GitHub repository connected
- [ ] Service detection: Node.js detected
- [ ] Main file: `server/index.js`
- [ ] Dockerfile present in `server/` directory
- [ ] Memory and CPU resources sufficient

---

## ✅ Environment Variables

### Frontend (Vercel)
```
VITE_API_BASE = [backend-railway-url]
```
Get this URL from Railway after backend deployment

### Backend (Railway)
```
PORT=5000
MONGO_USER=mainganson11146_db_user
MONGO_PASS=f0R5R6YYD09Vm3mq
MONGO_HOST=cluster0.zhoxhpk.mongodb.net
MONGO_DB=fastvid
JWT_SECRET=[generate-random-32-char-string]
```

---

## ✅ Files to Verify

- [ ] `client/vercel.json` exists
- [ ] `client/Dockerfile` exists
- [ ] `server/Dockerfile` exists
- [ ] `server/railway.json` exists
- [ ] `server/.dockerignore` exists
- [ ] `docker-compose.yml` exists at root
- [ ] `.github/workflows/deploy.yml` exists (optional)

---

## ✅ Security Check

- [ ] `.env` is in `.gitignore`
- [ ] No API keys in code
- [ ] No hardcoded passwords
- [ ] JWT_SECRET is strong (32+ characters)
- [ ] MongoDB credentials are correct
- [ ] CORS headers are secure

---

## 🚀 Deployment Steps

### Step 1: Deploy Backend to Railway
1. [ ] Go to railway.app
2. [ ] Create new project from GitHub
3. [ ] Select `server` folder
4. [ ] Set all environment variables
5. [ ] Deploy
6. [ ] Copy backend URL (e.g., `https://fastvid-backend.railway.app`)

### Step 2: Deploy Frontend to Vercel
1. [ ] Go to vercel.com/new
2. [ ] Import GitHub repo
3. [ ] Select `client` folder
4. [ ] Set `VITE_API_BASE=<railway-backend-url>`
5. [ ] Deploy
6. [ ] Get frontend URL

### Step 3: Test
1. [ ] Open frontend URL in browser
2. [ ] Check browser console for errors
3. [ ] Test login/upload functionality
4. [ ] Check Network tab for API calls

---

## 📞 Support

If deployment fails:
1. Check Railway logs for backend errors
2. Check Vercel logs for frontend errors
3. Verify MongoDB connection: `mongod --version`
4. Verify environment variables are set correctly
5. Check CORS errors in browser console

---

## ✨ Post-Deployment

- [ ] Custom domain configured (optional)
- [ ] SSL/HTTPS working
- [ ] Database backups scheduled
- [ ] Monitoring enabled
- [ ] Error alerts configured
- [ ] Documented deployment URL

---

**Ready? Let's deploy! 🚀**
