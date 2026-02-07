/**
 * Settings Applier - Applies platform settings across the site
 * Reads from the PlatformSettings collection and enforces all behaviors
 */

class SettingsApplier {
  constructor() {
    this.settings = null;
    this.checkInterval = null;
    this.lastAppliedSettings = null;
    
    // Initialize default window variables immediately
    window.aiEnabled = true; // Default: AI is enabled
    window.aiAccessMode = 'Premium Only'; // Default: Premium only
    window.aiRestrictedToPremium = true;
  }

  /**
   * Initialize and load settings, apply them, set up auto-refresh
   */
  async init() {
    console.log('⚙️ Initializing Settings Applier...');
    
    // Load settings on init
    await this.loadAndApply();
    
    // Refresh settings every 5 seconds to catch admin changes
    this.checkInterval = setInterval(() => {
      this.loadAndApply();
    }, 5000);
    
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

      const newSettings = await response.json();
      console.log('📥 Settings loaded from public API:', newSettings);
      
      // Check if settings have changed (including removals and disables)
      if (this.lastAppliedSettings && this.hasSettingsChanged(this.lastAppliedSettings, newSettings)) {
        const differences = this.getSettingsDifferences(this.lastAppliedSettings, newSettings);
        console.log('🔄 Settings have changed! Detected changes:', differences);
        this.settings = newSettings;
        this.lastAppliedSettings = JSON.parse(JSON.stringify(newSettings)); // Deep copy for comparison
        await this.applySettings();
        
        // Auto-refresh page to apply changes (but skip admin dashboard)
        // Refresh on ANY change: enabled, disabled, or removed
        if (!window.location.pathname.includes('/admin')) {
          console.log('🌀 Auto-refreshing page to apply setting changes...');
          setTimeout(() => {
            window.location.reload();
          }, 800);
        }
      } else if (!this.lastAppliedSettings) {
        // First load - just apply without refresh
        this.settings = newSettings;
        this.lastAppliedSettings = JSON.parse(JSON.stringify(newSettings));
        await this.applySettings();
      }
    } catch (err) {
      console.warn('⚠️ Error loading settings:', err.message);
    }
  }

  /**
   * Check if settings have changed
   */
  hasSettingsChanged(oldSettings, newSettings) {
    if (!oldSettings || !newSettings) return false;
    return JSON.stringify(oldSettings) !== JSON.stringify(newSettings);
  }

  /**
   * Get specific differences between settings
   */
  getSettingsDifferences(oldSettings, newSettings) {
    const differences = {};
    for (const key in newSettings) {
      if (JSON.stringify(oldSettings[key]) !== JSON.stringify(newSettings[key])) {
        differences[key] = { old: oldSettings[key], new: newSettings[key] };
      }
    }
    return differences;
  }

  /**
   * Main function to apply all settings
   */
  async applySettings() {
    if (!this.settings) {
      console.warn('⚠️ No settings available to apply');
      return;
    }

    console.log('🔄 Applying all settings...');
    console.log('   maintenanceMode:', this.settings.maintenanceMode);
    console.log('   enablePremiumForAll:', this.settings.enablePremiumForAll);
    console.log('   premiumPromotionEndAt:', this.settings.premiumPromotionEndAt);
    console.log('   enableNewsSystem:', this.settings.enableNewsSystem);
    console.log('   enableLikesReactions:', this.settings.enableLikesReactions);
    console.log('   enableAiAssistant:', this.settings.enableAiAssistant);
    console.log('   aiAccessMode:', this.settings.aiAccessMode);
    console.log('   allowNewUserRegistration:', this.settings.allowNewUserRegistration);

    // Apply platform settings
    this.applyPlatformSettings();
    // Apply certificate settings
    this.applyCertificateSettings();
    
    // Apply news & careers settings
    this.applyNewsCareerSettings();
    
    // Apply AI assistant settings - await to catch auto-disable
    await this.applyAiSettings();
    
    // Apply premium/trial settings - await to catch auto-disable
    await this.applyPremiumSettings();
    
    console.log('✅ All settings applied');
    
    // Trigger UI update to show/hide AI button and other controls
    if (typeof window.updateNavUI === 'function') {
      console.log('🔄 Triggering updateNavUI to refresh UI controls');
      window.updateNavUI();
    }
  }

  /**
   * Platform settings: Site name, maintenance mode, registration, timezone
   */
  applyPlatformSettings() {
    const s = this.settings;
    
    console.log('🔧 Applying platform settings...');

    // Maintenance Mode - Block access entirely
    if (s.maintenanceMode === true) {
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
      console.log('🚫 Registration DISABLED');
      this.disableRegistration();
    } else {
      console.log('✅ Registration ENABLED');
      this.enableRegistration();
    }

    // Default Timezone (store for user settings)
    if (s.defaultTimezone) {
      window.platformTimezone = s.defaultTimezone;
      console.log('🕐 Timezone set to:', s.defaultTimezone);
    }
  }

  /**
   * Disable user registration
   */
  disableRegistration() {
    // Block access to register.html entirely
    if (window.location.pathname.includes('register.html')) {
      // Redirect to home with message
      window.location.href = 'index.html?registration_disabled=true';
      return;
    }

    // Hide all register navigation links
    const navRegisterLinks = document.querySelectorAll('#nav-register-link, a[href*="register.html"]');
    navRegisterLinks.forEach(link => {
      link.style.display = 'none';
      link.setAttribute('data-disabled-by-settings', 'true');
      console.log('✓ Register link hidden:', link.href);
    });

    // Show notice on register page if somehow loaded
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.style.display = 'none';
      console.log('✓ Register form hidden');
      
      // Show closure notice
      const formSection = registerForm.closest('.form-section');
      if (formSection) {
        const existingNotice = formSection.querySelector('[data-component="registration-disabled-notice"]');
        if (!existingNotice) {
          const notice = document.createElement('div');
          notice.setAttribute('data-component', 'registration-disabled-notice');
          notice.style.cssText = 'padding: 40px 20px; text-align: center; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; margin: 40px 0;';
          notice.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 16px;">🔐</div>
            <h2 style="color: #333; margin: 0 0 10px 0; font-size: 24px;">Registration Closed</h2>
            <p style="color: #666; margin: 0 0 15px 0; font-size: 16px;">New user registration is currently disabled by the administrator.</p>
            <p style="color: #666; margin: 0; font-size: 14px;">Please contact support for assistance or try again later.</p>
          `;
          formSection.insertBefore(notice, registerForm);
        }
      }
    }

    console.log('✓ Registration DISABLED');
  }

  /**
   * Enable user registration
   */
  enableRegistration() {
    // Show all register navigation links
    const navRegisterLinks = document.querySelectorAll('#nav-register-link[data-disabled-by-settings="true"], a[href*="register.html"][data-disabled-by-settings="true"]');
    navRegisterLinks.forEach(link => {
      link.style.display = '';
      link.removeAttribute('data-disabled-by-settings');
      console.log('✓ Register link shown:', link.href);
    });

    // Show register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.style.display = '';
      console.log('✓ Register form shown');
      
      // Remove closure notice if exists
      const formSection = registerForm.closest('.form-section');
      if (formSection) {
        const notice = formSection.querySelector('[data-component="registration-disabled-notice"]');
        if (notice) {
          notice.remove();
          console.log('✓ Registration disabled notice removed');
        }
      }
    }

    console.log('✓ Registration ENABLED');
  }

  /**
   * Certificate settings: Generation toggle, pass percentage, re-download
   */
  applyCertificateSettings() {
    const s = this.settings;
    
    console.log('🎓 Applying certificate settings...');
    console.log('   enableCertificateGeneration:', s.enableCertificateGeneration);
    console.log('   allowCertificateRedownload:', s.allowCertificateRedownload);
    
    // Expose settings to window so pages can check them
    window.enableCertificateGeneration = s.enableCertificateGeneration !== false;
    window.allowCertificateRedownload = s.allowCertificateRedownload !== false;
    
    console.log('  ✓ Certificate settings exposed to window');
    console.log('   window.enableCertificateGeneration:', window.enableCertificateGeneration);
    console.log('   window.allowCertificateRedownload:', window.allowCertificateRedownload);

    // Minimum pass percentage - store for backend use
    if (s.minimumQuizPassPercentage) {
      window.minimumPassPercentage = s.minimumQuizPassPercentage;
      console.log('  ✓ Min pass percentage set to:', s.minimumQuizPassPercentage);
    }
  }

  /**
   * News & Careers settings: System toggles and PDF downloads
   */
  applyNewsCareerSettings() {
    const s = this.settings;
    
    console.log('📰 Applying News & Careers settings...');
    console.log('   enableNewsSystem:', s.enableNewsSystem, 'type:', typeof s.enableNewsSystem);
    console.log('   enableLikesReactions:', s.enableLikesReactions, 'type:', typeof s.enableLikesReactions);
    
    // DEBUG: Always try to find and log engagement section
    const engagementSection = document.getElementById('engagementSection');
    console.log('   #engagementSection exists?', !!engagementSection, 'element:', engagementSection);
    if (engagementSection) {
      console.log('   #engagementSection display:', engagementSection.style.display);
      console.log('   #engagementSection computed display:', window.getComputedStyle(engagementSection).display);
    }

    // News System Toggle
    if (s.enableNewsSystem === false) {
      console.log('  ✓ News system DISABLED');
      
      // Add CSS rules to hide all news-related elements permanently
      this.addCSSRule('a[href="news.html"]', 'display: none !important;');
      this.addCSSRule('a[href*="/news.html"]', 'display: none !important;');
      this.addCSSRule('.news-list', 'display: none !important;');
      this.addCSSRule('#newsList', 'display: none !important;');
      this.addCSSRule('#pagination', 'display: none !important;');
      this.addCSSRule('.news-container', 'display: none !important;');
      this.addCSSRule('.sort-controls', 'display: none !important;');
      
      // Hide news links immediately
      document.querySelectorAll('a[href="news.html"], a[href*="/news.html"]').forEach(link => {
        link.style.display = 'none';
        link.setAttribute('data-disabled-by-settings', 'true');
      });
      
      // Hide news content if it exists
      const newsList = document.getElementById('newsList');
      if (newsList) {
        newsList.style.display = 'none';
        newsList.setAttribute('data-disabled-by-settings', 'true');
      }
      const pagination = document.getElementById('pagination');
      if (pagination) {
        pagination.style.display = 'none';
        pagination.setAttribute('data-disabled-by-settings', 'true');
      }
      const newsContainer = document.querySelector('.news-container');
      if (newsContainer) {
        newsContainer.style.display = 'none';
        newsContainer.setAttribute('data-disabled-by-settings', 'true');
      }
      
      // If currently on news page, redirect or show notice
      if (window.location.pathname.includes('/news') && !window.location.pathname.includes('/news-detail')) {
        // On news.html listing page
        console.log('  📍 Currently on news page, redirecting to home');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 500);
      } else if (window.location.pathname.includes('news')) {
        // Show notice
        const main = document.querySelector('main');
        if (main) {
          const existingNotice = document.querySelector('[data-component="news-disabled-notice"]');
          if (!existingNotice) {
            const notice = document.createElement('div');
            notice.setAttribute('data-component', 'news-disabled-notice');
            notice.style.cssText = 'padding: 40px 20px; text-align: center; background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; margin: 40px; min-height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center;';
            notice.innerHTML = `
              <div style="font-size: 48px; margin-bottom: 16px;">📰</div>
              <h2 style="color: #333; margin: 0 0 10px 0; font-size: 24px;">News Disabled</h2>
              <p style="color: #666; margin: 0 0 15px 0; font-size: 16px;">The news system is currently disabled by the administrator.</p>
              <p style="color: #666; margin: 0; font-size: 14px;">Please check back later.</p>
            `;
            main.innerHTML = '';
            main.appendChild(notice);
          }
        }
      }
      
      console.log('  ✓ News system hidden and CSS rules applied');
    } else {
      console.log('  ✓ News system ENABLED');
      
      // Remove CSS rules
      this.removeCSSRule('a[href="news.html"]');
      this.removeCSSRule('a[href*="/news.html"]');
      this.removeCSSRule('.news-list');
      this.removeCSSRule('#newsList');
      this.removeCSSRule('#pagination');
      this.removeCSSRule('.news-container');
      this.removeCSSRule('.sort-controls');
      
      // Show news page and links
      document.querySelectorAll('a[href="news.html"][data-disabled-by-settings="true"], a[href*="/news.html"][data-disabled-by-settings="true"]').forEach(link => {
        link.style.display = '';
        link.removeAttribute('data-disabled-by-settings');
      });
      
      // Show news list and pagination
      const newsList = document.getElementById('newsList');
      if (newsList && newsList.getAttribute('data-disabled-by-settings') === 'true') {
        newsList.style.display = '';
        newsList.removeAttribute('data-disabled-by-settings');
      }
      const pagination = document.getElementById('pagination');
      if (pagination && pagination.getAttribute('data-disabled-by-settings') === 'true') {
        pagination.style.display = '';
        pagination.removeAttribute('data-disabled-by-settings');
      }
      const newsContainer = document.querySelector('.news-container');
      if (newsContainer && newsContainer.getAttribute('data-disabled-by-settings') === 'true') {
        newsContainer.style.display = '';
        newsContainer.removeAttribute('data-disabled-by-settings');
      }
      
      // Remove notice if it exists
      const notice = document.querySelector('[data-component="news-disabled-notice"]');
      if (notice) notice.remove();
      
      console.log('  ✓ News system shown and CSS rules removed');
    }

    // Likes & Reactions Toggle
    if (s.enableLikesReactions === false) {
      console.log('  ✓ Likes/Reactions DISABLED - hiding engagement section');
      
      // Set window variable so page JS can check this setting
      window.enableLikesReactions = false;
      console.log('  ✓ window.enableLikesReactions =', window.enableLikesReactions);
      
      // Add CSS rules to hide all like/reaction elements permanently
      this.addCSSRule('#engagementSection', 'display: none !important;');
      this.addCSSRule('#likeSection', 'display: none !important;');
      this.addCSSRule('.like-btn', 'display: none !important;');
      this.addCSSRule('#likeBtn', 'display: none !important;');
      this.addCSSRule('#reactionsContainer', 'display: none !important;');
      this.addCSSRule('.reaction-btn', 'display: none !important;');
      this.addCSSRule('.engagement-buttons', 'display: none !important;');
      
      // Also hide them immediately if they exist with inline styles (stronger)
      const engagementSection = document.getElementById('engagementSection');
      if (engagementSection) {
        engagementSection.style.cssText = 'display: none !important;';
        engagementSection.setAttribute('data-disabled-by-settings', 'true');
        console.log('  ✓ Engagement section hidden via inline style');
      }
      
      // Hide individual elements as fallback
      document.querySelectorAll('#likeSection, #likeBtn, .like-btn, #reactionsContainer, .reaction-btn, .engagement-buttons').forEach(el => {
        el.style.cssText = 'display: none !important;';
        el.setAttribute('data-disabled-by-settings', 'true');
      });
      
      // Setup MutationObserver to keep engagement section hidden as it's modified
      if (!this.engagementObserver) {
        console.log('  📍 Setting up MutationObserver for engagement section');
        const observerCallback = () => {
          const engagementSection = document.getElementById('engagementSection');
          if (engagementSection && engagementSection.style.display !== 'none') {
            console.log('  🔄 Re-hiding engagement section (was modified)');
            engagementSection.style.cssText = 'display: none !important;';
          }
        };
        
        this.engagementObserver = new MutationObserver(observerCallback);
        if (engagementSection) {
          this.engagementObserver.observe(engagementSection, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeFilter: ['style', 'class']
          });
          console.log('  ✓ MutationObserver started');
        }
      }
      
      console.log('  ✓ All reaction elements hidden');
    } else {
      console.log('  ✓ Likes/Reactions ENABLED');
      
      // Set window variable so page JS knows it's enabled
      window.enableLikesReactions = true;
      console.log('  ✓ window.enableLikesReactions =', window.enableLikesReactions);
      
      // Stop observer
      if (this.engagementObserver) {
        this.engagementObserver.disconnect();
        this.engagementObserver = null;
        console.log('  ✓ MutationObserver stopped');
      }
      
      // Remove CSS rules
      this.removeCSSRule('#engagementSection');
      this.removeCSSRule('#likeSection');
      this.removeCSSRule('.like-btn');
      this.removeCSSRule('#likeBtn');
      this.removeCSSRule('#reactionsContainer');
      this.removeCSSRule('.reaction-btn');
      this.removeCSSRule('.engagement-buttons');
      
      // Show engagement section
      const engagementSection = document.getElementById('engagementSection');
      if (engagementSection && engagementSection.getAttribute('data-disabled-by-settings') === 'true') {
        engagementSection.style.cssText = '';
        engagementSection.removeAttribute('data-disabled-by-settings');
        console.log('  ✓ Engagement section shown');
      }
      
      // Show individual elements
      document.querySelectorAll('#likeSection[data-disabled-by-settings="true"], #likeBtn[data-disabled-by-settings="true"], .like-btn[data-disabled-by-settings="true"], #reactionsContainer[data-disabled-by-settings="true"], .reaction-btn[data-disabled-by-settings="true"], .engagement-buttons[data-disabled-by-settings="true"]').forEach(el => {
        el.style.cssText = '';
        el.removeAttribute('data-disabled-by-settings');
      });
      
      console.log('  ✓ Reaction elements shown');
    }

    // Careers Page Toggle
    if (s.enableCareersPage === false) {
      console.log('  ✓ Careers page DISABLED');
      const careersLinks = document.querySelectorAll('a[href*="careers"], a[href*="career"]');
      careersLinks.forEach(link => {
        link.style.display = 'none';
        link.setAttribute('data-disabled-by-settings', 'true');
      });
      this.hideElement('[data-section="careers"], #careers-section');
    } else {
      console.log('  ✓ Careers page ENABLED');
      const careersLinks = document.querySelectorAll('a[href*="careers"][data-disabled-by-settings="true"], a[href*="career"][data-disabled-by-settings="true"]');
      careersLinks.forEach(link => {
        link.style.display = '';
        link.removeAttribute('data-disabled-by-settings');
      });
      this.showElement('[data-section="careers"][data-disabled-by-settings="true"], #careers-section[data-disabled-by-settings="true"]');
    }

    // PDF Downloads from Careers Toggle
    if (s.allowCareersPdfDownload === false) {
      console.log('  ✓ Careers PDF downloads DISABLED');
      const pdfDownloads = document.querySelectorAll('[data-action="download-pdf"], .pdf-download-btn');
      pdfDownloads.forEach(btn => {
        btn.style.display = 'none';
        btn.setAttribute('data-disabled-by-settings', 'true');
      });
    } else {
      console.log('  ✓ Careers PDF downloads ENABLED');
      const pdfDownloads = document.querySelectorAll('[data-action="download-pdf"][data-disabled-by-settings="true"], .pdf-download-btn[data-disabled-by-settings="true"]');
      pdfDownloads.forEach(btn => {
        btn.style.display = '';
        btn.removeAttribute('data-disabled-by-settings');
      });
    }
  }

  /**
   * AI Assistant settings: Enable/disable, access mode, limits, notice
   */
  async applyAiSettings() {
    const s = this.settings;
    
    console.log('🤖 Applying AI Assistant settings...');
    console.log('   Input: enableAiAssistant=%s, aiAccessMode=%s', s.enableAiAssistant, s.aiAccessMode);

    // CHECK: Auto-disable AI promotion if time has expired
    if (s.aiAccessMode === 'Everyone' && s.aiPromotionDurationValue && s.aiPromotionDurationValue > 0) {
      // Calculate what the end time should be
      let expectedEndTime = null;
      if (s.aiPromotionStartedAt) {
        const startTime = new Date(s.aiPromotionStartedAt).getTime();
        const duration = parseInt(s.aiPromotionDurationValue, 10) || 7;
        const unit = s.aiPromotionDurationUnit || 'days';
        let durationMs = 0;
        
        if (unit === 'minutes') durationMs = duration * 60 * 1000;
        else if (unit === 'hours') durationMs = duration * 60 * 60 * 1000;
        else if (unit === 'days') durationMs = duration * 24 * 60 * 60 * 1000;
        
        expectedEndTime = startTime + durationMs;
      }
      
      // If time has passed, auto-disable the promotion
      if (expectedEndTime && Date.now() >= expectedEndTime) {
        console.log('⏰ AI promotion expired at', new Date(expectedEndTime).toLocaleString(), '- auto-disabling...');
        await this.autoDisableAiPromotion();
        return; // Don't continue applying the expired promotion
      }
    }

    // Disable AI entirely
    if (s.enableAiAssistant === false) {
      console.log('  ❌ AI Assistant DISABLED - not showing button');
      window.aiEnabled = false;
      this.hideElement('[data-section="ai"], #ai-section, [data-action="open-ai"]');
      return;
    }

    console.log('  ✅ AI Assistant ENABLED');
    window.aiEnabled = true;
    this.showElement('[data-section="ai"], #ai-section, [data-action="open-ai"]');

    // AI Access Mode
    const accessMode = s.aiAccessMode || 'Premium Only';
    window.aiAccessMode = accessMode;
    console.log('  📋 Setting window.aiAccessMode to:', accessMode);
    
    if (accessMode === 'Everyone' || accessMode === 'Everyone (Promotion)') {
      console.log('  🎉 AI PROMOTION MODE ACTIVE - Everyone gets access when logged in');
      window.aiRestrictedToPremium = false;
      
      // Calculate AI promotion end time - EXACTLY LIKE PREMIUM PROMOTION
      let aiPromotionEndTime = null;
      if (s.aiPromotionDurationValue) {
        const duration = parseInt(s.aiPromotionDurationValue, 10) || 7;
        const unit = s.aiPromotionDurationUnit || 'days';
        const now = Date.now();
        let durationMs = 0;
        
        if (unit === 'minutes') durationMs = duration * 60 * 1000;
        else if (unit === 'hours') durationMs = duration * 60 * 60 * 1000;
        else if (unit === 'days') durationMs = duration * 24 * 60 * 60 * 1000;
        
        aiPromotionEndTime = now + durationMs;
      }
      
      window.aiPromotionEndTime = aiPromotionEndTime;
      const endDate = aiPromotionEndTime ? new Date(aiPromotionEndTime).toLocaleString() : '';
      console.log('  ✓ AI Promotion end time:', endDate);
      
      // Show AI promotion banner with end date
      this.showAiPromotionBanner(endDate);
      
      // Remove upsell if it exists
      const upsell = document.querySelector('[data-component="ai-upsell"]');
      if (upsell) {
        console.log('  🗑️ Removing premium upsell');
        upsell.remove();
      }
      
      // Show AI interface
      const aiInterface = document.querySelector('[data-component="ai-chat"]');
      if (aiInterface) {
        aiInterface.style.display = '';
      }
    } else if (accessMode === 'Premium Only') {
      console.log('  🔐 AI PREMIUM ONLY MODE - restricted to premium users');
      window.aiRestrictedToPremium = true;
      window.aiPromotionEndTime = null;
      
      // Remove AI promotion banner if it exists
      const aiBanner = document.querySelector('[data-component="ai-promotion-banner"]');
      if (aiBanner) {
        aiBanner.remove();
      }
      
      // Clear banner dismissal state since promotion ended
      sessionStorage.removeItem('ai-promotion-banner-dismissed');
      console.log('  ✓ Cleared AI banner dismissal state');
      
      const userRole = localStorage.getItem('userRole');
      const isPremium = localStorage.getItem('isPremium') === 'true';
      
      if (userRole === 'user' && !isPremium) {
        const aiInterface = document.querySelector('[data-component="ai-chat"]');
        if (aiInterface) {
          aiInterface.style.display = 'none';
          const existingUpsell = document.querySelector('[data-component="ai-upsell"]');
          if (!existingUpsell) {
            const upsell = document.createElement('div');
            upsell.setAttribute('data-component', 'ai-upsell');
            upsell.style.cssText = 'padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; margin: 20px 0; text-align: center;';
            upsell.innerHTML = '<h3 style="margin: 0 0 10px 0;">Upgrade to Premium</h3><p style="margin: 0 0 15px 0;">AI Assistant is available for premium members only.</p><button class="btn-primary" onclick="navigateToPremium()" style="background: white; color: #764ba2; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;">Upgrade Now</button>';
            aiInterface.parentNode.insertBefore(upsell, aiInterface);
          }
        }
      }
    }

    // Daily question limit
    if (s.aiDailyQuestionLimit) {
      window.aiDailyQuestionLimit = s.aiDailyQuestionLimit;
      console.log('  ✓ AI daily question limit set to:', s.aiDailyQuestionLimit);
    }

    // Show beta notice
    if (s.showAiBetaNotice === true) {
      console.log('  ✓ AI Beta notice SHOWN');
      const betaBadge = document.querySelector('[data-component="ai-beta-badge"]');
      if (betaBadge) betaBadge.style.display = 'inline-block';
    } else {
      console.log('  ✓ AI Beta notice HIDDEN');
      const betaBadge = document.querySelector('[data-component="ai-beta-badge"]');
      if (betaBadge) betaBadge.style.display = 'none';
    }
  }

  /**
   * Premium & Trial settings: System toggle, trial duration, promotions
   */
  async applyPremiumSettings() {
    const s = this.settings;
    
    console.log('💎 Applying Premium settings...');

    // CHECK: Auto-disable premium promotion if time has expired
    if (s.enablePremiumForAll === true && s.premiumPromotionDurationValue && s.premiumPromotionDurationValue > 0) {
      // Calculate what the end time should be
      let expectedEndTime = null;
      if (s.premiumPromotionStartAt) {
        const startTime = new Date(s.premiumPromotionStartAt).getTime();
        const duration = parseInt(s.premiumPromotionDurationValue, 10) || 7;
        const unit = s.premiumPromotionDurationUnit || 'days';
        let durationMs = 0;
        
        if (unit === 'minutes') durationMs = duration * 60 * 1000;
        else if (unit === 'hours') durationMs = duration * 60 * 60 * 1000;
        else if (unit === 'days') durationMs = duration * 24 * 60 * 60 * 1000;
        
        expectedEndTime = startTime + durationMs;
      }
      
      // If time has passed, auto-disable the promotion
      if (expectedEndTime && Date.now() >= expectedEndTime) {
        console.log('⏰ Premium promotion expired at', new Date(expectedEndTime).toLocaleString(), '- auto-disabling...');
        await this.autoDisablePremiumPromotion();
        return; // Don't continue applying the expired promotion
      }
    }

    // Disable premium system entirely
    if (s.enablePremiumSystem === false) {
      console.log('  ✓ Premium system DISABLED');
      window.premiumEnabled = false;
      
      // Hide premium button and billing access
      this.hideElement('#nav-premium-btn, .nav-premium-link, [data-action="upgrade-premium"], [data-section="premium"], #premium-section, a[href*="billing.html"]');
      
      // Block access to billing.html
      if (window.location.pathname.includes('billing.html')) {
        window.location.href = 'index.html?premium_disabled=true';
        return;
      }
      
      console.log('  ✓ Premium system hidden');
      return;
    }

    console.log('  ✓ Premium system ENABLED');
    window.premiumEnabled = true;
    this.showElement('#nav-premium-btn, .nav-premium-link, [data-action="upgrade-premium"], [data-section="premium"], #premium-section, a[href*="billing.html"]');

    // Free trial duration
    if (s.freeTrialDurationDays) {
      window.freeTrialDays = s.freeTrialDurationDays;
      console.log('  ✓ Free trial duration set to:', s.freeTrialDurationDays, 'days');
    }

    // Premium for all (promotion)
    if (s.enablePremiumForAll === true) {
      console.log('  ✓ PREMIUM FOR ALL PROMOTION ACTIVE');
      window.premiumForAll = true;
      
      // Calculate promotion end time
      // Use premiumPromotionEndAt if available (from backend), otherwise calculate from duration
      let promotionEndTime = s.premiumPromotionEndAt;
      if (!promotionEndTime && s.premiumPromotionDurationValue) {
        const duration = parseInt(s.premiumPromotionDurationValue, 10) || 7;
        const unit = s.premiumPromotionDurationUnit || 'days';
        const now = Date.now();
        let durationMs = 0;
        
        if (unit === 'minutes') durationMs = duration * 60 * 1000;
        else if (unit === 'hours') durationMs = duration * 60 * 60 * 1000;
        else if (unit === 'days') durationMs = duration * 24 * 60 * 60 * 1000;
        
        promotionEndTime = now + durationMs;
      }
      
      window.promotionEndTime = promotionEndTime;
      const endDate = new Date(promotionEndTime).toLocaleString();
      console.log('  ✓ Promotion end time:', endDate);
      
      // Hide upgrade buttons and links - users don't need to upgrade during promotion
      const upgradeBtns = document.querySelectorAll('#nav-premium-btn, .nav-premium-link, [data-action="upgrade-premium"]');
      upgradeBtns.forEach(btn => {
        btn.style.display = 'none';
        btn.setAttribute('data-disabled-by-settings', 'true');
      });
      
      // Hide billing.html links during promotion
      this.addCSSRule('a[href*="billing.html"]', 'display: none !important;');
      
      // Show promotion banner if not already present and not dismissed
      const isDismissed = sessionStorage.getItem('promotion-banner-dismissed') === 'true';
      const existingBanner = document.querySelector('[data-component="premium-promotion-banner"]');
      if (!existingBanner && !isDismissed) {
        const banner = document.createElement('div');
        banner.setAttribute('data-component', 'premium-promotion-banner');
        banner.style.cssText = `
          padding: 16px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
          margin-bottom: 20px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
        `;
        
        // Create dismiss button
        const dismissBtn = document.createElement('button');
        dismissBtn.innerHTML = '✕';
        dismissBtn.style.cssText = `
          position: absolute;
          right: 12px;
          top: 12px;
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          font-size: 18px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          padding: 0;
        `;
        dismissBtn.onmouseover = () => { dismissBtn.style.background = 'rgba(255,255,255,0.3)'; dismissBtn.style.transform = 'scale(1.1)'; };
        dismissBtn.onmouseout = () => { dismissBtn.style.background = 'rgba(255,255,255,0.2)'; dismissBtn.style.transform = 'scale(1)'; };
        dismissBtn.onclick = () => {
          banner.style.display = 'none';
          // Remember dismissal for this session
          sessionStorage.setItem('promotion-banner-dismissed', 'true');
          console.log('📌 Banner dismissed - will stay hidden until browser closes');
        };
        
        banner.innerHTML = `🎉 <strong>Special Offer:</strong> Premium access is FREE for everyone! Enjoy all features until ${endDate}`;
        banner.appendChild(dismissBtn);
        
        const mainContent = document.querySelector('main') || document.body;
        if (mainContent.firstChild) {
          mainContent.insertBefore(banner, mainContent.firstChild);
        } else {
          mainContent.appendChild(banner);
        }
      } else if (isDismissed) {
        console.log('📌 Banner dismissed - skipping display');
      }
      
      console.log('  ✓ Premium for all promotion enabled');
    } else {
      console.log('  ✓ Premium for all DISABLED');
      window.premiumForAll = false;
      window.promotionEndTime = null;
      
      // Remove promotion banner
      const banner = document.querySelector('[data-component="premium-promotion-banner"]');
      if (banner) {
        banner.remove();
        console.log('  ✓ Removed promotion banner');
      }
      
      // Clear dismissal state since promotion ended
      sessionStorage.removeItem('promotion-banner-dismissed');
      console.log('  ✓ Cleared banner dismissal state');
      
      // Remove billing.html hiding CSS rule
      this.removeCSSRule('a[href*="billing.html"]');
      
      // Show upgrade buttons
      const upgradeBtns = document.querySelectorAll('#nav-premium-btn[data-disabled-by-settings="true"], .nav-premium-link[data-disabled-by-settings="true"], [data-action="upgrade-premium"][data-disabled-by-settings="true"]');
      upgradeBtns.forEach(btn => {
        btn.style.display = '';
        btn.removeAttribute('data-disabled-by-settings');
      });
      
      console.log('  ✓ Premium for all promotion disabled');
    }
  }

  /**
   * Helper to hide elements
   */
  hideElement(selector) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      el.style.display = 'none';
      el.setAttribute('data-disabled-by-settings', 'true');
    });
  }

  /**
   * Helper to show elements
   */
  showElement(selector) {
    const elements = document.querySelectorAll(selector + '[data-disabled-by-settings="true"]');
    elements.forEach(el => {
      el.style.display = '';
      el.removeAttribute('data-disabled-by-settings');
    });
  }

  /**
   * Add a CSS rule to the global stylesheet for persistent hiding
   */
  addCSSRule(selector, declaration) {
    if (!this.settingsStyleSheet) {
      // Create a style element if it doesn't exist
      const style = document.createElement('style');
      style.id = 'settings-applier-styles';
      document.head.appendChild(style);
      this.settingsStyleSheet = style.sheet;
    }
    
    try {
      this.settingsStyleSheet.insertRule(`${selector} { ${declaration} }`, this.settingsStyleSheet.cssRules.length);
      console.log(`  📋 CSS rule added: ${selector}`);
    } catch (e) {
      console.warn(`  ⚠️ Failed to add CSS rule for ${selector}:`, e.message);
    }
  }

  /**
   * Remove a CSS rule from the global stylesheet
   */
  removeCSSRule(selector) {
    if (!this.settingsStyleSheet) return;
    
    try {
      const rules = Array.from(this.settingsStyleSheet.cssRules);
      const ruleIndex = rules.findIndex(rule => rule.selectorText === selector);
      
      if (ruleIndex >= 0) {
        this.settingsStyleSheet.deleteRule(ruleIndex);
        console.log(`  📋 CSS rule removed: ${selector}`);
      }
    } catch (e) {
      console.warn(`  ⚠️ Failed to remove CSS rule for ${selector}:`, e.message);
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
   * Auto-disable premium promotion when it expires
   */
  async autoDisablePremiumPromotion() {
    try {
      console.log('🔄 Auto-disabling premium promotion...');
      const response = await fetch('/api/settings/premium-trial', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enablePremiumForAll: false
        })
      });
      
      if (response.ok) {
        console.log('✅ Premium promotion auto-disabled successfully');
        // Update admin dashboard if it's open
        const premiumForAllCheckbox = document.getElementById('enablePremiumForAll');
        if (premiumForAllCheckbox) {
          premiumForAllCheckbox.checked = false;
          const promotionGroup = document.getElementById('premiumPromotionGroup');
          if (promotionGroup) promotionGroup.style.display = 'none';
          console.log('✅ Admin dashboard updated');
        }
        // Reload page after a short delay to reflect changes
        setTimeout(() => {
          console.log('🔄 Reloading page due to promotion expiration...');
          window.location.reload();
        }, 1000);
      } else {
        console.warn('⚠️ Failed to auto-disable premium promotion:', await response.text());
      }
    } catch (err) {
      console.error('❌ Error auto-disabling premium promotion:', err);
    }
  }

  /**
   * Auto-disable AI promotion when it expires
   */
  async autoDisableAiPromotion() {
    try {
      console.log('🔄 Auto-disabling AI promotion...');
      const response = await fetch('/api/settings/ai-assistant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiAccessMode: 'Premium Only'
        })
      });
      
      if (response.ok) {
        console.log('✅ AI promotion auto-disabled successfully');
        // Update admin dashboard if it's open
        const aiAccessModeSelect = document.getElementById('aiAccessMode');
        if (aiAccessModeSelect) {
          aiAccessModeSelect.value = 'Premium Only';
          const aiPromotionGroup = document.getElementById('aiPromotionGroup');
          if (aiPromotionGroup) aiPromotionGroup.style.display = 'none';
          console.log('✅ Admin dashboard updated');
        }
        // Reload page after a short delay to reflect changes
        setTimeout(() => {
          console.log('🔄 Reloading page due to promotion expiration...');
          window.location.reload();
        }, 1000);
      } else {
        console.warn('⚠️ Failed to auto-disable AI promotion:', await response.text());
      }
    } catch (err) {
      console.error('❌ Error auto-disabling AI promotion:', err);
    }
  }

  /**
   * Show AI promotion banner when Everyone (Promotion) mode is active
   */
  showAiPromotionBanner(endDate = '') {
    try {
      // Check if already dismissed in this session - EXACT SAME PATTERN as premium
      const isDismissed = sessionStorage.getItem('ai-promotion-banner-dismissed') === 'true';
      const existingBanner = document.querySelector('[data-component="ai-promotion-banner"]');
      if (!existingBanner && !isDismissed) {
        const banner = document.createElement('div');
        banner.setAttribute('data-component', 'ai-promotion-banner');
        banner.style.cssText = `
          padding: 16px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
          margin-bottom: 20px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
        `;
        
        // Create dismiss button - EXACT COPY of premium banner button
        const dismissBtn = document.createElement('button');
        dismissBtn.innerHTML = '✕';
        dismissBtn.style.cssText = `
          position: absolute;
          right: 12px;
          top: 12px;
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          font-size: 18px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          padding: 0;
        `;
        dismissBtn.onmouseover = () => { dismissBtn.style.background = 'rgba(255,255,255,0.3)'; dismissBtn.style.transform = 'scale(1.1)'; };
        dismissBtn.onmouseout = () => { dismissBtn.style.background = 'rgba(255,255,255,0.2)'; dismissBtn.style.transform = 'scale(1)'; };
        dismissBtn.onclick = () => {
          banner.style.display = 'none';
          // Remember dismissal for this session
          sessionStorage.setItem('ai-promotion-banner-dismissed', 'true');
          console.log('🎉 AI banner dismissed - will stay hidden until browser closes');
        };
        
        // Display message with end date like premium banner
        const bannerText = endDate 
          ? `🎉 <strong>Special Offer:</strong> Aubie RET AI Assistant is FREE for everyone! Enjoy all features until ${endDate}`
          : `🎉 <strong>Special Offer:</strong> Aubie RET AI Assistant is FREE for everyone now!`;
        banner.innerHTML = bannerText;
        banner.appendChild(dismissBtn);
        
        // Insert into main element EXACTLY like premium banner
        const mainContent = document.querySelector('main') || document.body;
        if (mainContent.firstChild) {
          mainContent.insertBefore(banner, mainContent.firstChild);
        } else {
          mainContent.appendChild(banner);
        }
      } else if (isDismissed) {
        console.log('ℹ️ AI banner dismissed - skipping display');
      }
    } catch (err) {
      console.warn('⚠️ Failed to show AI promotion banner:', err);
    }
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

// Initialize immediately (don't wait for DOMContentLoaded)
console.log('🚀 Creating Settings Applier instance...');
if (!window.settingsApplier) {
  window.settingsApplier = new SettingsApplier();
  console.log('🔄 Starting init...');
  window.settingsApplier.init().catch(err => console.error('❌ Failed to init settings applier:', err));
}

// Also initialize on DOMContentLoaded as backup
window.addEventListener('DOMContentLoaded', () => {
  if (window.settingsApplier && window.settingsApplier.settings) {
    console.log('✅ Settings already loaded from immediate init');
  } else if (!window.settingsApplier) {
    console.log('⚠️ Settings applier not created yet, initializing on DOMContentLoaded');
    window.settingsApplier = new SettingsApplier();
    window.settingsApplier.init();
  }
});

console.log('✅ Settings Applier module loaded');
