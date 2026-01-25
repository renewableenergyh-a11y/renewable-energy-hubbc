# Render Deployment Guide - Aubie RET Hub

This guide will walk you through deploying the Aubie RET Hub to Render.

## Prerequisites

- Render account (free at https://render.com)
- GitHub account with this repository pushed
- MongoDB Atlas account (or use Render's MongoDB)
- Paychangu account for payments
- SMTP credentials for email (Gmail, SendGrid, etc.)

## Deployment Steps

### Step 1: Push Your Code to GitHub

```bash
git init
git add .
git commit -m "Initial commit for Render deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 2: Create a Render Blueprint

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. The `render.yaml` file will be automatically detected
5. Click **"Create from Blueprint"**

### Step 3: Configure Environment Variables

The deployment will create two services:
- **aubie-ret-backend**: Node.js API server
- **aubie-ret-frontend**: Static frontend files
- **aubie-mongo**: MongoDB database

For the backend service (`aubie-ret-backend`), set these environment variables:

#### Required Variables

| Variable | Example Value | Notes |
|----------|---------------|-------|
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/aubieret` | MongoDB connection string |
| `NODE_ENV` | `production` | Set to production |

#### Optional Variables (Payments & Email)

| Variable | Notes |
|----------|-------|
| `PAYCHANGU_PUBLIC_KEY` | Get from Paychangu dashboard |
| `PAYCHANGU_SECRET_KEY` | Get from Paychangu dashboard |
| `PAYCHANGU_ACCOUNT_ID` | Your Paychangu account ID |
| `PAYCHANGU_ACCOUNT_NAME` | Your organization name |
| `SMTP_HOST` | `smtp.gmail.com` for Gmail |
| `SMTP_PORT` | `465` for Gmail |
| `SMTP_USER` | Your email address |
| `SMTP_PASS` | App-specific password |
| `SMTP_FROM` | Sender email address |
| `SMTP_SECURE` | `true` for port 465 |
| `SERVER_URL` | Your Render backend URL |
| `SITE_URL` | Your Render frontend URL |

### Step 4: Update SITE_URL for Payment Callbacks

After deployment, update:
- `SITE_URL`: Use the frontend URL (e.g., `https://aubie-ret-frontend.onrender.com`)
- `SERVER_URL`: Use the backend URL (e.g., `https://aubie-ret-backend.onrender.com`)

Then redeploy the backend.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Render Platform                    │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────────────┐  ┌────────────────────┐  │
│  │   Frontend (Static)   │  │  Backend (Node.js) │  │
│  │                       │  │                    │  │
│  │ - HTML files          │  │ - Express server   │  │
│  │ - CSS/JS              │  │ - API routes       │  │
│  │ - Assets              │  │ - File uploads     │  │
│  │                       │  │                    │  │
│  └───────────┬───────────┘  └────────────┬───────┘  │
│              │                           │            │
│              └─── API Communication ─────┘           │
│                   (/api/*)                            │
│                                                       │
│  ┌──────────────────────────────────────────────┐  │
│  │         MongoDB Database (aubie-mongo)       │  │
│  │         - Users, courses, sessions           │  │
│  │         - Videos, certificates               │  │
│  └──────────────────────────────────────────────┘  │
│                                                       │
│  External Services:                                  │
│  - Paychangu (Payments)                             │
│  - SMTP (Email notifications)                       │
│  - MongoDB Atlas (optional - external DB)           │
└─────────────────────────────────────────────────────┘
```

## How API Calls Work

### On Localhost
```javascript
// api-config.js detects localhost and uses:
API_BASE = 'http://localhost:8787/api'
```

### On Render
```javascript
// api-config.js detects render.com domain and uses:
API_BASE = '/api'  // Relative path - same origin
```

The frontend and backend are served from the same domain, so the browser can make requests to `/api/*` and they'll be automatically routed to the backend.

## Troubleshooting

### Backend Not Responding

Check the backend service logs in Render dashboard:
1. Go to **Dashboard** → **aubie-ret-backend**
2. Click **"Logs"** tab
3. Look for errors starting with `❌` or `Error`

Common issues:
- `MONGODB_URI` not set or invalid
- Port binding issues (Render uses PORT environment variable)
- Missing dependencies (run `npm install` in server folder)

### Frontend Can't Connect to Backend

1. Verify both services are deployed successfully
2. Check browser console (F12) for error messages
3. Verify `API_BASE` is set correctly (open browser console):
   ```javascript
   console.log(API_BASE)  // Should show '/api'
   ```
4. Ensure CORS is enabled (it is by default in this project)

### Static Files Not Loading

Check that the frontend service is correctly configured to serve from the root directory.

### MongoDB Connection Issues

If using Render's MongoDB:
1. Get the connection string from Render dashboard
2. Use format: `mongodb+srv://user:password@host/database`
3. Make sure IP whitelist includes Render's infrastructure (usually `0.0.0.0/0`)

## Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Render blueprint created
- [ ] MongoDB configured and connection string saved
- [ ] Paychangu keys set (if using payments)
- [ ] SMTP credentials configured (if using email)
- [ ] Backend service deployed successfully
- [ ] Frontend service deployed successfully
- [ ] API calls working (test in browser console)
- [ ] Database initialized with seed data
- [ ] Payment system tested (if enabled)
- [ ] Email notifications tested (if enabled)

## Monitoring & Logs

Monitor your services in real-time:

**View logs:**
1. Go to Render dashboard
2. Click service name
3. Click "Logs" tab

**Set up alerts:**
1. Service Settings → Notifications
2. Configure email/webhook alerts

## Scaling & Performance

For production, consider:

- **Database**: Upgrade from starter plan for better performance
- **Backend**: Render auto-scales within plan limits
- **CDN**: Render includes CDN for static assets
- **Caching**: Static files are cached at edge locations

## Updating Your Deployment

After making changes locally:

```bash
git add .
git commit -m "Update feature X"
git push origin main
```

Render will automatically redeploy your application.

## Support & Documentation

- [Render Docs](https://render.com/docs)
- [Express.js Guide](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

