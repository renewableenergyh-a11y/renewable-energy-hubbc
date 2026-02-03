import { hasPremium, setPremium, getCurrentUserEmail, getToken } from "../core/auth.js";
import { API_BASE } from "../api-config.js";

// Modal utility functions
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function showToast(title, message, type = 'info') {
  return new Promise((resolve) => {
    const icons = { success: '✓', warning: '⚠', error: '✕', info: 'ℹ' };
    const colors = { success: '#059669', warning: '#d97706', error: '#dc2626', info: '#0284c7' };
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: white;
      border-left: 4px solid ${colors[type]};
      border-radius: 8px;
      padding: 16px 20px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      z-index: 100000;
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 350px;
      animation: slideInRight 0.3s ease-out;
    `;
    
    toast.innerHTML = `
      <div style="font-size: 20px; color: ${colors[type]}; font-weight: bold;">${icons[type]}</div>
      <div>
        <div style="font-weight: 600; color: #1f2937; font-size: 14px;">${escapeHtml(title)}</div>
        <div style="color: #6b7280; font-size: 13px;">${escapeHtml(message)}</div>
      </div>
    `;
    
    // Add animation if not already in CSS
    if (!document.querySelector('style[data-toast-animations]')) {
      const style = document.createElement('style');
      style.setAttribute('data-toast-animations', 'true');
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(400px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(400px); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => {
        toast.remove();
        resolve();
      }, 300);
    }, 4000);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const subscribeBtn = document.getElementById("subscribeBtn");
  const upgradeNowBtn = document.getElementById("upgradeNowBtn");
  const paymentStatus = document.getElementById("payment-status");
  const paymentMethodsSection = document.getElementById("payment-methods-section");
  const userEmail = getCurrentUserEmail();
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

  // Show user info and current premium status
  const statusContainer = document.querySelector(".billing-section .container");
  if (statusContainer && isLoggedIn) {
    const userInfo = document.createElement("div");
    userInfo.className = "user-info-banner";
    userInfo.innerHTML = `
      <div class="user-info-content">
        <p>Logged in as: <strong>${escapeHtml(userEmail)}</strong></p>
        <p>Status: <strong class="status-${hasPremium() ? "premium" : "free"}">${
      hasPremium() ? "✓ Premium Member" : "✓ Free Member"
    }</strong></p>
      </div>
    `;
    statusContainer.insertBefore(userInfo, statusContainer.querySelector(".billing-cards"));
  }

  // Redirect to login if not logged in
  if (!isLoggedIn) {
    const loginPrompt = document.createElement("div");
    loginPrompt.className = "login-prompt";
    loginPrompt.innerHTML = `
      <div class="prompt-content">
        <h3>Login Required</h3>
        <p>You need to be logged in to upgrade to Premium.</p>
        <a href="login.html" class="btn-primary">Go to Login</a>
      </div>
    `;
    const mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.innerHTML = "";
      loginPrompt.style.display = 'flex';
      loginPrompt.style.justifyContent = 'center';
      loginPrompt.style.alignItems = 'center';
      loginPrompt.style.minHeight = '60vh';
      loginPrompt.style.margin = '40px auto';
      mainEl.appendChild(loginPrompt);
    }
    return;
  }

  // Handle subscription button - Initiate Payment
  if (subscribeBtn) {
    subscribeBtn.addEventListener("click", async () => {
      if (hasPremium()) {
        await showToast("Already Premium", "You already have premium access!", "info");
        return;
      }
      initiatePayment();
    });
  }

  if (upgradeNowBtn) {
    upgradeNowBtn.addEventListener("click", async () => {
      if (hasPremium()) {
        await showToast("Already Premium", "You already have premium access!", "info");
        return;
      }
      initiatePayment();
    });
  }

  // Initiate payment with Paychangu
  async function initiatePayment() {
    try {
      const token = getToken();
      if (!token) {
        await showAlert("Authentication Error", "Please log in again to proceed with payment.", "error");
        return;
      }

      // Show loading
      if (paymentStatus) {
        paymentStatus.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Initializing payment...</div>';
      }

      // Call backend to initiate payment
      const response = await fetch(`${API_BASE}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: 50,
          currency: 'MWK',
          paymentMethod: null
        })
      });

      let result;
      try {
        result = await response.json();
      } catch (parseErr) {
        // Response is not JSON (likely HTML error page)
        const text = await response.text();
        throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(result.error || `Payment initiation failed (${response.status})`);
      }

      console.log('Payment initiated:', result);

      // Extract checkout URL from response - try multiple possible field names
      const checkoutUrl = 
        result.checkout_url || 
        result.link || 
        result.data?.link ||
        result.url || 
        result.redirect_url ||
        result.data?.url;

      if (checkoutUrl) {
        console.log('Redirecting to:', checkoutUrl);
        window.location.href = checkoutUrl;
      } else {
        console.error('No checkout URL found in response:', result);
        await showAlert("Payment Error", "Payment initiation returned no redirect URL. Response: " + JSON.stringify(result).substring(0, 100), "error");
      }
    } catch (err) {
      console.error('Payment initiation error:', err);
      await showAlert("Payment Error", err.message || "Failed to initiate payment", "error");
      if (paymentStatus) {
        paymentStatus.innerHTML = '';
      }
    }
  }

  // Check if returning from Paychangu payment redirect
  // NOTE: No frontend verification - webhook will handle payment confirmation
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('payment') === 'success') {
    console.log('Payment redirect received. Webhook will verify and activate premium.');
    // Don't take any action - webhook will update the account
  } else if (urlParams.get('payment') === 'pending') {
    console.log('Payment pending. Webhook will process when Paychangu confirms.');
    // Don't take any action - webhook will handle verification
  }

  function updateCardStatus() {
    const billingCards = document.querySelectorAll(".billing-card");
    billingCards.forEach((card) => {
      const cardTitle = card.querySelector("h3");
      const titleText = cardTitle ? cardTitle.textContent.trim().toLowerCase() : "";
      
      if (hasPremium() && titleText === "premium") {
        card.classList.add("current-plan");
      } else if (!hasPremium() && titleText === "free") {
        card.classList.add("current-plan");
      }
    });
  }

  // Plan Details Modal Handler
  const planDetailsBtn = document.getElementById('planDetailsBtn');
  const planDetailsModal = document.getElementById('planDetailsModal');
  const closeDetailsModal = document.getElementById('closeDetailsModal');
  const planDetailsContent = document.getElementById('planDetailsContent');

  if (planDetailsBtn && planDetailsModal) {
    planDetailsBtn.addEventListener('click', () => {
      planDetailsContent.innerHTML = `
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;"><strong>Feature</strong></th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;"><strong>Free</strong></th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;"><strong>Premium</strong></th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px;">Introductory Modules</td>
                <td style="padding: 12px; text-align: center;"><i class="fas fa-check" style="color: #4caf50;"></i></td>
                <td style="padding: 12px; text-align: center;"><i class="fas fa-check" style="color: #4caf50;"></i></td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px;">All Modules (Solar, Wind, Hydro, Biomass, Geothermal)</td>
                <td style="padding: 12px; text-align: center;"><i class="fas fa-times" style="color: #ccc;"></i></td>
                <td style="padding: 12px; text-align: center;"><i class="fas fa-check" style="color: #4caf50;"></i></td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px;">Limited Quizzes</td>
                <td style="padding: 12px; text-align: center;"><i class="fas fa-check" style="color: #4caf50;"></i></td>
                <td style="padding: 12px; text-align: center;"><i class="fas fa-check" style="color: #4caf50;"></i></td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px;">All Quizzes & Progress Tracking</td>
                <td style="padding: 12px; text-align: center;"><i class="fas fa-times" style="color: #ccc;"></i></td>
                <td style="padding: 12px; text-align: center;"><i class="fas fa-check" style="color: #4caf50;"></i></td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px;">Projects & Assignments</td>
                <td style="padding: 12px; text-align: center;"><i class="fas fa-times" style="color: #ccc;"></i></td>
                <td style="padding: 12px; text-align: center;"><i class="fas fa-check" style="color: #4caf50;"></i></td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px;">Certificates & Verification</td>
                <td style="padding: 12px; text-align: center;"><i class="fas fa-times" style="color: #ccc;"></i></td>
                <td style="padding: 12px; text-align: center;"><i class="fas fa-check" style="color: #4caf50;"></i></td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px;">Aubie RET Assistant</td>
                <td style="padding: 12px; text-align: center;"><i class="fas fa-times" style="color: #ccc;"></i></td>
                <td style="padding: 12px; text-align: center;"><i class="fas fa-check" style="color: #4caf50;"></i></td>
              </tr>
              <tr>
                <td style="padding: 12px;"><strong>Price</strong></td>
                <td style="padding: 12px; text-align: center;"><strong>$0/mo</strong></td>
                <td style="padding: 12px; text-align: center;"><strong>$8/mo</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
      planDetailsModal.style.display = 'flex';
    });

    closeDetailsModal.addEventListener('click', () => {
      planDetailsModal.style.display = 'none';
    });

    planDetailsModal.addEventListener('click', (e) => {
      if (e.target === planDetailsModal) {
        planDetailsModal.style.display = 'none';
      }
    });
  }

  // Cancel payment button
  const cancelPaymentBtn = document.getElementById('cancel-payment-btn');
  if (cancelPaymentBtn) {
    cancelPaymentBtn.addEventListener('click', () => {
      if (paymentMethodsSection) {
        paymentMethodsSection.style.display = 'none';
      }
      if (paymentStatus) {
        paymentStatus.innerHTML = '';
      }
    });
  }

  // Initial card status update
  updateCardStatus();
});
