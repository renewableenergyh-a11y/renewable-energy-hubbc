// Attendance Service - Log and track user activities
// Tracks module views and quiz completions for the Progress Dashboard

const ATTENDANCE_CACHE_KEY = 'attendance_cache';
let attendanceCache = null;

/**
 * Log a module view
 * @param {string} moduleId - The module ID
 * @param {string} courseId - The course ID
 * @param {number} duration - Time spent in seconds (optional)
 * @returns {Promise<boolean>} Success status
 */
export async function logModuleView(moduleId, courseId, duration = 0) {
  try {
    const token = getToken();
    if (!token) {
      console.warn('No token available for logging view');
      return false;
    }

    const response = await fetch('/api/attendance/log-view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        moduleId,
        courseId,
        duration
      })
    });

    if (response.ok) {
      clearAttendanceCache();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Failed to log module view:', err);
    return false;
  }
}

/**
 * Log a quiz completion
 * @param {string} moduleId - The module ID
 * @param {string} courseId - The course ID
 * @param {number} score - The score achieved
 * @param {number} totalQuestions - Total questions in quiz
 * @param {boolean} passed - Whether the quiz was passed
 * @returns {Promise<boolean>} Success status
 */
export async function logQuizCompletion(moduleId, courseId, score, totalQuestions = 0, passed = false) {
  try {
    const token = getToken();
    if (!token) {
      console.warn('No token available for logging quiz');
      return false;
    }

    const response = await fetch('/api/attendance/log-quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        moduleId,
        courseId,
        score,
        totalQuestions,
        passed
      })
    });

    if (response.ok) {
      clearAttendanceCache();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Failed to log quiz:', err);
    return false;
  }
}

/**
 * Get user's attendance statistics
 * @returns {Promise<object>} Stats object with learning data
 */
export async function getAttendanceStats() {
  try {
    const token = getToken();
    if (!token) {
      console.warn('No token available for fetching stats');
      return null;
    }

    // Check cache first
    if (attendanceCache) {
      return attendanceCache;
    }

    // Try localStorage cache
    const cached = localStorage.getItem(ATTENDANCE_CACHE_KEY);
    if (cached) {
      try {
        attendanceCache = JSON.parse(cached);
        return attendanceCache;
      } catch (e) {
        // Invalid cache, proceed to fetch
      }
    }

    // Fetch from server
    const response = await fetch('/api/attendance/stats', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const stats = await response.json();
      attendanceCache = stats;
      localStorage.setItem(ATTENDANCE_CACHE_KEY, JSON.stringify(stats));
      return stats;
    }
    return null;
  } catch (err) {
    console.warn('Failed to fetch attendance stats:', err);
    return null;
  }
}

/**
 * Get total modules viewed by this user
 * @returns {Promise<number>} Count of modules viewed
 */
export async function getTotalModulesViewed() {
  const stats = await getAttendanceStats();
  return stats?.uniqueModulesViewed || 0;
}

/**
 * Get total courses viewed by this user
 * @returns {Promise<number>} Count of courses started
 */
export async function getTotalCoursesViewed() {
  const stats = await getAttendanceStats();
  return stats?.uniqueCoursesViewed || 0;
}

/**
 * Get total time spent learning (in minutes)
 * @returns {Promise<number>} Total minutes spent
 */
export async function getTotalLearningTime() {
  const stats = await getAttendanceStats();
  return stats?.totalDurationMinutes || 0;
}

/**
 * Get quiz performance statistics
 * @returns {Promise<object>} Quiz stats {completed, passed, avgScore}
 */
export async function getQuizStats() {
  const stats = await getAttendanceStats();
  if (!stats) return null;
  return {
    completed: stats.quizzesCompleted,
    passed: stats.quizzesPassed,
    averageScore: stats.averageQuizScore
  };
}

/**
 * Clear the attendance cache
 * Forces fresh data from server on next fetch
 */
export function clearAttendanceCache() {
  attendanceCache = null;
  localStorage.removeItem(ATTENDANCE_CACHE_KEY);
}

/**
 * Get token from auth
 * @returns {string|null} The user's token
 */
function getToken() {
  try {
    return localStorage.getItem('authToken');
  } catch (e) {
    return null;
  }
}
