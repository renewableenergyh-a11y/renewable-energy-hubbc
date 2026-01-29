# WebRTC Phase 2.1 - Testing & Verification Guide

## Quick Start Testing

### Prerequisites
1. Two browser windows/tabs
2. Two test user accounts (or same account in incognito mode)
3. Network access to the application
4. Browser console access (F12)

---

## Test Scenario 1: Basic Offer/Answer Exchange

### Setup
1. User A: Open discussion room in Browser A
2. User B: Open same discussion in Browser B

### Expected Behavior

**Browser A Console**:
```
👤 [WebRTC] Peer connection created for new participant: B@example.com
📤 [WebRTC] Creating offer for: B@example.com
📝 [WebRTC] Local description set for B@example.com
✅ [WebRTC] Offer sent to B@example.com
```

**Browser B Console**:
```
📥 [WebRTC] Received offer from: A@example.com
📝 [WebRTC] Remote description (offer) set from A@example.com
📝 [WebRTC] Local description (answer) set for A@example.com
✅ [WebRTC] Answer sent to A@example.com
```

**Browser A Console (after receiving answer)**:
```
📥 [WebRTC] Received answer from: B@example.com
📝 [WebRTC] Remote description (answer) set from B@example.com
✅ [WebRTC] Signaling stable with B@example.com - state: stable
```

### Verification
✅ Both peers show "state: stable" in logs
✅ No errors in console
✅ `peerConnections` Map contains 1 entry (the remote peer)
✅ `signalingState` Map shows "stable" state

---

## Test Scenario 2: Three-Way Negotiation

### Setup
1. User A: Join discussion (first)
2. User B: Join discussion (second)
3. User C: Join discussion (third)

### Expected Behavior

**After B joins**:
- A creates offer for B
- B creates answer for A
- A-B pair signaling: STABLE

**After C joins**:
- A creates offer for C
  - C creates answer for A
  - A-C pair signaling: STABLE
- B creates offer for C
  - C creates answer for B
  - B-C pair signaling: STABLE

### Verification
- A's console: 2 peer connections (B and C), both stable
- B's console: 2 peer connections (A and C), both stable
- C's console: 2 peer connections (A and B), both stable

```javascript
// In console, check peer connection states:
webrtcManager.getStats()
// Should show:
// {
//   peerConnectionCount: 2,
//   peers: ['A@example.com', 'B@example.com']
// }
```

---

## Test Scenario 3: Server-Side Routing Verification

### Inspect Server Logs
When running the backend server, check for routing logs:

```
📤 [webrtc-offer] Routing offer: A@example.com -> B@example.com in session xyz
✅ [webrtc-offer] Offer delivered to B@example.com

📤 [webrtc-answer] Routing answer: B@example.com -> A@example.com in session xyz
✅ [webrtc-answer] Answer delivered to A@example.com
```

### Verification Checklist
- [ ] Server shows "Offer delivered to" for intended recipient
- [ ] Server shows "Answer delivered to" for intended recipient
- [ ] No broadcast to all participants (specific socket routing)
- [ ] No "Recipient not found" warnings for valid participants

---

## Test Scenario 4: Participant Cleanup

### Setup
1. Three participants in discussion (A, B, C)
2. All have stable signaling with each other

### Action
Participant B leaves the discussion

### Expected Behavior

**Server Log**:
```
👋 [participant-left] B has left
🔌 [WebRTC] Closed peer connection for leaving participant: B@example.com
```

**A's Console**:
```
🔌 [WebRTC] Closed peer connection for leaving participant: B@example.com
```

**C's Console**:
```
🔌 [WebRTC] Closed peer connection for leaving participant: B@example.com
```

### Verification
```javascript
// In A's console:
webrtcManager.peerConnections.size === 1  // Should be true (only C)
webrtcManager.peerConnections.has('B@example.com')  // Should be false

// In C's console:
webrtcManager.peerConnections.size === 1  // Should be true (only A)
webrtcManager.peerConnections.has('B@example.com')  // Should be false
```

---

## Console Inspection Commands

