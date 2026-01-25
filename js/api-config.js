/**
 * Centralized API configuration
 * Uses environment variables or defaults for flexible deployment
 * Supports: Localhost, Netlify, Render, and other platforms
 */

// Detect API base URL from environment or location
const getApiBaseUrl = () => {
  // Check window for injected API_BASE (set by build process)
  if (window.API_BASE) {
    return window.API_BASE;
  }

  // Check environment variable (if available in browser)
  if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE) {
    return process.env.REACT_APP_API_BASE;
  }

  // Local development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8787/api';
  }

  // Render deployment: backend runs on same host with /api prefix
  // Frontend is served from the same domain
  if (window.location.hostname.includes('render.com') || window.location.hostname.includes('onrender.com')) {
    return '/api';
  }

  // Netlify or other deployed sites: use relative paths (same-origin)
  return '/api';
};

export const API_BASE = getApiBaseUrl();

// Export for direct use in non-module scripts
if (typeof window !== 'undefined') {
  window.API_BASE = API_BASE;
}
