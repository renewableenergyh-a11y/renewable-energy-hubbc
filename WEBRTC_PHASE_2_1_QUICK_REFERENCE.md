# WebRTC Phase 2.1 - Quick Reference Card

## What is Phase 2.1?
**SDP Offer/Answer Signaling** - Peers establish stable WebRTC connections via email-based identity and Socket.IO routing.

---

## Key Concepts

### Peer Identity
```javascript
// Always use email
user.email  // "alice@example.com"

// Maps use email as key
webrtcManager.peerConnections.get("bob@example.com")  // RTCPeerConnection
```

### Signaling States
```
new → have-local-offer → have-remote-offer → stable ✓
   or                                    ↓
     have-local-answer → stable ✓
```

### Message Flow
```
Existing Peer              New Peer
    |                        |
    └─→ createOffer()       |
        setLocalDesc() ─┐    |
                        └──→ webrtc-offer event
                             |
                             setRemoteDesc()
                        ┌──→ createAnswer()
                        |    setLocalDesc()
                webrtc-answer event ←─┘
        setRemoteDesc() ←──┘
           stable ✓         stable ✓
```

---

## Common Code Patterns

### Creating an Offer
```javascript
// Called automatically when new participant joins
const pc = webrtcManager.getPeerConnection("peer@example.com");
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
discussionSocket.emitWebRTCOffer({
  sessionId: sessionData.sessionId,
  from: user.email,
  to: "peer@example.com",
  sdp: offer
});
```

### Handling an Offer
```javascript
// Listen for webrtc-offer event
discussionSocket.on('webrtc-offer', (offerData) => {
  webrtcManager.handleRemoteOffer(
    offerData,
    (data) => discussionSocket.emitWebRTCAnswer(data)
  );
});
```

### Handling an Answer
```javascript
// Listen for webrtc-answer event
discussionSocket.on('webrtc-answer', (answerData) => {
  webrtcManager.handleRemoteAnswer(answerData);
});
```

---

## Console Debugging

### Check All Peer Connections
```javascript
webrtcManager.peerConnections
// Map(2) {
//   'alice@example.com' => RTCPeerConnection,
//   'bob@example.com' => RTCPeerConnection
// }
```

### Check Signaling State
```javascript
webrtcManager.signalingState.get("alice@example.com")
// { state: 'stable' }
```

### Get Overall Stats
```javascript
webrtcManager.getStats()
// {
//   peerConnectionCount: 2,
//   peers: ['alice@example.com', 'bob@example.com']
// }
```

### Check Single Peer Connection
```javascript
const pc = webrtcManager.peerConnections.get("alice@example.com");
console.log(pc.signalingState);  // 'stable'
console.log(pc.connectionState); // 'new' (no media in Phase 2.1)
```

---

## Event Listeners

### Three Socket Events Used

**1. webrtc-offer** - Incoming SDP offer
```javascript
discussionSocket.on('webrtc-offer', (offerData) => {
  // { sessionId, from, to, sdp }
  webrtcManager.handleRemoteOffer(offerData, emitFunction);
});
```

**2. webrtc-answer** - Incoming SDP answer
```javascript
discussionSocket.on('webrtc-answer', (answerData) => {
  // { sessionId, from, to, sdp }
  webrtcManager.handleRemoteAnswer(answerData);
});
```

**3. webrtc-ice-candidate** - (Phase 2.2) ICE candidates
```javascript
discussionSocket.on('webrtc-ice-candidate', (candidateData) => {
  // Phase 2.2: Not implemented yet
});
```

---

## Server Routing

### How Offers/Answers Are Routed

```javascript
// Server receives webrtc-offer from sender
socket.on('webrtc-offer', (data) => {
  // 1. Validate: sessionId, from, to, sdp
  // 2. Find recipient socket in session room
  // 3. Send ONLY to recipient (not broadcast)
  // 4. Log success/failure
});
```

### Key: Peer-Specific Routing
```
NOT: io.to(sessionId).emit('webrtc-offer', ...)  ❌ Broadcast
YES: recipientSocket.emit('webrtc-offer', ...)   ✅ Specific
```

---

## Logging Patterns

### What You Should See

**First User Joins** (no logs - alone in room)
```
[No WebRTC activity]
```

**Second User Joins** (existing creates offer)
```
📤 [WebRTC] Creating offer for: newuser@example.com
📝 [WebRTC] Local description set for newuser@example.com
✅ [WebRTC] Offer sent to newuser@example.com

[On new user's side]
📥 [WebRTC] Received offer from: existinguser@example.com
📝 [WebRTC] Remote description (offer) set from existinguser@example.com
📝 [WebRTC] Local description (answer) set for existinguser@example.com
✅ [WebRTC] Answer sent to existinguser@example.com

[Back to existing user]
📥 [WebRTC] Received answer from: newuser@example.com
📝 [WebRTC] Remote description (answer) set from newuser@example.com
✅ [WebRTC] Signaling stable with newuser@example.com - state: stable
```

