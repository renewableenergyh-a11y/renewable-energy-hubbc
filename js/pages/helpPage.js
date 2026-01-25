const API_BASE = '/api/help';

function el(tag, attrs = {}, text = '') {
  const e = document.createElement(tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text) e.textContent = text;
  return e;
}

async function fetchMessages() {
  try {
    // Get current email from form (for filtering messages)
    const emailInput = document.getElementById('help-email');
    const userEmail = (emailInput ? emailInput.value.trim() : '') || 'guest@example.com';
    
    // Get current session ID - only fetch messages for this specific session
    const sessionId = localStorage.getItem('help_session_id');
    if (!sessionId) {
      // No active session, return empty
      return [];
    }
    
    let url = `${API_BASE}/messages`;
    if (sessionId) {
      url += `?sessionId=${encodeURIComponent(sessionId)}`;
    }
    
    const r = await fetch(url);
    if (!r.ok) return [];
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const txt = await r.text();
      console.warn('fetchMessages: expected JSON, got:', txt.slice(0,200));
      return [];
    }
    return await r.json();
  } catch (err) { console.warn('fetchMessages error', err); return []; }
}

function renderMessages(list) {
  const container = document.getElementById('messages');
  if (!container) return;
  container.innerHTML = '';
  // Sort messages by timestamp ascending
  const msgs = (list || []).slice().sort((a,b) => new Date(a.ts) - new Date(b.ts));

  // Helper: produce YYYY-MM-DD key
  const keyFor = (d) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yy}-${mm}-${dd}`;
  };

  // Group messages by day
  const groups = {};
  msgs.forEach(m => {
    const d = new Date(m.ts);
    const k = keyFor(d);
    groups[k] = groups[k] || [];
    groups[k].push(m);
  });

  // Sort group keys
  const keys = Object.keys(groups).sort();

  // Helper: format day label (Today, Yesterday, or date)
  const formatDayLabel = (key) => {
    const parts = key.split('-').map(Number);
    const d = new Date(parts[0], parts[1]-1, parts[2]);
    const today = new Date();
    const todayKey = keyFor(today);
    const yday = new Date(); yday.setDate(today.getDate()-1);
    const ydayKey = keyFor(yday);
    if (key === todayKey) return 'Today';
    if (key === ydayKey) return 'Yesterday';
    return d.toLocaleDateString();
  };

  // Render each day group with a centered header
  keys.forEach(k => {
    const dayHeader = el('div', { 'class': 'help-day-sep' });
    dayHeader.textContent = formatDayLabel(k);
    container.appendChild(dayHeader);

    groups[k].forEach(m => {
      const isAdmin = m.from === 'Admin' || m.role === 'admin'; // Check both from and role field
      const isSystem = m.from === 'System';
      const cls = isSystem ? 'system' : (isAdmin ? 'admin' : 'user');
      const item = el('div', { 'class': `help-message ${cls}` });
      item.style.justifyContent = isSystem ? 'center' : (isAdmin ? 'flex-start' : 'flex-end');

      // render as plain message (no bubble)
      const messageText = el('div', { 'class': 'message-text' });
      messageText.setAttribute('role','article');
      messageText.setAttribute('aria-label', m.from || (isAdmin ? 'Admin' : 'You'));

      const meta = el('div', { 'class': 'meta' });
      meta.innerHTML = `<strong>${m.from || (isAdmin ? 'Admin' : 'You')}</strong>`;
      const body = el('div', { 'class': 'body' }, m.text || '');

      // time stamp element (displayed outside the bubble)
      const timeEl = el('div', { 'class': 'time-outside' });
      const t = new Date(m.ts);
      timeEl.textContent = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      messageText.appendChild(meta);
      messageText.appendChild(body);

      if (m.files && m.files.length) {
        const filesWrap = el('div', { 'class': 'help-files' });
        m.files.forEach(f => {
          const a = el('a', { href: f.url, target: '_blank' });
          a.textContent = f.name;
          filesWrap.appendChild(a);
        });
        messageText.appendChild(filesWrap);
      }

      item.appendChild(messageText);
      item.appendChild(timeEl);
      container.appendChild(item);
    });
  });

  container.scrollTop = container.scrollHeight;
}

function showNotice(type, text) {
  const n = document.getElementById('help-notice');
  if (!n) return;
  n.className = 'form-notice ' + type;
  n.textContent = text;
}

async function sendMessage(text, file) {
  try {
    // Get email from form input with fallback
    const emailInput = document.getElementById('help-email');
    const userEmail = (emailInput ? emailInput.value.trim() : '') || 'guest@example.com';
    
    // Validate email (allow guest fallback)
    if (!userEmail.includes('@')) {
      showNotice('error', 'Please enter a valid email address');
      return { success: false, error: 'Valid email required' };
    }

    // include or create a session id so conversations can be grouped
    let sessionId = localStorage.getItem('help_session_id');
    if (!sessionId) {
      sessionId = 's_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
      localStorage.setItem('help_session_id', sessionId);
    }

    // Get user name from localStorage or derive from email
    const userName = localStorage.getItem('currentUserName') || (userEmail !== 'guest@example.com' ? userEmail.split('@')[0] : 'Guest User');

    if (!file) {
      const r = await fetch(`${API_BASE}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, sessionId, userName, userEmail }) });
      if (!r.ok) {
        let errBody = 'Server error';
        try { errBody = (await r.json()).error || errBody; } catch (e) { errBody = await r.text(); }
        return { success: false, error: errBody };
      }
      return await r.json();
    }
    // read file as base64
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    const payload = { text, fileName: file.name, fileData: dataUrl, sessionId, userName, userEmail };
    const r = await fetch(`${API_BASE}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) {
      let errBody = 'Server error';
      try { errBody = (await r.json()).error || errBody; } catch (e) { errBody = await r.text(); }
      return { success: false, error: errBody };
    }
    return await r.json();
  } catch (err) { console.error('sendMessage error', err); return { success: false, error: err.message || String(err) } }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Clear previous chat session so each page load starts fresh (no chat history)
  localStorage.removeItem('help_session_id');

  const form = document.getElementById('help-form');
  const textInput = document.getElementById('help-text');
  const fileInput = document.getElementById('help-file');
  const fileBtn = document.getElementById('help-file-btn');
  const fileNameSpan = document.getElementById('help-file-name');
  let sessionStarted = false;

  // Exit early if form not found
  if (!form) {
    console.error('Help form not found in DOM');
    return;
  }

  async function refresh() {
    // Only fetch messages if a message has been sent in this session
    if (!sessionStarted) {
      renderMessages([]);
      return;
    }
    const msgs = await fetchMessages();
    renderMessages(msgs || []);
  }

  // Poll for messages (simple)
  setInterval(refresh, 5000);
  refresh();

  // Real-time updates via Server-Sent Events
  if (window.EventSource) {
    try {
      const es = new EventSource('/api/help/stream');
      es.addEventListener('refresh', () => refresh());
      es.addEventListener('error', (e) => { /* ignore errors; fallback polling continues */ });
    } catch (e) { console.warn('SSE not available', e); }
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const text = textInput.value.trim();
    const file = fileInput.files && fileInput.files[0];
    if (!text && !file) { showNotice('error', 'Please enter a message or attach a file'); return; }
    // client-side file size validation (100MB max)
    if (file && file.size > 100 * 1024 * 1024) {
      showNotice('error', 'File too large (max 100MB)');
      return;
    }
    showNotice('info', 'Sending...');
    const sendBtn = document.getElementById('help-send');
    if (sendBtn) { sendBtn.disabled = true; }
    // Add a 10s timeout so UI doesn't hang when server is unreachable
    const timedSend = Promise.race([
      sendMessage(text, file),
      new Promise(resolve => setTimeout(() => resolve({ success: false, error: 'Request timed out' }), 10000))
    ]);
    const res = await timedSend;
    if (res && res.success) {
      sessionStarted = true; // Mark that we've sent a message in this session
      textInput.value = '';
      fileInput.value = '';
      showNotice('success', 'Message sent');
      // clear success notice after short delay
      setTimeout(() => { const n = document.getElementById('help-notice'); if (n) n.style.display = 'none'; }, 2000);
      await refresh();
    } else {
      const errMsg = res?.error || 'Failed to send message';
      showNotice('error', errMsg);
      // If chat was terminated or deleted, disable the form
      if (errMsg.includes('terminated') || errMsg.includes('no longer available')) {
        textInput.disabled = true;
        document.getElementById('help-send').disabled = true;
        const form = document.getElementById('help-form');
        if (form) {
          const notice = document.getElementById('help-notice');
          if (notice) {
            notice.innerHTML = '<strong>⚠️ Chat Closed:</strong> ' + errMsg + '. Please start a new conversation.';
            notice.className = 'form-notice error';
          }
        }
      }
    }
    if (sendBtn) { sendBtn.disabled = false; }
  });

  // wire custom attach button and filename display
  if (fileBtn && fileInput) {
    fileBtn.addEventListener('click', () => fileInput.click());
    // show filename only when selected
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (fileNameSpan) {
        if (f) {
          fileNameSpan.textContent = f.name;
          fileNameSpan.classList.add('visible');
        } else {
          fileNameSpan.textContent = '';
          fileNameSpan.classList.remove('visible');
        }
      }
    });
  }

  // Send on Enter (Shift+Enter for newline)
  if (textInput) {
    textInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        // Trigger submit
        if (form.requestSubmit) form.requestSubmit();
        else document.getElementById('help-send')?.click();
      }
    });
  }
});

export {};
