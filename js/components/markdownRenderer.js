import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";

export function renderMarkdown(container, markdown, meta) {
  // Extract Objectives/Learning Outcomes from raw markdown (if present)
  let objectivesHtml = null;
  let objectivesHeadingText = null;
  const lines = markdown.split(/\r?\n/);
  let startIdx = -1;
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    if (/^#{1,6}\s*(learning outcomes?|learning objectives?|objectives?)\b/i.test(line)) {
      startIdx = idx;
      objectivesHeadingText = line.replace(/^#{1,6}\s*/i, '').trim();
      break;
    }
  }

  if (startIdx !== -1) {
    // collect until next heading or end
    let endIdx = startIdx + 1;
    while (endIdx < lines.length && !/^#{1,6}\s+/i.test(lines[endIdx])) endIdx++;

    const objLines = lines.slice(startIdx + 1, endIdx);
    const objMarkdown = objLines.join('\n').trim();
    if (objMarkdown) {
      objectivesHtml = marked.parse(objMarkdown);
    }

    // remove objectives block (including heading) from original markdown
    lines.splice(startIdx, endIdx - startIdx);
    markdown = lines.join('\n');
  }

  // If no objectives block found in markdown but meta.objectives provided, render from meta
  if (!objectivesHtml && meta && Array.isArray(meta.objectives) && meta.objectives.length > 0) {
    objectivesHeadingText = 'Learning Objectives';
    // build simple markdown list from objectives array
    const objMarkdown = meta.objectives.map(o => `- ${o}`).join('\n');
    objectivesHtml = marked.parse(objMarkdown);
  }

  const html = marked.parse(markdown);
  container.innerHTML = html;
  // debug: log images found in parsed HTML to help troubleshoot missing images
  try {
    const imgs = Array.from(container.querySelectorAll('img'));
    if (imgs.length) {
      console.log('renderMarkdown: found', imgs.length, 'images:', imgs.map(i=>i.src));
    } else {
      console.log('renderMarkdown: no images found in parsed markdown');
    }
  } catch(e) { /* ignore logging errors */ }
  container.classList.add("markdown");

  // Group content by h2 headers into sections
  const frag = document.createDocumentFragment();
  const children = Array.from(container.childNodes);

  let i = 0;
  while (i < children.length) {
    const node = children[i];

    // h2 creates a new section
    if (node.nodeType === 1 && node.matches('h2')) {
      const section = document.createElement('div');
      section.className = 'lesson-section';

      // Clone h2 and add section-header class
      const h2Clone = node.cloneNode(true);
      h2Clone.className = 'section-header';
      section.appendChild(h2Clone);

      const body = document.createElement('div');
      body.className = 'section-body';

      i++;
      // collect nodes until next h2
      while (i < children.length) {
        const nxt = children[i];
        if (nxt.nodeType === 1 && nxt.matches('h2')) break;
        body.appendChild(nxt.cloneNode(true));
        i++;
      }

      // Add mark as complete button at end of section content
      const completeBtn = document.createElement('button');
      completeBtn.className = 'mark-complete-btn';
      completeBtn.textContent = '✓ Mark as Complete';
      completeBtn.style.cssText = `
        display: inline-block;
        margin-top: 12px;
        padding: 6px 12px;
        background: #10b981;
        color: white;
        border: none;
        border-radius: 4px;
        font-weight: 500;
        cursor: pointer;
        font-size: 12px;
      `;
      body.appendChild(completeBtn);

      section.appendChild(body);
      frag.appendChild(section);
    } else {
      frag.appendChild(node.cloneNode(true));
      i++;
    }
  }

  // Replace container content with sections
  container.innerHTML = '';
  if (objectivesHtml) {
    const objWrap = document.createElement('div');
    objWrap.className = 'module-objectives';

    const title = document.createElement('h3');
    title.className = 'objectives-title';
    title.textContent = objectivesHeadingText || 'Objectives';
    objWrap.appendChild(title);

    const body = document.createElement('div');
    body.className = 'objectives-body';
    body.innerHTML = objectivesHtml;

    objWrap.appendChild(body);
    container.appendChild(objWrap);
  }
  container.appendChild(frag);

  // attach click-to-view lightbox for images
  container.querySelectorAll('img').forEach(img => {
    img.style.cursor = 'pointer';
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      const lightbox = document.createElement('div');
      lightbox.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:100000;';
      const imgContainer = document.createElement('div');
      imgContainer.style.cssText = 'position:relative;max-width:90vw;max-height:90vh;display:flex;align-items:center;justify-content:center;';
      const largeImg = document.createElement('img');
      largeImg.src = img.src;
      largeImg.alt = img.alt || 'Image';
      largeImg.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;border-radius:4px;';
      imgContainer.appendChild(largeImg);
      
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '✕';
      closeBtn.style.cssText = 'position:absolute;top:16px;right:16px;background:#fff;border:none;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:24px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
      closeBtn.addEventListener('click', () => lightbox.remove());
      imgContainer.appendChild(closeBtn);
      
      lightbox.appendChild(imgContainer);
      lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.remove(); });
      document.body.appendChild(lightbox);
    });
  });
}


