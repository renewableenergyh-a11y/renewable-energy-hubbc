# Highlighting System Debug Guide

## Overview
This guide walks through testing the highlighting system with detailed console logging to identify where color persistence is failing.

## Current Implementation Status

### ✅ Fixed in Latest Commit (1a75d56)
1. **Toolbar hiding** - Now hides immediately after color change
2. **Enhanced logging** - Added console logs at all key checkpoints
3. **Mobile optimization** - Toolbar size reduced and overflow prevented

### ❌ Known Issue
**Colors don't persist on reload** - Changed highlight colors revert to original when page is reloaded

## Testing Procedure

### Step 1: Open Browser Developer Console
1. Open module page (e.g., `/modules/solar-energy`)
2. Press `F12` or `Ctrl+Shift+I` to open DevTools
3. Go to **Console** tab
4. Keep console visible while testing

### Step 2: Create or Click a Highlight

**Option A: Create New Highlight**
- Select text in the module
- Toolbar appears
- Click a color button
- Watch console for logs

**Option B: Click Existing Highlight**
- Click on an already-highlighted word
- Toolbar appears with current color
- Click a different color button
- Watch console for logs

### Step 3: Monitor Console Logs

Watch for this sequence:

```
🎨 Color updated in DOM: { highlightId: "...", newColor: "#..." }
📤 Sending color update to server: { highlightId: "...", newColor: "#..." }
📡 Updating highlight on server: { highlightId: "...", color: "#..." }
📥 Server response status: 200
📥 Server response data: { id: "...", color: "#...", ... }
✅ Server confirmed update: { ... }
```

### Step 4: Reload Page and Check Persistence

After color change:
1. Press `F5` or `Ctrl+R` to reload
2. **Check console for:**
   ```
   📥 Fetched highlights: [{ id: "...", color: "#..." }, ...]
   🔄 Reapplying highlights: [{ id: "...", color: "#..." }, ...]
     ⚙️ Processing highlight: { highlightId: "...", color: "#..." }
   ```

3. **Visually check:** Does the highlight show the NEW color or revert to original?

## Diagnostic Decision Tree

### Issue: Color Changed, But Reverted on Reload

**Check Step 1: Was the color actually sent to server?**
- Look for `📤 Sending color update to server:` log
- If **NOT present** → Bug in frontend sending logic
- If **present** → Continue to Step 2

**Check Step 2: Did server respond successfully?**
- Look for `📥 Server response status: 200`
- If **status is NOT 200** → Server error, check backend logs
- If **status IS 200** → Continue to Step 3

**Check Step 3: Did server return the new color?**
- Look for `📥 Server response data:` with color field
- Compare the color value returned to what was sent
- If **colors DON'T match** → Server didn't save properly
  - Check: Database connection, Mongoose save logic, query matching
- If **colors MATCH** → Continue to Step 4

**Check Step 4: On reload, does fetch retrieve new color?**
- After reload, look for `📥 Fetched highlights:` log
- Check if color value in fetched data matches what was set
- If **color is OLD** → GET endpoint returning wrong data
  - Check: Query filter, database retrieval
- If **color is NEW** → Continue to Step 5

**Check Step 5: Does DOM show the new color?**
- Look for `🔄 Reapplying highlights:` log
- Check if the `color` field shown matches what was saved
- Visually inspect the page
- If **DOM shows OLD color despite correct fetch** → Bug in `reapplyHighlights()`
- If **DOM shows NEW color** → ✅ System working!

## Example Test Case

### Test: Change Blue Highlight to Red

