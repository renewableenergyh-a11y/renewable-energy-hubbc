# 🔧 Render Deployment Troubleshooting Guide

## API Connection Issues

### Symptom: "Failed to fetch" or 404 errors

**Frontend Console Error:**
```
GET https://[your-domain]/api/auth/login 404 (Not Found)
```

**Solutions:**

1. **Check API Base URL Configuration**
   ```javascript
   // In browser console, run:
   console.log(API_BASE)
   // Should show '/api' (not full URL for same-origin)
   ```

2. **Verify Backend Service Status**
   - Go to Render Dashboard → **aubie-ret-backend**
   - Check if status is **"Live"** (green)
   - If red or building, wait for deployment to complete

3. **Check Backend Logs**
   - Dashboard → **aubie-ret-backend** → **Logs**
   - Look for error messages starting with `❌`
   - Check for MongoDB connection errors

4. **Test Backend Directly**
   ```bash
   # Replace with your backend URL
   curl https://aubie-ret-backend-xxxxx.onrender.com/api/health
   
   # Should return JSON (not HTML error)
   ```

5. **Verify Proxy Configuration**
   - In render.yaml, check the `/api` route points to backend
   - Frontend service should have route:
     ```yaml
     - path: /api
       destination: http://aubie-ret-backend:10000/api
     ```

---

## MongoDB Connection Errors

### Symptom: "MONGODB_URI is not set" or "connect ECONNREFUSED"

**Backend Console Error:**
```
❌ MongoDB connection failed: Invalid URI
```

**Solutions:**

1. **Verify MONGODB_URI Environment Variable**
   - Go to Dashboard → **aubie-ret-backend** → **Settings** → **Environment**
   - Check that `MONGODB_URI` is set and complete
   - Should look like: `mongodb+srv://user:pass@cluster.xyz.mongodb.net/aubieret`

2. **Fix MongoDB Atlas IP Whitelist**
   - Log in to MongoDB Atlas: https://www.mongodb.com/cloud/atlas
   - Go to **Network Access** → **IP Whitelist**
   - For Render deployment, allow: `0.0.0.0/0` (all IPs)
   - Or specifically whitelist Render's IPs (check Render docs)

3. **Test Connection String Locally**
   ```bash
   # Replace YOUR_URI with actual MONGODB_URI
   mongosh "mongodb+srv://user:pass@cluster.xyz.mongodb.net/aubieret"
   ```

4. **Check MongoDB Credentials**
   - Verify username and password in Atlas
   - Special characters in password may need URL encoding
   - Example: `@` becomes `%40`

5. **Use Render's MongoDB (Recommended)**
   - Render can provide MongoDB automatically
   - In render.yaml, database section creates it
   - Check Render dashboard for connection string

---

## Static Files Not Loading

### Symptom: Frontend HTML loads but CSS/JS don't load, or blank page

**Network Tab Shows:**
```
CSS, JS files: 404 Not Found
```

**Solutions:**

1. **Check Frontend Service Configuration**
   - Dashboard → **aubie-ret-frontend** → **Settings**
   - Verify `staticPublishPath` is set to `./` (root directory)
   - Verify `buildCommand` is correct

2. **Verify File Structure**
   ```
   / (root)
   ├── index.html ✓
   ├── css/
   │   └── style.css ✓
   ├── js/
   │   └── *.js ✓
   └── server/ ✓
   ```

3. **Check File Permissions**
   - Local: `ls -la` should show files are readable
   - Git: Make sure files are committed (not in .gitignore)

4. **Clear Browser Cache**
   ```
   - Press F12 → Right-click Reload → "Empty cache and hard reload"
   - Or: Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac)
   ```

---

## Build Failures

### Symptom: Deployment fails during "Build" phase

**Build Log Shows:**
```
❌ Build failed
```

**Solutions:**

1. **Check server/package.json**
   ```bash
   # Make sure file exists and is valid JSON
   cat server/package.json | head -20
   ```

2. **Check Dependencies**
   ```bash
   # In server directory, run:
   npm install
   ```

3. **Fix Node Version Issues**
   - In render.yaml, specify Node version:
   ```yaml
   services:
     - name: aubie-ret-backend
       runtime: node
       buildCommand: "npm install -g npm@latest && cd server && npm install"
   ```

4. **Check for Missing Files**
   - Build log will show which files are missing
   - Ensure all `require()` files exist
   - Check relative paths are correct

5. **View Detailed Build Log**
   - Dashboard → **aubie-ret-backend** → **Logs**
   - Scroll to see the full error message
   - Search for `error` or `failed`

---

## CORS (Cross-Origin) Errors

### Symptom: "Access to XMLHttpRequest has been blocked by CORS policy"

**Browser Console Shows:**
```
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at 
https://different-domain.com/api/...
```

**Solutions:**

1. **Server CORS is Configured**
   - Your backend has CORS enabled (in index.js)
   - Check for `app.use(cors())` line

2. **Verify Same-Domain Setup**
   - Frontend and backend should be on same domain
   - In Render, they are: `https://yourdomain.onrender.com/`
   - Frontend files at root
   - Backend API at `/api` prefix

