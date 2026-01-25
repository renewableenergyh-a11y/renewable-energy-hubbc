/**
 * Bookmarks Page - Display all user's bookmarked modules
 */

import { getToken } from '../core/auth.js';
import { getBookmarks, removeBookmark } from '../core/bookmarkService.js';
import { showConfirm, showAlert } from '../core/modalService.js';

export async function renderBookmarksPage() {
  const container = document.getElementById('bookmarks-container');
  if (!container) return;

  const token = getToken();
  if (!token) {
    container.innerHTML = '<p style="text-align: center; padding: 40px;">Please <a href="login.html">login</a> to view your bookmarks.</p>';
    return;
  }

  container.innerHTML = '<p style="text-align: center; color: #999;">Loading bookmarks...</p>';

  try {
    // Fetch both bookmarks and courses
    const [bookmarks, coursesRes] = await Promise.all([
      getBookmarks(),
      fetch('/api/courses').then(r => r.ok ? r.json() : [])
    ]);

    // Create a map of courseId -> course title
    const courseMap = {};
    (coursesRes || []).forEach(course => {
      courseMap[course.id] = course.title;
    });

    if (bookmarks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <p style="font-size: 18px; color: #666; margin-bottom: 20px;">No bookmarks yet</p>
          <p style="color: #999;">Click the star icon on any module to save it here.</p>
          <a href="courses.html" class="btn-primary" style="display: inline-block; margin-top: 20px;">Browse Courses</a>
        </div>
      `;
      return;
    }

    // Group bookmarks by course
    const byCategory = {};
    bookmarks.forEach(b => {
      if (!byCategory[b.courseId]) {
        byCategory[b.courseId] = [];
      }
      byCategory[b.courseId].push(b);
    });

    let html = `
      <div style="margin-bottom: 30px;">
        <h2 style="margin-top: 0;">My Bookmarks (${bookmarks.length})</h2>
    `;

    // Render each course group
    for (const [courseId, items] of Object.entries(byCategory)) {
      const courseTitle = courseMap[courseId] || courseId;
      html += `
        <div style="margin-bottom: 30px;">
          <h3 style="font-size: 16px; color: #00796b; border-bottom: 2px solid #e0f2f1; padding-bottom: 10px; margin-bottom: 15px;">
            ${escapeHtml(courseTitle)}
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
      `;

      items.forEach(bookmark => {
        html += `
          <div class="bookmark-card" style="border: 2px solid #00796b; border-radius: 8px; padding: 16px; background: #f9fdfb; transition: all 0.3s;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
              <h4 class="bookmark-card-title" style="margin: 0; font-size: 16px; color: #333; flex: 1;">${escapeHtml(bookmark.moduleTitle)}</h4>
              <button class="remove-bookmark-btn" data-module-id="${bookmark.moduleId}" 
                style="background: none; border: none; color: #dc2626; cursor: pointer; font-size: 18px; padding: 0; margin-left: 10px; outline: none; transition: all 0.2s;">
                ✕
              </button>
            </div>
            <p class="bookmark-card-date" style="font-size: 12px; color: #999; margin: 8px 0;">Saved: ${new Date(bookmark.savedAt).toLocaleDateString()}</p>
            <a href="module.html?course=${bookmark.courseId}&module=${bookmark.moduleId}" class="btn-primary" 
              style="display: inline-block; padding: 8px 16px; font-size: 14px; text-decoration: none; border-radius: 6px;">
              Open Module
            </a>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    }

    html += `</div>`;

    container.innerHTML = html;

    // Add event listeners for remove buttons
    document.querySelectorAll('.remove-bookmark-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const moduleId = btn.dataset.moduleId;
        const confirmed = await showConfirm('Remove Bookmark', 'Remove this bookmark?', 'Remove', 'warning');
        if (confirmed) {
          await removeBookmark(moduleId);
          await renderBookmarksPage(); // Refresh
          await showAlert('Removed', 'Bookmark has been removed.', 'success');
        }
      });
    });

  } catch (err) {
    console.error('Error loading bookmarks:', err);
    container.innerHTML = '<p style="text-align: center; color: #dc2626;">Error loading bookmarks. Please try again.</p>';
  }
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}
