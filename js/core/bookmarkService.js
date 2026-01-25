/**
 * Bookmark Service - Manage user's saved modules
 * Uses localStorage for fast access + MongoDB for persistence
 */

import { API_BASE } from '../api-config.js';

const BOOKMARKS_CACHE_KEY = 'user_bookmarks';
let bookmarksCache = null;

/**
 * Get user's bookmarks from cache or fetch from server
 */
export async function getBookmarks() {
  const token = localStorage.getItem('authToken');
  if (!token) return [];

  // Check cache first
  if (bookmarksCache !== null) {
    return bookmarksCache;
  }

  try {
    const response = await fetch(`${API_BASE}/bookmarks`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) return [];
    
    const bookmarks = await response.json();
    bookmarksCache = bookmarks;
    return bookmarks;
  } catch (err) {
    console.error('Failed to fetch bookmarks:', err);
    return [];
  }
}

/**
 * Check if a module is bookmarked
 */
export async function isBookmarked(moduleId) {
  const bookmarks = await getBookmarks();
  return bookmarks.some(b => b.moduleId === moduleId);
}

/**
 * Add bookmark
 */
export async function addBookmark(moduleId, courseId, moduleTitle) {
  const token = localStorage.getItem('authToken');
  if (!token) return false;

  try {
    const response = await fetch(`${API_BASE}/bookmarks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ moduleId, courseId, moduleTitle })
    });

    if (!response.ok) return false;

    // Invalidate cache
    bookmarksCache = null;
    return true;
  } catch (err) {
    console.error('Failed to add bookmark:', err);
    return false;
  }
}

/**
 * Remove bookmark
 */
export async function removeBookmark(moduleId) {
  const token = localStorage.getItem('authToken');
  if (!token) return false;

  try {
    const response = await fetch(`${API_BASE}/bookmarks/${moduleId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) return false;

    // Invalidate cache
    bookmarksCache = null;
    return true;
  } catch (err) {
    console.error('Failed to remove bookmark:', err);
    return false;
  }
}

/**
 * Toggle bookmark for a module
 */
export async function toggleBookmark(moduleId, courseId, moduleTitle) {
  const bookmarked = await isBookmarked(moduleId);
  
  if (bookmarked) {
    return await removeBookmark(moduleId);
  } else {
    return await addBookmark(moduleId, courseId, moduleTitle);
  }
}

/**
 * Clear all bookmarks cache
 */
export function clearBookmarksCache() {
  bookmarksCache = null;
}
