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
    // Start auto-refresh to detect promotion expiration
    this.startAutoRefresh();
  }

  startAutoRefresh() {
    // Refresh settings every 5 seconds to detect promotions that have expired
    setInterval(async () => {
      const previousSettings = JSON.stringify(this.currentSettings);
      await this.loadSettings();
      const newSettings = JSON.stringify(this.currentSettings);
      
      // If settings changed (especially promotion status), update UI
      if (previousSettings !== newSettings) {
        console.log('🔄 Settings changed in admin panel, updating UI...');
        this.renderUI();
      }
    }, 5000);
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

    // Set active section (default to 'general')
    this.activeSection = this.activeSection || 'general';

    container.innerHTML = `
      <div style="display: flex; height: 100%; min-height: calc(100vh - 100px);">
        <!-- SIDEBAR -->
        <div style="width: 260px; background: var(--bg-secondary); border-right: 1px solid var(--border-color); padding: 20px 0; overflow-y: auto;">
          <div style="padding: 0 12px;">
            <h4 style="margin: 0 0 16px 16px; color: var(--text-muted); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Settings</h4>
            
            ${this.renderSidebarItem('general', 'General', 'cog')}
            ${this.renderSidebarItem('features', 'Features', 'star')}
            ${this.renderSidebarItem('certificates', 'Certificates', 'certificate')}
            ${this.renderSidebarItem('ai-assistant', 'AI Assistant', 'robot')}
            ${this.renderSidebarItem('premium', 'Premium & Promotions', 'gem')}
            ${this.renderSidebarItem('system', 'System', 'tools')}
          </div>
        </div>

        <!-- MAIN CONTENT -->
        <div style="flex: 1; overflow-y: auto; background: var(--bg-main);">
          <div style="max-width: 900px; margin: 0 auto; padding: 32px;">
            ${this.renderContentSection()}
          </div>
        </div>
      </div>
    `;
  }

  renderSidebarItem(sectionId, label, icon) {
    const isActive = this.activeSection === sectionId;
    return `
      <div onclick="settingsManager.switchSection('${sectionId}')" 
        style="padding: 12px 16px; margin: 4px 0; border-radius: 6px; cursor: pointer; user-select: none; transition: all 0.2s ease; background: ${isActive ? 'var(--green-main)' : 'transparent'}; color: ${isActive ? 'white' : 'var(--text-main)'}; font-weight: ${isActive ? '600' : '500'}; display: flex; align-items: center; gap: 10px;">
        <i class="fas fa-${icon}" style="width: 20px; text-align: center;"></i>
        <span>${label}</span>
      </div>
    `;
  }

  switchSection(sectionId) {
    this.activeSection = sectionId;
    this.renderUI();
    this.setupEventListeners();
  }

  renderContentSection() {
    const s = this.currentSettings;
    
    switch(this.activeSection) {
      case 'general':
        return this.renderGeneralSettings(s);
      case 'features':
        return this.renderFeaturesSettings(s);
      case 'certificates':
        return this.renderCertificatesSettings(s);
      case 'ai-assistant':
        return this.renderAiSettings(s);
      case 'premium':
        return this.renderPremiumSettings(s);
      case 'system':
        return this.renderSystemSettings();
      default:
        return this.renderGeneralSettings(s);
    }
  }

  renderGeneralSettings(s) {
    return `
      <div>
        <h1 style="margin: 0 0 8px 0; color: var(--text-main); font-size: 28px;">General Settings</h1>
        <p style="margin: 0 0 24px 0; color: var(--text-muted); font-size: 14px;">Configure basic platform settings and system behavior</p>
        
        <div style="display: flex; flex-direction: column; gap: 0;">
          <!-- Platform Name -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Site Name</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Displayed in browser tab and system ui</p>
            </div>
            <input type="text" id="siteName" value="${s.siteName || ''}" 
              style="width: 300px; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-main); box-sizing: border-box;" />
          </div>

          <!-- Default Timezone -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Default Timezone</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Used for timestamps throughout the platform</p>
            </div>
            <select id="defaultTimezone" 
              style="width: 300px; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-main); box-sizing: border-box;">
              <option value="UTC" ${s.defaultTimezone === 'UTC' ? 'selected' : ''}>UTC</option>
              <option value="America/New_York" ${s.defaultTimezone === 'America/New_York' ? 'selected' : ''}>Eastern Time</option>
              <option value="America/Chicago" ${s.defaultTimezone === 'America/Chicago' ? 'selected' : ''}>Central Time</option>
              <option value="America/Denver" ${s.defaultTimezone === 'America/Denver' ? 'selected' : ''}>Mountain Time</option>
              <option value="America/Los_Angeles" ${s.defaultTimezone === 'America/Los_Angeles' ? 'selected' : ''}>Pacific Time</option>
            </select>
          </div>

          <!-- Allow New User Registration -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Allow New Registrations</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">When disabled, users cannot create new accounts</p>
            </div>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
              <input type="checkbox" id="allowNewUserRegistration" ${s.allowNewUserRegistration ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--green-main);" />
              <span id="registrationBadge" style="display: ${s.allowNewUserRegistration ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 3px; font-size: 11px; font-weight: 600;">ENABLED</span>
            </label>
          </div>

          <!-- Maintenance Mode Section -->
          <div style="margin-top: 24px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 16px 0; color: var(--text-main); font-size: 16px; font-weight: 600;">Maintenance Mode</h3>
          </div>

          <!-- Enable Maintenance -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Enable Maintenance Mode</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Only SuperAdmins can access when enabled</p>
            </div>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
              <input type="checkbox" id="maintenanceMode" ${s.maintenanceMode ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--green-main);" />
              <span id="maintenanceBadge" style="display: ${s.maintenanceMode ? 'inline-block' : 'none'}; padding: 4px 8px; background: #ff9800; color: white; border-radius: 3px; font-size: 11px; font-weight: 600;">ACTIVE</span>
            </label>
          </div>

          <!-- Maintenance Message -->
          <div id="maintenanceMessageGroup" style="display: ${s.maintenanceMode ? 'block' : 'none'}; padding: 16px; border-bottom: 1px solid var(--border-color);">
            <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">Maintenance Message</label>
            <p style="margin: 0 0 8px 0; color: var(--text-muted); font-size: 13px;">Message displayed when maintenance mode is active</p>
            <textarea id="maintenanceMessage" placeholder="e.g., We're performing scheduled maintenance..."
              style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-main); box-sizing: border-box; font-family: inherit; resize: vertical;"
              rows="3">${s.maintenanceMessage || ''}</textarea>
          </div>
        </div>

        <button class="btn-primary" onclick="settingsManager.saveSetting('platform')" 
          style="width: 100%; padding: 12px 16px; font-weight: 600; border-radius: 6px; margin-top: 24px;">
          <i class="fas fa-save" style="margin-right: 8px;"></i>Save General Settings
        </button>
      </div>
    `;
  }

  renderFeaturesSettings(s) {
    return `
      <div>
        <h1 style="margin: 0 0 8px 0; color: var(--text-main); font-size: 28px;">Feature Control</h1>
        <p style="margin: 0 0 24px 0; color: var(--text-muted); font-size: 14px;">Enable or disable platform features</p>
        
        <div style="display: flex; flex-direction: column; gap: 0;">
          <!-- News Section Header -->
          <div style="margin-bottom: 16px;">
            <h3 style="margin: 0 0 12px 0; color: var(--text-main); font-size: 16px; font-weight: 600;">News System</h3>
          </div>

          <!-- Enable News System -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Enable News System</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Users can create and view news articles</p>
            </div>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
              <input type="checkbox" id="enableNewsSystem" ${s.enableNewsSystem ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--green-main);" />
              <span id="newsBadge" style="display: ${s.enableNewsSystem ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 3px; font-size: 11px; font-weight: 600;">ENABLED</span>
            </label>
          </div>

          <!-- Enable Likes & Reactions -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Enable Likes & Reactions</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Users can like and react to content</p>
            </div>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
              <input type="checkbox" id="enableLikesReactions" ${s.enableLikesReactions ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--green-main);" />
              <span id="reactionsBadge" style="display: ${s.enableLikesReactions ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 3px; font-size: 11px; font-weight: 600;">ENABLED</span>
            </label>
          </div>

          <!-- Careers Section Header -->
          <div style="margin-top: 24px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 12px 0; color: var(--text-main); font-size: 16px; font-weight: 600;">Careers Page</h3>
          </div>

          <!-- Enable Careers Page -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Enable Careers Page</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Careers section is visible to users</p>
            </div>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
              <input type="checkbox" id="enableCareersPage" ${s.enableCareersPage ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--green-main);" />
              <span id="careersBadge" style="display: ${s.enableCareersPage ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 3px; font-size: 11px; font-weight: 600;">ENABLED</span>
            </label>
          </div>

          <!-- Allow Careers PDF Download -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Allow PDF Downloads</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Users can download careers content as PDF</p>
            </div>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
              <input type="checkbox" id="allowCareersPdfDownload" ${s.allowCareersPdfDownload ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--green-main);" />
              <span id="pdfBadge" style="display: ${s.allowCareersPdfDownload ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 3px; font-size: 11px; font-weight: 600;">ALLOWED</span>
            </label>
          </div>
        </div>

        <button class="btn-primary" onclick="settingsManager.saveSetting('news-careers')" 
          style="width: 100%; padding: 12px 16px; font-weight: 600; border-radius: 6px; margin-top: 24px;">
          <i class="fas fa-save" style="margin-right: 8px;"></i>Save Feature Settings
        </button>
      </div>
    `;
  }

  renderCertificatesSettings(s) {
    return `
      <div>
        <h1 style="margin: 0 0 8px 0; color: var(--text-main); font-size: 28px;">Certificate Settings</h1>
        <p style="margin: 0 0 24px 0; color: var(--text-muted); font-size: 14px;">Control how certificates are issued and managed</p>
        
        <div style="display: flex; flex-direction: column; gap: 0;">
          <!-- Enable Certificate Generation -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Enable Certificates</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Generate certificates for course completion</p>
            </div>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
              <input type="checkbox" id="enableCertificateGeneration" ${s.enableCertificateGeneration ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--green-main);" />
              <span id="certBadge" style="display: ${s.enableCertificateGeneration ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 3px; font-size: 11px; font-weight: 600;">ENABLED</span>
            </label>
          </div>

          <!-- Minimum Quiz Pass Percentage -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Minimum Pass Percentage</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Minimum score required to earn a certificate</p>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="number" id="minimumQuizPassPercentage" min="50" max="100" value="${s.minimumQuizPassPercentage || 70}" 
                style="width: 80px; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-main); box-sizing: border-box; text-align: center;" />
              <span style="color: var(--text-muted); font-weight: 500;">%</span>
            </div>
          </div>

          <!-- Allow Certificate Re-download -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Allow Re-download</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Users can download certificates multiple times</p>
            </div>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
              <input type="checkbox" id="allowCertificateRedownload" ${s.allowCertificateRedownload ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--green-main);" />
              <span id="redownloadBadge" style="display: ${s.allowCertificateRedownload ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 3px; font-size: 11px; font-weight: 600;">ALLOWED</span>
            </label>
          </div>
        </div>

        <button class="btn-primary" onclick="settingsManager.saveSetting('certificates')" 
          style="width: 100%; padding: 12px 16px; font-weight: 600; border-radius: 6px; margin-top: 24px;">
          <i class="fas fa-save" style="margin-right: 8px;"></i>Save Certificate Settings
        </button>
      </div>
    `;
  }

  renderAiSettings(s) {
    return `
      <div>
        <h1 style="margin: 0 0 8px 0; color: var(--text-main); font-size: 28px;">AI Assistant Settings</h1>
        <p style="margin: 0 0 24px 0; color: var(--text-muted); font-size: 14px;">Configure the Aubie RET AI Assistant</p>
        
        <div style="display: flex; flex-direction: column; gap: 0;">
          <!-- Enable AI Assistant -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Enable AI Assistant</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">AI assistant is available to users</p>
            </div>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
              <input type="checkbox" id="enableAiAssistant" ${s.enableAiAssistant ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--green-main);" />
              <span id="aiBadge" style="display: ${s.enableAiAssistant ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 3px; font-size: 11px; font-weight: 600;">ENABLED</span>
            </label>
          </div>

          <!-- Access Mode -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Access Mode</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Who can use the AI assistant</p>
            </div>
            <select id="aiAccessMode" 
              style="width: 300px; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-main); box-sizing: border-box;">
              <option value="Premium Only" ${s.aiAccessMode === 'Premium Only' ? 'selected' : ''}>Premium Users Only</option>
              <option value="Everyone" ${s.aiAccessMode === 'Everyone' ? 'selected' : ''}>Everyone (Promotion)</option>
            </select>
          </div>

          <!-- AI Promotion Duration -->
          <div id="aiPromotionGroup" style="display: ${s.aiAccessMode === 'Everyone' ? 'block' : 'none'}; padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Promotion Duration</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">How long "Everyone" access lasts</p>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="number" id="aiPromotionDurationValue" min="1" value="${s.aiPromotionDurationValue || 7}" 
                style="width: 80px; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-main); box-sizing: border-box; text-align: center;" />
              <select id="aiPromotionDurationUnit" style="padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-main); min-width: 100px;">
                <option value="minutes" ${s.aiPromotionDurationUnit === 'minutes' ? 'selected' : ''}>Minutes</option>
                <option value="hours" ${s.aiPromotionDurationUnit === 'hours' ? 'selected' : ''}>Hours</option>
                <option value="days" ${s.aiPromotionDurationUnit === 'days' ? 'selected' : ''}>Days</option>
              </select>
            </div>
          </div>

          <!-- Daily Question Limit -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Daily Question Limit</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Max questions per user per day (0 = unlimited)</p>
            </div>
            <input type="number" id="aiDailyQuestionLimit" min="0" value="${s.aiDailyQuestionLimit || 50}" 
              style="width: 120px; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-main); box-sizing: border-box; text-align: center;" />
          </div>

          <!-- Show Beta Notice -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Show Beta Notice</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Display "(Beta)" label on AI widget</p>
            </div>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
              <input type="checkbox" id="showAiBetaNotice" ${s.showAiBetaNotice ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--green-main);" />
            </label>
          </div>
        </div>

        <button class="btn-primary" onclick="settingsManager.saveSetting('ai-assistant')" 
          style="width: 100%; padding: 12px 16px; font-weight: 600; border-radius: 6px; margin-top: 24px;">
          <i class="fas fa-save" style="margin-right: 8px;"></i>Save AI Settings
        </button>
      </div>
    `;
  }

  renderPremiumSettings(s) {
    return `
      <div>
        <h1 style="margin: 0 0 8px 0; color: var(--text-main); font-size: 28px;">Premium & Promotions</h1>
        <p style="margin: 0 0 24px 0; color: var(--text-muted); font-size: 14px;">Manage premium access and promotional campaigns</p>
        
        <div style="display: flex; flex-direction: column; gap: 0;">
          <!-- Enable Premium System -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Enable Premium Subscriptions</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Premium features and subscriptions are available</p>
            </div>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
              <input type="checkbox" id="enablePremiumSystem" ${s.enablePremiumSystem ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--green-main);" />
              <span id="premiumBadge" style="display: ${s.enablePremiumSystem ? 'inline-block' : 'none'}; padding: 4px 8px; background: #4caf50; color: white; border-radius: 3px; font-size: 11px; font-weight: 600;">ENABLED</span>
            </label>
          </div>

          <!-- Promotions Section Header -->
          <div style="margin-top: 24px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 12px 0; color: var(--text-main); font-size: 16px; font-weight: 600;">Premium for Everyone (Promotion)</h3>
          </div>

          <!-- Enable Premium for All -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Enable for All Users</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">All users temporarily get premium access</p>
            </div>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
              <input type="checkbox" id="enablePremiumForAll" ${s.enablePremiumForAll ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--green-main);" />
              <span id="promotionBadge" style="display: ${s.enablePremiumForAll ? 'inline-block' : 'none'}; padding: 4px 8px; background: #ff9800; color: white; border-radius: 3px; font-size: 11px; font-weight: 600;">ACTIVE</span>
            </label>
          </div>

          <!-- Promotion Duration -->
          <div id="promotionDurationGroup" style="display: ${s.enablePremiumForAll ? 'block' : 'none'}; padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Promotion Duration</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">How long the promotion will remain active</p>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="number" id="premiumPromotionDurationValue" min="1" value="${s.premiumPromotionDurationValue || 7}" 
                style="width: 80px; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-main); box-sizing: border-box; text-align: center;" />
              <select id="premiumPromotionDurationUnit" 
                style="padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-main); min-width: 100px;">
                <option value="minutes" ${s.premiumPromotionDurationUnit === 'minutes' ? 'selected' : ''}>Minutes</option>
                <option value="hours" ${s.premiumPromotionDurationUnit === 'hours' ? 'selected' : ''}>Hours</option>
                <option value="days" ${s.premiumPromotionDurationUnit === 'days' ? 'selected' : ''}>Days</option>
              </select>
            </div>
          </div>
        </div>

        <button class="btn-primary" onclick="settingsManager.saveSetting('premium-trial')" 
          style="width: 100%; padding: 12px 16px; font-weight: 600; border-radius: 6px; margin-top: 24px;">
          <i class="fas fa-save" style="margin-right: 8px;"></i>Save Premium Settings
        </button>
      </div>
    `;
  }

  renderSystemSettings() {
    return `
      <div>
        <h1 style="margin: 0 0 8px 0; color: var(--text-main); font-size: 28px;">System Utilities</h1>
        <p style="margin: 0 0 24px 0; color: var(--text-muted); font-size: 14px;">System maintenance and diagnostic tools</p>
        
        <div style="display: flex; flex-direction: column; gap: 0;">
          <!-- Clear Cache -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Clear Application Cache</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">Clear cached data. Use if experiencing issues.</p>
            </div>
            <button class="btn" onclick="settingsManager.clearCache()" 
              style="padding: 8px 16px; border-radius: 6px; white-space: nowrap;">
              <i class="fas fa-trash" style="margin-right: 6px;"></i>Clear
            </button>
          </div>

          <!-- View Error Logs -->
          <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Error Logs</label>
              <p style="margin: 0; color: var(--text-muted); font-size: 13px;">View system error logs for debugging</p>
            </div>
            <button class="btn" onclick="settingsManager.viewErrorLogs()" 
              style="padding: 8px 16px; border-radius: 6px; white-space: nowrap;">
              <i class="fas fa-file-alt" style="margin-right: 6px;"></i>View Logs
            </button>
          </div>
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
              Promotion Duration <span style="color: #f44336;">*</span>
            </label>
            <div style="display: flex; gap: 8px; align-items: flex-start;">
              <input type="number" id="aiPromotionDurationValue" min="1" value="${s.aiPromotionDurationValue || 7}" 
                style="flex: 1; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main); box-sizing: border-box;" />
              <select id="aiPromotionDurationUnit" style="padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-main); color: var(--text-main);">
                <option value="minutes" ${s.aiPromotionDurationUnit === 'minutes' ? 'selected' : ''}>Minutes</option>
                <option value="hours" ${s.aiPromotionDurationUnit === 'hours' ? 'selected' : ''}>Hours</option>
                <option value="days" ${s.aiPromotionDurationUnit === 'days' ? 'selected' : ''}>Days</option>
              </select>
            </div>
            <small style="color: var(--text-muted); display: block; margin-top: 6px;">How long the promotion will last</small>
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

          <!-- Free Trial Duration Removed - No longer used -->

          <div style="border-top: 2px solid var(--border-color); padding-top: 12px; margin-bottom: 8px; margin-top: 8px;">
            <h4 style="margin: 0 0 12px 0; color: var(--text-main); font-size: 14px;">Premium for Everyone (Promotion)</h4>
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

      console.log('📤 Sending PUT request to /api/settings/' + section);
      console.log('📦 Payload:', JSON.stringify(updates, null, 2));

      const response = await fetch(`/api/settings/${section}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      console.log('📥 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('❌ API Error response:', error);
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ API Response:', result);
      this.currentSettings = result.settings || result;
      
      console.log('💾 Stored settings in memory:', this.currentSettings);
      console.log('✔️ maintenanceMode is now:', this.currentSettings.maintenanceMode);
      console.log('✔️ maintenanceMessage is now:', this.currentSettings.maintenanceMessage);

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
      updates.aiPromotionDurationValue = parseInt(document.getElementById('aiPromotionDurationValue').value) || 7;
      updates.aiPromotionDurationUnit = document.getElementById('aiPromotionDurationUnit').value || 'days';
      updates.aiDailyQuestionLimit = parseInt(document.getElementById('aiDailyQuestionLimit').value) || 50;
      updates.showAiBetaNotice = document.getElementById('showAiBetaNotice').checked;
    } else if (section === 'premium-trial') {
      updates.enablePremiumSystem = document.getElementById('enablePremiumSystem').checked;
      // freeTrialDurationDays removed - no longer used
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
