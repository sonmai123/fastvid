# FastVid - Deployment Setup

## 📋 Nhanh Chóng

### Deploy Frontend lên Vercel
```bash
cd client
npm install -g vercel
vercel
# Chọn project, set VITE_API_BASE environment variable
```

### Deploy Backend lên Railway
```bash
cd server
npm install -g @railway/cli
railway link
railway up
# Hoặc push lên GitHub và connect với Railway
```

---

## 🚀 Chi Tiết Deployment

### **Frontend to Vercel**
1. Đăng nhập vào [vercel.com](https://vercel.com)
2. Click "New Project" → Import GitHub repo
3. Select `client` folder as root
4. Environment variables:
   ```
   VITE_API_BASE=https://your-railway-backend-url
   ```
5. Deploy!

### **Backend to Railway**
1. Đăng nhập vào [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Select `server` folder
4. Environment variables:
   ```
   PORT=5000
   MONGO_USER=mainganson11146_db_user
   MONGO_PASS=f0R5R6YYD09Vm3mq
   MONGO_HOST=cluster0.zhoxhpk.mongodb.net
   MONGO_DB=fastvid
   JWT_SECRET=<generate-strong-secret>
   ```

---

## 🐳 Docker Deployment

### Local Testing với Docker Compose
```bash
docker-compose up --build
# Frontend: http://localhost:5173
# Backend: http://localhost:5000
```

### Deploy Docker Image
```bash
# Backend
cd server
docker build -t fastvid-backend .
docker run -p 5000:5000 -e MONGO_HOST=... fastvid-backend

# Frontend
cd client
docker build -t fastvid-frontend --build-arg VITE_API_BASE=http://your-backend .
docker run -p 3000:3000 fastvid-frontend
```

---

## 📁 Files Created

- **`Dockerfile`** - Docker image configuration
- **`.dockerignore`** - Exclude files from Docker build
- **`docker-compose.yml`** - Multi-container setup
- **`vercel.json`** - Vercel deployment config
- **`railway.json`** - Railway deployment config
- **`.env.example`** - Environment variables template

---

## ⚠️ Important

1. **Never commit `.env`** - Only commit `.env.example`
2. **Update VITE_API_BASE** - Point to your deployed backend URL
3. **MongoDB Atlas IP Whitelist** - Add deployment service IPs
4. **JWT_SECRET** - Use a strong random secret (32+ characters)

---

## 🔗 Useful Links

- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Docker Docs](https://docs.docker.com)

---

Sau deploy xong, update VITE_API_BASE ở frontend để point tới backend URL!
