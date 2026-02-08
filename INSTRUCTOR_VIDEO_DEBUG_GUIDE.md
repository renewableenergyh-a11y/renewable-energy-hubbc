# Instructor Video Delivery - Debugging Guide

## Issue
Students are not receiving instructor's video stream. They see "Waiting for instructor video..." message.

## Root Cause Analysis

The instructor video delivery involves these steps:
1. **Instructor's browser**: Captures video + audio
2. **Instructor's WebRTC Manager**: Detects instructor role and sets `canCreateOffers=true`
3. **Instructor's browser**: When students join, calls `handleNewParticipant()` → `createAndSendOffer()`
4. **Instructor sends offer**: Via Socket.IO with video track in SDP
5. **Student receives offer**: Browser logs "📥 [webrtc-offer-listener]"
6. **Student's WebRTC Manager**: Creates answer and sends back
7. **Student's ontrack handler**: Receives video stream and displays

**If students don't see video, the break is likely at step 2-4 (instructor side).**

---

## How to Debug (Browser Console Steps)

### Step 1: Get Instructor's Diagnostics
On the **INSTRUCTOR's browser tab**, open Developer Tools (F12) → Console and run:

```javascript
webrtcManager.getDiagnostics()
```

**Look for:**
```json
{
  "authorityModel": {
    "myRole": "superadmin",  // ← Should be admin/instructor/superadmin (NOT student)
    "isInstructor": true,     // ← Should be TRUE
    "canCreateOffers": true,  // ← Should be TRUE (this is critical!)
    "isOfferInitiator": true
  },
  "media": {
    "audioTracks": 1,         // ← Should be ≥ 1
    "videoTracks": 1          // ← Should be ≥ 1 for instructor
  },
  "peers": {
    "allParticipants": [      // ← Should list all students
      { "userId": "student1@example.com", "role": "student", "active": true }
    ],
    "peerConnectionCount": 1  // ← Should match number of students
  }
}
```

### Step 2: Check Role Detection
If `myRole` is something unexpected (like `'STUDENT'` when it should be `'SUPERADMIN'`), that's the problem.

**Check what the server sent:**
```javascript
// In browser localStorage
JSON.parse(localStorage.getItem('currentUser')).role
```

This should show `'superadmin'`, `'instructor'`, or `'admin'`.

### Step 3: Check Video Capture
If `videoTracks: 0`, the browser didn't capture video.

**Reasons:**
- User denied camera permission
- Camera not available
- Browser blocking camera
- Device bug

**Fix**: Check browser permissions:
1. Check address bar for camera icon
2. Chrome: Settings → Privacy → Camera → Allow renewable-energy-hubbc.com
3. Reload page and approve camera

### Step 4: Check Offer Creation
In browser console, search for these logs:

**You should see:**
```
📤 [WebRTC-DETERMINISTIC] ✅ AUTHORIZED to send offers - Creating and sending to student@example.com
✅ [WebRTC-DETERMINISTIC] INSTRUCTOR VIDEO CONFIRMED in offer for student@example.com
📤 [WebRTC-DETERMINISTIC] Sending offer to student@example.com
✅ [WebRTC-DETERMINISTIC] Offer sent to student@example.com
```

**If you see this instead:**
```
ℹ️ [WebRTC-DETERMINISTIC] ❌ NO OFFER AUTHORITY - Waiting to receive offer
```

**Root cause**: `canCreateOffers = false` when it should be `true`.

**Fix**: Check if:
- Role is being passed correctly from server
- Role is being normalized to lowercase
- Role comparison is case-insensitive

### Step 5: Check Socket.IO Connection
Verify Socket.IO is connected:

```javascript
discussionSocket.socket.connected  // Should be true
discussionSocket.emitWebRTCOffer   // Should be a function
```

---

## Student-Side Debugging

### On STUDENT's browser, check:

```javascript
webrtcManager.getDiagnostics()
```

**Look specifically at:**
```json
{
  "authorityModel": {
    "myRole": "student",           // ← Correct
    "canCreateOffers": false,      // ← Correct (students don't send offers)
    "instructorPresent": true
  },
  "peers": {
    "peerConnectionCount": 1,      // ← Should be 1 (for instructor)
    "peerConnections": [{
      "peerId": "instructor@example.com",
      "connectionState": "connected",
      "signalingState": "stable",
      "senders": [
        { "kind": "audio", "active": true },      // ← Can be any
        { "kind": "video", "active": false }      // ← Can be false (students don't send video)
      ]
    }]
  }
}
```

### Check for offer reception:
In console, look for:
```
📥 [webrtc-offer-listener] Listener triggered with: from: instructor@example.com
📥 [webrtc-offer] Calling handleRemoteOffer...
```

If you DON'T see these, the instructor is not sending offers.

---

## Most Common Issues

### Issue #1: Browser Permission Denied
**Symptom**: Instructor sees no video
**Log**: `📹 [WebRTC-lecture] Failed to get media: NotAllowedError`
**Fix**: Grant camera permission in browser

