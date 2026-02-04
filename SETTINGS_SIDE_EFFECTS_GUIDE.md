# Super Admin Settings - Side Effects Implementation

## Overview

All 25+ settings in the Super Admin Settings Panel now have **real side effects** across the site. When you change a setting, it immediately affects platform behavior.

## How It Works

1. **Settings Applier** (`js/settingsApplier.js`) loads on every page
2. Fetches current settings every 30 seconds from `/api/settings`
3. Applies each setting to the appropriate UI elements and features
4. If **Maintenance Mode** is on, blocks all access completely

## Settings & Side Effects

### 🔧 Platform Control

| Setting | Side Effect |
|---------|------------|
| **Site Name** | Updates page titles, header, all navigation labels |
| **Maintenance Mode** | ✅ BLOCKS ALL ACCESS - Shows maintenance screen, hides entire app |
| **Maintenance Message** | Displays on maintenance screen (only if maintenance mode ON) |
| **Allow New User Registration** | Hides signup form, shows "Registration Closed" message when disabled |
| **Default Timezone** | Stored globally for user account settings |

**Example:** Toggle "Maintenance Mode" ON → Site immediately shows maintenance page to all users, blocks access completely.

---

### 🎓 Certificates

| Setting | Side Effect |
|---------|------------|
| **Enable Certificate Generation** | Hides all certificate download buttons when disabled |
| **Minimum Quiz Pass Percentage** | Enforced when users take quizzes - they must score ≥ this % to pass |
| **Allow Certificate Re-download** | Hides/shows "Re-download Certificate" button on user accounts |

**Example:** Change minimum from 70% to 80% → Next quiz taken enforces new threshold.

---

### 📰 News & Careers

| Setting | Side Effect |
|---------|------------|
| **Enable News System** | Hides entire news section when disabled |
| **Enable Likes/Reactions** | Hides all like buttons on news, comments, discussions |
| **Enable Careers Page** | Hides careers link in navigation and section when disabled |
| **Allow Careers PDF Download** | Hides PDF download button on career postings |

**Example:** Disable news system → News section disappears from all pages immediately.

---

### 🤖 AI Assistant

| Setting | Side Effect |
|---------|------------|
| **Enable AI Assistant** | Hides entire AI chat interface when disabled |
| **AI Access Mode** | "Premium Only" = shows upsell to non-premium users; "Everyone" = available to all |
| **AI Promotion Duration** | Auto-expires after set days (runs every 60 seconds on server) |
| **Daily Question Limit** | Enforced on API calls - users get `limit` questions per day |
| **Show AI Beta Notice** | Displays/hides beta badge next to AI feature |

**Example:** Change "Premium Only" to "Everyone" → AI chat immediately becomes available to all users, shows promotion banner.

---

### 💳 Premium & Trial

| Setting | Side Effect |
|---------|------------|
| **Enable Premium System** | Hides all upgrade buttons and premium features when disabled |
| **Free Trial Duration** | Set trial length (days) for new users |
| **Enable Premium for All** | ✅ GRANTS PREMIUM TO EVERYONE - Shows promotion banner, hides upgrade buttons |
| **Promotion Duration Value/Unit** | Controls how long the promotion lasts before auto-expiring |

**Example:** Toggle "Premium for All" ON with 7 days duration → All users immediately get premium access, see celebration banner, upgrade buttons disappear for 7 days then auto-revert.

---

### ⚙️ System Utilities

| Utility | Effect |
|---------|--------|
| **Clear Cache** | Clears all in-memory caches (helps troubleshoot issues) |
| **View Error Logs** | Shows last 100 lines from server.log for debugging |

---

## Real-Time Updates

The Settings Applier checks for changes **every 30 seconds**. This means:

✅ **Immediate effects:**
- Maintenance mode blocking
- UI visibility toggling
- Feature enablement

⏱️ **Within 30 seconds:**
- Other setting changes take effect
- Refreshed on next page load

## Testing the Settings

### Test 1: Maintenance Mode
1. Go to Admin Dashboard → Settings → Platform Control
2. Toggle "Enable Maintenance Mode" ON
3. Add message: "We're performing updates!"
4. Click "Save Platform Settings"
5. **Expected:** Site immediately shows maintenance screen blocking all access

### Test 2: Premium for Everyone
1. Go to Admin Dashboard → Settings → Premium & Trial
2. Toggle "Enable Premium for All" ON
3. Set duration to "7 days"
4. Click "Save Premium Settings"
5. **Expected:** 
   - All users see "Special Offer" banner
   - Upgrade button disappears
   - Premium features unlock
   - Auto-reverts after 7 days

### Test 3: Registration Toggle
1. Go to Admin Dashboard → Settings → Platform Control
2. Uncheck "Allow New User Registration"
3. Click "Save Platform Settings"
4. Navigate to registration page
5. **Expected:** Signup form hides, message shows "Registration Closed"

### Test 4: News System
1. Go to Admin Dashboard → Settings → News & Careers
2. Uncheck "Enable News System"
3. Click "Save Content Control Settings"
4. Refresh page
5. **Expected:** News section completely disappears

---

## Advanced Features

### Auto-Expiring Promotions

Promotions automatically expire without manual intervention:

- **AI Promotion:** Server checks every 60 seconds, reverts when `promotionEndAt` passes
- **Premium Promotion:** Same behavior - auto-reverts after duration expires
- **Notification:** System creates notification when promotion starts

### Cascade Effects

Some settings enable/disable others:

- **Maintenance Mode ON** → Blocks everything (other settings don't matter)
- **Premium Disabled** → All premium controls hide
- **AI Disabled** → All AI access blocked (mode doesn't matter)

---

## Database Persistence

All settings are stored in MongoDB in a single `PlatformSettings` document:

```
{
  _id: ObjectId,
  siteName: String,
  maintenanceMode: Boolean,
  maintenanceMessage: String,
  // ... 25+ more fields
}
```

**Updates are atomic** - changes save immediately to database and take effect within 30 seconds.

---

## Troubleshooting

**Settings change but don't take effect?**
1. Refresh the page
2. Wait 30 seconds for auto-refresh
3. Check browser console for errors: `⚙️ Initializing Settings Applier...`
4. Check server console for: `📥 Settings loaded from API`

**Maintenance mode stuck?**
1. Bypass by login with SuperAdmin token
2. Or disable via database directly
3. Or restart server (clears all state)

**AI/Premium not updating?**
1. Clear browser cache
2. Check `/api/settings` endpoint returns latest values
3. Verify MongoDB saved the values

---

## Security Notes

- Settings applier runs on **public pages** too
- Maintenance mode works for both logged-in and anonymous users
- Premium promotion visible to all users (by design)
- Admin-only settings (like AI promotion duration) not exposed to frontend

---

## Future Enhancements

Possible additions:
- Scheduled settings changes (apply at specific time)
- Settings audit trail (log who changed what when)
- Settings templates (save/load presets)
- Conditional settings (settings that depend on other settings)
- Real-time push updates (WebSocket instead of 30s polling)
