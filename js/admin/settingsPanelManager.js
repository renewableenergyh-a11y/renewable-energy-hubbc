// Super Admin Settings Panel Manager
// Handles all settings UI and API interactions

class SettingsPanelManager {
  constructor() {
    this.currentSettings = null;
    this.isLoading = false;
  }

  async init() {
    console.log('🔧 Initializing Settings Panel...');
    await this.loadSettings();
    this.renderUI();
    this.setupEventListeners();
  }

  async loadSettings() {
    try {
      this.isLoading = true;
      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      console.log('🔑 Token length:', token.length, 'First 10 chars:', token.substring(0, 10));
      console.log('📤 Sending request to /api/settings with Bearer token');

      const response = await fetch('/api/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('⚠️ API Error:', errorData);
        throw new Error(`API Error (${response.status}): ${errorData.error || 'Unknown error'}`);
      }

      this.currentSettings = await response.json();
      console.log('✅ Settings loaded:', this.currentSettings);
    } catch (err) {
      console.error('❌ Error loading settings:', err);
      showAlert('Error', 'Failed to load settings: ' + err.message, 'error');
    } finally {
      this.isLoading = false;
    }
  }

  renderUI() {
    const container = document.getElementById('settings-panel');
    if (!container) return;

    container.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; padding: 24px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 24px;">
          ${this.renderPlatformSection()}
          ${this.renderCertificatesSection()}
          ${this.renderNewsSection()}
          ${this.renderAiSection()}
          ${this.renderPremiumSection()}
          ${this.renderUtilitiesSection()}
        </div>
      </div>
    `;
  }

  renderPlatformSection() {
    const s = this.currentSettings;
    return `
      <div class="settings-card" data-section="platform">
        <div style="display: flex; align-items: center; margin-bottom: 20px; gap: 12px;">
          <i class="fas fa-cog" style="font-size: 24px; color: var(--green-main);"></i>
          <h3 style="margin: 0; font-size: 18px; color: var(--text-main);">🔧 Platform Control</h3>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="form-group">
            <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">
              Site Name
            </label>
            <input type="text" id="siteName" value="${s.siteName || ''}" 
              style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main); box-sizing: border-box;" />
          </div>

          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border-radius: 6px; background: var(--bg-secondary);">
              <input type="checkbox" id="maintenanceMode" ${s.maintenanceMode ? 'checked' : ''} 
                style="width: 18px; height: 18px; cursor: pointer;" />
              <span style="flex: 1; color: var(--text-main); font-weight: 500;">Enable Maintenance Mode</span>
              <span id="maintenanceBadge" style="display: ${s.maintenanceMode ? 'inline-block' : 'none'}; padding: 4px 8px; background: #ff9800; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">ON</span>
            </label>
            <small style="color: var(--text-muted); display: block; margin-top: 6px;">When enabled, only SuperAdmins can access the platform</small>
          </div>

