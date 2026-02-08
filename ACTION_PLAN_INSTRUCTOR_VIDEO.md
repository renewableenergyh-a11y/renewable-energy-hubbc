# Action Plan: Fix Instructor Video Delivery

## Immediate Steps

### 1. Reload the Page (Important)
The code has been updated with better diagnostics and role normalization. **Reload both instructor and student browsers** to get the latest code.

```
Hard reload: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
```

### 2. Test the Scenario
- Have **instructor** logged in and in the discussion room
- Have **1-2 students** logged in and in the same room
- Check if students see instructor's video

### 3. If Still Not Working, Debug with Browser Console

On **INSTRUCTOR's browser** (F12 → Console):

```javascript
// Run this diagnostic
webrtcManager.getDiagnostics()
```

**Check these specific values:**

| Check | Expected | If Wrong |
|-------|----------|----------|
| `myRole` | `'superadmin'` or `'admin'` or `'instructor'` | Role not detected - check server |
| `isInstructor` | `true` | Role being treated as student |
| `canCreateOffers` | `true` | **THIS IS CRITICAL** |
| `videoTracks` | `≥ 1` | Browser blocked camera |
| `peerConnectionCount` | `≥ 1` | No students connected yet |

### 4. Check Console Logs

On **INSTRUCTOR's browser** (F12 → Console, search for):

**You MUST see these logs:**
```
✅ [WebRTC-CRITICAL] INSTRUCTOR HAS VIDEO - 1 video track(s) available
📤 [WebRTC-DETERMINISTIC] ✅ AUTHORIZED to send offers
✅ [WebRTC-DETERMINISTIC] INSTRUCTOR VIDEO CONFIRMED in offer
```

**If you see instead:**
```
❌ [WebRTC-CRITICAL] INSTRUCTOR HAS NO VIDEO TRACKS!
ℹ️ [WebRTC-DETERMINISTIC] ❌ NO OFFER AUTHORITY
```

Then there's a specific problem - see Troubleshooting section.

### 5. Verify on Student Side

On **STUDENT's browser** (F12 → Console, search for):

**You should see:**
```
📥 [webrtc-offer-listener] Listener triggered with: from: instructor@example.com
📥 [webrtc-offer] Calling handleRemoteOffer...
🎬 [WebRTC-lecture] ontrack fired from instructor@example.com, kind: video
```

If you DON'T see these, the instructor isn't sending offers.

---

## Troubleshooting

### Problem 1: `videoTracks: 0` on Instructor

**Cause**: Browser blocked camera or camera unavailable

**Fix**:
1. Check Chrome address bar - camera icon blocked?
2. Chrome Settings → Privacy → Camera → Allow this site
3. On Windows: Settings → Privacy & Security → Camera → Allow
4. Reload page and approve camera when prompted

### Problem 2: `canCreateOffers: false` on Instructor

**Cause**: Role not detected as instructor

**Check what the server sent:**
```javascript
JSON.parse(localStorage.getItem('currentUser')).role
```

**Possible causes**:
- Server returning wrong role
- Role has different casing (should be normalized now)
- User logged in as student by mistake

**Fix**: 
- Re-login as instructor
- Verify server has correct role for this user

### Problem 3: Logs Show "NO OFFER AUTHORITY"

**Cause**: Either:
- Not detected as instructor (see Problem 2)
- OR first participant logic thinking this is peer mode

**Debug more:**
```javascript
const d = webrtcManager.getDiagnostics();
console.log('Is instructor:', d.authorityModel.isInstructor);
console.log('Session mode:', d.authorityModel.sessionMode);
console.log('Instructor present:', d.authorityModel.instructorPresent);
```

If `isInstructor: true` but `canCreateOffers: false`, there's a bug in the logic.

### Problem 4: Offers Being Sent But Video Still Not Showing

**This means:**
- Instructor IS sending offers
- But offers don't have video in them
- OR student is receiving offers but ontrack handler not firing

**Check instructor console for:**
```
⚠️ CRITICAL: Instructor offer WITHOUT VIDEO
```

If you see this, video wasn't added to connection despite being available.

**Check student console for:**
```
🎬 [WebRTC-lecture] ontrack fired from instructor@example.com, kind: video
```

If you DON'T see this, student received offer but no video track in answer.

---

## Step-by-Step Debug Checklist

### On Instructor Browser:
- [ ] Page reloaded (hard reload)
- [ ] getDiagnostics() shows audioTracks: ≥ 1
- [ ] getDiagnostics() shows videoTracks: ≥ 1 (NOT 0)
- [ ] getDiagnostics() shows canCreateOffers: true (NOT false)
- [ ] Students have joined room
- [ ] getDiagnostics() shows peerConnectionCount: ≥ 1 (matches number of students)
- [ ] Console shows "✅ INSTRUCTOR HAS VIDEO" log
- [ ] Console shows "✅ AUTHORIZED to send offers" log
- [ ] Console shows "✅ INSTRUCTOR VIDEO CONFIRMED in offer" log
- [ ] Console shows "📤 Sending offer to student@email.com" logs

### On Student Browser:
- [ ] getDiagnostics() shows canCreateOffers: false (correct, students don't send offers)
- [ ] getDiagnostics() shows peerConnectionCount: ≥ 1 (for instructor)
- [ ] Console shows "ℹ️ Waiting to receive offer" log
- [ ] Console shows "📥 [webrtc-offer-listener]" log
- [ ] Console shows "🎬 ontrack fired... kind: video" log
- [ ] Video element displayed on screen

---

## If Problem Persists

Please follow the "Instructor Video Delivery - Debugging Guide" at:
[INSTRUCTOR_VIDEO_DEBUG_GUIDE.md](INSTRUCTOR_VIDEO_DEBUG_GUIDE.md)

It has detailed steps for:
- Network inspection (checking actual WebRTC SDP)
- Socket.IO message verification
- Server log checking
- Browser permission troubleshooting
- Role detection verification

---

## Expected Behavior After Fix

1. **Instructor joins**: Page shows instructor's own video in main container
2. **Students join**: Each student connects to instructor
3. **Students see**: 
   - Instructor's video in center
   - Their own audio waveform
   - Chat and other controls
4. **Audio**: Full mesh - all students hear each other + instructor
5. **Video**: Instructor only (one-way from instructor to all students)

---

## Key Commits with These Fixes

Latest diagnostic improvements:
- Commit: `11c7e88` - Enhanced diagnostics for instructor video
- Commit: `60379b0` - Added debugging guide

The enhancements include:
- ✅ Role normalization (case-insensitive)
- ✅ Detailed video track logging
- ✅ Enhanced getDiagnostics() output
- ✅ Clear error messages if instructor has no video
- ✅ Better offer authority validation

---

## Next Steps

1. **Hard reload** the page
2. **Run getDiagnostics()** on both instructor and student
3. **Follow the checklist** above
4. **Check console logs** for the specific indicators
5. **If still broken**, use the detailed debugging guide to inspect network traffic and SDP content

Please report which step is failing and what the diagnostics show, and we can pinpoint the exact cause!

