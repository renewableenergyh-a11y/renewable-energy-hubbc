# 🚀 Quick Start: Deploy to Render

This is a **5-minute deployment checklist** to get your Aubie RET Hub running on Render.

## 1️⃣ Prepare Your Repository

```bash
# Make sure your code is clean and committed
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

## 2️⃣ Go to Render Dashboard

Visit: https://dashboard.render.com

## 3️⃣ Create New Blueprint

1. Click **"New +"** button
2. Select **"Blueprint"**
3. Connect your GitHub repository
4. The `render.yaml` will be auto-detected ✅
5. Click **"Create from Blueprint"**

This will automatically create:
- ✅ **aubie-ret-backend** (Node.js API)
- ✅ **aubie-ret-frontend** (Static files)
- ✅ **aubie-mongo** (MongoDB database)

## 4️⃣ Set Environment Variables

After blueprint is created, go to **aubie-ret-backend** service:

1. Click **Settings** → **Environment**
2. Add/update these variables:

### Required Variables

```
MONGODB_URI = mongodb+srv://user:password@cluster.mongodb.net/aubieret
NODE_ENV = production
```

### Optional Variables (if using payments/email)

```
PAYCHANGU_PUBLIC_KEY = your_public_key
PAYCHANGU_SECRET_KEY = your_secret_key
PAYCHANGU_ACCOUNT_ID = your_account_id
PAYCHANGU_ACCOUNT_NAME = Your Organization

SMTP_HOST = smtp.gmail.com
SMTP_PORT = 465
SMTP_USER = your-email@gmail.com
SMTP_PASS = your-app-password
SMTP_FROM = your-email@gmail.com
SMTP_SECURE = true
```

3. Click **"Save"** (auto-deploys)

## 5️⃣ Update Deployment URLs

After services are deployed, you'll have URLs like:
- Backend: `https://aubie-ret-backend-xxxxx.onrender.com`
- Frontend: `https://aubie-ret-frontend-xxxxx.onrender.com`

Update environment variables in **aubie-ret-backend**:

```
SITE_URL = https://aubie-ret-frontend-xxxxx.onrender.com
SERVER_URL = https://aubie-ret-backend-xxxxx.onrender.com
```

Click **"Save"** to redeploy.

## 6️⃣ Verify It Works

Open your frontend URL and test:

1. ✅ Page loads (index.html visible)
2. ✅ Login page displays
3. ✅ API calls work (open browser F12 → Network tab)
4. ✅ Database works (register account → stored in MongoDB)

### Debug API Issues

Open browser console (F12) and run:

```javascript
// Check API base URL
console.log(API_BASE)  // Should show '/api'

// Test a simple API call
fetch(API_BASE + '/health')
  .then(r => r.json())
  .then(d => console.log('✅ Backend works!', d))
  .catch(e => console.error('❌ Backend error:', e))
```

If API calls fail:
1. Check **aubie-ret-backend** logs in Render dashboard
2. Verify `MONGODB_URI` is correct
3. Ensure both services are in "Live" status

## 🎯 Common Issues & Solutions

| Problem | Solution |
|---------|----------|
| Build fails | Check that `server/package.json` exists with dependencies |
| API 404 errors | Verify frontend & backend services are on same platform |
| MongoDB connection error | Check `MONGODB_URI` format and IP whitelist in MongoDB Atlas |
| Deployment timeout | Increase service timeout in Render Settings |
| Static files not loading | Ensure frontend service `staticPublishPath` is `./` |

## 📊 Architecture After Deployment

```
Browser → render.onrender.com (Frontend)
           ↓
         /api/* → Backend API
           ↓
         MongoDB (Database)
         
         External: Paychangu (Payments), SMTP (Email)
```

## 🔄 Update Your App

After deployment, updates are simple:

```bash
git add .
git commit -m "Feature: Add new feature"
git push origin main
```

Render automatically detects changes and redeploys! (2-3 minutes)

## 📚 Full Documentation

For detailed setup: See `RENDER_DEPLOYMENT.md`

## 🆘 Need Help?

1. Check Render service logs: Dashboard → Service → Logs
2. Test API: Open browser console (F12) and run fetch commands
3. Common issues: See "Common Issues & Solutions" table above

---

**That's it! You're live! 🎉**

Once both services show "Live" in Render dashboard, your app is running on the internet.

