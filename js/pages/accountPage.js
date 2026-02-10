import { API_BASE } from '../api-config.js';
import { getToken, logoutUser } from '../core/auth.js';

const API_URL = API_BASE;

// Utility function to escape HTML
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Display profile picture
function displayProfilePicture(user) {
  const profilePic = document.getElementById('profile-picture');
  const initial = user.name.charAt(0).toUpperCase();
  
  // Check if user has a profile image
  const imageUrl = user.avatarUrl || user.avatar || user.profileImage || user.imageUrl || user.profilePicture;
  console.log('displayProfilePicture - imageUrl:', imageUrl ? 'EXISTS (' + imageUrl + ')' : 'NOT FOUND');
  
  if (imageUrl) {
    console.log('Avatar detected, setting image');
    // If it's a data URL or valid image, display it directly
    profilePic.innerHTML = `<img src="${imageUrl}" alt="Profile Picture" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" onerror="console.log('Image failed to load'); this.parentElement.innerHTML='<div style=&quot;width: 100%; height: 100%; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem; font-weight: bold;&quot;>${initial}</div>'">`;
  } else {
    console.log('No avatar found, showing initial');
    // Use initial avatar as default
    profilePic.innerHTML = `<div style="width: 100%; height: 100%; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem; font-weight: bold;">${initial}</div>`;
  }
}

// Load user data
async function loadUserData() {
  try {
    const token = getToken();
    console.log('Loading user data, token exists:', !!token);
    if (!token) {
      console.log('No token, redirecting to login');
      window.location.href = 'login.html';
      return;
    }

    console.log('Fetching user data from:', `${API_URL}/auth/me`);
    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    if (!response.ok) {
      console.error('Response not ok:', response.status, response.statusText);
      throw new Error('We couldn\'t load your account information. Please try again.');
    }

    const data = await response.json();
    console.log('User data loaded:', data);
    console.log('User avatar field:', data.user.avatar ? 'EXISTS (length: ' + data.user.avatar.length + ')' : 'NOT FOUND');
    return data.user;
  } catch (error) {
    console.error('Error loading user data:', error);
    showModal({ type: 'error', title: 'Error', message: 'Failed to load account information. Please try again.' });
    return null;
  }
}

