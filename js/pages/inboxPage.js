/**
 * Inbox Page - System Messages for Admin/Superadmin
 * Displays notifications for: user registrations, premium subscriptions, password resets, etc.
 */

import { API_BASE } from '../api-config.js';

const API_URL = API_BASE;

export async function renderInboxPage() {
  const adminRole = localStorage.getItem('adminRole');
  const adminToken = localStorage.getItem('adminToken');

  // Only allow admin and superadmin
  if (!adminRole || (adminRole !== 'admin' && adminRole !== 'superadmin')) {
    return `
      <div class="dashboard-section" style="padding: 40px;">
        <div style="text-align: center; color: var(--text-muted);">
          <p>Access denied. Only admins can view the inbox.</p>
        </div>
      </div>
    `;
  }

  const container = document.createElement('div');
  container.className = 'dashboard-section';
  container.style.padding = '24px';

  // Header
  const header = document.createElement('div');
  header.className = 'dashboard-header';
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(0,0,0,0.08);
  `;
  header.innerHTML = `
    <div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <h2 style="margin: 0; color: var(--text-main);">💬 System Inbox</h2>
        <span id="message-count-badge" style="display: none; background: rgba(220,38,38,0.2); color: #dc2626; border-radius: 20px; padding: 4px 12px; font-size: 12px; font-weight: 600;"></span>
      </div>
      <p style="margin: 8px 0 0 0; color: var(--text-muted); font-size: 14px;">System notifications and user activity</p>
    </div>
    <div style="display: flex; gap: 12px;">
      <button id="inbox-refresh-btn" style="padding: 10px 16px; border: none; border-radius: 6px; cursor: pointer; background: rgba(0,121,107,0.1); color: var(--green-main); font-weight: 500; transition: all 0.2s; display: flex; align-items: center; gap: 6px;">
        <i class="fas fa-sync-alt"></i> Refresh
      </button>
      <button id="inbox-clear-btn" style="padding: 10px 16px; border: none; border-radius: 6px; cursor: pointer; background: rgba(220,38,38,0.1); color: #dc2626; font-weight: 500; transition: all 0.2s; display: flex; align-items: center; gap: 6px;">
        <i class="fas fa-trash"></i> Clear All
      </button>
    </div>
  `;
  container.appendChild(header);

  // Filter tabs
  const filterContainer = document.createElement('div');
  filterContainer.id = 'inbox-filters';
  filterContainer.style.cssText = `
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
    border-bottom: 2px solid rgba(0,0,0,0.08);
    flex-wrap: wrap;
    padding-bottom: 12px;
  `;
  
  const filters = ['all', 'registration', 'premium', 'password-reset', 'other'];
  const filterButtons = {};

  filters.forEach(filter => {
    const btn = document.createElement('button');
    btn.className = 'inbox-filter-btn';
    btn.dataset.filter = filter;
    btn.textContent = filter.charAt(0).toUpperCase() + filter.slice(1).replace('-', ' ');
    btn.style.cssText = `
      padding: 10px 16px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-weight: 500;
      color: var(--text-muted);
      border-bottom: 3px solid transparent;
      transition: all 0.2s;
      font-size: 14px;
    `;
    
    if (filter === 'all') {
      btn.style.cssText += `
        color: var(--green-main);
        border-bottom-color: var(--green-main);
      `;
    }

    btn.addEventListener('click', () => filterMessages(filter, filterButtons));
    filterButtons[filter] = btn;
    filterContainer.appendChild(btn);
  });

  container.appendChild(filterContainer);

  // Messages container
  const messagesContainer = document.createElement('div');
  messagesContainer.id = 'inbox-messages';
  messagesContainer.style.cssText = `
    display: grid;
    gap: 12px;
    grid-template-columns: 1fr;
  `;
  container.appendChild(messagesContainer);

  // Load messages
  await loadMessages(messagesContainer, filterButtons, adminToken);

  // Attach event listeners
  const refreshBtn = header.querySelector('#inbox-refresh-btn');
  const clearBtn = header.querySelector('#inbox-clear-btn');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.style.opacity = '0.6';
      const icon = refreshBtn.querySelector('i');
      icon.style.animation = 'spin 0.6s linear';
      messagesContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">Loading...</p>';
      await loadMessages(messagesContainer, filterButtons, adminToken);
      refreshBtn.disabled = false;
      refreshBtn.style.opacity = '1';
      icon.style.animation = '';
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      showConfirmDialog(
        'Clear All Messages',
        'Are you sure? This will permanently delete all messages and cannot be undone.',
        async () => {
          await clearAllMessages(adminToken);
          messagesContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">Loading...</p>';
          await loadMessages(messagesContainer, filterButtons, adminToken);
        }
      );
    });
  }

  // Auto-refresh every 30 seconds
  setInterval(async () => {
    await loadMessages(messagesContainer, filterButtons, adminToken);
  }, 30000);

  // Add spinning animation style
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  return container;
}

async function loadMessages(container, filterButtons, token) {
  try {
    const response = await fetch(`${API_URL}/admin/messages`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to load messages: ${response.statusText}`);
    }

    const data = await response.json();
    const messages = data.messages || [];

    // Update message count badge - count only UNREAD messages
    const unreadCount = messages.filter(m => !m.isRead).length;
    const countBadge = document.getElementById('message-count-badge');
    const inboxBadge = document.getElementById('inbox-badge');
    
    if (countBadge && unreadCount > 0) {
      countBadge.textContent = `${unreadCount} new`;
      countBadge.style.display = 'inline-block';
    } else if (countBadge) {
      countBadge.style.display = 'none';
    }

    if (inboxBadge && unreadCount > 0) {
      inboxBadge.textContent = unreadCount;
      inboxBadge.style.display = 'inline-flex';
      inboxBadge.style.alignItems = 'center';
      inboxBadge.style.justifyContent = 'center';
    } else if (inboxBadge) {
      inboxBadge.style.display = 'none';
    }

    if (messages.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px 20px;">No messages yet. System notifications will appear here.</p>';
      return;
    }

    // Sort by date (newest first)
    messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Render messages
    container.innerHTML = '';
    messages.forEach(msg => {
      const messageEl = createMessageElement(msg);
      messageEl.style.marginBottom = '12px';
      container.appendChild(messageEl);
    });

  } catch (err) {
    console.error('Error loading messages:', err);
    container.innerHTML = `<p style="color: #dc2626; padding: 20px;">Error loading messages: ${err.message}</p>`;
  }
}

