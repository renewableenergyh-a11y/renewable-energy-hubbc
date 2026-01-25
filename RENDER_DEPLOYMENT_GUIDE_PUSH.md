# Push to Render - Complete Guide

## Status: ✅ READY TO DEPLOY

Your code is committed and ready to push to Render.com.

---

## Step-by-Step Deployment Instructions

### Step 1: Create GitHub Repository (if not already done)

1. Go to [GitHub.com](https://github.com)
2. Click "New Repository"
3. Enter repository name: `aubie-ret-hub` (or your preferred name)
4. Make it **PRIVATE** (important for security)
5. Click "Create Repository"

### Step 2: Add GitHub Remote

Copy the commands from GitHub and run them in terminal:

```bash
cd "c:\Users\PEREZZIE\Desktop\Render\Restructured RET Hub"

# Add the remote (replace with your GitHub repo URL)
git remote add origin https://github.com/YOUR-USERNAME/aubie-ret-hub.git

# Verify it was added
git remote -v
```

Expected output:
```
origin  https://github.com/YOUR-USERNAME/aubie-ret-hub.git (fetch)
origin  https://github.com/YOUR-USERNAME/aubie-ret-hub.git (push)
```

### Step 3: Push to GitHub

```bash
# Push to GitHub
git branch -M main
git push -u origin main
```

This will prompt for GitHub credentials. Use:
- **Username:** Your GitHub username
- **Password:** Your GitHub personal access token (NOT your password)

To create a personal access token:
1. Go to GitHub Settings → Developer Settings → Personal Access Tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `workflow`
4. Copy the token and use it as your password

### Step 4: Connect Render to GitHub

1. Go to [Render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Select "Connect a repository"
4. Authorize Render to access your GitHub account
5. Select your `aubie-ret-hub` repository
6. Click "Connect"

### Step 5: Configure Render Deployment

**Basic Settings:**
- **Name:** `aubie-ret-hub-api` (or similar)
- **Environment:** `Node`
- **Build Command:** `cd server && npm install`
- **Start Command:** `cd server && npm start`
- **Auto-deploy:** ✅ Yes (optional, good for development)

**Environment Variables:**

Add these variables in Render settings:

```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
NODE_ENV=production
PORT=10000
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
PAYCHANGU_PUBLIC_KEY=your_paychangu_public_key
PAYCHANGU_SECRET_KEY=your_paychangu_secret_key
SMTP_HOST=your_smtp_host
SMTP_PORT=your_smtp_port
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM=your_email_from
```

### Step 6: Deploy

1. Click "Create Web Service"
2. Render will start building
3. Watch the build logs for any errors
4. Once deployed, you'll get a URL like: `https://aubie-ret-hub-api.onrender.com`

---

## Deployment Checklist

- [ ] GitHub repository created and private
- [ ] Code pushed to GitHub (main branch)
- [ ] Render account created
- [ ] GitHub connected to Render
- [ ] Web service created in Render
- [ ] Environment variables configured
- [ ] Build succeeds without errors
- [ ] Application starts without errors
- [ ] Test endpoint: GET `/api/discussions/sessions`
- [ ] Session resolution working in production

---

## Verify Deployment

### Test API Endpoints

```bash
# Test the discussions endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://aubie-ret-hub-api.onrender.com/api/discussions/sessions

# Test session lookup
curl -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-user-id: test-user" \
  -H "x-user-role: admin" \
  https://aubie-ret-hub-api.onrender.com/api/discussions/sessions/SESSION_ID
```

### Check Server Logs

In Render dashboard:
1. Click on your web service
2. Go to "Logs" tab
3. Look for startup logs showing:
   - ✅ Storage initialized
   - ✅ Discussion services initialized
   - ✅ Socket.IO initialized
   - ✅ Server running on port 10000

### Test Discussion Flow

1. Frontend users navigate to discussions page
2. Click "Join Now"
3. Should load discussion room without "Session not found" error
4. Session details should display
5. Participant count should update

---

## Common Issues & Fixes

### Issue: "Cannot find module" errors

**Solution:**
```bash
cd "c:\Users\PEREZZIE\Desktop\Render\Restructured RET Hub\server"
npm install
npm start
```

### Issue: Connection timeout on database

**Solution:**
- Verify MongoDB connection string in Render environment variables
- Check MongoDB IP whitelist includes Render's IP ranges
- Test locally first: `npm start` in server directory

### Issue: Socket.IO connection fails

**Solution:**
- Ensure CORS is properly configured
- Check Socket.IO transports: `websocket` and `polling` both enabled
- Verify frontend token is being passed correctly

### Issue: Auth headers not found

**Solution:**
- Check that frontend is sending:
  - `Authorization: Bearer {token}`
  - `x-user-id: {userId}`
  - `x-user-role: {role}`
- Verify these headers are in request to `/api/discussions/sessions/{sessionId}`

---

## Monitoring in Production

### Set Up Alerts

1. In Render dashboard, enable notifications for:
   - Build failures
   - Deploy failures
   - Service crashes

2. Monitor logs regularly for:
   - Authentication errors
   - Session lookup failures
   - Database connection issues
   - Socket.IO errors

### Performance Metrics

Track these in production:
- Session lookup response time (should be <100ms)
- Participant registration success rate (should be 100%)
- Socket.IO connection success rate (should be >99%)
- Error rates from verifyAuth middleware

### Useful Commands for Debugging

```bash
# SSH into Render (if available)
# Check current logs
# Restart service
# View environment variables
```

---

## Next Steps After Deployment

1. **Test Thoroughly**
   - Create sessions from admin dashboard
   - Join sessions from discussions page
   - Verify real-time updates work
   - Test with multiple users

2. **Monitor**
   - Watch server logs for 24 hours
   - Check error rates
   - Verify database performance
   - Confirm Socket.IO stability

3. **Iterate**
   - Fix any production issues
   - Optimize based on real usage
   - Plan WebRTC phase
   - Add monitoring dashboards

---

## Deployment Timeline

| Step | Time | Status |
|------|------|--------|
| 1. Create GitHub repo | 2 min | ⏳ Pending |
| 2. Push code | 2 min | ⏳ Pending |
| 3. Connect Render | 5 min | ⏳ Pending |
| 4. Configure env vars | 5 min | ⏳ Pending |
| 5. Deploy | 5-10 min | ⏳ Pending |
| 6. Verify | 5 min | ⏳ Pending |
| **Total** | **~25-30 min** | - |

---

## Important Security Notes

⚠️ **BEFORE DEPLOYING:**

1. **Never commit secrets** - Use environment variables for:
   - Database connection strings
   - API keys
   - JWT secrets
   - Payment processor keys
   - Email credentials

2. **Set repository to PRIVATE** on GitHub
   - Prevents unauthorized access
   - Protects your code

3. **Use secure environment variables** in Render
   - Render encrypts them at rest
   - They're not visible in logs

4. **Enable HTTPS** (Render does this automatically)
   - All traffic encrypted
   - SSL certificate provided free

5. **Set rate limits** for production
   - Prevent brute force attacks
   - Throttle API endpoints

---

## Rollback Plan (If Needed)

If production has issues:

1. **Quick Rollback** (within last deploy):
   ```bash
   git revert HEAD
   git push origin main
   # Render will auto-redeploy
   ```

2. **Full Rollback** (to known good state):
   ```bash
   git reset --hard COMMIT_HASH
   git push -f origin main
   # Render will redeploy from previous commit
   ```

3. **Manual Restart** (if service hangs):
   - In Render dashboard
   - Click "Manual Deploy"
   - Select commit from history
   - Click "Deploy"

---

## Contact & Support

If you encounter issues:

1. **Check Render logs** - Usually shows the exact error
2. **Check GitHub** - Verify code was pushed correctly
3. **Check environment variables** - Are all required vars set?
4. **Local test first** - Does it work locally? (`npm start`)
5. **Review error logs** - Look for specific error messages

---

**Everything is ready. You can now push to Render following the steps above.**

**Estimated deployment time: 25-30 minutes**

**Status: ✅ READY FOR PRODUCTION DEPLOYMENT**
