/**
 * Settings Applier - Applies platform settings across the site
 * Reads from the PlatformSettings collection and enforces all behaviors
 */

class SettingsApplier {
  constructor() {
    this.settings = null;
    this.checkInterval = null;
  }

  /**
   * Initialize and load settings, apply them, set up auto-refresh
   */
  async init() {
    console.log('⚙️ Initializing Settings Applier...');
    
    // Load settings on init
    await this.loadAndApply();
    
    // Refresh settings every 30 seconds to catch admin changes
    this.checkInterval = setInterval(() => {
      this.loadAndApply();
    }, 30000);
    
    // Listen for immediate settings updates from admin panel or other tabs
    window.addEventListener('storage', (e) => {
      if (e.key === 'settingsUpdated') {
        console.log('📢 Settings update detected from admin panel or another tab');
        this.loadAndApply();
      }
    });
    
    console.log('✅ Settings Applier initialized');
  }

  /**
   * Load settings from API and apply them
   */
  async loadAndApply() {
    try {
      const response = await fetch('/api/settings/public/settings');
      if (!response.ok) {
        console.warn('⚠️ Could not load settings, status:', response.status);
        return;
      }

      this.settings = await response.json();
      console.log('📥 Settings loaded from public API');
      
      // Apply all settings
      this.applySettings();
    } catch (err) {
      console.warn('⚠️ Error loading settings:', err.message);
    }
  }

  /**
   * Main function to apply all settings
   */
  applySettings() {
    if (!this.settings) {
      console.warn('⚠️ No settings available to apply');
      return;
    }

    console.log('🔄 Applying all settings...');
    console.log('   maintenanceMode:', this.settings.maintenanceMode);
    console.log('   premiumForAll:', this.settings.enablePremiumForAll);
    console.log('   newsEnabled:', this.settings.enableNewsSystem);

    // Apply platform settings
    this.applyPlatformSettings();
    
    // Apply certificate settings
    this.applyCertificateSettings();
    
    // Apply news & careers settings
    this.applyNewsCareerSettings();
    
    // Apply AI assistant settings
    this.applyAiSettings();
    
    // Apply premium/trial settings
    this.applyPremiumSettings();
    
    console.log('✅ All settings applied');
  }

  /**
   * Platform settings: Site name, maintenance mode, registration, timezone
   */
  applyPlatformSettings() {
    const s = this.settings;
    
    console.log('🔧 Applying platform settings...');

    // Maintenance Mode - Block access entirely
    if (s.maintenanceMode) {
      console.log('🚧 MAINTENANCE MODE ENABLED - Blocking all access');
      this.showMaintenanceMode(s.maintenanceMessage);
      return; // Stop all other processing
    }

    // Site name
    if (s.siteName) {
      document.title = `${s.siteName} - Aubie RET Hub`;
      const siteNameElements = document.querySelectorAll('[data-site-name]');
      if (siteNameElements.length > 0) {
        siteNameElements.forEach(el => el.textContent = s.siteName);
      }
    }

    // Allow New User Registration
    if (s.allowNewUserRegistration === false) {
      console.log('🚫 Registration disabled');
      const signupBtn = document.querySelector('[data-action="signup"]');
      const signupForm = document.getElementById('signupForm');
      if (signupBtn) signupBtn.style.display = 'none';
      if (signupForm) {
        signupForm.style.display = 'none';
        const message = document.createElement('div');
        message.style.cssText = 'padding: 20px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; margin: 20px 0;';
        message.innerHTML = '<strong>Registration Closed:</strong> New user registration is currently disabled. Please contact support.';
        signupForm.parentNode.insertBefore(message, signupForm);
      }
    } else {
      // Re-show signup if it was hidden
      const signupBtn = document.querySelector('[data-action="signup"]');
      const signupForm = document.getElementById('signupForm');
      if (signupBtn) signupBtn.style.display = '';
      if (signupForm) signupForm.style.display = '';
      // Remove closed message if it exists
      const closedMsg = document.querySelector('[data-component="registration-closed"]');
      if (closedMsg) closedMsg.remove();
    }

    // Default Timezone (store for user settings)
    if (s.defaultTimezone) {
      window.platformTimezone = s.defaultTimezone;
    }
  }

