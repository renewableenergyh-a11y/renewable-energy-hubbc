# WebRTC Phase 2.1 Implementation - SDP Offer/Answer Signaling

## Status: COMPLETE ✅

Phase 2.1 implements **SDP (Session Description Protocol) negotiation** between peers using Socket.IO signaling. This establishes the fundamental WebRTC connection establishment flow without media tracks, remote rendering, or UI changes.

---

## Architecture Overview

### Peer Identity
- **Email-based only** (user.email)
- Stored in `peerConnections: Map<email, RTCPeerConnection>`
- No UUIDs, socketIds, or alternative identifiers

### Flow Diagram
```
[Existing Participants]              [New Participant Joins]
        |                                    |
        └─────────────────────┬─────────────┘
                              |
                    Trigger: participant-joined
                              |
                ┌─────────────┴─────────────┐
                |                           |
        [Create Offer]            [Receive Offer]
                |                           |
        [Send via Socket]          [Set Remote Desc]
                |                           |
                └──────→ [webrtc-offer]     |
                        (server routes)     |
                                |           |
                                ├──→[Receive Offer Handler]
                                        |
                                   [Create Answer]
                                        |
                                   [Send via Socket]
                                        |
                                   [webrtc-answer]
                                (server routes)
                                        |
                         [Existing Receives Answer]
                                        |
                                  [Set Remote Desc]
                                        |
                               [Signaling Stable]
```

---

## Implementation Details

### 1. Frontend - WebRTCPhase1Manager Methods

#### Method: `createAndSendOffer(remotePeerEmail, emitFunction)`
- **Trigger**: Called when new participant joins (existing → new)
- **Steps**:
  1. Get or create peer connection
  2. Create SDP offer via `pc.createOffer()`
  3. Set as local description via `pc.setLocalDescription(offer)`
  4. Emit via Socket.IO with format: `{ sessionId, from, to, sdp }`

#### Method: `handleRemoteOffer(offerData, emitFunction)`
- **Trigger**: Received 'webrtc-offer' event from Socket
- **Steps**:
  1. Extract offer from event data
  2. Get or create peer connection for sender
  3. Set remote description: `pc.setRemoteDescription(offer)`
  4. Create answer via `pc.createAnswer()`
  5. Set as local description: `pc.setLocalDescription(answer)`
  6. Emit answer back via Socket.IO: `{ sessionId, from, to, sdp }`

#### Method: `handleRemoteAnswer(answerData)`
- **Trigger**: Received 'webrtc-answer' event from Socket
- **Steps**:
  1. Extract answer from event data
  2. Get peer connection for sender
  3. Set remote description: `pc.setRemoteDescription(answer)`
  4. Verify signaling state becomes 'stable'

#### Updated Method: `handleNewParticipant(participantEmail)`
- **Change**: Now triggers offer creation
- **Logic**:
  1. Create peer connection (if not exists)
  2. Call `createAndSendOffer()` to initiate SDP negotiation

### 2. Frontend - Socket.IO Integration

**File**: `js/services/discussionSocket.js`

#### Method: `emitWebRTCOffer(sessionIdOrData, ...)`
- Accepts both old and new call signatures for backward compatibility
- **New format**: Single object parameter: `{ sessionId, from, to, sdp }`
- **Old format**: Four parameters: `(sessionId, from, to, offer)`
- Emits to server with `sdp` key (not `offer`)

#### Method: `emitWebRTCAnswer(sessionIdOrData, ...)`
- Accepts both old and new call signatures
- **New format**: Single object: `{ sessionId, from, to, sdp }`
- **Old format**: Four parameters: `(sessionId, from, to, answer)`
- Emits to server with `sdp` key (not `answer`)

### 3. Frontend - Event Listeners (in discussion-room.html)

```javascript
discussionSocket.on('webrtc-offer', (offerData) => {
  webrtcManager.handleRemoteOffer(
    offerData,
    (data) => discussionSocket.emitWebRTCAnswer(data)
  );
});

discussionSocket.on('webrtc-answer', (answerData) => {
  webrtcManager.handleRemoteAnswer(answerData);
});

discussionSocket.on('webrtc-ice-candidate', (candidateData) => {
  // Phase 2.2: ICE candidate handling (placeholder)
});
```

### 4. Backend - Socket.IO Routing

**File**: `server/sockets/discussionSocket.js`

#### Handler: `socket.on('webrtc-offer')`
- **Input**: `{ sessionId, from, to, sdp }`
- **Logic**:
  1. Verify required fields
  2. Find recipient socket in session room
  3. Emit ONLY to recipient's socket (not broadcast)
  4. Log recipient found/not found status

#### Handler: `socket.on('webrtc-answer')`
- **Input**: `{ sessionId, from, to, sdp }`
- **Logic**:
  1. Verify required fields
  2. Find recipient socket in session room
  3. Emit ONLY to recipient's socket (not broadcast)
  4. Log recipient found/not found status

**Critical**: Messages are routed to specific socket in room, NOT broadcast to all participants. This ensures:
- Only the intended recipient receives the message
- No information leakage to third parties
- Correct peer-to-peer signaling flow

---

## Data Flow Example

### Scenario: 3 Participants (A joins, then B joins, then C joins)

**Timeline**:
1. A joins session (no one else → no offers sent)
2. B joins session
   - A creates offer → sends via `webrtc-offer` → B receives
   - B creates answer → sends via `webrtc-answer` → A receives
   - A-B signaling: STABLE ✓
