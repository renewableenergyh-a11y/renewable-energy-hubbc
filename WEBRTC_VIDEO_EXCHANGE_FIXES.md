# WebRTC Video Exchange Implementation - Code Fixes

This file contains all the code fixes needed to enable video/audio exchange in the discussion system.

---

## Fix 1: Replace Deprecated RTCSessionDescription

### Location 1: handleRemoteOffer() function
**File:** discussion-room.html, lines ~2232

### OLD CODE (BROKEN):
```javascript
async handleRemoteOffer(offerData, emitFunction) {
  try {
    const { from, sdp } = offerData;
    console.log(`📥 [WebRTC] Received offer from: ${from}`);

    const pc = this.getPeerConnection(from);
    if (!pc) {
      console.error(`❌ [WebRTC] No peer connection for ${from}`);
      return;
    }

    // ❌ DEPRECATED - RTCSessionDescription constructor
    const remoteOffer = new RTCSessionDescription(sdp);
    await pc.setRemoteDescription(remoteOffer);
```

### NEW CODE (FIXED):
```javascript
async handleRemoteOffer(offerData, emitFunction) {
  try {
    const { from, sdp } = offerData;
    console.log(`📥 [WebRTC] Received offer from: ${from}`);

    const pc = this.getPeerConnection(from);
    if (!pc) {
      console.error(`❌ [WebRTC] No peer connection for ${from}`);
      return;
    }

    // ✅ CORRECT - Use the SDP object directly (RTCSessionDescription is deprecated)
    // The sdp object should have type: 'offer' and sdp: '...' properties
    await pc.setRemoteDescription(sdp);
```

---

### Location 2: handleRemoteAnswer() function
**File:** discussion-room.html, lines ~2254

### OLD CODE (BROKEN):
```javascript
async handleRemoteAnswer(answerData) {
  try {
    const { from, sdp } = answerData;
    console.log(`📥 [WebRTC] Received answer from: ${from}`);

    const pc = this.getPeerConnection(from);
    if (!pc) {
      console.error(`❌ [WebRTC] No peer connection for ${from}`);
      return;
    }

    // ❌ DEPRECATED - RTCSessionDescription constructor
    const remoteAnswer = new RTCSessionDescription(sdp);
    await pc.setRemoteDescription(remoteAnswer);
```

### NEW CODE (FIXED):
```javascript
async handleRemoteAnswer(answerData) {
  try {
    const { from, sdp } = answerData;
    console.log(`📥 [WebRTC] Received answer from: ${from}`);

    const pc = this.getPeerConnection(from);
    if (!pc) {
      console.error(`❌ [WebRTC] No peer connection for ${from}`);
      return;
    }

    // ✅ CORRECT - Use the SDP object directly (RTCSessionDescription is deprecated)
    await pc.setRemoteDescription(sdp);
```

---

## Fix 2: Add Remote Video Grid Container

### Location: discussion-room.html, after the webrtc-preview-container
**Insert after line ~1410**

### NEW HTML TO ADD:
```html
<!-- Remote Participants Video Grid -->
<div class="remote-videos-container">
  <div class="remote-videos-label">
    <i class="fas fa-users"></i>
    Participants
  </div>
  <div class="video-grid" id="videoGrid">
    <!-- Remote video tiles will be dynamically added here -->
  </div>
</div>

<!-- Remote Audio Container (hidden) -->
<div id="remoteAudioContainer" style="display: none;">
  <!-- Remote audio elements will be created here -->
</div>
```

### NEW CSS TO ADD (in the <style> section):
```css
.remote-videos-container {
  margin: 20px 0;
  padding: 15px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
}

.remote-videos-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 15px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 12px;
  width: 100%;
}

@media (max-width: 768px) {
  .video-grid {
    grid-template-columns: 1fr;
  }
}

.video-tile {
  width: 100%;
  aspect-ratio: 16/9;
  background: #1a1a1a;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.video-tile video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #000;
}

.video-tile-name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  color: white;
  padding: 8px;
  font-size: 12px;
  font-weight: 600;
}

.video-tile-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  color: var(--text-muted);
  text-align: center;
  flex-direction: column;
  gap: 10px;
}

.video-tile-placeholder i {
  font-size: 32px;
  opacity: 0.5;
}
```

