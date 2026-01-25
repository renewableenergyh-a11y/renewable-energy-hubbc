/**
 * Dashboard Defense System
 * Protects the admin dashboard from crashes caused by unexpected changes to the DOM or data
 * 
 * This module provides:
 * - Safe DOM element access with fallbacks
 * - Defensive data structure checks
 * - Error boundaries for critical operations
 * - Event handler protection
 * - Memory leak prevention
 */

const DashboardDefense = (() => {
  const log = (msg, type = 'info') => {
    const styles = {
      info: 'color: #007b6e; font-weight: bold',
      warn: 'color: #d97706; font-weight: bold',
      error: 'color: #dc2626; font-weight: bold',
      success: 'color: #059669; font-weight: bold'
    };
    console.log(`%c[DashboardDefense] ${msg}`, styles[type] || styles.info);
  };

  return {
    /**
     * Safely get a DOM element with validation
     * @param {string} selector - CSS selector
     * @param {string} context - Description of what we're looking for
     * @param {Element} parent - Parent element to search within (defaults to document)
     * @returns {Element|null} - Element if found and valid, null otherwise
     */
    safeGetElement(selector, context = '', parent = document) {
      try {
        if (!selector || typeof selector !== 'string') {
          log(`Invalid selector for ${context}: ${selector}`, 'warn');
          return null;
        }
        
        const element = parent.querySelector(selector);
        
        if (!element) {
          log(`Element not found: ${context} (selector: ${selector})`, 'warn');
          return null;
        }
        
        // Verify element is still in DOM
        if (!document.contains(element)) {
          log(`Element found but not in DOM: ${context}`, 'warn');
          return null;
        }
        
        return element;
      } catch (e) {
        log(`Error getting element ${context}: ${e.message}`, 'error');
        return null;
      }
    },

    /**
     * Safely get multiple DOM elements
     * @param {string} selector - CSS selector
     * @param {string} context - Description of what we're looking for
     * @param {Element} parent - Parent element to search within
     * @returns {Element[]} - Array of valid elements
     */
    safeGetElements(selector, context = '', parent = document) {
      try {
        if (!selector || typeof selector !== 'string') {
          log(`Invalid selector for ${context}: ${selector}`, 'warn');
          return [];
        }
        
        const elements = Array.from(parent.querySelectorAll(selector));
        
        if (elements.length === 0) {
          log(`No elements found: ${context} (selector: ${selector})`, 'warn');
          return [];
        }
        
        // Filter to only elements still in DOM
        return elements.filter(el => document.contains(el));
      } catch (e) {
        log(`Error getting elements ${context}: ${e.message}`, 'error');
        return [];
      }
    },

    /**
     * Safely set element property with type checking
     * @param {Element} element - DOM element
     * @param {string} property - Property name
     * @param {*} value - Value to set
     * @param {string} context - Description of operation
     * @returns {boolean} - Success status
     */
    safeSetProperty(element, property, value, context = '') {
      try {
        if (!element) {
          log(`Cannot set property: element is null/undefined (${context})`, 'warn');
          return false;
        }
        
        if (document.contains(element)) {
          element[property] = value;
          return true;
        } else {
          log(`Cannot set property: element not in DOM (${context})`, 'warn');
          return false;
        }
      } catch (e) {
        log(`Error setting property ${property} (${context}): ${e.message}`, 'error');
        return false;
      }
    },

    /**
     * Safely add event listener with error handling
     * @param {Element} element - DOM element
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     * @param {string} context - Description of handler
     * @returns {boolean} - Success status
     */
    safeAddEventListener(element, event, handler, context = '') {
      try {
        if (!element) {
          log(`Cannot add listener: element is null/undefined (${context})`, 'warn');
          return false;
        }
        
        if (typeof handler !== 'function') {
          log(`Cannot add listener: handler is not a function (${context})`, 'warn');
          return false;
        }
        
        if (!document.contains(element)) {
          log(`Cannot add listener: element not in DOM (${context})`, 'warn');
          return false;
        }
        
        // Wrap handler in error boundary
        const boundHandler = (e) => {
          try {
            handler(e);
          } catch (err) {
            log(`Error in event handler (${context}): ${err.message}`, 'error');
            console.error(err);
          }
        };
        
        element.addEventListener(event, boundHandler, { once: false });
        return true;
      } catch (e) {
        log(`Error adding event listener (${context}): ${e.message}`, 'error');
        return false;
      }
    },

    /**
     * Safely remove event listener
     * @param {Element} element - DOM element
     * @param {string} event - Event name
     * @param {Function} handler - Event handler function
     * @param {string} context - Description of operation
     * @returns {boolean} - Success status
     */
    safeRemoveEventListener(element, event, handler, context = '') {
      try {
        if (!element || !handler) {
          return false;
        }
        
        element.removeEventListener(event, handler);
        return true;
      } catch (e) {
        log(`Error removing event listener (${context}): ${e.message}`, 'error');
        return false;
      }
    },

    /**
     * Safely toggle class on element
     * @param {Element} element - DOM element
     * @param {string} className - Class name
     * @param {boolean} force - Force add (true) or remove (false)
     * @param {string} context - Description of operation
     * @returns {boolean} - Current state
     */
    safeToggleClass(element, className, force, context = '') {
      try {
        if (!element) {
          log(`Cannot toggle class: element is null (${context})`, 'warn');
          return false;
        }
        
        if (!document.contains(element)) {
          log(`Cannot toggle class: element not in DOM (${context})`, 'warn');
          return false;
        }
        
        element.classList.toggle(className, force);
        return element.classList.contains(className);
      } catch (e) {
        log(`Error toggling class (${context}): ${e.message}`, 'error');
        return false;
      }
    },

    /**
     * Validate data structure before using
     * @param {*} data - Data to validate
     * @param {Object} schema - Expected structure {property: type}
     * @param {string} context - Description of data
     * @returns {boolean} - Valid status
     */
    validateData(data, schema, context = '') {
      try {
        if (!data) {
          log(`Data validation failed: null/undefined (${context})`, 'warn');
          return false;
        }
        
        for (const [prop, expectedType] of Object.entries(schema)) {
          if (!(prop in data)) {
            log(`Data missing property ${prop} (${context})`, 'warn');
            return false;
          }
          
          const actualType = typeof data[prop];
          if (expectedType !== 'any' && actualType !== expectedType) {
            log(`Type mismatch for ${prop}: expected ${expectedType}, got ${actualType} (${context})`, 'warn');
            return false;
          }
        }
        
        return true;
      } catch (e) {
        log(`Data validation error (${context}): ${e.message}`, 'error');
        return false;
      }
    },

    /**
     * Execute code with error boundary
     * @param {Function} fn - Function to execute
     * @param {string} context - Description of operation
     * @param {*} fallbackReturn - Value to return if error occurs
     * @returns {*} - Return value of function or fallback
     */
    safeExecute(fn, context = '', fallbackReturn = null) {
      try {
        if (typeof fn !== 'function') {
          log(`Cannot execute: not a function (${context})`, 'warn');
          return fallbackReturn;
        }
        
        const result = fn();
        return result;
      } catch (e) {
        log(`Execution error (${context}): ${e.message}`, 'error');
        console.error(e);
        return fallbackReturn;
      }
    },

    /**
     * Safe API call with timeout and error handling
     * @param {string} url - API endpoint
     * @param {Object} options - Fetch options
     * @param {string} context - Description of call
     * @param {number} timeout - Request timeout in ms
     * @returns {Promise<Object|null>} - Response data or null
     */
    async safeApiFetch(url, options = {}, context = '', timeout = 10000) {
      try {
        if (!url || typeof url !== 'string') {
          log(`Invalid API URL (${context}): ${url}`, 'warn');
          return null;
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          log(`API error (${context}): ${response.status} ${response.statusText}`, 'warn');
          return null;
        }
        
        const data = await response.json();
        return data;
      } catch (e) {
        if (e.name === 'AbortError') {
          log(`API timeout (${context}): request exceeded ${timeout}ms`, 'warn');
        } else {
          log(`API fetch error (${context}): ${e.message}`, 'error');
        }
        return null;
      }
    },

    /**
     * Monitor element visibility in DOM (for debugging)
     * @param {Element} element - Element to monitor
     * @param {string} context - Description
     * @returns {Object} - Monitoring info
     */
    monitorElement(element, context = '') {
      if (!element) return null;
      
      return {
        inDOM: document.contains(element),
        visible: element.offsetHeight > 0 && element.offsetWidth > 0,
        hasContent: element.textContent.length > 0,
        classNames: element.className || 'none',
        context: context
      };
    },

    /**
     * Create a protected modal with error handling
     * @param {Object} config - Modal configuration
     * @returns {Object} - Modal control interface
     */
    createSafeModal(config) {
      const {
        title = 'Dialog',
        content = '',
        buttons = [],
        onClose = null,
        context = ''
      } = config;
      
      try {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '99999';
        
        const modal = document.createElement('div');
        modal.className = 'modal-content';
        
        // Create close button wrapper with error handling
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '12px';
        closeBtn.style.right = '12px';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.fontSize = '20px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.color = '#999';
        
        const close = () => {
          try {
            overlay.remove();
            if (typeof onClose === 'function') onClose();
          } catch (e) {
            log(`Error closing modal (${context}): ${e.message}`, 'error');
          }
        };
        
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) close();
        });
        
        modal.innerHTML = `<h3 style="margin-top:0;">${title}</h3><div>${content}</div>`;
        modal.insertBefore(closeBtn, modal.firstChild);
        
        // Add buttons safely
        if (Array.isArray(buttons) && buttons.length > 0) {
          const buttonContainer = document.createElement('div');
          buttonContainer.style.marginTop = '20px';
          buttonContainer.style.display = 'flex';
          buttonContainer.style.gap = '8px';
          buttonContainer.style.justifyContent = 'flex-end';
          
          buttons.forEach(btn => {
            if (btn.text && typeof btn.onClick === 'function') {
              const btnEl = document.createElement('button');
              btnEl.textContent = btn.text;
              btnEl.className = btn.primary ? 'modal-btn modal-btn-primary' : 'modal-btn modal-btn-secondary';
              btnEl.addEventListener('click', () => {
                try {
                  btn.onClick();
                } catch (e) {
                  log(`Error in modal button handler (${context}): ${e.message}`, 'error');
                }
              });
              buttonContainer.appendChild(btnEl);
            }
          });
          
          modal.appendChild(buttonContainer);
        }
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        return { overlay, modal, close };
      } catch (e) {
        log(`Error creating modal (${context}): ${e.message}`, 'error');
        return null;
      }
    },

    /**
     * Batch protect multiple element operations
     * @param {Array} operations - Array of {element, property, value, context}
     * @returns {Object} - Results of all operations
     */
    batchSafeOperations(operations) {
      const results = {
        successful: 0,
        failed: 0,
        errors: []
      };
      
      operations.forEach(op => {
        const success = this.safeSetProperty(op.element, op.property, op.value, op.context);
        if (success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push(op.context);
        }
      });
      
      return results;
    },

    /**
     * Enable defensive logging globally
     * @param {boolean} enabled - Enable/disable
     */
    setDebugMode(enabled) {
      window._dashboardDebugMode = enabled;
      log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DashboardDefense;
}
