# 📦 Aubie RET Hub - Render Deployment Package

This package contains everything needed to deploy the Aubie RET Hub to Render.

## 📁 What's Included

### Configuration Files
- **`render.yaml`** - Render blueprint for automatic infrastructure setup
- **`server/.env.template`** - Environment variable template for configuration

### Documentation
- **`RENDER_QUICK_START.md`** ⭐ **START HERE** - 5-minute deployment guide
- **`RENDER_DEPLOYMENT.md`** - Comprehensive deployment documentation
- **`RENDER_TROUBLESHOOTING.md`** - Solutions for common issues

### Scripts
- **`test-render-config.sh`** - Validate your setup before deployment

### Updated Code
- **`server/index.js`** - Enhanced CORS configuration for production
- **`js/api-config.js`** - Updated to detect Render deployment URLs

---

## 🚀 Quick Start (5 Minutes)

### 1. Push Code to GitHub
```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### 2. Create Blueprint in Render
1. Visit https://dashboard.render.com
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render will auto-detect `render.yaml` ✅
5. Click **"Create from Blueprint"**

### 3. Add Environment Variables

After blueprint deploys, go to **aubie-ret-backend** service and set:

**Required:**
```
MONGODB_URI = mongodb+srv://user:password@cluster.mongodb.net/aubieret
NODE_ENV = production
```

**Optional** (if using payments/email):
```
PAYCHANGU_PUBLIC_KEY = your_key
PAYCHANGU_SECRET_KEY = your_secret
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 465
SMTP_USER = your-email@gmail.com
SMTP_PASS = your-app-password
SMTP_FROM = your-email@gmail.com
SMTP_SECURE = true
```

### 4. Update Deployment URLs

Once services are deployed:
```
SITE_URL = https://aubie-ret-frontend-xxxxx.onrender.com
SERVER_URL = https://aubie-ret-backend-xxxxx.onrender.com
```

### 5. Test It
Open your frontend URL and verify:
- ✅ Page loads
- ✅ No 404 errors
- ✅ API calls work (test in browser F12)
- ✅ Can register & login

---

## 📋 What Gets Deployed

```
Render Services:
├── aubie-ret-backend    [Node.js on port 10000]
│   ├── API routes (/api/*)
│   ├── File uploads (videos, avatars)
│   └── Database connections
│
├── aubie-ret-frontend   [Static files]
│   ├── HTML pages
│   ├── CSS/JavaScript
│   ├── Assets
│   └── Routes /api/* → Backend
│
└── aubie-mongo          [MongoDB database]
    └── All user data, courses, sessions
```

---

## 🔑 Key Features

✅ **Same-Origin API Communication**
- Frontend and backend on same domain
- Automatic `/api` routing to backend
- No CORS issues

✅ **Production-Ready CORS**
- Flexible origin validation
- Supports all deployment scenarios
- Secure by default

✅ **Environment Detection**
- Automatically detects Render domain
- Uses `/api` for API calls
- No hardcoded URLs

✅ **MongoDB Integration**
- Render-managed database
- Or use MongoDB Atlas
- Easy connection management

✅ **Payment & Email Support**
- Paychangu integration ready
- SMTP email notifications
- Webhook support for callbacks

---

## 📚 Documentation Map

1. **Just want to deploy?** → Read `RENDER_QUICK_START.md`
2. **Need detailed setup?** → Read `RENDER_DEPLOYMENT.md`
3. **Something's broken?** → Read `RENDER_TROUBLESHOOTING.md`
4. **Understanding the system?** → See "Architecture Overview" below

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────┐
│         Render.com Infrastructure                │
├─────────────────────────────────────────────────┤
│                                                   │
│  Domain: aubie-ret-frontend.onrender.com         │
│  ├─ Static Frontend Files                        │
│  │  ├─ index.html                                │
│  │  ├─ login.html, register.html                 │
│  │  ├─ modules.html, courses.html                │
│  │  ├─ css/style.css                             │
│  │  └─ js/api-config.js → API_BASE = '/api'     │
│  │                                                │
│  └─ Route: /api/* → aubie-ret-backend:10000/api  │
│                                                   │
│  Domain: aubie-ret-backend.onrender.com          │
│  ├─ Node.js Express Server (Port 10000)         │
│  │  ├─ /api/auth/* - Authentication              │
│  │  ├─ /api/courses/* - Course management        │
│  │  ├─ /api/modules/* - Module content           │
│  │  ├─ /api/videos/* - Video uploads             │
│  │  ├─ /api/gamification/* - Stats & leaderboard│
│  │  └─ [10+ more API endpoints]                 │
│  │                                                │
│  └─ Connected to: aubie-mongo database           │
│                                                   │
│  Database: aubie-mongo                           │
│  └─ MongoDB with collections:                   │
│     ├─ users                                     │
│     ├─ sessions                                  │
│     ├─ courses                                   │
│     ├─ modules                                   │
│     └─ [10+ more collections]                   │
│                                                   │
│  External Services:                              │
│  ├─ Paychangu (Payment Processing)              │
│  ├─ SMTP (Email Service)                        │
│  └─ File Storage (Render's /tmp + DB)          │
│                                                   │
└─────────────────────────────────────────────────┘

User Browser Flow:
1. Visit aubie-ret-frontend.onrender.com
2. Browser loads index.html, css, javascript
3. JavaScript runs api-config.js → API_BASE = '/api'
4. User clicks login
5. fetch('/api/auth/login') → Render routes to backend
6. Backend processes → Returns user data from MongoDB
7. Frontend updates UI
```

---

## 🔧 Environment Variables Explained

### Required Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `PORT` | Server port (Render sets to 10000) | `10000` |
| `NODE_ENV` | Environment mode | `production` |
| `MONGODB_URI` | Database connection | `mongodb+srv://...` |

### Payment Variables (Optional)

| Variable | Purpose | Where to Get |
|----------|---------|---|
| `PAYCHANGU_PUBLIC_KEY` | Payment API key | Paychangu dashboard |
| `PAYCHANGU_SECRET_KEY` | Payment secret | Paychangu dashboard |
| `PAYCHANGU_ACCOUNT_ID` | Account identifier | Paychangu dashboard |
| `PAYCHANGU_ACCOUNT_NAME` | Organization name | Your organization |

### Email Variables (Optional)

| Variable | Purpose | Example |
|----------|---------|---------|
| `SMTP_HOST` | Email server | `smtp.gmail.com` |
| `SMTP_PORT` | Email port | `465` |
| `SMTP_USER` | Email address | `your@gmail.com` |
| `SMTP_PASS` | Email password or token | App password from Gmail |
| `SMTP_FROM` | Sender email | `noreply@yourdomain.com` |
| `SMTP_SECURE` | Use TLS | `true` |

### Deployment URLs (Optional)

| Variable | Purpose | Set After Deployment |
|----------|---------|---|
| `SITE_URL` | Frontend URL (for email links) | `https://aubie-ret-frontend-xxx.onrender.com` |
| `SERVER_URL` | Backend URL (for webhooks) | `https://aubie-ret-backend-xxx.onrender.com` |

---

## ✅ Pre-Deployment Checklist

Before deploying, verify:

- [ ] Code committed to GitHub
- [ ] `render.yaml` exists in root directory
- [ ] `server/package.json` has all dependencies
- [ ] `server/index.js` runs without errors locally
- [ ] `js/api-config.js` detects deployment URLs
- [ ] All HTML files load correctly
- [ ] MongoDB account ready (Atlas or Render)
- [ ] Optional: Paychangu and SMTP accounts created

---

## 🔍 Monitoring After Deployment

### Render Dashboard
- Check service status: Should be **"Live"** (green)
- View logs: Click **"Logs"** tab for debugging
- Monitor performance: Check CPU and memory usage

### Testing APIs
```javascript
// Open browser console (F12) and run:
console.log(API_BASE)  // Should show '/api'

// Test backend connection:
fetch(API_BASE + '/health')
  .then(r => r.json())
  .then(d => console.log('✅ Backend works!', d))
  .catch(e => console.error('❌ Error:', e))
```

---

## 📞 Support Resources

1. **Render Documentation**: https://render.com/docs
2. **Express.js Guide**: https://expressjs.com/
3. **MongoDB Docs**: https://docs.mongodb.com/
4. **Troubleshooting**: See `RENDER_TROUBLESHOOTING.md`

---

## 🎉 You're Ready to Deploy!

Follow `RENDER_QUICK_START.md` to get your app live in 5 minutes.

Once deployed, your app will be accessible 24/7 on the internet with:
- ✅ Automatic HTTPS/SSL
- ✅ Global CDN for static files
- ✅ MongoDB database
- ✅ Automatic restart on failures
- ✅ Easy scaling and updates

**Happy deploying! 🚀**

