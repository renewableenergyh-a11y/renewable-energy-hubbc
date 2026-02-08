/**
 * Promotion Validator - Centralized promotion evaluation logic
 * Used by: API endpoints, background checks, admin updates
 * Ensures consistent behavior across all promotion handling
 */

/**
 * Evaluate if a promotion has expired and needs to be auto-disabled
 * @param {Object} settings - The platform settings object
 * @param {string} featureType - 'ai-assistant' or 'premium-trial'
 * @returns {Object} { hasExpired: boolean, timeLeft: number, endTime: Date }
 */
function evaluatePromotion(settings, featureType) {
  if (!settings) {
    return { hasExpired: false, timeLeft: null, endTime: null };
  }

  const now = new Date();

  if (featureType === 'ai-assistant') {
    // AI promotion is active only when accessMode is 'Everyone' and all required fields exist
    if (settings.aiAccessMode !== 'Everyone' || !settings.aiPromotionStartedAt || !settings.aiPromotionDurationValue || settings.aiPromotionDurationValue <= 0) {
      return { hasExpired: false, timeLeft: null, endTime: null, active: false };
    }

    const startTime = new Date(settings.aiPromotionStartedAt);
    const endTime = calculateEndTime(startTime, settings.aiPromotionDurationValue, settings.aiPromotionDurationUnit || 'days');
    const timeLeft = endTime.getTime() - now.getTime();
    const hasExpired = now >= endTime;

    return {
      active: true,
      hasExpired,
      timeLeft,
      endTime,
      startTime,
      duration: settings.aiPromotionDurationValue,
      durationUnit: settings.aiPromotionDurationUnit || 'days'
    };
  }

  if (featureType === 'premium-trial') {
    // Premium promotion is active only when enablePremiumForAll is true and all required fields exist
    if (settings.enablePremiumForAll !== true || !settings.premiumPromotionStartAt || !settings.premiumPromotionDurationValue || settings.premiumPromotionDurationValue <= 0) {
      return { hasExpired: false, timeLeft: null, endTime: null, active: false };
    }

    const startTime = new Date(settings.premiumPromotionStartAt);
    const endTime = calculateEndTime(startTime, settings.premiumPromotionDurationValue, settings.premiumPromotionDurationUnit || 'days');
    const timeLeft = endTime.getTime() - now.getTime();
    const hasExpired = now >= endTime;

    return {
      active: true,
      hasExpired,
      timeLeft,
      endTime,
      startTime,
      duration: settings.premiumPromotionDurationValue,
      durationUnit: settings.premiumPromotionDurationUnit || 'days'
    };
  }

  return { hasExpired: false, timeLeft: null, endTime: null };
}

/**
 * Calculate the end time of a promotion based on start time, duration, and unit
 * @param {Date} startTime
 * @param {number} duration
 * @param {string} unit - 'minutes', 'hours', or 'days'
 * @returns {Date}
 */
function calculateEndTime(startTime, duration, unit = 'days') {
  const endTime = new Date(startTime);
  const value = parseInt(duration, 10) || 7;

  if (unit === 'minutes') {
    endTime.setMinutes(endTime.getMinutes() + value);
  } else if (unit === 'hours') {
    endTime.setHours(endTime.getHours() + value);
  } else if (unit === 'days') {
    endTime.setDate(endTime.getDate() + value);
  }

  return endTime;
}

/**
 * Auto-disable a promotion when it expires
 * Performs atomic operation: updates both accessMode and promotion fields
 * @param {Object} settings - The platform settings object from database
 * @param {string} featureType - 'ai-assistant' or 'premium-trial'
 * @returns {Object} Updated settings object with atomic changes applied
 */
function autoDisablePromotion(settings, featureType) {
  if (!settings) {
    return null;
  }

  const updates = {};

  if (featureType === 'ai-assistant') {
    // 🔐 ATOMIC OPERATION: Switch access mode AND disable promotion simultaneously
    updates.aiAccessMode = 'Premium Only'; // Reset to default mode
    updates.aiPromotionStartedAt = null;
    updates.aiPromotionDurationValue = null;
    updates.aiPromotionDurationUnit = null;

    console.log('🔴 [PROMO VALIDATOR] AI promotion auto-disabled:');
    console.log('   - aiAccessMode → Premium Only');
    console.log('   - Cleared promotion timestamps and duration');
  } else if (featureType === 'premium-trial') {
    // 🔐 ATOMIC OPERATION: Disable premium for all AND clear promotion fields
    updates.enablePremiumForAll = false; // Reset to default mode
    updates.premiumPromotionActive = false;
    updates.premiumPromotionStartAt = null;
    updates.premiumPromotionEndAt = null;
    updates.premiumPromotionDurationValue = null;
    updates.premiumPromotionDurationUnit = null;

    console.log('🔴 [PROMO VALIDATOR] Premium promotion auto-disabled:');
    console.log('   - enablePremiumForAll → false');
    console.log('   - Cleared promotion timestamps and duration');
  }

  return updates;
}

/**
 * Validate if a promotion can be started
 * Ensures required fields are provided
 * @param {string} featureType - 'ai-assistant' or 'premium-trial'
 * @param {Object} updates - The update object
 * @returns {Object} { isValid: boolean, error: string | null }
 */
function validatePromotionStart(featureType, updates) {
  if (featureType === 'ai-assistant') {
    if (updates.aiAccessMode === 'Everyone') {
      if (!updates.aiPromotionDurationValue || updates.aiPromotionDurationValue <= 0) {
        return { isValid: false, error: 'Promotion duration required when setting AI to Everyone' };
      }
      return { isValid: true, error: null };
    }
  }

  if (featureType === 'premium-trial') {
    if (updates.enablePremiumForAll === true) {
      if (!updates.premiumPromotionDurationValue || updates.premiumPromotionDurationValue <= 0) {
        return { isValid: false, error: 'Promotion duration required when enabling Premium for All' };
      }
      return { isValid: true, error: null };
    }
  }

  return { isValid: true, error: null };
}

module.exports = {
  evaluatePromotion,
  calculateEndTime,
  autoDisablePromotion,
  validatePromotionStart
};
