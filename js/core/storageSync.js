/**
 * Storage Sync Module
 * Handles syncing courses and modules between server/database and localStorage
 * Provides offline fallback capabilities
 */

const StorageSync = {
  /**
   * Load courses from server, save to localStorage, and return
   * Falls back to localStorage if server unavailable
   */
  async loadAndSyncCourses() {
    try {
      const res = await fetch('/api/courses');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const courses = await res.json();
      // Save to localStorage
      localStorage.setItem('courses_cache', JSON.stringify(courses));
      localStorage.setItem('courses_cache_timestamp', new Date().toISOString());
      return courses;
    } catch (err) {
      console.warn('⚠️ Failed to fetch courses from server, using localStorage cache:', err.message);
      // Try localStorage fallback
      const cached = localStorage.getItem('courses_cache');
      if (cached) {
        try {
          const courses = JSON.parse(cached);
          console.log('✅ Loaded courses from localStorage cache');
          return courses;
        } catch (e) {
          console.error('❌ Failed to parse cached courses:', e);
          return [];
        }
      }
      return [];
    }
  },

  /**
   * Load modules for a course from server, save to localStorage, and return
   * Falls back to localStorage if server unavailable
   */
  async loadAndSyncModules(courseId) {
    try {
      const res = await fetch(`/api/modules/${encodeURIComponent(courseId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const modules = await res.json();
      // Save to localStorage with course key
      localStorage.setItem(`modules_${courseId}`, JSON.stringify(modules));
      localStorage.setItem(`modules_${courseId}_timestamp`, new Date().toISOString());
      return modules;
    } catch (err) {
      console.warn(`⚠️ Failed to fetch modules for ${courseId} from server, using localStorage cache:`, err.message);
      // Try localStorage fallback
      const cached = localStorage.getItem(`modules_${courseId}`);
      if (cached) {
        try {
          const modules = JSON.parse(cached);
          console.log(`✅ Loaded modules for ${courseId} from localStorage cache`);
          return modules;
        } catch (e) {
          console.error(`❌ Failed to parse cached modules for ${courseId}:`, e);
          return [];
        }
      }
      return [];
    }
  },

  /**
   * Get all cached courses from localStorage
   */
  getCachedCourses() {
    const cached = localStorage.getItem('courses_cache');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Failed to parse cached courses:', e);
        return null;
      }
    }
    return null;
  },

  /**
   * Get all cached modules for a course from localStorage
   */
  getCachedModules(courseId) {
    const cached = localStorage.getItem(`modules_${courseId}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error(`Failed to parse cached modules for ${courseId}:`, e);
        return null;
      }
    }
    return null;
  },

  /**
   * Clear all cached data from localStorage
   */
  clearCache() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('courses_cache') || key.startsWith('modules_')) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));
    console.log('✅ Cleared storage cache');
  },

  /**
   * Check if cache exists and is recent (within specified minutes)
   */
  isCacheFresh(type, courseId = null, maxAgeMinutes = 60) {
    let key;
    if (type === 'courses') {
      key = 'courses_cache_timestamp';
    } else if (type === 'modules' && courseId) {
      key = `modules_${courseId}_timestamp`;
    } else {
      return false;
    }

    const timestamp = localStorage.getItem(key);
    if (!timestamp) return false;

    const cacheTime = new Date(timestamp);
    const now = new Date();
    const ageMinutes = (now - cacheTime) / (1000 * 60);
    
    return ageMinutes < maxAgeMinutes;
  },

  /**
   * Save courses to both server and localStorage
   */
  async saveCourses(courses) {
    try {
      // Attempt to save to server
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courses)
      });
      
      if (res.ok) {
        // Save to localStorage on success
        localStorage.setItem('courses_cache', JSON.stringify(courses));
        localStorage.setItem('courses_cache_timestamp', new Date().toISOString());
        return true;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn('⚠️ Failed to save courses to server, saving to localStorage only:', err.message);
      // Still save to localStorage even if server fails
      localStorage.setItem('courses_cache', JSON.stringify(courses));
      localStorage.setItem('courses_cache_timestamp', new Date().toISOString());
      return false;
    }
  },

  /**
   * Save modules to both server and localStorage
   */
  async saveModules(courseId, modules) {
    try {
      // Attempt to save to server
      const res = await fetch(`/api/modules/${encodeURIComponent(courseId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modules)
      });
      
      if (res.ok) {
        // Save to localStorage on success
        localStorage.setItem(`modules_${courseId}`, JSON.stringify(modules));
        localStorage.setItem(`modules_${courseId}_timestamp`, new Date().toISOString());
        return true;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn(`⚠️ Failed to save modules for ${courseId} to server, saving to localStorage only:`, err.message);
      // Still save to localStorage even if server fails
      localStorage.setItem(`modules_${courseId}`, JSON.stringify(modules));
      localStorage.setItem(`modules_${courseId}_timestamp`, new Date().toISOString());
      return false;
    }
  }
};
