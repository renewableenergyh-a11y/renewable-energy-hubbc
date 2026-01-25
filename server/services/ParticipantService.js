const crypto = require('crypto');

/**
 * ParticipantService - Handles participant lifecycle and tracking
 * Ensures no duplicate participants in a session
 */
class ParticipantService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Add or rejoin a participant to a session
   * If participant already exists, update their status to active
   * @param {String} sessionId - Session ID
   * @param {String} userId - User ID
   * @param {String} role - User role (admin, instructor, student)
   * @param {String} userName - User name/email for display
   * @returns {Object} Participant object
   */
  async addOrRejoinParticipant(sessionId, userId, role, userName = null) {
    const Participant = this.db.models.Participant;
    if (!Participant) {
      throw new Error('Participant model not initialized');
    }

    // Check if participant already exists
    let participant = await Participant.findOne({
      sessionId,
      userId
    });

    const now = new Date();

    if (participant) {
      // Rejoin case: participant already exists
      if (participant.active) {
        // Already active - just return it (upsert pattern, no error)
        return participant.toObject();
      }

      // Was inactive, now rejoining
      // Calculate duration for previous session
      if (participant.lastLeaveTime && participant.joinTime) {
        const previousDuration = participant.lastLeaveTime - participant.joinTime;
        participant.totalDurationMs += previousDuration;
      }

      participant.active = true;
      participant.joinTime = now;
      participant.lastLeaveTime = null;
      participant.disconnectCount += 1;
      participant.updatedAt = now;

      if (userName && !participant.userName) {
        participant.userName = userName;
      }

      await participant.save();
      return participant.toObject();
    } else {
      // New participant
      const participantId = `participant_${sessionId}_${userId}_${crypto.randomBytes(8).toString('hex')}`;

      const newParticipant = new Participant({
        participantId,
        sessionId,
        userId,
        userName: userName,
        role,
        active: true,
        joinTime: now,
        lastLeaveTime: null,
        totalDurationMs: 0,
        audioEnabled: false,
        videoEnabled: false,
        disconnectCount: 0,
        createdAt: now,
        updatedAt: now
      });

      const saved = await newParticipant.save();
      return saved.toObject();
    }
  }

  /**
   * Remove (mark as inactive) a participant from a session
   * @param {String} sessionId - Session ID
   * @param {String} userId - User ID
   * @returns {Object} Updated participant
   */
  async removeParticipant(sessionId, userId) {
    const Participant = this.db.models.Participant;
    if (!Participant) {
      throw new Error('Participant model not initialized');
    }

    const participant = await Participant.findOne({
      sessionId,
      userId
    });

    if (!participant) {
      throw new Error('Participant not found in this session');
    }

    if (!participant.active) {
      throw new Error('Participant is already inactive');
    }

    const now = new Date();

    // Calculate and accumulate duration
    if (participant.joinTime) {
      const sessionDuration = now - participant.joinTime;
      participant.totalDurationMs += sessionDuration;
    }

    participant.active = false;
    participant.lastLeaveTime = now;
    participant.audioEnabled = false;
    participant.videoEnabled = false;
    participant.updatedAt = now;

    await participant.save();
    return participant.toObject();
  }

  /**
   * Get all active participants in a session
   * @param {String} sessionId - Session ID
   * @returns {Array} List of active participants
   */
  async getActiveParticipants(sessionId) {
    const Participant = this.db.models.Participant;
    if (!Participant) {
      throw new Error('Participant model not initialized');
    }

    const participants = await Participant.find({
      sessionId,
      active: true
    }).lean();

    return participants;
  }

  /**
   * Get participant count (active only)
   * @param {String} sessionId - Session ID
   * @returns {Number} Count of active participants
   */
  async getActiveParticipantCount(sessionId) {
    const Participant = this.db.models.Participant;
    if (!Participant) {
      throw new Error('Participant model not initialized');
    }

    const count = await Participant.countDocuments({
      sessionId,
      active: true
    });

    return count;
  }

  /**
   * Get a specific participant
   * @param {String} sessionId - Session ID
   * @param {String} userId - User ID
   * @returns {Object} Participant object
   */
  async getParticipant(sessionId, userId) {
    const Participant = this.db.models.Participant;
    if (!Participant) {
      throw new Error('Participant model not initialized');
    }

    const participant = await Participant.findOne({
      sessionId,
      userId
    }).lean();

    return participant;
  }

  /**
   * Update participant media status (audio/video enabled)
   * @param {String} sessionId - Session ID
   * @param {String} userId - User ID
   * @param {Boolean} audioEnabled - Audio enabled status
   * @param {Boolean} videoEnabled - Video enabled status
   * @returns {Object} Updated participant
   */
  async updateParticipantMediaStatus(sessionId, userId, audioEnabled, videoEnabled) {
    const Participant = this.db.models.Participant;
    if (!Participant) {
      throw new Error('Participant model not initialized');
    }

    const participant = await Participant.findOneAndUpdate(
      { sessionId, userId },
      {
        audioEnabled,
        videoEnabled,
        updatedAt: new Date()
      },
      { new: true, lean: true }
    );

    if (!participant) {
      throw new Error('Participant not found');
    }

    return participant;
  }

  /**
   * Get all participants in a session (active and inactive)
   * @param {String} sessionId - Session ID
   * @returns {Array} List of all participants
   */
  async getAllParticipants(sessionId) {
    const Participant = this.db.models.Participant;
    if (!Participant) {
      throw new Error('Participant model not initialized');
    }

    const participants = await Participant.find({ sessionId }).lean();
    return participants;
  }

  /**
   * Get participant statistics for a session
   * @param {String} sessionId - Session ID
   * @returns {Object} Statistics object
   */
  async getSessionParticipantStats(sessionId) {
    const Participant = this.db.models.Participant;
    if (!Participant) {
      throw new Error('Participant model not initialized');
    }

    const activeCount = await Participant.countDocuments({
      sessionId,
      active: true
    });

    const totalCount = await Participant.countDocuments({ sessionId });

    const participants = await Participant.find({ sessionId }).lean();
    const avgDuration = participants.length > 0
      ? participants.reduce((sum, p) => sum + (p.totalDurationMs || 0), 0) / participants.length
      : 0;

    return {
      activeCount,
      totalCount,
      averageDurationMs: avgDuration,
      participants
    };
  }

  /**
   * Check if user is in session (active or inactive)
   * @param {String} sessionId - Session ID
   * @param {String} userId - User ID
   * @returns {Boolean} True if user has participated in session
   */
  async isUserInSession(sessionId, userId) {
    const Participant = this.db.models.Participant;
    if (!Participant) {
      throw new Error('Participant model not initialized');
    }

    const participant = await Participant.findOne({
      sessionId,
      userId
    });

    return !!participant;
  }

  /**
   * Clean up all participants for a closed session
   * Marks all as inactive
   * @param {String} sessionId - Session ID
   */
  async cleanupSessionParticipants(sessionId) {
    const Participant = this.db.models.Participant;
    if (!Participant) {
      throw new Error('Participant model not initialized');
    }

    const now = new Date();

    await Participant.updateMany(
      { sessionId, active: true },
      {
        active: false,
        lastLeaveTime: now,
        audioEnabled: false,
        videoEnabled: false,
        updatedAt: now
      }
    );
  }
}

module.exports = ParticipantService;
