const express = require('express');
const router = express.Router();
const { evaluatePromotion, autoDisablePromotion, validatePromotionStart, calculateEndTime } = require('../utils/promotionValidator');

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
        aiPromotionStartedAt: null,
        aiDailyQuestionLimit: 50,
        showAiBetaNotice: true,
        
        // Premium & Trial
        enablePremiumSystem: true,
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
        aiPromotionStartedAt: null,
        aiDailyQuestionLimit: 50,
        showAiBetaNotice: true,
        
        // Premium & Trial
        enablePremiumSystem: true,
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

// ⚡ PUBLIC: Auto-expire promotions when time runs out (called by frontend every 5 seconds)
// No authentication needed - backend verifies expiration before disabling
// MUST come BEFORE the /:section route to take priority
router.put('/auto-expire-promotion', async (req, res) => {
  try {
    const { promotionType } = req.body;
    console.log(`🔄 [AUTO-EXPIRE] Request to auto-expire ${promotionType} promotion`);
    
    let settings = await db.models.PlatformSettings.findOne({});
    if (!settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }
    
    // 🧠 Use centralized promotion validator
    const promotionStatus = evaluatePromotion(settings, promotionType);
    
    console.log(`ℹ️ [AUTO-EXPIRE] Promotion status for ${promotionType}:`, {
      active: promotionStatus.active,
      hasExpired: promotionStatus.hasExpired,
      timeLeft: promotionStatus.timeLeft
    });
    
    if (!promotionStatus.active) {
      return res.json({ success: false, message: `${promotionType} promotion not active` });
    }
    
    if (!promotionStatus.hasExpired) {
      console.log(`⏰ [AUTO-EXPIRE] ${promotionType} promotion still active. Time left: ${promotionStatus.timeLeft}ms`);
      return res.json({ success: false, message: 'Promotion not yet expired', timeLeft: promotionStatus.timeLeft });
    }
    
    // 🔐 ATOMIC: Get all updates needed to disable promotion
    const updates = autoDisablePromotion(settings, promotionType);
    
    // Apply atomic updates to database
    console.log(`✅ [AUTO-EXPIRE] ${promotionType} promotion has expired! Applying atomic updates...`);
    
    const updatedSettings = await db.models.PlatformSettings.findByIdAndUpdate(
      settings._id,
      { $set: updates },
      { new: true, runValidators: false }
    );
    
    // 🔔 Create ONE-TIME notification for promotion end
    const notificationMsg = promotionType === 'ai-assistant'
      ? '🎉 AI Assistant promotion has ended. Access is now Premium only.'
      : '🎉 Premium access promotion has ended. Standard pricing now applies.';
    
    await createPromotionEndNotification(notificationMsg, {
      type: promotionType === 'ai-assistant' ? 'ai-promotion-ended' : 'premium-promotion-ended',
      featureType: promotionType
    });
    
    // Verify persistence
    const doubleCheckSettings = await db.models.PlatformSettings.findOne({});
    console.log(`🔍 [AUTO-EXPIRE] Verification - ${promotionType} state after update:`, {
      aiAccessMode: doubleCheckSettings.aiAccessMode,
      aiPromotionStartedAt: doubleCheckSettings.aiPromotionStartedAt,
      enablePremiumForAll: doubleCheckSettings.enablePremiumForAll,
      premiumPromotionStartAt: doubleCheckSettings.premiumPromotionStartAt
    });
    
    const plainSettings = doubleCheckSettings.toObject ? doubleCheckSettings.toObject() : doubleCheckSettings;
    return res.json({ 
      success: true, 
      message: `${promotionType} promotion auto-expired and disabled successfully`,
      settings: plainSettings
    });
  } catch (err) {
    console.error('❌ Error in auto-expire-promotion:', err);
    res.status(500).json({ error: 'Failed to check promotion expiration' });
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
      // 🧠 Validate promotion start using centralized validator
      const validation = validatePromotionStart('ai-assistant', updates);
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.error });
      }
      
      // Set promotion start time (NOW)
      updates.aiPromotionStartedAt = new Date();
      
      // Create ONE-TIME notification
      const notificationMsg = `🎉 AI Assistant is now available to all users for ${updates.aiPromotionDurationValue} ${updates.aiPromotionDurationUnit}! Try it out before the promotion ends.`;
      
      await createSystemNotification(notificationMsg, {
        type: 'ai-promotion-started',
        promotionEndsAt: calculateEndTime(updates.aiPromotionStartedAt, updates.aiPromotionDurationValue, updates.aiPromotionDurationUnit),
        duration: updates.aiPromotionDurationValue,
        durationUnit: updates.aiPromotionDurationUnit
      });
    } else if (section === 'ai-assistant' && updates.aiAccessMode === 'Premium Only') {
      // 🔐 ATOMIC: Reset to default mode and clear all promotion fields
      updates.aiPromotionStartedAt = null;
      updates.aiPromotionDurationValue = null;
      updates.aiPromotionDurationUnit = null;
      console.log('✅ [SETTINGS UPDATE] AI access mode reset to Premium Only');
    }
    
    // Handle Premium for Everyone promotion logic
    if (section === 'premium-trial' && updates.enablePremiumForAll === true) {
      // 🧠 Validate promotion start using centralized validator
      const validation = validatePromotionStart('premium-trial', updates);
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.error });
      }
      
      // Set promotion start time (NOW)
      updates.premiumPromotionStartAt = new Date();
      updates.premiumPromotionActive = true;
      
      const notificationMsg = `🎉 Premium access is now available to everyone for ${updates.premiumPromotionDurationValue} ${updates.premiumPromotionDurationUnit}! Enjoy all features before the promotion ends.`;
      
      await createSystemNotification(notificationMsg, {
        type: 'premium-promotion-started',
        promotionEndsAt: calculateEndTime(updates.premiumPromotionStartAt, updates.premiumPromotionDurationValue, updates.premiumPromotionDurationUnit),
        duration: updates.premiumPromotionDurationValue,
        durationUnit: updates.premiumPromotionDurationUnit
      });
    }
    
    // When disabling Premium for All, mark promotion as inactive and clear times
    if (section === 'premium-trial' && updates.enablePremiumForAll === false) {
      // 🔐 ATOMIC: Reset to default mode and clear all promotion fields
      updates.premiumPromotionActive = false;
      updates.premiumPromotionStartAt = null;
      updates.premiumPromotionEndAt = null;
      updates.premiumPromotionDurationValue = null;
      updates.premiumPromotionDurationUnit = null;
      console.log('✅ [SETTINGS UPDATE] Premium for all disabled, promotion fields cleared');
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

/**
 * Create ONE-TIME promotion end notification
 * Ensures only one notification per promotion end event
 */
async function createPromotionEndNotification(message, metadata = {}) {
  try {
    if (!db.models.Notification) {
      console.warn('Notification model not available');
      return null;
    }
    
    // Check if we already have a notification for this promotion end
    // Use featureType to prevent duplicates
    const existingNotification = await db.models.Notification.findOne({
      type: metadata.type,
      'metadata.featureType': metadata.featureType,
      createdAt: { $gte: new Date(Date.now() - 5000) } // Within last 5 seconds
    });
    
    if (existingNotification) {
      console.log(`🔔 [ONE-TIME] Notification already created for ${metadata.featureType}. Skipping duplicate.`);
      return existingNotification;
    }
    
    console.log(`🔔 [ONE-TIME] Creating promotion end notification for ${metadata.featureType}`);
    
    const notification = await db.models.Notification.create({
      message,
      type: metadata.type || 'system',
      forAllUsers: true,
      createdAt: new Date(),
      metadata: metadata,
      _onceFlag: `promotion-ended-${metadata.featureType}-${Date.now()}` // Unique one-time marker
    });
    
    return notification;
  } catch (err) {
    console.error('Error creating promotion-end notification:', err);
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