          <div class="form-group" id="maintenanceMessageGroup" style="display: ${s.maintenanceMode ? 'block' : 'none'};">
            <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">
              Maintenance Message
            </label>
            <textarea id="maintenanceMessage" placeholder="e.g., We're performing scheduled maintenance..."
              style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main); box-sizing: border-box; font-family: inherit; resize: vertical;"
              rows="3">${s.maintenanceMessage || ''}</textarea>
          </div>

          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border-radius: 6px; background: var(--bg-secondary);">
              <input type="checkbox" id="allowNewUserRegistration" ${s.allowNewUserRegistration ? 'checked' : ''} 
                style="width: 18px; height: 18px; cursor: pointer;" />
              <span style="flex: 1; color: var(--text-main); font-weight: 500;">Allow New User Registration</span>
              <span id="registrationBadge" style="display: ${s.allowNewUserRegistration ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">ENABLED</span>
            </label>
            <small style="color: var(--text-muted); display: block; margin-top: 6px;">When disabled, users cannot create new accounts</small>
          </div>

          <div class="form-group">
            <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">
              Default Timezone
            </label>
            <select id="defaultTimezone" 
              style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main); box-sizing: border-box;">
              <option value="UTC" ${s.defaultTimezone === 'UTC' ? 'selected' : ''}>UTC</option>
              <option value="America/New_York" ${s.defaultTimezone === 'America/New_York' ? 'selected' : ''}>Eastern Time</option>
              <option value="America/Chicago" ${s.defaultTimezone === 'America/Chicago' ? 'selected' : ''}>Central Time</option>
              <option value="America/Denver" ${s.defaultTimezone === 'America/Denver' ? 'selected' : ''}>Mountain Time</option>
              <option value="America/Los_Angeles" ${s.defaultTimezone === 'America/Los_Angeles' ? 'selected' : ''}>Pacific Time</option>
            </select>
          </div>

          <button class="btn-primary" onclick="settingsManager.saveSetting('platform')" 
            style="width: 100%; padding: 12px; font-weight: 600; border-radius: 6px;">
            <i class="fas fa-save" style="margin-right: 6px;"></i>Save Platform Settings
          </button>
        </div>
      </div>
    `;
  }

  renderCertificatesSection() {
    const s = this.currentSettings;
    return `
      <div class="settings-card" data-section="certificates">
        <div style="display: flex; align-items: center; margin-bottom: 20px; gap: 12px;">
          <i class="fas fa-certificate" style="font-size: 24px; color: var(--green-main);"></i>
          <h3 style="margin: 0; font-size: 18px; color: var(--text-main);">🎓 Certificates</h3>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border-radius: 6px; background: var(--bg-secondary);">
              <input type="checkbox" id="enableCertificateGeneration" ${s.enableCertificateGeneration ? 'checked' : ''} 
                style="width: 18px; height: 18px; cursor: pointer;" />
              <span style="flex: 1; color: var(--text-main); font-weight: 500;">Enable Certificate Generation</span>
              <span id="certBadge" style="display: ${s.enableCertificateGeneration ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">ENABLED</span>
            </label>
          </div>

          <div class="form-group">
            <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">
              Minimum Quiz Pass Percentage
            </label>
            <input type="number" id="minimumQuizPassPercentage" min="50" max="100" value="${s.minimumQuizPassPercentage || 70}" 
              style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main); box-sizing: border-box;" />
            <small style="color: var(--text-muted); display: block; margin-top: 6px;">Users must score at least this percentage to earn a certificate</small>
          </div>

          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border-radius: 6px; background: var(--bg-secondary);">
              <input type="checkbox" id="allowCertificateRedownload" ${s.allowCertificateRedownload ? 'checked' : ''} 
                style="width: 18px; height: 18px; cursor: pointer;" />
              <span style="flex: 1; color: var(--text-main); font-weight: 500;">Allow Certificate Re-download</span>
              <span id="redownloadBadge" style="display: ${s.allowCertificateRedownload ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">ALLOWED</span>
            </label>
            <small style="color: var(--text-muted); display: block; margin-top: 6px;">Users can download their certificates multiple times</small>
          </div>

          <button class="btn-primary" onclick="settingsManager.saveSetting('certificates')" 
            style="width: 100%; padding: 12px; font-weight: 600; border-radius: 6px;">
            <i class="fas fa-save" style="margin-right: 6px;"></i>Save Certificate Settings
          </button>
        </div>
      </div>
    `;
  }

  renderNewsSection() {
    const s = this.currentSettings;
    return `
      <div class="settings-card" data-section="news-careers">
        <div style="display: flex; align-items: center; margin-bottom: 20px; gap: 12px;">
          <i class="fas fa-newspaper" style="font-size: 24px; color: var(--green-main);"></i>
          <h3 style="margin: 0; font-size: 18px; color: var(--text-main);">📰 Content Control</h3>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="border-top: 2px solid var(--border-color); padding-top: 12px; margin-bottom: 8px;">
            <h4 style="margin: 0 0 12px 0; color: var(--text-main); font-size: 14px;">📰 News</h4>
          </div>

          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border-radius: 6px; background: var(--bg-secondary);">
              <input type="checkbox" id="enableNewsSystem" ${s.enableNewsSystem ? 'checked' : ''} 
                style="width: 18px; height: 18px; cursor: pointer;" />
              <span style="flex: 1; color: var(--text-main); font-weight: 500;">Enable News System</span>
              <span id="newsBadge" style="display: ${s.enableNewsSystem ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">ENABLED</span>
            </label>
          </div>

          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border-radius: 6px; background: var(--bg-secondary);">
              <input type="checkbox" id="enableLikesReactions" ${s.enableLikesReactions ? 'checked' : ''} 
                style="width: 18px; height: 18px; cursor: pointer;" />
              <span style="flex: 1; color: var(--text-main); font-weight: 500;">Enable Likes & Reactions</span>
              <span id="reactionsBadge" style="display: ${s.enableLikesReactions ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">ENABLED</span>
            </label>
          </div>

          <div style="border-top: 2px solid var(--border-color); padding-top: 12px; margin-bottom: 8px; margin-top: 8px;">
            <h4 style="margin: 0 0 12px 0; color: var(--text-main); font-size: 14px;">💼 Careers</h4>
          </div>

          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border-radius: 6px; background: var(--bg-secondary);">
              <input type="checkbox" id="enableCareersPage" ${s.enableCareersPage ? 'checked' : ''} 
                style="width: 18px; height: 18px; cursor: pointer;" />
              <span style="flex: 1; color: var(--text-main); font-weight: 500;">Enable Careers Page</span>
              <span id="careersBadge" style="display: ${s.enableCareersPage ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">ENABLED</span>
            </label>
          </div>

          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border-radius: 6px; background: var(--bg-secondary);">
              <input type="checkbox" id="allowCareersPdfDownload" ${s.allowCareersPdfDownload ? 'checked' : ''} 
                style="width: 18px; height: 18px; cursor: pointer;" />
              <span style="flex: 1; color: var(--text-main); font-weight: 500;">Allow Careers PDF Download</span>
              <span id="pdfBadge" style="display: ${s.allowCareersPdfDownload ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">ALLOWED</span>
            </label>
          </div>

          <button class="btn-primary" onclick="settingsManager.saveSetting('news-careers')" 
            style="width: 100%; padding: 12px; font-weight: 600; border-radius: 6px;">
            <i class="fas fa-save" style="margin-right: 6px;"></i>Save Content Settings
          </button>
        </div>
      </div>
    `;
  }

  renderAiSection() {
    const s = this.currentSettings;
    return `
      <div class="settings-card" data-section="ai-assistant">
        <div style="display: flex; align-items: center; margin-bottom: 20px; gap: 12px;">
          <i class="fas fa-robot" style="font-size: 24px; color: var(--green-main);"></i>
          <h3 style="margin: 0; font-size: 18px; color: var(--text-main);">🤖 Aubie RET AI Assistant</h3>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border-radius: 6px; background: var(--bg-secondary);">
              <input type="checkbox" id="enableAiAssistant" ${s.enableAiAssistant ? 'checked' : ''} 
                style="width: 18px; height: 18px; cursor: pointer;" />
              <span style="flex: 1; color: var(--text-main); font-weight: 500;">Enable AI Assistant</span>
              <span id="aiBadge" style="display: ${s.enableAiAssistant ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">ENABLED</span>
            </label>
          </div>

          <div class="form-group">
            <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">
              Access Mode
            </label>
            <select id="aiAccessMode" 
              style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main); box-sizing: border-box;">
              <option value="Premium Only" ${s.aiAccessMode === 'Premium Only' ? 'selected' : ''}>Premium Only</option>
              <option value="Everyone" ${s.aiAccessMode === 'Everyone' ? 'selected' : ''}>Everyone (Promotion)</option>
            </select>
            <small style="color: var(--text-muted); display: block; margin-top: 6px;">Choose who can access the AI assistant</small>
          </div>

          <div class="form-group" id="aiPromotionGroup" style="display: ${s.aiAccessMode === 'Everyone' ? 'block' : 'none'};">
            <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">
              Promotion Duration (days) <span style="color: #f44336;">*</span>
            </label>
            <input type="number" id="aiPromotionDurationDays" min="1" value="${s.aiPromotionDurationDays || 7}" 
              style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main); box-sizing: border-box;" />
            <small style="color: var(--text-muted); display: block; margin-top: 6px;">How many days the promotion will last</small>
          </div>

          <div class="form-group">
            <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">
              Daily Question Limit Per User
            </label>
            <input type="number" id="aiDailyQuestionLimit" min="1" value="${s.aiDailyQuestionLimit || 50}" 
              style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main); box-sizing: border-box;" />
            <small style="color: var(--text-muted); display: block; margin-top: 6px;">Maximum questions per user per day (0 = unlimited)</small>
          </div>

          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border-radius: 6px; background: var(--bg-secondary);">
              <input type="checkbox" id="showAiBetaNotice" ${s.showAiBetaNotice ? 'checked' : ''} 
                style="width: 18px; height: 18px; cursor: pointer;" />
              <span style="flex: 1; color: var(--text-main); font-weight: 500;">Show "AI is in Beta" Notice</span>
            </label>
          </div>

          <button class="btn-primary" onclick="settingsManager.saveSetting('ai-assistant')" 
            style="width: 100%; padding: 12px; font-weight: 600; border-radius: 6px;">
            <i class="fas fa-save" style="margin-right: 6px;"></i>Save AI Settings
          </button>
        </div>
      </div>
    `;
  }

  renderPremiumSection() {
    const s = this.currentSettings;
    return `
      <div class="settings-card" data-section="premium-trial">
        <div style="display: flex; align-items: center; margin-bottom: 20px; gap: 12px;">
          <i class="fas fa-gem" style="font-size: 24px; color: var(--green-main);"></i>
          <h3 style="margin: 0; font-size: 18px; color: var(--text-main);">💎 Premium Access Control</h3>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border-radius: 6px; background: var(--bg-secondary);">
              <input type="checkbox" id="enablePremiumSystem" ${s.enablePremiumSystem ? 'checked' : ''} 
                style="width: 18px; height: 18px; cursor: pointer;" />
              <span style="flex: 1; color: var(--text-main); font-weight: 500;">Enable Premium Subscriptions</span>
              <span id="premiumBadge" style="display: ${s.enablePremiumSystem ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">ENABLED</span>
            </label>
            <small style="color: var(--text-muted); display: block; margin-top: 6px;">Turn off to disable all premium features site-wide</small>
          </div>

          <div class="form-group">
            <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">
              Free Trial Duration (days)
            </label>
            <input type="number" id="freeTrialDurationDays" min="0" value="${s.freeTrialDurationDays || 7}" 
              style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main); box-sizing: border-box;" />
            <small style="color: var(--text-muted); display: block; margin-top: 6px;">New users automatically get premium for X days</small>
          </div>

          <div style="border-top: 2px solid var(--border-color); padding-top: 12px; margin-bottom: 8px; margin-top: 8px;">
            <h4 style="margin: 0 0 12px 0; color: var(--text-main); font-size: 14px;">🎉 Premium for Everyone (Promotion)</h4>
          </div>

          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border-radius: 6px; background: var(--bg-secondary);">
              <input type="checkbox" id="enablePremiumForAll" ${s.enablePremiumForAll ? 'checked' : ''} 
                style="width: 18px; height: 18px; cursor: pointer;" />
              <span style="flex: 1; color: var(--text-main); font-weight: 500;">Enable Premium for All Users</span>
              <span id="promotionBadge" style="display: ${s.enablePremiumForAll ? 'inline-block' : 'none'}; padding: 4px 8px; background: #ff9800; color: white; border-radius: 4px; font-size: 11px; font-weight: 600;">ACTIVE</span>
            </label>
            <small style="color: var(--text-muted); display: block; margin-top: 6px;">All users temporarily get premium access</small>
          </div>

          <div class="form-group" id="promotionDurationGroup" style="display: ${s.enablePremiumForAll ? 'block' : 'none'};">
            <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">
              Promotion Duration <span style="color: #f44336;">*</span>
            </label>
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px;">
              <input type="number" id="premiumPromotionDurationValue" min="1" value="${s.premiumPromotionDurationValue || 7}" 
                style="padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main); box-sizing: border-box;" />
              <select id="premiumPromotionDurationUnit" 
                style="padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main); box-sizing: border-box;">
                <option value="minutes" ${s.premiumPromotionDurationUnit === 'minutes' ? 'selected' : ''}>Minutes</option>
                <option value="hours" ${s.premiumPromotionDurationUnit === 'hours' ? 'selected' : ''}>Hours</option>
                <option value="days" ${s.premiumPromotionDurationUnit === 'days' ? 'selected' : ''}>Days</option>
              </select>
            </div>
            <small style="color: var(--text-muted); display: block; margin-top: 6px;">How long the promotion will last</small>
          </div>

          <button class="btn-primary" onclick="settingsManager.saveSetting('premium-trial')" 
            style="width: 100%; padding: 12px; font-weight: 600; border-radius: 6px;">
            <i class="fas fa-save" style="margin-right: 6px;"></i>Save Premium Settings
          </button>
        </div>
      </div>
    `;
  }

  renderUtilitiesSection() {
    return `
      <div class="settings-card" data-section="utilities">
        <div style="display: flex; align-items: center; margin-bottom: 20px; gap: 12px;">
          <i class="fas fa-tools" style="font-size: 24px; color: var(--green-main);"></i>
          <h3 style="margin: 0; font-size: 18px; color: var(--text-main);">🛠 System Utilities</h3>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button class="btn" onclick="settingsManager.clearCache()" 
            style="width: 100%; padding: 12px; font-weight: 600; border-radius: 6px; text-align: left;">
            <i class="fas fa-trash" style="margin-right: 8px;"></i>Clear Application Cache
          </button>

          <button class="btn" onclick="settingsManager.viewErrorLogs()" 
            style="width: 100%; padding: 12px; font-weight: 600; border-radius: 6px; text-align: left;">
            <i class="fas fa-file-alt" style="margin-right: 8px;"></i>View Error Logs
          </button>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Toggle maintenance message visibility
    const maintenanceCheckbox = document.getElementById('maintenanceMode');
    const messageGroup = document.getElementById('maintenanceMessageGroup');
    const maintenanceBadge = document.getElementById('maintenanceBadge');

    if (maintenanceCheckbox) {
      maintenanceCheckbox.addEventListener('change', (e) => {
        if (messageGroup) {
          messageGroup.style.display = e.target.checked ? 'block' : 'none';
        }
        if (maintenanceBadge) {
          maintenanceBadge.style.display = e.target.checked ? 'inline-block' : 'none';
        }
      });
    }

    // Toggle AI promotion duration
    const aiAccessMode = document.getElementById('aiAccessMode');
    const aiPromotionGroup = document.getElementById('aiPromotionGroup');

    if (aiAccessMode) {
      aiAccessMode.addEventListener('change', (e) => {
        if (aiPromotionGroup) {
          aiPromotionGroup.style.display = e.target.value === 'Everyone' ? 'block' : 'none';
        }
      });
    }

    // Toggle Premium promotion duration
    const enablePremiumForAll = document.getElementById('enablePremiumForAll');
    const promotionDurationGroup = document.getElementById('promotionDurationGroup');

    if (enablePremiumForAll) {
      enablePremiumForAll.addEventListener('change', (e) => {
        if (promotionDurationGroup) {
          promotionDurationGroup.style.display = e.target.checked ? 'block' : 'none';
        }
        const badge = document.getElementById('promotionBadge');
        if (badge) {
          badge.style.display = e.target.checked ? 'inline-block' : 'none';
        }
      });
    }

    // Badge visibility for toggles
    const badgeMap = {
      'maintenanceMode': 'maintenanceBadge',
      'allowNewUserRegistration': 'registrationBadge',
      'enableCertificateGeneration': 'certBadge',
      'allowCertificateRedownload': 'redownloadBadge',
      'enableNewsSystem': 'newsBadge',
      'enableLikesReactions': 'reactionsBadge',
      'enableCareersPage': 'careersBadge',
      'allowCareersPdfDownload': 'pdfBadge',
      'enableAiAssistant': 'aiBadge',
      'enablePremiumSystem': 'premiumBadge'
    };

    Object.entries(badgeMap).forEach(([checkboxId, badgeId]) => {
      const checkbox = document.getElementById(checkboxId);
      const badge = document.getElementById(badgeId);
      if (checkbox && badge) {
        checkbox.addEventListener('change', (e) => {
          badge.style.display = e.target.checked ? 'inline-block' : 'none';
        });
      }
    });
  }

  async saveSetting(section) {
    try {
      if (!this.currentSettings) {
        throw new Error('Settings not loaded');
      }

      const token = localStorage.getItem('adminToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      const button = event.target;
      const originalText = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 6px;"></i>Saving...';

      // Collect values based on section
      const updates = this.collectSectionValues(section);

      console.log('💾 Saving settings for section:', section, updates);

      const response = await fetch(`/api/settings/${section}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      this.currentSettings = result.settings;

      await showAlert('Success', `${section.replace('-', ' ')} settings saved successfully!`, 'success');

      button.disabled = false;
      button.innerHTML = originalText;

      // Refresh UI to show updated badges
      this.renderUI();
      this.setupEventListeners();

    } catch (err) {
      console.error('❌ Error saving settings:', err);
      await showAlert('Error', 'Failed to save settings: ' + err.message, 'error');
      button.disabled = false;
      button.innerHTML = originalText;
    }
  }

  collectSectionValues(section) {
    const updates = {};

    if (section === 'platform') {
      updates.siteName = document.getElementById('siteName').value.trim();
      updates.maintenanceMode = document.getElementById('maintenanceMode').checked;
      updates.maintenanceMessage = document.getElementById('maintenanceMessage').value.trim();
      updates.allowNewUserRegistration = document.getElementById('allowNewUserRegistration').checked;
      updates.defaultTimezone = document.getElementById('defaultTimezone').value;
    } else if (section === 'certificates') {
      updates.enableCertificateGeneration = document.getElementById('enableCertificateGeneration').checked;
      updates.minimumQuizPassPercentage = parseInt(document.getElementById('minimumQuizPassPercentage').value) || 70;
      updates.allowCertificateRedownload = document.getElementById('allowCertificateRedownload').checked;
    } else if (section === 'news-careers') {
      updates.enableNewsSystem = document.getElementById('enableNewsSystem').checked;
      updates.enableLikesReactions = document.getElementById('enableLikesReactions').checked;
      updates.enableCareersPage = document.getElementById('enableCareersPage').checked;
      updates.allowCareersPdfDownload = document.getElementById('allowCareersPdfDownload').checked;
    } else if (section === 'ai-assistant') {
      updates.enableAiAssistant = document.getElementById('enableAiAssistant').checked;
      updates.aiAccessMode = document.getElementById('aiAccessMode').value;
      updates.aiPromotionDurationDays = parseInt(document.getElementById('aiPromotionDurationDays').value) || 7;
      updates.aiDailyQuestionLimit = parseInt(document.getElementById('aiDailyQuestionLimit').value) || 50;
      updates.showAiBetaNotice = document.getElementById('showAiBetaNotice').checked;
    } else if (section === 'premium-trial') {
      updates.enablePremiumSystem = document.getElementById('enablePremiumSystem').checked;
      updates.freeTrialDurationDays = parseInt(document.getElementById('freeTrialDurationDays').value) || 7;
      updates.enablePremiumForAll = document.getElementById('enablePremiumForAll').checked;
      updates.premiumPromotionDurationValue = parseInt(document.getElementById('premiumPromotionDurationValue').value) || 7;
      updates.premiumPromotionDurationUnit = document.getElementById('premiumPromotionDurationUnit').value;
    }

    return updates;
  }

  async clearCache() {
    const confirmed = await showConfirm('Clear Cache', 'Clear all application cache? This may take a moment.', 'warning');
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('adminToken');
      if (!token) throw new Error('Authentication required');

      const response = await fetch('/api/settings/utilities/clear-cache', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to clear cache');

      await showAlert('Success', 'Application cache cleared successfully!', 'success');
    } catch (err) {
      console.error('Error clearing cache:', err);
      await showAlert('Error', 'Failed to clear cache: ' + err.message, 'error');
    }
  }

  async viewErrorLogs() {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) throw new Error('Authentication required');

      const response = await fetch('/api/settings/utilities/error-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load logs');

      const data = await response.json();
      const logs = data.logs || 'No logs found';

      // Show in modal
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:99999;';
      const container = document.createElement('div');
      container.style.cssText = 'background:var(--bg-main);width:95%;max-width:900px;max-height:80vh;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;';
      
      const header = document.createElement('div');
      header.style.cssText = 'padding:20px;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;';
      header.innerHTML = '<h2 style="margin:0;color:var(--text-main);">Error Logs</h2>';
      
      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn';
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = 'padding:6px 12px;cursor:pointer;';
      closeBtn.addEventListener('click', () => modal.remove());
      header.appendChild(closeBtn);
      
      const content = document.createElement('pre');
      content.style.cssText = 'flex:1;overflow:auto;padding:20px;color:var(--text-muted);font-size:12px;line-height:1.5;margin:0;font-family:monospace;background:var(--bg-secondary);';
      content.textContent = logs;
      
      container.appendChild(header);
      container.appendChild(content);
      modal.appendChild(container);
      document.body.appendChild(modal);
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
    } catch (err) {
      console.error('Error loading logs:', err);
      await showAlert('Error', 'Failed to load error logs: ' + err.message, 'error');
    }
  }
}

// Global instance
let settingsManager = new SettingsPanelManager();

// Add custom CSS for settings cards
const style = document.createElement('style');
style.textContent = `
  .settings-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }

  .settings-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .form-group input[type="text"],
  .form-group input[type="number"],
  .form-group select,
  .form-group textarea {
    transition: border-color 0.3s, box-shadow 0.3s;
  }

  .form-group input[type="text"]:focus,
  .form-group input[type="number"]:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--green-main);
    box-shadow: 0 0 0 3px rgba(0, 121, 107, 0.1);
  }
`;
document.head.appendChild(style);

console.log('✅ SettingsPanelManager loaded');
