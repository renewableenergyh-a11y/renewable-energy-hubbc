/**
 * Modal Service - Custom styled modals for confirmations, alerts, and notifications
 * Replaces browser alerts/confirms with site-styled modals
 */

const MODAL_STYLES = `
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-box {
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    padding: 32px;
    max-width: 420px;
    animation: slideUp 0.3s ease;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .modal-icon {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
    font-size: 28px;
    font-weight: bold;
  }

  .modal-icon.success { background: #ecfdf5; color: #059669; }
  .modal-icon.error { background: #fee2e2; color: #dc2626; }
  .modal-icon.warning { background: #fef3c7; color: #d97706; }
  .modal-icon.info { background: #dbeafe; color: #0284c7; }
  .modal-icon.confirm { background: #e0e7ff; color: #4f46e5; }

  .modal-title {
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 12px 0;
    text-align: center;
  }

  .modal-message {
    font-size: 14px;
    color: #6b7280;
    margin: 0 0 24px 0;
    line-height: 1.5;
    text-align: center;
  }

  .modal-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .modal-btn {
    padding: 10px 24px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .modal-btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .modal-btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .modal-btn-secondary {
    background: #e5e7eb;
    color: #374151;
  }

  .modal-btn-secondary:hover {
    background: #d1d5db;
  }

  .modal-btn-danger {
    background: #dc2626;
    color: white;
  }

  .modal-btn-danger:hover {
    background: #b91c1c;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
  }

  .modal-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
  }
`;

// Inject styles once
function injectStyles() {
  if (!document.getElementById('modal-service-styles')) {
    const style = document.createElement('style');
    style.id = 'modal-service-styles';
    style.textContent = MODAL_STYLES;
    document.head.appendChild(style);
  }
}

/**
 * Show an alert modal
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 * @param {string} type - 'success' | 'error' | 'info' (default: 'info')
 * @returns {Promise<void>}
 */
export function showAlert(title, message, type = 'info') {
  injectStyles();
  
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const icons = {
      success: '✓',
      error: '✕',
      info: 'ℹ',
      warning: '⚠'
    };

    const box = document.createElement('div');
    box.className = 'modal-box';
    box.innerHTML = `
      <div class="modal-icon ${type}">${icons[type] || icons.info}</div>
      <h2 class="modal-title">${escapeHtml(title)}</h2>
      <p class="modal-message">${escapeHtml(message)}</p>
      <div class="modal-buttons">
        <button class="modal-btn modal-btn-primary">OK</button>
      </div>
    `;

    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    const btn = box.querySelector('.modal-btn');
    btn.addEventListener('click', () => {
      backdrop.remove();
      resolve();
    });

    btn.focus();
  });
}

/**
 * Show a confirmation modal
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 * @param {string} confirmText - Confirm button text (default: 'Confirm')
 * @param {string} type - 'warning' | 'confirm' (default: 'confirm')
 * @returns {Promise<boolean>} true if confirmed, false if cancelled
 */
export function showConfirm(title, message, confirmText = 'Confirm', type = 'confirm') {
  injectStyles();
  
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const icons = {
      warning: '⚠',
      confirm: '?',
      error: '✕'
    };

    const box = document.createElement('div');
    box.className = 'modal-box';
    box.innerHTML = `
      <div class="modal-icon ${type}">${icons[type] || icons.confirm}</div>
      <h2 class="modal-title">${escapeHtml(title)}</h2>
      <p class="modal-message">${escapeHtml(message)}</p>
      <div class="modal-buttons">
        <button class="modal-btn modal-btn-secondary" id="modal-cancel">Cancel</button>
        <button class="modal-btn modal-btn-primary" id="modal-confirm">${escapeHtml(confirmText)}</button>
      </div>
    `;

    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    const cancelBtn = box.querySelector('#modal-cancel');
    const confirmBtn = box.querySelector('#modal-confirm');

    const cleanup = () => backdrop.remove();

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    confirmBtn.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    confirmBtn.focus();
  });
}

/**
 * Show a delete confirmation modal
 * @param {string} itemName - Name of item to delete
 * @returns {Promise<boolean>} true if confirmed, false if cancelled
 */
export function showDeleteConfirm(itemName = 'this item') {
  return showConfirm(
    'Delete ' + itemName,
    `Are you sure you want to delete ${itemName}? This action cannot be undone.`,
    'Delete',
    'error'
  );
}

/**
 * Show a success notification
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {number} duration - Auto-hide duration in ms (default: 3000)
 */
export function showSuccess(title, message, duration = 3000) {
  injectStyles();
  
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.pointerEvents = 'none';

  const box = document.createElement('div');
  box.className = 'modal-box';
  box.innerHTML = `
    <div class="modal-icon success">✓</div>
    <h2 class="modal-title">${escapeHtml(title)}</h2>
    <p class="modal-message">${escapeHtml(message)}</p>
  `;

  backdrop.appendChild(box);
  document.body.appendChild(backdrop);

  setTimeout(() => backdrop.remove(), duration);
}

/**
 * Show an error notification
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {number} duration - Auto-hide duration in ms (default: 4000)
 */
export function showError(title, message, duration = 4000) {
  injectStyles();
  
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.pointerEvents = 'none';

  const box = document.createElement('div');
  box.className = 'modal-box';
  box.innerHTML = `
    <div class="modal-icon error">✕</div>
    <h2 class="modal-title">${escapeHtml(title)}</h2>
    <p class="modal-message">${escapeHtml(message)}</p>
  `;

  backdrop.appendChild(box);
  document.body.appendChild(backdrop);

  setTimeout(() => backdrop.remove(), duration);
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}
