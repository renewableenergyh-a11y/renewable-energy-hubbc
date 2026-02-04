# Super Admin Settings Panel - Quick Reference

## Accessing the Settings Panel

1. Log in as a SuperAdmin
2. Navigate to Admin Dashboard
3. Click the "Settings" link in the sidebar (under System section)
4. Only SuperAdmins will see the full panel; other admins will see "Access Denied"

## Settings Sections

### 🔧 Platform Control
**What it does**: Controls core platform behavior

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| Site Name | Text | Aubie RET Hub | Displayed in platform branding |
| Maintenance Mode | Toggle | OFF | When ON: blocks all non-admin access |
| Maintenance Message | Text Area | Empty | Shown to users during maintenance |
| Allow New User Registration | Toggle | ON | When OFF: signup is disabled |
| Default Timezone | Dropdown | UTC | Used for timestamps and scheduling |

### 🎓 Certificates
**What it does**: Controls certificate generation and access

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| Enable Certificate Generation | Toggle | ON | When OFF: no certificates issued |
| Minimum Pass Percentage | Number | 70 | Users must score ≥ this to earn cert |
| Allow Re-download | Toggle | ON | When OFF: users can only download once |

### 📰 Content Control
**What it does**: Controls News and Careers features

**News Settings**:
- Enable News System (ON/OFF)
- Enable Likes & Reactions (ON/OFF) - only works if news is enabled

**Careers Settings**:
- Enable Careers Page (ON/OFF)
- Allow PDF Download (ON/OFF) - only works if careers is enabled

### 🤖 Aubie RET AI Assistant
**What it does**: Controls AI assistant availability

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| Enable AI Assistant | Toggle | ON / OFF | ON |
| Access Mode | Dropdown | Premium Only / Everyone | Premium Only |
| Promotion Duration | Number | 1-365 days | 7 days |
| Daily Question Limit | Number | 0-1000 | 50 |
| Show Beta Notice | Toggle | ON / OFF | ON |

**Special Behavior**: When you switch Access Mode to "Everyone":
- A system notification is automatically created
- Users see: "🎉 AI Assistant is now available to all users for X days!"
- After X days: Access automatically reverts to "Premium Only"
- Notification automatically expires

### 💎 Premium Access Control
**What it does**: Controls premium features and free trials

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| Enable Premium System | Toggle | ON | When OFF: all premium features disabled |
| Free Trial Duration | Number | 7 days | New users get premium for X days |
| Enable Premium for All | Toggle | OFF | When ON: ALL users get premium access |
| Promotion Duration | Dual Input | 7 days | How long the promotion lasts |

**Promotion Behavior**:
1. Turn ON "Enable Premium for All Users"
2. Set duration (e.g., 7 days)
3. All users instantly get full premium access
4. System notification created: "🎉 Premium access is now available to everyone for 7 days!"
5. After 7 days: Settings auto-revert, users lose premium access
6. Notification automatically expires

### 🛠 System Utilities
**What it does**: Maintenance and debugging

| Button | Action |
|--------|--------|
| Clear Application Cache | Removes all cached data from memory |
| View Error Logs | Shows last 100 lines of error.log |

## Saving Changes

- Each section has its own "Save" button
- When you click Save:
  - You'll see "Saving..." state
  - Changes are sent to the server
  - Database is updated
  - Success/error toast appears
  - Settings UI refreshes
- You do NOT need to refresh the page

## Real-Time Features

✅ **Badges Update Instantly**: Green badges appear/disappear as you toggle switches
✅ **Conditional Fields Appear**: Fields only show when relevant (e.g., maintenance message only when maintenance is ON)
✅ **Immediate Effect**: Changes take effect immediately, no cache delay
✅ **Auto-Expiry**: Promotions automatically revert when timer expires (no manual reset needed)

## Important Rules

### Maintenance Mode
- When enabled: Only SuperAdmins can access the platform
- Other users see maintenance page
- Use "Maintenance Message" to tell users why/when site will be back

### Certificate Minimum Pass %
- Must be between 50-100%
- Users must score AT LEAST this percentage to earn a certificate
- If you set it to 100%, only perfect scores count

### AI Assistant Promotion
- If you change Access Mode to "Everyone", you MUST set a Promotion Duration
- Duration must be at least 1 day
- Promotion will AUTOMATICALLY expire (no manual work needed)

### Premium Promotion
- If you enable "Premium for All Users", you MUST set a duration
- Choose unit: Minutes, Hours, or Days
- Example: 7 days = all users get premium for one week
- After expiry: Free users revert to trial (if eligible) or free plan

## Testing Your Settings

After saving, verify they work:

1. **Maintenance Mode**: Enable it, try accessing from incognito window (you'll be blocked)
2. **Registration**: Disable it, check if signup form is hidden
3. **Premium Promotion**: Enable it, check all users see premium badge
4. **AI Promotion**: Enable it, check users see "AI now available for everyone" notification
5. **Certificates**: Disable it, check certificate buttons don't appear

## Troubleshooting

### "Access Denied" message?
- You're not logged in as a SuperAdmin
- Only SuperAdmin accounts can access settings
- Check your admin role in localStorage: `localStorage.getItem('adminRole')`

### Changes don't save?
- Check browser console for errors (F12 → Console tab)
- Check admin token is valid: `localStorage.getItem('adminToken')`
- Try refreshing the page and saving again

### Promotion didn't expire?
- Check server logs for errors
- Promotions are checked every 60 seconds
- If you manually changed settings, refresh the page

### Settings disappeared after restart?
- Settings are stored in MongoDB, not local storage
- If MongoDB is down, settings won't load
- Check server logs for connection errors

## API for Other Systems

Settings are accessible via API (SuperAdmin token required):

```javascript
// Get all settings
fetch('/api/settings', {
  headers: { 'Authorization': 'Bearer <admin-token>' }
})

// Update a section
fetch('/api/settings/platform', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer <admin-token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ maintenanceMode: true })
})
```

## Settings in Code

Other parts of the application read these settings and respond:

- **Courses page** checks `enableCareersPage`
- **News page** checks `enableNewsSystem`
- **AI chat** checks `enableAiAssistant` and `aiAccessMode`
- **Premium features** check `enablePremiumSystem`
- **Login page** checks `maintenanceMode`
- **Signup form** checks `allowNewUserRegistration`

When you change a setting, these features automatically adapt (usually within 60 seconds).

## Best Practices

1. ✅ **Test before enabling promotions** - make sure notification system works first
2. ✅ **Use clear maintenance messages** - tell users when to check back
3. ✅ **Keep timezone consistent** - set default timezone and stick with it
4. ✅ **Generous cert pass % for incentive** - 70% is good, 100% is strict
5. ✅ **Short premium promotions for testing** - use "Minutes" or "Hours" for tests
6. ✅ **Monitor error logs** - check logs regularly for issues

## Support

If settings don't work as expected:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Check "Clear Application Cache" button in System Utilities
3. Try different browser/incognito window
4. Check server error logs for backend issues
5. Contact engineering team with error details

---

**Last Updated**: February 4, 2026
**Version**: 1.0 - Production Ready
