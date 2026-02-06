const express = require('express');
const router = express.Router();

let db;
let storage;

// Setup database and storage
function setDatabase(database) {
  db = database;
}

function setStorage(storageModule) {
  storage = storageModule;
}

// Middleware to authenticate SuperAdmin only
function authenticateSuperAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const admins = storage.loadAdmins();
    let user = (admins || []).find(u => u.token === token);
    let isAdmin = !!user; // Track if user is in admins file
    
    // If token not found in admins file, check users database
    if (!user) {
      try {
        const users = storage.loadUsers ? storage.loadUsers() : {};
        for (const [email, u] of Object.entries(users || {})) {
          if (u && u.token === token) {
            user = { ...u, email };
            break;
          }
        }
      } catch (e) {
        // Ignore user load errors
        console.error('❌ Error loading users:', e.message);
      }
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Must be SuperAdmin - check if in admins file OR has superadmin role
    const userRole = (user.role || 'admin').toLowerCase();
    const isSuperAdmin = isAdmin || userRole === 'superadmin';
    
    if (!isSuperAdmin) {
      console.warn(`⚠️ User ${user.email} tried to access settings without SuperAdmin role. Role: ${userRole}, IsAdmin: ${isAdmin}`);
      return res.status(403).json({ error: 'Only Super Admin can access settings' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    console.error('❌ Authentication error:', err);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// GET public settings (no auth required - used by public pages for side effects)
router.get('/public/settings', async (req, res) => {
  try {
    console.log('🔍 [PUBLIC] Fetching settings from database...');
    let settings = await db.models.PlatformSettings.findOne({});
    
    if (!settings) {
      console.log('📝 [PUBLIC] No settings found, creating defaults...');
      // Create default settings if none exist
      settings = await db.models.PlatformSettings.create({
        // Core Platform
        siteName: 'Aubie RET Hub',
        maintenanceMode: false,
        maintenanceMessage: '',
        allowNewUserRegistration: true,
        defaultTimezone: 'UTC',
        
        // Certificates
        enableCertificateGeneration: true,
        minimumQuizPassPercentage: 70,
        allowCertificateRedownload: true,
        
        // News & Careers
        enableNewsSystem: true,
        enableLikesReactions: true,
        enableCareersPage: true,
        allowCareersPdfDownload: true,
        
        // AI Assistant
        enableAiAssistant: true,
        aiAccessMode: 'Premium Only',
        aiPromotionDurationValue: 7,
        aiPromotionDurationUnit: 'days',
        aiDailyQuestionLimit: 50,
        showAiBetaNotice: true,
        
        // Premium & Trial
        enablePremiumSystem: true,
        freeTrialDurationDays: 7,
        enablePremiumForAll: false,
        premiumPromotionActive: false,
        premiumPromotionStartAt: null,
        premiumPromotionEndAt: null,
        premiumPromotionDurationValue: 0,
        premiumPromotionDurationUnit: 'days',
      });
      console.log('✅ [PUBLIC] Default settings created');
    }
    
    console.log('📤 [PUBLIC] Returning settings');
    const plainSettings = settings.toObject ? settings.toObject() : settings;
    res.json(plainSettings);
  } catch (err) {
    console.error('❌ [PUBLIC] Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// GET platform settings (admin only)
router.get('/', authenticateSuperAdmin, async (req, res) => {
  try {
    console.log('🔍 [ADMIN] Fetching settings from database...');
    let settings = await db.models.PlatformSettings.findOne({});
    
    if (!settings) {
      console.log('📝 [ADMIN] No settings found, creating defaults...');
      // Create default settings if none exist
      settings = await db.models.PlatformSettings.create({
        // Core Platform
        siteName: 'Aubie RET Hub',
        maintenanceMode: false,
        maintenanceMessage: '',
        allowNewUserRegistration: true,
        defaultTimezone: 'UTC',
        
        // Certificates
        enableCertificateGeneration: true,
        minimumQuizPassPercentage: 70,
        allowCertificateRedownload: true,
        
        // News & Careers
        enableNewsSystem: true,
        enableLikesReactions: true,
        enableCareersPage: true,
        allowCareersPdfDownload: true,
        
        // AI Assistant
        enableAiAssistant: true,
        aiAccessMode: 'Premium Only', // 'Premium Only' or 'Everyone'
        aiPromotionDurationValue: 7,
        aiPromotionDurationUnit: 'days', // 'minutes', 'hours', 'days'
        aiDailyQuestionLimit: 50,
        showAiBetaNotice: true,
        
        // Premium & Trial
        enablePremiumSystem: true,
        freeTrialDurationDays: 7,
        enablePremiumForAll: false,
        premiumPromotionActive: false,
        premiumPromotionStartAt: null,
        premiumPromotionEndAt: null,
        premiumPromotionDurationValue: 0,
        premiumPromotionDurationUnit: 'days', // 'minutes', 'hours', 'days'
      });
      console.log('✅ Default settings created');
    }
    
    console.log('📤 Returning settings:', JSON.stringify(settings.toObject ? settings.toObject() : settings, null, 2));
    const plainSettings = settings.toObject ? settings.toObject() : settings;
    res.json(plainSettings);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// UPDATE settings for a specific section
router.put('/:section', authenticateSuperAdmin, async (req, res) => {
  try {
    const { section } = req.params;
    const updates = req.body;
    
    // Validate section
    const validSections = [
      'platform',
      'certificates',
      'news-careers',
      'ai-assistant',
      'premium-trial'
    ];
    
    if (!validSections.includes(section)) {
      return res.status(400).json({ error: 'Invalid settings section' });
    }
    
    // Get current settings
    let settings = await db.models.PlatformSettings.findOne({});
    if (!settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }
    
    // Handle AI Assistant promotion logic - EXACTLY LIKE PREMIUM
    if (section === 'ai-assistant' && updates.aiAccessMode === 'Everyone') {
      if (!updates.aiPromotionDurationValue || updates.aiPromotionDurationValue <= 0) {
        return res.status(400).json({ error: 'Promotion duration required when setting AI to Everyone' });
      }
      
      // Calculate end time based on unit - EXACTLY LIKE PREMIUM
      const now = new Date();
      let endTime = new Date(now);
      
      if (updates.aiPromotionDurationUnit === 'minutes') {
        endTime.setMinutes(endTime.getMinutes() + updates.aiPromotionDurationValue);
      } else if (updates.aiPromotionDurationUnit === 'hours') {
        endTime.setHours(endTime.getHours() + updates.aiPromotionDurationValue);
      } else if (updates.aiPromotionDurationUnit === 'days') {
        endTime.setDate(endTime.getDate() + updates.aiPromotionDurationValue);
      }
      
      const notificationMsg = `🎉 AI Assistant is now available to all users for ${updates.aiPromotionDurationValue} ${updates.aiPromotionDurationUnit}! Try it out before the promotion ends.`;
      
      await createSystemNotification(notificationMsg, {
        type: 'ai-promotion',
        promotionEndsAt: endTime,
        duration: updates.aiPromotionDurationValue,
        durationUnit: updates.aiPromotionDurationUnit
      });
    }
    
    // Handle Premium for Everyone promotion logic
    if (section === 'premium-trial' && updates.enablePremiumForAll) {
      if (!updates.premiumPromotionDurationValue || updates.premiumPromotionDurationValue <= 0) {
        return res.status(400).json({ error: 'Promotion duration required when enabling Premium for All' });
      }
      
      // Calculate end time based on unit
      const now = new Date();
      let endTime = new Date(now);
      
      if (updates.premiumPromotionDurationUnit === 'minutes') {
        endTime.setMinutes(endTime.getMinutes() + updates.premiumPromotionDurationValue);
      } else if (updates.premiumPromotionDurationUnit === 'hours') {
        endTime.setHours(endTime.getHours() + updates.premiumPromotionDurationValue);
      } else if (updates.premiumPromotionDurationUnit === 'days') {
        endTime.setDate(endTime.getDate() + updates.premiumPromotionDurationValue);
      }
      
      // Update settings with promotion info
      settings.premiumPromotionActive = true;
      settings.premiumPromotionStartAt = now;
      settings.premiumPromotionEndAt = endTime;
      
      const notificationMsg = `🎉 Premium access is now available to everyone for ${updates.premiumPromotionDurationValue} ${updates.premiumPromotionDurationUnit}! Enjoy all features before the promotion ends.`;
      
      await createSystemNotification(notificationMsg, {
        type: 'premium-promotion',
        promotionEndsAt: endTime,
        duration: updates.premiumPromotionDurationValue,
        durationUnit: updates.premiumPromotionDurationUnit
      });
    }
    
    // When disabling Premium for All, mark promotion as inactive
    if (section === 'premium-trial' && updates.enablePremiumForAll === false) {
      updates.premiumPromotionActive = false;
    }
    
    // Apply updates to settings using findByIdAndUpdate for proper persistence
    console.log('📝 Updating settings document with:', JSON.stringify(updates, null, 2));
    
    const updatedSettings = await db.models.PlatformSettings.findByIdAndUpdate(
      settings._id,
      { $set: updates },
      { new: true, runValidators: false }
    );
    
    console.log('✅ Settings updated via findByIdAndUpdate');
    console.log('🔍 Returned document maintenanceMode:', updatedSettings.maintenanceMode);
    console.log('🔍 Returned document maintenanceMessage:', updatedSettings.maintenanceMessage);
    
    // Double-check by refetching
    const doubleCheckSettings = await db.models.PlatformSettings.findOne({});
    console.log('🔄 Double-check from DB - maintenanceMode:', doubleCheckSettings.maintenanceMode);
    console.log('🔄 Double-check from DB - maintenanceMessage:', doubleCheckSettings.maintenanceMessage);
    
    const plainSettings = doubleCheckSettings.toObject ? doubleCheckSettings.toObject() : doubleCheckSettings;
    res.json({ success: true, settings: plainSettings });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Helper function to create system notifications
async function createSystemNotification(message, metadata = {}) {
  try {
    if (!db.models.Notification) {
      console.warn('Notification model not available');
      return null;
    }
    
    const notification = await db.models.Notification.create({
      message,
      type: metadata.type || 'system',
      forAllUsers: true,
      createdAt: new Date(),
      expiresAt: metadata.promotionEndsAt || null,
      metadata: metadata
    });
    
    return notification;
  } catch (err) {
    console.error('Error creating notification:', err);
    return null;
  }
}

// CLEAR CACHE endpoint
router.post('/utilities/clear-cache', authenticateSuperAdmin, async (req, res) => {
  try {
    // Clear any in-memory caches
    // In this case, we'll clear application memory caches if they exist
    // This could include cached settings, user data, etc.
    
    // Invalidate all cached settings
    global.cachedPlatformSettings = null;
    
    res.json({ success: true, message: 'Application cache cleared' });
  } catch (err) {
    console.error('Error clearing cache:', err);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// GET ERROR LOGS endpoint
router.get('/utilities/error-logs', authenticateSuperAdmin, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Read error log file
    const logPath = path.join(__dirname, '../server.log');
    
    if (!fs.existsSync(logPath)) {
      return res.json({ logs: '', message: 'No error logs found' });
    }
    
    const logs = fs.readFileSync(logPath, 'utf8');
    const lines = logs.split('\n').slice(-100); // Last 100 lines
    
    res.json({ logs: lines.join('\n') });
  } catch (err) {
    console.error('Error reading logs:', err);
    res.status(500).json({ error: 'Failed to read error logs' });
  }
});

// Check promotion expiry and auto-revert
async function checkAndRevertExpiredPromotions() {
  try {
    const settings = await db.models.PlatformSettings.findOne({});
    if (!settings) return;
    
    const now = new Date();
    
    // Check AI promotion expiry
    if (settings.aiAccessMode === 'Everyone' && settings.aiPromotionDurationValue > 0) {
      // This is tracked by expiry in notifications, but we can also check here
    }
    
    // Check Premium promotion expiry
    if (settings.premiumPromotionActive && settings.premiumPromotionEndAt) {
      if (now > settings.premiumPromotionEndAt) {
        // Auto-revert premium
        settings.enablePremiumForAll = false;
        settings.premiumPromotionActive = false;
        settings.premiumPromotionEndAt = null;
        settings.premiumPromotionStartAt = null;
        
        await settings.save();
        
        console.log('✅ Premium promotion auto-expired');
      }
    }
  } catch (err) {
    console.error('Error checking promotions:', err);
  }
}

// Start periodic promotion check
setInterval(checkAndRevertExpiredPromotions, 60000); // Check every minute

module.exports = {
  router,
  setDatabase,
  setStorage,
  checkAndRevertExpiredPromotions
};
