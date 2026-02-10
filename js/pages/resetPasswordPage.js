import { requestPasswordReset, resetPassword } from "../core/auth.js";

// Lightweight console logging only (debug panel removed)
console.log('Reset Password Page script loaded');

document.addEventListener('click', (e) => {
  console.log('🖱️ CLICK:', e.target.tagName, e.target.id, e.target.className);
}, true);

document.addEventListener('submit', (e) => {
  console.log('📝 FORM SUBMIT:', e.target.id);
}, true);

// Guard against multiple initializations
if (!window._resetPasswordPageLoaded) {
  window._resetPasswordPageLoaded = true;

  document.addEventListener('DOMContentLoaded', () => {
    console.log('🔐 DOMContentLoaded fired');
    const resetFlow = document.getElementById('reset-flow');
    
    if (!resetFlow) {
      console.error('❌ reset-flow element not found!');
      return;
    }

    let currentState = 'send'; // 'send' or 'verify'
    let resetEmail = '';

    function showNotice(type, msg) {
      console.log(`📢 Notice [${type}]: ${msg}`);
      const noticeId = currentState === 'send' ? 'reset-notice' : 'reset-stage-notice';
      const notice = document.getElementById(noticeId);
      if (notice) {
        notice.className = 'form-notice ' + type;
        notice.textContent = msg;
        if (type === 'error') {
          notice.classList.add('shake');
          setTimeout(() => notice.classList.remove('shake'), 400);
        }
      }
    }

    function renderSendStage() {
      console.log('📄 Rendering send stage...');
      currentState = 'send';
      resetFlow.innerHTML = `
        <div id="stage-send">
          <div class="form-field-wrapper">
            <input type="text" id="reset-email" placeholder=" " required>
            <label for="reset-email">Email</label>
          </div>
          <button id="send-reset-code" type="button" class="btn-primary">Send reset code</button>
          <p style="margin-top: 10px;">
            Remember password? <a href="login.html" class="form-helper-link">Login here</a>
          </p>
          <div class="form-notice" id="reset-notice"></div>
        </div>
      `;
      
      const sendBtn = document.getElementById('send-reset-code');
      const emailInput = document.getElementById('reset-email');
      
      if (sendBtn) {
        sendBtn.addEventListener('click', handleSendCode);
        console.log('✅ Send button listener attached');
      }
      
      if (emailInput) {
        emailInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            sendBtn.click();
          }
        });
      }
    }

    function renderVerifyStage(email) {
      console.log('📄 Rendering verify stage for:', email);
      currentState = 'verify';
      resetFlow.innerHTML = `
        <div id="stage-verify">
          <p style="color: #666; margin-bottom: 15px;">Enter the 6-digit code sent to <strong>${email}</strong></p>
          
          <div class="form-field-wrapper">
            <input type="text" id="reset-code" maxlength="6" placeholder=" " required>
            <label for="reset-code">Reset Code</label>
          </div>

          <div class="form-field-wrapper">
            <div class="password-wrapper">
              <input type="password" id="reset-new-pass" placeholder=" " required>
              <label for="reset-new-pass">New Password</label>
            </div>
          </div>
          
          <!-- Password Strength Indicator -->
          <div id="password-strength-indicator" class="password-strength" style="display: none;">
            <div class="strength-bar">
              <div id="strength-progress" class="strength-progress"></div>
            </div>
            <ul id="password-requirements" class="password-requirements">
              <li id="req-length"><i class="fa-solid fa-circle"></i> At least 8 characters</li>
              <li id="req-uppercase"><i class="fa-solid fa-circle"></i> Uppercase letter (A-Z)</li>
              <li id="req-lowercase"><i class="fa-solid fa-circle"></i> Lowercase letter (a-z)</li>
              <li id="req-number"><i class="fa-solid fa-circle"></i> Number (0-9)</li>
              <li id="req-special"><i class="fa-solid fa-circle"></i> Special character (!@#$%^&*)</li>
            </ul>
          </div>

          <div class="form-field-wrapper">
            <div class="password-wrapper">
              <input type="password" id="reset-new-pass-confirm" placeholder=" " required>
              <label for="reset-new-pass-confirm">Confirm New Password</label>
            </div>
          </div>

          <div class="show-password-wrapper">
            <input type="checkbox" id="show-password-reset">
            <label for="show-password-reset">Show password</label>
          </div>

          <button id="do-reset" type="button" class="btn-primary">Reset Password</button>
          
          <p style="margin-top: 10px;">
            <button id="resend-reset-code" type="button" class="module-search-btn" title="Resend code">Resend code</button>
          </p>
          
          <div class="form-notice" id="reset-stage-notice"></div>
        </div>
      `;
      
      const doResetBtn = document.getElementById('do-reset');
      const codeInput = document.getElementById('reset-code');
      const passInput = document.getElementById('reset-new-pass');
      
      if (doResetBtn) {
        doResetBtn.addEventListener('click', handleDoReset);
        console.log('✅ Reset button listener attached');
      }
      
      if (codeInput) {
        codeInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            doResetBtn.click();
          }
        });
      }
      
      if (passInput) {
        passInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            doResetBtn.click();
          }
        });
        
        // Add password strength indicator listener
        passInput.addEventListener('input', (e) => {
          const password = e.target.value;
          const indicator = document.getElementById('password-strength-indicator');
          const progress = document.getElementById('strength-progress');
          const requirements = document.getElementById('password-requirements');
          
          if (!indicator || !requirements) return;
          
          if (!password) {
            indicator.style.display = 'none';
            return;
          }
          
          indicator.style.display = 'block';
          
          function validatePasswordRequirements(pwd) {
            return {
              length: pwd.length >= 8,
              uppercase: /[A-Z]/.test(pwd),
              lowercase: /[a-z]/.test(pwd),
              number: /[0-9]/.test(pwd),
              special: /[!@#$%^&*]/.test(pwd)
            };
          }
          
          const reqs = validatePasswordRequirements(password);
          const metCount = Object.values(reqs).filter(Boolean).length;
          
          const reqMap = {
            'req-length': reqs.length,
            'req-uppercase': reqs.uppercase,
            'req-lowercase': reqs.lowercase,
            'req-number': reqs.number,
            'req-special': reqs.special
          };
          
          Object.entries(reqMap).forEach(([id, isMet]) => {
            const el = document.getElementById(id);
            if (el) {
              if (isMet) {
                el.classList.add('met');
              } else {
                el.classList.remove('met');
              }
            }
          });
          
          let strengthClass = '';
          if (metCount === 0) strengthClass = 'weak';
          else if (metCount === 1) strengthClass = 'weak';
          else if (metCount === 2) strengthClass = 'fair';
          else if (metCount === 3) strengthClass = 'good';
          else if (metCount === 4) strengthClass = 'strong';
          else strengthClass = 'very-strong';
          
          progress.className = 'strength-progress ' + strengthClass;
        });
      }

      // Confirm input
      const confirmInput = document.getElementById('reset-new-pass-confirm');
      if (confirmInput) {
        confirmInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            doResetBtn.click();
          }
        });
        
        // Hide password strength indicator when confirm password is focused
        confirmInput.addEventListener('focus', () => {
          const indicator = document.getElementById('password-strength-indicator');
          if (indicator) {
            indicator.style.display = 'none';
          }
        });
      }

      // Handle show/hide password checkbox
      const showPasswordCheckbox = document.getElementById('show-password-reset');
      if (showPasswordCheckbox) {
        showPasswordCheckbox.addEventListener('change', (e) => {
          const passInput = document.getElementById('reset-new-pass');
          const confirmInput = document.getElementById('reset-new-pass-confirm');
          if (e.target.checked) {
            passInput.type = 'text';
            confirmInput.type = 'text';
          } else {
            passInput.type = 'password';
            confirmInput.type = 'password';
          }
        });
      }

      // Auto-focus code input
      setTimeout(() => codeInput && codeInput.focus(), 100);

      // Resend handling: disable for 60s after arriving here
      const resendBtn = document.getElementById('resend-reset-code');
      const RESEND_SECONDS = 60;
      let resendInterval = null;

      function startResendCountdown(seconds) {
        let remaining = seconds;
        if (resendBtn) { resendBtn.disabled = true; resendBtn.textContent = `Resend (${remaining}s)`; }
        resendInterval = setInterval(() => {
          remaining -= 1;
          if (resendBtn) resendBtn.textContent = remaining > 0 ? `Resend (${remaining}s)` : 'Resend';
          if (remaining <= 0) {
            clearInterval(resendInterval);
            if (resendBtn) { resendBtn.disabled = false; resendBtn.textContent = 'Resend'; }
          }
        }, 1000);
      }

      if (resendBtn) {
        resendBtn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          if (!resetEmail) return;

          // Hide current notice briefly while resending
          const noticeEl = document.getElementById('reset-stage-notice');
          let prev = null;
          if (noticeEl) {
            prev = { className: noticeEl.className, text: noticeEl.textContent };
            noticeEl.style.display = 'none';
          }

          try {
            resendBtn.disabled = true;
            resendBtn.textContent = 'Resending...';
            const result = await requestPasswordReset(resetEmail);
            // restore and show new message
            if (noticeEl) { noticeEl.style.display = ''; }
            if (result && result.success) {
              showNotice('success', 'Code resent — check your inbox or spam folder.');
              startResendCountdown(RESEND_SECONDS);
            } else {
              showNotice('error', result.error || 'We couldn\'t resend the code. Please try again.');
              resendBtn.disabled = false;
              resendBtn.textContent = 'Resend';
            }
          } catch (err) {
            console.error('Resend error', err);
            if (noticeEl) { noticeEl.style.display = ''; }
            showNotice('error', 'An error occurred while resending. Please try again.');
            resendBtn.disabled = false;
            resendBtn.textContent = 'Resend';
          }
        });
      }

      // Start initial countdown when arriving at verify stage
      startResendCountdown(RESEND_SECONDS);
    }

    async function handleSendCode(e) {
      console.log('🖱️ handleSendCode called');
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      const emailInput = document.getElementById('reset-email');
      const sendBtn = document.getElementById('send-reset-code');
      
      const email = emailInput.value.trim();
      if (!email) {
        showNotice('error', 'Please enter your email');
        return;
      }
      
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending...';
      
      try {
        console.log('📤 Requesting reset for:', email);
        const result = await requestPasswordReset(email);
        console.log('✅ Reset request result:', result);
        
        if (result.success) {
          resetEmail = email;
          renderVerifyStage(email);
          showNotice('success', 'Reset code sent. Check your email inbox or spam folder.');
        } else {
          showNotice('error', result.error || 'We couldn\'t send a reset code. Please check your email address and try again.');
          sendBtn.disabled = false;
          sendBtn.textContent = 'Send reset code';
        }
      } catch (err) {
        console.error('❌ Error requesting reset:', err);
        const errMsg = (err.message === 'Failed to fetch' || err.message?.includes('network')?  'We\'re having trouble reaching the server. Please check your connection and try again.' : err.message) || 'We had trouble processing your request. Please try again.';
        showNotice('error', errMsg);
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send reset code';
      }
    }

    async function handleDoReset(e) {
      console.log('🖱️ handleDoReset called');
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      const codeInput = document.getElementById('reset-code');
      const passInput = document.getElementById('reset-new-pass');
      const doResetBtn = document.getElementById('do-reset');
      
      const code = codeInput.value.trim();
      const newPass = passInput.value.trim();
      const confirmPass = (document.getElementById('reset-new-pass-confirm') && document.getElementById('reset-new-pass-confirm').value.trim()) || '';
      
      if (!code || !newPass) {
        showNotice('error', 'Please fill in all fields');
        return;
      }
      
      if (newPass !== confirmPass) {
        showNotice('error', 'Passwords do not match');
        return;
      }

      // Validate password strength
      function validatePasswordRequirements(password) {
        return {
          length: password.length >= 8,
          uppercase: /[A-Z]/.test(password),
          lowercase: /[a-z]/.test(password),
          number: /[0-9]/.test(password),
          special: /[!@#$%^&*]/.test(password)
        };
      }

      const passwordReqs = validatePasswordRequirements(newPass);
      const missingReqs = [];
      if (!passwordReqs.length) missingReqs.push('at least 8 characters');
      if (!passwordReqs.uppercase) missingReqs.push('at least one uppercase letter');
      if (!passwordReqs.lowercase) missingReqs.push('at least one lowercase letter');
      if (!passwordReqs.number) missingReqs.push('at least one number');
      if (!passwordReqs.special) missingReqs.push('at least one special character');

      if (missingReqs.length > 0) {
        showNotice('error', 'Password must have: ' + missingReqs.join(', '));
        return;
      }
      
      doResetBtn.disabled = true;
      doResetBtn.textContent = 'Resetting...';
      
      try {
        console.log('📤 Resetting password for:', resetEmail);
        const result = await resetPassword(resetEmail, code, newPass);
        console.log('✅ Reset result:', result);
        
        if (result.success) {
          // Non-invasive overlay: create overlay element with inline styles (no CSS changes)
          const stage = document.getElementById('stage-verify') || resetFlow;
          try {
            // blur the verify area
            if (stage) {
              stage.style.transition = 'filter 180ms ease, opacity 180ms ease';
              stage.style.filter = 'blur(4px)';
              stage.style.opacity = '0.95';
              // prevent interactions
              stage.style.pointerEvents = 'none';
            }
            const overlay = document.createElement('div');
            overlay.setAttribute('role', 'status');
            overlay.style.position = 'absolute';
            overlay.style.left = '50%';
            overlay.style.top = '50%';
            overlay.style.transform = 'translate(-50%, -50%)';
            overlay.style.background = 'rgba(255,255,255,0.97)';
            overlay.style.padding = '20px 26px';
            overlay.style.borderRadius = '12px';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.gap = '14px';
            overlay.style.boxShadow = '0 10px 30px rgba(0,0,0,0.08)';
            overlay.style.zIndex = '10010';
            overlay.innerHTML = `
              <div style="width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#eaffef,#bfffcf);box-shadow:0 0 18px rgba(34,197,94,0.45);">
                <svg viewBox="0 0 24 24" width="36" height="36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M20.285 6.708a1 1 0 0 0-1.414-1.416l-9.192 9.2-3.192-3.2a1 1 0 0 0-1.414 1.415l3.9 3.9a1 1 0 0 0 1.414 0l9.898-9.899z" fill="#16a34a"/>
                </svg>
              </div>
              <div style="color:#065f46;font-weight:700;">Password reset<br><span style="font-weight:400;font-size:0.9rem;color:#064e3b;">Redirecting to login...</span></div>
            `;
            // make sure resetFlow is positioned relatively so absolute overlay centers correctly
            const container = resetFlow;
            container.style.position = container.style.position || 'relative';
            container.appendChild(overlay);
          } catch (err) {
            console.warn('Overlay error', err);
          }

          setTimeout(() => { window.location.href = '/login.html'; }, 5000);
        } else {
          showNotice('error', result.error || 'We couldn\'t reset your password. Please check your verification code and try again.');
          doResetBtn.disabled = false;
          doResetBtn.textContent = 'Reset Password';
        }
      } catch (err) {
        console.error('❌ Error resetting password:', err);
        const errMsg = (err.message === 'Failed to fetch' || err.message?.includes('network')) ? 'We\'re having trouble reaching the server. Please check your connection and try again.' : (err.message || 'We had trouble resetting your password. Please try again.');
        showNotice('error', errMsg);
        doResetBtn.disabled = false;
        doResetBtn.textContent = 'Reset Password';
      }
    }

    // Initial render
    console.log('🚀 Starting initial render...');
    renderSendStage();
    console.log('✅ Reset password page fully loaded');
  });
}
