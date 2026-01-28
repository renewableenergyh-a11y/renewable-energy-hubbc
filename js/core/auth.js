import { API_BASE } from '../api-config.js';

const API_URL = API_BASE;

// Store token in localStorage
function setToken(token) {
  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }
}

// Get token from localStorage
function getToken() {
  return localStorage.getItem('authToken') || null;
}

// Export getToken for other modules
export { getToken };

// Store user in localStorage
function setCurrentUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
  localStorage.setItem("isLoggedIn", "true");
  localStorage.setItem("userEmail", user.email);
  localStorage.setItem("hasPremium", user.hasPremium ? "true" : "false");
}

// Get current login status
export function isLoggedIn() {
  return !!getToken() || localStorage.getItem("isLoggedIn") === "true";
}

// Get current user's email
export function getCurrentUserEmail() {
  const user = getCurrentUser();
  return user?.email || localStorage.getItem("userEmail") || null;
}

// Get premium status
export function hasPremium() {
  const user = getCurrentUser();
  return user?.hasPremium === true || localStorage.getItem("hasPremium") === "true";
}

// Set premium status
export function setPremium(value) {
  const user = getCurrentUser();
  if (user) {
    user.hasPremium = value;
    setCurrentUser(user);
  }
  localStorage.setItem("hasPremium", value ? "true" : "false");
  // Trigger nav UI update since storage events don't fire in same tab
  try { if (window.updateNavUI && typeof window.updateNavUI === 'function') window.updateNavUI(); } catch (e) {}
}

// Get current user object
export function getCurrentUser() {
  try {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('Error parsing current user:', err);
  }
  return null;
}

// Register user
export async function registerUser(name, email, password) {
  // New registration flow: request code then verify
  try {
    console.log('registerUser called with:', { name, email });
    const resp = await fetch(`${API_URL}/auth/register-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await resp.json();
    console.log('registerUser response:', { ok: resp.ok, data });
    if (!resp.ok) throw new Error(data.error || 'Registration request failed');
    return { success: true, message: data.message };
  } catch (err) {
    console.error('Registration request error:', err);
    return { success: false, error: err.message };
  }
}

export async function verifyRegistration(email, code) {
  try {
    const resp = await fetch(`${API_URL}/auth/register-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Verification failed');
    // Don't automatically log the user in - let them log in manually after registration
    // setToken(data.token);
    // setCurrentUser(data.user);
    return { success: true, user: data.user };
  } catch (err) {
    console.error('verifyRegistration error:', err);
    return { success: false, error: err.message };
  }
}

export async function requestPasswordReset(email) {
  try {
    const resp = await fetch(`${API_URL}/auth/forgot-password-request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Request failed');
    return { success: true };
  } catch (err) {
    console.error('requestPasswordReset error:', err);
    return { success: false, error: err.message };
  }
}

export async function resetPassword(email, code, newPassword) {
  try {
    const resp = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code, newPassword })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Reset failed');
    return { success: true };
  } catch (err) {
    console.error('resetPassword error:', err);
    return { success: false, error: err.message };
  }
}

// Login user
export async function loginUser(email, password) {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    // Store token and user
    setToken(data.token);
    setCurrentUser(data.user);

    return { success: true, user: data.user };
  } catch (err) {
    console.error('Login error:', err);
    return { success: false, error: err.message };
  }
}

// Verify token with backend
export async function verifyToken() {
  try {
    const token = getToken();
    if (!token) {
      return { success: false, error: 'No token found' };
    }

    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      // Only logout on 401/403 (unauthorized/forbidden) - token is actually invalid
      // Don't logout on 500 or network errors - could be temporary server issues
      if (response.status === 401 || response.status === 403) {
        logoutUser();
      }
      return { success: false, error: data.error || 'Token verification failed', status: response.status };
    }

    // Update current user
    setCurrentUser(data.user);
    return { success: true, user: data.user };
  } catch (err) {
    console.error('Token verification error:', err);
    // Don't logout on network errors - could be temporary connectivity issues
    return { success: false, error: err.message };
  }
}

// Logout user
export function logoutUser() {
  // Clear ALL auth-related data including admin credentials (CRITICAL FIX: prevents role leakage)
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('adminData');
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminRole');
  localStorage.removeItem('instructorUser');
  localStorage.removeItem('adminUser');
  localStorage.setItem("isLoggedIn", "false");
  localStorage.setItem("userEmail", "");
  localStorage.setItem("hasPremium", "false");
}
