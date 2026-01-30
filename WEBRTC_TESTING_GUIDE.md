# WebRTC Video Exchange - Testing Guide

**Date:** January 30, 2026  
**Status:** Implementation Complete - Ready for Testing  
**Test Environment:** Local or Staging

---

## Quick Start Testing

### Test Setup
```
Minimum: 2 browsers/devices
Recommended: 3+ for scalability testing
Network: Local LAN or public internet (both tested)
```

### Test 1: Basic 2-Person Video (5 minutes)

**Setup:**
1. Open Browser A: http://localhost:3000/discussion-room.html?sessionId=test-session-1
2. Open Browser B: http://localhost:3000/discussion-room.html?sessionId=test-session-1
3. Log in as different users in each browser

**Verify:**
- [ ] Both users appear in participant list
- [ ] Both see local camera preview (top-left corner)
- [ ] Browser A sees Browser B's video in grid after 2-3 seconds
- [ ] Browser B sees Browser A's video in grid after 2-3 seconds
- [ ] Videos have participant name labels
- [ ] Console shows "Remote track received" logs
- [ ] No red error messages in console

**Expected Logs:**
```
✅ [WebRTC] Peer connection established
📥 [WebRTC] Remote track received
📺 [attachRemoteStream] Stream attached to video element
▶️ [attachRemoteStream] Video playing
```

---

### Test 2: Audio Bidirectional Flow (3 minutes)

**Setup:** Continue from Test 1

**Verify:**
- [ ] Speak into microphone in Browser A
- [ ] Browser B hears audio clearly
- [ ] No lag or delay
- [ ] Audio quality acceptable
- [ ] Speak into Browser B microphone
- [ ] Browser A hears audio clearly
- [ ] Echo suppression working (no feedback)

**Expected Result:** Clear two-way audio within 1-2 seconds

---

### Test 3: Participant Leave (2 minutes)

**Setup:** Continue from Test 2

**Verify:**
- [ ] Click "Leave Room" in Browser A
- [ ] Browser A video disappears from Browser B's grid
- [ ] Participant list updates
- [ ] No console errors
- [ ] Browser B can continue unaffected

**Check:**
- [ ] No "undefined" video tiles
- [ ] No "Cannot read property 'getTracks()'" errors
- [ ] Grid responsive after tile removal

---

### Test 4: Participant Rejoin (2 minutes)

**Setup:** Continue from Test 3

**Verify:**
- [ ] Browser A rejoins same session
- [ ] Browser B's video reappears after 2-3 seconds
- [ ] Video quality same as initial connection
- [ ] No console errors
- [ ] Audio works again

**Expected:** Seamless reconnection, no manual refresh needed

---

### Test 5: Multiple Participants (5 minutes)

**Setup:**
- Open 3 browsers
- All join same session
- Log in as different users

**Verify:**
- [ ] All 3 participant videos visible in grid
- [ ] Grid responsive layout (may be 2x2 or 3x1 depending on screen)
- [ ] All name labels visible
- [ ] Audio from all participants audible
- [ ] No cross-talk or echo
- [ ] All participants see all videos

**Expected Grid Layout:**
```
On Desktop (1440px wide):
┌─────────────┬─────────────┐
│  User A     │  User B     │
├─────────────┼─────────────┤
│  User C     │             │
└─────────────┴─────────────┘

On Mobile (375px wide):
┌──────────────┐
│   User A     │
├──────────────┤
│   User B     │
├──────────────┤
│   User C     │
└──────────────┘
```

---

### Test 6: Mobile Responsiveness (3 minutes)

**Setup:**
- Open 2 mobile devices
- Join same session
- Test on different screen sizes

**Verify on Mobile:**
- [ ] Local video preview visible
- [ ] Remote video grid single column
- [ ] Videos fill screen width
- [ ] Name labels visible
- [ ] Audio/video working
- [ ] No layout overflow
- [ ] Buttons accessible

**Test on Different Screen Sizes:**
- [ ] iPhone 12 (390px)
- [ ] iPad (768px)
- [ ] Large desktop (1920px)

**Expected:** Responsive layout adjusts for all sizes

---

### Test 7: Console Verification (2 minutes)

**Setup:** Continue from Test 1

**Open Browser Console (F12):**

**Check for:**
- [ ] No red errors (should have only logs, warnings ok)
- [ ] WebRTC logs present
- [ ] Connection established messages
- [ ] No "RTCSessionDescription" errors
- [ ] No memory warnings

