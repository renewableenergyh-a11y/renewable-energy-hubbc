const mongoose = require('mongoose');

const ParticipantSchema = new mongoose.Schema(
  {
    participantId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    sessionId: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    userName: {
      type: String,
      default: null
    },
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'instructor', 'student'],
      required: true
    },
    active: {
      type: Boolean,
      default: false,
      index: true
    },
    joinTime: {
      type: Date,
      default: null
    },
    lastLeaveTime: {
      type: Date,
      default: null
    },
    totalDurationMs: {
      type: Number,
      default: 0
    },
    audioEnabled: {
      type: Boolean,
      default: false
    },
    videoEnabled: {
      type: Boolean,
      default: false
    },
    disconnectCount: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { collection: 'discussion_participants', timestamps: true }
);

// Indexes for efficient queries
ParticipantSchema.index({ sessionId: 1, active: 1 });
ParticipantSchema.index({ sessionId: 1, userId: 1 }, { unique: true });
ParticipantSchema.index({ userId: 1, sessionId: 1 });

module.exports = ParticipantSchema;
