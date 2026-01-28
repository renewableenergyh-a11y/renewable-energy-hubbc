/**
 * Discussion Socket Service - Frontend real-time communication
 * Manages Socket.IO connection for discussion sessions
 */

export class DiscussionSocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.userId = null;
    this.sessionId = null;
    this.listeners = new Map(); // event -> Set of callbacks
    this.connectionPromise = null;
    this.connectionResolve = null;
  }

  /**
   * Initialize and connect to Socket.IO server
   * @param {String} token - JWT token for authentication
   * @returns {Promise} Resolves when connected
   */
  connect(token) {
    if (this.connected) {
      console.log('Socket.IO already connected');
      return Promise.resolve();
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      this.connectionResolve = resolve;

      try {
        // Import Socket.IO client dynamically
        const script = document.createElement('script');
        script.src = '/socket.io/socket.io.js';
        script.onload = () => {
          // Socket.IO is now loaded globally as window.io
          if (!window.io) {
            return reject(new Error('Socket.IO library not loaded'));
          }

          const io = window.io;
          
          this.socket = io({
            auth: { token },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            transports: ['websocket', 'polling']
          });

          // Socket connection events
          this.socket.on('connect', () => {
            this.connected = true;
            console.log('✅ Connected to Socket.IO server');
            this._emit('connected');
            resolve();
          });

          this.socket.on('disconnect', (reason) => {
            this.connected = false;
            console.log('❌ Disconnected from Socket.IO:', reason);
            this._emit('disconnected', { reason });
          });

          this.socket.on('connect_error', (error) => {
            console.error('Socket.IO connection error:', error);
            // Check if it's an authentication error
            if (error.message && error.message.includes('auth')) {
              console.error('🔐 Socket.IO authentication failed:', error.message);
              this._emit('auth-error', { error: error.message });
            }
            this._emit('connection-error', { error: error.message });
          });

          // Discussion-specific events
          this.socket.on('participant-list-updated', (data) => {
            this._emit('participant-list-updated', data);
          });

          this.socket.on('participant-joined', (data) => {
            this._emit('participant-joined', data);
          });

          this.socket.on('participant-left', (data) => {
            this._emit('participant-left', data);
          });

          this.socket.on('session-status-updated', (data) => {
            this._emit('session-status-updated', data);
          });

          this.socket.on('session-closed', (data) => {
            this._emit('session-closed', data);
            this.disconnect();
          });

          this.socket.on('force-disconnect', (data) => {
            console.warn('Force disconnect from server:', data.reason);
            this._emit('force-disconnect', data);
            this.disconnect();
          });

          this.socket.on('user-reaction', (data) => {
            console.log('📥 [socket.io] Received user-reaction event:', data);
            this._emit('user-reaction', data);
          });

          // WebRTC Phase 1 Signaling Events (Placeholder)
          // These events are structure placeholders - Phase 1 has no active signaling
          this.socket.on('webrtc-ready', (data) => {
            console.log('📥 [socket.io] WebRTC ready event:', data);
            this._emit('webrtc-ready', data);
          });

          this.socket.on('webrtc-offer', (data) => {
            console.log('📥 [socket.io] WebRTC offer (Phase 1 placeholder):', data);
            this._emit('webrtc-offer', data);
          });

          this.socket.on('webrtc-answer', (data) => {
            console.log('📥 [socket.io] WebRTC answer (Phase 1 placeholder):', data);
            this._emit('webrtc-answer', data);
          });

          this.socket.on('webrtc-ice-candidate', (data) => {
            console.log('📥 [socket.io] WebRTC ICE candidate (Phase 1 placeholder):', data);
            this._emit('webrtc-ice-candidate', data);
          });
        };

        script.onerror = () => {
          reject(new Error('Failed to load Socket.IO library'));
        };

        document.head.appendChild(script);
      } catch (error) {
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Join a discussion session
   * @param {String} sessionId - Session ID
   * @param {String} token - JWT token
   * @param {String} userId - User ID (from REST auth, can be used as fallback)
   * @param {String} userRole - User role (from REST auth, can be used as fallback)
   * @returns {Promise} Resolves with join result
   */
  async joinSession(sessionId, token, userId, userRole) {
    if (!this.socket || !this.connected) {
      throw new Error('Socket not connected. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Join session timeout'));
      }, 10000);

      this.socket.emit('join-session', { sessionId, token, userId, userRole }, (response) => {
        clearTimeout(timeout);

        if (response.success) {
          this.userId = response.userId;
          this.sessionId = response.sessionId;
          console.log(`✅ Joined session ${sessionId}`);
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to join session'));
        }
      });
    });
  }

  /**
   * Leave current session
   * @returns {Promise} Resolves when left
   */
  async leaveSession() {
    if (!this.socket || !this.sessionId) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Leave session timeout'));
      }, 5000);

      this.socket.emit('leave-session', { sessionId: this.sessionId }, (response) => {
        clearTimeout(timeout);

        if (response.success) {
          this.sessionId = null;
          console.log('✅ Left session');
          resolve();
        } else {
          reject(new Error(response.error || 'Failed to leave session'));
        }
      });
    });
  }

  /**
   * Close a session (admin/instructor only)
   * @param {String} sessionId - Session ID
   * @param {String} token - JWT token
   * @param {String} userId - Current user ID
   * @param {String} userRole - Current user role
   * @returns {Promise} Resolves when closed
   */
  async closeSession(sessionId, token, userId, userRole) {
    if (!this.socket || !this.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Close session timeout'));
      }, 5000);

      this.socket.emit('close-session', { sessionId, token, userId, userRole }, (response) => {
        clearTimeout(timeout);

        if (response.success) {
          console.log(`✅ Closed session ${sessionId}`);
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to close session'));
        }
      });
    });
  }

  /**
   * Admin removes a participant from a session
   * @param {String} sessionId
   * @param {String} targetUserId
   * @param {String} token
   * @param {String} userId - Current user ID
   * @param {String} userRole - Current user role
   */
  async removeParticipantByAdmin(sessionId, targetUserId, token, userId, userRole) {
    if (!this.socket || !this.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Remove participant timeout'));
      }, 5000);

      this.socket.emit('admin-remove-participant', { sessionId, targetUserId, token, userId, userRole }, (response) => {
        clearTimeout(timeout);
        if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response && response.error ? response.error : 'Failed to remove participant'));
        }
      });
    });
  }

  /**
   * Check and update session status
   * @param {String} sessionId - Session ID
   * @returns {Promise} Resolves with session status
   */
  async checkSessionStatus(sessionId) {
    if (!this.socket || !this.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Check status timeout'));
      }, 5000);

      this.socket.emit('check-session-status', { sessionId }, (response) => {
        clearTimeout(timeout);

        if (response.success) {
          resolve(response.session);
        } else {
          reject(new Error(response.error || 'Failed to check session status'));
        }
      });
    });
  }

  /**
   * Emit raise hand event
   * @param {String} sessionId - Session ID
   * @param {Boolean} isRaised - Whether hand is raised
   * @param {String} userId - Current user ID
   */
  emitRaiseHand(sessionId, isRaised, userId) {
    if (!this.socket || !this.socket.connected) {
      console.warn('Socket not connected');
      return;
    }

    this.socket.emit('raise-hand', {
      sessionId,
      isRaised,
      userId
    });
  }

  /**
   * Emit reaction event
   * @param {String} sessionId - Session ID
   * @param {String} reaction - Reaction emoji
   * @param {String} userId - Current user ID
   * @param {String} userName - Current user name
   * @param {String} userRole - Current user role
   */
  emitReaction(sessionId, reaction, userId, userName, userRole) {
    if (!this.socket || !this.socket.connected) {
      console.warn('⚠️ [emitReaction] Socket not connected - cannot send reaction');
      console.warn('   Socket state: connected=' + (this.socket?.connected || false) + ', exists=' + (!!this.socket));
      return false;
    }

    // CRITICAL: Validate userId exists - reactions require valid identity
    if (!userId) {
      console.error('❌ [emitReaction] BLOCKING: userId is undefined/null. Cannot emit reaction without valid user identity.');
      console.error('   userName:', userName, 'userRole:', userRole);
      return false;
    }

    try {
      console.log('🎉 [emitReaction] Sending reaction with valid userId:', { sessionId, reaction, userId, userName, userRole });
      this.socket.emit('reaction', {
        sessionId,
        reaction,
        userId,
        userName,
        userRole: userRole || 'student'
      });
      return true;
    } catch (error) {
      console.error('❌ [emitReaction] Error sending reaction:', error);
      return false;
    }
  }

  /**
   * WebRTC Phase 1 - Send webrtc-ready signal
   * @param {String} sessionId - Session ID
   * @param {String} fromUserId - Sender email
   */
  emitWebRTCReady(sessionId, fromUserId) {
    if (!this.socket || !this.socket.connected) {
      console.warn('⚠️ [emitWebRTCReady] Socket not connected');
      return false;
    }

    try {
      console.log('🎥 [WebRTC] Emitting webrtc-ready:', { sessionId, from: fromUserId });
      this.socket.emit('webrtc-ready', {
        sessionId,
        from: fromUserId
      });
      return true;
    } catch (error) {
      console.error('❌ [emitWebRTCReady] Error:', error);
      return false;
    }
  }

  /**
   * WebRTC Phase 1 - Send webrtc-offer (placeholder)
   * @param {String} sessionId - Session ID
   * @param {String} fromUserId - Sender email
   * @param {String} toUserId - Recipient email
   * @param {Object} offer - SDP offer (Phase 2)
   */
  emitWebRTCOffer(sessionId, fromUserId, toUserId, offer = null) {
    if (!this.socket || !this.socket.connected) {
      console.warn('⚠️ [emitWebRTCOffer] Socket not connected');
      return false;
    }

    try {
      console.log('🎥 [WebRTC] Emitting webrtc-offer (Phase 1 placeholder):', { sessionId, from: fromUserId, to: toUserId });
      this.socket.emit('webrtc-offer', {
        sessionId,
        from: fromUserId,
        to: toUserId,
        offer: offer
      });
      return true;
    } catch (error) {
      console.error('❌ [emitWebRTCOffer] Error:', error);
      return false;
    }
  }

  /**
   * WebRTC Phase 1 - Send webrtc-answer (placeholder)
   * @param {String} sessionId - Session ID
   * @param {String} fromUserId - Sender email
   * @param {String} toUserId - Recipient email
   * @param {Object} answer - SDP answer (Phase 2)
   */
  emitWebRTCAnswer(sessionId, fromUserId, toUserId, answer = null) {
    if (!this.socket || !this.socket.connected) {
      console.warn('⚠️ [emitWebRTCAnswer] Socket not connected');
      return false;
    }

    try {
      console.log('🎥 [WebRTC] Emitting webrtc-answer (Phase 1 placeholder):', { sessionId, from: fromUserId, to: toUserId });
      this.socket.emit('webrtc-answer', {
        sessionId,
        from: fromUserId,
        to: toUserId,
        answer: answer
      });
      return true;
    } catch (error) {
      console.error('❌ [emitWebRTCAnswer] Error:', error);
      return false;
    }
  }

  /**
   * WebRTC Phase 1 - Send ICE candidate (placeholder)
   * @param {String} sessionId - Session ID
   * @param {String} fromUserId - Sender email
   * @param {String} toUserId - Recipient email
   * @param {Object} candidate - ICE candidate (Phase 2)
   */
  emitWebRTCICECandidate(sessionId, fromUserId, toUserId, candidate = null) {
    if (!this.socket || !this.socket.connected) {
      console.warn('⚠️ [emitWebRTCICECandidate] Socket not connected');
      return false;
    }

    try {
      console.log('🎥 [WebRTC] Emitting webrtc-ice-candidate (Phase 1 placeholder):', { sessionId, from: fromUserId, to: toUserId });
      this.socket.emit('webrtc-ice-candidate', {
        sessionId,
        from: fromUserId,
        to: toUserId,
        candidate: candidate
      });
      return true;
    } catch (error) {
      console.error('❌ [emitWebRTCICECandidate] Error:', error);
      return false;
    }
  }

  /**
   * Register event listener
   * @param {String} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  /**
   * Unregister event listener
   * @param {String} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Internal method to emit events to listeners
   * @private
   */
  _emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in listener for ${event}:`, err);
        }
      });
    }
  }

  /**
   * Disconnect from Socket.IO server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.sessionId = null;
      this.connectionPromise = null;
      console.log('❌ Disconnected from Socket.IO');
    }
  }

  /**
   * Check if currently in a session
   * @returns {Boolean}
   */
  isInSession() {
    return !!this.sessionId;
  }

  /**
   * Get current session ID
   * @returns {String|null}
   */
  getCurrentSessionId() {
    return this.sessionId;
  }

  /**
   * Get current user ID
   * @returns {String|null}
   */
  getCurrentUserId() {
    return this.userId;
  }

  /**
   * Heartbeat - keep connection alive
   * Useful for detecting stale connections
   */
  ping() {
    if (!this.socket || !this.connected) {
      return Promise.reject(new Error('Socket not connected'));
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Ping timeout'));
      }, 5000);

      this.socket.emit('ping', (response) => {
        clearTimeout(timeout);
        if (response && response.pong) {
          resolve(true);
        } else {
          reject(new Error('Invalid ping response'));
        }
      });
    });
  }
}

// Export singleton instance
export const discussionSocket = new DiscussionSocketService();