// Load and display user certificates
async function loadCertificates() {
  try {
    const token = getToken();
    const response = await fetch(`${API_URL}/certificates`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('We couldn\'t load your certificates. Please try again.');

    const data = await response.json();
    const certificates = data.certificates || [];
    const container = document.getElementById('certificates-container');

    if (certificates.length === 0) {
      container.innerHTML = '<p style="color: #9ca3af; font-size: 14px;">Complete courses to earn certificates!</p>';
      return;
    }

    container.innerHTML = certificates.map(cert => `
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center;">
        <div style="font-size: 24px; margin-bottom: 8px;">🎓</div>
        <h4 style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">${escapeHtml(cert.courseName)}</h4>
        <p style="font-size: 12px; color: #6b7280; margin-bottom: 12px;">
          Completed on ${(() => { const d = new Date(cert.completedDate); d.setDate(d.getDate() - 1); return d.toLocaleDateString(); })()}
        </p>
        <div style="display: flex; gap: 8px; margin-top: 12px;">
          <button class="btn-secondary" style="font-size: 12px; padding: 6px 12px; flex: 1;" onclick="viewCertificate('${cert.id}')">
            View
          </button>
          ${window.allowCertificateRedownload !== false ? `
          <div style="position: relative; flex: 1;">
            <button class="btn-secondary" style="font-size: 12px; padding: 6px 12px; width: 100%;" onclick="toggleDownloadMenu('${cert.id}')">
              Download ▼
            </button>
            <div id="download-menu-${cert.id}" style="display: none; position: absolute; top: 100%; right: 0; background: white; border: 1px solid #e5e7eb; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1000; min-width: 150px;">
              <button style="width: 100%; text-align: left; padding: 8px 12px; border: none; background: none; cursor: pointer; font-size: 12px; color: #374151;" onclick="downloadCertificateAs('${cert.id}', '${escapeHtml(cert.courseId)}', 'html')">📄 HTML</button>
              <button style="width: 100%; text-align: left; padding: 8px 12px; border: none; background: none; cursor: pointer; font-size: 12px; color: #374151; border-top: 1px solid #e5e7eb;" onclick="downloadCertificateAs('${cert.id}', '${escapeHtml(cert.courseId)}', 'image')">🖼️ Image</button>
            </div>
          </div>
          ` : `
          <div style="flex: 1;">
            <button class="btn-secondary" style="font-size: 12px; padding: 6px 12px; width: 100%; opacity: 0.5; cursor: not-allowed;" disabled title="Certificate downloads are disabled">
              Download (Disabled)
            </button>
          </div>
          `}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading certificates:', error);
    document.getElementById('certificates-container').innerHTML = '<p style="color: #ef4444; font-size: 14px;">Failed to load certificates</p>';
  }
}

// Download certificate function
window.downloadCertificate = async function(certId, courseId) {
  try {
    const token = getToken();
    const response = await fetch(`${API_URL}/certificates/${certId}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error('We couldn\'t download your certificate. Please try again.');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificate-${courseId}.html`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  } catch (error) {
    console.error('Error downloading certificate:', error);
    showModal({ type: 'error', title: 'Error', message: 'We couldn\'t download your certificate. Please try again.' });
  }
};

// Toggle download menu
window.toggleDownloadMenu = function(certId) {
  const menu = document.getElementById(`download-menu-${certId}`);
  const isVisible = menu.style.display === 'block';
  
  // Hide all menus
  document.querySelectorAll('[id^="download-menu-"]').forEach(m => {
    m.style.display = 'none';
  });
  
  // Toggle current menu
  if (!isVisible) {
    menu.style.display = 'block';
    // Close menu when clicking outside
    const closeMenu = (e) => {
      if (!e.target.closest('[id^="download-menu-"]') && !e.target.closest('button')) {
        menu.style.display = 'none';
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }
};

// Download certificate in different formats
window.downloadCertificateAs = async function(certId, courseId, format) {
  try {
    const token = getToken();
    const response = await fetch(`${API_URL}/certificates/${certId}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error || `We couldn't download your certificate as ${format}. Please try again.`;
      console.error('Certificate download error:', errorMsg);
      throw new Error(errorMsg);
    }

    const html = await response.text();
    
    if (format === 'html') {
      // For HTML, download directly
      const blob = new Blob([html], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${courseId}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } else if (format === 'image') {
      // For image, use html2canvas
      if (typeof html2canvas === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        document.head.appendChild(script);
        await new Promise(resolve => script.onload = resolve);
      }
      
      // Create a temporary container with the certificate
      const container = document.createElement('div');
      container.innerHTML = html;
      container.style.position = 'fixed';
      container.style.left = '-10000px';
      container.style.top = '-10000px';
      container.style.width = '960px';
      container.style.height = '800px';
      container.style.padding = '0px';
      container.style.margin = '0px';
      container.style.overflow = 'visible';
      document.body.appendChild(container);
      
      const certElement = container.querySelector('.certificate');
      if (certElement) {
        const canvas = await html2canvas(certElement, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false
        });
        
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `certificate-${courseId}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      document.body.removeChild(container);
    }
  } catch (error) {
    console.error('Error downloading certificate:', error);
    showModal({ type: 'error', title: 'Download Failed', message: error.message || `We couldn\'t download your certificate as ${format}. Please try again.` });
  }
};

// View certificate in modal
window.viewCertificate = async function(certId) {
  try {
    const token = getToken();
    const response = await fetch(`${API_URL}/certificates/${certId}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error('We couldn\'t load your certificate. Please try again.');

    const html = await response.text();
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'certificate-view-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; width: 95%; height: 95vh; max-width: 1200px; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.3); max-height: 95vh;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e5e7eb; background: #f9fafb;">
          <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">Certificate</h2>
          <button onclick="closeCertificateModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">×</button>
        </div>
        <div id="certificate-content" style="flex: 1; overflow: auto; padding: 10px; background: #fafbfc; display: flex; align-items: center; justify-content: center; min-height: 0;">
          <!-- Certificate will be loaded here -->
        </div>
        <div style="display: flex; gap: 6px; padding: 10px 12px; border-top: 1px solid #e5e7eb; justify-content: flex-end; background: #f9fafb; flex-wrap: wrap;">
          ${window.allowCertificateRedownload !== false ? `
            <button onclick="downloadCertificateFromModal('${certId}', 'html')" style="padding: 6px 10px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.2s; white-space: nowrap;" onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
              📄 Download HTML
            </button>
            <button onclick="downloadCertificateFromModal('${certId}', 'image')" style="padding: 6px 10px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.2s; white-space: nowrap;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
              🖼️ Download Image
            </button>
          ` : `
            <button style="padding: 6px 10px; background: #9ca3af; color: white; border: none; border-radius: 4px; cursor: not-allowed; font-size: 11px; font-weight: 500; opacity: 0.6;" disabled title="Downloads are disabled">
              Downloads Disabled
            </button>
          `}
          <button onclick="closeCertificateModal()" style="padding: 6px 10px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.2s;" onmouseover="this.style.background='#4b5563'" onmouseout="this.style.background='#6b7280'">
            Close
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load certificate HTML directly (not in iframe) to allow proper rendering
    const contentDiv = document.getElementById('certificate-content');
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'width: 100%; max-width: 100%; overflow: auto; display: flex; align-items: center; justify-content: center; background: white; padding: 10px;';
    wrapper.innerHTML = html;
    contentDiv.appendChild(wrapper);
    
    // Add responsive styles for mobile
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      const modalDiv = modal.querySelector('div');
      modalDiv.style.width = '100%';
      modalDiv.style.height = '100vh';
      modalDiv.style.maxWidth = '100%';
      modalDiv.style.borderRadius = '0px';
      
      // Scale down certificate content on mobile
      const certificateElements = wrapper.querySelectorAll('*');
      certificateElements.forEach(el => {
        // Force all elements to not exceed viewport width
        el.style.maxWidth = '100%';
        el.style.width = 'auto';
        if (el.style.width === '100%' || el.style.width === '800px' || el.style.width === '900px') {
          el.style.width = '100%';
        }
      });
      
      // Add transform scale as fallback if content still overflows
      const scale = 0.75;
      wrapper.style.transform = `scale(${scale})`;
      wrapper.style.transformOrigin = 'top center';
      wrapper.style.width = `${100 / scale}%`;
    }
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeCertificateModal();
      }
    });
  } catch (error) {
    console.error('Error viewing certificate:', error);
    showModal({ type: 'error', title: 'Error', message: 'We couldn\'t view your certificate. Please try again.' });
  }
};

// Close certificate modal
window.closeCertificateModal = function() {
  const modal = document.getElementById('certificate-view-modal');
  if (modal) {
    modal.remove();
  }
};

// Download certificate from modal
window.downloadCertificateFromModal = async function(certId, format) {
  try {
    const token = getToken();
    const response = await fetch(`${API_URL}/certificates/${certId}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error || `We couldn't download your certificate. Please try again.`;
      console.error('Certificate download error:', errorMsg);
      throw new Error(errorMsg);
    }

    const html = await response.text();
    
    if (format === 'html') {
      // For HTML, download directly
      const blob = new Blob([html], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'certificate.html';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } else if (format === 'image') {
      // For image, use html2canvas
      if (typeof html2canvas === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        document.head.appendChild(script);
        await new Promise(resolve => script.onload = resolve);
      }
      
      // Create a temporary container with the certificate
      const container = document.createElement('div');
      container.innerHTML = html;
      container.style.position = 'fixed';
      container.style.left = '-10000px';
      container.style.top = '-10000px';
      container.style.width = '960px';
      container.style.height = '800px';
      container.style.padding = '0px';
      container.style.margin = '0px';
      container.style.overflow = 'visible';
      document.body.appendChild(container);
      
      const certElement = container.querySelector('.certificate');
      if (certElement) {
        const canvas = await html2canvas(certElement, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false
        });
        
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'certificate.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      document.body.removeChild(container);
    }
  } catch (error) {
    console.error('Error downloading certificate:', error);
    showModal({ type: 'error', title: 'Download Failed', message: error.message || 'We couldn\'t download your certificate. Please try again.' });
  }
};

// Display user data
function displayUserData(user) {
  if (!user) return;

  // Profile picture
  displayProfilePicture(user);

  // User info
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-email').textContent = user.email;

  // Account type
  const accountTypeEl = document.getElementById('account-type');
  let accountTypeText = user.hasPremium ? 'Premium' : 'Free';
  if (user.hasPremium && user.premiumActivatedAt) {
    const premiumSince = new Date(user.premiumActivatedAt);
    accountTypeText += ` (since ${premiumSince.toLocaleDateString()})`;
  }
  if (user.hasPremium && user.premiumCancelled) {
    accountTypeText += ' (Cancelled)';
  }
  accountTypeEl.textContent = accountTypeText;
  accountTypeEl.className = user.hasPremium ? 'account-type-premium' : 'account-type-free';

  // Member since
  const createdAt = new Date(user.createdAt || Date.now());
  document.getElementById('member-since').textContent = createdAt.toLocaleDateString();

  // Hide the separate premium since item since it's now included in account type
  document.getElementById('premium-since-container').style.display = 'none';

  // Show/hide cancel premium button
  const cancelBtn = document.getElementById('cancel-premium-btn');
  cancelBtn.style.display = (user.hasPremium && !user.premiumCancelled) ? 'inline-block' : 'none';

  // Load certificates
  loadCertificates();
}

// Email verification modal
function showEmailVerificationModal(newEmail) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
  `;
  
  const content = document.createElement('div');
  content.className = 'modal-content verification-modal-inner';
  content.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 32px;
    max-width: 450px;
    width: 90%;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  `;

  const title = document.createElement('h2');
  title.style.cssText = `
    margin: 0 0 12px 0;
    color: #111;
    font-size: 22px;
    font-weight: 600;
  `;
  title.textContent = '✉️ Verify Your Email';

  const subtitle = document.createElement('p');
  subtitle.style.cssText = `
    color: #6b7280;
    margin: 0 0 16px 0;
    font-size: 14px;
  `;
  subtitle.textContent = `We've sent a verification code to ${escapeHtml(newEmail)}`;

  const instructionDiv = document.createElement('div');
  instructionDiv.style.cssText = `
    background: #f3f4f6;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 20px;
    font-size: 13px;
    color: #4b5563;
    line-height: 1.5;
  `;
  instructionDiv.innerHTML = `Enter the 6-digit code from the email. The code will expire in <strong>24 hours</strong>.`;

  const codeInput = document.createElement('input');
  codeInput.type = 'text';
  codeInput.placeholder = 'Enter 6-digit code';
  codeInput.maxLength = '6';
  codeInput.style.cssText = `
    width: 100%;
    padding: 12px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    letter-spacing: 2px;
    text-align: center;
    margin-bottom: 16px;
    box-sizing: border-box;
    transition: border-color 0.3s;
  `;
  codeInput.addEventListener('focus', () => {
    codeInput.style.borderColor = '#667eea';
  });
  codeInput.addEventListener('blur', () => {
    codeInput.style.borderColor = '#e5e7eb';
  });

  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    color: #dc2626;
    font-size: 14px;
    margin-bottom: 16px;
    display: none;
  `;

  const buttonDiv = document.createElement('div');
  buttonDiv.style.cssText = `
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
  `;

  const verifyBtn = document.createElement('button');
  verifyBtn.textContent = 'Verify Email';
  verifyBtn.style.cssText = `
    flex: 1;
    padding: 12px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.3s;
  `;

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    flex: 1;
    padding: 12px 16px;
    background: #f3f4f6;
    color: #374151;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.3s;
  `;

  const resendDiv = document.createElement('div');
  resendDiv.style.cssText = `
    text-align: center;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
  `;

  const resendLink = document.createElement('button');
  resendLink.textContent = "Didn't receive the code? Resend";
  resendLink.style.cssText = `
    background: none;
    border: none;
    color: #667eea;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    text-decoration: underline;
  `;
  resendLink.addEventListener('click', async (e) => {
    e.preventDefault();
    resendLink.disabled = true;
    resendLink.textContent = 'Sending...';
    
    try {
      const token = getToken();
      const response = await fetch(`${API_URL}/resend-verification-code`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: newEmail })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'We couldn\'t resend the verification code. Please try again.');

      errorDiv.style.display = 'none';
      errorDiv.textContent = '';
      codeInput.value = '';
      codeInput.focus();
    } catch (error) {
      errorDiv.textContent = `❌ ${error.message}`;
      errorDiv.style.display = 'block';
    } finally {
      resendLink.disabled = false;
      resendLink.textContent = "Didn't receive the code? Resend";
    }
  });

  resendDiv.appendChild(resendLink);

  buttonDiv.appendChild(verifyBtn);
  buttonDiv.appendChild(cancelBtn);

  content.appendChild(title);
  content.appendChild(subtitle);
  content.appendChild(instructionDiv);
  content.appendChild(codeInput);
  content.appendChild(errorDiv);
  content.appendChild(buttonDiv);
  content.appendChild(resendDiv);

  overlay.appendChild(content);
  document.body.appendChild(overlay);
  codeInput.focus();

  verifyBtn.addEventListener('click', async () => {
    const code = codeInput.value.trim();
    if (!code || code.length !== 6) {
      errorDiv.textContent = '❌ Please enter a valid 6-digit code';
      errorDiv.style.display = 'block';
      return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying...';
    errorDiv.style.display = 'none';

    try {
      const token = getToken();
      const response = await fetch(`${API_URL}/verify-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: newEmail, verificationCode: code })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'We couldn\'t verify your email. Please check your code and try again.');

      overlay.remove();
      showModal({
        type: 'success',
        title: 'Email Verified',
        message: 'Your email has been verified successfully!'
      });

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      errorDiv.textContent = `❌ ${error.message}`;
      errorDiv.style.display = 'block';
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify Email';
      codeInput.focus();
    }
  });

  cancelBtn.addEventListener('click', () => {
    overlay.remove();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

// Edit profile modal
function showEditProfileModal(user) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const content = document.createElement('div');
  content.className = 'modal-content edit-modal-inner';
  content.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 32px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    max-height: 80vh;
    overflow-y: auto;
  `;
  content.innerHTML = `
    <div style="text-align: left;">
      <h2 style="font-size: 20px; font-weight: 700; color: #1f2937; margin: 0 0 24px 0;">Edit Profile</h2>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Profile Picture</label>
        <input type="file" id="edit-avatar" accept="image/*" style="width: 100%; padding: 10px 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-family: Poppins, sans-serif; box-sizing: border-box; font-size: 13px;">
        <div id="avatar-preview" style="margin-top: 8px; display: none; width: 60px; height: 60px; border-radius: 50%; border: 2px solid #10b981; overflow: hidden; background: #f3f4f6;"></div>
        <small style="color: #6b7280; font-size: 12px; margin-top: 4px; display: block;">PNG, JPG, or GIF (max 2MB)</small>
      </div>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Full Name</label>
        <input type="text" id="edit-name" value="${escapeHtml(user.name)}" placeholder="Your name" style="width: 100%; padding: 10px 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-family: Poppins, sans-serif; box-sizing: border-box; font-size: 13px; transition: border-color 0.2s;">
      </div>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Email Address</label>
        <input type="email" id="edit-email" value="${escapeHtml(user.email)}" placeholder="your@email.com" style="width: 100%; padding: 10px 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-family: Poppins, sans-serif; box-sizing: border-box; font-size: 13px; transition: border-color 0.2s;">
        <small style="color: #6b7280; font-size: 12px; margin-top: 4px; display: block;">A verification email will be sent if you change your email address.</small>
      </div>
      
      <div id="edit-error" style="color: #dc2626; font-size: 13px; margin-bottom: 16px; padding: 10px 12px; background: #fee2e2; border-radius: 6px; display: none;"></div>
      
      <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
        <button class="modal-btn modal-btn-secondary" id="edit-cancel" style="padding: 10px 24px; border: 1px solid #d1d5db; background: #f3f4f6; color: #374151; border-radius: 6px; font-weight: 600; cursor: pointer; font-family: Poppins, sans-serif; font-size: 13px; transition: all 0.2s;">Cancel</button>
        <button class="modal-btn modal-btn-primary" id="edit-save" style="padding: 10px 24px; border: none; background: #3b82f6; color: white; border-radius: 6px; font-weight: 600; cursor: pointer; font-family: Poppins, sans-serif; font-size: 13px; transition: all 0.2s;">Save Changes</button>
      </div>
    </div>
  `;
  
  overlay.appendChild(content);
  document.body.appendChild(overlay);
  
  const avatarInput = document.getElementById('edit-avatar');
  const nameInput = document.getElementById('edit-name');
  const emailInput = document.getElementById('edit-email');
  const cancelBtn = document.getElementById('edit-cancel');
  const saveBtn = document.getElementById('edit-save');
  const errorDiv = document.getElementById('edit-error');
  const previewDiv = document.getElementById('avatar-preview');
  
  // Add avatar preview
  avatarInput.addEventListener('change', function() {
    if (this.files && this.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        previewDiv.style.backgroundImage = `url('${e.target.result}')`;
        previewDiv.style.backgroundSize = 'cover';
        previewDiv.style.backgroundPosition = 'center';
        previewDiv.style.display = 'block';
      };
      reader.readAsDataURL(this.files[0]);
    }
  });
  
  // Add focus styles
  [avatarInput, nameInput, emailInput].forEach(input => {
    input.addEventListener('focus', function() {
      this.style.borderColor = '#3b82f6';
      this.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
    });
    input.addEventListener('blur', function() {
      this.style.borderColor = '#e5e7eb';
      this.style.boxShadow = 'none';
    });
  });
  
  cancelBtn.addEventListener('mouseover', function() {
    this.style.background = '#e5e7eb';
  });
  cancelBtn.addEventListener('mouseout', function() {
    this.style.background = '#f3f4f6';
  });
  
  saveBtn.addEventListener('mouseover', function() {
    if (!this.disabled) this.style.background = '#2563eb';
  });
  saveBtn.addEventListener('mouseout', function() {
    if (!this.disabled) this.style.background = '#3b82f6';
  });
  
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
  });
  
  saveBtn.addEventListener('click', async () => {
    const newName = nameInput.value.trim();
    const newEmail = emailInput.value.trim();
    const avatarFile = avatarInput.files[0];
    
    if (!newName || !newEmail) {
      errorDiv.textContent = '❌ Please fill in all fields';
      errorDiv.style.display = 'block';
      return;
    }
    
    if (!newEmail.includes('@')) {
      errorDiv.textContent = '❌ Please enter a valid email address';
      errorDiv.style.display = 'block';
      return;
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    saveBtn.style.opacity = '0.7';
    
    try {
      const token = getToken();
      
      // Convert avatar to base64 if present
      let avatarBase64 = null;
      if (avatarFile) {
        // Check file size (max 2MB)
        if (avatarFile.size > 2 * 1024 * 1024) {
          errorDiv.textContent = '❌ Image must be smaller than 2MB';
          errorDiv.style.display = 'block';
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Changes';
          saveBtn.style.opacity = '1';
          return;
        }
        
        // Check file type
        if (!avatarFile.type.startsWith('image/')) {
          errorDiv.textContent = '❌ Please select a valid image file';
          errorDiv.style.display = 'block';
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Changes';
          saveBtn.style.opacity = '1';
          return;
        }
        
        avatarBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            // Compress image by converting through canvas
            const img = new Image();
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                const maxWidth = 200;
                const maxHeight = 200;
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                  if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                  }
                } else {
                  if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                  }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
              console.log('Canvas image compressed, data URL length:', dataUrl.length);
              if (dataUrl.length > 500000) {
                console.warn('Avatar image too large even after compression');
              }
                resolve(dataUrl);
              } catch (canvasErr) {
                console.error('Canvas compression failed:', canvasErr);
                reject(canvasErr);
              }
            };
            img.onerror = (err) => {
              console.error('Image load failed:', err);
              reject(err);
            };
            img.src = reader.result;
          };
          reader.onerror = reject;
          reader.readAsDataURL(avatarFile);
        });
      }
      
      // Check if email is being changed
      const emailChanged = newEmail !== user.email;
      
      const response = await fetch(`${API_URL}/auth/update-profile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newName,
          email: emailChanged ? user.email : newEmail,  // Keep old email in backend until verified
          avatar: avatarBase64
        })
      });
      
      console.log('Avatar being sent:', avatarBase64 ? 'YES (length: ' + avatarBase64.length + ')' : 'NO');
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'We couldn\'t update your profile. Please try again.');
      }
      
      overlay.remove();
      
      // If email changed, show verification modal
      if (emailChanged) {
        showEmailVerificationModal(newEmail);
      } else {
        showModal({
          type: 'success',
          title: 'Profile Updated',
          message: 'Your profile has been updated successfully.'
        });
        
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      errorDiv.textContent = `❌ ${error.message}`;
      errorDiv.style.display = 'block';
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
      saveBtn.style.opacity = '1';
    }
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

// Event handlers
function setupEventListeners() {
  // Edit profile
  document.getElementById('edit-profile-btn').addEventListener('click', () => {
    loadUserData().then(user => {
      if (user) showEditProfileModal(user);
    });
  });

  // Change password
  document.getElementById('change-password-btn').addEventListener('click', () => {
    window.location.href = 'reset-password.html';
  });

  // Manage billing
  document.getElementById('manage-billing-btn').addEventListener('click', () => {
    window.location.href = 'billing.html';
  });

  // Cancel premium
  document.getElementById('cancel-premium-btn').addEventListener('click', () => {
    showModal({
      type: 'warning',
      title: 'Cancel Premium Subscription',
      message: '⚠️ Warning: Canceling your premium subscription will stop future billing, but you will retain access to all premium features until the end of your current billing period.\n\nAfter that, your account will become a free account with limited access. Are you sure you want to proceed?',
      onConfirm: async () => {
        try {
          const token = getToken();
          const response = await fetch(`${API_URL}/auth/cancel-premium`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error('We couldn\'t cancel your premium subscription. Please try again.');
          }

          showModal({ type: 'success', title: 'Premium Canceled', message: 'Your premium subscription has been successfully canceled. You will retain premium access until the end of your current billing period, after which your account will become free.' });
          // Reload the page after success
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } catch (error) {
          console.error('Error canceling premium:', error);
          showModal({ type: 'error', title: 'Error', message: '❌ Failed to cancel premium subscription. Please try again or contact support.' });
        }
      },
      onCancel: () => {}
    });
  });

  // Delete account
  document.getElementById('delete-account-btn').addEventListener('click', () => {
    showModal({
      type: 'warning',
      title: 'Delete Account Permanently',
      message: 'This action is permanent and cannot be undone.\n\nAll your data including courses, bookmarks, progress, and premium subscription will be permanently deleted.\n\nPlease confirm you want to proceed.',
      onConfirm: () => {
        // Show additional confirmation
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        const content = document.createElement('div');
        content.className = 'modal-content edit-modal-inner';
        content.innerHTML = `
          <div style="text-align: left;">
            <h2 style="font-size: 18px; font-weight: 600; color: #dc2626; margin: 0 0 12px 0;">Confirm Account Deletion</h2>
            <p style="color: #6b7280; margin: 0 0 12px 0; font-size: 14px;">Type your email address to confirm deletion:</p>
            <input type="email" id="confirm-email" placeholder="your@email.com" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-family: Poppins, sans-serif; margin-bottom: 12px; box-sizing: border-box;">
            <div id="confirm-error" style="color: #dc2626; font-size: 13px; margin-bottom: 12px; display: none;"></div>
            <div style="display: flex; gap: 8px; justify-content: flex-end;">
              <button class="modal-btn modal-btn-secondary" id="confirm-cancel">Cancel</button>
              <button class="modal-btn modal-btn-primary" id="confirm-delete" style="background: #dc2626;">Delete Permanently</button>
            </div>
          </div>
        `;
        overlay.appendChild(content);
        document.body.appendChild(overlay);
        
        const confirmEmail = document.getElementById('confirm-email');
        const confirmError = document.getElementById('confirm-error');
        const cancelBtn = document.getElementById('confirm-cancel');
        const deleteBtn = document.getElementById('confirm-delete');
        
        cancelBtn.addEventListener('click', () => overlay.remove());
        
        deleteBtn.addEventListener('click', async () => {
          const entered = confirmEmail.value.trim();
          
          loadUserData().then(async (user) => {
            if (entered !== user.email) {
              confirmError.textContent = 'Email does not match';
              confirmError.style.display = 'block';
              confirmError.classList.add('shake');
              setTimeout(() => confirmError.classList.remove('shake'), 400);
              return;
            }
            
            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Deleting...';
            
            try {
              const token = getToken();
              const response = await fetch(`${API_URL}/auth/delete-account`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (!response.ok) {
                throw new Error('We couldn\'t delete your account. Please try again.');
              }
              
              overlay.remove();
              showModal({
                type: 'success',
                title: 'Account Deleted',
                message: 'Your account has been permanently deleted. You will be redirected to the home page.'
              });
              
              setTimeout(() => {
                logoutUser();
                window.location.href = 'index.html';
              }, 2000);
            } catch (error) {
              confirmError.textContent = error.message;
              confirmError.style.display = 'block';
              confirmError.classList.add('shake');
              setTimeout(() => confirmError.classList.remove('shake'), 400);
              deleteBtn.disabled = false;
              deleteBtn.textContent = 'Delete Permanently';
            }
          });
        });
        
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) overlay.remove();
        });
      },
      onCancel: () => {}
    });
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    showModal({
      type: 'warning',
      title: 'Logout',
      message: 'You are about to logout from your account. Make sure to save any unsaved work.\n\nAre you sure you want to continue?',
      onConfirm: () => {
        logoutUser();
        showModal({ type: 'success', title: 'Logged Out', message: 'You have been successfully logged out.' });
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1500);
      },
      onCancel: () => {}
    });
  });
}

// Modal utility functions (matching main.js)
function showModal(options) {
  const { type = 'info', title, message, onConfirm, onCancel } = options;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  const icons = {
    success: '✓',
    warning: '⚠',
    error: '✕',
    info: 'ℹ'
  };
  
  const iconColor = {
    success: 'success',
    warning: 'warning',
    error: 'error',
    info: 'info'
  };

  const content = document.createElement('div');
  content.className = 'modal-content';
  content.innerHTML = `
    <div class="modal-icon ${iconColor[type]}">${icons[type]}</div>
    <h2 class="modal-title">${escapeHtml(title)}</h2>
    <p class="modal-message">${escapeHtml(message)}</p>
    <div class="modal-buttons">
      ${onCancel ? '<button class="modal-btn modal-btn-secondary" id="modal-cancel">Cancel</button>' : ''}
      ${onConfirm ? `<button class="modal-btn modal-btn-primary" id="modal-confirm">${onCancel ? 'Confirm' : 'OK'}</button>` : ''}
    </div>
  `;
  
  overlay.appendChild(content);
  document.body.appendChild(overlay);
  
  // Add modal styles if not already present
  if (!document.getElementById('modal-styles')) {
    const style = document.createElement('style');
    style.id = 'modal-styles';
    style.textContent = `
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        animation: fadeIn 0.2s ease;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .modal-content, .modal-content.edit-modal-inner {
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        padding: 32px;
        max-width: 420px;
        text-align: center;
        animation: slideUp 0.3s ease;
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .modal-icon {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        font-size: 28px;
        font-weight: bold;
      }
      .modal-icon.success { background: #ecfdf5; color: #059669; }
      .modal-icon.warning { background: #fef3c7; color: #d97706; }
      .modal-icon.error { background: #fee2e2; color: #dc2626; }
      .modal-icon.info { background: #dbeafe; color: #0284c7; }
      .modal-title { font-size: 18px; font-weight: 600; color: #1f2937; margin: 0 0 8px 0; }
      .modal-message { font-size: 14px; color: #6b7280; margin: 0 0 24px 0; line-height: 1.5; }
      .modal-buttons { display: flex; gap: 12px; justify-content: center; }
      .modal-btn {
        padding: 10px 24px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .modal-btn-primary { background: #3b82f6; color: white; }
      .modal-btn-primary:hover { background: #2563eb; }
      .modal-btn-secondary { background: #f3f4f6; color: #374151; }
      .modal-btn-secondary:hover { background: #e5e7eb; }
    `;
    document.head.appendChild(style);
  }
  
  // Handle button clicks
  const handleConfirmClick = () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  };
  const handleCancelClick = () => {
    overlay.remove();
    if (onCancel) onCancel();
  };
  
  const confirmBtn = content.querySelector('#modal-confirm');
  const cancelBtn = content.querySelector('#modal-cancel');
  
  if (confirmBtn) confirmBtn.addEventListener('click', handleConfirmClick);
  if (cancelBtn) cancelBtn.addEventListener('click', handleCancelClick);
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleCancelClick();
  });
  
  if (!confirmBtn && !cancelBtn) {
    // If no buttons, auto-remove after 3 seconds
    setTimeout(() => overlay.remove(), 3000);
  }
  
  // Add Enter key support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (confirmBtn) handleConfirmClick();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelClick();
    }
  }, { once: true });
}

// Initialize
async function init() {
  const user = await loadUserData();
  displayUserData(user);
  setupEventListeners();
}

init();