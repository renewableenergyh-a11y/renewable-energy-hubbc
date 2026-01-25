// Detect if running on file:// protocol (local file, no server)
const isLocalFile = window.location.protocol === 'file:';

// Check if user is logged in - redirect to login if not
function checkLoginStatus() {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  
  if (!isLoggedIn) {
    // Get current URL to redirect back after login
    const currentUrl = window.location.href;
    window.location.href = `login.html?redirect=${encodeURIComponent(currentUrl)}`;
  }
}

// Run login check immediately (before DOM loads)
checkLoginStatus();

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("courses-grid");
  const filterButtons = document.querySelectorAll(".filter-btn");
  let allCourses = [];
  let activeCategory = "all";

  // Check URL for filter parameter
  const urlParams = new URLSearchParams(window.location.search);
  const urlFilter = urlParams.get('filter');
  if (urlFilter) {
    activeCategory = urlFilter.toLowerCase();
  }

  async function loadCourses() {
    try {
      console.log('🔄 Fetching courses...');
      if (isLocalFile) {
        console.log(`📁 Loading local courses: data/courses.json`);
        const resLocal = await fetch('data/courses.json');
        if (!resLocal.ok) throw new Error('Local courses.json not found');
        allCourses = await resLocal.json();
      } else {
        // Use StorageSync to load from server and cache to localStorage
        allCourses = await StorageSync.loadAndSyncCourses();
      }
      console.log('✅ Courses loaded:', allCourses);
    } catch (err) {
      console.warn('⚠️ Error loading courses:', err.message);
      allCourses = [];
    }
  }

  async function getModulesPremiumStatus(courseId) {
    try {
      if (isLocalFile) {
        const res = await fetch('data/modules/modsvc_fetched.js');
        if (res.ok) {
          const text = await res.text();
          const modules = JSON.parse(text);
          const courseModules = modules.filter(m => m.courseId === courseId);
          if (courseModules.length === 0) return null;
          
          const hasFree = courseModules.some(m => !m.isPremium);
          const hasPremium = courseModules.some(m => m.isPremium);
          
          if (hasFree && hasPremium) return 'mixed';
          if (hasFree) return 'free';
          if (hasPremium) return 'premium';
        }
      } else {
        // Use StorageSync to load from server and cache to localStorage
        const modules = await StorageSync.loadAndSyncModules(courseId);
        if (modules.length === 0) return null;
        
        const hasFree = modules.some(m => !m.isPremium);
        const hasPremium = modules.some(m => m.isPremium);
        
        if (hasFree && hasPremium) return 'mixed';
        if (hasFree) return 'free';
        if (hasPremium) return 'premium';
      }
    } catch (err) {
      console.warn('Could not determine module premium status:', err);
    }
    return null;
  }

  async function renderCourses(data) {
    const loggedIn = localStorage.getItem("isLoggedIn") === "true";
    if (!container) return;
    
    const courseCards = await Promise.all(data.map(async course => {
      const isLocked = course.isPremium && !loggedIn;
      const desc = course.description || "";
      const shortDesc = desc.length > 120 ? desc.slice(0, 117).trim() + '…' : desc;
      
      // Determine module premium status for tag
      const moduleStatus = await getModulesPremiumStatus(course.id);
      let tagClass = 'free';
      let tagText = 'Free';
      
      if (moduleStatus === 'mixed') {
        tagClass = 'mixed';
        tagText = 'Free | Premium';
      } else if (moduleStatus === 'premium') {
        tagClass = 'premium';
        tagText = 'Premium';
      } else if (isLocked) {
        tagClass = 'premium';
        tagText = 'Premium';
      }

      return isLocked
        ? `
          <a href="login.html" class="course-link">
            <div class="lesson-card locked">
              <img src="${course.image}" alt="${course.title}" class="lesson-image">
              <h3>${course.title}</h3>
              <span class="tag ${tagClass}">${tagText}</span>
              <p>${shortDesc}</p>
              <button class="btn-primary">Unlock Course</button>
            </div>
          </a>
        `
        : `
          <div class="lesson-card">
            <img src="${course.image}" alt="${course.title}" class="lesson-image">
            <h3>${course.title}</h3>
            <span class="tag ${tagClass}">${tagText}</span>
            <p>${shortDesc}</p>
            <a href="modules.html?course=${course.id}" class="btn-primary">Start Course</a>
          </div>
        `;
    }));
    
    container.innerHTML = courseCards.join("");
  }

  function applyFilters() {
    const filtered = allCourses.filter(course => {
      const category = (course.category || '').toLowerCase();
      return activeCategory === 'all' || category === String(activeCategory).toLowerCase();
    });
    renderCourses(filtered);
  }

  // Load data and initialize UI
  await loadCourses();
  
  // Apply URL filter if present, otherwise show all
  if (urlFilter) {
    applyFilters();
  } else {
    renderCourses(allCourses);
  }

  // Update active button to match current filter
  if (urlFilter) {
    filterButtons.forEach(btn => {
      if ((btn.dataset.category || 'all').toLowerCase() === urlFilter.toLowerCase()) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Attach filter listeners (always)
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category || 'all';
      applyFilters();
    });
  });
});
