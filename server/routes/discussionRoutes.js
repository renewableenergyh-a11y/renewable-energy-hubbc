/**
 * Discussion APIs - RESTful endpoints for session and participant management
 */

const express = require('express');
const router = express.Router();

module.exports = function(db, discussionSessionService, participantService, io = null) {
  // Middleware to verify authentication (assumes auth token in headers)
  const verifyAuth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];

    console.log('🔐 [verifyAuth] Token present:', !!token);
    console.log('🔐 [verifyAuth] Headers:', { userId, userRole, authHeader: req.headers.authorization ? '***' : 'missing' });

    if (!token) {
      console.warn('⚠️ [verifyAuth] No authorization token');
      return res.status(401).json({ error: 'Unauthorized - missing token' });
    }

    // Extract user info from headers (these should be passed from frontend)
    // Use fallback to 'student' if role is missing
    if (userId) {
      const role = userRole || 'student';
      req.user = { id: userId, role: role };
      console.log('✅ [verifyAuth] User authenticated:', { id: userId, role: role, roleSource: userRole ? 'header' : 'fallback' });
      next();
    } else {
      console.warn('⚠️ [verifyAuth] Missing user ID in headers');
      return res.status(401).json({ error: 'Unauthorized - missing user id' });
    }
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

      // Only admins and instructors can create sessions
      if (!['admin', 'instructor', 'superadmin'].includes(req.user.role)) {
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

      console.log('📖 GET /sessions/course/:courseId - courseId:', courseId);
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
      const isAdmin = ['admin', 'superadmin'].includes(req.user?.role);
      
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
   * @returns {Object} Updated session
   */
  router.post('/sessions/:sessionId/close', verifyAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;

      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const session = await discussionSessionService.closeSessionManually(
        sessionId,
        req.user.id,
        req.user.role
      );

      res.json({
        success: true,
        message: 'Session closed successfully',
        session
      });
    } catch (error) {
      console.error('Error closing session:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/discussions/sessions/:sessionId - Delete a session (admin only)
   * @returns {Object} Deletion confirmation
   */
  router.delete('/sessions/:sessionId', verifyAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;

      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Only admins and instructors can delete sessions
      if (!['admin', 'instructor', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Only admins and instructors can delete sessions' });
      }

      console.log('🗑️ [DELETE] Session deletion requested:', { sessionId, userId: req.user.id, role: req.user.role });

      // Delete session from database
      const session = await discussionSessionService.deleteSession(sessionId);

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
   * POST /api/discussions/sessions/:sessionId/close - Manually close a session (admin/instructor only)
   * Transitions session from active/upcoming to closed without deleting it
   * @returns {Object} Updated session with status closed
   */
  router.post('/sessions/:sessionId/close', verifyAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;

      // Only admins and instructors can close sessions
      if (!['admin', 'instructor', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Only admins and instructors can close sessions' });
      }

      console.log('🔒 [POST] Manual session close requested:', { sessionId, userId: req.user.id, role: req.user.role });

      // Close session manually
      const session = await discussionSessionService.closeSessionManually(sessionId, req.user.id, req.user.role);

      console.log('✅ [POST] Session closed successfully:', sessionId);

      // Broadcast session-closed event to all clients in the room (if io is available)
      if (io) {
        io.to(`discussion-session:${sessionId}`).emit('session-closed', {
          sessionId: sessionId,
          reason: 'Session ended by ' + (req.user.role === 'admin' ? 'administrator' : 'instructor'),
          timestamp: new Date()
        });
        console.log('📡 Broadcasted session-closed event for:', sessionId);
      }

      res.json({
        success: true,
        message: 'Session closed successfully',
        session
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
        return res.status(404).json({ error: 'Session not found' });
      }

      // Validate session state (active or upcoming)
      if (session.status === 'closed') {
        return res.status(403).json({ error: 'Session is closed' });
      }

      // Check if participant already exists
      let participant = await participantService.getParticipant(sessionId, req.user.id);
      
      if (participant) {
        console.log('🔄 [REST/participants/join] Participant already exists, returning existing', {
          participantId: participant._id,
          sessionId
        });
      } else {
        // CREATE participant in database (upsert pattern)
        console.log('📝 [REST/participants/join] Creating new participant');
        participant = await participantService.addOrRejoinParticipant(
          sessionId,
          req.user.id,
          req.user.role,
          userName
        );

        console.log('✅ [REST/participants/join] Participant created in database', {
          participantId: participant._id,
          sessionId,
          userId: req.user.id,
          role: participant.role
        });
      }

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
          joinedAt: participant.joinedAt
        }
      });
    } catch (error) {
      console.error('❌ [REST/participants/join] Error registering participant:', error.message);
      res.status(400).json({ error: error.message });
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

      // Check permissions - only admins, instructors, or session participants
      const isParticipant = await participantService.isUserInSession(sessionId, req.user.id);
      if (!isParticipant && !['superadmin', 'admin', 'instructor'].includes(req.user.role)) {
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