---

## Fix 3: Implement attachRemoteStream() Properly

### Location: discussion-room.html, lines ~1700-1750

### OLD CODE (INCOMPLETE):
```javascript
function attachRemoteStream(peerId, stream) {
  try {
    let videoEl = document.getElementById(`remote-video-${peerId}`);

    if (!videoEl) {
      videoEl = document.createElement('video');
      videoEl.id = `remote-video-${peerId}`;
      // ... setup code ...
      // ❌ MISSING: srcObject assignment
      // ❌ MISSING: DOM insertion
      // ❌ MISSING: play() call
    }
  } catch (error) {
    console.error('Error attaching remote stream:', error);
  }
}
```

### NEW CODE (COMPLETE):
```javascript
/**
 * Attach remote media stream to video element
 * Creates video tile dynamically and adds to grid
 * @param {String} peerId - Email of remote peer
 * @param {MediaStream} stream - Remote media stream
 */
function attachRemoteStream(peerId, stream) {
  try {
    console.log(`📺 [attachRemoteStream] Attaching stream for ${peerId}, tracks:`, stream.getTracks().map(t => t.kind));
    
    const videoGrid = document.getElementById('videoGrid');
    if (!videoGrid) {
      console.warn('❌ Video grid container not found');
      return;
    }

    // Check if video tile already exists
    let videoTile = document.getElementById(`video-tile-${peerId}`);
    if (videoTile) {
      console.log(`ℹ️ [attachRemoteStream] Video tile already exists for ${peerId}`);
      return;
    }

    // Create video tile wrapper
    videoTile = document.createElement('div');
    videoTile.className = 'video-tile';
    videoTile.id = `video-tile-${peerId}`;

    // Create video element
    const videoEl = document.createElement('video');
    videoEl.id = `remote-video-${peerId}`;
    videoEl.autoplay = true;
    videoEl.playsinline = true;
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    videoEl.style.objectFit = 'cover';
    videoEl.style.display = 'block';
    videoEl.style.background = '#000';

    // ✅ CRITICAL: Attach the stream to the video element
    videoEl.srcObject = stream;
    console.log(`📤 [attachRemoteStream] Stream attached to video element for ${peerId}`);

    // Create name label
    const nameLabel = document.createElement('div');
    nameLabel.className = 'video-tile-name';
    nameLabel.textContent = peerId.split('@')[0]; // Show email prefix as name
    nameLabel.style.fontSize = '12px';
    nameLabel.style.overflow = 'hidden';
    nameLabel.style.textOverflow = 'ellipsis';
    nameLabel.style.whiteSpace = 'nowrap';

    // Assemble tile
    videoTile.appendChild(videoEl);
    videoTile.appendChild(nameLabel);

    // Add to grid
    videoGrid.appendChild(videoTile);
    console.log(`✅ [attachRemoteStream] Video tile added to grid for ${peerId}`);

    // ✅ CRITICAL: Start playback with error handling
    videoEl.play()
      .then(() => {
        console.log(`▶️ [attachRemoteStream] Video playing for ${peerId}`);
      })
      .catch(err => {
        console.warn(`⚠️ [attachRemoteStream] Autoplay failed for ${peerId}:`, err.message);
        // Show play button or message
        const placeholder = document.createElement('div');
        placeholder.className = 'video-tile-placeholder';
        placeholder.innerHTML = `
          <i class="fas fa-play-circle"></i>
          <small>Click to play</small>
        `;
        videoEl.style.display = 'none';
        videoTile.appendChild(placeholder);
        
        // Allow user to click to play
        placeholder.addEventListener('click', () => {
          videoEl.style.display = 'block';
          placeholder.remove();
          videoEl.play().catch(e => console.warn('Play failed:', e));
        });
      });

    // Handle track end (participant left or camera turned off)
    stream.getTracks().forEach(track => {
      track.onended = () => {
        console.log(`🔴 [attachRemoteStream] Track ended for ${peerId}: ${track.kind}`);
        // If all tracks ended, show placeholder
        if (stream.getTracks().every(t => t.readyState === 'ended')) {
          const placeholder = document.createElement('div');
          placeholder.className = 'video-tile-placeholder';
          placeholder.innerHTML = `
            <i class="fas fa-video-slash"></i>
            <small>Stream ended</small>
          `;
          videoEl.style.display = 'none';
          videoTile.appendChild(placeholder);
        }
      };
    });

  } catch (error) {
    console.error(`❌ [attachRemoteStream] Error attaching remote stream for ${peerId}:`, error);
  }
}
```

