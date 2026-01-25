/**
 * User Stats Card Component - Display user's gamification stats
 * Shows points, level, and achievements in a card format
 */

import { getUserStats, calculateLevel } from "../core/gamificationService.js";
import { renderAchievementBadges } from "./achievementComponent.js";

export async function renderUserStatsCard(container) {
  if (!container) return;

  try {
    const stats = await getUserStats();
    if (!stats) {
      container.innerHTML = '<p style="color: #999;">Not logged in</p>';
      return;
    }

    const level = stats.level || calculateLevel(stats.points || 0);
    const progressPercent = level.progress || 0;

    let html = `
      <div class="user-stats-card">
        <div class="stats-header">
          <h3>Your Performance</h3>
        </div>

        <div class="stats-main">
          <div class="stat-box">
            <div class="stat-icon">⭐</div>
            <div class="stat-content">
              <div class="stat-value">${stats.points || 0}</div>
              <div class="stat-label">Points</div>
            </div>
          </div>

          <div class="stat-box">
            <div class="stat-icon">📈</div>
            <div class="stat-content">
              <div class="stat-value">Lv. ${level.level}</div>
              <div class="stat-label">Level</div>
            </div>
          </div>

          <div class="stat-box">
            <div class="stat-icon">🎯</div>
            <div class="stat-content">
              <div class="stat-value">${stats.achievements?.length || 0}</div>
              <div class="stat-label">Achievements</div>
            </div>
          </div>
        </div>

        <div class="level-progress">
          <div class="progress-label">
            <span>Level Progress</span>
            <span class="progress-text">${progressPercent}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <div class="progress-info">
            <span>${stats.points || 0} / ${level.nextLevelPoints}</span>
          </div>
        </div>

        <div class="stats-achievements">
          <h4>Recent Achievements</h4>
          <div id="achievements-container"></div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Add styles if not present
    if (!document.getElementById('user-stats-styles')) {
      const style = document.createElement('style');
      style.id = 'user-stats-styles';
      style.textContent = `
        .user-stats-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .stats-header {
          margin-bottom: 20px;
        }

        .stats-header h3 {
          margin: 0;
          color: #333;
          font-size: 1.3em;
        }

        .stats-main {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 15px;
          margin-bottom: 25px;
        }

        .stat-box {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 15px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .stat-icon {
          font-size: 1.8em;
        }

        .stat-content {
          flex: 1;
        }

        .stat-value {
          font-size: 1.4em;
          font-weight: bold;
        }

        .stat-label {
          font-size: 0.8em;
          opacity: 0.9;
        }

        .level-progress {
          background: #f5f5f5;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .progress-label {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 0.95em;
          color: #333;
          font-weight: 600;
        }

        .progress-text {
          color: #667eea;
        }

        .progress-bar {
          height: 8px;
          background: #ddd;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          transition: width 0.3s ease;
        }

        .progress-info {
          font-size: 0.85em;
          color: #999;
        }

        .stats-achievements {
          margin-top: 25px;
        }

        .stats-achievements h4 {
          margin: 0 0 15px 0;
          color: #333;
          font-size: 1.1em;
        }

        @media (max-width: 600px) {
          .stats-main {
            grid-template-columns: 1fr;
          }

          .stat-box {
            justify-content: center;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Render achievements
    const achievementsContainer = document.getElementById('achievements-container');
    if (achievementsContainer) {
      await renderAchievementBadges(achievementsContainer);
    }
  } catch (err) {
    console.error('Error rendering user stats card:', err);
    container.innerHTML = '<p style="color: #d32f2f;">Failed to load stats.</p>';
  }
}

export function renderMiniStats(container, stats) {
  if (!container || !stats) return;

  const level = stats.level || { level: 1, progress: 0 };
  
  container.innerHTML = `
    <div class="mini-stats">
      <span class="mini-stat-item">
        <i class="fas fa-star"></i> ${stats.points || 0}
      </span>
      <span class="mini-stat-item">
        <i class="fas fa-level-up"></i> Lv. ${level.level}
      </span>
      <span class="mini-stat-item">
        <i class="fas fa-trophy"></i> ${stats.achievements?.length || 0}
      </span>
    </div>
  `;

  if (!document.getElementById('mini-stats-styles')) {
    const style = document.createElement('style');
    style.id = 'mini-stats-styles';
    style.textContent = `
      .mini-stats {
        display: flex;
        gap: 15px;
        flex-wrap: wrap;
        align-items: center;
      }

      .mini-stat-item {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 0.9em;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .mini-stat-item i {
        font-size: 0.95em;
      }
    `;
    document.head.appendChild(style);
  }
}
