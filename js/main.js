// ================== LOGIN PROTECTION FOR COURSES ==================
// Intercept all clicks to courses.html from navigation links
document.addEventListener('click', function(e) {
  const target = e.target.closest('a[href="courses.html"]');
  if (target && !target.hasAttribute('onclick')) {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    
    if (!isLoggedIn) {
      e.preventDefault();
      window.location.href = `login.html?redirect=${encodeURIComponent('courses.html')}`;
    }
  }
}, true);
// ====================================================================

// Modal utility functions
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function showModal(options) {
  const { type = 'info', title, message, onConfirm, onCancel } = options;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  // Check if dark mode is enabled
  const isDarkMode = document.body.classList.contains('dark');
  
  // Apply dark mode to overlay
  if (isDarkMode) {
    overlay.style.background = 'rgba(0, 0, 0, 0.8)';
  }
  
  const icons = {
    success: '✓',
    warning: '⚠',
    error: '✕',
    info: 'ℹ'
  };
  
  const iconColor = {
    success: 'success',
    warning: 'warning',
    error: 'error',
    info: 'info'
  };

  const content = document.createElement('div');
  content.className = 'modal-content';
  
  // Apply dark mode styles directly if needed
  if (isDarkMode) {
    content.style.setProperty('background', '#1a1f2e', 'important');
    content.style.setProperty('color', '#e6f7ef', 'important');
    content.style.setProperty('border-color', 'rgba(255, 255, 255, 0.1)', 'important');
  }
  
  content.innerHTML = `
    <div class="modal-icon ${iconColor[type]}">${icons[type]}</div>
    <h2 class="modal-title">${escapeHtml(title)}</h2>
    <p class="modal-message">${escapeHtml(message)}</p>
    <div class="modal-buttons">
      ${onCancel ? '<button class="modal-btn modal-btn-secondary" id="modal-cancel">Cancel</button>' : ''}
      ${onConfirm ? `<button class="modal-btn modal-btn-primary" id="modal-confirm">${onCancel ? 'Confirm' : 'OK'}</button>` : ''}
    </div>
  `;
  
  overlay.appendChild(content);
  document.body.appendChild(overlay);
  
  // Apply dark mode styles to child elements
  if (isDarkMode) {
    const titleEl = content.querySelector('.modal-title');
    const messageEl = content.querySelector('.modal-message');
    const buttonSecondary = content.querySelector('.modal-btn-secondary');
    
    if (titleEl) titleEl.style.setProperty('color', '#e6f7ef', 'important');
    if (messageEl) messageEl.style.setProperty('color', '#9fb6c6', 'important');
    
    if (buttonSecondary) {
      buttonSecondary.style.setProperty('background', 'rgba(255, 255, 255, 0.1)', 'important');
      buttonSecondary.style.setProperty('color', '#e6f7ef', 'important');
      buttonSecondary.style.setProperty('border-color', 'rgba(255, 255, 255, 0.15)', 'important');
    }
  }
  
  // Add modal styles if not already present
  if (!document.getElementById('modal-styles')) {
    const style = document.createElement('style');
    style.id = 'modal-styles';
    style.textContent = `
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        animation: fadeIn 0.2s ease;
        backdrop-filter: blur(3px);
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .modal-content, .modal-content.edit-modal-inner {
        background: white;
        border-radius: 16px;
        box-shadow: 0 25px 70px rgba(0, 0, 0, 0.35);
        padding: 28px;
        max-width: 380px;
        text-align: center;
        animation: slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        border: 1px solid rgba(0, 0, 0, 0.05);
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .modal-icon {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
        font-size: 32px;
        font-weight: bold;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        animation: iconPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      @keyframes iconPop {
        0% { transform: scale(0.3) rotate(-20deg); opacity: 0; }
        50% { transform: scale(1.1); }
        100% { transform: scale(1) rotate(0); opacity: 1; }
      }
      .modal-icon.success { 
        background: linear-gradient(135deg, #ecfdf5, #dbeafe);
        color: #059669;
      }
      .modal-icon.warning { 
        background: linear-gradient(135deg, #fef3c7, #fef08a);
        color: #d97706;
      }
      .modal-icon.error { 
        background: linear-gradient(135deg, #fee2e2, #fecaca);
        color: #dc2626;
      }
      .modal-icon.info { 
        background: linear-gradient(135deg, #dbeafe, #bfdbfe);
        color: #0284c7;
      }
      .modal-title { font-size: 22px; font-weight: 700; color: #1f2937; margin: 0 0 12px 0; letter-spacing: -0.5px; }
      .modal-message { font-size: 15px; color: #6b7280; margin: 0 0 28px 0; line-height: 1.6; }
      .modal-buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
      .modal-btn {
        padding: 12px 28px;
        border: none;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        min-width: 100px;
      }
      .modal-btn-primary { 
        background: linear-gradient(135deg, #00796b, #0d8b7f);
        color: white;
        box-shadow: 0 6px 20px rgba(0, 121, 107, 0.3);
      }
      .modal-btn-primary:hover { 
        background: linear-gradient(135deg, #004d40, #00796b);
        transform: translateY(-3px);
        box-shadow: 0 10px 30px rgba(0, 121, 107, 0.4);
      }
      .modal-btn-primary:active { transform: translateY(-1px); }
      .modal-btn-secondary { 
        background: #f3f4f6;
        color: #374151;
        border: 2px solid #e5e7eb;
      }
      .modal-btn-secondary:hover { 
        background: #e5e7eb;
        border-color: #d1d5db;
        transform: translateY(-2px);
      }
      
      /* Dark mode styles for modals */
      body.dark .modal-overlay {
        background: rgba(0, 0, 0, 0.8) !important;
      }
      
      body.dark .modal-content, 
      body.dark .modal-content.edit-modal-inner {
        background: #1a1f2e !important;
        border-color: rgba(255, 255, 255, 0.1) !important;
        box-shadow: 0 25px 70px rgba(0, 0, 0, 0.6) !important;
      }
      
      body.dark .modal-title { 
        color: #e6f7ef !important;
      }
      
      body.dark .modal-message { 
        color: #9fb6c6 !important;
      }
      
      body.dark .modal-icon.success { 
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(34, 197, 94, 0.2)) !important;
        color: #10b981 !important;
      }
      
      body.dark .modal-icon.warning { 
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(251, 191, 36, 0.2)) !important;
        color: #f59e0b !important;
      }
      
      body.dark .modal-icon.error { 
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(248, 113, 113, 0.2)) !important;
        color: #ef4444 !important;
      }
      
      body.dark .modal-icon.info { 
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(96, 165, 250, 0.2)) !important;
        color: #3b82f6 !important;
      }
      
      body.dark .modal-btn-secondary { 
        background: rgba(255, 255, 255, 0.1) !important;
        color: #e6f7ef !important;
        border-color: rgba(255, 255, 255, 0.15) !important;
      }
      
      body.dark .modal-btn-secondary:hover { 
        background: rgba(255, 255, 255, 0.15) !important;
        border-color: rgba(255, 255, 255, 0.25) !important;
        transform: translateY(-2px);
      }
      
      /* Mobile responsive - reduce modal size */
      @media (max-width: 480px) {
        .modal-content, .modal-content.edit-modal-inner {
          max-width: 85vw;
          padding: 20px;
          margin: 16px;
        }
        .modal-icon {
          width: 60px;
          height: 60px;
          font-size: 28px;
          margin: 0 auto 16px;
        }
        .modal-title { 
          font-size: 18px; 
          margin-bottom: 10px;
        }
        .modal-message { 
          font-size: 14px; 
          margin-bottom: 20px;
        }
        .modal-buttons { 
          gap: 8px; 
        }
        .modal-btn { 
          padding: 10px 16px; 
          font-size: 13px;
          min-width: 80px;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  const handleConfirm = () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  };
  
  const handleCancel = () => {
    overlay.remove();
    if (onCancel) onCancel();
  };
  
  const confirmBtn = content.querySelector('#modal-confirm');
  const cancelBtn = content.querySelector('#modal-cancel');
  
  if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
  if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleCancel();
  });
  
  // Add Enter key support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (confirmBtn) handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }, { once: true });
  
  if (confirmBtn) confirmBtn.focus();
}

function showAlert(title, message, type = 'info') {
  return new Promise((resolve) => {
    showModal({
      type,
      title,
      message,
      onConfirm: resolve
    });
  });
}

function showConfirm(title, message, type = 'warning') {
  return new Promise((resolve) => {
    showModal({
      type,
      title,
      message,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false)
    });
  });
}

// Centralized logout flow used by all logout buttons
let __authHeartbeatId = null;
const AUTH_HEARTBEAT_INTERVAL = 10000; // 10s

function stopAuthHeartbeat() {
  try {
    if (__authHeartbeatId) {
      clearInterval(__authHeartbeatId);
      __authHeartbeatId = null;
    }
  } catch (e) { /* ignore */ }
}

function startAuthHeartbeat() {
  try {
    if (__authHeartbeatId) return; // already running
    const token = localStorage.getItem('authToken');
    if (!token || localStorage.getItem('isLoggedIn') !== 'true') return;
    const apiBase = window.API_BASE || '/api';
    __authHeartbeatId = setInterval(async () => {
      try {
        const resp = await fetch(`${apiBase}/auth/me`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        if (!resp.ok) {
          // token invalidated (revoked/deleted)
          stopAuthHeartbeat();
          try { await showAlert('Session Ended', 'Your session has been terminated. You have been logged out.', 'warning'); } catch (e) {}
          // perform local logout and redirect
          try { performLogout(); } catch (e) { /* ignore */ }
        } else {
          // update local stored user info if available
          try {
            const data = await resp.json();
            if (data && data.user) {
              localStorage.setItem('currentUser', JSON.stringify(data.user));
              localStorage.setItem('hasPremium', data.user.hasPremium ? 'true' : 'false');
            }
          } catch (e) { /* ignore json parse errors */ }
        }
      } catch (e) {
        // network hiccup - ignore and retry
        console.warn('Auth heartbeat check failed', e);
      }
    }, AUTH_HEARTBEAT_INTERVAL);
  } catch (e) { console.warn('Failed to start auth heartbeat', e); }
}

async function performLogout({ isAdmin = false, message = null } = {}) {
  try {
    stopAuthHeartbeat();
    if (isAdmin) {
      localStorage.setItem('isAdmin', 'false');
      localStorage.removeItem('adminEmail');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminName');
      localStorage.removeItem('adminRole');
      localStorage.removeItem('adminData');
    } else {
      localStorage.setItem('isLoggedIn', 'false');
      localStorage.setItem('userEmail', '');
      localStorage.setItem('hasPremium', 'false');
    }
    try { localStorage.removeItem('authToken'); localStorage.removeItem('currentUser'); } catch (e) {}
    const alertMsg = message || 'You have been successfully logged out.';
    try { await showAlert('Logged Out', alertMsg, 'info'); } catch (e) {}
  } catch (e) {
    // ignore alert errors
  }
  try { if (typeof updateNavUI === 'function') updateNavUI(); } catch (e) {}
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {

  // ===== INITIALIZE STORAGE =====
  // Log current state
  console.log('📦 localStorage at DOMContentLoaded:', {
    isLoggedIn: localStorage.getItem('isLoggedIn'),
    isAdmin: localStorage.getItem('isAdmin'),
    authToken: localStorage.getItem('authToken') ? '(token exists)' : '(no token)',
    hasPremium: localStorage.getItem('hasPremium')
  });

  if (!localStorage.getItem('isLoggedIn')) {
    localStorage.setItem('isLoggedIn', 'false');
  }
  if (!localStorage.getItem('hasPremium')) {
    localStorage.setItem('hasPremium', 'false');
  }
  if (!localStorage.getItem('authToken')) {
    localStorage.setItem('authToken', '');
  }
  if (!localStorage.getItem('isAdmin')) {
    localStorage.setItem('isAdmin', 'false');
  }
  let loggedIn = localStorage.getItem('isLoggedIn') === 'true';
  let hasPremium = localStorage.getItem('hasPremium') === 'true';

  // ===== NAV UI UPDATER =====
  function updateNavUI() {
    try {
      // Skip on admin dashboard which has its own nav management
      if (window._skipGlobalNavUI) {
        console.log('⏭️  Skipping updateNavUI (admin dashboard)');
        return;
      }

      const loggedInNow = localStorage.getItem('isLoggedIn') === 'true';
      const hasPremiumNow = localStorage.getItem('hasPremium') === 'true';
      const isAdminNow = localStorage.getItem('isAdmin') === 'true';
      const authToken = localStorage.getItem('authToken');

      console.log('🔍 updateNavUI check: isAdminNow=%s, loggedInNow=%s, hasToken=%s', isAdminNow, loggedInNow, !!authToken);
      console.log('   Detailed state: isAdmin=%s, isLoggedIn=%s, authToken=%s, hasPremium=%s', 
        localStorage.getItem('isAdmin'), 
        localStorage.getItem('isLoggedIn'), 
        localStorage.getItem('authToken') ? '(exists)' : '(missing)', 
        localStorage.getItem('hasPremium'));

      const nav = document.querySelector('header nav') || document.getElementById('nav-menu');
      console.log('🔍 Found nav element:', nav ? (nav.id || 'header nav') : 'NOT FOUND');
      if (!nav) {
        console.error('❌ Could not find nav element');
        return;
      }

      // Remove stale logout if exists
      const existingLogout = document.getElementById('logout-btn');
      if (existingLogout) {
        console.log('  ♻️ Removing stale logout button');
        existingLogout.remove();
      }

      // Remove stale account link if exists
      const existingAccount = nav.querySelector('a[href="account.html"]');
      if (existingAccount) {
        console.log('  ♻️ Removing stale account link');
        existingAccount.remove();
      }

      // Remove stale bookmarks link if exists
      const existingBookmarks = nav.querySelector('a[href="bookmarks.html"]');
      if (existingBookmarks) {
        console.log('  ♻️ Removing stale bookmarks link');
        existingBookmarks.remove();
      }

      // Remove stale progress link if exists
      const existingProgress = nav.querySelector('a[href="progress.html"]');
      if (existingProgress) {
        console.log('  ♻️ Removing stale progress link');
        existingProgress.remove();
      }

      // Remove stale leaderboard link if exists
      const existingLeaderboard = nav.querySelector('a[href="leaderboard.html"]');
      if (existingLeaderboard) {
        console.log('  ♻️ Removing stale leaderboard link');
        existingLeaderboard.remove();
      }

      // Hide/show login and premium links based on status
      // Prefer explicit IDs when available; fall back to href selectors
      const loginLink = document.getElementById('nav-login-link') || nav.querySelector('a[href="login.html"]');
      const registerLink = document.getElementById('nav-register-link') || nav.querySelector('a[href="register.html"]');
      const premiumLink = document.getElementById('nav-premium-btn') || nav.querySelector('a[href="billing.html"]');
      console.log('  Links found - login: %s, register: %s, premium: %s', loginLink ? 'YES' : 'NO', registerLink ? 'YES' : 'NO', premiumLink ? 'YES' : 'NO');

      if (isAdminNow) {
        // Admin is signed in — hide most public links, NO logout button (admin uses admin-dashboard logout)
        console.log('👑 Admin detected: hiding user links');
        if (loginLink) loginLink.style.display = 'none';
        if (premiumLink) premiumLink.style.display = 'none';
        // hide register link too
        if (registerLink) registerLink.style.display = 'none';
        // Clear dropdown container for admin
        const dropdownContainer = document.getElementById('nav-dropdown-container');
        if (dropdownContainer) {
          dropdownContainer.innerHTML = '';
        }
        // DO NOT add logout button here - admins must logout from admin dashboard
      } else if (loggedInNow && authToken) {
        // Real user login (has BOTH isLoggedIn flag AND valid token)
        console.log('👤 User logged in: showing dropdown menu');
        if (loginLink) { 
          console.log('  - Hiding login link for logged-in user');
          loginLink.style.display = 'none';
        }
        if (registerLink) {
          console.log('  - Hiding register link for logged-in user');
          registerLink.style.display = 'none';
        }
        // Hide premium link from nav (will be in dropdown instead)
        if (premiumLink) premiumLink.style.display = 'none';

        // Create dropdown container
        const dropdownContainer = document.getElementById('nav-dropdown-container');
        if (dropdownContainer) {
          dropdownContainer.innerHTML = '';
          
          // Create main dropdown div
          const dropdown = document.createElement('div');
          dropdown.className = 'nav-dropdown';
          
          // Create dropdown button
          const dropdownBtn = document.createElement('button');
          dropdownBtn.className = 'nav-dropdown-btn';
          dropdownBtn.innerHTML = `<i class="fas fa-user-circle"></i> My Account <span class="nav-dropdown-arrow">▼</span>`;
          dropdownBtn.setAttribute('aria-haspopup', 'true');
          dropdownBtn.setAttribute('aria-expanded', 'false');
          
          // Create dropdown menu
          const dropdownMenu = document.createElement('div');
          dropdownMenu.className = 'nav-dropdown-menu';
          
          // Account link
          const accountLink = document.createElement('a');
          accountLink.href = 'account.html';
          accountLink.textContent = 'Account';
          dropdownMenu.appendChild(accountLink);
          
          // Bookmarks link
          const bookmarksLink = document.createElement('a');
          bookmarksLink.href = 'bookmarks.html';
          bookmarksLink.innerHTML = '<i class="fas fa-bookmark"></i> Bookmarks';
          dropdownMenu.appendChild(bookmarksLink);
          
          // Discussions link
          const discussionsLink = document.createElement('a');
          discussionsLink.href = 'discussions.html';
          discussionsLink.innerHTML = '<i class="fas fa-comments"></i> Live Discussions';
          dropdownMenu.appendChild(discussionsLink);
          
          // Progress link
          const progressLink = document.createElement('a');
          progressLink.href = 'progress.html';
          progressLink.innerHTML = '<i class="fas fa-chart-line"></i> Progress';
          dropdownMenu.appendChild(progressLink);
          
          // Leaderboard link
          const leaderboardLink = document.createElement('a');
          leaderboardLink.href = 'leaderboard.html';
          leaderboardLink.innerHTML = '<i class="fas fa-trophy"></i> Leaderboard';
          dropdownMenu.appendChild(leaderboardLink);
          
          // Premium link (only show if user doesn't have premium)
          if (!hasPremiumNow) {
            const premiumLinkDropdown = document.createElement('a');
            premiumLinkDropdown.href = 'billing.html';
            premiumLinkDropdown.className = 'nav-premium-link';
            premiumLinkDropdown.innerHTML = '<i class="fas fa-crown"></i> Go Premium';
            dropdownMenu.appendChild(premiumLinkDropdown);
          }
          
          // Logout button
          const logoutBtn = document.createElement('button');
          logoutBtn.id = 'logout-btn';
          logoutBtn.textContent = 'Logout';
          logoutBtn.addEventListener('click', async (e) => { 
            e.preventDefault();
            // Close dropdown first
            dropdown.classList.remove('active');
            dropdownBtn.setAttribute('aria-expanded', 'false');
            const confirmed = await showConfirm('Logout', 'Are you sure you want to logout? Make sure to save any unsaved work.', 'warning');
            if (confirmed) performLogout({ isAdmin: false });
          });
          dropdownMenu.appendChild(logoutBtn);
          
          // Toggle dropdown on button click
          dropdownBtn.addEventListener('click', (e) => {
            e.preventDefault();
            dropdown.classList.toggle('active');
            dropdownBtn.setAttribute('aria-expanded', dropdown.classList.contains('active'));
          });
          
          // Close dropdown when a link is clicked
          Array.from(dropdownMenu.querySelectorAll('a')).forEach(link => {
            link.addEventListener('click', () => {
              dropdown.classList.remove('active');
              dropdownBtn.setAttribute('aria-expanded', 'false');
            });
          });
          
          // Close dropdown when clicking outside (with proper event delegation)
          const closeDropdownOnClickOutside = (e) => {
            if (!dropdown.contains(e.target)) {
              dropdown.classList.remove('active');
              dropdownBtn.setAttribute('aria-expanded', 'false');
            }
          };
          document.addEventListener('click', closeDropdownOnClickOutside);
          
          dropdown.appendChild(dropdownBtn);
          dropdown.appendChild(dropdownMenu);
          dropdownContainer.appendChild(dropdown);
        }

        // Create Support dropdown (always show for logged-in users)
        const supportDropdown = document.createElement('div');
        supportDropdown.className = 'nav-dropdown';
        
        const supportDropdownBtn = document.createElement('button');
        supportDropdownBtn.className = 'nav-dropdown-btn';
        supportDropdownBtn.innerHTML = `<i class="fas fa-headset"></i> Support <span class="nav-dropdown-arrow">▼</span>`;
        supportDropdownBtn.setAttribute('aria-haspopup', 'true');
        supportDropdownBtn.setAttribute('aria-expanded', 'false');
        
        const supportDropdownMenu = document.createElement('div');
        supportDropdownMenu.className = 'nav-dropdown-menu';
        
        const getHelpLink = document.createElement('a');
        getHelpLink.href = 'help.html';
        getHelpLink.innerHTML = '<i class="fas fa-life-ring"></i> Get help';
        supportDropdownMenu.appendChild(getHelpLink);
        
        const faqLink = document.createElement('a');
        faqLink.href = 'faqs.html';
        faqLink.innerHTML = '<i class="fas fa-question-circle"></i> FAQs';
        supportDropdownMenu.appendChild(faqLink);
        
        supportDropdownBtn.addEventListener('click', (e) => {
          e.preventDefault();
          supportDropdown.classList.toggle('active');
          supportDropdownBtn.setAttribute('aria-expanded', supportDropdown.classList.contains('active'));
        });
        
        Array.from(supportDropdownMenu.querySelectorAll('a')).forEach(link => {
          link.addEventListener('click', () => {
            supportDropdown.classList.remove('active');
            supportDropdownBtn.setAttribute('aria-expanded', 'false');
          });
        });
        
        const closeSupportDropdownOnClickOutside = (e) => {
          if (!supportDropdown.contains(e.target)) {
            supportDropdown.classList.remove('active');
            supportDropdownBtn.setAttribute('aria-expanded', 'false');
          }
        };
        document.addEventListener('click', closeSupportDropdownOnClickOutside);
        
        supportDropdown.appendChild(supportDropdownBtn);
        supportDropdown.appendChild(supportDropdownMenu);
        dropdownContainer.appendChild(supportDropdown);

        // AubieRET AI button for premium users
        const existingAubie = document.getElementById('aubie-assistant-btn');
        if (hasPremiumNow) {
          if (!existingAubie) {
            const aubieBtn = document.createElement('button');
            aubieBtn.id = 'aubie-assistant-btn';
            aubieBtn.innerHTML = `
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" fill="currentColor" />
              </svg>
            `;
            aubieBtn.style.position = 'fixed';
            aubieBtn.style.right = '18px';
            aubieBtn.style.bottom = '28px';
            aubieBtn.style.zIndex = '99999';
            aubieBtn.style.width = '48px';
            aubieBtn.style.height = '48px';
            aubieBtn.style.padding = '0';
            aubieBtn.style.border = 'none';
            aubieBtn.style.borderRadius = '50%';
            aubieBtn.style.display = 'flex';
            aubieBtn.style.alignItems = 'center';
            aubieBtn.style.justifyContent = 'center';
            aubieBtn.style.boxShadow = '0 8px 20px rgba(16,24,40,0.22)';
            aubieBtn.style.background = 'linear-gradient(135deg,#2b6ef6,#6a11cb)';
            aubieBtn.style.color = '#fff';
            aubieBtn.style.cursor = 'pointer';
            aubieBtn.style.fontSize = '18px';
            // ensure page has bottom padding so footer items are not hidden by the floating button
            try {
              const curr = window.getComputedStyle(document.body).paddingBottom || '';
              const currPx = parseInt(curr, 10) || 0;
              if (currPx < 80) document.body.style.paddingBottom = '80px';
            } catch (e) {
              // ignore
            }
            // Tooltip on hover
            aubieBtn.title = 'Aubie RET Assistant';
            aubieBtn.style.transition = 'transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease';
            // Hover/tap visual feedback
            aubieBtn.addEventListener('mouseenter', () => { aubieBtn.style.transform = 'translateY(-3px) scale(1.03)'; aubieBtn.style.boxShadow = '0 12px 30px rgba(16,24,40,0.35)'; });
            aubieBtn.addEventListener('mouseleave', () => { aubieBtn.style.transform = 'none'; aubieBtn.style.boxShadow = '0 8px 22px rgba(16,24,40,0.25)'; });
            aubieBtn.addEventListener('touchstart', () => { aubieBtn.style.transform = 'translateY(-2px) scale(1.02)'; }, {passive:true});
            aubieBtn.addEventListener('touchend', () => { aubieBtn.style.transform = 'none'; }, {passive:true});
            aubieBtn.setAttribute('aria-label', 'Open AubieRET AI assistant');
            aubieBtn.setAttribute('aria-haspopup', 'dialog');
            aubieBtn.tabIndex = 0;

            aubieBtn.addEventListener('click', async () => {
              try {
                const mod = await import('/js/pages/assistant.js');
                if (mod && typeof mod.initAssistant === 'function') {
                  // ensure assistant is initialized and open on first click
                  await mod.initAssistant();
                  const root = document.getElementById('aubie-assistant-root');
                  if (root) {
                    root.classList.remove('closed');
                    setTimeout(() => {
                      const input = document.getElementById('assistant-input');
                      if (input) input.focus();
                    }, 200);
                  }
                }
              } catch (err) {
                console.error('Failed to load assistant:', err);
                await showAlert('Loading Error', 'Unable to load AubieRET AI at this time. Please try again later.', 'error');
              }
            });

            aubieBtn.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aubieBtn.click(); }
            });

            document.body.appendChild(aubieBtn);
          }
        } else {
          if (existingAubie) existingAubie.remove();
        }
      } else {
        // Not logged in and not admin - show Actions dropdown
        console.log('🔓 Not logged in: showing Actions dropdown');
        if (loginLink) { 
          console.log('  - Hiding login link (will be in dropdown)');
          loginLink.style.display = 'none';
        }
        if (registerLink) { 
          console.log('  - Hiding register link (will be in dropdown)');
          registerLink.style.display = 'none';
        }
        if (premiumLink) { 
          console.log('  - Hiding premium link when not logged in');
          premiumLink.style.display = 'none';
        }
        
        // Create dropdown container
        const dropdownContainer = document.getElementById('nav-dropdown-container');
        if (dropdownContainer) {
          dropdownContainer.innerHTML = '';
          
          // Create main dropdown div
          const actionsDropdown = document.createElement('div');
          actionsDropdown.className = 'nav-dropdown';
          
          // Create dropdown button
          const actionsDropdownBtn = document.createElement('button');
          actionsDropdownBtn.className = 'nav-dropdown-btn';
          actionsDropdownBtn.innerHTML = `<i class="fas fa-bolt"></i> Actions <span class="nav-dropdown-arrow">▼</span>`;
          actionsDropdownBtn.setAttribute('aria-haspopup', 'true');
          actionsDropdownBtn.setAttribute('aria-expanded', 'false');
          
          // Create dropdown menu
          const actionsDropdownMenu = document.createElement('div');
          actionsDropdownMenu.className = 'nav-dropdown-menu';
          
          // Login link
          const loginDropdownLink = document.createElement('a');
          loginDropdownLink.href = 'login.html';
          loginDropdownLink.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
          actionsDropdownMenu.appendChild(loginDropdownLink);
          
          // Register link
          const registerDropdownLink = document.createElement('a');
          registerDropdownLink.href = 'register.html';
          registerDropdownLink.innerHTML = '<i class="fas fa-user-plus"></i> Register';
          actionsDropdownMenu.appendChild(registerDropdownLink);
          
          // Toggle dropdown on button click
          actionsDropdownBtn.addEventListener('click', (e) => {
            e.preventDefault();
            actionsDropdown.classList.toggle('active');
            actionsDropdownBtn.setAttribute('aria-expanded', actionsDropdown.classList.contains('active'));
          });
          
          // Close dropdown when a link is clicked
          Array.from(actionsDropdownMenu.querySelectorAll('a')).forEach(link => {
            link.addEventListener('click', () => {
              actionsDropdown.classList.remove('active');
              actionsDropdownBtn.setAttribute('aria-expanded', 'false');
            });
          });
          
          // Close dropdown when clicking outside
          const closeActionsDropdownOnClickOutside = (e) => {
            if (!actionsDropdown.contains(e.target)) {
              actionsDropdown.classList.remove('active');
              actionsDropdownBtn.setAttribute('aria-expanded', 'false');
            }
          };
          document.addEventListener('click', closeActionsDropdownOnClickOutside);
          
          actionsDropdown.appendChild(actionsDropdownBtn);
          actionsDropdown.appendChild(actionsDropdownMenu);
          dropdownContainer.appendChild(actionsDropdown);

          // Create Support dropdown (for non-logged-in users)
          const supportDropdown2 = document.createElement('div');
          supportDropdown2.className = 'nav-dropdown';
          
          const supportDropdownBtn2 = document.createElement('button');
          supportDropdownBtn2.className = 'nav-dropdown-btn';
          supportDropdownBtn2.innerHTML = `<i class="fas fa-headset"></i> Support <span class="nav-dropdown-arrow">▼</span>`;
          supportDropdownBtn2.setAttribute('aria-haspopup', 'true');
          supportDropdownBtn2.setAttribute('aria-expanded', 'false');
          
          const supportDropdownMenu2 = document.createElement('div');
          supportDropdownMenu2.className = 'nav-dropdown-menu';
          
          const getHelpLink2 = document.createElement('a');
          getHelpLink2.href = 'help.html';
          getHelpLink2.innerHTML = '<i class="fas fa-life-ring"></i> Get help';
          supportDropdownMenu2.appendChild(getHelpLink2);
          
          const faqLink2 = document.createElement('a');
          faqLink2.href = 'faqs.html';
          faqLink2.innerHTML = '<i class="fas fa-question-circle"></i> FAQs';
          supportDropdownMenu2.appendChild(faqLink2);
          
          supportDropdownBtn2.addEventListener('click', (e) => {
            e.preventDefault();
            supportDropdown2.classList.toggle('active');
            supportDropdownBtn2.setAttribute('aria-expanded', supportDropdown2.classList.contains('active'));
          });
          
          Array.from(supportDropdownMenu2.querySelectorAll('a')).forEach(link => {
            link.addEventListener('click', () => {
              supportDropdown2.classList.remove('active');
              supportDropdownBtn2.setAttribute('aria-expanded', 'false');
            });
          });
          
          const closeSupportDropdownOnClickOutside2 = (e) => {
            if (!supportDropdown2.contains(e.target)) {
              supportDropdown2.classList.remove('active');
              supportDropdownBtn2.setAttribute('aria-expanded', 'false');
            }
          };
          document.addEventListener('click', closeSupportDropdownOnClickOutside2);
          
          supportDropdown2.appendChild(supportDropdownBtn2);
          supportDropdown2.appendChild(supportDropdownMenu2);
          dropdownContainer.appendChild(supportDropdown2);
        }
        
        // Remove any stale assistant button
        const existingAubie = document.getElementById('aubie-assistant-btn');
        if (existingAubie) existingAubie.remove();
      }
    } catch (err) {
      console.error('❌ Error in updateNavUI:', err);
    }
  }

  // Auto-fill current year in any footer spans with class 'site-year'
  try {
    const yearEls = document.querySelectorAll('.site-year');
    const y = new Date().getFullYear();
    yearEls.forEach(el => { el.textContent = y; });
  } catch (e) {
    console.warn('Failed to set site-year:', e);
  }

  // react to storage changes and custom premium events
  window.addEventListener('storage', updateNavUI);
  window.addEventListener('premiumChanged', updateNavUI);

  // Ensure nav UI updates when the page is restored from bfcache or when tab visibility changes
  window.addEventListener('pageshow', (ev) => { try { updateNavUI(); } catch (e) {} });
  document.addEventListener('visibilitychange', () => { try { if (!document.hidden) updateNavUI(); } catch (e) {} });

  // Run once to initialize nav UI (skip on admin dashboard which has its own nav)
  if (!window._skipGlobalNavUI) {
    updateNavUI();
  }

  // Expose updateNavUI globally so other modules can call it when needed
  window.updateNavUI = updateNavUI;

  // Periodically verify auth token with backend so revoked/deleted users are logged out automatically.
  (async function setupTokenVerifier() {
    // Skip on admin dashboard which has its own session management
    if (window._skipGlobalNavUI) return;
    
    try {
      const auth = await import('./core/auth.js');
      // only start interval when user appears logged in
      if (auth.isLoggedIn && auth.isLoggedIn()) {
        // initial check
        try { await auth.verifyToken(); } catch (e) { try { performLogout(); } catch (err) {} }
        // run every 8s (fast enough to react quickly to forced logout)
        setInterval(async () => { try { await auth.verifyToken(); } catch (e) { try { performLogout(); } catch (err) {} } }, 8000);
      }
      // also listen for login event to start verifier when user logs in
      window.addEventListener('storage', async (ev) => {
        try {
            if (ev.key === 'authToken' || ev.key === 'isLoggedIn') {
            if (auth.isLoggedIn && auth.isLoggedIn()) {
              try { await auth.verifyToken(); } catch (e) { try { performLogout(); } catch (err) {} }
            }
          }
        } catch (e) { /* ignore */ }
      });
    } catch (e) {
      console.warn('Token verifier setup failed', e);
    }
  })();

  // ===== NOTIFICATION SYSTEM SETUP =====
  (async function setupNotifications() {
    try {
      // Initialize notification service
      const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
      const authToken = localStorage.getItem('authToken');
      
      if (isLoggedIn && authToken && typeof notificationService !== 'undefined') {
        // Initialize service
        await notificationService.init();
        
        // Add click handler to notification bell
        const notificationBell = document.getElementById('notification-bell');
        if (notificationBell) {
          notificationBell.addEventListener('click', (e) => {
            e.preventDefault();
            notificationService.showModal();
          });
        }
        
        // Show bell when user is logged in (already hidden by default)
        if (notificationBell) {
          notificationBell.style.display = 'flex';
        }
        
        console.log('✓ Notification system initialized');
      }
    } catch (e) {
      console.warn('Notification system setup warning:', e);
      // Don't break the app if notifications fail
    }
  })();

  // ===== MOBILE NAV TOGGLE =====
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');
  if (navToggle && navMenu) {
    // Ensure toggle is on top and clickable (fixes cases where other elements overlap)
    try {
      navToggle.style.zIndex = navToggle.style.zIndex || '1101';
      navToggle.style.pointerEvents = 'auto';
      navMenu.style.zIndex = navMenu.style.zIndex || '1100';
    } catch (err) {
      /* ignore if inline styles not supported */
    }
    const navIcon = navToggle.querySelector('.nav-icon');
    
    // Function to close the menu
    const closeMenu = () => {
      navMenu.classList.remove('show');
      navIcon.style.transform = 'rotate(0deg)';
      navIcon.textContent = '☰';
    };
    
    // Toggle menu on icon click
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('show');
      const isOpen = navMenu.classList.contains('show');
      navIcon.style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0deg)';
      navIcon.textContent = isOpen ? '✖' : '☰';
    });

    // Close menu when clicking on a link
    document.querySelectorAll('#nav-menu a').forEach(link => {
      link.addEventListener('click', () => {
        if (navMenu.classList.contains('show')) {
          closeMenu();
        }
      });
    });
    
    // Close menu when clicking outside of it
    document.addEventListener('click', (e) => {
      const isClickInside = navMenu.contains(e.target) || navToggle.contains(e.target);
      if (!isClickInside && navMenu.classList.contains('show')) {
        closeMenu();
      }
    });
  }

  // ===== FEATURED COURSES ON HOME =====
  const featuredLessons = document.getElementById('featured-lessons');
  if (featuredLessons) {
    const featured = [
      { title: "Solar Energy", content: "Learn solar energy...", isPremium: false },
      { title: "Wind Energy", content: "Wind energy explained...", isPremium: true },
      { title: "Hydro Energy", content: "Learn hydro energy...", isPremium: false },
      { title: "Biomass Energy", content: "Learn biomass energy...", isPremium: true },
      { title: "Geothermal Energy", content: "Discover geothermal energy...", isPremium: false }
    ];

    featured.forEach(lesson => {
      const div = document.createElement('div');
      div.classList.add('lesson-card');
      div.innerHTML = `
        <h3>${lesson.title}</h3>
        <span class="tag ${lesson.isPremium ? 'premium' : 'free'}">${lesson.isPremium ? 'Premium' : 'Free'}</span>
        <p>${lesson.content}</p>
      `;
      featuredLessons.appendChild(div);
    });
  }

  // ===== LESSONS GRID =====
  const lessonsGrid = document.getElementById('lessons-grid');
  if (lessonsGrid) {
    const lessons = [
      { title: "Solar Power Basics", isPremium: false, description: "Learn how solar panels convert sunlight into energy.", image: "images/solar.jpg", video: "videos/solar-intro.mp4" },
      { title: "Wind Power 101", isPremium: true, description: "Understand the mechanics of wind turbines and wind farms.", image: "images/wind.jpg", video: "" },
      { title: "Hydropower Fundamentals", isPremium: false, description: "Introduction to hydroelectric energy and dams.", image: "images/hydro.jpg", video: "" },
      { title: "Biomass Energy", isPremium: true, description: "Learn how biomass generates sustainable energy.", image: "images/biomass.jpg", video: "" }
    ];

    lessons.forEach(lesson => {
      const card = document.createElement('div');
      card.classList.add('lesson-card');
      card.innerHTML = `
        <img src="${lesson.image}" alt="${lesson.title}" class="lesson-image">
        <h3>${lesson.title}</h3>
        <span class="tag ${lesson.isPremium ? 'premium' : 'free'}">${lesson.isPremium ? 'Premium' : 'Free'}</span>
        <p>${lesson.description}</p>
        <button class="btn-primary" data-title="${lesson.title}" data-premium="${lesson.isPremium}">View Module</button>
      `;
      lessonsGrid.appendChild(card);
    });

    // ===== LESSON CLICK HANDLER =====
    document.querySelectorAll('.lesson-card .btn-primary').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const title = btn.dataset.title;
        const isPremium = btn.dataset.premium === 'true';

        // Premium module logic
        if (isPremium) {
          if (!loggedIn) {
            // Not logged in - go to login
            localStorage.setItem('redirectAfterLogin', 'premium-module');
            localStorage.setItem('intendedModule', title);
            window.location.href = "login.html";
          } else if (!hasPremium) {
            // Logged in but no premium - go to billing
            localStorage.setItem('returnFromBilling', window.location.href);
            window.location.href = "billing.html?upgrade=true";
          } else {
            // Logged in with premium - allow access
            window.location.href = `lesson.html?lesson=${encodeURIComponent(title)}`;
          }
        } else {
          // Free module - direct access
          window.location.href = `lesson.html?lesson=${encodeURIComponent(title)}`;
        }
      });
    });
  }

  // ===== LOGIN FORM =====
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    // Load saved email if remember me was checked
    const emailInput = document.getElementById('email');
    const rememberMeCheckbox = document.getElementById('remember-me');
    const savedEmail = localStorage.getItem('rememberMeEmail');
    
    if (savedEmail && emailInput) {
      emailInput.value = savedEmail;
      if (rememberMeCheckbox) {
        rememberMeCheckbox.checked = true;
      }
      // Auto-focus password field when email is loaded
      const passwordInput = document.getElementById('password');
      if (passwordInput) {
        setTimeout(() => passwordInput.focus(), 100);
      }
    }

    // Check for registration success parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('registered') === 'true') {
      const notice = document.getElementById('login-notice');
      if (notice) {
        notice.className = 'form-notice success';
        notice.textContent = 'Registration successful! Please log in with your credentials.';
      }
    }

    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();
      const rememberMe = document.getElementById('remember-me') && document.getElementById('remember-me').checked;
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const notice = document.getElementById('login-notice');

      function showNotice(type, msg) { 
        if (notice) { 
          notice.className = 'form-notice ' + type; 
          notice.textContent = msg;
          if (type === 'error') {
            notice.classList.add('shake');
            setTimeout(() => notice.classList.remove('shake'), 400);
          }
        } 
      }

      if (!email || !password) { showNotice('error', 'Email and password are required.'); return; }

      submitBtn.disabled = true; submitBtn.textContent = 'Logging in...';

      try {
        const { loginUser } = await import('./core/auth.js');
        const result = await loginUser(email, password);
        if (result.success) {
          // Handle remember me checkbox
          if (rememberMe) {
            localStorage.setItem('rememberMeEmail', email);
          } else {
            localStorage.removeItem('rememberMeEmail');
          }

          if (typeof updateNavUI === 'function') updateNavUI();
          // show confirmation then redirect
          try { await showAlert('Logged In', 'You are now logged in.', 'success'); } catch (e) {}
          
          // Check for redirect parameter in URL (from course access protection)
          const urlParams = new URLSearchParams(window.location.search);
          const redirectUrl = urlParams.get('redirect');
          if (redirectUrl) {
            window.location.href = decodeURIComponent(redirectUrl);
          } else {
            const redirectLesson = localStorage.getItem('redirectLesson');
            if (redirectLesson) {
              localStorage.removeItem('redirectLesson');
              window.location.href = `lesson.html?lesson=${encodeURIComponent(redirectLesson)}`;
            } else {
              window.location.href = 'index.html';
            }
          }
        } else { showNotice('error', 'Login failed: ' + (result.error || 'Unknown error')); submitBtn.disabled = false; submitBtn.textContent = 'Login'; }
      } catch (err) { console.error('Login error:', err); showNotice('error', 'Login failed'); submitBtn.disabled = false; submitBtn.textContent = 'Login'; }
    });
  }

  // ===== PASSWORD STRENGTH INDICATOR =====
  function validatePasswordRequirements(password) {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*]/.test(password)
    };
  }

  function updatePasswordStrength(password) {
    const indicator = document.getElementById('password-strength-indicator');
    const progress = document.getElementById('strength-progress');
    const requirements = document.getElementById('password-requirements');
    
    if (!indicator || !requirements) return;
    
    if (!password) {
      indicator.style.display = 'none';
      return;
    }
    
    indicator.style.display = 'block';
    
    const reqs = validatePasswordRequirements(password);
    const metCount = Object.values(reqs).filter(Boolean).length;
    
    // Update requirement list UI
    const reqMap = {
      'req-length': reqs.length,
      'req-uppercase': reqs.uppercase,
      'req-lowercase': reqs.lowercase,
      'req-number': reqs.number,
      'req-special': reqs.special
    };
    
    Object.entries(reqMap).forEach(([id, isMet]) => {
      const el = document.getElementById(id);
      if (el) {
        if (isMet) {
          el.classList.add('met');
        } else {
          el.classList.remove('met');
        }
      }
    });
    
    // Update strength progress bar
    let strengthClass = '';
    if (metCount === 0) strengthClass = 'weak';
    else if (metCount === 1) strengthClass = 'weak';
    else if (metCount === 2) strengthClass = 'fair';
    else if (metCount === 3) strengthClass = 'good';
    else if (metCount === 4) strengthClass = 'strong';
    else strengthClass = 'very-strong';
    
    progress.className = 'strength-progress ' + strengthClass;
  }

  const passwordInput = document.getElementById('password');
  if (passwordInput) {
    passwordInput.addEventListener('input', (e) => {
      updatePasswordStrength(e.target.value);
    });
  }

  // Hide password strength indicator when confirm password field is focused
  const confirmPasswordInput = document.getElementById('password-confirm');
  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('focus', () => {
      const indicator = document.getElementById('password-strength-indicator');
      if (indicator) {
        indicator.style.display = 'none';
      }
    });
  }

  // ===== REGISTER FORM =====
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    // Load form data from sessionStorage ONLY if coming back from Terms page
    const savedFormData = sessionStorage.getItem('registerFormData');
    const isReturnFromNavigation = sessionStorage.getItem('registerFormDataFromNavigation') === 'true';
    
    if (savedFormData && isReturnFromNavigation) {
      try {
        const formData = JSON.parse(savedFormData);
        if (formData.name) document.getElementById('name').value = formData.name;
        if (formData.email) document.getElementById('email').value = formData.email;
        if (formData.password) document.getElementById('password').value = formData.password;
        if (formData.passwordConfirm) document.getElementById('password-confirm').value = formData.passwordConfirm;
        if (formData.agreeTerms) {
          const agreeTermsCheckbox = document.getElementById('agree-terms');
          if (agreeTermsCheckbox) agreeTermsCheckbox.checked = true;
        }
        if (formData.showPassword) {
          const showPasswordCheckbox = document.getElementById('show-password-register');
          if (showPasswordCheckbox) showPasswordCheckbox.checked = true;
        }
        // Clear the navigation flag after restoring
        sessionStorage.removeItem('registerFormDataFromNavigation');
      } catch (err) {
        console.warn('Failed to restore form data:', err);
        sessionStorage.removeItem('registerFormData');
        sessionStorage.removeItem('registerFormDataFromNavigation');
      }
    } else {
      // Normal page load - clear any saved form data
      sessionStorage.removeItem('registerFormData');
      sessionStorage.removeItem('registerFormDataFromNavigation');
    }

    // Save form data to sessionStorage on input and mark as navigation
    const saveFormData = () => {
      const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        passwordConfirm: (document.getElementById('password-confirm') && document.getElementById('password-confirm').value) || '',
        agreeTerms: (document.getElementById('agree-terms') && document.getElementById('agree-terms').checked) || false,
        showPassword: (document.getElementById('show-password-register') && document.getElementById('show-password-register').checked) || false
      };
      sessionStorage.setItem('registerFormData', JSON.stringify(formData));
      // Mark that this data should be restored if navigating away and coming back
      sessionStorage.setItem('registerFormDataFromNavigation', 'true');
    };

    // Add event listeners to save form data
    document.getElementById('name').addEventListener('input', saveFormData);
    document.getElementById('email').addEventListener('input', saveFormData);
    document.getElementById('password').addEventListener('input', saveFormData);
    if (document.getElementById('password-confirm')) {
      document.getElementById('password-confirm').addEventListener('input', saveFormData);
    }
    const agreeTermsCheckbox = document.getElementById('agree-terms');
    if (agreeTermsCheckbox) {
      agreeTermsCheckbox.addEventListener('change', saveFormData);
    }
    const showPasswordCheckbox = document.getElementById('show-password-register');
    if (showPasswordCheckbox) {
      showPasswordCheckbox.addEventListener('change', saveFormData);
    }

    // New flow: request verification code, then show verification input
    registerForm.addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value.trim();
      const passwordConfirm = (document.getElementById('password-confirm') && document.getElementById('password-confirm').value.trim()) || '';
      const submitBtn = registerForm.querySelector('button[type="submit"]');
      const notice = registerForm.querySelector('.form-notice');

      function showNotice(type, msg) {
        if (notice) { 
          notice.className = 'form-notice ' + type; 
          notice.textContent = msg;
          if (type === 'error') {
            notice.classList.add('shake');
            setTimeout(() => notice.classList.remove('shake'), 400);
          }
        }
      }

      if (!name || !email || !password) {
        showNotice('error', 'All fields are required.');
        return;
      }

      const agreeTerms = document.getElementById('agree-terms');
      if (!agreeTerms || !agreeTerms.checked) {
        showNotice('error', 'You must agree to the Terms of Service to continue.');
        return;
      }

      if (password !== passwordConfirm) {
        showNotice('error', 'Passwords do not match.');
        return;
      }
      
      // Validate password strength
      const passwordReqs = validatePasswordRequirements(password);
      const missingReqs = [];
      if (!passwordReqs.length) missingReqs.push('at least 8 characters');
      if (!passwordReqs.uppercase) missingReqs.push('at least one uppercase letter');
      if (!passwordReqs.lowercase) missingReqs.push('at least one lowercase letter');
      if (!passwordReqs.number) missingReqs.push('at least one number');
      if (!passwordReqs.special) missingReqs.push('at least one special character (!@#$%^&*)');
      
      if (missingReqs.length > 0) {
        showNotice('error', 'Password must have: ' + missingReqs.join(', '));
        return;
      }

      submitBtn.disabled = true; submitBtn.textContent = 'Sending code...';
      try {
        const { registerUser } = await import('./core/auth.js');
        console.log('About to call registerUser with:', { name, email, password: '***' });
        const resp = await registerUser(name, email, password);
        console.log('registerUser response:', resp);
        if (!resp.success) throw new Error(resp.error || 'Failed to send code');

        // Replace form with verification UI
        console.log('Replacing form with verification UI');
        // keep pending registration details for resend
        window._pendingRegistration = { name, email, password };

        registerForm.innerHTML = `
          <h3>Enter verification code</h3>
          <p class="small">A 6-digit code was sent to <strong>${email}</strong>. It expires in 15 minutes.</p>
          <label for="verify-code">Verification Code</label>
          <input type="text" id="verify-code" placeholder="6-digit code" maxlength="6" pattern="[0-9]{6}" required />
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <button id="verify-btn" type="button" class="btn-primary">Verify & Complete Registration</button>
            <button id="resend-register-code" type="button" class="module-search-btn" title="Resend code">Resend</button>
          </div>
          <div class="form-notice info">If you didn't receive the code, check your spam folder.</div>
        `;

        const verifyBtn = document.getElementById('verify-btn');
        const resendRegisterBtn = document.getElementById('resend-register-code');
        const REGISTER_RESEND_SECONDS = 60;
        let registerResendInterval = null;

        function startRegisterResendCountdown(seconds) {
          let remaining = seconds;
          if (resendRegisterBtn) { resendRegisterBtn.disabled = true; resendRegisterBtn.textContent = `Resend (${remaining}s)`; }
          registerResendInterval = setInterval(() => {
            remaining -= 1;
            if (resendRegisterBtn) resendRegisterBtn.textContent = remaining > 0 ? `Resend (${remaining}s)` : 'Resend';
            if (remaining <= 0) {
              clearInterval(registerResendInterval);
              if (resendRegisterBtn) { resendRegisterBtn.disabled = false; resendRegisterBtn.textContent = 'Resend'; }
            }
          }, 1000);
        }

        if (resendRegisterBtn) {
          resendRegisterBtn.addEventListener('click', async (ev) => {
            ev.preventDefault();

            // hide existing notice briefly
            const noticeEl = registerForm.querySelector('.form-notice');
            let prev = null;
            if (noticeEl) { prev = { className: noticeEl.className, text: noticeEl.textContent }; noticeEl.style.display = 'none'; }

            try {
              resendRegisterBtn.disabled = true; resendRegisterBtn.textContent = 'Resending...';
              const pending = window._pendingRegistration || {};
              if (!pending.name || !pending.email || !pending.password) throw new Error('Missing registration data');
              const { registerUser } = await import('./core/auth.js');
              const resp = await registerUser(pending.name, pending.email, pending.password);
              if (noticeEl) noticeEl.style.display = '';
              if (resp && resp.success) {
                const n = registerForm.querySelector('.form-notice');
                if (n) { n.className = 'form-notice info'; n.textContent = 'Code resent — check your email.'; }
                startRegisterResendCountdown(REGISTER_RESEND_SECONDS);
              } else {
                const n = registerForm.querySelector('.form-notice'); if (n) { n.className = 'form-notice error'; n.textContent = resp.error || 'Failed to resend code'; }
                resendRegisterBtn.disabled = false; resendRegisterBtn.textContent = 'Resend';
              }
            } catch (err) {
              console.error('Resend register error', err);
              if (noticeEl) noticeEl.style.display = '';
              const n = registerForm.querySelector('.form-notice'); if (n) { n.className = 'form-notice error'; n.textContent = err.message || 'Error resending code'; }
              resendRegisterBtn.disabled = false; resendRegisterBtn.textContent = 'Resend';
            }
          });
        }

        // start initial countdown when verification UI is shown
        startRegisterResendCountdown(REGISTER_RESEND_SECONDS);
        verifyBtn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          const code = document.getElementById('verify-code').value.trim();
          if (!code) return;
          verifyBtn.disabled = true; verifyBtn.textContent = 'Verifying...';
          try {
            const { verifyRegistration } = await import('./core/auth.js');
            const ok = await verifyRegistration(email, code);
            if (ok.success) {
              // Clear form data from sessionStorage on successful registration
              sessionStorage.removeItem('registerFormData');
              // Registration successful - redirect to login page immediately
              window.location.href = '/login.html?registered=true';
            } else {
              const noticeEl = registerForm.querySelector('.form-notice') || (() => {
                const d = document.createElement('div'); d.className = 'form-notice'; registerForm.appendChild(d); return d;
              })();
              noticeEl.className = 'form-notice error';
              noticeEl.textContent = 'Verification failed: ' + (ok.error || 'Invalid code');
              verifyBtn.disabled = false; verifyBtn.textContent = 'Verify & Complete Registration';
            }
          } catch (err) {
            console.error('Verify error', err);
            const noticeEl = registerForm.querySelector('.form-notice') || (() => {
              const d = document.createElement('div'); d.className = 'form-notice'; registerForm.appendChild(d); return d;
            })();
            noticeEl.className = 'form-notice error';
            noticeEl.textContent = 'Verification failed: ' + (err.message || 'Unknown error');
            verifyBtn.disabled = false; verifyBtn.textContent = 'Verify & Complete Registration';
          }
        });
      } catch (err) {
        console.error('Register request failed', err);
        showNotice('error', err.message || 'Registration request failed');
        submitBtn.disabled = false; submitBtn.textContent = 'Register';
      }
    });
  }

  // ===== DARK MODE =====
  function initThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      const icon = toggleBtn.querySelector('.icon');
      const text = toggleBtn.querySelector('.text');
      const savedTheme = localStorage.getItem('theme') || 'light';

      // Apply saved theme on load
      if (savedTheme === 'dark') {
        document.body.classList.add('dark');
        if (icon) icon.textContent = '☀️';
        if (text) text.textContent = 'Light';
      } else {
        document.body.classList.remove('dark');
        if (icon) icon.textContent = '🌙';
        if (text) text.textContent = 'Dark';
      }

      // Remove any existing listeners by cloning and replacing
      const newToggleBtn = toggleBtn.cloneNode(true);
      toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);

      newToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isDark = document.body.classList.contains('dark');
        document.body.classList.toggle('dark');

        if (document.body.classList.contains('dark')) {
          localStorage.setItem('theme', 'dark');
          if (newToggleBtn.querySelector('.icon')) newToggleBtn.querySelector('.icon').textContent = '☀️';
          if (newToggleBtn.querySelector('.text')) newToggleBtn.querySelector('.text').textContent = 'Light';
        } else {
          localStorage.setItem('theme', 'light');
          if (newToggleBtn.querySelector('.icon')) newToggleBtn.querySelector('.icon').textContent = '🌙';
          if (newToggleBtn.querySelector('.text')) newToggleBtn.querySelector('.text').textContent = 'Dark';
        }
      });
    }
  }

  // Initialize theme toggle when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeToggle);
  } else {
    initThemeToggle();
  }

  // ===== SOCIAL CLICKS TRACKING =====
  document.addEventListener("click", e => {
    const socialLink = e.target.closest("[data-social]");
    if (!socialLink) return;

    const platform = socialLink.dataset.social;
    const clicks = JSON.parse(localStorage.getItem("socialClicks")) || {};
    clicks[platform] = (clicks[platform] || 0) + 1;
    localStorage.setItem("socialClicks", JSON.stringify(clicks));
    console.log("Social clicks:", clicks);
  });

  // ===== SHOW PASSWORD CHECKBOX FOR REGISTER PAGE =====
  const showPasswordCheckbox = document.getElementById('show-password-register');
  if (showPasswordCheckbox) {
    showPasswordCheckbox.addEventListener('change', (e) => {
      const passwordInput = document.getElementById('password');
      const confirmInput = document.getElementById('password-confirm');
      if (e.target.checked) {
        passwordInput.type = 'text';
        confirmInput.type = 'text';
      } else {
        passwordInput.type = 'password';
        confirmInput.type = 'password';
      }
    });
  }

  // ===== SHOW PASSWORD CHECKBOX FOR LOGIN PAGE =====
  const showPasswordLoginCheckbox = document.getElementById('show-password-login');
  if (showPasswordLoginCheckbox) {
    showPasswordLoginCheckbox.addEventListener('change', (e) => {
      const passwordInput = document.querySelector('#login-form #password');
      if (passwordInput) {
        passwordInput.type = e.target.checked ? 'text' : 'password';
      }
    });
  }

  // ===== SCROLL BUTTONS (module.html only) =====
  const scrollTopBtn = document.getElementById('scrollTopBtn');
  const scrollBottomBtn = document.getElementById('scrollBottomBtn');

  if (scrollTopBtn && scrollBottomBtn) {
    // Show/hide scroll buttons based on scroll position
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        scrollTopBtn.classList.add('show');
      } else {
        scrollTopBtn.classList.remove('show');
      }

      if (window.scrollY < document.documentElement.scrollHeight - window.innerHeight - 300) {
        scrollBottomBtn.classList.add('show');
      } else {
        scrollBottomBtn.classList.remove('show');
      }
    });

    // Scroll to top
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Scroll to bottom
    scrollBottomBtn.addEventListener('click', () => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    });
  }

});
