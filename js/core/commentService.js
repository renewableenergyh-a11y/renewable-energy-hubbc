/**
 * Comments Service - Manage module discussion comments
 * Allows users to comment and discuss module content
 */

const API_BASE = '';

const COMMENTS_CACHE_KEY = 'module_comments_';
let commentsCache = {};

/**
 * Get comments for a module
 * @param {string} moduleId - The module ID
 * @returns {Promise<Array>} Array of comments
 */
export async function getModuleComments(moduleId) {
  const token = localStorage.getItem('authToken');
  if (!token) return [];

  // Always fetch fresh from server to get latest comments
  try {
    const response = await fetch(`${API_BASE}/api/comments/${moduleId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      console.warn('Failed to fetch comments:', response.status);
      return [];
    }

    const comments = await response.json();
    console.log(`Fetched ${comments.length} comments for module ${moduleId}:`, comments);
    commentsCache[moduleId] = comments;
    return comments;
  } catch (err) {
    console.warn('Failed to fetch comments:', err);
    return [];
  }
}

/**
 * Post a new comment
 * @param {string} moduleId - The module ID
 * @param {string} courseId - The course ID
 * @param {string} text - The comment text
 * @returns {Promise<object>} {success, error, comment}
 */
export async function postComment(moduleId, courseId, text) {
  const token = localStorage.getItem('authToken');
  if (!token) return { success: false, error: 'Not authenticated' };

  if (!text || text.trim().length === 0) return { success: false, error: 'Comment cannot be empty' };

  try {
    const response = await fetch(`${API_BASE}/api/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        moduleId,
        courseId,
        text: text.trim()
      })
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      clearModuleCommentsCache(moduleId);
      return { success: true, comment: data.comment };
    }
    return { success: false, error: data.error || 'Failed to post comment' };
  } catch (err) {
    console.warn('Failed to post comment:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Delete a comment
 * @param {string} commentId - The comment ID
 * @param {string} moduleId - The module ID (for cache clearing)
 * @returns {Promise<object>} {success, error}
 */
export async function deleteComment(commentId, moduleId) {
  const token = localStorage.getItem('authToken');
  if (!token) return { success: false, error: 'Not authenticated' };

  try {
    const response = await fetch(`${API_BASE}/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      clearModuleCommentsCache(moduleId);
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to delete comment' };
  } catch (err) {
    console.warn('Failed to delete comment:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Clear comment cache for a module
 * @param {string} moduleId - The module ID
 */
export function clearModuleCommentsCache(moduleId) {
  delete commentsCache[moduleId];
  localStorage.removeItem(COMMENTS_CACHE_KEY + moduleId);
}

/**
 * Clear all comment caches
 */
export function clearAllCommentsCache() {
  commentsCache = {};
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(COMMENTS_CACHE_KEY)) {
      localStorage.removeItem(key);
    }
  });
}
