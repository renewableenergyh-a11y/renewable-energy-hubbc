/**
 * Authentication utilities for client-side JWT handling
 */

function getAuthToken() {
  return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
}

function setAuthToken(token) {
  localStorage.setItem('authToken', token);
}

function clearAuthToken() {
  localStorage.removeItem('authToken');
  sessionStorage.removeItem('authToken');
}

function isAuthenticated() {
  const token = getAuthToken();
  if (!token) return false;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp;
    
    // Check if token is expired
    if (exp && Date.now() >= exp * 1000) {
      clearAuthToken();
      return false;
    }
    
    return true;
  } catch (e) {
    clearAuthToken();
    return false;
  }
}

function getUser() {
  const token = getAuthToken();
  if (!token) return null;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return {
      email: payload.email || payload.sub || payload.name || 'Unknown',
      token: token,
      role: payload.role || 'user',
      id: payload.id || payload.sub
    };
  } catch (e) {
    return null;
  }
}

function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}