### Server Logs
```
📤 [webrtc-offer] Routing offer: sender@example.com -> recipient@example.com
✅ [webrtc-offer] Offer delivered to recipient@example.com

📤 [webrtc-answer] Routing answer: sender@example.com -> recipient@example.com
✅ [webrtc-answer] Answer delivered to sender@example.com
```

---

## What's NOT in Phase 2.1

```javascript
❌ Media Tracks        // Phase 2.3
❌ Remote Streams      // Phase 2.4
❌ ICE Candidates      // Phase 2.2
❌ Audio/Video         // Phase 2.3
❌ Camera/Mic Toggle   // Phase 2.4
❌ Screen Sharing      // Phase 3
❌ UI Changes          // N/A
❌ CSS Changes         // N/A
```

---

## Troubleshooting Quick Guide

| Symptom | Check | Solution |
|---------|-------|----------|
| No offer created | Is new participant joining? | Check participant-joined event fired |
| Offer not received | Is peer connected to Socket.IO? | Check Socket connection status |
| Answer never created | Was offer received? | Check browser console for errors |
| Signaling stuck in "have-remote-offer" | Did we send answer back? | Verify emitWebRTCAnswer was called |
| Multiple peer connections for same peer | Did peer join twice? | Clear browser cache/incognito |
| Memory growing | Are old connections cleaned up? | Check participant-left handler |
| Peer receives other's signals | Server broadcasting instead of routing? | Check server socket.emit target |

---

## Testing Checklist

### Two-Peer Test (Minimum)
- [ ] User A joins
- [ ] User B joins
- [ ] A creates offer (check console)
- [ ] B creates answer (check console)
- [ ] Both show "stable" state
- [ ] No JavaScript errors

### Three-Peer Test
- [ ] Three users join (A, B, C)
- [ ] All pairs show "stable"
- [ ] Each user has 2 peer connections
- [ ] No errors

### Cleanup Test
- [ ] User leaves
- [ ] Server shows participant-left
- [ ] Remaining users' peer connection to leaver closes
- [ ] No memory leaks

---

## API Reference

### WebRTCPhase1Manager Methods

#### `initialize(userId, sessionId, localVideoElement)`
Initialize manager with user/session info

#### `captureLocalMedia()`
Get local audio/video (Phase 2.3+)

#### `createPeerConnection(peerId)`
Create RTCPeerConnection for peer

#### `getPeerConnection(peerId)`
Get existing or create new peer connection

#### `handleNewParticipant(participantEmail)` [UPDATED]
Handles new participant - now creates & sends offer

#### `handleParticipantLeft(participantEmail)`
Clean up peer connection on leave

#### `createAndSendOffer(remotePeerEmail, emitFunction)` [NEW]
Create and send SDP offer to peer

#### `handleRemoteOffer(offerData, emitFunction)` [NEW]
Handle incoming offer - create & send answer

#### `handleRemoteAnswer(answerData)` [NEW]
Handle incoming answer - complete signaling

#### `getStats()`
Get current peer connection stats

#### `cleanup()`
Clean up all connections on disconnect

### DiscussionSocketService Methods

#### `emitWebRTCOffer(sessionIdOrData, ...)`
Send SDP offer via Socket.IO

#### `emitWebRTCAnswer(sessionIdOrData, ...)`
Send SDP answer via Socket.IO

#### `on(event, callback)`
Register event listener

#### `emit()`
Send custom Socket.IO event

---

## Performance Tips

### Monitor These Metrics
```javascript
// Offer creation time
const start = performance.now();
const offer = await pc.createOffer();
const time = performance.now() - start;
console.log(`Offer created in ${time}ms`);  // Should be < 50ms
```

### Check Memory Usage
```javascript
// In Chrome DevTools
webrtcManager.peerConnections.size  // Should match participant count
```

### Verify Signaling
```javascript
// Count how many are stable
let stableCount = 0;
for (const state of webrtcManager.signalingState.values()) {
  if (state.state === 'stable') stableCount++;
}
console.log(`${stableCount} peers stable`);  // Should be N-1
```

---

## Common Mistakes

```javascript
❌ Using socketId instead of email
✅ webrtcManager.peerConnections.get(user.email)

❌ Broadcast offer to entire room
✅ socket.to(recipientSocket).emit(...)

❌ Reusing same offer for multiple peers
✅ Create new offer for each peer

❌ Not cleaning up on participant leave
✅ Close peer connection in handleParticipantLeft()

❌ Checking signaling state before SDP set
✅ Wait for setLocalDescription/setRemoteDescription to complete

❌ Sending incomplete SDP
✅ Always send full SDP object with type and sdp fields
```

---

## Getting Help

1. **Check Logs** - Console and server logs show exact flow
2. **Review Test Guide** - WEBRTC_PHASE_2_1_TESTING_GUIDE.md
3. **Check Implementation** - WEBRTC_PHASE_2_1_IMPLEMENTATION.md
4. **Verify Validation** - WEBRTC_PHASE_2_1_VALIDATION.md
5. **Report Issue** - Include console logs and server logs

---

**Phase 2.1 Status**: ✅ Complete and Ready for Testing

