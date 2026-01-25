const API_BASE = '/api/help';

// Modal utility functions (for consistency with admin dashboard)
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function showModal(options) {
  const { type = 'info', title, message, onConfirm, onCancel } = options;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
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
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .modal-content, .modal-content.edit-modal-inner {
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        padding: 32px;
        max-width: 420px;
        text-align: center;
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
      .modal-icon.warning { background: #fef3c7; color: #d97706; }
      .modal-icon.error { background: #fee2e2; color: #dc2626; }
      .modal-icon.info { background: #dbeafe; color: #0284c7; }
      .modal-title { font-size: 18px; font-weight: 600; color: #1f2937; margin: 0 0 8px 0; }
      .modal-message { font-size: 14px; color: #6b7280; margin: 0 0 24px 0; line-height: 1.5; }
      .modal-buttons { display: flex; gap: 12px; justify-content: center; }
      .modal-btn {
        padding: 10px 24px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }
      .modal-btn-primary { background: #0066cc; color: white; }
      .modal-btn-primary:hover { background: #0052a3; }
      .modal-btn-secondary { background: #e5e7eb; color: #374151; }
      .modal-btn-secondary:hover { background: #d1d5db; }
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

function el(tag, attrs = {}, text = '') {
  const e = document.createElement(tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text) e.textContent = text;
  return e;
}

async function fetchMessages() {
  try {
    const url = currentSession ? `${API_BASE}/messages?sessionId=${encodeURIComponent(currentSession)}` : `${API_BASE}/messages`;
    const r = await fetch(url);
    if (!r.ok) return [];
    return await r.json();
  } catch (err) { console.error('fetchMessages error', err); return []; }
}

async function loadSessions() {
  try {
    const r = await fetch('/api/help/sessions');
    if (!r.ok) return [];
    return await r.json();
  } catch (err) { console.error('loadSessions error', err); return []; }
}

function renderAdminMessages(list) {
  const container = document.getElementById('admin-messages');
  if (!container) return;
  container.innerHTML = '';
  (list || []).slice().sort((a,b)=>a.ts-b.ts).forEach(m => {
    const isAdmin = m.from && /admin/i.test(m.from);
    const cls = isAdmin ? 'admin' : 'user';
    const row = el('div', { 'class': `help-message ${cls} admin-row` });
    const messageText = el('div', { 'class': 'message-text' });
    const who = el('div', { 'class': 'meta' }, `${m.from || 'User'}`);
    const body = el('div', { 'class': 'body' }, m.text || '');
    messageText.appendChild(who);
    messageText.appendChild(body);
    row.appendChild(messageText);
    const timeEl = el('div', { 'class': 'time-outside' });
    timeEl.textContent = new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (m.files && m.files.length) {
      const filesWrap = el('div', { 'class': 'help-files' });
      m.files.forEach(f => {
        const a = el('a', { href: f.url, target: '_blank' });
        a.textContent = f.name;
        filesWrap.appendChild(a);
      });
      messageText.appendChild(filesWrap);
    }
    // append timestamp inside the same message block so CSS can align it
    row.appendChild(timeEl);
    container.appendChild(row);
  });
  container.scrollTop = container.scrollHeight;
}

// Render sessions list into admin sidebar
function renderSessions(list) {
  const wrap = document.getElementById('sessions-list');
  const badge = document.getElementById('sessions-count');
  if (!wrap) return;
  wrap.innerHTML = '';
  (list || []).forEach(s => {
    const item = el('div', { 'class': 'session-item', style: 'display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:10px;border:1px solid rgba(6,78,59,0.04);' });
    const left = el('div', {}, '');
    const title = el('div', { 'class': 'session-title' }, `${s.sessionId}`);
    const meta = el('div', { 'class': 'session-meta' }, `${s.messages} messages — ${s.lastMessage ? s.lastMessage.slice(0,80) : ''}`);
    left.appendChild(title);
    left.appendChild(meta);

    // right side controls (accept/close + delete)
    const right = el('div', { style: 'display:flex;gap:8px;align-items:center;' });
    const btn = el('button', { 'class': 'btn accept-btn' }, s.active ? 'Close Chat' : (s.accepted ? 'Accepted' : 'Accept Chat'));
    const delBtn = el('button', { 'class': 'btn delete-btn', title: 'Delete request' }, '✖');

    // delete handler: remove session and related messages immediately
    delBtn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const confirmed = await showConfirm('Delete Request', 'Delete this request and all its messages? This cannot be undone.', 'error');
      if (!confirmed) return;
      try {
        const r = await fetch('/api/help/session-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: s.sessionId }) });
        if (!r.ok) { const e = await r.json().catch(()=>({error:'Failed'})); await showAlert('Delete Failed', e.error || 'Failed to delete', 'error'); return; }
        // if we were viewing this session, hide the conversation
        if (currentSession === s.sessionId) setConversationVisible(false);
        await refresh();
      } catch (err) { console.error('delete session error', err); await showAlert('Delete Error', 'Failed to delete session', 'error'); }
    });

    if (s.active) {
      // allow closing the active session
      btn.addEventListener('click', async () => {
        const confirmed = await showConfirm('Close Chat', 'Close this active chat? Users will no longer be able to send messages to it.', 'warning');
        if (!confirmed) return;
        try {
          const r = await fetch('/api/help/session-set-active', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: s.sessionId, active: false }) });
          if (!r.ok) { const e = await r.json().catch(()=>({error:'Failed'})); await showAlert('Close Failed', e.error || 'Failed to close', 'error'); return; }
          // if we were viewing this session, hide the conversation
          if (currentSession === s.sessionId) setConversationVisible(false);
          await refresh();
        } catch (err) { console.error('close session error', err); }
      });
    } else {
      btn.addEventListener('click', async () => {
        try {
          const r = await fetch('/api/help/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: s.sessionId, admin: localStorage.getItem('adminEmail') || 'Admin' }) });
          if (!r.ok) { const e = await r.json().catch(()=>({error:'Failed'})); await showAlert('Accept Failed', e.error || 'Failed to accept', 'error'); return; }
          const data = await r.json();
          currentSession = s.sessionId;
          // show conversation area when a session is accepted
          setConversationVisible(true, s.sessionId);
          await refresh();
          await loadSessions();
        } catch (err) { console.error('accept error', err); }
      });
    }

    right.appendChild(btn);
    right.appendChild(delBtn);
    item.appendChild(left);
    item.appendChild(right);
    wrap.appendChild(item);
  });
  if (badge) badge.textContent = (list || []).length;
}

let currentSession = null;

function setConversationVisible(visible, sessionId) {
  const wrap = document.getElementById('conversation-wrap');
  const header = document.getElementById('current-session-header');
  const replyForm = document.getElementById('admin-reply-form');
  const notice = document.getElementById('admin-notice');
  if (!wrap) return;
  wrap.style.display = visible ? '' : 'none';
  if (visible) {
    header.textContent = `Conversation: ${sessionId}`;
    if (replyForm) replyForm.style.display = '';
    if (notice) notice.style.display = '';
  } else {
    if (replyForm) replyForm.style.display = 'none';
    if (notice) notice.style.display = 'none';
    header.textContent = '';
    currentSession = null;
  }
}

function showNotice(id, type, text) {
  const n = document.getElementById(id);
  if (!n) return;
  n.style.display = '';
  n.className = 'form-notice ' + type;
  n.textContent = text;
}

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('admin-reply-form');
  const fromInput = document.getElementById('admin-from');
  const textInput = document.getElementById('admin-text');
  const noticeId = 'admin-notice';

  async function refresh() {
    const msgs = await fetchMessages();
    renderAdminMessages(msgs || []);
    const sessions = await loadSessions();
    renderSessions(sessions || []);
  }

  setInterval(refresh, 5000);
  refresh();

  // also poll sessions more frequently
  setInterval(async () => { const s = await loadSessions(); renderSessions(s || []); }, 7000);

  // SSE stream for live updates
  if (window.EventSource) {
    try {
      const es = new EventSource('/api/help/stream');
      es.addEventListener('refresh', () => refresh());
      es.addEventListener('error', () => {});
    } catch (e) { console.warn('SSE not available', e); }
  }

  // terminate and clear handlers
  const terminateBtn = document.getElementById('admin-terminate');
  const clearBtn = document.getElementById('admin-clear');
  if (terminateBtn) {
    terminateBtn.addEventListener('click', async () => {
      const confirmed = await showConfirm('Terminate Chat', 'Terminate chat for all users? This will append a system message.', 'warning');
      if (!confirmed) return;
      showNotice(noticeId, 'info', 'Terminating chat...');
      try {
        const r = await fetch(`${API_BASE}/terminate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Chat closed by admin' }) });
        if (!r.ok) {
          let err = 'Failed to terminate chat';
          try { err = (await r.json()).error || err; } catch(e){}
          showNotice(noticeId, 'error', err); return;
        }
        showNotice(noticeId, 'success', 'Chat terminated');
        await refresh();
      } catch (err) { console.error(err); showNotice(noticeId, 'error', err.message || 'Error'); }
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      const confirmed = await showConfirm('Clear Chat', 'Clear all chat messages? This cannot be undone.', 'error');
      if (!confirmed) return;
      showNotice(noticeId, 'info', 'Clearing chat...');
      try {
        const r = await fetch(`${API_BASE}/clear`, { method: 'POST' });
        if (!r.ok) {
          let err = 'Failed to clear chat';
          try { err = (await r.json()).error || err; } catch(e){}
          showNotice(noticeId, 'error', err); return;
        }
        showNotice(noticeId, 'success', 'Chat cleared');
        await refresh();
      } catch (err) { console.error(err); showNotice(noticeId, 'error', err.message || 'Error'); }
    });
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const text = (textInput.value || '').trim();
    const from = (fromInput.value || '').trim() || 'Admin';
    if (!text) { showNotice(noticeId, 'error', 'Enter a reply'); return; }
    showNotice(noticeId, 'info', 'Sending...');
    try {
      const payload = { text, from };
      if (currentSession) payload.sessionId = currentSession;
      const r = await fetch(`${API_BASE}/reply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) {
        let err = 'Failed to send reply';
        try { err = (await r.json()).error || err; } catch(e){}
        showNotice(noticeId, 'error', err);
        return;
      }
      textInput.value = '';
      showNotice(noticeId, 'success', 'Reply posted');
      await refresh();
    } catch (err) {
      console.error('reply error', err);
      showNotice(noticeId, 'error', err.message || 'Failed to send reply');
    }
  });
});

export {};