function createMessageElement(message) {
  const el = document.createElement('div');
  el.className = `inbox-message inbox-message-${message.type}`;
  el.dataset.type = message.type;
  el.style.cssText = `
    padding: 16px;
    border-radius: 8px;
    border: 1px solid rgba(0,0,0,0.08);
    background: var(--bg-secondary);
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  `;

  el.addEventListener('mouseover', () => {
    el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    el.style.transform = 'translateY(-2px)';
  });

  el.addEventListener('mouseout', () => {
    el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
    el.style.transform = 'translateY(0)';
  });

  const typeConfig = {
    registration: { color: '#3b82f6', icon: '👤', label: 'New Registration' },
    premium: { color: '#f59e0b', icon: '👑', label: 'Premium Member' },
    'password-reset': { color: '#ef4444', icon: '🔑', label: 'Password Reset' },
    other: { color: '#8b5cf6', icon: '📌', label: 'System Message' }
  };

  const config = typeConfig[message.type] || typeConfig.other;

  const content = document.createElement('div');
  content.style.cssText = 'flex: 1; min-width: 0;';
  
  // Add unread indicator dot if message is unread
  const unreadDot = message.isRead ? '' : '<span style="width: 10px; height: 10px; background: #dc2626; border-radius: 50%; flex-shrink: 0;"></span>';
  
  content.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px; flex-wrap: wrap;">
      ${unreadDot}
      <span style="font-size: 18px;">${config.icon}</span>
      <span style="font-weight: 600; color: ${config.color}; font-size: 13px; text-transform: capitalize;">${config.label}</span>
      <span style="font-size: 12px; color: var(--text-muted); margin-left: auto;">${formatTime(message.createdAt || message.timestamp)}</span>
    </div>
    <div style="color: var(--text-main); font-size: 14px; font-weight: ${message.isRead ? '400' : '600'}; margin-bottom: 6px; line-height: 1.4;">${escapeHtml(message.title || message.message || 'System Message')}</div>
    ${message.content ? `<div style="color: var(--text-muted); font-size: 13px; line-height: 1.5;">${escapeHtml(message.content)}</div>` : ''}
  `;

  el.appendChild(content);

  // Action buttons container
  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; gap: 8px; margin-left: 12px; flex-shrink: 0;';

  // View button
  const viewBtn = document.createElement('button');
  viewBtn.innerHTML = '<i class="fas fa-eye"></i> View';
  viewBtn.style.cssText = `
    padding: 8px 14px;
    border: none;
    border-radius: 6px;
    background: rgba(0,121,107,0.1);
    color: var(--green-main);
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  `;
  viewBtn.onmouseover = () => viewBtn.style.background = 'rgba(0,121,107,0.2)';
  viewBtn.onmouseout = () => viewBtn.style.background = 'rgba(0,121,107,0.1)';
  viewBtn.addEventListener('click', () => {
    markMessageAsRead(message.id);
    // Pass container and token to modal so it can reload on close
    const adminToken = localStorage.getItem('adminToken');
    const messagesContainer = document.getElementById('inbox-messages');
    const filterButtons = {};
    document.querySelectorAll('.inbox-filter-btn').forEach(btn => {
      filterButtons[btn.dataset.filter] = btn;
    });
    openMessageModal(message, messagesContainer, filterButtons, adminToken);
  });

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
  deleteBtn.style.cssText = `
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: rgba(220,38,38,0.1);
    color: #dc2626;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  `;
  deleteBtn.onmouseover = () => deleteBtn.style.background = 'rgba(220,38,38,0.2)';
  deleteBtn.onmouseout = () => deleteBtn.style.background = 'rgba(220,38,38,0.1)';
  deleteBtn.addEventListener('click', async () => {
    showConfirmDialog(
      'Delete Message',
      'Are you sure you want to delete this message? This action cannot be undone.',
      async () => {
        await deleteMessage(message.id);
        el.remove();
      }
    );
  });

  actions.appendChild(viewBtn);
  actions.appendChild(deleteBtn);
  el.appendChild(actions);

  return el;
}

