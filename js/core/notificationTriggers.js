/**
 * Notification Triggers
 * Automatically creates notifications for user actions and events
 */

class NotificationTriggers {
  constructor() {
    // Detect API base URL
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      this.apiBase = 'http://localhost:8787/api';
    } else {
      this.apiBase = '/api';
    }
    this.triggers = {
      welcome: false,
      quizPassed: false,
      certificateEarned: false,
      newCourseAdded: false,
      newModuleAdded: false,
      courseOffer: false
    };
  }

  /**
   * Check for welcome notification on first login
   */
  async checkWelcome() {
    try {
      const token = localStorage.getItem('authToken');
      const createdAt = localStorage.getItem('userCreatedAt');
      
      if (!token || !createdAt) return;

      // Only show once per user (check localStorage, not session)
      if (localStorage.getItem('welcomeNotificationShown')) return;
      
      const user = JSON.parse(localStorage.getItem('userInfo') || '{}');
      await this.createNotification({
        type: 'welcome',
        title: `Welcome to Renewable Energy Hub, ${user.name || 'Learner'}! 🎉`,
        message: 'We\'re excited to have you here. Start exploring our courses to begin your renewable energy journey.',
        icon: 'fa-hand-paper',
        actionUrl: '/courses.html'
      });
      
      // Mark as shown so it only appears once
      localStorage.setItem('welcomeNotificationShown', 'true');
      this.triggers.welcome = true;
    } catch (err) {
      console.warn('Welcome notification check failed:', err);
    }
  }

  /**
   * Check for quiz passed notification
   */
  async checkQuizPassed(courseId, quizScore) {
    try {
      const token = localStorage.getItem('authToken');
      if (!token || quizScore < 70) return; // Only for passing score

      if (this.triggers.quizPassed) return;

      await this.createNotification({
        type: 'achievement',
        title: '🎓 Quiz Passed!',
        message: `Congratulations! You scored ${quizScore}% on the quiz. Great job! Keep it up to earn more points.`,
        icon: 'fa-trophy',
        actionUrl: `/module.html?course=${courseId}`
      });

      this.triggers.quizPassed = true;
    } catch (err) {
      console.warn('Quiz passed notification check failed:', err);
    }
  }

  /**
   * Check for certificate earned
   */
  async checkCertificateEarned(courseName) {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      if (this.triggers.certificateEarned) return;

      await this.createNotification({
        type: 'certificate',
        title: '📜 Certificate Earned!',
        message: `Amazing! You've completed "${courseName}" and earned your certificate. Download it now to showcase your achievement.`,
        icon: 'fa-certificate',
        actionUrl: '/account.html'
      });

      this.triggers.certificateEarned = true;
    } catch (err) {
      console.warn('Certificate notification check failed:', err);
    }
  }

  /**
   * Check for course viewed milestone
   */
  async checkMilestoneReached(modulesViewed) {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const milestones = [
        { count: 5, title: '🚀 Quick Learner', message: 'You\'ve viewed 5 modules! You\'re on a roll.' },
        { count: 10, title: '⭐ Dedicated Learner', message: 'Incredible! 10 modules completed. Keep going!' },
        { count: 25, title: '🏆 Expert Learner', message: 'Wow! 25 modules mastered. You\'re becoming an expert!' }
      ];

      for (const milestone of milestones) {
        if (modulesViewed === milestone.count && !localStorage.getItem(`milestone_${milestone.count}`)) {
          await this.createNotification({
            type: 'achievement',
            title: milestone.title,
            message: milestone.message,
            icon: 'fa-star',
            actionUrl: '/progress.html'
          });
          localStorage.setItem(`milestone_${milestone.count}`, 'true');
        }
      }
    } catch (err) {
      console.warn('Milestone notification check failed:', err);
    }
  }

  /**
   * Check for daily learning streak
   */
  async checkLearningStreak(days) {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const streaks = [1, 7, 14, 30];
      
      for (const streak of streaks) {
        if (days === streak && !localStorage.getItem(`streak_${streak}`)) {
          await this.createNotification({
            type: 'achievement',
            title: `🔥 ${streak}-Day Streak!`,
            message: `Amazing dedication! You've been learning for ${streak} consecutive days. Don't break the chain!`,
            icon: 'fa-fire',
            actionUrl: '/progress.html'
          });
          localStorage.setItem(`streak_${streak}`, 'true');
        }
      }
    } catch (err) {
      console.warn('Streak notification check failed:', err);
    }
  }

  /**
   * Check for motivational message based on time
   */
  async checkMotivationalMessage() {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const lastMotivation = localStorage.getItem('lastMotivationTime');
      const now = new Date();
      
      // Show once per day
      if (lastMotivation) {
        const last = new Date(lastMotivation);
        if (now - last < 24 * 60 * 60 * 1000) return;
      }

      const motivations = [
        { title: '💡 Keep Learning!', message: 'Every lesson brings you closer to becoming a renewable energy expert.' },
        { title: '🌱 Small Steps', message: 'Remember: Every expert was once a beginner. Keep pushing forward!' },
        { title: '⚡ You\'ve Got This!', message: 'Don\'t give up! Your energy and commitment are powering your success.' },
        { title: '🎯 Focus on Your Goal', message: 'Stay focused and consistent. Your dedication will pay off!' }
      ];

      const motivation = motivations[Math.floor(Math.random() * motivations.length)];
      
      await this.createNotification({
        type: 'achievement',
        title: motivation.title,
        message: motivation.message,
        icon: 'fa-lightbulb'
      });

      localStorage.setItem('lastMotivationTime', now.toISOString());
    } catch (err) {
      console.warn('Motivational notification check failed:', err);
    }
  }

  /**
   * Check for course/module additions (admin feature)
   */
  async checkNewContent() {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const lastCheck = localStorage.getItem('lastContentCheck');
      const now = new Date();

      // Check every 1 hour
      if (lastCheck) {
        const last = new Date(lastCheck);
        if (now - last < 60 * 60 * 1000) return;
      }

      // Fetch courses to see if there are new ones
      const response = await fetch(`${this.apiBase}/courses`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const { courses = [] } = await response.json();
        const lastCourseCount = parseInt(localStorage.getItem('courseCount') || '0');
        
        if (courses.length > lastCourseCount) {
          const newCount = courses.length - lastCourseCount;
          await this.createNotification({
            type: 'course',
            title: '📚 New Course Available!',
            message: `${newCount} new renewable energy course${newCount > 1 ? 's' : ''} just launched. Check them out!`,
            icon: 'fa-book',
            actionUrl: '/courses.html'
          });
          localStorage.setItem('courseCount', courses.length.toString());
        }
      }

      localStorage.setItem('lastContentCheck', now.toISOString());
    } catch (err) {
      console.warn('New content check failed:', err);
    }
  }

  /**
   * Check for special offers - only for new members, shown once
   */
  async checkSpecialOffers() {
    try {
      const token = localStorage.getItem('authToken');
      const hasPremium = localStorage.getItem('hasPremium') === 'true';
      
      if (!token || hasPremium) return;

      // Only show once per user (check localStorage, not session)
      if (localStorage.getItem('premiumOfferShown')) return;

      // Check if user is newly registered (within 7 days)
      const createdAt = localStorage.getItem('userCreatedAt');
      if (!createdAt) return;

      const created = new Date(createdAt);
      const now = new Date();
      const daysElapsed = (now - created) / (1000 * 60 * 60 * 24);

      // Only show to users created within 7 days
      if (daysElapsed > 7) return;

      const offers = [
        { title: '🚀 Special Promotion', message: 'New members get 2 days free Premium! Start your journey now.' }
      ];

      const offer = offers[Math.floor(Math.random() * offers.length)];
      
      await this.createNotification({
        type: 'offer',
        title: offer.title,
        message: offer.message,
        icon: 'fa-tag',
        actionUrl: '/billing.html'
      });

      // Mark as shown so it only appears once
      localStorage.setItem('premiumOfferShown', 'true');
      this.triggers.courseOffer = true;
    } catch (err) {
      console.warn('Special offer check failed:', err);
    }
  }

  /**
   * Check for leaderboard rank changes
   */
  async checkLeaderboardChange(currentRank, previousRank) {
    try {
      if (!currentRank || currentRank === previousRank) return;

      const token = localStorage.getItem('authToken');
      if (!token) return;

      if (currentRank < previousRank) {
        // Rank improved
        await this.createNotification({
          type: 'achievement',
          title: '📈 Rank Improved!',
          message: `Great effort! You've climbed to rank #${currentRank} on the leaderboard. Keep competing!`,
          icon: 'fa-arrow-up',
          actionUrl: '/leaderboard.html'
        });
      } else if (currentRank === 1) {
        // Number 1!
        await this.createNotification({
          type: 'achievement',
          title: '👑 You\'re #1!',
          message: 'Incredible! You\'ve reached the top of the leaderboard. Congratulations!',
          icon: 'fa-crown',
          actionUrl: '/leaderboard.html'
        });
      }
    } catch (err) {
      console.warn('Leaderboard notification check failed:', err);
    }
  }

  /**
   * Internal method to create notification
   */
  async createNotification(notif) {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(`${this.apiBase}/notifications/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notif)
      });

      if (!response.ok) {
        console.warn('Failed to create notification');
        return;
      }

      // Show toast notification ONLY for certificate notifications
      // Other notifications only show in the notification bell
      if (notif.type === 'certificate' && typeof notificationService !== 'undefined' && notificationService.showToastNotification) {
        notificationService.showToastNotification(notif.title, notif.message, 'success', 6000);
      }

      // If notification service is initialized, refresh notifications
      if (typeof notificationService !== 'undefined' && notificationService.fetchNotifications) {
        await notificationService.fetchNotifications();
      }
    } catch (err) {
      console.warn('Error creating notification:', err);
    }
  }

  /**
   * Start monitoring for notifications
   */
  startMonitoring() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const token = localStorage.getItem('authToken');

    if (!isLoggedIn || !token) {
      console.warn('❌ NotificationTriggers: User not logged in, skipping monitoring');
      return;
    }

    console.log('✅ NotificationTriggers: Starting to monitor for notifications');

    // Check various triggers immediately on login
    this.checkWelcome();
    this.checkSpecialOffers();
    this.checkMotivationalMessage();
    this.checkNewContent();

    // Check every 5 minutes for new triggers
    setInterval(() => {
      console.log('🔍 NotificationTriggers: Running periodic checks');
      this.checkMotivationalMessage();
      this.checkNewContent();
    }, 5 * 60 * 1000);
  }
}

// Create global instance
const notificationTriggers = new NotificationTriggers();

// Auto-start monitoring when user is logged in
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('isLoggedIn') === 'true') {
    notificationTriggers.startMonitoring();
  }
});

// Listen for login event
window.addEventListener('storage', (e) => {
  if (e.key === 'isLoggedIn' && e.newValue === 'true') {
    notificationTriggers.startMonitoring();
  }
});
