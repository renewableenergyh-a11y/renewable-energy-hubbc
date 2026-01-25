/**
 * Progress Dashboard - Display user's learning statistics and achievements
 */

import { getToken } from '../core/auth.js';
import { getAttendanceStats } from '../core/attendanceService.js';
import { showAlert } from '../core/modalService.js';

export async function renderProgressDashboard() {
  const container = document.getElementById('progress-container');
  if (!container) return;

  const token = getToken();
  if (!token) {
    container.innerHTML = '<p style="text-align: center; padding: 40px;">Please <a href="login.html">login</a> to view your progress.</p>';
    return;
  }

  container.innerHTML = '<p style="text-align: center; color: #999;">Loading your progress...</p>';

  try {
    const stats = await getAttendanceStats();

    if (!stats) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <p style="font-size: 18px; color: #666; margin-bottom: 20px;">No activity yet</p>
          <p style="color: #999;">Start exploring courses and taking quizzes to see your progress here!</p>
          <a href="courses.html" class="btn-primary" style="display: inline-block; margin-top: 20px;">Browse Courses</a>
        </div>
      `;
      return;
    }

    const html = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px; outline: none;">
        ${createStatCard('📚 Modules Viewed', stats.uniqueModulesViewed || 0, 'Total modules explored')}
        ${createStatCard('🎓 Courses Started', stats.uniqueCoursesViewed || 0, 'Different courses visited')}
        ${createStatCard('⏱️ Learning Time', formatTime(stats.totalDurationMinutes || 0), 'Total time spent learning')}
        ${createStatCard('Quizzes Completed', stats.quizzesCompleted || 0, `${stats.quizzesPassed || 0} passed`)}
      </div>

      <div class="progress-summary-section" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; color: white; margin-bottom: 40px; outline: none;">
        <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 18px; outline: none;">
          <i class="fas fa-trophy"></i> Quiz Performance
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; outline: none;">
          <div style="outline: none;">
            <p style="margin: 0 0 10px 0; opacity: 0.9; outline: none;">Pass Rate</p>
            <p style="margin: 0; font-size: 28px; font-weight: 600; outline: none;">
              ${stats.quizzesCompleted > 0 ? Math.round((stats.quizzesPassed / stats.quizzesCompleted) * 100) : 0}%
            </p>
          </div>
          <div>
            <p style="margin: 0 0 10px 0; opacity: 0.9;">Average Score</p>
            <p style="margin: 0; font-size: 28px; font-weight: 600;">
              ${stats.averageQuizScore}/${Math.max(...(stats.allAttendance?.filter(a => a.type === 'quiz_completion').map(a => a.totalQuestions) || [100]))}
            </p>
          </div>
        </div>
      </div>

      <div class="activity-section" style="background: #f5f5f5; border-radius: 12px; padding: 24px; margin-bottom: 40px;">
        <h3 style="margin-top: 0; margin-bottom: 20px; font-size: 18px;">
          <i class="fas fa-fire"></i> Learning Activity
        </h3>
        ${renderActivityTimeline(stats.allAttendance || [])}
      </div>

      <div style="text-align: center; padding: 20px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #4caf50;">
        <p style="margin: 0; color: #2e7d32;">
          <i class="fas fa-star"></i> Keep learning! Your progress is being tracked.
        </p>
      </div>
    `;

    container.innerHTML = html;

  } catch (err) {
    console.error('Error loading progress:', err);
    container.innerHTML = '<p style="text-align: center; color: #dc2626;">Error loading your progress. Please try again.</p>';
  }
}

function createStatCard(title, value, subtitle) {
  return `
    <div class="stat-card" style="background: white; border: 2px solid #e0e0e0; border-radius: 12px; padding: 20px; text-align: center; transition: all 0.3s;">
      <p style="margin: 0 0 15px 0; font-size: 24px;">${title}</p>
      <p class="stat-value" style="margin: 0 0 10px 0; font-size: 32px; font-weight: 600; color: #667eea;">${value}</p>
      <p style="margin: 0; font-size: 12px; color: #999;">${subtitle}</p>
    </div>
  `;
}

function formatTime(minutes) {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function renderActivityTimeline(activities) {
  if (!activities || activities.length === 0) {
    return '<p style="text-align: center; color: #999; padding: 20px;">No activity recorded yet</p>';
  }

  // Sort by date descending (most recent first)
  const sorted = activities.sort((a, b) => {
    const dateA = new Date(a.viewedAt || a.completedAt || 0);
    const dateB = new Date(b.viewedAt || b.completedAt || 0);
    return dateB - dateA;
  });

  // Take last 10 activities
  const recent = sorted.slice(0, 10);

  let html = '<div style="border-left: 3px solid #667eea; padding-left: 20px;">';

  recent.forEach((activity, idx) => {
    const date = new Date(activity.viewedAt || activity.completedAt);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    if (activity.type === 'module_view') {
      const duration = activity.duration ? ` (${Math.round(activity.duration / 60)}m)` : '';
      html += `
        <div style="margin-bottom: 20px; position: relative;">
          <div style="position: absolute; left: -26px; top: 5px; width: 14px; height: 14px; background: #667eea; border-radius: 50%; border: 3px solid white;"></div>
          <p style="margin: 0 0 5px 0; font-weight: 600; color: #333;">
            <i class="fas fa-book"></i> Viewed Module: ${escapeHtml(activity.moduleId)}
          </p>
          <p style="margin: 0 0 3px 0; font-size: 12px; color: #999;">${dateStr}${duration}</p>
        </div>
      `;
    } else if (activity.type === 'quiz_completion') {
      const passStatus = activity.passed ? 'Passed' : 'Did not pass';
      html += `
        <div style="margin-bottom: 20px; position: relative;">
          <div style="position: absolute; left: -26px; top: 5px; width: 14px; height: 14px; background: #4caf50; border-radius: 50%; border: 3px solid white;"></div>
          <p style="margin: 0 0 5px 0; font-weight: 600; color: #333;">
            <i class="fas fa-check-circle"></i> Completed Quiz: ${escapeHtml(activity.moduleId)}
          </p>
          <p style="margin: 0 0 3px 0; font-size: 12px; color: #666;">
            Score: ${activity.score}/${activity.totalQuestions} - ${passStatus}
          </p>
          <p style="margin: 0; font-size: 12px; color: #999;">${dateStr}</p>
        </div>
      `;
    }
  });

  html += '</div>';
  return html;
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}