---

## Fix 4: Implement detachRemoteStream() Function

### Location: Add before the attachRemoteStream() function

### NEW CODE:
```javascript
/**
 * Detach and cleanup remote media stream
 * Stops all tracks and removes video tile from DOM
 * @param {String} peerId - Email of remote peer
 */
function detachRemoteStream(peerId) {
  try {
    console.log(`🧹 [detachRemoteStream] Detaching stream for ${peerId}`);

    // Get video element
    const videoEl = document.getElementById(`remote-video-${peerId}`);
    if (videoEl) {
      // Stop all tracks in the stream
      if (videoEl.srcObject) {
        videoEl.srcObject.getTracks().forEach(track => {
          track.stop();
          console.log(`⏹️ [detachRemoteStream] Stopped track: ${track.kind}`);
        });
      }
      videoEl.srcObject = null;
    }

    // Remove video tile from DOM
    const videoTile = document.getElementById(`video-tile-${peerId}`);
    if (videoTile) {
      videoTile.remove();
      console.log(`🗑️ [detachRemoteStream] Video tile removed for ${peerId}`);
    }

    // Remove audio element if exists
    const audioEl = document.getElementById(`remote-audio-${peerId}`);
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
      console.log(`🔊 [detachRemoteStream] Audio element removed for ${peerId}`);
    }

    console.log(`✅ [detachRemoteStream] Cleanup complete for ${peerId}`);
  } catch (error) {
    console.error(`❌ [detachRemoteStream] Error detaching stream for ${peerId}:`, error);
  }
}
```

---

## Fix 5: Add Remote Audio Support

### Location: Modify attachRemoteStream() to add this after video setup:

```javascript
// ✅ Handle audio separately (video element may not include audio in some cases)
const audioTracks = stream.getAudioTracks();
if (audioTracks.length > 0) {
  console.log(`🔊 [attachRemoteStream] Audio track detected for ${peerId}`);
  
  // Audio plays through video element, but create explicit audio element as backup
  const audioContainer = document.getElementById('remoteAudioContainer');
  if (audioContainer) {
    let audioEl = document.getElementById(`remote-audio-${peerId}`);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.id = `remote-audio-${peerId}`;
      audioEl.autoplay = true;
      audioEl.srcObject = stream;
      audioContainer.appendChild(audioEl);
      console.log(`🎵 [attachRemoteStream] Audio element created for ${peerId}`);
    }
  }
}
```

---

## Implementation Order

1. **First:** Fix the RTCSessionDescription deprecation (Fix 1)
2. **Second:** Add HTML/CSS for video grid (Fix 2)
3. **Third:** Implement attachRemoteStream() properly (Fix 3)
4. **Fourth:** Implement detachRemoteStream() (Fix 4)
5. **Fifth:** Add audio support (Fix 5)

---

## Testing Checklist

After implementing all fixes:

- [ ] Open discussion room with 2 participants
- [ ] Verify local camera preview shows
- [ ] Join as 2nd participant
- [ ] Verify 1st participant's video appears in grid
- [ ] Verify 2nd participant's video appears in grid
- [ ] Verify audio flows bidirectionally
- [ ] Leave and rejoin - verify cleanup works
- [ ] Check console for no errors
- [ ] Test on mobile browser
- [ ] Test with different browsers (Chrome, Firefox, Safari)

---

## Known Issues After These Fixes

These will still need implementation:
- Media state controls (mute/camera toggle)
- Media state broadcasting to other participants
- Screen sharing support
- Video quality adaptation
- Connection quality indicators

