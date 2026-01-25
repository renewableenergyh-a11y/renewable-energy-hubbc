/**
 * Achievement Badges Component - Display earned achievements
 * Shows user's earned badges and titles
 */

import { getUserAchievements, getAchievementDetails } from "../core/gamificationService.js";

export async function renderAchievementBadges(container) {
  if (!container) return;

  try {
    const achievements = await getUserAchievements();
    
    if (!achievements || achievements.length === 0) {
      container.innerHTML = '<p style="color: #999; text-align: center;">No achievements earned yet. Keep learning!</p>';
      return;
    }

    let html = '<div class="achievements-grid">';

    achievements.forEach(achievementId => {
      const detail = getAchievementDetails(achievementId);
      if (detail) {
        html += `
          <div class="achievement-badge" title="${detail.description}">
            <div class="achievement-icon">${detail.title.split(' ')[0]}</div>
            <div class="achievement-name">${detail.title}</div>
            <div class="achievement-desc">${detail.description}</div>
          </div>
        `;
      }
    });

    html += '</div>';
    container.innerHTML = html;

    // Add styles if not present
    if (!document.getElementById('achievement-styles')) {
      const style = document.createElement('style');
      style.id = 'achievement-styles';
      style.textContent = `
        .achievements-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 15px;
          margin: 20px 0;
        }

        .achievement-badge {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .achievement-badge:hover {
          transform: translateY(-5px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .achievement-icon {
          font-size: 2.5em;
          margin-bottom: 8px;
        }

        .achievement-name {
          font-weight: 600;
          font-size: 0.95em;
          margin-bottom: 5px;
        }

        .achievement-desc {
          font-size: 0.8em;
          opacity: 0.9;
          line-height: 1.3;
        }
      `;
      document.head.appendChild(style);
    }
  } catch (err) {
    console.error('Error rendering achievement badges:', err);
    container.innerHTML = '<p style="color: #d32f2f;">Failed to load achievements.</p>';
  }
}

export function createAchievementNotification(achievementId) {
  const detail = getAchievementDetails(achievementId);
  if (!detail) return;

  const notification = document.createElement('div');
  notification.className = 'achievement-notification';
  notification.innerHTML = `
    <div class="achievement-notification-content">
      <div class="achievement-notification-icon">${detail.title.split(' ')[0]}</div>
      <div class="achievement-notification-text">
        <div class="achievement-notification-title">Achievement Unlocked!</div>
        <div class="achievement-notification-name">${detail.title}</div>
        <div class="achievement-notification-desc">${detail.description}</div>
      </div>
    </div>
  `;

  // Add styles if not present
  if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      .achievement-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        animation: slideInRight 0.3s ease;
        z-index: 1000;
        max-width: 350px;
      }

      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      .achievement-notification-content {
        display: flex;
        gap: 15px;
      }

      .achievement-notification-icon {
        font-size: 2.5em;
        flex-shrink: 0;
      }

      .achievement-notification-title {
        font-weight: 600;
        font-size: 0.9em;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.9;
      }

      .achievement-notification-name {
        font-size: 1.1em;
        font-weight: bold;
        margin: 5px 0;
      }

      .achievement-notification-desc {
        font-size: 0.85em;
        opacity: 0.85;
      }

      @media (max-width: 480px) {
        .achievement-notification {
          bottom: 10px;
          right: 10px;
          left: 10px;
          max-width: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}
