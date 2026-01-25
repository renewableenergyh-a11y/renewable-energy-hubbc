const mongoose = require('mongoose');

const DiscussionSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    courseId: {
      type: String,
      required: true,
      index: true
    },
    subject: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    sessionType: {
      type: String,
      enum: ['peer', 'instructor'],
      required: true
    },
    creatorRole: {
      type: String,
      enum: ['admin', 'instructor', 'superadmin', 'student'],
      required: true
    },
    creatorId: {
      type: String,
      required: true,
      index: true
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['upcoming', 'active', 'closed'],
      default: 'upcoming',
      index: true
    },
    initiatorUserId: {
      type: String,
      default: null,
      index: true
    },
    initiatorTimestamp: {
      type: Date,
      default: null
    },
    closedBy: {
      type: String,
      default: null
    },
    closedByRole: {
      type: String,
      enum: ['admin', 'instructor', null],
      default: null
    },
    closedAt: {
      type: Date,
      default: null
    },
    closedReason: {
      type: String,
      enum: ['time_expired', 'manual_closure', null],
      default: null
    },
    participantCount: {
      type: Number,
      default: 0
    },
    maxParticipants: {
      type: Number,
      default: 50
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { collection: 'discussion_sessions', timestamps: true }
);

// Indexes for efficient queries
DiscussionSessionSchema.index({ courseId: 1, status: 1 });
DiscussionSessionSchema.index({ courseId: 1, startTime: 1 });
DiscussionSessionSchema.index({ creatorId: 1, createdAt: -1 });
DiscussionSessionSchema.index({ startTime: 1, endTime: 1 });

module.exports = DiscussionSessionSchema;
