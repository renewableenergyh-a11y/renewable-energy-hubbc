const fs = require('fs');
const path = require('path');
const db = require('./db');

const USERS_FILE = path.join(__dirname, 'users.json');
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');
const HELP_FILE = path.join(__dirname, 'help.json');
const REVOKED_TOKENS_FILE = path.join(__dirname, 'revoked_tokens.json');
const COURSES_FILE = path.join(__dirname, '..', 'data', 'courses.json');
const ADMINS_FILE = path.join(__dirname, 'admins.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// In-memory caches to preserve synchronous API used by existing code
let usersCache = {};
let sessionsCache = {};
let helpCache = [];
let revokedCache = [];
let coursesCache = null;
let adminsCache = null;
let settingsCache = null;
let modulesCache = {}; // courseId -> array of modules
let messagesCache = []; // Array of system messages

async function init() {
  try {
    await db.init();
  } catch (e) {
    console.warn('Storage: MongoDB init failed, falling back to file storage', e && e.message ? e.message : e);
  }

  // If DB connected, try to load from DB; otherwise load from local files
  if (db.isConnected()) {
    try {
      const { models } = db;
      
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Storage init query timeout')), 5000)
      );
      
      const queryPromise = Promise.all([
        models.User.find({}).lean().exec(),
        models.Session.find({}).lean().exec(),
        models.Help.find({}).lean().exec(),
        models.Revoked.find({}).lean().exec(),
        models.Course.find({}).lean().exec(),
        models.Admin.find({}).lean().exec(),
        models.Setting.find({}).lean().exec(),
        models.Module.find({}).lean().exec(),
        models.Message.find({}).lean().exec()
      ]);
      
      const [users, sessions, helps, revoked, courses, admins, settings, modules, messages] = await Promise.race([queryPromise, timeoutPromise]);

      // Normalize into maps where appropriate
      usersCache = {};
      (users || []).forEach(u => { if (u && u.email) usersCache[u.email] = u; });

      sessionsCache = {};
      (sessions || []).forEach(s => { if (s && s.sessionId) sessionsCache[s.sessionId] = s; });

      helpCache = helps || [];
      revokedCache = revoked || [];
      messagesCache = messages || [];

      // courses, admins and settings keep original shapes
      coursesCache = (courses && courses.length && courses[0].data) ? courses[0].data : (courses && courses.length ? courses[0].data || [] : []);
      adminsCache = admins && admins.length ? admins : [];
      settingsCache = settings && settings.length ? settings[0] : {};

      modulesCache = {};
      (modules || []).forEach(m => { if (m && m.courseId && m.data) modulesCache[m.courseId] = m.data; });

      console.log('Storage: loaded data from MongoDB into in-memory caches');
      return;
    } catch (err) {
      console.warn('Storage: failed to load from DB', err && err.message ? err.message : err);
      // fallthrough to file-based load
    }
  }

  // Fallback: load caches from local JSON files if DB isn't available
  try {
    if (fs.existsSync(USERS_FILE)) {
      try { usersCache = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')) || {}; } catch(e) { usersCache = {}; }
    }
    if (fs.existsSync(SESSIONS_FILE)) {
      try { sessionsCache = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')) || {}; } catch(e) { sessionsCache = {}; }
    }
    if (fs.existsSync(HELP_FILE)) {
      try { helpCache = JSON.parse(fs.readFileSync(HELP_FILE, 'utf8')) || []; } catch(e) { helpCache = []; }
    }
    if (fs.existsSync(REVOKED_TOKENS_FILE)) {
      try { revokedCache = JSON.parse(fs.readFileSync(REVOKED_TOKENS_FILE, 'utf8')) || []; } catch(e) { revokedCache = []; }
    }
    if (fs.existsSync(COURSES_FILE)) {
      try { coursesCache = JSON.parse(fs.readFileSync(COURSES_FILE, 'utf8')) || []; } catch(e) { coursesCache = []; }
    } else {
      coursesCache = [];
    }
    if (fs.existsSync(ADMINS_FILE)) {
      try { adminsCache = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8')) || []; } catch(e) { adminsCache = []; }
    } else {
      adminsCache = [];
    }
    if (fs.existsSync(SETTINGS_FILE)) {
      try { settingsCache = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) || {}; } catch(e) { settingsCache = {}; }
    } else {
      settingsCache = {};
    }

    modulesCache = {};
    const modulesDir = path.join(__dirname, '..', 'data', 'modules');
    if (fs.existsSync(modulesDir)) {
      const courses = fs.readdirSync(modulesDir).filter(f => fs.statSync(path.join(modulesDir, f)).isDirectory());
      courses.forEach(courseId => {
        const idxPath = path.join(modulesDir, courseId, 'index.json');
        if (fs.existsSync(idxPath)) {
          try { modulesCache[courseId] = JSON.parse(fs.readFileSync(idxPath, 'utf8')) || []; } catch(e) { modulesCache[courseId] = []; }
        }
      });
    }

    if (fs.existsSync(MESSAGES_FILE)) {
      try { messagesCache = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8')) || []; } catch(e) { messagesCache = []; }
    } else {
      messagesCache = [];
    }

    console.log('Storage: loaded data from local files into in-memory caches');
    return;
  } catch (err) {
    console.error('Storage: failed to load from files', err && err.message ? err.message : err);
    // ensure caches are initialized to safe defaults
    usersCache = {};
    sessionsCache = {};
    helpCache = [];
    revokedCache = [];
    coursesCache = [];
    adminsCache = [];
    settingsCache = {};
    return;
  }
}

// Helper to persist to DB if available, otherwise to file
function persistToDbOrFile(collectionName, keyField, mapOrArray, filePath) {
  // ALWAYS write to file as backup (for ephemeral filesystems like Render)
  if (filePath) {
    try {
      // If caller passed an array wrapping a single { data: ... } object, unwrap for file output
      let toWrite = mapOrArray;
      if (Array.isArray(mapOrArray) && mapOrArray.length === 1 && mapOrArray[0] && Object.prototype.hasOwnProperty.call(mapOrArray[0], 'data')) {
        toWrite = mapOrArray[0].data;
      }
      fs.writeFileSync(filePath, JSON.stringify(toWrite, null, 2));
      console.log(`💾 Persisted ${collectionName} to file:`, filePath);
    } catch (e) {
      console.warn('persist error writing file fallback', filePath, e && e.message);
    }
  }
  
  // If MongoDB is connected, also persist to DB
  if (!db.isConnected()) {
    return; // File write succeeded, DB not available
  }

  const model = db.models && db.models[collectionName];
  if (!model) {
    // If model missing but filePath provided, write file as fallback
    if (filePath) {
      try { fs.writeFileSync(filePath, JSON.stringify(mapOrArray, null, 2)); return; } catch(e) { console.warn('persist error writing file fallback', e && e.message); return; }
    }
    throw new Error(`Unknown model: ${collectionName}`);
  }

  // Write each item as a document; mapOrArray may be a map (object) or array
  // Collect promises and use Promise.all so failures are observed and handled
  try {
    if (Array.isArray(mapOrArray)) {
      const promises = [];
      for (const doc of mapOrArray) {
        // Only persist valid plain objects (not null, not arrays, not primitives)
        if (!doc || typeof doc !== 'object' || Array.isArray(doc) || doc === null) continue;
        const filter = doc._id ? { _id: doc._id } : (doc.email ? { email: doc.email } : (doc.sessionId ? { sessionId: doc.sessionId } : {}));
        promises.push(model.updateOne(filter, { $set: doc }, { upsert: true }).catch(e => { console.warn('persist error', e && e.message); }));
      }
      return Promise.all(promises);
    } else {
      const promises = Object.keys(mapOrArray || {}).map((k) => {
        const doc = mapOrArray[k];
        // Skip non-plain-object values (strings, numbers, null, arrays, functions, etc.)
        if (!doc || typeof doc !== 'object' || Array.isArray(doc) || doc === null) return Promise.resolve();
        return model.updateOne({ [keyField]: k }, { $set: doc }, { upsert: true }).catch(e => { console.warn('persist error', e && e.message); });
      });
      return Promise.all(promises);
    }
  } catch (err) {
    console.warn('persist error collecting promises', err && err.message);
    return Promise.resolve();
  }
}

function loadUsers() { return usersCache; }
function saveUsers(users) { usersCache = users || {}; persistToDbOrFile('User', 'email', usersCache, USERS_FILE); }

function loadModules(courseId) { return modulesCache[courseId] || []; }
function saveModules(courseId, list) { modulesCache[courseId] = list || []; persistToDbOrFile('Module', 'courseId', { [courseId]: { courseId, data: list } }, path.join(__dirname, '..', 'data', 'modules', courseId, 'index.json')); }

function loadSessions() { return sessionsCache; }
function saveSessions(sessions) { sessionsCache = sessions || {}; persistToDbOrFile('Session', 'sessionId', sessionsCache, SESSIONS_FILE); }

function loadHelp() { console.log('📖 Loading help messages. Cache size:', helpCache.length); return helpCache; }
function saveHelp(list) { helpCache = list || []; console.log('💾 Saving help messages. New size:', helpCache.length); persistToDbOrFile('Help', null, helpCache, HELP_FILE); }

function loadRevokedTokens() { return revokedCache; }
function saveRevokedTokens(list) { revokedCache = list || []; persistToDbOrFile('Revoked', null, revokedCache, REVOKED_TOKENS_FILE); }

function loadCourses() { return coursesCache; }
function saveCourses(list) { coursesCache = list; persistToDbOrFile('Course', null, [{ data: list }], COURSES_FILE); }

function loadAdmins() { return adminsCache; }
function saveAdmins(list) { adminsCache = list; persistToDbOrFile('Admin', 'email', adminsCache || [], ADMINS_FILE); }

function loadSettings() { return settingsCache; }
function saveSettings(s) { settingsCache = s; persistToDbOrFile('Setting', null, [{ data: s }], SETTINGS_FILE); }

function loadMessages() { return messagesCache; }
function saveMessages(list) { messagesCache = list || []; persistToDbOrFile('Message', null, messagesCache, MESSAGES_FILE); }

// MongoDB wrapper functions for gamification and other features
async function find(collectionName, query = {}) {
  try {
    if (!db.models || !db.models[collectionName]) {
      console.warn(`Model not found: ${collectionName}`);
      return [];
    }
    const model = db.models[collectionName];
    const docs = await model.find(query).lean().exec();
    return docs || [];
  } catch (err) {
    console.error(`find error for ${collectionName}:`, err.message);
    return [];
  }
}

async function findOne(collectionName, query = {}) {
  try {
    if (!db.models || !db.models[collectionName]) {
      console.warn(`Model not found: ${collectionName}`);
      return null;
    }
    const model = db.models[collectionName];
    const doc = await model.findOne(query).lean().exec();
    return doc || null;
  } catch (err) {
    console.error(`findOne error for ${collectionName}:`, err.message);
    return null;
  }
}

async function insertOne(collectionName, document) {
  try {
    if (!db.models || !db.models[collectionName]) {
      console.error(`Model not found: ${collectionName}`);
      throw new Error(`Unknown model: ${collectionName}`);
    }
    const model = db.models[collectionName];
    const doc = new model(document);
    const saved = await doc.save();
    return saved.toObject ? saved.toObject() : saved;
  } catch (err) {
    console.error(`insertOne error for ${collectionName}:`, err.message);
    return null;
  }
}

async function updateOne(collectionName, query, update, options = {}) {
  try {
    if (!db.models || !db.models[collectionName]) {
      console.error(`Model not found: ${collectionName}`);
      throw new Error(`Unknown model: ${collectionName}`);
    }
    const model = db.models[collectionName];
    const result = await model.findOneAndUpdate(query, update, { new: true, ...options });
    return result ? (result.toObject ? result.toObject() : result) : null;
  } catch (err) {
    console.error(`updateOne error for ${collectionName}:`, err.message);
    return null;
  }
}

async function deleteOne(collectionName, query) {
  try {
    if (!db.models || !db.models[collectionName]) {
      console.error(`Model not found: ${collectionName}`);
      throw new Error(`Unknown model: ${collectionName}`);
    }
    const model = db.models[collectionName];
    const result = await model.deleteOne(query);
    return result.deletedCount > 0;
  } catch (err) {
    console.error(`deleteOne error for ${collectionName}:`, err.message);
    return false;
  }
}

async function reloadCaches() {
  // Reload all caches from files
  try {
    if (fs.existsSync(HELP_FILE)) {
      try { helpCache = JSON.parse(fs.readFileSync(HELP_FILE, 'utf8')) || []; } catch(e) { helpCache = []; }
    }
    if (fs.existsSync(SESSIONS_FILE)) {
      try { sessionsCache = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')) || {}; } catch(e) { sessionsCache = {}; }
    }
    console.log('Storage: reloaded caches from files');
  } catch (err) {
    console.error('Storage: failed to reload caches', err && err.message ? err.message : err);
  }
}

module.exports = {
  init,
  reloadCaches,
  loadUsers, saveUsers,
  loadSessions, saveSessions,
  loadHelp, saveHelp,
  loadRevokedTokens, saveRevokedTokens,
  loadCourses, saveCourses,
  loadAdmins, saveAdmins,
  loadSettings, saveSettings,
  loadModules, saveModules,
  loadMessages, saveMessages,
  // MongoDB wrapper functions
  find, findOne, insertOne, updateOne, deleteOne,
  models: () => db.models
};
