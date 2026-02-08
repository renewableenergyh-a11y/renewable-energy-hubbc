# AI Beta Badge Testing Guide

## Quick Test (Browser Console)

Open the browser developer console (F12 or Right-click → Inspect → Console) and run these commands in order:

### Step 1: Check Current Settings State
```javascript
window.settingsApplier.testSettingsState()
```
**Expected Output Should Show:**
- `showAiBetaNotice: true` (if enabled in admin)
- `aiAccessMode: Premium Only` or `Everyone`
- `window.showAiBetaNotice: true` (from window object)

**If this shows `false` or undefined:** The setting value isn't being retrieved from the backend.

### Step 2: Manually Trigger Badge Creation
```javascript
window.settingsApplier.testBadgeCreation()
```
**Expected Output Should Show:**
- `Nav menu exists: true/false`
- `Header exists: true/false`
- `Main exists: true/false`
- `Body exists: true`
- `Badge found: true/false`
- If badge found: `Badge visible in DOM: YES`

**If badge NOT found:** The createAiBetaBadge() function isn't creating elements.

### Step 3: Force Reapply Badge Setting
```javascript
window.settingsApplier.applyAiBetaNoticeSetting(true)
```
Then check if badge appears.

### Step 4: Check for Existing Badges
```javascript
document.querySelectorAll('[data-component="ai-beta-badge"]')
```
Should return badge element(s) if any exist.

---

## Enabling the Setting via Admin Panel

1. **Go to Admin Dashboard:** http://localhost:[PORT]/admin-login.html
2. **Navigate to:** Settings Panel → AI Assistant
3. **Find:** "Show AI is in Beta" checkbox
4. **Toggle it ON** to enable
5. **Click Save**
6. **Wait 5 seconds** (settings refresh every 5 seconds)
7. **Refresh page** (Ctrl+R or Cmd+R)
8. **Check for badge** in:
   - Top-right corner (floating badge)
   - Nav menu (if nav-menu exists)
   - Top of page (in gray banner)

---

## Troubleshooting

### Problem: testSettingsState() shows showAiBetaNotice = undefined

**Possible Causes:**
1. Backend isn't returning the setting
2. Setting never initialized in database

**Solution:**
```javascript
// Force admin to re-save the setting
// OR restart the server to reinitialize defaults
```

### Problem: Badge creation triggers but no badge is visible

**Check Box Model:**
```javascript
const badge = document.querySelector('[data-component="ai-beta-badge"]');
console.log('Badge HTML:', badge?.outerHTML);
console.log('Badge computed style:', window.getComputedStyle(badge));
```

**Force visibility:**
```javascript
// If badge exists but hidden
document.querySelector('[data-component="ai-beta-badge"]')?.style.setProperty('display', 'inline-block', 'important');
document.querySelector('[data-component="ai-beta-badge"]')?.style.setProperty('z-index', '10000', 'important');
```

### Problem: Settings applier not loading

**Verify it's initialized:**
```javascript
console.log('Settings Applier:', window.settingsApplier);
console.log('Has loadAndApply:', typeof window.settingsApplier?.loadAndApply);
```

**Force initialization:**
```javascript
if (!window.settingsApplier) {
  window.settingsApplier = new SettingsApplier();
  window.settingsApplier.init();
}
```

### Problem: Badge appears but doesn't hide when setting is OFF

**Possible Cause:** CSS rules not being applied or removed correctly

**Manual fix:**
```javascript
// Hide without CSS rules
document.querySelectorAll('[data-component="ai-beta-badge"]').forEach(badge => {
  badge.style.display = 'none !important';
});
```

---

## Expected Badge Appearance

The badge should appear as:
- **Text:** "✨ BETA" or "✨ AI BETA"
- **Background:** Purple gradient (from #667eea to #764ba2)
- **Text:** White, bold, uppercase, small font (10-11px)
- **Shadow:** Subtle shadow effect
- **Location Priority:**
  1. Nav menu (after other nav items)
  2. Top-right corner of header
  3. Top-right corner of page (floating)
  4. Top of main content (in gray banner)

---

## Server Logs to Check

If nothing works, check server output for:

```
[BETA NOTICE LOG] showAiBetaNotice value: true/false
📋 Applying AI Beta Notice setting - show: true/false
📍 Creating AI Beta badge dynamically...
✓ AI Beta badge inserted in [location]
```

If these logs don't appear, the method isn't being called at all.

---

## Quick Sanity Checks

1. **Is admin panel saving the setting?**
   ```javascript
   // Check network tab when you click Save
   // Should see PUT /api/settings/ai-assistant with showAiBetaNotice: true
   ```

2. **Is backend returning the setting?**
   ```javascript
   // In browser console:
   fetch('/api/settings/public/settings')
     .then(r => r.json())
     .then(d => console.log('showAiBetaNotice:', d.showAiBetaNotice))
   ```

3. **Is settings applier polling?**
   ```javascript
   // Should see console logs every 5 seconds:
   // 📥 ✅ Public Settings LOADED
   // [BETA NOTICE LOG] showAiBetaNotice value: [value]
   ```

---

## Nuclear Option - Force Everything

```javascript
// Completely reset and recreate
async function forceCreateBadge() {
  // 1. Remove any existing badges
  document.querySelectorAll('[data-component="ai-beta-badge"]').forEach(b => b.remove());
  
  // 2. Create new badge in nav menu
  const nav = document.getElementById('nav-menu');
  if (nav) {
    const span = document.createElement('span');
    span.setAttribute('data-component', 'ai-beta-badge');
    span.style.cssText = `
      display: inline-block !important;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: white !important;
      padding: 4px 10px !important;
      border-radius: 12px !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      text-transform: uppercase !important;
      margin-left: 6px !important;
      z-index: 10000 !important;
    `;
    span.textContent = '✨ BETA';
    nav.appendChild(span);
    console.log('✅ Badge force-created in nav menu');
  } else {
    console.log('❌ No nav menu found');
  }
}

await forceCreateBadge();
```

---

## Next Steps After Testing

1. Run the test commands above and note their output
2. Share the console output with debugging info
3. Check server logs for any errors
4. Verify admin panel setting is actually being saved (check Network tab in DevTools)
5. Verify backend API is returning the setting (use fetch command above)
