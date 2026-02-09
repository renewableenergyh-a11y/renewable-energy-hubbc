/* AubieRET AI - frontend assistant (premium only)

Features:
- Loads module index and markdown files under data/modules/*
- Builds a simple local knowledge index (documents array)
- Provides a chat UI that searches local documents for relevant snippets
- If nothing local, offers a web-search fallback (opens DuckDuckGo in new tab)

Limitations:
- This is a client-side assistant using simple keyword matching.
- For production-quality AI answers you'd connect to a server-side LLM or Vector DB + Retriever.
*/

export async function initAssistant() {
  if (document.getElementById('aubie-assistant-root')) return; // already initialized

  // Create UI
  const root = document.createElement('div');
  root.id = 'aubie-assistant-root';
  root.className = 'assistant-widget closed';
  root.innerHTML = `
    <div class="assistant-header">
      <div class="assistant-title">AubieRET AI <span class="badge">Premium</span></div>
      <div class="assistant-actions">
        <button id="assistant-minimize" class="icon-btn">_</button>
        <button id="assistant-close" class="icon-btn">×</button>
      </div>
    </div>

    <div class="assistant-body">
      <div class="assistant-messages" id="assistant-messages"></div>

      <div class="assistant-controls">
        <input id="assistant-input" placeholder="Ask AubieRET AI about modules or renewable energy..." />
        <button id="assistant-send" class="btn-primary">Ask</button>
      </div>

      <div class="assistant-footer">
        <small>Answers are based on course content. For broader web results, click <a id="assistant-web-search">web search</a>.</small>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  // accessibility
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'AubieRET AI assistant');
  root.setAttribute('aria-hidden', 'true');
  root.tabIndex = -1;

  // Toggle open/close
  const btn = document.getElementById('aubie-assistant-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      root.classList.toggle('closed');
      const input = document.getElementById('assistant-input');
      if (!root.classList.contains('closed')) setTimeout(() => input && input.focus(), 250);
    });
  }

  // Close / minimize
  document.getElementById('assistant-close').addEventListener('click', () => root.remove());
  document.getElementById('assistant-minimize').addEventListener('click', () => root.classList.add('closed'));

  // keyboard: Esc to close/minimize, Ctrl+K to focus input
  document.addEventListener('keydown', (e) => {
    if (!document.body.contains(root)) return;
    if (e.key === 'Escape') {
      // if open, minimize; if already closed, remove
      if (!root.classList.contains('closed')) root.classList.add('closed');
      else root.remove();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const input = document.getElementById('assistant-input');
      if (input) { root.classList.remove('closed'); setTimeout(() => input.focus(), 100); }
    }
  });

  const messagesEl = document.getElementById('assistant-messages');
  const inputEl = document.getElementById('assistant-input');
  const sendBtn = document.getElementById('assistant-send');
  const webSearchLink = document.getElementById('assistant-web-search');

  webSearchLink.addEventListener('click', (e) => {
    e.preventDefault();
    const q = inputEl.value.trim() || 'renewable energy';
    window.open('https://duckduckgo.com/?q=' + encodeURIComponent(q), '_blank');
  });

  // Load local documents
  const docs = await buildLocalKnowledgeBase();

  function addMessage(from, text) {
    const wrap = document.createElement('div');
    wrap.className = `message ${from}`;
    wrap.innerHTML = `<div class="message-body">${text}</div>`;
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // initial greeting
  addMessage('assistant', 'Hello — I\'m AubieRET AI. I can answer questions about the course modules or provide general guidance about renewable energy. Ask me anything.');
  root.setAttribute('aria-hidden', 'false');

  async function answerQuery(q) {
    addMessage('user', escapeHtml(q));

    // quick greeting detection
    const gmatch = q.trim().toLowerCase().match(/^(hi|hello|hey|good morning|good afternoon|good evening|hey aubie|hello aubie)\b/);
    if (gmatch) {
      addMessage('assistant', `Hi there! 👋 I'm AubieRET AI — I can help with module content, summaries, and general renewable-energy questions. What would you like to know?`);
      return;
    }

    addMessage('assistant', '<em>Searching course modules...</em>');

    // Try server-side AI proxy (Premium or Promotion access)
    let serverSuccess = false;
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('isLoggedIn');
      if (token) {
        const respWrap = document.createElement('div');
        respWrap.className = 'message assistant';
        respWrap.innerHTML = `<div class="message-body"><em>Contacting AubieRET AI server...</em></div>`;
        messagesEl.appendChild(respWrap);
        messagesEl.scrollTop = messagesEl.scrollHeight;

        // Build conversation history from recent messages
        const conversation = [];
        const messageEls = messagesEl.querySelectorAll('.message');
        for (const el of messageEls) {
          const from = el.classList.contains('user') ? 'user' : 'assistant';
          const content = el.textContent?.trim() || '';
          if (content && !content.includes('Contacting') && !content.includes('Searching')) {
            conversation.push({ role: from, content });
          }
        }

        const serverRes = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            message: q,
            conversation: conversation
          })
        });
        
        const jr = await serverRes.json();
        // remove placeholder
        if (respWrap && respWrap.parentNode) respWrap.remove();
        
        if (serverRes.ok && jr && jr.reply) {
          addMessage('assistant', jr.reply.replace(/\n/g, '<br>'));
          serverSuccess = true;
          return;
        } else if (jr && jr.error) {
          console.warn('Server AI error:', jr.error);
          // Fall through to local search if access denied, etc
        }
      }
    } catch (err) {
      console.warn('Server AI failed, falling back to local search', err);
    }

    // Remove placeholder if server failed
    const messages = messagesEl.querySelectorAll('.message.assistant');
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last && (last.textContent?.includes('Contacting') || last.textContent?.includes('Searching'))) {
        last.remove();
      }
    }

    // Simple keyword search over docs
    const qWords = q.toLowerCase().split(/\W+/).filter(Boolean);

    const matches = docs.map(d => {
      const text = (d.title + ' ' + d.content).toLowerCase();
      let score = 0;
      for (const w of qWords) if (text.includes(w)) score += 1;
      return { doc: d, score };
    }).filter(r => r.score > 0).sort((a,b) => b.score - a.score);

    // Remove the placeholder assistant message
    const last = messagesEl.querySelector('.message.assistant:last-child');
    if (last) last.remove();

    if (matches.length === 0) {
      // no local matches — provide a helpful generic answer and a web-search fallback
      const generic = generateGenericAnswer(q);
      addMessage('assistant', generic + `<br><br>If you'd like broader web results, try <a href="https://duckduckgo.com/?q=${encodeURIComponent(q)}" target="_blank">searching the web</a>.`);
      return;
    }

    // Compose answer from top matches
    const top = matches.slice(0, 4);
    const snippets = top.map(m => `<strong>${escapeHtml(m.doc.title)}</strong> — ${escapeHtml(extractBestSnippet(m.doc.content, qWords))}`);

    const answerHtml = `I found information in the course modules:<br><br>${snippets.join('<br><br>')}<br><br>If you need a concise summary, ask me to "summarize" this topic.`;
    addMessage('assistant', answerHtml);
  }

  sendBtn.addEventListener('click', () => {
    const q = inputEl.value.trim();
    if (!q) return;
    answerQuery(q);
    inputEl.value = '';
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendBtn.click();
    }
  });
}

