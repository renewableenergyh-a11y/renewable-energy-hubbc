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
   * @returns {Promise} Resolves with join result
   */
  async joinSession(sessionId, token) {
    if (!this.socket || !this.connected) {
      throw new Error('Socket not connected. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Join session timeout'));
      }, 10000);

      this.socket.emit('join-session', { sessionId, token }, (response) => {
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