  /**
   * Certificate settings: Generation toggle, pass percentage, re-download
   */
  applyCertificateSettings() {
    const s = this.settings;
    
    // Disable certificate generation entirely
    if (s.enableCertificateGeneration === false) {
      console.log('🎓 Certificates disabled');
      const certButtons = document.querySelectorAll('[data-action="download-certificate"]');
      certButtons.forEach(btn => btn.style.display = 'none');
    }

    // Minimum pass percentage - enforce on quiz results
    if (s.minimumQuizPassPercentage) {
      window.minimumPassPercentage = s.minimumQuizPassPercentage;
    }

    // Disable certificate re-download
    if (s.allowCertificateRedownload === false) {
      const redownloadBtns = document.querySelectorAll('[data-action="redownload-certificate"]');
      redownloadBtns.forEach(btn => btn.style.display = 'none');
    }
  }

  /**
   * News & Careers settings: System toggles and PDF downloads
   */
  applyNewsCareerSettings() {
    const s = this.settings;
    
    // Disable news system
    if (s.enableNewsSystem === false) {
      console.log('📰 News system disabled');
      const newsSection = document.getElementById('news-section') || document.querySelector('[data-section="news"]');
      if (newsSection) newsSection.style.display = 'none';
    }

    // Disable likes/reactions
    if (s.enableLikesReactions === false) {
      const likeButtons = document.querySelectorAll('[data-action="like"], .like-btn, .react-btn');
      likeButtons.forEach(btn => btn.style.display = 'none');
    }

    // Disable careers page
    if (s.enableCareersPage === false) {
      console.log('💼 Careers page disabled');
      const careersLink = document.querySelector('a[href*="careers"]');
      if (careersLink) careersLink.parentNode.style.display = 'none';
      const careersSection = document.getElementById('careers-section') || document.querySelector('[data-section="careers"]');
      if (careersSection) careersSection.style.display = 'none';
    }

    // Disable PDF downloads from careers
    if (s.allowCareersPdfDownload === false) {
      const pdfDownloads = document.querySelectorAll('[data-action="download-pdf"], .pdf-download-btn');
      pdfDownloads.forEach(btn => btn.style.display = 'none');
    }
  }

  /**
   * AI Assistant settings: Enable/disable, access mode, limits, notice
   */
  applyAiSettings() {
    const s = this.settings;
    
    // Disable AI entirely
    if (s.enableAiAssistant === false) {
      console.log('🤖 AI Assistant disabled');
      const aiSection = document.getElementById('ai-section') || document.querySelector('[data-section="ai"]');
      if (aiSection) aiSection.style.display = 'none';
      const aiBtn = document.querySelector('[data-action="open-ai"]');
      if (aiBtn) aiBtn.style.display = 'none';
      window.aiEnabled = false;
      return;
    }

    window.aiEnabled = true;

    // AI Access Mode
    if (s.aiAccessMode === 'Premium Only') {
      console.log('🔒 AI restricted to premium users');
      window.aiRestrictedToPremium = true;
      
      const aiInterface = document.querySelector('[data-component="ai-chat"]');
      const userRole = localStorage.getItem('userRole');
      const isPremium = localStorage.getItem('isPremium') === 'true';
      
      if (aiInterface && userRole === 'user' && !isPremium) {
        aiInterface.style.display = 'none';
        const upsell = document.createElement('div');
        upsell.style.cssText = 'padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; margin: 20px 0; text-align: center;';
        upsell.innerHTML = '<h3>Upgrade to Premium</h3><p>AI Assistant is available for premium members only.</p><button class="btn-primary" onclick="navigateToPremium()">Upgrade Now</button>';
        aiInterface.parentNode.insertBefore(upsell, aiInterface);
      }
    } else if (s.aiAccessMode === 'Everyone') {
      console.log('🟢 AI available to everyone');
      window.aiRestrictedToPremium = false;
    }

    // Daily question limit
    if (s.aiDailyQuestionLimit) {
      window.aiDailyQuestionLimit = s.aiDailyQuestionLimit;
    }

    // Show beta notice
    if (s.showAiBetaNotice) {
      const betaBadge = document.querySelector('[data-component="ai-beta-badge"]');
      if (betaBadge) betaBadge.style.display = 'inline-block';
    } else {
      const betaBadge = document.querySelector('[data-component="ai-beta-badge"]');
      if (betaBadge) betaBadge.style.display = 'none';
    }
  }

