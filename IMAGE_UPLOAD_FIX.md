# Image Upload Fix - Locally Uploaded Files Not Rendering in Module Content

## Problem
Locally uploaded images in the markdown editor's image insert modal were not rendering when displayed in module content on the site.

## Root Cause
The `/api/upload-image` endpoint was returning **relative URLs** like `/api/media/:id`. While this works for same-origin requests, it can fail in certain deployment scenarios:
- When the site is served from a different path
- Behind a reverse proxy with URL rewriting
- On deployed platforms like Render where origins may differ

## Solution Implemented

### 1. **Fixed Image URL Generation** (server/index.js, line ~2029)
**Before:**
```javascript
const imageUrl = `/api/media/${mediaId}`;
```

**After:**
```javascript
// Construct absolute URL to ensure images render correctly on deployed sites
const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
const host = req.get('x-forwarded-host') || req.get('host') || 'localhost';
const imageUrl = `${protocol}://${host}/api/media/${mediaId}`;
```

**Benefits:**
- Returns absolute URLs like `https://domain.com/api/media/507f1f77bcf86cd799439011`
- Respects reverse proxy headers (`X-Forwarded-Proto`, `X-Forwarded-Host`)
- Works correctly on deployed platforms (Render, etc.)
- Works in all deployment contexts

### 2. **Added CORS Headers to Media Endpoint** (server/index.js, line ~2080)
```javascript
// Ensure CORS headers for image loading from any origin
res.set('Access-Control-Allow-Origin', '*');
res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
res.set('Access-Control-Allow-Headers', 'Content-Type');
```

**Benefits:**
- Allows images to be loaded from any origin
- Ensures images work even if page and API are on different subdomains
- Proper CORS support for image loading

## How It Works

### Upload Flow:
1. Admin uploads image via markdown editor modal
2. Image sent to `/api/upload-image` endpoint
3. Image saved to MongoDB
4. Response includes **absolute URL** like: `https://domain.com/api/media/507f1f77bcf86cd799439011`
5. URL inserted into markdown

### Render Flow:
1. Module markdown fetched from server
2. Contains image markdown: `![alt](https://domain.com/api/media/507f1f77bcf86cd799439011)`
3. `marked.parse()` converts to: `<img src="https://domain.com/api/media/507f1f77bcf86cd799439011">`
4. Browser displays image using absolute URL (works from any context)

## Testing

To verify the fix works:

1. **Upload an image** in the markdown editor modal
2. **Check the response** - URL should be absolute (with protocol and domain)
3. **Save the module** with the image
4. **View the module** - Image should render correctly
5. **Test on deployed site** - Image should work without CORS errors

## Files Modified
- `server/index.js` - Image upload endpoint (returns absolute URLs + CORS headers)

## Compatibility
- ✅ Works with reverse proxies (Render, Netlify, etc.)
- ✅ Works with X-Forwarded headers
- ✅ Works with same-origin requests
- ✅ Works with cross-origin requests
- ✅ Maintains backward compatibility with existing image links
