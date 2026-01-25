/**
 * Gamification Service - Manage points, achievements, and leaderboards
 * Motivates users with rewards and recognition
 */

const API_BASE = '';
const USER_STATS_CACHE_KEY = 'user_stats_cache';
let userStatsCache = null;

/**
 * Award points for an action
 * @param {string} action - Action type (module_view, quiz_pass, comment, bookmark)
 * @param {number} multiplier - Points multiplier (default 1)
 * @returns {number} Points awarded
 */
export function calculatePoints(action, multiplier = 1) {
  const points = {
    'module_view': 10,
    'quiz_pass': 50,
    'quiz_attempt': 20,
    'comment': 5,
    'bookmark': 2,
    'first_module': 25,
    'first_quiz_pass': 100
  };
  return (points[action] || 0) * multiplier;
}

/**
 * Award achievement
 * @param {string} achievementId - Achievement ID
 * @returns {object} Achievement details
 */
export function getAchievementDetails(achievementId) {
  const achievements = {
    'first_step': { title: '🎯 First Step', description: 'View your first module', points: 0 },
    'module_master': { title: '📚 Module Master', description: 'View 10 modules', points: 0 },
    'quiz_champion': { title: '🏆 Quiz Champion', description: 'Pass 5 quizzes', points: 0 },
    'perfect_score': { title: '⭐ Perfect Score', description: 'Score 100% on a quiz', points: 0 },
    'social_butterfly': { title: '🦋 Social Butterfly', description: 'Post 5 comments', points: 0 },
    'bookworm': { title: '📖 Bookworm', description: 'Bookmark 10 modules', points: 0 },
    'streak_7': { title: '🔥 Week Warrior', description: 'Learn 7 days in a row', points: 0 },
    'learner_level_2': { title: '⬆️ Level 2 Learner', description: 'Reach 500 points', points: 0 },
    'learner_level_5': { title: '🌟 Level 5 Master', description: 'Reach 2000 points', points: 0 }
  };
  return achievements[achievementId] || null;
}

/**
 * Get user's gamification stats
 * @returns {Promise<object>} User stats with points, level, achievements
 */
export async function getUserStats() {
  const token = localStorage.getItem('authToken');
  if (!token) return null;

  // Check cache first
  if (userStatsCache) {
    return userStatsCache;
  }

  try {
    const response = await fetch(`${API_BASE}/api/gamification/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const stats = await response.json();
      userStatsCache = stats;
      localStorage.setItem(USER_STATS_CACHE_KEY, JSON.stringify(stats));
      return stats;
    }
    return null;
  } catch (err) {
    console.warn('Failed to fetch user stats:', err);
    return null;
  }
}

/**
 * Get user's current level based on points
 * @param {number} points - Total points
 * @returns {object} Level info {level, nextLevelPoints, progress}
 */
export function calculateLevel(points) {
  const levels = [
    { level: 1, minPoints: 0, maxPoints: 500 },
    { level: 2, minPoints: 500, maxPoints: 1000 },
    { level: 3, minPoints: 1000, maxPoints: 1500 },
    { level: 4, minPoints: 1500, maxPoints: 2500 },
    { level: 5, minPoints: 2500, maxPoints: Infinity }
  ];

  const levelInfo = levels.find(l => points >= l.minPoints && points < l.maxPoints);
  const nextLevel = levels.find(l => l.level === (levelInfo?.level || 1) + 1);

  return {
    level: levelInfo?.level || 1,
    currentPoints: points,
    minPointsForLevel: levelInfo?.minPoints || 0,
    maxPointsForLevel: levelInfo?.maxPoints || 500,
    nextLevelPoints: nextLevel?.minPoints || Infinity,
    progress: levelInfo ? Math.round(((points - levelInfo.minPoints) / (levelInfo.maxPoints - levelInfo.minPoints)) * 100) : 0
  };
}

/**
 * Get global leaderboard
 * @param {number} limit - Number of top users
 * @returns {Promise<Array>} Top users with scores
 */
export async function getLeaderboard(limit = 10) {
  const token = localStorage.getItem('authToken');
  if (!token) return [];

  try {
    const response = await fetch(`${API_BASE}/api/gamification/leaderboard?limit=${limit}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (err) {
    console.warn('Failed to fetch leaderboard:', err);
    return [];
  }
}

/**
 * Award points for an action
 * @param {string} action - Action type
 * @param {object} data - Action data (moduleId, courseId, etc.)
 * @returns {Promise<boolean>} Success status
 */
export async function awardPoints(action, data) {
  const token = localStorage.getItem('authToken');
  if (!token) return false;

  try {
    const response = await fetch(`${API_BASE}/api/gamification/award`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, ...data })
    });

    if (response.ok) {
      clearUserStatsCache();
      
      // Refresh notifications after points awarded
      if (typeof notificationService !== 'undefined' && notificationService.fetchNotifications) {
        setTimeout(() => {
          notificationService.fetchNotifications().catch(err => {
            console.warn('Failed to refresh notifications:', err);
          });
        }, 500);
      }
      
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Failed to award points:', err);
    return false;
  }
}

/**
 * Clear user stats cache
 */
export function clearUserStatsCache() {
  userStatsCache = null;
  localStorage.removeItem(USER_STATS_CACHE_KEY);
}

/**
 * Get user's achievements
 * @returns {Promise<Array>} User's achieved achievements
 */
export async function getUserAchievements() {
  const token = localStorage.getItem('authToken');
  if (!token) return [];

  try {
    const response = await fetch(`${API_BASE}/api/gamification/achievements`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (err) {
    console.warn('Failed to fetch achievements:', err);
    return [];
  }
}
