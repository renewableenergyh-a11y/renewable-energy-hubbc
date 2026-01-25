/**
 * Simple migration script to copy existing JSON file data into MongoDB collections.
 * Usage: set MONGODB_URI in environment and run `node migrate_to_mongo.js`
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');

async function run() {
  await db.init();
  if (!db.isConnected()) {
    console.error('MongoDB not connected. Set MONGODB_URI and try again.');
    process.exit(1);
  }

  const models = db.models;
  const base = __dirname;
  const files = {
    users: path.join(base, 'users.json'),
    sessions: path.join(base, 'sessions.json'),
    admins: path.join(base, 'admins.json'),
    help: path.join(base, 'help.json'),
    revoked: path.join(base, 'revoked_tokens.json'),
    courses: path.join(base, '..', 'data', 'courses.json')
  };

  // Users
  try {
    if (fs.existsSync(files.users)) {
      const data = JSON.parse(fs.readFileSync(files.users, 'utf8')) || {};
      const entries = Object.values(data || {});
      for (const u of entries) {
        await models.User.updateOne({ email: u.email }, { $set: u }, { upsert: true });
      }
      console.log('Migrated users:', entries.length);
    }
  } catch (e) { console.error('users migrate error', e); }

  // Sessions
  try {
    if (fs.existsSync(files.sessions)) {
      const data = JSON.parse(fs.readFileSync(files.sessions, 'utf8')) || {};
      const entries = Object.values(data || {});
      for (const s of entries) {
        await models.Session.updateOne({ sessionId: s.sessionId }, { $set: s }, { upsert: true });
      }
      console.log('Migrated sessions:', entries.length);
    }
  } catch (e) { console.error('sessions migrate error', e); }

  // Admins
  try {
    if (fs.existsSync(files.admins)) {
      const data = JSON.parse(fs.readFileSync(files.admins, 'utf8')) || [];
      for (const a of data) {
        await models.Admin.updateOne({ email: a.email }, { $set: a }, { upsert: true });
      }
      console.log('Migrated admins:', data.length);
    }
  } catch (e) { console.error('admins migrate error', e); }

  // Help messages
  try {
    if (fs.existsSync(files.help)) {
      const data = JSON.parse(fs.readFileSync(files.help, 'utf8')) || [];
      for (const h of data) await models.Help.create(h).catch(() => {});
      console.log('Migrated help messages:', data.length);
    }
  } catch (e) { console.error('help migrate error', e); }

  // Revoked tokens
  try {
    if (fs.existsSync(files.revoked)) {
      const data = JSON.parse(fs.readFileSync(files.revoked, 'utf8')) || [];
      for (const r of data) await models.Revoked.create(r).catch(() => {});
      console.log('Migrated revoked tokens:', data.length);
    }
  } catch (e) { console.error('revoked migrate error', e); }

  // Courses (stored as array in file)
  try {
    if (fs.existsSync(files.courses)) {
      const data = JSON.parse(fs.readFileSync(files.courses, 'utf8')) || [];
      await models.Course.updateOne({}, { $set: { data } }, { upsert: true });
      console.log('Migrated courses count:', data.length);
    }
  } catch (e) { console.error('courses migrate error', e); }

  console.log('Migration finished.');
  process.exit(0);
}

run().catch(err => { console.error('Migration failed', err); process.exit(1); });