**Expected Logs Present:**
```
✅ [WebRTC] Local media captured successfully
✅ [WebRTC] Peer connection created for: user@example.com
📤 [WebRTC] Emitting webrtc-offer
📥 [WebRTC] Received offer from: user@example.com
📝 [WebRTC] Remote description (offer) set
✅ [WebRTC] Answer sent
🧊 [WebRTC] ICE candidate exchanged
✅ [WebRTC] Peer connection established
📥 [WebRTC] Remote track received
📺 [attachRemoteStream] Stream attached to video element
▶️ [attachRemoteStream] Video playing
```

**Check NOT Present:**
- [ ] "RTCSessionDescription is not a constructor"
- [ ] "Failed to attach remote stream"
- [ ] "Cannot read property 'srcObject'"
- [ ] Memory leak warnings

---

### Test 8: Camera/Microphone Permission Denied (2 minutes)

**Setup:**
- Browser A: Allow camera/mic permissions
- Browser B: Deny camera/mic permissions

**Verify:**
- [ ] Browser B shows "Camera/microphone permission denied" message
- [ ] Browser B can still see Browser A's video
- [ ] Browser B can see participant list
- [ ] No crashes or errors
- [ ] Can rejoin later with permissions allowed

---

### Test 9: Network Interruption (3 minutes)

**Setup:** Continue from Test 1 (2-person session)

**Simulate Network Issues:**
1. Go to DevTools → Network
2. Throttle to "Slow 3G"
3. Check video/audio quality

**Verify:**
- [ ] Video still displays (may buffer)
- [ ] Audio still plays (may be choppy)
- [ ] No infinite loop or crashes
- [ ] Can recover after throttle removed

**Restore Connection:**
1. Go back to "No throttling"
2. Video/audio should improve within seconds

---

### Test 10: Load Testing (5 minutes)

**Setup:** 
- 5 participants in same session
- Monitor performance

**Verify:**
- [ ] All 5 videos appear
- [ ] Grid layout handles 5 items
- [ ] Video quality acceptable
- [ ] Audio from all 5 clear
- [ ] CPU usage reasonable (< 80%)
- [ ] No lag when scrolling or interacting

**Performance Check:**
```
DevTools → Performance → Record
- Check FPS (target: 30+ fps)
- Check CPU usage (target: < 80%)
- Check memory (should be stable)
```

---

## Issue Tracking

### If Videos Don't Show:

**Checklist:**
1. [ ] Both users logged in to same session
2. [ ] Both users in participant list
3. [ ] Check console for errors
4. [ ] Check browser camera permissions
5. [ ] Refresh page and try again

**Debug Steps:**
```javascript
// In console:
webrtcManager.getStats()
// Should show:
// {
//   localStreamActive: true,
//   peerConnectionCount: 1,
//   peers: ["other@user.com"]
// }
```

### If Audio Doesn't Work:

**Checklist:**
1. [ ] Volume not muted (check system volume)
2. [ ] Browser hasn't muted audio
3. [ ] Microphone working (test in browser settings)
4. [ ] Audio device selected in browser

### If Console Shows Errors:

**Common Errors & Fixes:**

| Error | Cause | Fix |
|-------|-------|-----|
| "RTCSessionDescription not constructor" | Old code still running | Hard refresh (Ctrl+F5) |
| "Cannot read property 'srcObject'" | Stream null | Check network, rejoin |
| "Media stream not found" | getUserMedia failed | Check camera permissions |
| "Peer connection failed" | ICE failed | Check firewall/NAT |

---

## Performance Benchmarks

Expected performance metrics:

```
Connection Time: 2-5 seconds (first video appear)
Audio Latency: < 500ms (acceptable)
Video Frame Rate: 24-30 fps (good)
CPU Usage: 15-30% per peer (normal)
Memory: Stable after connection (no leaks)
```

---

## Sign-Off Checklist

- [ ] Basic 2-person video working
- [ ] Audio bidirectional
- [ ] Participant leave/rejoin working
- [ ] No console errors
- [ ] Mobile responsive
- [ ] 3+ participants tested
- [ ] All above tests passed

---

## When Ready for Production

After all tests pass:

```bash
git log --oneline -1
# Verify commit: "Fix: Implement WebRTC video/audio stream rendering"

git push origin main
# Deploy to production
```

---

## Rollback Steps (if needed)

```bash
git revert HEAD
# Or
git reset --hard <previous-commit>
git push origin main
```

---

**Test Status: READY TO BEGIN**  
**Test Duration: ~30 minutes for full suite**  
**Expected Pass Rate: 100% if implementation correct**