function openMessageModal(message, messagesContainer = null, filterButtons = null, token = null) {
  console.log('Opening message modal:', message);
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  // Create modal content
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: #1a1a1a;
    border-radius: 16px;
    padding: 40px;
    max-width: 700px;
    width: 90%;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 25px 50px rgba(0,0,0,0.3);
    position: relative;
    border: 1px solid rgba(255,255,255,0.1);
    color: #e5e5e5;
  `;

  const typeConfig = {
    registration: { color: '#3b82f6', icon: '👤', bgColor: 'rgba(59,130,246,0.1)' },
    premium: { color: '#f59e0b', icon: '👑', bgColor: 'rgba(245,158,11,0.1)' },
    'password-reset': { color: '#ef4444', icon: '🔑', bgColor: 'rgba(239,68,68,0.1)' },
    other: { color: '#8b5cf6', icon: '📌', bgColor: 'rgba(139,92,246,0.1)' }
  };

  const config = typeConfig[message.type] || typeConfig.other;

  let detailsHtml = '';
  if (message.details) {
    detailsHtml = `<div style="background: ${config.bgColor}; border-radius: 10px; padding: 20px; margin-top: 24px; border-left: 4px solid ${config.color};">`;
    if (typeof message.details === 'object' && message.details !== null) {
      Object.entries(message.details).forEach(([key, value]) => {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').charAt(0).toUpperCase() + key.replace(/([A-Z])/g, ' $1').slice(1).trim();
        detailsHtml += `<p style="margin: 10px 0; color: #e5e5e5; display: flex; justify-content: space-between;"><strong>${escapeHtml(formattedKey)}:</strong> <span style="color: #b3b3b3; text-align: right; margin-left: 20px;">${escapeHtml(String(value))}</span></p>`;
      });
    } else {
      detailsHtml += `<p style="margin: 0; color: #e5e5e5;">${escapeHtml(String(message.details))}</p>`;
    }
    detailsHtml += '</div>';
  }

  const title = message.title || message.message || 'System Message';
  const messageBody = message.content || message.message || '(No content)';
  const timestamp = message.createdAt || message.timestamp || new Date().toISOString();

  modal.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
      <div style="display: flex; align-items: flex-start; gap: 16px;">
        <div style="font-size: 40px; flex-shrink: 0;">${config.icon}</div>
        <div>
          <h2 style="margin: 0 0 8px 0; color: #ffffff; font-size: 22px; word-break: break-word;">${escapeHtml(title)}</h2>
          <p style="margin: 0; color: #999999; font-size: 13px;">${formatTime(timestamp)}</p>
        </div>
      </div>
      <button class="close-modal-btn" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #999999; padding: 0 0 0 16px; width: auto; display: flex; align-items: center; justify-content: center; transition: color 0.2s; flex-shrink: 0; line-height: 1;">×</button>
    </div>
    <div style="border-top: 2px solid rgba(255,255,255,0.1); padding-top: 24px; margin-bottom: 24px;">
      <p style="color: #e5e5e5; font-size: 16px; line-height: 1.7; margin: 0; white-space: pre-wrap; word-break: break-word;">${escapeHtml(messageBody)}</p>
    </div>
    ${detailsHtml}
    <div style="display: flex; gap: 12px; margin-top: 32px; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">
      <button class="close-modal-btn" style="padding: 12px 24px; border: none; border-radius: 8px; background: #00796b; color: white; cursor: pointer; font-weight: 600; transition: all 0.2s; font-size: 14px;">Close</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeHandler = async () => {
    overlay.remove();
    
    // Reload messages to update badge after viewing
    if (messagesContainer && filterButtons && token) {
      await loadMessages(messagesContainer, filterButtons, token);
    }
  };

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeHandler();
  });

  // Close on button clicks
  const closeButtons = modal.querySelectorAll('.close-modal-btn');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', closeHandler);
    btn.addEventListener('mouseover', (e) => {
      if (e.target.textContent === '×') {
        e.target.style.color = '#ffffff';
      } else {
        e.target.style.background = '#009688';
      }
    });
    btn.addEventListener('mouseout', (e) => {
      if (e.target.textContent === '×') {
        e.target.style.color = '#999999';
      } else {
        e.target.style.background = '#00796b';
      }
    });
  });
}

function filterMessages(type, filterButtons) {
  // Update active button
  Object.entries(filterButtons).forEach(([key, btn]) => {
    if (key === type) {
      btn.style.cssText = btn.style.cssText.replace('color: var(--text-muted)', 'color: var(--green-main)').replace('border-bottom-color: transparent', 'border-bottom-color: var(--green-main)');
    } else {
      btn.style.cssText = btn.style.cssText.replace('color: var(--green-main)', 'color: var(--text-muted)').replace('border-bottom-color: var(--green-main)', 'border-bottom-color: transparent');
    }
  });

  // Filter messages
  const messages = document.querySelectorAll('.inbox-message');
  messages.forEach(msg => {
    if (type === 'all' || msg.dataset.type === type) {
      msg.style.display = '';
    } else {
      msg.style.display = 'none';
    }
  });
}

async function markMessageAsRead(messageId) {
  const token = localStorage.getItem('adminToken');
  try {
    const response = await fetch(`${API_URL}/admin/messages/${messageId}/read`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to mark message as read');
    }
  } catch (err) {
    console.error('Error marking message as read:', err);
  }
}

async function deleteMessage(messageId) {
  const token = localStorage.getItem('adminToken');
  try {
    const response = await fetch(`${API_URL}/admin/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('We couldn\'t delete the message. Please try again.');
    }

    // Update badges
    updateMessageBadges();
  } catch (err) {
    console.error('Error deleting message:', err);
    showAlertDialog('Error', 'Failed to delete message. Please try again.');
  }
}