async function buildLocalKnowledgeBase() {
  const docs = [];
  try {
    // Load courses to determine module folders (use relative paths)
    const coursesRes = await fetch('data/courses.json');
    const courses = await coursesRes.json();

    for (const c of courses) {
      const folder = c.id; // we store module files under data/modules/<course>/
        try {
        const idxRes = await fetch(`data/modules/${folder}/index.json`);
        if (!idxRes.ok) continue;
        const idx = await idxRes.json();
        for (const m of idx) {
          // m may have fields like id, title, file, description
          // Accept different fields: content, file, filename, path
          const file = m.content || m.file || m.filename || m.path || m.id;
          // try common filename patterns
          const possible = [m.content, m.file, `${m.id}.md`, `${m.id}.markdown`, `module-${m.id}.md`, `module-${m.id}.markdown`].filter(Boolean);
          let content = '';
          for (const p of possible) {
            try {
              const res = await fetch(`data/modules/${folder}/${p}`);
              if (!res.ok) continue;
              content = await res.text();
              break;
            } catch(err) {
              continue;
            }
          }

          // fallback to description if no md
          if (!content) content = m.description || '';

          docs.push({
            course: c.id,
            courseTitle: c.title,
            id: m.id || m.title,
            title: m.title || m.id,
            content: stripMarkdown(content || '')
          });
        }
      } catch (err) {
        // skip course folder if not present
        continue;
      }
    }
  } catch (err) {
    console.error('Error building knowledge base', err);
  }
  return docs;
}

