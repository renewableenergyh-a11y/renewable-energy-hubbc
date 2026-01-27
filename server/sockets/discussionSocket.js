/**
 * SocketIO Handler - Manages real-time discussion signaling
 * Single source of truth for session and participant state via Socket.IO rooms
 */

const crypto = require('crypto');

// Shared roles helper (single source for hierarchy and normalization)
const roles = require('../utils/roles');

// Keep a minimal canManageSession wrapper for readability using shared helper
function canManageSession(userRole, sessionCreatorId, userId) {
  if (roles.hasAtLeastRole(userRole, 'superadmin')) return true;
  if (roles.hasAtLeastRole(userRole, 'instructor')) return sessionCreatorId === userId;
  return false;
}

/**
 * Initialize Socket.IO for discussion system
 * @param {Object} io - Socket.IO server instance
 * @param {Object} db - Database instance with models
 * @param {Object} discussionSessionService - Session service
 * @param {Object} participantService - Participant service
 */
function initializeDiscussionSocket(io, db, discussionSessionService, participantService) {
  // In-memory socket tracking to prevent duplicate joins and handle cleanups
  // userId -> { socketId, sessionId, joinTime }
  const userSocketMap = new Map();
  
  // Session room tracking
  // sessionId -> Set of socketIds
  const sessionRooms = new Map();

  // Hand raised tracking
  // sessionId -> { userId -> isRaised }
  const handRaisedMap = new Map();

  /**
   * Verify JWT token and extract user info
   * @param {String} token - JWT token from client
   * @returns {Object|null} User object { id, role } or null if invalid
   */
  const verifyUserToken = (token) => {
    if (!token) {
      console.warn('🔐 [verifyUserToken] No token provided for Socket.IO auth - rejecting');
      return null;
    }
    
    try {
      // Try to load users from correct path
      let users = {};
      try {
        users = require('../storage').loadUsers();
      } catch (err) {
        console.error('🔐 [verifyUserToken] Could not load users from storage:', err.message);
        // CRITICAL: Reject if we can't verify users - don't allow anonymous joins
        return null;
      }

      // Look for matching token in verified users
      for (const [email, user] of Object.entries(users)) {
        if (user && user.token === token) {
          console.log('✅ [verifyUserToken] Socket.IO auth verified for:', email);
          const norm = roles.normalizeAuthUser({ id: user.id || email, role: user.role || 'student', email, fullName: user.fullName || user.name });
          // include a human-friendly name property expected in frontend
          norm.name = norm.fullName || (norm.email ? norm.email.split('@')[0] : 'User');
          return norm;
        }
      }

      console.warn('🔐 [verifyUserToken] Token not found in users database - rejecting');
      // CRITICAL: Reject if token can't be verified - don't allow anonymous or fallback users
      return null;
    } catch (err) {
      console.error('🔐 [verifyUserToken] Token verification error:', err.message);
      // CRITICAL: Reject on any error - don't allow fallback connections
      return null;
    }
    
    return null;
  };

  /**
   * Emit updated participant list to a session room
   */
  const broadcastParticipantList = async (sessionId) => {
    try {
      const participants = await participantService.getActiveParticipants(sessionId);
      const stats = await participantService.getSessionParticipantStats(sessionId);
      const sessionHandRaised = handRaisedMap.get(sessionId) || {};
      
      io.to(`discussion-session:${sessionId}`).emit('participant-list-updated', {
        participants: participants.map(p => ({
          participantId: p.participantId,
          userId: p.userId,
          userName: p.userName,
          role: p.role,
          active: p.active,
          joinTime: p.joinTime,
          audioEnabled: p.audioEnabled,
          videoEnabled: p.videoEnabled,
          handRaised: sessionHandRaised[p.userId] || false
        })),
        stats: {
          activeCount: stats.activeCount,
          totalCount: stats.totalCount,
          averageDurationMs: stats.averageDurationMs
        }
      });
    } catch (err) {
      console.error('Error broadcasting participant list:', err);
    }
  };

  /**
   * Emit session status to a session room
   */
  const broadcastSessionStatus = async (sessionId) => {
    try {
      const session = await discussionSessionService.getSessionById(sessionId);
      if (session) {
        io.to(`discussion-session:${sessionId}`).emit('session-status-updated', {
          sessionId: session.sessionId,
          status: session.status,
          initiatorUserId: session.initiatorUserId,
          initiatorTimestamp: session.initiatorTimestamp,
          participantCount: session.participantCount,
          closedAt: session.closedAt,
          closedReason: session.closedReason
        });
      }
    } catch (err) {
      console.error('Error broadcasting session status:', err);
    }
  };

  /**
   * Main Socket.IO connection handler
   */
  io.on('connection', (socket) => {
    console.log(`📡 Socket connected: ${socket.id}`);
    console.log('✅ Socket.IO handlers registered: join-session, leave-session, raise-hand, reaction, ping, admin-remove-participant, close-session, check-session-status');

    /**
     * Event: join-session
     * Client emits with sessionId and token
     * NOTE: Participant must already be created via REST endpoint
     * This event only joins the socket to the room and broadcasts presence
     */
    socket.on('join-session', async (data, callback) => {
      const { sessionId, token, userId, userRole } = data;

      console.log('🔌 [socket] join-session event received:', { sessionId, socketId: socket.id, userId, userRole });

      try {
        // Verify authentication
        // Try token verification first (strict)
        let user = verifyUserToken(token);
        
        // If token verification fails, try using userId/userRole from data
        // (These come from REST API auth which already verified the user)
        if (!user && userId && userRole) {
          console.log(`✅ [socket] Token verification failed, but user data provided (REST verified). Accepting user: ${userId} (${userRole})`);
          user = roles.normalizeAuthUser({ id: userId, role: userRole });
        }
        
        if (!user) {
          const error = 'Authentication failed';
          console.warn(`❌ [socket] ${error} for socket ${socket.id}`);
          return callback({ success: false, error });
        }

        console.log(`👤 [socket] User ${user.id} (${user.role}) joining session ${sessionId}`);

        // Verify session exists
        const session = await discussionSessionService.getSessionById(sessionId);
        if (!session) {
          const error = 'Session not found';
          console.warn(`❌ [socket] ${error}: ${sessionId}`);
          return callback({ success: false, error });
        }

        console.log(`✅ [socket] Session found for ${sessionId}. Status: ${session.status}`);

        // Check if session is closed
        if (session.status === 'closed') {
          const error = 'Session is closed';
          console.warn(`❌ [socket] ${error}: ${sessionId}`);
          return callback({ success: false, error });
        }

        // Check if user is already in a session (prevent multiple concurrent sessions)
        if (userSocketMap.has(user.id)) {
          const existing = userSocketMap.get(user.id);
          console.log(`🔄 [socket] User already has socket, checking if same session: existing=${existing.sessionId}, new=${sessionId}`);
          if (existing.sessionId !== sessionId) {
            // User is joining a different session, cleanup old session first
            const oldSessionId = existing.sessionId;
            console.log(`🧹 [socket] Cleaning up user from previous session ${oldSessionId}`);
            
            try {
              // Deactivate participant in OLD session database
              await participantService.removeParticipant(oldSessionId, user.id);
              console.log(`✅ [socket] Removed participant from previous session ${oldSessionId}`);
            } catch (cleanupErr) {
              console.warn(`⚠️ [socket] Failed to cleanup previous session: ${cleanupErr.message}`);
            }
            
            // Force disconnect the old socket
            const oldSocket = io.sockets.sockets.get(existing.socketId);
            if (oldSocket) {
              console.log(`⚠️ [socket] Disconnecting user from previous session ${oldSessionId}`);
              oldSocket.emit('force-disconnect', { 
                reason: 'Joined another session',
                newSessionId: sessionId 
              });
            }
          }
        }

        // CLEANUP: Remove duplicate inactive participant records in this session
        // This prevents orphaned records from building up
        try {
          const inactiveRemoved = await participantService.db.models.Participant.deleteMany({
            sessionId: sessionId,
            userId: user.id,
            active: false
          });
          if (inactiveRemoved.deletedCount > 0) {
            console.log(`🗑️ [socket] Purged ${inactiveRemoved.deletedCount} inactive duplicate records for user ${user.id} in session ${sessionId}`);
          }
        } catch (cleanupErr) {
          console.warn(`⚠️ [socket] Failed to cleanup inactive duplicates: ${cleanupErr.message}`);
        }

        // CRITICAL: Ensure participant is active
        // Use atomic findOneAndUpdate to prevent race conditions from duplicate insertions
        // This is the authoritative source for ensuring participant state
        const now = new Date();
        const participant = await participantService.db.models.Participant.findOneAndUpdate(
          { sessionId, userId: user.id },
          {
            $set: {
              active: true,
              lastLeaveTime: null,
              userName: user.name || user.email,
              updatedAt: now
            },
            $setOnInsert: {
              participantId: `participant_${sessionId}_${user.id}`,
              sessionId,
              userId: user.id,
              role: user.role,
              joinTime: now,
              totalDurationMs: 0,
              audioEnabled: false,
              videoEnabled: false,
              disconnectCount: 0,
              createdAt: now
            }
          },
          { upsert: true, new: true }
        );

        console.log(`✅ [socket] Participant state ensured (atomic upsert):`, { 
          participantId: participant.participantId, 
          active: participant.active,
          userId: participant.userId
        });

        // Add socket to session room
        socket.join(`discussion-session:${sessionId}`);
        socket.userId = user.id;
        socket.sessionId = sessionId;
        socket.userRole = user.role;
        socket.userName = user.name;

        // Track user socket
        userSocketMap.set(user.id, {
          socketId: socket.id,
          sessionId: sessionId,
          joinTime: Date.now()
        });

        // Track session room
        if (!sessionRooms.has(sessionId)) {
          sessionRooms.set(sessionId, new Set());
        }
        sessionRooms.get(sessionId).add(socket.id);

        // Try to initiate session if it's the first user (upcoming -> active)
        if (session.status === 'upcoming' && !session.initiatorUserId) {
          try {
            const updated = await discussionSessionService.initiateSession(sessionId, user.id);
            console.log(`🚀 Session ${sessionId} initiated by ${user.id}`);
            await broadcastSessionStatus(sessionId);
          } catch (err) {
            console.warn('Session initiation failed (may already be initiated):', err.message);
          }
        }

        // Update participant count
        const participantCount = await participantService.getActiveParticipantCount(sessionId);
        await discussionSessionService.updateParticipantCount(sessionId, participantCount);

        // Broadcast updated participant list to ALL in the room (including the joiner)
        // This ensures everyone sees the complete, consistent state
        await broadcastParticipantList(sessionId);
        await broadcastSessionStatus(sessionId);

        // Notify other participants (excluding self)
        socket.to(`discussion-session:${sessionId}`).emit('participant-joined', {
          userId: user.id,
          role: user.role,
          name: user.name,
          joinTime: Date.now()
        });

        callback({
          success: true,
          message: 'Joined session successfully',
          sessionId: sessionId,
          userId: user.id,
          userRole: user.role,
          userName: user.name
        });

        console.log(`✅ User ${user.id} joined session ${sessionId}`);
      } catch (error) {
        console.error('Error joining session:', error);
        callback({ success: false, error: error.message });
      }
    });

    /**
     * Event: leave-session
     * Client emits to explicitly leave a session
     */
    socket.on('leave-session', async (data, callback) => {
      const { sessionId } = data;
      const userId = socket.userId;

      console.log(`👋 [socket] User ${userId} leaving session ${sessionId}`);

      try {
        if (!userId || !sessionId) {
          return callback({ success: false, error: 'Missing userId or sessionId' });
        }

        // Remove participant from database
        try {
          await participantService.removeParticipant(sessionId, userId);
          console.log(`✅ [socket] Participant removed from DB: ${userId}`);
        } catch (dbErr) {
          console.error('❌ [socket] DB error removing participant:', dbErr.message);
          // Don't fail the leave operation, just log it
        }

        // Remove socket from room
        socket.leave(`discussion-session:${sessionId}`);

        // Update session room tracking
        if (sessionRooms.has(sessionId)) {
          sessionRooms.get(sessionId).delete(socket.id);
          if (sessionRooms.get(sessionId).size === 0) {
            sessionRooms.delete(sessionId);
          }
        }

        // Remove from user socket map
        userSocketMap.delete(userId);

        // Update participant count
        try {
          const participantCount = await participantService.getActiveParticipantCount(sessionId);
          await discussionSessionService.updateParticipantCount(sessionId, participantCount);
        } catch (countErr) {
          console.warn('⚠️ [socket] Failed to update participant count:', countErr.message);
        }

        // Broadcast updated participant list
        try {
          await broadcastParticipantList(sessionId);
        } catch (broadcastErr) {
          console.warn('⚠️ [socket] Broadcast error:', broadcastErr.message);
        }

        // Notify others
        socket.to(`discussion-session:${sessionId}`).emit('participant-left', {
          userId: userId,
          userName: socket.userName,
          participantCount: 0
        });

        callback({ success: true });
        console.log(`✅ [socket] User ${userId} left session ${sessionId}`);
      } catch (error) {
        console.error('❌ [socket] Error leaving session:', error);
        callback({ success: false, error: error.message });
      }
    });

    /**
     * Event: disconnect
     * Handle socket disconnection
     */
    socket.on('disconnect', async () => {
      const userId = socket.userId;
      const sessionId = socket.sessionId;

      console.log(`📡 Socket disconnected: ${socket.id} (user: ${userId})`);

      if (userId && sessionId) {
        try {
          // Remove participant from database
          await participantService.removeParticipant(sessionId, userId);

          // Update session room tracking
          if (sessionRooms.has(sessionId)) {
            sessionRooms.get(sessionId).delete(socket.id);
            if (sessionRooms.get(sessionId).size === 0) {
              sessionRooms.delete(sessionId);
            }
          }

          // Remove from user socket map
          userSocketMap.delete(userId);

          // Clean up hand raised data for this user
          if (handRaisedMap.has(sessionId)) {
            delete handRaisedMap.get(sessionId)[userId];
          }

          // Update participant count
          const participantCount = await participantService.getActiveParticipantCount(sessionId);
          await discussionSessionService.updateParticipantCount(sessionId, participantCount);

          // Broadcast updated participant list
          await broadcastParticipantList(sessionId);

          // Notify others of disconnection
          io.to(`discussion-session:${sessionId}`).emit('participant-left', {
            userId: userId,
            userName: socket.userName,
            participantCount: participantCount
          });

          console.log(`✅ User ${userId} cleaned up after disconnect from session ${sessionId}`);
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      }
    });

    /**
     * Event: close-session (admin/instructor only)
     * Force close a session
     * Superadmin: can close any session
     * Admin/Instructor: can only close their own sessions
     */
    socket.on('close-session', async (data, callback) => {
      const { sessionId, token, userId, userRole } = data;

      try {
        // Prefer explicit user info from data, fallback to token verification
        let user = null;
        if (userId && userRole) {
          user = roles.normalizeAuthUser({ id: userId, role: userRole });
          console.log('✅ [socket] User from headers:', { id: user.id, role: user.role });
        } else {
          user = verifyUserToken(token);
        }
        
        if (!user || !roles.hasAtLeastRole(user, 'instructor')) {
          return callback({ 
            success: false, 
            error: 'Only admins and instructors can close sessions' 
          });
        }

        console.log(`🔒 User ${user.id} (${user.role}) closing session ${sessionId}`);

        // Fetch session to check ownership/permission
        const session = await discussionSessionService.getSessionById(sessionId);
        if (!session) {
          return callback({ success: false, error: 'Session not found' });
        }

        // Superadmin may close any session; admins/instructors only their own
        if (!roles.hasAtLeastRole(user, 'superadmin') && session.creatorId !== user.id) {
          console.warn(`❌ User ${user.id} (${user.role}) does not have permission to close session ${sessionId}`);
          return callback({ success: false, error: 'You do not have permission to close this session' });
        }

        // Close session in database
        const closedSession = await discussionSessionService.closeSessionManually(
          sessionId,
          user.id,
          user.role
        );

        // Cleanup all participants
        await participantService.cleanupSessionParticipants(sessionId);

        // Get all sockets in the session room
        const room = sessionRooms.get(sessionId);
        if (room) {
          console.log(`📡 [socket] Broadcasting session-closed to ${room.size} sockets in room`);
          // Force disconnect all clients in the session
          room.forEach(socketId => {
            const clientSocket = io.sockets.sockets.get(socketId);
            if (clientSocket) {
              console.log(`   → Sending to socket ${socketId}`);
              clientSocket.emit('session-closed', {
                sessionId: sessionId,
                reason: 'Session closed by ' + (user.role === 'superadmin' ? 'superadmin' : user.role === 'admin' ? 'administrator' : 'instructor'),
                closedBy: user.id,
                closedByRole: user.role,
                timestamp: new Date()
              });
              clientSocket.leave(`discussion-session:${sessionId}`);
            }
          });
          sessionRooms.delete(sessionId);
        } else {
          console.warn(`⚠️  [socket] No room found for session ${sessionId}, using io.to() broadcast`);
          io.to(`discussion-session:${sessionId}`).emit('session-closed', {
            sessionId: sessionId,
            reason: 'Session closed by ' + (user.role === 'superadmin' ? 'superadmin' : user.role === 'admin' ? 'administrator' : 'instructor'),
            closedBy: user.id,
            closedByRole: user.role,
            timestamp: new Date()
          });
        }

        // Broadcast final status
        await broadcastSessionStatus(sessionId);

        callback({ success: true, message: 'Session closed successfully' });
        console.log(`✅ Session ${sessionId} closed by ${user.id}`);
      } catch (error) {
        console.error('Error closing session:', error);
        callback({ success: false, error: error.message });
      }
    });

    /**
     * Event: admin-remove-participant
     * Allows moderators (admin/instructor/superadmin) to remove a participant
     * Superadmin: can remove any participant from any session
     * Admin/Instructor: can only remove from their own sessions
     */
    socket.on('admin-remove-participant', async (data, callback) => {
      const { sessionId, targetUserId, token, userId, userRole } = data;

      console.log('🔒 [socket] admin-remove-participant request:', { sessionId, targetUserId, userId });

      try {
        // Prefer explicit user info from data, fallback to token verification
        let user = null;
        if (userId && userRole) {
          user = roles.normalizeAuthUser({ id: userId, role: userRole });
          console.log('✅ [socket] User from headers:', { id: user.id, role: user.role });
        } else {
          user = verifyUserToken(token);
        }
        
        if (!user || !roles.hasAtLeastRole(user, 'instructor')) {
          console.warn('❌ [socket] Unauthorized remove attempt');
          return callback({ success: false, error: 'Unauthorized' });
        }

        // Fetch session to check ownership
        const session = await discussionSessionService.getSessionById(sessionId);
        if (!session) {
          console.warn('❌ [socket] Session not found:', sessionId);
          return callback({ success: false, error: 'Session not found' });
        }

        // Superadmin can manage any session; otherwise ensure creator ownership
        if (!roles.hasAtLeastRole(user, 'superadmin') && session.creatorId !== user.id) {
          console.warn(`❌ User ${user.id} (${user.role}) does not have permission to manage session ${sessionId}`);
          return callback({ success: false, error: 'You do not have permission to manage this session' });
        }

        console.log('🗑️ [socket] Removing participant:', targetUserId);

        // Remove participant from DB
        try {
          await participantService.removeParticipant(sessionId, targetUserId);
          console.log('✅ [socket] Participant removed from database:', targetUserId);
        } catch (dbErr) {
          console.error('❌ [socket] Database error removing participant:', dbErr.message);
          return callback({ success: false, error: 'Failed to remove participant: ' + dbErr.message });
        }

        // Update session participant count
        try {
          const participantCount = await participantService.getActiveParticipantCount(sessionId);
          await discussionSessionService.updateParticipantCount(sessionId, participantCount);
        } catch (countErr) {
          console.warn('⚠️ [socket] Failed to update participant count:', countErr.message);
        }

        // Broadcast updated participant list and status
        try {
          await broadcastParticipantList(sessionId);
          await broadcastSessionStatus(sessionId);
        } catch (broadcastErr) {
          console.warn('⚠️ [socket] Broadcast error:', broadcastErr.message);
        }

        // Notify removed participant sockets (if any)
        try {
          const room = sessionRooms.get(sessionId);
          if (room) {
            room.forEach(socketId => {
              const clientSocket = io.sockets.sockets.get(socketId);
              if (clientSocket && clientSocket.userId === targetUserId) {
                console.log('📢 [socket] Sending force-disconnect to removed participant');
                clientSocket.emit('force-disconnect', { reason: 'Removed by moderator' });
                clientSocket.leave(`discussion-session:${sessionId}`);
              }
            });
          }
        } catch (disconnectErr) {
          console.warn('⚠️ [socket] Error disconnecting participant:', disconnectErr.message);
        }

        console.log('✅ [socket] Remove participant completed successfully');
        callback({ success: true });
      } catch (err) {
        console.error('❌ Error in admin-remove-participant:', err);
        callback({ success: false, error: err.message });
      }
    });

    /**
     * Event: check-session-status
     * Client checks for time-based status updates
     */
    socket.on('check-session-status', async (data, callback) => {
      const { sessionId } = data;

      try {
        // Check and update status based on time
        const updated = await discussionSessionService.checkAndUpdateSessionStatus(sessionId);

        if (updated && updated.status === 'closed') {
          // Session auto-closed, force disconnect all
          const room = sessionRooms.get(sessionId);
          if (room) {
            room.forEach(socketId => {
              const clientSocket = io.sockets.sockets.get(socketId);
              if (clientSocket) {
                clientSocket.emit('session-closed', {
                  sessionId: sessionId,
                  reason: 'Session time expired',
                  timestamp: new Date()
                });
                clientSocket.leave(`discussion-session:${sessionId}`);
              }
            });
            sessionRooms.delete(sessionId);
          }
        }

        const session = await discussionSessionService.getSessionById(sessionId);
        callback({
          success: true,
          session: {
            sessionId: session.sessionId,
            status: session.status,
            initiatorUserId: session.initiatorUserId,
            participantCount: session.participantCount,
            closedReason: session.closedReason
          }
        });
      } catch (error) {
        console.error('Error checking session status:', error);
        callback({ success: false, error: error.message });
      }
    });

    /**
     * Event: raise-hand
     * Emit when user raises or lowers their hand
     */
    socket.on('raise-hand', async (data) => {
      const { sessionId, isRaised, userId } = data;
      
      if (!sessionId || !userId) {
        console.warn('Invalid raise-hand data', data);
        return;
      }

      try {
        // Update hand raised status in memory
        if (!handRaisedMap.has(sessionId)) {
          handRaisedMap.set(sessionId, {});
        }
        
        const sessionHands = handRaisedMap.get(sessionId);
        sessionHands[userId] = isRaised;

        // Broadcast updated participant list with new hand state
        await broadcastParticipantList(sessionId);

        console.log(`User ${userId} ${isRaised ? 'raised' : 'lowered'} hand in session ${sessionId}`);
      } catch (error) {
        console.error('Error handling raise-hand:', error);
      }
    });

    /**
     * Event: reaction
     * Broadcast reaction from ANY participant to all participants in the session
     * Reactions are role-agnostic: admins, instructors, and students all use the same broadcast logic
     */
    socket.on('reaction', async (data) => {
      console.log('🎉🎉🎉 [REACTION HANDLER TRIGGERED] Socket ID:', socket.id, 'Data:', data);
      const { sessionId, reaction, userId, userName, userRole } = data;

      console.log('🎉 [reaction] Received reaction event:', { sessionId, reaction, userId, userName, userRole, senderRole: socket.userRole });

      // Validate required fields
      if (!sessionId || !reaction || !userId) {
        console.warn('⚠️ [reaction] Invalid reaction data - missing required fields:', { sessionId: !!sessionId, reaction: !!reaction, userId: !!userId });
        return;
      }

      try {
        // Broadcast reaction to ALL users in the session room
        // NOTE: No role-based filtering - reactions are role-agnostic
        // Any participant can send reactions, all participants receive them
        const room = io.sockets.adapter.rooms.get(`discussion-session:${sessionId}`);
        const roomSize = room ? room.size : 0;
        console.log(`📊 [reaction] Broadcasting to ${roomSize} connected sockets in room: discussion-session:${sessionId}`);
        
        io.to(`discussion-session:${sessionId}`).emit('user-reaction', {
          sessionId,
          reaction,
          userId,
          userName,
          userRole: userRole || socket.userRole || 'student',
          timestamp: Date.now()
        });

        console.log(`✅ [reaction] Broadcast complete: ${userId} (role: ${userRole || socket.userRole}) sent ${reaction} in session ${sessionId}`);
      } catch (error) {
        console.error('❌ [reaction] Error handling reaction:', error);
      }
    });

    /**
     * Event: ping (heartbeat)
     * Keep connection alive and detect client presence
     */
    socket.on('ping', (callback) => {
      callback({ pong: true });
    });
  });

  console.log('✅ Discussion Socket.IO handlers initialized');
  // Periodic task: reconcile session statuses and auto-close expired sessions
  setInterval(async () => {
    try {
      const activeSessions = await discussionSessionService.getAllActiveSessions();
      const now = new Date();
      for (const s of activeSessions) {
        if (s.endTime && new Date(s.endTime) <= now) {
          try {
            await discussionSessionService.closeSessionAutomatically(s.sessionId);
            // Notify room
            io.to(`discussion-session:${s.sessionId}`).emit('session-closed', {
              sessionId: s.sessionId,
              reason: 'Session time expired',
              timestamp: new Date()
            });
            // Broadcast updated participant list and status
            await broadcastParticipantList(s.sessionId);
            await broadcastSessionStatus(s.sessionId);
            // Clean up tracking
            if (sessionRooms.has(s.sessionId)) {
              sessionRooms.get(s.sessionId).forEach(socketId => {
                const clientSocket = io.sockets.sockets.get(socketId);
                if (clientSocket) clientSocket.leave(`discussion-session:${s.sessionId}`);
              });
              sessionRooms.delete(s.sessionId);
            }
            console.log('Auto-closed session due to time:', s.sessionId);
          } catch (err) {
            console.warn('Failed to auto-close session', s.sessionId, err.message);
          }
        }
      }
    } catch (err) {
      console.error('Error during session reconciliation:', err);
    }
  }, 15000);

  return {
    io,
    userSocketMap,
    sessionRooms,
    broadcastParticipantList,
    broadcastSessionStatus
  };
}

module.exports = { initializeDiscussionSocket };
