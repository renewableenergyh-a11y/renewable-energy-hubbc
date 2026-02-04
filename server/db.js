const mongoose = require('mongoose');
const DiscussionSessionSchema = require('./models/DiscussionSession');
const ParticipantSchema = require('./models/Participant');

let connected = false;
const models = {};

async function init() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGODB_URI not set. MongoDB is required for this application.');
  }

  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    connected = true;
    console.log('Connected to MongoDB');

    // Flexible schemas (allow any fields stored in documents)
    const Schema = mongoose.Schema;
    const AnySchema = new Schema({}, { strict: false });

    // Use existing compiled models if present to avoid OverwriteModelError
    models.User = mongoose.models.User || mongoose.model('User', AnySchema, 'users');
    models.Session = mongoose.models.Session || mongoose.model('Session', AnySchema, 'sessions');
    models.Admin = mongoose.models.Admin || mongoose.model('Admin', AnySchema, 'admins');
    models.Course = mongoose.models.Course || mongoose.model('Course', AnySchema, 'courses');
    models.Help = mongoose.models.Help || mongoose.model('Help', AnySchema, 'help');
    models.Setting = mongoose.models.Setting || mongoose.model('Setting', AnySchema, 'settings');
    models.Revoked = mongoose.models.Revoked || mongoose.model('Revoked', AnySchema, 'revoked_tokens');
    models.Module = mongoose.models.Module || mongoose.model('Module', AnySchema, 'modules');
    models.Message = mongoose.models.Message || mongoose.model('Message', AnySchema, 'messages');
    models.Bookmark = mongoose.models.Bookmark || mongoose.model('Bookmark', AnySchema, 'bookmarks');
    models.Attendance = mongoose.models.Attendance || mongoose.model('Attendance', AnySchema, 'attendance');
    models.Comment = mongoose.models.Comment || mongoose.model('Comment', AnySchema, 'comments');
    models.UserStats = mongoose.models.UserStats || mongoose.model('UserStats', AnySchema, 'user_stats');
    models.Achievement = mongoose.models.Achievement || mongoose.model('Achievement', AnySchema, 'achievements');
    models.PointsLog = mongoose.models.PointsLog || mongoose.model('PointsLog', AnySchema, 'points_logs');
    models.Notification = mongoose.models.Notification || mongoose.model('Notification', AnySchema, 'notifications');
    models.Media = mongoose.models.Media || mongoose.model('Media', AnySchema, 'media');
    models.News = mongoose.models.News || mongoose.model('News', AnySchema, 'news');
    models.Highlight = mongoose.models.Highlight || mongoose.model('Highlight', AnySchema, 'highlights');
    models.Career = mongoose.models.Career || mongoose.model('Career', AnySchema, 'careers');
    models.PlatformSettings = mongoose.models.PlatformSettings || mongoose.model('PlatformSettings', AnySchema, 'platform_settings');
    
    // Discussion system models
    models.DiscussionSession = mongoose.models.DiscussionSession || mongoose.model('DiscussionSession', DiscussionSessionSchema);
    models.Participant = mongoose.models.Participant || mongoose.model('Participant', ParticipantSchema);

  } catch (err) {
    console.error('Failed to connect to MongoDB:', err && err.message ? err.message : err);
    throw err;
  }
}

module.exports = { init, models, isConnected: () => connected, mongoose };
