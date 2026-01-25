const API = '/api/auth/admin-login';

function showNotice(id, type, text) {
  const n = document.getElementById(id);
  if (!n) return;
  n.style.display = '';
  n.className = 'form-notice ' + type;
  n.textContent = text;
  if (type === 'error') {
    n.classList.add('shake');
    setTimeout(() => n.classList.remove('shake'), 400);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('admin-login-form');
  const noticeId = 'admin-login-notice';

  // Render dynamic fields based on role
  function renderLoginFields() {
    const roleSelect = document.getElementById('admin-role');
    if (!roleSelect) {
      console.error('Role selector not found');
      return;
    }
    const role = roleSelect.value;
    const fieldsDiv = document.getElementById('admin-login-fields');
    if (!fieldsDiv) {
      console.error('Fields container not found');
      return;
    }
    let html = '';
    if (role === 'superadmin') {
      html += '<input id="admin-id" type="text" placeholder="ID number" required />';
      html += '<div class="password-wrapper"><input id="admin-password" type="password" placeholder="Password" required /></div>';
    } else if (role === 'admin') {
      html += '<input id="admin-name" type="text" placeholder="Name" required />';
      html += '<input id="admin-email" type="email" placeholder="Email" required />';
      html += '<div class="password-wrapper"><input id="admin-password" type="password" placeholder="Password" required /></div>';
      html += '<input id="admin-secret" type="text" placeholder="Secret Key" required />';
    } else if (role === 'instructor') {
      html += '<input id="admin-name" type="text" placeholder="Name" required />';
      html += '<input id="admin-email" type="email" placeholder="Email" required />';
      html += '<div class="password-wrapper"><input id="admin-password" type="password" placeholder="Password" required /></div>';
    }
    fieldsDiv.innerHTML = html;
    
    // Add show password eye icon button
    const passwordInputWrapper = fieldsDiv.querySelector('.password-wrapper');
    if (passwordInputWrapper) {
      const eyeBtn = document.createElement('button');
      eyeBtn.type = 'button';
      eyeBtn.className = 'toggle-password';
      eyeBtn.innerHTML = '<i class="fas fa-eye"></i>';
      eyeBtn.title = 'Show password';
      eyeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const passwordInput = document.getElementById('admin-password');
        if (passwordInput) {
          const isPassword = passwordInput.type === 'password';
          passwordInput.type = isPassword ? 'text' : 'password';
          eyeBtn.innerHTML = isPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
          eyeBtn.title = isPassword ? 'Hide password' : 'Show password';
        }
      });
      passwordInputWrapper.appendChild(eyeBtn);
    }
    
    console.log('Rendered fields for role:', role);
  }

  // initial render and event
  setTimeout(() => {
    renderLoginFields();
    const roleSelect = document.getElementById('admin-role');
    if (roleSelect) {
      roleSelect.addEventListener('change', renderLoginFields);
      console.log('Role selector listener attached');
    } else {
      console.error('Role selector not found for event listener');
    }
  }, 0);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const role = document.getElementById('admin-role').value;
    let payload = { role };

    if (role === 'superadmin') {
      const idElem = document.getElementById('admin-id');
      const pwdElem = document.getElementById('admin-password');
      console.log('Super Admin login - ID elem:', idElem, 'PWD elem:', pwdElem);
      payload.idNumber = (idElem ? idElem.value || '' : '').trim();
      payload.password = (pwdElem ? pwdElem.value || '' : '').trim();
      console.log('Super Admin payload:', { idNumber: payload.idNumber ? '***' : 'EMPTY', password: payload.password ? '***' : 'EMPTY' });
      if (!payload.idNumber || !payload.password) { showNotice(noticeId, 'error', 'Enter all fields'); return; }
    } else if (role === 'admin') {
      payload.name = (document.getElementById('admin-name').value || '').trim();
      payload.email = (document.getElementById('admin-email').value || '').trim();
      payload.password = (document.getElementById('admin-password').value || '').trim();
      payload.secret = (document.getElementById('admin-secret').value || '').trim();
      if (!payload.name || !payload.email || !payload.password || !payload.secret) { showNotice(noticeId, 'error', 'Enter all fields'); return; }
    } else if (role === 'instructor') {
      payload.name = (document.getElementById('admin-name').value || '').trim();
      payload.email = (document.getElementById('admin-email').value || '').trim();
      payload.password = (document.getElementById('admin-password').value || '').trim();
      if (!payload.name || !payload.email || !payload.password) { showNotice(noticeId, 'error', 'Enter all fields'); return; }
    }

    showNotice(noticeId, 'info', 'Signing in...');
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        showNotice(noticeId, 'error', data.error || 'Invalid credentials');
        return;
      }

      // Store auth token and admin info from server response
      localStorage.setItem('isAdmin', 'true');
      localStorage.setItem('adminEmail', data.admin.email || '');
      localStorage.setItem('adminName', data.admin.name || '');
      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('adminRole', data.admin.role || role);

      showNotice(noticeId, 'success', 'Signed in — redirecting...');
      setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 500);
    } catch (err) {
      console.error('admin login error', err);
      showNotice(noticeId, 'error', err.message || 'Error signing in');
    }
  });
});

export {};