3. **If Using Different Domains**
   - Update CORS config in server/index.js
   - Add frontend domain to `allowedOrigins` array
   - Restart backend service

4. **Test CORS Response**
   ```bash
   # Check if server includes CORS headers
   curl -i https://aubie-ret-backend.onrender.com/api/health
   # Should have: Access-Control-Allow-Origin: *
   ```

---

## Email Not Sending

### Symptom: Password reset emails not received

**Backend Log Shows:**
```
📧 Email to user@example.com: Password reset for Aubie RET Hub
📧 (Console fallback) Email logged for user@example.com
```

**Solutions:**

1. **Check SMTP Variables are Set**
   - Dashboard → **aubie-ret-backend** → **Environment**
   - Verify these exist: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`

2. **For Gmail**
   - Can't use regular Gmail password
   - Use App Passwords: https://myaccount.google.com/apppasswords
   - May need to enable "Less secure apps"

3. **For SendGrid**
   - Use API key as password
   - Set `SMTP_USER=apikey`
   - Set `SMTP_PASS=SG.your_api_key`

4. **Test Email Locally First**
   ```bash
   # In server directory
   # Update .env with SMTP credentials
   npm test  # or run test-email.js if available
   ```

5. **Check Email Logs**
   - Backend logs show all email attempts
   - Look for `✅ Email sent` or `❌ Error sending email`
   - Gmail may show login attempts in security page

---

## Slow Response Times

### Symptom: API requests take 30+ seconds

**Solutions:**

1. **Check Backend Service Plan**
   - Starter plans may be slow
   - Dashboard → **aubie-ret-backend** → **Settings**
   - Consider upgrading plan for better CPU

2. **Monitor Database Performance**
   - Check MongoDB query times
   - Index frequently queried fields
   - Monitor connection pool usage

3. **Check Network Tab**
   - F12 → Network tab → reload page
   - See which requests are slow
   - Compare against local testing

4. **Optimize Large Queries**
   - Add pagination to endpoints
   - Reduce payload size
   - Add database indexes

---

## Deployment Takes Too Long

### Symptom: Deployment stuck "Building" for 10+ minutes

**Solutions:**

1. **Check if Build is Downloading Dependencies**
   - First deployment: npm install downloads all packages (~5 min)
   - Normal for large projects

2. **Cancel Long Builds**
   - Dashboard → **Service** → **Manual Deploy** → **Cancel Build**
   - Check build log for errors
   - Fix issue and redeploy

3. **Optimize package.json**
   - Remove unnecessary packages
   - Use `npm prune --production` in buildCommand

4. **Increase Build Timeout**
   - render.yaml, add to service:
   ```yaml
   buildCommand: "cd server && npm install"
   ```
   - Note: Render has max 45-minute timeout

---

## Database Shows Errors During Migration

### Symptom: "Cannot connect to MongoDB" when migrating data

**Backend Logs Show:**
```
❌ MongoDB connection failed
```

**Solutions:**

1. **If Using Render's MongoDB**
   - Wait 5+ minutes after creation
   - Connection string takes time to activate

2. **If Using MongoDB Atlas**
   - Check cluster is running (not paused)
   - Check IP whitelist includes Render
   - Verify username/password are correct

3. **Test Connection**
   ```bash
   # Use mongosh or MongoDB compass
   # Try connecting with MONGODB_URI
   # Should succeed if setup is correct
   ```

---

## How to Check Logs in Render

1. **Backend Logs**
   - Dashboard → **aubie-ret-backend** → **Logs**
   - Shows: Server startup, errors, API calls

2. **Frontend Logs**
   - Dashboard → **aubie-ret-frontend** → **Logs**
   - Shows: Build process, static file serving

3. **Database Logs**
   - Dashboard → **aubie-mongo** → **Logs**
   - Shows: Connection attempts, database issues

**Tip:** Use Ctrl+F to search logs for errors

---

## Testing Checklist

Before declaring deployment successful:

- [ ] Frontend loads (see HTML/CSS/JS)
- [ ] Login page displays
- [ ] Can register new account
- [ ] Account data saves to database
- [ ] Can login with registered account
- [ ] Can upload profile photo
- [ ] Can upload video (if feature enabled)
- [ ] Can view courses/modules
- [ ] Navigation works (no 404 errors)
- [ ] Responsive on mobile (use F12)
- [ ] No red errors in console (F12)

---

## Quick Debugging Commands

**Test API Endpoint:**
```bash
curl https://your-backend.onrender.com/api/health
```

**Check API Base URL (Browser Console):**
```javascript
console.log(API_BASE)
```

**Test Fetch (Browser Console):**
```javascript
fetch('/api/health')
  .then(r => r.json())
  .then(d => console.log('✅', d))
  .catch(e => console.error('❌', e))
```

**Check Service Status:**
```bash
# In browser console
fetch('/api/health')
```

---

## Still Need Help?

1. **Check Render Status Page**: https://status.render.com
2. **Review Service Logs** in Render dashboard (most detailed)
3. **Test locally first** before deploying
4. **Verify environment variables** are exactly correct
5. **Check file structure** matches what server expects