3. C joins session
   - A creates offer → sends via `webrtc-offer` → C receives
   - C creates answer → sends via `webrtc-answer` → A receives
   - A-C signaling: STABLE ✓
   - B creates offer → sends via `webrtc-offer` → C receives
   - C creates answer → sends via `webrtc-answer` → B receives
   - B-C signaling: STABLE ✓

**Result**: Each pair has a separate RTCPeerConnection with stable signaling state

---

## Logs and Debugging

### Frontend Logs (WebRTCPhase1Manager)
```
📤 [WebRTC] Creating offer for: peer@example.com
📝 [WebRTC] Local description set for peer@example.com
✅ [WebRTC] Offer sent to peer@example.com

📥 [WebRTC] Received offer from: existing@example.com
📝 [WebRTC] Remote description (offer) set from existing@example.com
📝 [WebRTC] Local description (answer) set from existing@example.com
✅ [WebRTC] Answer sent to existing@example.com

📥 [WebRTC] Received answer from: peer@example.com
📝 [WebRTC] Remote description (answer) set from peer@example.com
✅ [WebRTC] Signaling stable with peer@example.com - state: stable
```

### Socket.IO Logs (Server)
```
📤 [webrtc-offer] Routing offer: sender@example.com -> recipient@example.com in session xyz
✅ [webrtc-offer] Offer delivered to recipient@example.com

📤 [webrtc-answer] Routing answer: sender@example.com -> recipient@example.com in session xyz
✅ [webrtc-answer] Answer delivered to recipient@example.com
```

### Frontend Socket Logs
```
🎥 [WebRTC] Emitting webrtc-offer: { from: sender, to: recipient }
🎥 [WebRTC] Emitting webrtc-answer: { from: sender, to: recipient }
```

---

## State Management

### WebRTCPhase1Manager State
- **peerConnections**: `Map<email, RTCPeerConnection>`
- **signalingState**: `Map<email, { state }>`
- **iceServers**: STUN servers array
- **localUserId**: Current user's email
- **sessionId**: Current session ID

### Signaling States
- `new` - After peer connection creation
- `have-local-offer` - After creating/setting offer
- `have-remote-offer` - After receiving/setting offer
- `have-local-pranswer` - (not used in Phase 2.1)
- `have-remote-pranswer` - (not used in Phase 2.1)
- `stable` - Offer/answer complete, ready for media/ICE

---

## Constraints (ENFORCED)

### Phase 2.1 Scope
✅ SDP offer/answer negotiation only
❌ NO media tracks (audio/video)
❌ NO remote stream rendering
❌ NO UI changes
❌ NO CSS modifications
❌ NO auth/role changes
❌ NO participant list changes
❌ NO dark mode changes
❌ NO ICE candidate exchange (Phase 2.2)

### Code Safety
✅ Email-based peer identity preserved
✅ Backward compatibility with Phase 1
✅ Socket.IO event structure unchanged
✅ All Phase 1 features remain intact
✅ Session lifecycle unchanged
✅ Participant join/leave logic preserved

---

## Testing Checklist

- [ ] Create discussion session with 2 participants
  - [ ] Check A creates offer when B joins
  - [ ] Check B receives offer and creates answer
  - [ ] Check A receives answer
  - [ ] Check signaling state is 'stable' for both
  
- [ ] Create discussion with 3+ participants
  - [ ] Check all pairs negotiate independently
  - [ ] Check each pair has separate RTCPeerConnection
  - [ ] Check no cross-talk (A-B signals separate from B-C)

- [ ] Verify Socket.IO routing
  - [ ] Only recipient receives offer (not broadcast)
  - [ ] Only recipient receives answer (not broadcast)
  - [ ] Server logs show correct routing
  - [ ] No participants receive other's signals

- [ ] Verify cleanup
  - [ ] When participant leaves, their peer connection is closed
  - [ ] When participant leaves, their signaling state is deleted
  - [ ] No memory leaks from orphaned connections

- [ ] Verify logging
  - [ ] Console shows all signaling steps
  - [ ] Server logs show routing attempts
  - [ ] Logs identify sender, recipient, session ID
  - [ ] Error logs appear when recipient not found

---

## Future Phases

### Phase 2.2: ICE Candidate Exchange
- Implement ICE candidate forwarding via `webrtc-ice-candidate`
- Add candidate buffering before signaling is stable
- Test with symmetric NAT scenarios

### Phase 2.3: Media Track Addition
- Add `pc.addTrack()` for audio/video
- Create `RTCRtpSender` and `RTCRtpReceiver`
- Add `ontrack` handler for remote streams

### Phase 2.4: Remote Rendering
- Attach remote streams to video elements
- Create participant video grid layout
- Handle stream muting/camera toggle

### Phase 3: Production Hardening
- Add TURN server fallback
- Implement connection timeout recovery
- Add quality metrics and diagnostics
- Implement stats reporting

---

## Files Modified

1. **discussion-room.html**
   - Added `createAndSendOffer()` method
   - Added `handleRemoteOffer()` method
   - Added `handleRemoteAnswer()` method
   - Updated `handleNewParticipant()` to trigger offers
   - Added Socket event listeners for offer/answer/ice
   - Added `webrtcManager.socketService = discussionSocket`

2. **js/services/discussionSocket.js**
   - Updated `emitWebRTCOffer()` to support new format
   - Updated `emitWebRTCAnswer()` to support new format

3. **server/sockets/discussionSocket.js**
   - Implemented `socket.on('webrtc-offer')` routing
   - Implemented `socket.on('webrtc-answer')` routing
   - Added socket finding logic in session rooms
   - Added recipient validation and logging

---

## Implementation Complete ✅

All Phase 2.1 features are now implemented and ready for testing. The system can now establish stable SDP negotiations between peers via email-based identity and Socket.IO signaling.

