import { getCurrentUser, hasPremium } from "./auth.js";

/**
 * Global Premium Access Checker
 * Determines if a user has premium access, considering:
 * 1. Global promotion override (highest priority)
 * 2. User premium subscription
 * 3. User free trial
 */
export function hasPremiumAccess(user = null) {
  user = user || getCurrentUser();
  
  if (!user) return false;
  
  // DEBUG: Log promotion status
  const promotionActive = window.premiumForAll === true;
  const promotionNotExpired = window.promotionEndTime && Date.now() < window.promotionEndTime;
  
  console.log('🔍 Premium access check:', {
    premiumForAll: window.premiumForAll,
    promotionEndTime: window.promotionEndTime,
    nowTime: Date.now(),
    promotionActive,
    promotionNotExpired,
    userHasPremium: user.hasPremium
  });
  
  // Check for global promotion override (loaded from settings applier) - HIGHEST PRIORITY
  if (promotionActive && promotionNotExpired) {
    console.log('✅ Premium access granted via GLOBAL PROMOTION');
    return true;
  }
  
  // Check user premium subscription
  if (user.hasPremium === true && user.subscriptionActive !== false) {
    console.log('✅ Premium access granted via subscription');
    return true;
  }
  
  console.log('❌ No premium access');
  return false;
}

/**
 * Check if user can access a specific module
 */
export function canAccessModule(module) {
  const user = getCurrentUser();
  
  // Free modules are always accessible to logged-in users
  if (!module.isPremium) {
    return user?.isLoggedIn === true || user?.email;
  }
  
  // Premium modules require premium access
  return hasPremiumAccess(user);
}