async function clearAllMessages(token) {
  try {
    const response = await fetch(`${API_URL}/admin/messages/clear-all`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('We couldn\'t clear the messages. Please try again.');
    }

    // Update badges
    updateMessageBadges();
  } catch (err) {
    console.error('Error clearing messages:', err);
    showAlertDialog('Error', 'Failed to clear messages. Please try again.');
  }
}

function updateMessageBadges() {
  const countBadge = document.getElementById('message-count-badge');
  const inboxBadge = document.getElementById('inbox-badge');
  
  if (countBadge) {
    countBadge.style.display = 'none';
  }

  if (inboxBadge) {
    inboxBadge.style.display = 'none';
  }
}

function showConfirmDialog(title, message, onConfirm, onCancel) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: #1a1a1a;
    border-radius: 16px;
    padding: 40px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 25px 50px rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.1);
  `;

  dialog.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
      <span style="font-size: 32px;">⚠️</span>
      <h3 style="margin: 0; color: #ffffff; font-size: 18px;">${escapeHtml(title)}</h3>
    </div>
    <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">${escapeHtml(message)}</p>
    <div style="display: flex; gap: 12px; justify-content: flex-end;">
      <button class="cancel-btn" style="padding: 12px 24px; border: none; border-radius: 8px; background: rgba(255,255,255,0.1); color: #ffffff; cursor: pointer; font-weight: 600; transition: all 0.2s; font-size: 14px;">Cancel</button>
      <button class="confirm-btn" style="padding: 12px 24px; border: none; border-radius: 8px; background: #ef4444; color: white; cursor: pointer; font-weight: 600; transition: all 0.2s; font-size: 14px;">Confirm</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const closeDialog = () => {
    overlay.remove();
  };

  const confirmBtn = dialog.querySelector('.confirm-btn');
  const cancelBtn = dialog.querySelector('.cancel-btn');

  confirmBtn.addEventListener('mouseover', () => confirmBtn.style.background = '#dc2626');
  confirmBtn.addEventListener('mouseout', () => confirmBtn.style.background = '#ef4444');
  confirmBtn.addEventListener('click', () => {
    closeDialog();
    if (onConfirm) onConfirm();
  });

  cancelBtn.addEventListener('mouseover', () => cancelBtn.style.background = 'rgba(255,255,255,0.2)');
  cancelBtn.addEventListener('mouseout', () => cancelBtn.style.background = 'rgba(255,255,255,0.1)');
  cancelBtn.addEventListener('click', () => {
    closeDialog();
    if (onCancel) onCancel();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDialog();
  });
  
  // Add Enter key support
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      closeDialog();
      if (onConfirm) onConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDialog();
      if (onCancel) onCancel();
    }
  };
  document.addEventListener('keydown', handleKeyDown, { once: true });
}

function showAlertDialog(title, message) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: #1a1a1a;
    border-radius: 16px;
    padding: 40px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 25px 50px rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.1);
  `;

  dialog.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
      <span style="font-size: 32px;">❌</span>
      <h3 style="margin: 0; color: #ffffff; font-size: 18px;">${escapeHtml(title)}</h3>
    </div>
    <p style="color: #e5e5e5; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">${escapeHtml(message)}</p>
    <div style="display: flex; gap: 12px; justify-content: flex-end;">
      <button class="ok-btn" style="padding: 12px 24px; border: none; border-radius: 8px; background: #00796b; color: white; cursor: pointer; font-weight: 600; transition: all 0.2s; font-size: 14px;">OK</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const closeDialog = () => {
    overlay.remove();
  };

  const okBtn = dialog.querySelector('.ok-btn');
  okBtn.addEventListener('mouseover', () => okBtn.style.background = '#009688');
  okBtn.addEventListener('mouseout', () => okBtn.style.background = '#00796b');
  okBtn.addEventListener('click', closeDialog);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDialog();
  });
  
  // Add Enter key support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      closeDialog();
    }
  }, { once: true });
}

function formatTime(date) {
  const now = new Date();
  const msgDate = new Date(date);
  const diff = now - msgDate;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return msgDate.toLocaleDateString();
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
