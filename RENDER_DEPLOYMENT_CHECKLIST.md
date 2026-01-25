# ✅ Render Deployment Checklist

Follow this checklist step-by-step to deploy your Aubie RET Hub to Render.

---

## Phase 1: Preparation (5 minutes)

- [ ] **1.1** All code changes committed locally
  ```bash
  git status  # Should show "nothing to commit"
  ```

- [ ] **1.2** Code pushed to GitHub
  ```bash
  git push origin main
  ```

- [ ] **1.3** Verify files on GitHub
  - Go to https://github.com/YOUR_USERNAME/YOUR_REPO
  - Confirm `render.yaml` is visible
  - Confirm `server/package.json` exists
  - Confirm frontend HTML files exist

- [ ] **1.4** Have credentials ready
  - [ ] GitHub account logged in
  - [ ] Render account created (free tier OK)
  - [ ] MongoDB credentials (Atlas or use Render's DB)
  - [ ] Paychangu keys (if using payments)
  - [ ] SMTP credentials (if using email)

---

## Phase 2: Create Render Blueprint (5 minutes)

- [ ] **2.1** Go to Render Dashboard
  - Visit https://dashboard.render.com
  - Click **"New +"** button

- [ ] **2.2** Create Blueprint
  - Click **"Blueprint"**
  - Connect GitHub (authorize if needed)
  - Select your repository
  - Choose branch: `main`

- [ ] **2.3** Auto-Detection
  - Render should detect `render.yaml` automatically ✓
  - Should show:
    - [ ] aubie-ret-backend service
    - [ ] aubie-ret-frontend service  
    - [ ] aubie-mongo database

- [ ] **2.4** Click "Create from Blueprint"
  - Deployment will start automatically
  - Services will build and deploy (5-10 minutes)
  - Watch for "Live" status on all services

---

## Phase 3: Configure Environment Variables (5 minutes)

### Step 3A: Navigate to Backend Settings
- [ ] **3.1** Go to aubie-ret-backend service
  - Dashboard → Click **"aubie-ret-backend"**
  - Should see: "Building" → "Live"

- [ ] **3.2** Open Settings
  - Click **"Settings"** tab
  - Find **"Environment"** section

### Step 3B: Add Required Variables
- [ ] **3.3** Set MONGODB_URI
  ```
  MONGODB_URI = mongodb+srv://user:password@cluster.mongodb.net/aubieret
  ```
  - [ ] Pasted from MongoDB Atlas or Render

- [ ] **3.4** Verify NODE_ENV
  ```
  NODE_ENV = production
  ```
  - Should already be set

### Step 3C: Add Payment Variables (Optional)
If using Paychangu:
- [ ] **3.5** PAYCHANGU_PUBLIC_KEY
  ```
  PAYCHANGU_PUBLIC_KEY = pub-xxxxx...
  ```

- [ ] **3.6** PAYCHANGU_SECRET_KEY
  ```
  PAYCHANGU_SECRET_KEY = sec-xxxxx...
  ```

- [ ] **3.7** PAYCHANGU_ACCOUNT_ID
  ```
  PAYCHANGU_ACCOUNT_ID = 1234567
  ```

- [ ] **3.8** PAYCHANGU_ACCOUNT_NAME
  ```
  PAYCHANGU_ACCOUNT_NAME = Your Organization
  ```

### Step 3D: Add Email Variables (Optional)
If using Gmail for emails:
- [ ] **3.9** SMTP_HOST
  ```
  SMTP_HOST = smtp.gmail.com
  ```

- [ ] **3.10** SMTP_PORT
  ```
  SMTP_PORT = 465
  ```

- [ ] **3.11** SMTP_USER
  ```
  SMTP_USER = your-email@gmail.com
  ```

- [ ] **3.12** SMTP_PASS
  ```
  SMTP_PASS = your-app-password
  ```
  - Get from https://myaccount.google.com/apppasswords

- [ ] **3.13** SMTP_FROM
  ```
  SMTP_FROM = your-email@gmail.com
  ```

- [ ] **3.14** SMTP_SECURE
  ```
  SMTP_SECURE = true
  ```

### Step 3E: Save Configuration
- [ ] **3.15** Click "Save" button
  - Backend will automatically redeploy with new environment variables
  - Wait for "Live" status (2-3 minutes)

---

## Phase 4: Update Deployment URLs (3 minutes)

### Step 4A: Get Your Service URLs
- [ ] **4.1** Find Backend URL
  - Dashboard → Click each service to see URL
  - Should look like: `https://aubie-ret-backend-xxxxx.onrender.com`

- [ ] **4.2** Find Frontend URL
  - Frontend service URL: `https://aubie-ret-frontend-xxxxx.onrender.com`

### Step 4B: Update Backend Settings
- [ ] **4.3** Go to aubie-ret-backend Settings → Environment

- [ ] **4.4** Add SITE_URL
  ```
  SITE_URL = https://aubie-ret-frontend-xxxxx.onrender.com
  ```
  - Copy your actual frontend URL

- [ ] **4.5** Add SERVER_URL
  ```
  SERVER_URL = https://aubie-ret-backend-xxxxx.onrender.com
  ```
  - Copy your actual backend URL

- [ ] **4.6** Click Save
  - Backend redeploys with correct URLs for payment callbacks

---

## Phase 5: Verify Deployment (5 minutes)

### Step 5A: Check Service Status
- [ ] **5.1** All services showing "Live"
  - Dashboard should show all services in green
  - [ ] aubie-ret-backend: Live ✓
  - [ ] aubie-ret-frontend: Live ✓
  - [ ] aubie-mongo: Live ✓

### Step 5B: Test Frontend
- [ ] **5.2** Open frontend URL in browser
  ```
  https://aubie-ret-frontend-xxxxx.onrender.com
  ```

- [ ] **5.3** Verify page loads
  - See index.html content
  - CSS styles applied (not plain HTML)
  - Navigation menu visible

- [ ] **5.4** Check for JavaScript errors
  - Press F12 (Developer Tools)
  - Click "Console" tab
  - Should see NO red error messages

### Step 5C: Test API Connection
- [ ] **5.5** Test API Base URL
  ```javascript
  // In browser console (F12), type:
  console.log(API_BASE)
  // Should output: /api
  ```

- [ ] **5.6** Test API Endpoint
  ```javascript
  // In browser console (F12), run:
  fetch(API_BASE + '/health')
    .then(r => r.json())
    .then(d => console.log('✅ Backend works!', d))
    .catch(e => console.error('❌ Backend error:', e))
  // Should see: ✅ Backend works!
  ```

### Step 5D: Test User Features
- [ ] **5.7** Test Registration
  - Navigate to Register page
  - Fill in registration form
  - Submit (should save to MongoDB)

- [ ] **5.8** Test Login
  - Go to Login page
  - Enter registered email/password
  - Should log in successfully

- [ ] **5.9** Test Navigation
  - Click different menu items
  - No 404 errors
  - Pages load correctly

---

## Phase 6: Test Key Features (5-10 minutes)

### If Payment Enabled:
- [ ] **6.1** Test Payment Flow
  - Navigate to billing/payment page
  - Attempt test payment with Paychangu
  - Verify webhook received by backend

### If Email Enabled:
- [ ] **6.2** Test Email Sending
  - Use "Forgot Password" feature
  - Check email (may take 1-2 minutes)
  - Verify reset code received

### General Features:
- [ ] **6.3** Test Video Upload (if enabled)
  - Navigate to upload page
  - Upload test video
  - Verify in backend logs

- [ ] **6.4** Test Database Persistence
  - Register account
  - Refresh browser (F5)
  - Account still logged in? ✓

- [ ] **6.5** Test Responsive Design
  - Press F12 → Click mobile icon
  - Test on iPhone/Android view
  - Layout adjusts correctly

---

## Phase 7: Monitoring (Ongoing)

### Daily Monitoring
- [ ] **7.1** Check Render Dashboard daily
  - All services showing "Live"
  - No recent errors in logs

- [ ] **7.2** Monitor Logs
  - Dashboard → Service → Logs
  - Look for errors (❌ prefix)
  - Check for database connection issues

### Alerts Setup (Recommended)
- [ ] **7.3** Enable Render Notifications
  - Service Settings → Notifications
  - Enable email alerts for failures

- [ ] **7.4** Monitor Database
  - Log into MongoDB Atlas/Render
  - Check database size growth
  - Monitor connection count

---

## Phase 8: Ongoing Maintenance

### Updates & Changes
- [ ] **8.1** Make code changes locally
  ```bash
  git add .
  git commit -m "Description of changes"
  git push origin main
  ```
  - Render auto-detects and redeploys (2-3 min)

- [ ] **8.2** Manual Redeploy (if needed)
  - Dashboard → Service → Manual Deploy → Deploy

### Backup & Recovery
- [ ] **8.3** Database Backups
  - MongoDB Atlas: Enable automated backups
  - Or: Export data monthly

- [ ] **8.4** Code Backups
  - All code in GitHub (automatic)
  - Can rollback to any previous commit

---

## ✅ Deployment Complete!

Your app is now **LIVE** on the internet! 🎉

- ✅ Frontend accessible at: `https://aubie-ret-frontend-xxxxx.onrender.com`
- ✅ Backend API running at: `https://aubie-ret-backend-xxxxx.onrender.com/api`
- ✅ Database connected and persisting data
- ✅ Users can register, login, and use all features

---

## 🆘 If Something Goes Wrong

### Check These First:
1. **Render Dashboard Logs**
   - Click service → Logs tab
   - Look for red error messages

2. **Browser Console (F12)**
   - Check for JavaScript errors
   - Verify API_BASE is set correctly

3. **Troubleshooting Guide**
   - See `RENDER_TROUBLESHOOTING.md` for solutions
   - Most common issues have quick fixes

4. **Test API Manually**
   ```bash
   curl https://aubie-ret-backend-xxxxx.onrender.com/api/health
   ```

---

## 📚 Reference Documents

- `RENDER_README.md` - Overview and architecture
- `RENDER_QUICK_START.md` - Quick 5-minute setup
- `RENDER_DEPLOYMENT.md` - Detailed deployment guide
- `RENDER_TROUBLESHOOTING.md` - Solutions for issues
- `server/.env.template` - Environment variable reference

---

**Congratulations on your deployment! 🚀**

Your Aubie RET Hub is now running on Render with proper API communication and data persistence.

