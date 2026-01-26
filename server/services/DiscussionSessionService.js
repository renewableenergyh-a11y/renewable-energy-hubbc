const crypto = require('crypto');

/**
 * DiscussionSessionService - Handles all discussion session operations
 * Single source of truth for session state and lifecycle
 */
class DiscussionSessionService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new discussion session
   * @param {Object} sessionData - Session creation data
   * @returns {Object} Created session
   */
  async createSession(sessionData) {
    const {
      courseId,
      subject,
      description,
      sessionType,
      creatorRole,
      creatorId,
      startTime,
      endTime,
      maxParticipants = 50
    } = sessionData;

    console.log('📝 createSession() - Starting session creation', { courseId, subject, creatorId });

    // Validate required fields
    if (!courseId || !subject || !creatorId || !startTime || !endTime) {
      throw new Error('Missing required session fields');
    }

    // Validate time logic
    if (new Date(endTime) <= new Date(startTime)) {
      throw new Error('End time must be after start time');
    }

    // Validate creator role permissions
    if (!['admin', 'instructor', 'superadmin'].includes(creatorRole)) {
      throw new Error('Only admins and instructors can create sessions');
    }

    const sessionId = `session_${crypto.randomBytes(16).toString('hex')}`;

    const newSession = {
      sessionId,
      courseId,
      subject,
      description: description || '',
      sessionType: sessionType || 'peer',
      creatorRole,
      creatorId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      status: 'upcoming',
      initiatorUserId: null,
      initiatorTimestamp: null,
      participantCount: 0,
      maxParticipants,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const DiscussionSession = this.db.models.DiscussionSession;
    if (!DiscussionSession) {
      throw new Error('DiscussionSession model not initialized');
    }

    const session = new DiscussionSession(newSession);
    const saved = await session.save();

    console.log('✅ Session saved to DB:', sessionId);

    return saved.toObject();
  }

  /**
   * Get sessions by course and optional status filter
   * @param {String} courseId - Course ID
   * @param {String|null} status - Optional status filter (upcoming, active, closed)
   * @returns {Array} List of sessions
   */
  async getSessionsByCourse(courseId, status = null) {
    const DiscussionSession = this.db.models.DiscussionSession;
    if (!DiscussionSession) {
      throw new Error('DiscussionSession model not initialized');
    }

    const query = { courseId };
    if (status) {
      query.status = status;
    } else {
      // Default: show active and upcoming sessions only
      query.status = { $in: ['active', 'upcoming'] };
    }

    console.log('📝 getSessionsByCourse - Querying with:', JSON.stringify(query));
    const sessions = await DiscussionSession.find(query)
      .sort({ startTime: -1 })
      .lean();

    console.log('📝 getSessionsByCourse - Found', sessions.length, 'sessions for course', courseId);
    return sessions;
  }

  /**
   * Get session by ID
   * @param {String} sessionId - Session ID
   * @returns {Object} Session object
   */
  async getSessionById(sessionId) {
    const DiscussionSession = this.db.models.DiscussionSession;
    if (!DiscussionSession) {
      throw new Error('DiscussionSession model not initialized');
    }

    console.log('🔍 getSessionById - Looking for sessionId:', sessionId);
    const session = await DiscussionSession.findOne({ sessionId }).lean();
    console.log('🔍 getSessionById - Found:', session ? 'YES' : 'NO');
    return session;
  }

  /**
   * Initiate a session (lock to first user)
   * Called when first user joins an upcoming session
   * @param {String} sessionId - Session ID
   * @param {String} userId - User ID of initiator
   * @returns {Object} Updated session
   */
  async initiateSession(sessionId, userId) {
    const DiscussionSession = this.db.models.DiscussionSession;
    if (!DiscussionSession) {
      throw new Error('DiscussionSession model not initialized');
    }

    const session = await DiscussionSession.findOne({ sessionId });
    if (!session) {
      throw new Error('Session not found');
    }

    // Check if already initiated
    if (session.initiatorUserId) {
      throw new Error('Session already initiated by another user');
    }

    // Check session status
    if (session.status !== 'upcoming') {
      throw new Error('Only upcoming sessions can be initiated');
    }

    // Update session to active with initiator locked
    const now = new Date();
    session.initiatorUserId = userId;
    session.initiatorTimestamp = now;
    session.status = 'active';
    session.updatedAt = now;

    await session.save();
    return session.toObject();
  }

  /**
   * Automatically update session status based on time
   * Called periodically to transition sessions to active/closed
   * @param {String} sessionId - Session ID
   * @returns {Object|null} Updated session or null if no change
   */
  async checkAndUpdateSessionStatus(sessionId) {
    const DiscussionSession = this.db.models.DiscussionSession;
    if (!DiscussionSession) {
      throw new Error('DiscussionSession model not initialized');
    }

    const session = await DiscussionSession.findOne({ sessionId });
    if (!session) {
      throw new Error('Session not found');
    }

    const now = new Date();
    const updated = false;

    // Transition from upcoming to active (if start time has passed)
    if (session.status === 'upcoming' && now >= session.startTime && now < session.endTime) {
      session.status = 'active';
      session.updatedAt = now;
      updated = true;
    }

    // Transition from active to closed (if end time has passed)
    if (session.status === 'active' && now >= session.endTime) {
      session.status = 'closed';
      session.closedAt = now;
      session.closedReason = 'time_expired';
      session.updatedAt = now;
      updated = true;
    }

    if (updated) {
      await session.save();
      return session.toObject();
    }

    return null;
  }

  /**
   * Manually close a session (by instructor or admin)
   * @param {String} sessionId - Session ID
   * @param {String} userId - User ID closing the session
   * @param {String} userRole - User role (admin, instructor)
   * @returns {Object} Updated session
   */
  async closeSessionManually(sessionId, userId, userRole) {
    const DiscussionSession = this.db.models.DiscussionSession;
    if (!DiscussionSession) {
      throw new Error('DiscussionSession model not initialized');
    }

    // Validate permissions
    if (!['admin', 'instructor'].includes(userRole)) {
      throw new Error('Only admins and instructors can close sessions');
    }

    const session = await DiscussionSession.findOne({ sessionId });
    if (!session) {
      throw new Error('Session not found');
    }

    // Instructors can only close their own sessions
    if (userRole === 'instructor' && session.creatorId !== userId) {
      throw new Error('Instructors can only close their own sessions');
    }

    // Only close if not already closed
    if (session.status === 'closed') {
      throw new Error('Session is already closed');
    }

    const now = new Date();
    session.status = 'closed';
    session.closedBy = userId;
    session.closedByRole = userRole;
    session.closedAt = now;
    session.closedReason = 'manual_closure';
    session.updatedAt = now;

    await session.save();
    return session.toObject();
  }

  /**
   * Close a session automatically by the system (no user permission checks)
   * @param {String} sessionId
   * @returns {Object} Updated session
   */
  async closeSessionAutomatically(sessionId) {
    const DiscussionSession = this.db.models.DiscussionSession;
    if (!DiscussionSession) {
      throw new Error('DiscussionSession model not initialized');
    }

    const session = await DiscussionSession.findOne({ sessionId });
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status === 'closed') {
      return session.toObject();
    }

    const now = new Date();
    session.status = 'closed';
    session.closedAt = now;
    session.closedReason = 'time_expired';
    session.updatedAt = now;

    await session.save();
    return session.toObject();
  }

  /**
   * Update participant count for a session
   * @param {String} sessionId - Session ID
   * @param {Number} count - New participant count
   * @returns {Object} Updated session
   */
  async updateParticipantCount(sessionId, count) {
    const DiscussionSession = this.db.models.DiscussionSession;
    if (!DiscussionSession) {
      throw new Error('DiscussionSession model not initialized');
    }

    const session = await DiscussionSession.findOneAndUpdate(
      { sessionId },
      {
        participantCount: count,
        updatedAt: new Date()
      },
      { new: true, lean: true }
    );

    return session;
  }

  /**
   * Get all active sessions
   * @returns {Array} List of active sessions
   */
  async getAllActiveSessions() {
    const DiscussionSession = this.db.models.DiscussionSession;
    if (!DiscussionSession) {
      throw new Error('DiscussionSession model not initialized');
    }

    // Return both active and upcoming sessions
    const sessions = await DiscussionSession.find({ 
      status: { $in: ['active', 'upcoming'] } 
    }).lean();
    
    console.log('📖 getAllActiveSessions - Found', sessions.length, 'sessions');
    return sessions;
  }

  /**
   * Get upcoming sessions by course
   * @param {String} courseId - Course ID
   * @returns {Array} List of upcoming sessions
   */
  async getUpcomingSessionsByCourse(courseId) {
    const DiscussionSession = this.db.models.DiscussionSession;
    if (!DiscussionSession) {
      throw new Error('DiscussionSession model not initialized');
    }

    const now = new Date();
    const sessions = await DiscussionSession.find({
      courseId,
      status: 'upcoming',
      startTime: { $gt: now }
    }).sort({ startTime: 1 }).lean();

    return sessions;
  }

  /**
   * Delete a session (admin only)
   * @param {String} sessionId - Session ID
   * @returns {Object} Deleted session
   */
  async deleteSession(sessionId) {
    const DiscussionSession = this.db.models.DiscussionSession;
    if (!DiscussionSession) {
      throw new Error('DiscussionSession model not initialized');
    }

    const session = await DiscussionSession.findOneAndDelete(
      { sessionId },
      { new: true }
    ).lean();

    if (!session) {
      throw new Error('Session not found');
    }

    console.log('🗑️ Session deleted successfully:', sessionId);
    return session;
  }
}

module.exports = DiscussionSessionService;