  /**
   * Premium & Trial settings: System toggle, trial duration, promotions
   */
  applyPremiumSettings() {
    const s = this.settings;
    
    // Disable premium system entirely
    if (s.enablePremiumSystem === false) {
      console.log('💳 Premium system disabled');
      window.premiumEnabled = false;
      const premiumBtn = document.querySelector('[data-action="upgrade-premium"]');
      if (premiumBtn) premiumBtn.style.display = 'none';
      const premiumSection = document.getElementById('premium-section') || document.querySelector('[data-section="premium"]');
      if (premiumSection) premiumSection.style.display = 'none';
      return;
    }

    window.premiumEnabled = true;

    // Free trial duration
    if (s.freeTrialDurationDays) {
      window.freeTrialDays = s.freeTrialDurationDays;
    }

    // Premium for all
    if (s.enablePremiumForAll) {
      console.log('🎉 PREMIUM FOR EVERYONE - Promotion active');
      window.premiumForAll = true;
      
      // Hide premium upgrade buttons
      const upgradeBtns = document.querySelectorAll('[data-action="upgrade-premium"]');
      upgradeBtns.forEach(btn => {
        btn.style.display = 'none';
        btn.setAttribute('data-hidden-by-promotion', 'true');
      });
      
      // Show promotion banner (only add if not already present)
      const existingBanner = document.querySelector('[data-component="premium-promotion-banner"]');
      if (!existingBanner) {
        const banner = document.createElement('div');
        banner.style.cssText = 'padding: 15px 20px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; text-align: center; margin-bottom: 20px; border-radius: 8px; font-weight: 600;';
        banner.innerHTML = `🎉 Special Offer: Premium access is now FREE for everyone! Enjoy all features while this promotion lasts.`;
        banner.setAttribute('data-component', 'premium-promotion-banner');
        
        const mainContent = document.querySelector('main') || document.body;
        if (mainContent.firstChild) {
          mainContent.insertBefore(banner, mainContent.firstChild);
        }
      }
      
      // Grant all users premium features
      localStorage.setItem('isPremium', 'true');
      window.userPremium = true;
    } else {
      console.log('💳 Removing premium promotion');
      
      // Remove promotion banner if it exists
      const banner = document.querySelector('[data-component="premium-promotion-banner"]');
      if (banner) {
        console.log('🗑️ Removing promotion banner');
        banner.remove();
      }
      
      // Restore upgrade buttons
      const upgradeBtns = document.querySelectorAll('[data-action="upgrade-premium"][data-hidden-by-promotion="true"]');
      upgradeBtns.forEach(btn => {
        btn.style.display = '';
        btn.removeAttribute('data-hidden-by-promotion');
      });
      
      window.premiumForAll = false;
      localStorage.removeItem('isPremium');
      window.userPremium = false;
    }
  }

  /**
   * Show maintenance mode screen blocking all access
   */
  showMaintenanceMode(message = '') {
    // Hide entire app
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
    
    const container = document.createElement('div');
    container.style.cssText = 'background: white; padding: 60px 40px; border-radius: 12px; text-align: center; max-width: 600px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);';
    container.innerHTML = `
      <div style="margin-bottom: 20px; font-size: 60px;">🚧</div>
      <h1 style="margin: 0 0 10px 0; color: #333; font-size: 32px;">Maintenance Mode</h1>
      <p style="color: #666; font-size: 16px; margin: 10px 0 20px 0;">We're currently performing scheduled maintenance.</p>
      ${message ? `<div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #667eea; border-radius: 4px; text-align: left; color: #444; margin: 20px 0;">${message}</div>` : ''}
      <p style="color: #999; font-size: 14px; margin-top: 20px;">Please check back shortly. Thank you for your patience!</p>
    `;
    
    document.body.appendChild(container);
  }

  /**
   * Stop auto-refresh
   */
  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

// Auto-initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  if (!window.settingsApplier) {
    window.settingsApplier = new SettingsApplier();
    window.settingsApplier.init();
  }
});

console.log('✅ Settings Applier module loaded');
