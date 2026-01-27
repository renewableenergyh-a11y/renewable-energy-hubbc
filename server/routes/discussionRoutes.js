/**
 * Discussion APIs - RESTful endpoints for session and participant management
 */

const express = require('express');
const router = express.Router();

// Shared roles helper (single source of truth for role hierarchy)
const roles = require('../utils/roles');

// Note: use roles.normalizeAuthUser(req.user) in verifyAuth to ensure superadmin and other special identities are normalized

module.exports = function(db, discussionSessionService, participantService, io = null) {
  // Email validation regex
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Middleware to verify authentication (assumes auth token in headers)
  const verifyAuth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];

    console.log('🔐 [verifyAuth] Headers:', { hasToken: !!token, userId, userRole });

    // ACCEPT: userId + userRole (header-based auth, preferred for discussion routes)
    if (userId && userRole) {
      const role = userRole;
      const isAdmin = roles.hasAtLeastRole({ role }, 'admin');
      
      // Validate userId format: only email allowed for regular users
      if (!isValidEmail(userId) && !isAdmin) {
        console.warn('⚠️ [verifyAuth] Non-email userId not allowed for regular users:', { userId, role });
        return res.status(401).json({ error: 'Unauthorized - userId must be an email address' });
      }

      req.user = { id: userId, role: role };
      req.user = roles.normalizeAuthUser(req.user);
      console.log('✅ [verifyAuth] User authenticated via headers:', { id: req.user.id, role: req.user.role });
      return next();
    }

    // FALLBACK: Accept token-only auth if no headers provided
    if (token && !userId) {
      console.warn('⚠️ [verifyAuth] Token provided but missing user headers - recommend adding x-user-id and x-user-role');
      // For now, allow it but set placeholder user
      req.user = { id: 'token-user', role: 'student' };
      return next();
    }

    // REJECT: No valid auth found
    console.warn('⚠️ [verifyAuth] No valid authentication found - missing both headers and token');
    return res.status(401).json({ error: 'Unauthorized - missing authentication' });
  };

  // ==================== SESSION ENDPOINTS ====================

  /**
   * POST /api/discussions/sessions - Create a new discussion session
   * @body {Object} sessionData - Session creation data
   * @returns {Object} Created session
   */
  router.post('/sessions', verifyAuth, async (req, res) => {
    try {
      const { courseId, subject, description, sessionType, startTime, endTime, maxParticipants } = req.body;

      console.log('📝 POST /sessions - Received request', {
        courseId,
        subject,
        sessionType,
        creatorRole: req.user?.role,
        creatorId: req.user?.id
      });

      if (!req.user) {
        console.error('❌ User not authenticated');
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Only admins and instructors can create sessions (use role hierarchy)
      if (!roles.hasAtLeastRole(req.user, 'instructor')) {
        console.error('❌ Unauthorized role:', req.user.role);
        return res.status(403).json({ error: 'Only admins and instructors can create sessions' });
      }

      const sessionData = {
        courseId,
        subject,
        description,
        sessionType: sessionType || 'peer',
        creatorRole: req.user.role,
        creatorId: req.user.id,
        startTime,
        endTime,
        maxParticipants: maxParticipants || 50
      };

      const session = await discussionSessionService.createSession(sessionData);
      
      console.log('✅ Session created successfully:', session.sessionId);

      res.status(201).json({
        success: true,
        message: 'Session created successfully',
        session
      });
    } catch (error) {
      console.error('❌ Error creating session:', error.message);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * GET /api/discussions/sessions/course/:courseId - Get sessions by course
   * @query {String} status - Optional filter by status (upcoming, active, closed)
   * @returns {Array} List of sessions
   */
  router.get('/sessions/course/:courseId', verifyAuth, async (req, res) => {
    try {
      const { courseId } = req.params;
      const { status } = req.query;

      console.log('📖 [GET /sessions/course/:courseId] Authorized user:', { userId: req.user?.id, role: req.user?.role, courseId });
      const sessions = await discussionSessionService.getSessionsByCourse(courseId, status);
      console.log('📖 GET /sessions/course/:courseId - Found', sessions.length, 'sessions');
      if (sessions.length > 0) {
        console.log('📖 Sample session:', { sessionId: sessions[0].sessionId, subject: sessions[0].subject, status: sessions[0].status });
      }

      res.json({
        success: true,
        sessions
      });
    } catch (error) {
      console.error('Error fetching sessions:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * GET /api/discussions/sessions/upcoming/:courseId - Get upcoming sessions for a course
   * @returns {Array} List of upcoming sessions
   */
  router.get('/sessions/upcoming/:courseId', verifyAuth, async (req, res) => {
    try {
      const { courseId } = req.params;

      const sessions = await discussionSessionService.getUpcomingSessionsByCourse(courseId);

      res.json({
        success: true,
        sessions
      });
    } catch (error) {
      console.error('Error fetching upcoming sessions:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * GET /api/discussions/sessions/:sessionId - Get a specific session
   * @returns {Object} Session details
   */
  router.get('/sessions/:sessionId', verifyAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      console.log('📖 [REST] GET /sessions/:sessionId - Looking for:', sessionId);
      console.log('📖 [REST] User auth info:', { userId: req.user?.id, role: req.user?.role });

      const session = await discussionSessionService.getSessionById(sessionId);

      if (!session) {
        console.warn('⚠️ [REST] Session not found for ID:', sessionId);
        return res.status(404).json({ 
          error: 'Session not found', 
          requestedId: sessionId,
          debug: 'Session does not exist in database'
        });
      }

      // Check if session is accessible
      // Allow access if:
      // 1. Session is active or upcoming
      // 2. User is the creator
      // 3. User is admin or instructor
      const now = new Date();
      const startTime = new Date(session.startTime);
      const endTime = new Date(session.endTime);
      
      const isActive = now >= startTime && now <= endTime;
      const isUpcoming = now < startTime;
      const isCreator = session.creatorId === req.user?.id;
      const isAdmin = roles.hasAtLeastRole(req.user, 'admin');
      
      if (!isActive && !isUpcoming && !isCreator && !isAdmin) {
        console.warn('⚠️ [REST] Session access denied:', { sessionId, status: session.status });
        return res.status(403).json({ 
          error: 'Session not accessible',
          debug: 'Session is not active or upcoming'
        });
      }

      console.log('✅ [REST] Session found and accessible:', sessionId);
      res.json({
        success: true,
        session
      });
    } catch (error) {
      console.error('❌ [REST] Error fetching session:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * POST /api/discussions/sessions/:sessionId/initiate - Initiate a session (first user join)
   * @returns {Object} Updated session
   */
  router.post('/sessions/:sessionId/initiate', verifyAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;

      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const session = await discussionSessionService.initiateSession(sessionId, req.user.id);

      res.json({
        success: true,
        message: 'Session initiated successfully',
        session
      });
    } catch (error) {
      console.error('Error initiating session:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * POST /api/discussions/sessions/:sessionId/close - Manually close a session
   * Superadmin: can close ANY session
   * Admin/Instructor: can only close THEIR OWN sessions
   * Student: cannot close sessions
   * @returns {Object} Updated session
   */
  router.post('/sessions/:sessionId/close', verifyAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;

      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // ✅ CRITICAL: Check authorization BEFORE calling service
      // Superadmin can close ANY session
      const session = await discussionSessionService.getSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Enforce role hierarchy: only admin+ can close
      if (!roles.hasAtLeastRole(req.user, 'instructor')) {
        console.warn('❌ [close] User lacks permission (not instructor+):', { userId: req.user.id, role: req.user.role });
        return res.status(403).json({ error: 'Only admins and instructors can close sessions' });
      }

      // Superadmin bypass: can close ANY session
      // Admin/Instructor: only own sessions
      if (!roles.hasAtLeastRole(req.user, 'superadmin') && session.creatorId !== req.user.id) {
        console.warn('❌ [close] User lacks ownership:', { userId: req.user.id, creatorId: session.creatorId });
        return res.status(403).json({ error: 'You can only close sessions you created' });
      }

      console.log('✅ [close] Authorization passed, closing session:', { sessionId, userId: req.user.id, role: req.user.role });

      const closedSession = await discussionSessionService.closeSessionManually(
        sessionId,
        req.user.id,
        req.user.role
      );

      res.json({
        success: true,
        message: 'Session closed successfully',
        session: closedSession
      });
    } catch (error) {
      console.error('Error closing session:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/discussions/sessions/:sessionId - Delete a session
   * Superadmin: can delete any session
   * Admin/Instructor: can only delete their own sessions
   * Student: cannot delete sessions
   * @returns {Object} Deletion confirmation
   */
  router.delete('/sessions/:sessionId', verifyAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;

      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Only admins, instructors, and superadmins can delete sessions (use role hierarchy)
      if (!roles.hasAtLeastRole(req.user, 'instructor')) {
        return res.status(403).json({ error: 'Only admins and instructors can delete sessions' });
      }

      console.log('🗑️ [DELETE] Session deletion requested:', { sessionId, userId: req.user.id, role: req.user.role });

      // Fetch session to check ownership
      const session = await discussionSessionService.getSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Superadmin may delete any session; admins/instructors only their own
      if (!roles.hasAtLeastRole(req.user, 'superadmin') && session.creatorId !== req.user.id) {
        console.warn('❌ [DELETE] User does not have permission to delete session:', { userId: req.user.id, role: req.user.role, creatorId: session.creatorId });
        return res.status(403).json({ error: 'You do not have permission to delete this session' });
      }

      // Delete session from database
      const deletedSession = await discussionSessionService.deleteSession(sessionId);

      // Delete all participants from session
      try {
        const Participant = db.models.Participant;
        if (Participant) {
          await Participant.deleteMany({ sessionId });
          console.log('✅ [DELETE] Deleted all participants for session:', sessionId);
        }
      } catch (err) {
        console.warn('⚠️ [DELETE] Error deleting participants:', err.message);
      }

      console.log('✅ [DELETE] Session deleted successfully:', sessionId);

      res.json({
        success: true,
        message: 'Session deleted successfully',
        sessionId: sessionId
      });
    } catch (error) {
      console.error('❌ [DELETE] Error deleting session:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * POST /api/discussions/sessions/:sessionId/close - Manually close a session
   * Superadmin: can close any session
   * Admin/Instructor: can only close their own sessions
   * Student: cannot close sessions
   * Transitions session from active/upcoming to closed without deleting it
   * @returns {Object} Updated session with status closed
   */
  router.post('/sessions/:sessionId/close', verifyAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;

      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Only admins, instructors, and superadmins can close sessions (use role hierarchy)
      if (!roles.hasAtLeastRole(req.user, 'instructor')) {
        return res.status(403).json({ error: 'Only admins and instructors can close sessions' });
      }

      console.log('🔒 [POST] Manual session close requested:', { sessionId, userId: req.user.id, role: req.user.role });

      // Fetch session to check ownership
      const session = await discussionSessionService.getSessionById(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Superadmin may close any session; admins/instructors only their own
      if (!roles.hasAtLeastRole(req.user, 'superadmin') && session.creatorId !== req.user.id) {
        console.warn('❌ [POST] User does not have permission to close session:', { userId: req.user.id, role: req.user.role, creatorId: session.creatorId });
        return res.status(403).json({ error: 'You do not have permission to close this session' });
      }

      // Close session manually
      const closedSession = await discussionSessionService.closeSessionManually(sessionId, req.user.id, req.user.role);

      console.log('✅ [POST] Session closed successfully:', sessionId);

      // Broadcast session-closed event to all clients in the room (if io is available)
      if (io) {
        io.to(`discussion-session:${sessionId}`).emit('session-closed', {
          sessionId: sessionId,
          reason: 'Session ended by ' + (req.user.role === 'admin' ? 'administrator' : req.user.role === 'superadmin' ? 'superadmin' : 'instructor'),
          timestamp: new Date()
        });
        console.log('📡 Broadcasted session-closed event for:', sessionId);
      }

      res.json({
        success: true,
        message: 'Session closed successfully',
        session: closedSession
      });
    } catch (error) {
      console.error('❌ [POST] Error closing session:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * POST /api/discussions/sessions/:sessionId/check-status - Check and update session status
   * @returns {Object} Updated session or null if no change
   */
  router.post('/sessions/:sessionId/check-status', verifyAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;

      const session = await discussionSessionService.checkAndUpdateSessionStatus(sessionId);

      res.json({
        success: true,
        session: session || { message: 'No status change required' }
      });
    } catch (error) {
      console.error('Error checking session status:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * GET /api/discussions/sessions/active - Get all active sessions
   * @returns {Array} List of active sessions
   */
  router.get('/sessions', verifyAuth, async (req, res) => {
    try {
      console.log('📖 GET /sessions - Fetching all active sessions');
      const sessions = await discussionSessionService.getAllActiveSessions();

      console.log('✅ Retrieved sessions:', sessions.length, 'sessions');

      res.json({
        success: true,
        sessions
      });
    } catch (error) {
      console.error('❌ Error fetching active sessions:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== PARTICIPANT ENDPOINTS ====================

  /**
   * POST /api/discussions/participants/:sessionId/join - Create/register participant (single source of truth)
   * This is the ONLY place where participants are created in the database
   * Socket.IO will only broadcast this state, never mutate it
   * Upsert pattern: creates if new, returns existing if already joined
   * @returns {Object} Participant object
   */
  router.post('/participants/:sessionId/join', verifyAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;

      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Get user name from header (sent from discussion room after name modal)
      const userName = req.headers['x-user-name'] || req.user.name || req.user.email;

      console.log('📝 [REST/participants/join] Registering participant', {
        sessionId,
        userId: req.user.id,
        userName: userName,
        userRole: req.user.role
      });

      // Validate session exists and is accessible
      const session = await discussionSessionService.getSessionById(sessionId);
      if (!session) {
        console.error('❌ [REST/participants/join] Session not found:', sessionId);
        return res.status(404).json({ error: 'Session not found' });
      }

      // Validate session state (active or upcoming)
      if (session.status === 'closed') {
        console.error('❌ [REST/participants/join] Session is closed:', sessionId);
        return res.status(403).json({ error: 'Session is closed' });
      }

      // CLEANUP: Remove user from ALL other sessions before joining this one
      // This prevents users from appearing in multiple sessions simultaneously
      // Also cleanup any orphaned records with different userId formats (UUID vs email)
      console.log(`🧹 [REST/participants/join] Cleaning up user ${req.user.id} (email: ${req.user.email}) from other sessions and orphaned records`);
      try {
        // First cleanup: by userId (normal case)
        const removedCount = await db.models.Participant.updateMany(
          {
            userId: req.user.id,
            sessionId: { $ne: sessionId }, // Other sessions only
            active: true
          },
          {
            $set: {
              active: false,
              lastLeaveTime: new Date()
            }
          }
        );
        if (removedCount.modifiedCount > 0) {
          console.log(`✅ [REST/participants/join] Deactivated ${removedCount.modifiedCount} participant records from other sessions by userId`);
        }
        
        // Second cleanup: by email if user has email (catches orphaned email-based records)
        if (req.user.email) {
          const emailRemoved = await db.models.Participant.updateMany(
            {
              userId: req.user.email, // Email-based userId
              sessionId: { $ne: sessionId },
              active: true
            },
            {
              $set: {
                active: false,
                lastLeaveTime: new Date()
              }
            }
          );
          if (emailRemoved.modifiedCount > 0) {
            console.log(`✅ [REST/participants/join] Deactivated ${emailRemoved.modifiedCount} email-based orphaned records`);
          }
        }

        // Third cleanup: Remove duplicate inactive records from THIS session
        // This handles the case where user joined multiple times and has multiple participant records
        const inactiveRemoved = await db.models.Participant.deleteMany({
          sessionId: sessionId,
          active: false, // Only delete inactive ones
          userId: { 
            $in: [req.user.id, req.user.email].filter(Boolean) 
          }
        });
        if (inactiveRemoved.deletedCount > 0) {
          console.log(`🗑️ [REST/participants/join] Purged ${inactiveRemoved.deletedCount} inactive duplicate records from this session`);
        }

        // Fourth cleanup: Remove ANY UUID-based records from this session (orphaned from migration)
        // Email regex pattern for validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const uuidRemoved = await db.models.Participant.deleteMany({
          sessionId: sessionId,
          userId: { $regex: /^(?!.*@)/ } // Match anything that doesn't look like email
        });
        if (uuidRemoved.deletedCount > 0) {
          console.log(`🗑️ [REST/participants/join] Purged ${uuidRemoved.deletedCount} UUID-based orphaned records from session ${sessionId}`);
        }
      } catch (cleanupErr) {
        console.warn(`⚠️ [REST/participants/join] Cleanup failed: ${cleanupErr.message}`);
        // Don't fail the join operation if cleanup fails
      }

      // ATOMIC operation: Use findOneAndUpdate with upsert to prevent race condition duplicates
      // This ensures only ONE document per (sessionId, userId) pair, whether via REST or socket
      const now = new Date();
      // Generate deterministic participantId - same for same user in same session
      const participantId = `participant_${sessionId}_${req.user.id}`;
      
      console.log('📝 [REST/participants/join] Upserting participant with deterministic ID:', participantId);
      
      const participant = await db.models.Participant.findOneAndUpdate(
        { sessionId, userId: req.user.id },
        {
          $set: {
            active: true,
            lastLeaveTime: null,
            userName: userName,
            updatedAt: now
          },
          $setOnInsert: {
            participantId,
            sessionId,
            userId: req.user.id,
            role: req.user.role,
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

      console.log('✅ [REST/participants/join] Participant created/reactivated via atomic upsert', {
        participantId: participant.participantId,
        sessionId,
        userId: req.user.id,
        active: participant.active
      });

      // Return participant object
      res.status(201).json({
        success: true,
        message: 'Participant registered successfully',
        participant: {
          _id: participant._id,
          sessionId: participant.sessionId,
          userId: participant.userId,
          userName: participant.userName || req.user.name || req.user.email,
          role: participant.role,
          joinedAt: participant.joinTime
        }
      });
    } catch (error) {
      console.error('❌ [REST/participants/join] Error registering participant:', {
        message: error.message,
        code: error.code,
        name: error.name,
        details: error.errors || error
      });
      res.status(400).json({ 
        error: error.message,
        code: error.code,
        name: error.name
      });
    }
  });

  /**
   * POST /api/discussions/participants/:sessionId/leave - Leave a session
   * @returns {Object} Updated participant
   */
  router.post('/participants/:sessionId/leave', verifyAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;

      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const participant = await participantService.removeParticipant(sessionId, req.user.id);

      res.json({
        success: true,
        message: 'Left session successfully',
        participant
      });
    } catch (error) {
      console.error('Error leaving session:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * GET /api/discussions/participants/:sessionId - Get all active participants
   * @returns {Array} List of active participants
   */
  router.get('/participants/:sessionId', verifyAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;

      const participants = await participantService.getActiveParticipants(sessionId);

      res.json({
        success: true,
        participants
      });
    } catch (error) {
      console.error('Error fetching participants:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * GET /api/discussions/participants/:sessionId/stats - Get session participant statistics
   * @returns {Object} Statistics object
   */
  router.get('/participants/:sessionId/stats', verifyAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;

      const stats = await participantService.getSessionParticipantStats(sessionId);

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Error fetching participant stats:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * PUT /api/discussions/participants/:sessionId/media - Update participant media status
   * @body {Object} mediaStatus - { audioEnabled, videoEnabled }
   * @returns {Object} Updated participant
   */
  router.put('/participants/:sessionId/media', verifyAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { audioEnabled, videoEnabled } = req.body;

      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const participant = await participantService.updateParticipantMediaStatus(
        sessionId,
        req.user.id,
        audioEnabled,
        videoEnabled
      );

      res.json({
        success: true,
        message: 'Media status updated',
        participant
      });
    } catch (error) {
      console.error('Error updating media status:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * GET /api/discussions/participants/:sessionId/all - Get all participants (active and inactive)
   * @returns {Array} List of all participants
   */
  router.get('/participants/:sessionId/all', verifyAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;

      // Check permissions - only admins/instructors (by role) or session participants
      const isParticipant = await participantService.isUserInSession(sessionId, req.user.id);
      if (!isParticipant && !roles.hasAtLeastRole(req.user, 'instructor')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const participants = await participantService.getAllParticipants(sessionId);

      res.json({
        success: true,
        participants
      });
    } catch (error) {
      console.error('Error fetching all participants:', error);
      res.status(400).json({ error: error.message });
    }
  });

  return router;
};