function extractBestSnippet(text, words) {
  // Split into sentences and pick the sentence with most matches
  const sentences = text.split(/(?<=[.!?])\s+/);
  let best = sentences[0] || text;
  let bestScore = 0;
  for (const s of sentences) {
    let score = 0;
    const low = s.toLowerCase();
    for (const w of words) if (low.includes(w)) score++;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best.trim().slice(0, 400) + (best.length > 400 ? '…' : '');
}

function stripMarkdown(md) {
  // Very small md stripper: remove headings, links, code fences, images
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/#+\s*/g, '')
    .replace(/\*\*|\*|_/g, '')
    .replace(/\r/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateGenericAnswer(query) {
  const topic = query.split(/[?.,]/)[0].trim();
  const shortTopic = topic.length > 60 ? topic.slice(0,60) + '...' : topic;
  // provide short canned summaries for common renewable energy topics
  const lc = topic.toLowerCase();
  if (lc.includes('solar')) return cannedSummary('Solar', shortTopic);
  if (lc.includes('wind')) return cannedSummary('Wind', shortTopic);
  if (lc.includes('hydro') || lc.includes('hydropower')) return cannedSummary('Hydro', shortTopic);
  if (lc.includes('biomass')) return cannedSummary('Biomass', shortTopic);
  if (lc.includes('geothermal')) return cannedSummary('Geothermal', shortTopic);

  return `I couldn't find a specific reference in the course modules for "<strong>${escapeHtml(shortTopic)}</strong>". Here's a short general overview based on common knowledge:<br><br>`
    + `<strong>What it is:</strong> ${escapeHtml(shortTopic)} refers to the topic you asked about. In general, this area covers the core concepts, typical system components, key design considerations, and common applications.<br><br>`
    + `<strong>Key aspects to explore:</strong> definition, main components, how it works, safety/standards, performance metrics, and economic considerations.<br><br>`
    + `If you want a concise summary tailored to a course-level (beginner, intermediate, professional), tell me the level and I can produce a short outline. For detailed, sourced answers I can use web results — click the web search link to open them.`;
}

function cannedSummary(type, shortTopic) {
  switch(type) {
    case 'Solar':
      return `<strong>Solar Energy — Overview</strong><br><br>Solar energy uses sunlight to generate electricity or heat. Key components include PV modules, inverters, mounting, and balance-of-system. Important topics: site assessment & irradiance, system sizing, electrical integration, safety & earthing, and O&M. If you want a concise design checklist, ask for "solar system sizing".`;
    case 'Wind':
      return `<strong>Wind Energy — Overview</strong><br><br>Wind energy converts kinetic energy from wind into electricity using turbines. Key aspects: resource assessment (wind speed & distribution), turbine selection, siting and wake effects, foundations & electrical connection, and maintenance. For quick help, ask "wind resource assessment" or "turbine components".`;
    case 'Hydro':
      return `<strong>Hydropower — Overview</strong><br><br>Hydropower harnesses water flow to generate electricity. Topics include resource (flow & head) measurement, turbine types, civil works (weirs, penstocks), environmental considerations, and grid integration. Ask for "run-of-river design checklist" for a short outline.`;
    case 'Biomass':
      return `<strong>Biomass Energy — Overview</strong><br><br>Biomass energy uses organic materials for heat or power via combustion, gasification or anaerobic digestion. Pay attention to fuel supply chains, preprocessing, emissions control, and system efficiency. Ask "biomass feedstock selection" for details.`;
    case 'Geothermal':
      return `<strong>Geothermal Energy — Overview</strong><br><br>Geothermal uses heat from the earth for power or direct-use. Consider reservoir characteristics, drilling & exploration, plant types (flash, binary), scaling & corrosion, and environmental permits. Ask "geothermal resource classification" for a summary.`;
    default:
      return `Overview for ${escapeHtml(shortTopic)}.`;
  }
}
