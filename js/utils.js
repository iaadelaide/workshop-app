/**
 * Utility Functions
 * Validation, sanitization, error handling, and helpers
 */

const Utils = {
    /**
     * Initialize theme from localStorage or system preference
     */
    initTheme() {
        try {
            const savedTheme = localStorage.getItem('theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const theme = savedTheme || (prefersDark ? 'dark' : 'light');
            this.setTheme(theme);
        } catch (error) {
            console.warn('Could not load theme preference:', error);
            // Fallback to light theme
            document.documentElement.setAttribute('data-theme', 'light');
        }
    },

    /**
     * Set theme and save to localStorage
     */
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem('theme', theme);
        } catch (error) {
            console.warn('Could not save theme preference:', error);
        }
    },

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        return newTheme;
    },

    /**
     * Validate and sanitize room code
     */
    validateRoomCode(code) {
        if (!code) {
            this.showError('Room code is required');
            return null;
        }

        const sanitized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

        if (sanitized.length !== CONFIG.APP.SESSION_CODE_LENGTH) {
            this.showError(`Room code must be exactly ${CONFIG.APP.SESSION_CODE_LENGTH} characters`);
            return null;
        }

        return sanitized;
    },

    /**
     * Validate and sanitize participant name
     */
    validateParticipantName(name) {
        if (!name) {
            this.showError('Name is required');
            return null;
        }

        const sanitized = name.trim().substring(0, CONFIG.APP.MAX_NAME_LENGTH);

        if (sanitized.length < CONFIG.APP.MIN_NAME_LENGTH) {
            this.showError(`Name must be at least ${CONFIG.APP.MIN_NAME_LENGTH} characters`);
            return null;
        }

        // Remove HTML tags and dangerous characters
        return sanitized
            .replace(/[<>]/g, '')
            .replace(/[^\w\s\-']/g, '');
    },

    /**
     * Generate unique participant ID
     */
    generateParticipantId() {
        return `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Generate random room code
     */
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars
        let code = '';
        for (let i = 0; i < CONFIG.APP.SESSION_CODE_LENGTH; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    },

    /**
     * Show error message to user
     */
    /**
     * Show error message using DaisyUI toast
     */
    showError(message, duration = 5000) {
        console.error('Error:', message);
        this.showToast(message, 'error', duration);
        this.trackEvent('error', 'user_error', message);
    },

    /**
     * Show success message using DaisyUI toast
     */
    showSuccess(message, duration = 3000) {
        console.log('Success:', message);
        this.showToast(message, 'success', duration);
    },

    /**
     * Show toast notification with DaisyUI styles
     */
    showToast(message, type = 'info', duration = 3000) {
        // Get or create toast container
        let toastContainer = document.querySelector('.toast');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast toast-top toast-end z-50';
            document.body.appendChild(toastContainer);
        }

        // Create alert element
        const alert = document.createElement('div');
        const alertClasses = {
            error: 'alert alert-error',
            success: 'alert alert-success',
            warning: 'alert alert-warning',
            info: 'alert alert-info'
        };
        alert.className = alertClasses[type] || alertClasses.info;

        // Add icon and message
        const icons = {
            error: '<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
            success: '<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
            warning: '<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>',
            info: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
        };

        alert.innerHTML = `
      ${icons[type] || icons.info}
      <span>${message}</span>
    `;

        toastContainer.appendChild(alert);

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                alert.style.opacity = '0';
                alert.style.transition = 'opacity 0.3s ease-out';
                setTimeout(() => alert.remove(), 300);
            }, duration);
        }
    },

    /**
     * Show/hide loading overlay with DaisyUI
     */
    setLoading(show, message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        if (!overlay) return;

        const loadingText = overlay.querySelector('.loading-text, p');
        if (loadingText) loadingText.textContent = message;

        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    },

    /**
     * Check browser support for required features
     */
    checkBrowserSupport() {
        const issues = [];

        // Check for getUserMedia (camera/microphone)
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            issues.push('Camera/microphone access not supported');
        }

        // Check for Jitsi external API (warning only, not critical)
        if (typeof window.JitsiMeetExternalAPI === 'undefined') {
            console.warn('⚠️ Jitsi Meet API not loaded yet - will load dynamically');
        }

        // Warn about Speech Recognition (not critical)
        if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
            console.warn('⚠️ Web Speech API not supported - will use Whisper fallback');
        }

        // Warn about MediaRecorder (not critical)
        if (!window.MediaRecorder) {
            console.warn('⚠️ MediaRecorder not supported - recording features limited');
        }

        if (issues.length > 0) {
            const message = `Your browser doesn't support required features:\n${issues.join('\n')}`;
            this.showError(message, 0);
            return false;
        }

        return true;
    },

    /**
     * Debounce function calls
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function calls
     */
    throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Track analytics event (privacy-friendly)
     */
    trackEvent(category, action, label = '') {
        if (!CONFIG.FEATURES.ENABLE_ANALYTICS) return;

        // Use Plausible, Fathom, or similar
        if (window.plausible) {
            window.plausible(action, {
                props: { category, label }
            });
        }

        // Console log in development
        if (ENV === 'development') {
            console.log(`📊 Analytics: ${category} > ${action}`, label);
        }
    },

    /**
     * Format timestamp for display
     */
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-AU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showSuccess('Copied to clipboard!');
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            this.showError('Failed to copy to clipboard');
            return false;
        }
    },

    /**
     * Get URL parameters
     */
    getUrlParams() {
        return new URLSearchParams(window.location.search);
    },

    /**
     * Safe JSON parse
     */
    safeJsonParse(str, fallback = null) {
        try {
            return JSON.parse(str);
        } catch (err) {
            console.error('JSON parse error:', err);
            return fallback;
        }
    },

    /**
     * Retry async operation with exponential backoff
     */
    async retry(fn, maxAttempts = CONFIG.APP.RECONNECT_ATTEMPTS, delay = CONFIG.APP.RECONNECT_DELAY) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (attempt === maxAttempts) throw error;

                const waitTime = delay * Math.pow(2, attempt - 1);
                console.log(`Retry attempt ${attempt}/${maxAttempts} after ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
};

// Make Utils globally available
window.Utils = Utils;
