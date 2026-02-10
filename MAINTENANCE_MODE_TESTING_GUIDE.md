# Maintenance Mode - Quick Testing Guide 🚀

## Enable Maintenance Mode

### Via Admin Panel:
1. Go to Admin Dashboard
2. Navigate to **Settings** → **Platform Control**
3. Toggle **"Enable Maintenance Mode"** ON
4. (Optional) Add message in **"Maintenance Message"** field
5. Click **"Save Platform Settings"**
6. Immediately visible to all users

---

## Test Scenarios

### Scenario 1: Regular User (Logged Out)
```
1. Open browser in private/incognito
2. Go to https://app.url/courses.html
3. Expected: See maintenance page (site completely blocked)
4. Can't proceed without admin access
5. API calls return 503 error
```

### Scenario 2: Admin User (Logged In)
```
1. Admin logs in with admin credentials
2. After login, page refreshes
3. Expected: 
   - See yellow banner at top: "🛠 Maintenance Mode Active"
   - Info icon (ℹ) with tooltip
   - Custom message shown
   - Close button (×) on right
4. Can click anywhere on page normally
5. All features accessible
6. Can dismiss banner by clicking × button
7. Refresh page: banner reappears
```

### Scenario 3: Maintenance Mode OFF
```
1. Go back to Admin Settings
2. Toggle "Enable Maintenance Mode" OFF
3. Save settings
4. After ~5 seconds, banner disappears
5. All users can access normally
6. No maintenance page visible
```

---

## What the Banner Looks Like

```
┌─────────────────────────────────────────────────────────────────┐
│ 🛠 Maintenance Mode Active ℹ – Server maintenance in progress   │ ×
└─────────────────────────────────────────────────────────────────┘
 Yellow background, fixed at top, doesn't block content below
```

### Banner Features:
- 🛠 Wrench emoji shows maintenance mode
- **Text:** "Maintenance Mode Active"
- **ℹ Icon:** Click for tooltip explaining maintenance
- **Close (×):** Dismiss banner (reappears on refresh)
- **Message:** Your custom maintenance message
- **Auto-hides:** When maintenance mode turned OFF

---

## Expected Behavior

### ✅ What Should Work:
- [x] Admin can login during maintenance
- [x] Admin can access all pages
- [x] Admin can use courses, discussions, everything
- [x] Regular users see maintenance page
- [x] API calls for non-admins get 503 error
- [x] Banner is responsive on mobile
- [x] Settings don't get affected
- [x] Sessions remain valid
- [x] Features outside maintenance work normally

### ❌ What Should NOT Work (for regular users):
- [x] Can't see any pages
- [x] Can't access courses
- [x] Can't access discussions
- [x] Can't register new account
- [x] API endpoints all return 503

---

## Test with curl (Command Line)

### Check if Maintenance is Enabled:
```bash
curl https://app.url/api/settings/public | grep maintenanceMode
# Should show: "maintenanceMode":true
```

### Test Non-Admin Access (should be blocked):
```bash
curl https://app.url/api/courses
# Expected response:
# {"error":"The site is in maintenance mode. Please check back soon."}
```

### Test Admin Access (should work):
```bash
# First get token by logging in
TOKEN=$(curl -X POST https://app.url/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@email.com","password":"password"}' | grep token)

# Access API with token (should work)
curl -H "Authorization: Bearer $TOKEN" https://app.url/api/courses
# Should return course data normally
```

---

## Browser Console Debugging

### Check Settings Loaded:
```javascript
// Open browser console (F12)
// Should see logs like:
"🔧 Applying platform settings..."
"✅ [Maintenance] admin user allowed access - showing banner"
```

### Check User Role:
```javascript
localStorage.getItem('adminRole')
// Should show: "admin", "superadmin", or "instructor"
// Or null/undefined if not admin
```

### Check Maintenance Status:
```javascript
localStorage.getItem('maintenanceMode')
// May not be set, check server logs instead
```

---

## What to Verify

- [ ] **Regular users see maintenance page** - completely blocked
- [ ] **Admin sees banner** - yellow, at top, not blocking content
- [ ] **Banner has close button** - can dismiss
- [ ] **Banner has info icon** - shows tooltip
- [ ] **Custom message shows** - in admin panel
- [ ] **API returns 503** - for non-admin requests
- [ ] **Admin API works** - with token
- [ ] **Mobile responsive** - banner looks good on phones
- [ ] **Settings change fast** - ~5 seconds to apply
- [ ] **No data loss** - all features work after maintenance OFF

---

## Keys to Look For

### Server Console Logs:
```
✅ [Maintenance] admin user allowed access: admin@email.com
🚧 [Maintenance] guest user blocked from accessing: GET /api/courses
```

### Browser Console Logs:
```
🚧 MAINTENANCE MODE ENABLED - Blocking non-admin access
✅ [Maintenance] admin user allowed access - showing banner
✅ Maintenance mode banner shown for admin user
```

---

## Roles That Can Access During Maintenance

Only these roles bypass maintenance mode:
- ✅ **admin** - Regular admin user
- ✅ **superadmin** - Super admin user
- ✅ **instructor** - Instructor user

Everyone else (guests, regular students, etc.) gets blocked.

---

## Troubleshooting During Testing

### **Q: Admin sees maintenance page instead of banner**
**A:** Admin not logged in as admin role. Check `localStorage.getItem('adminRole')` in console.

### **Q: Banner shows but in wrong position**
**A:** Some other element might have higher z-index. Banner is z-index: 9999, should be on top.

### **Q: Regular user can still access site**
**A:** Settings might not have saved. Refresh page. Check server logs for maintenance check messages.

### **Q: Can't login during maintenance**
**A:** Login endpoint `/api/auth/login` should always work. Try direct login, banner shows up after.

### **Q: Banner keeps reappearing after close**
**A:** Banner reappears on page refresh (by design). To permanently remove, turn OFF maintenance mode.

---

## After Testing

1. **Turn OFF Maintenance Mode** in Admin Settings
2. Wait 5 seconds for settings to propagate
3. Verify banner disappears
4. Verify regular users can access site
5. Check all features work normally
6. Done! ✅

---

## Support

If something isn't working as expected:
1. Check server console logs for `[Maintenance]` messages
2. Check browser console (F12) for JavaScript errors  
3. Verify settings saved correctly in admin panel
4. Try refreshing page (Ctrl+Shift+R for cache clear)
5. Check user role: `localStorage.getItem('adminRole')`
6. Test with curl to isolate API vs UI issues

---

**Last Updated:** February 10, 2026  
**Status:** ✅ Production Ready
