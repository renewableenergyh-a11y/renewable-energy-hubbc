/**
 * Notification Service
 * Handles notification creation, display, and management
 */

class NotificationService {
  constructor() {
    this.notifications = [];
    this.isInitialized = false;
    this.pollInterval = null;
    // Detect API base URL
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      this.apiBase = 'http://localhost:8787/api';
    } else {
      this.apiBase = '/api';
    }
  }

  /**
   * Initialize the notification service
   */
  async init() {
    if (this.isInitialized) return;
    
    try {
      const token = localStorage.getItem('authToken');
      const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
      
      if (!token || !isLoggedIn) {
        console.log('NotificationService: User not logged in, skipping init');
        return;
      }

      // Initial load
      await this.fetchNotifications();

      // Poll for new notifications every 30 seconds
      this.pollInterval = setInterval(() => {
        this.fetchNotifications().catch(err => {
          console.warn('Notification poll error:', err);
        });
      }, 30000);

      this.isInitialized = true;
      console.log('✓ NotificationService initialized');
    } catch (err) {
      console.error('Failed to initialize NotificationService:', err);
    }
  }

  /**
   * Fetch notifications from server
   */
  async fetchNotifications() {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(`${this.apiBase}/notifications`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Notification fetch: Unauthorized');
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      this.notifications = data.notifications || [];
      
      // Update badge
      this.updateBadge(data.unreadCount || 0);
      
      return this.notifications;
    } catch (err) {
      console.warn('Error fetching notifications:', err);
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId) {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(`${this.apiBase}/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Update local state
      const notification = this.notifications.find(n => n._id === notificationId);
      if (notification) {
        notification.read = true;
      }

      return await response.json();
    } catch (err) {
      console.warn('Error marking notification as read:', err);
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId) {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(`${this.apiBase}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Update local state
      this.notifications = this.notifications.filter(n => n._id !== notificationId);

      return await response.json();
    } catch (err) {
      console.warn('Error deleting notification:', err);
    }
  }

  /**
   * Update the notification badge count
   */
  updateBadge(count) {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;

    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  /**
   * Show a toast notification popup
   */
  showToastNotification(title, message, type = 'info', duration = 5000) {
    try {
      // Create toast container if it doesn't exist
      let toastContainer = document.getElementById('toast-notification-container');
      if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-notification-container';
        toastContainer.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 10px;
        `;
        document.body.appendChild(toastContainer);
      }

      // Create toast element
      const toast = document.createElement('div');
      // Use site theme color (#00796b) for success/certificate notifications
      const bgColor = type === 'success' ? '#00796b' : type === 'error' ? '#f44336' : '#2196F3';
      const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
      
      toast.style.cssText = `
        background: ${bgColor};
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;

      toast.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <span style="font-size: 20px; font-weight: bold; flex-shrink: 0;">${icon}</span>
          <div style="flex: 1;">
            <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
            <div style="font-size: 14px; opacity: 0.9;">${message}</div>
          </div>
        </div>
      `;

      toastContainer.appendChild(toast);

      // Add animation styles if not already added
      if (!document.querySelector('style[data-toast-styles]')) {
        const style = document.createElement('style');
        style.setAttribute('data-toast-styles', 'true');
        style.textContent = `
          @keyframes slideInRight {
            from {
              transform: translateX(400px);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          @keyframes slideOutRight {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(400px);
              opacity: 0;
            }
          }
        `;
        document.head.appendChild(style);
      }

      // Auto-remove after duration
      setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    } catch (err) {
      console.warn('Error showing toast notification:', err);
    }
  }

  /**
   * Show the notification modal
   */
  showModal() {
    let modal = document.getElementById('notifications-modal');
    
    if (!modal) {
      modal = this.createModal();
      document.body.appendChild(modal);
    }

    this.populateModal();
    modal.classList.add('show');
  }

  /**
   * Hide the notification modal
   */
  hideModal() {
    const modal = document.getElementById('notifications-modal');
    if (!modal) return;

    modal.classList.remove('show');
  }

  /**
   * Create the notification modal HTML
   */
  createModal() {
    const modal = document.createElement('div');
    modal.id = 'notifications-modal';
    modal.className = 'notifications-modal';
    modal.innerHTML = `
      <div class="notifications-modal-overlay"></div>
      <div class="notifications-modal-container">
        <div class="notifications-modal-header">
          <h2>Notifications</h2>
          <button class="notifications-close-btn" aria-label="Close notifications">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="notifications-modal-content" id="notifications-list">
          <div class="notifications-empty">
            <i class="fas fa-bell"></i>
            <p>No notifications yet</p>
          </div>
        </div>
      </div>
    `;

    // Close on overlay click
    const overlay = modal.querySelector('.notifications-modal-overlay');
    overlay.addEventListener('click', () => this.hideModal());

    // Close on button click
    const closeBtn = modal.querySelector('.notifications-close-btn');
    closeBtn.addEventListener('click', () => this.hideModal());

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('show')) {
        this.hideModal();
      }
    });

    return modal;
  }

  /**
   * Populate the modal with notifications
   */
  populateModal() {
    const container = document.getElementById('notifications-list');
    if (!container) return;

    if (this.notifications.length === 0) {
      container.innerHTML = `
        <div class="notifications-empty">
          <i class="fas fa-bell"></i>
          <p>No notifications yet</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.notifications
      .map(notif => this.createNotificationItem(notif))
      .join('');

    // Add event listeners
    container.querySelectorAll('.notification-item').forEach(item => {
      const notifId = item.dataset.id;
      const notification = this.notifications.find(n => n._id === notifId);

      // Mark as read on click
      if (notification && !notification.read) {
        item.addEventListener('click', () => {
          this.markAsRead(notifId);
          item.classList.add('read');
        });
      }

      // View button - show full message in modal
      const viewBtn = item.querySelector('.notification-action-btn');
      if (viewBtn) {
        viewBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          e.preventDefault();
          
          // Mark as read immediately when viewing
          if (notification && !notification.read) {
            await this.markAsRead(notifId);
            item.classList.add('read');
          }
          
          this.showDetailedView(notification);
        });
      }

      // Delete button
      const deleteBtn = item.querySelector('.notification-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.deleteNotification(notifId);
          item.remove();
          
          // Show empty state if no notifications
          if (container.querySelectorAll('.notification-item').length === 0) {
            container.innerHTML = `
              <div class="notifications-empty">
                <i class="fas fa-bell"></i>
                <p>No notifications yet</p>
              </div>
            `;
          }
        });
      }
    });
  }

  /**
   * Show detailed view of a notification
   */
  showDetailedView(notification) {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'notification-detail-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'notification-detail-modal';
    
    const date = new Date(notification.createdAt);
    const dateStr = date.toLocaleString();
    
    const iconMap = {
      'achievement': 'fa-trophy',
      'course': 'fa-book',
      'progress': 'fa-chart-line',
      'welcome': 'fa-hand-paper',
      'offer': 'fa-tag',
      'certificate': 'fa-certificate',
      'module': 'fa-graduation-cap'
    };
    
    const icon = notification.icon || iconMap[notification.type] || 'fa-bell';
    
    // Determine button text and URL based on notification type
    let actionButton = '';
    const data = notification.data || {};
    
    switch(notification.type) {
      case 'course':
        // For new courses - show "Explore Course" button that takes to courses page filtered
        actionButton = `
          <div class="notification-detail-actions">
            <a href="/courses.html#${data.courseSlug}" class="notification-detail-action-btn">
              <i class="fas fa-graduation-cap"></i> Explore Course
            </a>
          </div>
        `;
        break;
      case 'module':
        // For new modules - show "View Module" button
        actionButton = `
          <div class="notification-detail-actions">
            <a href="/module.html?id=${data.courseId}" class="notification-detail-action-btn">
              <i class="fas fa-book-open"></i> View Module
            </a>
          </div>
        `;
        break;
      case 'certificate':
        // For certificates - show "View Certificate" button
        actionButton = `
          <div class="notification-detail-actions">
            <a href="/account.html" class="notification-detail-action-btn">
              <i class="fas fa-medal"></i> View Certificate
            </a>
          </div>
        `;
        break;
      case 'achievement':
        // For leaderboard-related achievements (points, level, rank) - show "View Leaderboard"
        // For other achievements - show "View Progress"
        const isLeaderboardRelated = notification.title.includes('Points') || 
                                     notification.title.includes('Level') || 
                                     notification.title.includes('Rank') || 
                                     notification.title.includes('#1');
        actionButton = `
          <div class="notification-detail-actions">
            <a href="${isLeaderboardRelated ? '/leaderboard.html' : '/progress.html'}" class="notification-detail-action-btn">
              <i class="fas ${isLeaderboardRelated ? 'fa-trophy' : 'fa-chart-line'}"></i> ${isLeaderboardRelated ? 'View Leaderboard' : 'View Progress'}
            </a>
          </div>
        `;
        break;
      case 'mention':
        // For mentions - show "View Comment" button
        // Note: highlightComment param is already in the actionUrl from server
        console.log('📌 Mention notification actionUrl:', notification.actionUrl);
        actionButton = `
          <div class="notification-detail-actions">
            <a href="${notification.actionUrl}" class="notification-detail-action-btn">
              <i class="fas fa-comment"></i> View Comment
            </a>
          </div>
        `;
        break;
      default:
        if (notification.actionUrl) {
          actionButton = `
            <div class="notification-detail-actions">
              <a href="${notification.actionUrl}" class="notification-detail-action-btn">
                <i class="fas fa-arrow-right"></i> Learn More
              </a>
            </div>
          `;
        }
    }
    
    modal.innerHTML = `
      <div class="notification-detail-content">
        <div class="notification-detail-header">
          <div class="notification-detail-icon">
            <i class="fas ${icon}"></i>
          </div>
          <button class="notification-detail-close" aria-label="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <h2 class="notification-detail-title">${escapeHtml(notification.title)}</h2>
        <p class="notification-detail-date">${dateStr}</p>
        <div class="notification-detail-body">
          <p>${escapeHtml(notification.message)}</p>
        </div>
        ${actionButton}
      </div>
    `;
    
    // Add to DOM
    modalOverlay.appendChild(modal);
    document.body.appendChild(modalOverlay);
    
    // Close handlers
    const closeBtn = modal.querySelector('.notification-detail-close');
    closeBtn?.addEventListener('click', () => {
      modalOverlay.remove();
    });
    
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        modalOverlay.remove();
      }
    });
  }

  /**
   * Create a single notification item HTML
   */
  createNotificationItem(notif) {
    const date = new Date(notif.createdAt);
    const timeStr = this.getRelativeTime(date);
    const unreadClass = notif.read ? '' : 'unread';
    
    const iconMap = {
      'achievement': 'fa-trophy',
      'course': 'fa-book',
      'progress': 'fa-chart-line',
      'welcome': 'fa-hand-paper',
      'offer': 'fa-tag',
      'certificate': 'fa-certificate'
    };

    const icon = notif.icon || iconMap[notif.type] || 'fa-bell';
    const actionBtn = `<button class="notification-action-btn" title="View full message">View</button>`;

    return `
      <div class="notification-item ${unreadClass}" data-id="${notif._id}">
        <div class="notification-icon">
          <i class="fas ${icon}"></i>
        </div>
        <div class="notification-content">
          <h3 class="notification-title">${escapeHtml(notif.title)}</h3>
          <p class="notification-message">${escapeHtml(notif.message)}</p>
          <small class="notification-time">${timeStr}</small>
        </div>
        <div class="notification-actions">
          ${actionBtn}
          <button class="notification-delete" title="Delete notification">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Get relative time string (e.g., "2 hours ago")
   */
  getRelativeTime(date) {
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  }

  /**
   * Clean up service
   */
  destroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.isInitialized = false;
  }
}

// Create global instance
const notificationService = new NotificationService();
