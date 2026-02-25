/**
 * Application Configuration
 * Environment-specific settings managed via build-time replacement
 */
const CONFIG = {
    // Jitsi Configuration
    JITSI: {
        DOMAIN: 'meet.jit.si',
        OPTIONS: {
            width: '100%',
            height: '100%',
            parentNode: null, // Set dynamically
            configOverwrite: {
                startWithAudioMuted: false,
                startWithVideoMuted: false,
                enableClosePage: true,
                prejoinPageEnabled: false,
                disableDeepLinking: true,
                toolbarButtons: [
                    'microphone', 'camera', 'desktop', 'fullscreen',
                    'hangup', 'chat', 'raisehand', 'tileview'
                ]
            },
            interfaceConfigOverwrite: {
                SHOW_JITSI_WATERMARK: false,
                SHOW_WATERMARK_FOR_GUESTS: false,
                MOBILE_APP_PROMO: false,
                TOOLBAR_ALWAYS_VISIBLE: true
            }
        }
    },

    // Firebase Configuration (replaced by Netlify build)
    FIREBASE: {
        apiKey: "{{FIREBASE_API_KEY}}",
        authDomain: "{{FIREBASE_AUTH_DOMAIN}}",
        databaseURL: "{{FIREBASE_DATABASE_URL}}",
        projectId: "{{FIREBASE_PROJECT_ID}}",
        storageBucket: "{{FIREBASE_STORAGE_BUCKET}}",
        messagingSenderId: "{{FIREBASE_MESSAGING_SENDER_ID}}",
        appId: "{{FIREBASE_APP_ID}}"
    },

    // Application Settings
    APP: {
        MAX_PARTICIPANTS: 50,
        SESSION_CODE_LENGTH: 6,
        MAX_NAME_LENGTH: 50,
        MIN_NAME_LENGTH: 2,
        CONNECTION_TIMEOUT: 30000,
        RECONNECT_ATTEMPTS: 3,
        RECONNECT_DELAY: 2000
    },

    // Feature Flags
    FEATURES: {
        ENABLE_RECORDING: false,
        ENABLE_TRANSCRIPTION: true,
        ENABLE_SYNTHESIS: true,
        ENABLE_ANALYTICS: true
    },

    // API Endpoints (Netlify Functions)
    API: {
        OPENAI_PROXY: '/.netlify/functions/openai-proxy',
        WHISPER_PROXY: '/.netlify/functions/whisper-proxy'
    },

    // Speech Recognition
    SPEECH: {
        LANGUAGE: 'en-AU',
        CONTINUOUS: true,
        INTERIM_RESULTS: true,
        MAX_ALTERNATIVES: 1
    }
};

// Environment detection
const ENV = (() => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'development';
    if (hostname.includes('--')) return 'preview'; // Netlify preview
    return 'production';
})();

// Development overrides
if (ENV === 'development') {
    CONFIG.JITSI.DOMAIN = 'meet.jit.si'; // Use public server in dev
    CONFIG.APP.CONNECTION_TIMEOUT = 60000;
    console.log('🔧 Running in development mode');
}

// Freeze config to prevent accidental modifications
Object.freeze(CONFIG);