### Issue #2: Role Not Detected as Instructor
**Symptom**: `canCreateOffers = false` even though user is superadmin
**Logs**: `ℹ️ NO OFFER AUTHORITY`
**Fix**: Check if role from server has different casing or format

### Issue #3: Role Casing Mismatch
**Symptom**: Server sends `'SUPERADMIN'` but code checks `'superadmin'`
**Fix**: Our latest update normalizes to lowercase, so reload page

### Issue #4: Offers Sent But No Video Track
**Symptom**: Offers sent, student gets them, but no video
**Log**: `⚠️ CRITICAL: Instructor offer WITHOUT VIDEO`
**Fix**: Check video capture on instructor side

### Issue #5: Socket.IO Connection Lost
**Symptom**: Offers not sent/received
**Check**: `discussionSocket.socket.connected === true`
**Fix**: Check if Socket.IO auth failed

---

## Quick Diagnostic Script

Run this in instructor browser console to check everything at once:

```javascript
console.log('=== INSTRUCTOR VIDEO DIAGNOSTIC ===');
const diag = webrtcManager.getDiagnostics();

if (diag.authorityModel.myRole !== 'superadmin' && 
    diag.authorityModel.myRole !== 'admin' && 
    diag.authorityModel.myRole !== 'instructor') {
  console.error('❌ CRITICAL: Role NOT instructor:', diag.authorityModel.myRole);
}

if (!diag.authorityModel.canCreateOffers) {
  console.error('❌ CRITICAL: canCreateOffers=false, should be true!');
}

if (diag.media.videoTracks === 0) {
  console.error('❌ CRITICAL: No video tracks captured!');
}

if (diag.peers.peerConnectionCount === 0) {
  console.warn('⚠️ No peer connections yet - wait for students to join');
} else {
  console.log(`✅ ${diag.peers.peerConnectionCount} peer connections established`);
}

console.log('✅ Socket.IO connected:', discussionSocket.socket.connected);
```

---

## Network Inspection (Advanced)

### Check what's being sent in offers:
1. Open DevTools → Network tab
2. Filter by `socket.io`
3. Look for WebSocket messages with `webrtc-offer`
4. Click to see the message payload
5. Search for `video` in the SDP content

**If SDP contains `m=video` line, video is in the offer.**
**If no `m=video` line, video wasn't added to the connection.**

---

## Server-Side Check

Check if server is correctly forwarding offers:

```bash
# Check server logs
docker logs <container> | grep "webrtc-offer"
```

Should show:
```
📤 [webrtc-offer] Routing offer: instructor@example.com -> student@example.com
✅ [webrtc-offer] Offer delivered to student@example.com
```

If offers aren't being routed, that's a server issue.

---

## Step-by-Step Fix Checklist

- [ ] 1. Reload page to get latest code with role normalization
- [ ] 2. On instructor browser: Run getDiagnostics()
- [ ] 3. Verify instructorModel.myRole is correct
- [ ] 4. Verify authorityModel.canCreateOffers = true
- [ ] 5. Verify media.videoTracks > 0
- [ ] 6. Wait for students to join
- [ ] 7. Check console for "AUTHORIZED to send offers" log
- [ ] 8. Check for "INSTRUCTOR VIDEO CONFIRMED" log
- [ ] 9. On student browser: Check for "📥 [webrtc-offer-listener]" log
- [ ] 10. Check that ontrack handlers fire and display video

---

## Expected Console Output (After Fix)

### Instructor Side:
```
🔗 [WebRTC-INIT] Role normalization: superadmin → superadmin
📹 [WebRTC-MEDIA] Role check: currentSessionUserRole=superadmin, isAdmin=true
📹 [WebRTC-MEDIA] Instructor detected - requesting VIDEO
✅ [WebRTC-CRITICAL] INSTRUCTOR HAS VIDEO - 1 video track(s) available
👤 [WebRTC-DETERMINISTIC] New participant: student@example.com
✅ [WebRTC-DETERMINISTIC] ✅ AUTHORIZED to send offers
✅ [WebRTC-DETERMINISTIC] INSTRUCTOR VIDEO CONFIRMED in offer for student@example.com
📤 [WebRTC-DETERMINISTIC] Sending offer to student@example.com
✅ [WebRTC-DETERMINISTIC] Offer sent to student@example.com
```

### Student Side:
```
👤 [WebRTC-DETERMINISTIC] New participant: instructor@example.com
ℹ️ [WebRTC-DETERMINISTIC] ❌ NO OFFER AUTHORITY - Waiting to receive offer
📥 [webrtc-offer-listener] Listener triggered with: from: instructor@example.com
📥 [webrtc-offer] Calling handleRemoteOffer...
🎬 [WebRTC-lecture] ontrack fired from instructor@example.com, kind: video
✅ [WebRTC-lecture] Attaching instructor video...
```

---

## Still Not Working?

Please provide:
1. **Instructor browser console output** (copy all WebRTC logs)
2. **Student browser console output** (copy all WebRTC logs)
3. **Results of getDiagnostics()** from both sides
4. **Browser type** (Chrome, Firefox, Safari, etc.)
5. **Any error messages** in console

This will help pinpoint exactly where the video delivery is breaking.