### Check WebRTC Manager State
```javascript
// Get all peer connections
console.log('Peer connections:', webrtcManager.peerConnections);

// Get all signaling states
console.log('Signaling states:', webrtcManager.signalingState);

// Get stats
console.log('WebRTC stats:', webrtcManager.getStats());

// Get a specific peer connection
const peerEmail = 'someone@example.com';
const pc = webrtcManager.peerConnections.get(peerEmail);
console.log(`Peer ${peerEmail} connection state:`, pc?.connectionState);
console.log(`Peer ${peerEmail} signaling state:`, pc?.signalingState);
```

### Check Socket Service State
```javascript
// Check if Socket.IO is connected
console.log('Socket connected:', discussionSocket.connected);

// Check session ID
console.log('Session ID:', discussionSocket.getCurrentSessionId());

// Check user ID
console.log('User ID:', discussionSocket.getCurrentUserId());
```

---

## Common Issues & Solutions

### Issue: Offer created but answer never received
**Check**:
1. Is B connected to Socket.IO? (`discussionSocket.connected`)
2. Does server show offer was delivered? (Check server logs)
3. Does B's console show "Received offer from"?
4. Is there a JavaScript error in B's browser?

### Issue: Answer received but signaling never becomes "stable"
**Check**:
1. Did A receive the answer? (Check console)
2. Is the answer SDP object valid?
3. Check if `handleRemoteAnswer()` is being called
4. Verify `setRemoteDescription()` completes without error

### Issue: Signaling state is "have-remote-offer" instead of "stable"
**Probable Cause**: The peer hasn't received the answer yet
**Check**:
1. Is the answer being sent? (Check Socket logs)
2. Did the server route it correctly?
3. Is the recipient socket still connected?

### Issue: Multiple peer connections created for same peer
**Probable Cause**: Participant joined twice (duplicate socket connections)
**Check**:
1. Check if user opened two tabs with same account
2. Server should use `userSocketMap` to prevent duplicate joins
3. Older socket should be cleaned up on new join

---

## Metrics to Monitor

### Per Peer Connection
- **Signaling State**: Should reach 'stable'
- **Connection State**: Should be 'connected' (Phase 2.3+ with media)
- **ICE Connection State**: Should be 'connected' (Phase 2.2+)
- **Creation Time**: Record when peer connection was created
- **Signaling Time**: Record when signaling became stable

### Network Metrics
- **WebRTC Offer Size**: SDP offer should be < 5KB
- **WebRTC Answer Size**: SDP answer should be < 5KB
- **Signaling Latency**: Time between offer and answer received
- **Message Count**: Should be 2 per peer pair (1 offer + 1 answer)

---

## Success Criteria

Phase 2.1 is working correctly when:

1. ✅ All peers create peer connections for new participants
2. ✅ Existing peers create offers when new participant joins
3. ✅ New peers create answers upon receiving offers
4. ✅ All peer-to-peer signaling states reach 'stable'
5. ✅ No broadcast of offer/answer to non-recipients
6. ✅ Peer connections are properly cleaned up on participant leave
7. ✅ Console logs show correct flow of SDP exchange
8. ✅ Server logs show correct routing to recipients
9. ✅ No JavaScript errors related to WebRTC
10. ✅ No Phase 1 features are broken

---

## Performance Baseline

For reference, typical timings for Phase 2.1:

- **Offer Creation**: < 50ms
- **Answer Creation**: < 50ms
- **Local Description Setting**: < 20ms
- **Remote Description Setting**: < 20ms
- **Total Signaling per Pair**: < 200ms from join to stable
- **Server Routing Latency**: < 50ms

If you see significantly higher timings, check:
- Browser CPU/memory usage
- Network latency to server
- JavaScript execution profiling

---

## Rollback Plan

If critical issues are discovered in Phase 2.1:

1. Revert `discussion-room.html` changes
2. Revert `js/services/discussionSocket.js` changes
3. Revert `server/sockets/discussionSocket.js` changes
4. Clear browser cache and localStorage
5. Verify Phase 1 features work again

All changes are backward compatible and can be reverted without data loss.

