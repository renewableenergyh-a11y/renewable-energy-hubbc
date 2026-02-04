/**
 * Highlight Service
 * Manages text highlights in modules and courses
 * Handles: detection, apply, update, delete, persistence
 */

import { getToken } from './auth.js';
import { API_BASE } from '../api-config.js';

// UUID v4 generator (simple version)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Fetch user's highlights for a specific content
 * @param {string} contentId - Module or course ID
 * @param {string} contentType - 'module' or 'course'
 */
export async function fetchHighlights(contentId, contentType = 'module') {
  const token = getToken();
  if (!token) return [];

  try {
    const response = await fetch(`${API_BASE}/highlights/${contentType}/${contentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) return [];
    const data = await response.json();
    console.log('📥 Fetched highlights:', data.highlights?.map(h => ({ id: h.id, color: h.color })));
    return data.highlights || [];
  } catch (err) {
    console.error('Error fetching highlights:', err);
    return [];
  }
}

/**
 * Save a new highlight to server
 * @param {object} highlight - { tempId, contentId, contentType, text, startOffset, endOffset, color, parentSelector }
 */
export async function saveHighlight(highlight) {
  const token = getToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE}/highlights`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contentId: highlight.contentId,
        contentType: highlight.contentType || 'module',
        text: highlight.text,
        startOffset: highlight.startOffset,
        endOffset: highlight.endOffset,
        color: highlight.color,
        parentSelector: highlight.parentSelector,
        tempId: highlight.tempId
      })
    });

    if (!response.ok) {
      console.error('Server error saving highlight');
      return null;
    }

    const data = await response.json();
    return data.highlight || null;
  } catch (err) {
    console.error('Error saving highlight:', err);
    return null;
  }
}

/**
 * Update existing highlight color
 * @param {string} highlightId - Server highlight ID
 * @param {string} color - New color
 */
export async function updateHighlight(highlightId, color) {
  const token = getToken();
  if (!token) return false;

  try {
    console.log('📡 Updating highlight on server:', { highlightId, color });
    const response = await fetch(`${API_BASE}/highlights/${highlightId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ color })
    });

    console.log('📥 Server response status:', response.status);
    const responseData = await response.json();
    console.log('📥 Server response data:', responseData);

    if (!response.ok) {
      console.error('❌ Server error updating highlight:', responseData);
      return false;
    }

    console.log('✅ Server confirmed update:', responseData);
    return true;
  } catch (err) {
    console.error('❌ Network error updating highlight:', err);
    return false;
  }
}

/**
 * Delete a highlight
 * @param {string} highlightId - Server highlight ID
 */
export async function deleteHighlight(highlightId) {
  const token = getToken();
  if (!token) return false;

  try {
    const response = await fetch(`${API_BASE}/highlights/${highlightId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error('Server error deleting highlight');
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error deleting highlight:', err);
    return false;
  }
}

/**
 * Apply highlight to DOM
 * @param {string} text - Selected text
 * @param {string} color - Highlight color
 * @param {string} highlightId - Server or temp ID
 */
export function applyHighlightToDOM(text, color, highlightId) {
  const span = document.createElement('span');
  span.className = 'text-highlight';
  span.dataset.highlightId = highlightId;
  span.textContent = text;
  span.style.backgroundColor = color;
  return span;
}

/**
 * Get text selection info from user
 * @param {HTMLElement} contentContainer - Container to check selection in
 * @returns {object|null} { text, startOffset, endOffset } or null if invalid
 */
export function getTextSelection(contentContainer) {
  const selection = window.getSelection();
  
  // Must have a selection
  if (!selection || selection.toString().trim().length === 0) {
    return null;
  }

  // Check if selection is within content container
  const range = selection.getRangeAt(0);
  if (!contentContainer.contains(range.commonAncestorContainer)) {
    return null;
  }

  const text = selection.toString();
  
  // Calculate offsets relative to container
  const preRange = range.cloneRange();
  preRange.selectNodeContents(contentContainer);
  preRange.setEnd(range.startContainer, range.startOffset);
  const startOffset = preRange.toString().length;

  const endOffset = startOffset + text.length;

  return {
    text: text.trim(),
    startOffset,
    endOffset
  };
}

/**
 * Remove highlight span from DOM
 * @param {HTMLElement} highlightSpan - The span element to remove
 */
export function removeHighlightFromDOM(highlightSpan) {
  const parent = highlightSpan.parentNode;
  if (!parent) return;

  // Move text content out of span
  while (highlightSpan.firstChild) {
    parent.insertBefore(highlightSpan.firstChild, highlightSpan);
  }

  // Remove empty span
  parent.removeChild(highlightSpan);

  // Normalize text nodes (merge adjacent text nodes)
  parent.normalize();
}

/**
 * Find all highlight spans in a container
 * @param {HTMLElement} container
 * @returns {array} Array of highlight span elements
 */
export function findHighlightSpans(container) {
  return Array.from(container.querySelectorAll('.text-highlight'));
}

/**
 * Reapply all highlights to content after re-render
 * @param {HTMLElement} contentContainer
 * @param {array} highlights - Array of highlight objects from server
 */
export function reapplyHighlights(contentContainer, highlights) {
  if (!highlights || highlights.length === 0) return;

  console.log('🔄 Reapplying highlights:', highlights.map(h => ({ id: h.id, color: h.color, text: h.text.substring(0, 20) })));

  highlights.forEach(highlight => {
    try {
      // Simple approach: find text and wrap with highlight span
      const text = highlight.text;
      const color = highlight.color;
      const highlightId = highlight.id;

      console.log('  ⚙️ Processing highlight:', { highlightId, color });

      const walker = document.createTreeWalker(
        contentContainer,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      let charCount = 0;

      while (node = walker.nextNode()) {
        const nextCharCount = charCount + node.length;

        // Check if highlight overlaps with this text node
        if (highlight.startOffset < nextCharCount && highlight.endOffset > charCount) {
          const start = Math.max(0, highlight.startOffset - charCount);
          const end = Math.min(node.length, highlight.endOffset - charCount);

          if (start < end) {
            const before = node.splitText(start);
            const highlighted = before.splitText(end - start);

            const span = document.createElement('span');
            span.className = 'text-highlight';
            span.dataset.highlightId = highlightId;
            span.style.backgroundColor = color;
            span.textContent = before.textContent;

            node.parentNode.insertBefore(span, before);
            node.parentNode.removeChild(before);

            return; // Stop after first match for now
          }
        }

        charCount = nextCharCount;
      }
    } catch (err) {
      console.warn('Error reapplying highlight:', err);
    }
  });
}