**Setup:**
- Module loaded with existing highlight: "Lorem ipsum" in blue (#CCFF99 - greenish)
- Click the highlight
- Toolbar appears showing current color

**Action:**
- Click red color button

**Expected Logs:**
```
🎨 Color updated in DOM: { highlightId: "507f1f77bcf86cd799439011", newColor: "#FF0000" }
📤 Sending color update to server: { highlightId: "507f1f77bcf86cd799439011", newColor: "#FF0000" }
📡 Updating highlight on server: { highlightId: "507f1f77bcf86cd799439011", color: "#FF0000" }
📥 Server response status: 200
📥 Server response data: { 
  id: "507f1f77bcf86cd799439011", 
  color: "#FF0000", 
  text: "Lorem ipsum",
  ... other fields
}
✅ Server confirmed update: { id: "507f1f77bcf86cd799439011", color: "#FF0000", ... }
```

**Verify Visually:**
- Highlight should turn RED immediately
- Toolbar should hide immediately

**Reload Test:**
- Press F5
- **Expected logs:**
```
📥 Fetched highlights: [{ id: "507f1f77bcf86cd799439011", color: "#FF0000" }, ...]
🔄 Reapplying highlights: [{ id: "507f1f77bcf86cd799439011", color: "#FF0000", text: "Lorem ipsum" }, ...]
  ⚙️ Processing highlight: { highlightId: "507f1f77bcf86cd799439011", color: "#FF0000" }
```

**Verify Visually:**
- Highlight should STILL be RED (not revert to original)
- This confirms persistence is working ✅

## Common Issues and Fixes

### Issue: Logs show old color in response, not new color

**Possible causes:**
1. **Server not saving to database**
   - Check Mongoose save() call
   - Verify database connection
   - Check for validation errors

2. **Query not finding correct document**
   - Verify ObjectId conversion: `new mongoose.Types.ObjectId(highlightId)`
   - Check if document actually exists in database
   - Verify userEmail filter matches

3. **Multiple highlights with same content**
   - Check if wrong document is being updated

**Debug steps:**
- Add logging to server PUT endpoint
- Check MongoDB directly for document updates
- Verify correct highlight ID is being used

### Issue: Fetch shows new color, but DOM shows old color

**Possible causes:**
1. **reapplyHighlights() has color bug**
   - Check background color assignment
   - Verify CSS color format consistency

2. **Color being overridden after reapply**
   - Check for conflicting styles
   - Verify no other code modifying highlight colors

**Debug steps:**
- Inspect element in DevTools, check computed styles
- Add more logging to `reapplyHighlights()` function
- Check for CSS rules overriding colors

### Issue: Server returns error (status not 200)

**Possible causes:**
1. **Authentication failure (401)**
   - Check token is valid
   - Verify Bearer token format

2. **Validation error (400)**
   - Check color format validity
   - Verify required fields present

3. **Server error (500)**
   - Check server logs
   - Verify database connection

**Debug steps:**
- Copy full error response from console
- Check server logs on Render
- Verify API endpoint is correct

## Files with Logging

| File | Function | Logs |
|------|----------|------|
| `js/pages/modulePage.js` | `handleUpdateHighlightColor()` | 🎨 DOM update, 📤 Server send, ❌ Error |
| `js/core/highlightService.js` | `updateHighlight()` | 📡 Request, 📥 Response status, 📥 Response data, ✅ Success |
| `js/core/highlightService.js` | `fetchHighlights()` | 📥 Fetched highlights |
| `js/core/highlightService.js` | `reapplyHighlights()` | 🔄 Reapplying, ⚙️ Processing |

## Server-Side Debugging (Backend)

If frontend logs show color is sent and server responds with 200, issue is likely on backend:

**Check: server/routes/highlightRoutes.js**
- Lines 228-301: PUT route handler
- Verify: `new mongoose.Types.ObjectId(highlightId)` works correctly
- Verify: Mongoose `save()` is actually persisting

**Check: Database directly**
```bash
# Connect to MongoDB
# Query the highlights collection
db.highlights.findOne({ _id: ObjectId("...") })
# Check if color field was updated
```

## Next Steps After Diagnosis

Once logs reveal the failure point:

1. **If client sending wrong data:**
   - Check color value format consistency
   - Verify correct highlight ID is used

2. **If server not saving:**
   - Add server-side logging to PUT route
   - Verify Mongoose schema/model
   - Check database connection

3. **If GET retrieving old data:**
   - Verify query filter is correct
   - Check database has new data
   - Look for caching issues

4. **If DOM not showing new color:**
   - Check `reapplyHighlights()` logic
   - Verify CSS color format
   - Look for style override issues

## Quick Commands

**Force fresh page load (bypass cache):**
```
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

**Clear console:**
```
console.clear()
```

**Filter logs by emoji:**
- In DevTools, search "📤" to find sending logs
- Search "📥" to find response logs
- Search "❌" to find errors

## Logging Reference

| Emoji | Meaning | When It Appears |
|-------|---------|-----------------|
| 🎨 | DOM update | Color applied to DOM element |
| 📤 | Sending to server | Before fetch request sent |
| 📡 | Server processing | Inside server request handler |
| 📥 | Server response | After fetch completes |
| 🔄 | Reapplying | Highlights being reapplied on page load |
| ⚙️ | Processing item | Each highlight being processed |
| ✅ | Success | Operation completed successfully |
| ❌ | Error | Operation failed |

