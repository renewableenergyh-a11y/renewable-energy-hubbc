# Netlify Deployment Guide

## Environment Variables Setup

To deploy your frontend on Netlify with a backend API running elsewhere, you need to configure the API base URL.

### Step 1: In your backend (.env or deployment)
Ensure your backend is deployed and has a public URL. Examples:
- Heroku: `https://my-app-api.herokuapp.com`
- Render: `https://my-app-api.onrender.com`  
- Custom domain: `https://api.mysite.com`
- Same-origin (frontend & backend on same domain): `/api`

### Step 2: In Netlify Dashboard
1. Go to **Site Settings** → **Environment Variables**
2. Add a new environment variable:
   - **Key:** `REACT_APP_API_BASE`
   - **Value:** Your backend URL (e.g., `https://my-api.herokuapp.com/api`)
   - For same-origin (relative paths): Value is blank or `/api`

### Step 3: Inject into Frontend
The frontend code [js/api-config.js](../js/api-config.js) automatically:
- Detects `window.API_BASE` (injected at build/deploy time)
- Falls back to environment variable `process.env.REACT_APP_API_BASE`
- Falls back to relative `/api` paths for deployed sites
- Falls back to `http://localhost:8787/api` for local development

### Step 4: Build Configuration (Netlify)
If using build commands, ensure the environment variable is available:
```bash
npm run build
```

Netlify automatically injects environment variables during the build. No additional steps needed.

### Step 5: Test
After deploying to Netlify:
1. Open your site in a browser
2. Open **Developer Console** (F12 → Console)
3. Type: `window.API_BASE` (should show your backend URL)
4. Test an API call (e.g., visit `/api/config` endpoint)

## Quick Setup Examples

### Deploy backend to Heroku
```bash
cd server
# Deploy to Heroku (requires Heroku CLI and git)
heroku create my-app-api
git push heroku main
```
Then set `REACT_APP_API_BASE=https://my-app-api.herokuapp.com/api` in Netlify.

### Deploy backend to Render
1. Push your repo to GitHub
2. Create new **Web Service** on render.com
3. Connect your repo, set start command: `npm start` from `server` folder
4. Set environment variable: `MONGODB_URI=your-mongodb-uri`
5. Copy the generated URL and use as `REACT_APP_API_BASE` in Netlify

### Deploy with same-origin (frontend + backend on same server)
If both frontend and backend are deployed to the same domain (e.g., both on Netlify or same VPS):
- Leave `REACT_APP_API_BASE` blank or unset
- Frontend will use relative `/api` paths
- Ensure your server routes match (e.g., `/api/*`)

## Troubleshooting

**"API endpoint not found" or CORS errors:**
- Check that `window.API_BASE` in browser console matches your backend URL
- Verify backend is running and accessible at that URL
- Check backend CORS settings (should allow requests from your Netlify domain)

**Admin link not visible on Netlify:**
- The admin link is hardcoded in [index.html](../index.html) line 28
- It's always visible; if it doesn't work, check that API calls succeed (see Developer Console)

**Can't reach MongoDB from frontend:**
- MongoDB is a backend concern; frontend doesn't connect directly
- Ensure your backend has `MONGODB_URI` set and is running
- Test backend API endpoints with `curl` or Postman
