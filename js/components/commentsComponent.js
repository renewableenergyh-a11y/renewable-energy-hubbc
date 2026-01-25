/**
 * Comments Component - Render and manage module comments
 */

import { getModuleComments, postComment, deleteComment } from '../core/commentService.js';
import { getToken } from '../core/auth.js';
import { showConfirm, showAlert, showError } from '../core/modalService.js';

/**
 * Parse comment text and highlight @mentions in blue
 */
function formatCommentText(text) {
  if (!text) return '';
  
  // Escape HTML first
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Replace @mentions with blue colored spans (first name + last name only)
  escaped = escaped.replace(/@([\w]+(?:\s+[\w]+)?)\b/g, '<span style="color: #667eea; font-weight: 600;">@$1</span>');
  
  return escaped;
}

export async function renderComments(container, moduleId, courseId, highlightCommentId = null) {
  console.log('🔧 renderComments called:', { container: !!container, moduleId, courseId, highlightCommentId });
  
  if (!container) {
    console.error('❌ Container not provided');
    return;
  }

  const token = getToken();
  console.log('🔑 Token present:', !!token);

  try {
    console.log('📝 Creating comments wrapper...');
    
    // Create a wrapper div for comments to avoid clearing other content
    let commentsWrapper = document.getElementById(`comments-wrapper-${moduleId}`);
    if (commentsWrapper) {
      console.log('♻️ Removing old comments wrapper');
      commentsWrapper.remove();
    }
    
    commentsWrapper = document.createElement('div');
    commentsWrapper.id = `comments-wrapper-${moduleId}`;
    console.log('✅ Created new wrapper:', commentsWrapper.id);
    
    console.log('📥 Fetching comments...');
    const comments = await getModuleComments(moduleId);
    console.log('✅ Fetched comments:', comments.length);

    // Sort comments (newest by default, stored in sessionStorage)
    const sortKey = `comments-sort-${moduleId}`;
    let sortOrder = sessionStorage.getItem(sortKey) || 'newest';
    if (sortOrder === 'oldest') {
      comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else {
      comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    let html = `
      <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb; outline: none;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <h3 style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 16px; color: #1f2937;">
            <i class="fas fa-comments" style="color: #667eea;"></i> Comments (${comments.length})
          </h3>
          <div style="display: flex; gap: 6px; background: #f3f4f6; padding: 4px; border-radius: 6px;">
            <button id="sort-newest-${moduleId}" class="sort-btn" data-sort="newest" data-module="${moduleId}" style="padding: 4px 10px; border: none; background: ${sortOrder === 'newest' ? '#667eea' : 'transparent'}; color: ${sortOrder === 'newest' ? 'white' : '#6b7280'}; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.2s; outline: none; display: flex; align-items: center; gap: 4px;">
              <i class="fas fa-sort-down"></i> Newest
            </button>
            <button id="sort-oldest-${moduleId}" class="sort-btn" data-sort="oldest" data-module="${moduleId}" style="padding: 4px 10px; border: none; background: ${sortOrder === 'oldest' ? '#667eea' : 'transparent'}; color: ${sortOrder === 'oldest' ? 'white' : '#6b7280'}; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.2s; outline: none; display: flex; align-items: center; gap: 4px;">
              <i class="fas fa-sort-up"></i> Oldest
            </button>
          </div>
        </div>
    `;

    // Comment form for logged-in users
    if (token) {
      html += `
        <div style="background: transparent; border-radius: 0; padding: 12px 0 16px 0; margin-bottom: 16px; outline: none; position: relative;">
          <div id="mention-suggestions-${moduleId}" style="position: absolute; bottom: calc(100% + 5px); left: 0; background: white; border: 1px solid #e5e7eb; border-radius: 6px; max-height: 180px; overflow-y: auto; min-width: 200px; display: none; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.08);"></div>
          <textarea id="comment-input" placeholder="Share your thoughts... (type @ to mention)" 
            style="width: 100%; border: none; border-bottom: 1px solid #e5e7eb; border-radius: 0; padding: 8px 0; font-family: inherit; font-size: 13px; resize: none; height: 40px; box-sizing: border-box; outline: none; background: transparent; color: #374151;"></textarea>
          <button id="comment-submit" style="margin-top: 8px; padding: 6px 14px; background: linear-gradient(135deg, #667eea 0%, #5568d3 100%); color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 500; transition: all 0.3s; outline: none; font-size: 12px; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);">
            <i class="fas fa-paper-plane"></i> Post
          </button>
        </div>
      `;
    } else {
      html += `
        <div style="background: #e3f2fd; border-left: 4px solid #2196F3; padding: 12px; margin-bottom: 24px; border-radius: 4px; outline: none;">
          <p style="margin: 0;">
            <a href="login.html" style="color: #1976D2; text-decoration: none; font-weight: 600;">Login</a> to join the discussion
          </p>
        </div>
      `;
    }

    // Comments list
    if (comments.length === 0) {
      html += `
        <div style="text-align: center; padding: 30px 0; color: #999; outline: none;">
          <p><i class="fas fa-comment-slash" style="font-size: 24px; margin-bottom: 10px; display: block;"></i></p>
          <p>No comments yet. Be the first to share your thoughts!</p>
        </div>
      `;
    } else {
      console.log('🗨️ Rendering comments:', comments);
      html += '<div style="display: flex; flex-direction: column; gap: 16px; outline: none;">';
      comments.forEach((comment, idx) => {
        console.log(`📌 Comment ${idx} FULL:`, JSON.stringify(comment, null, 2));
        console.log(`  Fields: text="${comment.text}", userName="${comment.userName}", userEmail="${comment.userEmail}"`);
        const userEmail = localStorage.getItem('userEmail') || localStorage.getItem('email') || '';
        const isOwnComment = token && comment.userEmail === userEmail;
        const date = new Date(comment.createdAt);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        const commentHtml = `
          <div data-comment-id="${comment._id}" class="${highlightCommentId === comment._id ? 'highlighted-mention-comment' : ''}" style="background: ${highlightCommentId === comment._id ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(102, 126, 234, 0.05) 100%)' : 'transparent'}; border: ${highlightCommentId === comment._id ? '2px solid #667eea' : 'none'}; border-bottom: ${highlightCommentId === comment._id ? '2px solid #667eea' : '1px solid #f3f4f6'}; border-radius: 8px; padding: ${highlightCommentId === comment._id ? '16px' : '8px 0'}; outline: none; box-shadow: ${highlightCommentId === comment._id ? '0 0 0 4px rgba(102, 126, 234, 0.2), 0 0 20px rgba(102, 126, 234, 0.35), inset 0 0 0 1px rgba(102, 126, 234, 0.2)' : 'none'}; transition: all 0.3s ease; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
              <div style="flex: 1;">
                <p style="margin: 0; font-weight: 600; color: #1f2937; font-size: 13px; display: flex; align-items: center; gap: 5px;">
                  <i class="fas fa-circle" style="font-size: 6px; color: #667eea;"></i> ${escapeHtml(comment.userName || 'Anonymous')}${highlightCommentId === comment._id ? ' <span style="margin-left: 8px; font-size: 10px; background: linear-gradient(135deg, #667eea 0%, #5568d3 100%); color: white; padding: 4px 12px; border-radius: 12px; font-weight: 700; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);">✨ Mentioned</span>' : ''}
                </p>
                <p style="margin: 0; font-size: 10px; color: #9ca3af; margin-top: 2px;">${dateStr}</p>
              </div>
              <div style="display: flex; gap: 6px; align-items: center;">
                ${token ? `
                  <button class="like-comment-btn" data-comment-id="${comment._id}" data-module="${moduleId}" style="background: none; border: none; color: #d1d5db; cursor: pointer; font-size: 11px; padding: 3px 6px; border-radius: 3px; outline: none; transition: all 0.2s; display: flex; align-items: center; gap: 3px; font-weight: 500;">
                    <i class="fas fa-heart"></i> <span class="like-count">${comment.likes?.length || 0}</span>
                  </button>
                ` : ''}
                ${isOwnComment ? `
                  <button class="delete-comment-btn" data-comment-id="${comment._id}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 10px; padding: 3px 6px; border-radius: 3px; outline: none; transition: all 0.2s; opacity: 0.6;">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                ` : ''}
              </div>
            </div>
            <p style="margin: 0; color: #374151; line-height: 1.4; font-size: 12px; outline: none; margin-top: 4px;">${formatCommentText(comment.text || '(empty)')}</p>
          </div>
        `;
        console.log(`✅ Comment ${idx} HTML generated`);
        html += commentHtml;
      });
      html += '</div>';
    }

    html += '</div>';

    console.log('📋 Setting wrapper HTML (length:', html.length, ')');
    console.log('📋 Wrapper ID:', commentsWrapper.id);
    console.log('📋 Container selector:', container.className || 'no classes', container.id || 'no id');
    commentsWrapper.innerHTML = html;
    
    console.log('✅ HTML set on wrapper. First 300 chars:', commentsWrapper.innerHTML.substring(0, 300));
    console.log('✅ Looking for data-comment-id elements in wrapper:', commentsWrapper.querySelectorAll('[data-comment-id]').length);

    console.log('📌 Before append - Container children:', container.children.length);
    container.appendChild(commentsWrapper);
    console.log('✅ Wrapper appended successfully');
    console.log('✅ After append - Container children:', container.children.length);
    console.log('✅ Wrapper in DOM?', document.getElementById(commentsWrapper.id) !== null);
    console.log('✅ Wrapper visible?', commentsWrapper.offsetParent !== null);

    // Highlight and scroll to mentioned comment if needed
    if (highlightCommentId) {
      console.log('🎯 Looking for comment to highlight:', highlightCommentId);
      setTimeout(() => {
        const allComments = commentsWrapper.querySelectorAll('[data-comment-id]');
        console.log(`📋 Total comments with data-comment-id: ${allComments.length}`);
        allComments.forEach(el => {
          console.log(`  - Comment ID: ${el.getAttribute('data-comment-id')}`);
        });
        
        const highlightedComment = commentsWrapper.querySelector(`[data-comment-id="${highlightCommentId}"]`);
        if (highlightedComment) {
          console.log(`✨ Found highlighted comment! Scrolling to: ${highlightCommentId}`);
          highlightedComment.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Remove highlight after 6 seconds
          setTimeout(() => {
            console.log(`⏱️ Removing highlight from comment: ${highlightCommentId}`);
            // Reset to normal styles
            highlightedComment.style.background = 'transparent';
            highlightedComment.style.border = 'none';
            highlightedComment.style.borderBottom = '1px solid #f3f4f6';
            highlightedComment.style.borderRadius = '0px';
            highlightedComment.style.padding = '8px 0';
            highlightedComment.style.boxShadow = 'none';
            
            // Remove the badge
            const badge = highlightedComment.querySelector('span[style*="✨"]');
            if (badge) badge.remove();
          }, 6000);
        } else {
          console.warn(`⚠️ Highlighted comment not found with ID: ${highlightCommentId}`);
        }
      }, 200);
    }

    // Add event listeners if user is logged in
    if (token) {
      console.log('🎯 Setting up event listeners for logged-in user');
      const submitBtn = document.getElementById('comment-submit');
      const commentInput = document.getElementById('comment-input');
      const mentionSuggestions = document.getElementById(`mention-suggestions-${moduleId}`);

      // Mention detection on textarea input
      commentInput?.addEventListener('input', () => {
        const text = commentInput.value;
        const cursorPos = commentInput.selectionStart;
        const textBeforeCursor = text.substring(0, cursorPos);
        const atMatch = textBeforeCursor.lastIndexOf('@');
        
        if (atMatch !== -1 && (atMatch === 0 || /\s/.test(textBeforeCursor[atMatch - 1]))) {
          const searchText = textBeforeCursor.substring(atMatch + 1).toLowerCase();
          const mentionableUsers = [];
          
          // Get unique usernames from comments
          comments.forEach(c => {
            if (!mentionableUsers.find(u => u.userName === c.userName)) {
              mentionableUsers.push({ userName: c.userName, userEmail: c.userEmail });
            }
          });
          
          // Filter matching users
          const filtered = mentionableUsers.filter(u => u.userName.toLowerCase().includes(searchText)).slice(0, 5);
          
          if (filtered.length > 0 && searchText.length > 0) {
            let suggestionsHtml = '';
            filtered.forEach((user, idx) => {
              suggestionsHtml += `
                <div class="mention-suggestion" data-name="${user.userName}" style="padding: 8px 12px; cursor: pointer; background: ${idx === 0 ? '#f3f4f6' : 'white'}; border-bottom: 1px solid #f3f4f6; font-size: 12px; transition: all 0.15s; display: flex; align-items: center; gap: 6px;">
                  <span style="font-weight: 700; font-size: 14px;">@</span> <span style="font-weight: 600;">${escapeHtml(user.userName)}</span>
                </div>
              `;
            });
            mentionSuggestions.innerHTML = suggestionsHtml;
            mentionSuggestions.style.display = 'block';
            
            // Click on mention suggestion
            document.querySelectorAll('.mention-suggestion').forEach(item => {
              item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = '#ede9fe';
                item.style.color = '#667eea';
              });
              item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = 'white';
                item.style.color = '#374151';
              });
              item.addEventListener('click', () => {
                const userName = item.dataset.name;
                const beforeAt = textBeforeCursor.substring(0, atMatch);
                const afterCursor = text.substring(cursorPos);
                commentInput.value = beforeAt + '@' + userName + ' ' + afterCursor;
                mentionSuggestions.style.display = 'none';
                commentInput.focus();
              });
            });
          } else {
            mentionSuggestions.style.display = 'none';
          }
        } else {
          mentionSuggestions.style.display = 'none';
        }
      });

      submitBtn?.addEventListener('click', async () => {
        const text = commentInput?.value;
        if (!text || text.trim().length === 0) {
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';

        const result = await postComment(moduleId, courseId, text);
        console.log('Post comment result:', result);
        
        if (result.success) {
          commentInput.value = '';
          // Wait a moment for server to persist, then refresh
          await new Promise(r => setTimeout(r, 500));
          
          // Clear cache and reload comments
          const cacheKey = 'module_comments_' + moduleId;
          localStorage.removeItem(cacheKey);
          
          // Re-render comments by removing old wrapper and creating new one
          const oldWrapper = document.getElementById(`comments-wrapper-${moduleId}`);
          if (oldWrapper) oldWrapper.remove();
          
          await renderComments(container, moduleId, courseId);
        } else {
          console.error('Failed to post comment:', result);
          await showError('Failed to Post', result.error || 'Could not post your comment. Please try again.', 4000);
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Post';
        }
      });

      // Delete comment listeners
      document.querySelectorAll('.delete-comment-btn')?.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          const confirmed = await showConfirm('Delete Comment', 'Are you sure you want to delete this comment?', 'Delete', 'warning');
          if (confirmed) {
            const commentId = btn.dataset.commentId;
            const result = await deleteComment(commentId, moduleId);
            if (result.success) {
              container.innerHTML = '';
              await renderComments(container, moduleId, courseId);
              await showAlert('Deleted', 'Comment has been deleted.', 'success');
            } else {
              await showError('Failed to Delete', result.error || 'Could not delete the comment.', 4000);
            }
          }
        });
      });

      // Like comment listeners
      document.querySelectorAll('.like-comment-btn')?.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
          if (!btn.classList.contains('liked')) {
            btn.style.color = '#9ca3af';
          }
        });
        btn.addEventListener('mouseleave', () => {
          if (!btn.classList.contains('liked')) {
            btn.style.color = '#d1d5db';
            btn.style.backgroundColor = 'transparent';
          }
        });
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          const commentId = btn.dataset.commentId;
          const likeCountEl = btn.querySelector('.like-count');
          const currentCount = parseInt(likeCountEl?.textContent || 0);
          const isLiked = btn.classList.contains('liked');
          
          if (isLiked) {
            // Unlike - gray empty heart
            likeCountEl.textContent = Math.max(0, currentCount - 1);
            btn.style.color = '#d1d5db';
            btn.style.backgroundColor = 'transparent';
            btn.classList.remove('liked');
            console.log('💔 Unliked comment:', commentId);
          } else {
            // Like - blue filled heart
            likeCountEl.textContent = currentCount + 1;
            btn.style.color = '#667eea';
            btn.style.backgroundColor = 'transparent';
            btn.classList.add('liked');
            btn.style.transform = 'scale(1.1)';
            setTimeout(() => btn.style.transform = 'scale(1)', 150);
            console.log('❤️ Liked comment:', commentId);
          }
        });
      });

      // Sort button listeners
      document.querySelectorAll('.sort-btn')?.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          const sortType = btn.dataset.sort;
          const module = btn.dataset.module;
          sessionStorage.setItem(`comments-sort-${module}`, sortType);
          await renderComments(container, moduleId, courseId);
        });
      });
    }

  } catch (err) {
    console.error('❌ Error rendering comments:', err);
    console.error('Stack:', err.stack);
    try {
      await showError('Error', 'Failed to load comments. Please check the console.', 4000);
    } catch (e) {
      console.error('Error showing error message:', e);
    }
  }
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}
