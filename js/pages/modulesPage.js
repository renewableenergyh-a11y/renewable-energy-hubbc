import { getModulesForCourse } from "../core/moduleService.js";
import { getBookmarks, toggleBookmark } from "../core/bookmarkService.js";
import { getToken } from "../core/auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Check if user is logged in
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  if (!isLoggedIn) {
    const modulesGrid = document.getElementById("modules-grid");
    if (modulesGrid) {
      modulesGrid.innerHTML = '<div style="text-align: center; padding: 40px;"><p style="font-size: 18px; margin-bottom: 20px;">You must be logged in to view modules.</p><a href="login.html" class="btn-primary" style="display: inline-block; margin-top: 20px;">Go to Login</a></div>';
    }
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const courseId = params.get("course");

  const modulesGrid = document.getElementById("modules-grid");

  if (!modulesGrid) return;

  let allModules = [];

  try {
    if (!courseId) {
      // No course provided: load modules for all courses so header search works.
      try {
        // Use StorageSync to load courses (with fallback)
        let coursesList = [];
        try {
          coursesList = await StorageSync.loadAndSyncCourses();
        } catch (err) {
          console.warn('StorageSync failed, trying direct fetch:', err);
          const resp = await fetch('/api/courses');
          if (resp.ok) coursesList = await resp.json();
        }

        const allPromises = (coursesList || []).map(async c => {
          const mods = await getModulesForCourse(c.id);
          return (mods || []).map(m => ({ ...m, courseId: c.id, category: m.category || c.id, isPremium: m.isPremium || false, image: m.image || c.image || '' }));
        });

        const results = await Promise.all(allPromises);
        allModules = results.flat();
      } catch (err) {
        console.warn('Failed to load all modules fallback:', err);
        modulesGrid.innerHTML = "<p>No course selected.</p>";
        return;
      }
    } else {
      // Show modules for specific course
      const modules = await getModulesForCourse(courseId);
      allModules = modules.map(m => ({
        ...m,
        courseId: courseId,
        category: m.category || courseId,
        isPremium: m.isPremium || false,
        image: ""
      }));
    }

    function renderModules(data) {
      modulesGrid.innerHTML = "";

      if (data.length === 0) {
        modulesGrid.innerHTML = `<p class="no-results">No modules found.</p>`;
        return;
      }

      const loggedIn = localStorage.getItem("isLoggedIn") === "true";
      const hasPremium = localStorage.getItem("hasPremium") === "true";
      const adminUnlocked = sessionStorage.getItem('adminUnlocked') === 'true';
      const token = getToken();
      
      // Check for global premium promotion override
      const promotionActive = window.premiumForAll === true;
      const promotionNotExpired = window.promotionEndTime && Date.now() < window.promotionEndTime;
      const hasPromotionAccess = promotionActive && promotionNotExpired;

      data.forEach(module => {
        // Admin unlock bypasses premium checks (admin can view even if not logged in)
        const isLocked = module.isPremium && !adminUnlocked && !loggedIn;
        // Logged in but no premium (unless promotion is active)
        const isPaidRequired = module.isPremium && !adminUnlocked && loggedIn && !hasPremium && !hasPromotionAccess;

        const desc = module.description || '';
        const shortDesc = desc.length > 120 ? desc.slice(0, 117).trim() + '…' : desc;

        if (isLocked) {
          // Not logged in - link to login
          const card = `
            <div class="lesson-card">
              ${module.image ? `<img src="${module.image}" alt="${module.title}" class="lesson-image">` : ''}
              <h3>${module.title}</h3>
              <span class="tag premium">${adminUnlocked ? 'Premium (Admin Unlocked)' : 'Premium'}</span>
              <p>${shortDesc}</p>
              <a href="login.html" class="btn-primary">Login to Access</a>
            </div>
          `;
          modulesGrid.innerHTML += card;
        } else if (isPaidRequired) {
          // Logged in but not premium - link to billing
          const card = `
            <div class="lesson-card">
              ${module.image ? `<img src="${module.image}" alt="${module.title}" class="lesson-image">` : ''}
              <h3>${module.title}</h3>
              <span class="tag premium">${adminUnlocked ? 'Premium (Admin Unlocked)' : 'Premium'}</span>
              <p>${shortDesc}</p>
              <a href="billing.html?upgrade=true" class="btn-primary">Upgrade to Access</a>
            </div>
          `;
          modulesGrid.innerHTML += card;
        } else {
          // Free or has premium or has promotion access - allow access
          const bookmarkBtn = token ? `<button class="bookmark-btn" data-module-id="${module.id}" data-course-id="${module.courseId}" data-module-title="${module.title.replace(/"/g, '&quot;')}" title="Add to bookmarks" style="position: absolute; bottom: 10px; right: 10px; background: rgba(255,255,255,0.9); border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; color: #999; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)'; this.style.transform='scale(1.1)';" onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'; this.style.transform='scale(1)';"><i class="far fa-bookmark"></i></button>` : '';
          
          const card = `
            <div class="lesson-card" style="position: relative;">
              ${bookmarkBtn}
              ${module.image ? `<img src="${module.image}" alt="${module.title}" class="lesson-image">` : ''}
              <h3>${module.title}</h3>
              <span class="tag ${module.isPremium ? 'premium' : 'free'}">${module.isPremium ? (adminUnlocked ? 'Premium (Admin Unlocked)' : (hasPromotionAccess ? 'Premium (Promotion)' : 'Premium')) : 'Free'}</span>
              <p>${shortDesc}</p>
              <a href="module.html?course=${module.courseId}&module=${module.id}" class="btn-primary">
                Open Module
              </a>
            </div>
          `;
          modulesGrid.innerHTML += card;
        }
      });

      // Add event listeners for bookmark buttons
      addBookmarkListeners(data);
    }

    // Add bookmark button event listeners
    async function addBookmarkListeners(modules) {
      const bookmarks = await getBookmarks();
      const bookmarkMap = new Map(bookmarks.map(b => [b.moduleId, true]));

      document.querySelectorAll('.bookmark-btn').forEach(btn => {
        const moduleId = btn.dataset.moduleId;
        const isBookmarked = bookmarkMap.has(moduleId);
        
        // Update visual state
        updateBookmarkButton(btn, isBookmarked);
        
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const courseId = btn.dataset.courseId;
          const moduleTitle = btn.dataset.moduleTitle.replace(/&quot;/g, '"');
          
          const success = await toggleBookmark(moduleId, courseId, moduleTitle);
          if (success) {
            // Get current state from bookmarkMap
            const currentState = bookmarkMap.has(moduleId);
            const newState = !currentState;
            
            // Update bookmarkMap
            if (newState) {
              bookmarkMap.set(moduleId, true);
            } else {
              bookmarkMap.delete(moduleId);
            }
            
            updateBookmarkButton(btn, newState);
          }
        });
      });
    }

    function updateBookmarkButton(btn, isBookmarked) {
      if (isBookmarked) {
        btn.style.color = '#ff9800';
        btn.innerHTML = '<i class="fas fa-bookmark"></i>';
        btn.title = 'Remove from bookmarks';
      } else {
        btn.style.color = '#999';
        btn.innerHTML = '<i class="far fa-bookmark"></i>';
        btn.title = 'Add to bookmarks';
      }
    }

    // Initial load
    renderModules(allModules);

    // modules search removed per user request

  } catch (err) {
    console.error('❌ Error loading modules:', err);
    modulesGrid.innerHTML = `<p>Error loading modules. ${err.message}</p>`;
  }

  // Admin unlock button (floating) - similar behavior to module page
  const adminBtn = document.getElementById('admin-unlock-btn');
  if (adminBtn) {
    adminBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed'; overlay.style.left = 0; overlay.style.top = 0; overlay.style.right = 0; overlay.style.bottom = 0;
      overlay.style.background = 'rgba(0,0,0,0.45)'; overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center'; overlay.style.zIndex = 99999;
      const box = document.createElement('div'); box.style.background = '#fff'; box.style.padding = '18px'; box.style.borderRadius = '10px'; box.style.width = '360px'; box.style.maxWidth = '92%'; box.style.boxShadow = '0 12px 40px rgba(2,6,23,0.25)';
      box.innerHTML = `<h3 style="margin:0 0 10px 0">Admin Unlock</h3><p style="margin:0 0 12px 0;color:#666;font-size:14px">Enter admin ID number to unlock premium modules on this device.</p>`;
      const input = document.createElement('input'); input.type = 'text'; input.placeholder = 'Admin ID number'; input.style.width = '100%'; input.style.padding = '10px'; input.style.marginBottom = '12px'; input.style.border = '1px solid #e6e9ef'; input.style.borderRadius = '6px';
      const row = document.createElement('div'); row.style.display = 'flex'; row.style.justifyContent = 'flex-end'; row.style.gap = '8px';
      const cancel = document.createElement('button'); cancel.textContent = 'Cancel'; cancel.style.padding = '8px 12px'; cancel.style.border = 'none'; cancel.style.background = '#e5e7eb'; cancel.style.borderRadius = '6px';
      const ok = document.createElement('button'); ok.textContent = 'OK'; ok.style.padding = '8px 12px'; ok.style.border = 'none'; ok.style.background = '#0b6fb7'; ok.style.color = '#fff'; ok.style.borderRadius = '6px';
      row.appendChild(cancel); row.appendChild(ok);
      box.appendChild(input); box.appendChild(row);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      input.focus();

      const cleanup = () => { try { overlay.remove(); } catch(e){} };
      cancel.addEventListener('click', () => { cleanup(); });
      overlay.addEventListener('click', (ev) => { if (ev.target === overlay) cleanup(); });

      ok.addEventListener('click', async () => {
        const val = (input.value || '').trim();
        if (!val) { await showAlert('Missing ID', 'Please enter an admin ID number.', 'warning'); return; }
        try {
          const res = await fetch('/server/admins.json');
          if (!res.ok) { await showAlert('Error', 'Unable to verify admin ID at this time.', 'error'); cleanup(); return; }
          const list = await res.json();
          const match = (list || []).find(a => (a.idNumber||'').trim() === val);
          if (match) {
            // preserve through the immediate reload so the modules render as unlocked
            sessionStorage.setItem('adminUnlocked', 'true');
            sessionStorage.setItem('adminUnlockPreserve', '1');
            await showAlert('Unlocked', 'Premium modules unlocked for this browser session.', 'success');
            cleanup();
            window.location.reload();
          } else {
            await showAlert('Invalid ID', 'The ID number entered was not recognized.', 'error');
          }
        } catch (e) {
          console.error('Admin verify error', e);
          await showAlert('Error', 'We couldn\'t verify your admin ID. Please try again.', 'error');
          cleanup();
        }
      });
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ok.click(); });
    });
  }

  // Clear session-only admin unlock when leaving the modules section/page
  try {
    window.addEventListener('beforeunload', () => {
      try {
        const preserve = sessionStorage.getItem('adminUnlockPreserve') === '1';
        if (preserve) {
          // clear the one-time preserve flag and keep `adminUnlocked` through the reload
          sessionStorage.removeItem('adminUnlockPreserve');
        } else {
          sessionStorage.removeItem('adminUnlocked');
        }
      } catch (e) {}
    });
  } catch (e) {}
});
