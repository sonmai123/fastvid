# FastVid Deployment Guide

## Deployment Options

### Option 1: Deploy Frontend to Vercel

#### Prerequisites
- Vercel account
- GitHub account with repository

#### Steps

1. **Push code to GitHub**
   ```bash
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Select `client` folder as root directory
   - Set environment variable:
     - `VITE_API_BASE`: Your backend URL (from Railway)
     - Example: `https://fastvid-backend.railway.app`

3. **Deploy**
   - Click "Deploy"
   - Vercel will automatically build and deploy

#### Vercel Build Settings
- **Framework:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm ci`

---

### Option 2: Deploy Backend to Railway

#### Prerequisites
- Railway account
- GitHub account with repository

#### Steps

1. **Prepare backend code**
   - Ensure `server/Dockerfile` exists
   - Ensure `server/package.json` has all dependencies

2. **Connect to Railway**
   - Go to https://railway.app
   - Click "New Project" → "Deploy from GitHub"
   - Select your repository
   - Select `server` folder as root directory

3. **Set Environment Variables**
   - PORT: `5000`
   - MONGO_USER: Your MongoDB Atlas user
   - MONGO_PASS: Your MongoDB Atlas password
   - MONGO_HOST: Your MongoDB cluster host
   - MONGO_DB: `fastvid`
   - JWT_SECRET: Generate a strong secret

4. **Deploy**
   - Railway will automatically detect Node.js and deploy
   - Get your backend URL (e.g., `https://fastvid-backend.railway.app`)

#### Railway Configuration
- Railway automatically detects Node.js
- Exposes PORT 5000
- Uses `npm start` command

---

### Option 3: Deploy Both to Railway

You can also deploy both frontend and backend to Railway:

1. **Frontend Service**
   - Deploy `client` directory
   - Build command: `npm run build`
   - Start command: `npm start` (using Vite preview)
   - Set `VITE_API_BASE` environment variable

2. **Backend Service**
   - Deploy `server` directory
   - Uses Dockerfile for deployment
   - Set environment variables as listed above

---

## Environment Variables

### Frontend (Vercel)
```
VITE_API_BASE=https://your-backend-domain.com
```

### Backend (Railway)
```
PORT=5000
MONGO_USER=mainganson11146_db_user
MONGO_PASS=f0R5R6YYD09Vm3mq
MONGO_HOST=cluster0.zhoxhpk.mongodb.net
MONGO_DB=fastvid
JWT_SECRET=your-long-random-secret-key
```

---

## Quick Deploy Commands

### Vercel CLI
```bash
cd client
npm install -g vercel
vercel
```

### Railway CLI
```bash
npm install -g @railway/cli
cd server
railway link
railway up
```

---

## Troubleshooting

### CORS Issues
- Ensure backend allows frontend domain in CORS headers
- Update `server/index.js` if needed:
  ```javascript
  app.use(cors({
    origin: 'https://your-frontend-domain.com'
  }));
  ```

### MongoDB Connection Issues
- Verify connection string format: `mongodb+srv://user:pass@host/dbname`
- Check MongoDB Atlas IP whitelist includes deployment service
- Ensure credentials are correct

### Build Failures
- Check Node.js version (use Node 18 or higher)
- Ensure all dependencies are installed
- Verify `.env` variables are set correctly

---

## Monitoring

### Vercel
- View logs: Vercel Dashboard → Project → Deployments
- Real-time logs available

### Railway
- View logs: Railway Dashboard → Project → Services
- Monitor resource usage and errors

---

## Custom Domain

### Frontend (Vercel)
1. Go to Project Settings → Domains
2. Add your domain
3. Update DNS records as instructed

### Backend (Railway)
1. Custom domains available in Project Settings
2. Configure DNS records
3. Use generated URL or custom domain

---

## Notes
- Keep `.env` files secure, never commit them
- Use strong JWT_SECRET (min 32 characters)
- MongoDB Atlas IP whitelist must include deployment IPs
- Frontend and backend should be able to communicate
- VITE_API_BASE on frontend must point to correct backend URL
