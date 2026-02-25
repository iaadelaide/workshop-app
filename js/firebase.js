/**
 * Firebase Realtime Database Integration
 * Handles all database operations with error handling and retries
 */

let firebaseApp = null;
let database = null;
const activeListeners = [];

const FirebaseService = {
    /**
     * Initialize Firebase
     */
    async init() {
        try {
            if (firebaseApp) return true;

            Utils.setLoading(true, 'Connecting to database...');

            // Validate Firebase configuration
            const hasPlaceholders = Object.values(CONFIG.FIREBASE).some(value =>
                typeof value === 'string' && value.includes('{{')
            );

            if (hasPlaceholders) {
                throw new Error('Firebase configuration not set. Please configure environment variables.');
            }

            // Initialize Firebase
            firebaseApp = firebase.initializeApp(CONFIG.FIREBASE);
            database = firebase.database();

            // Test connection
            await database.ref('.info/connected').once('value');

            console.log('✅ Firebase initialized');
            Utils.setLoading(false);
            return true;

        } catch (error) {
            console.error('Firebase initialization error:', error);
            Utils.showError('Failed to connect to database. Please refresh the page.');
            Utils.setLoading(false);
            return false;
        }
    },

    /**
     * Create a new workshop session
     */
    async createSession(sessionCode, facilitatorId, facilitatorName) {
        try {
            const sessionData = {
                code: sessionCode,
                facilitatorId,
                facilitatorName,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                phase: 0,
                timerActive: false,
                timerDuration: 0,
                status: 'active'
            };

            await database.ref(`sessions/${sessionCode}`).set(sessionData);

            Utils.trackEvent('session', 'create', sessionCode);
            return true;

        } catch (error) {
            console.error('Error creating session:', error);
            Utils.showError('Failed to create workshop session');
            return false;
        }
    },

    /**
     * Check if session exists
     */
    async sessionExists(sessionCode) {
        try {
            const snapshot = await database.ref(`sessions/${sessionCode}`).once('value');
            return snapshot.exists();
        } catch (error) {
            console.error('Error checking session:', error);
            return false;
        }
    },

    /**
     * Join a session as participant
     */
    async joinSession(sessionCode, participantId, participantName) {
        try {
            // Check if session exists
            const exists = await this.sessionExists(sessionCode);
            if (!exists) {
                Utils.showError('Workshop session not found');
                return false;
            }

            // Add participant to session
            const participantData = {
                id: participantId,
                name: participantName,
                joinedAt: firebase.database.ServerValue.TIMESTAMP,
                status: 'online',
                tableNumber: null
            };

            await database.ref(`sessions/${sessionCode}/participants/${participantId}`).set(participantData);

            Utils.trackEvent('session', 'join', sessionCode);
            return true;

        } catch (error) {
            console.error('Error joining session:', error);
            Utils.showError('Failed to join workshop session');
            return false;
        }
    },

    /**
     * Update participant status
     */
    updateParticipantStatus: Utils.debounce(async function (sessionCode, participantId, status) {
        try {
            await database.ref(`sessions/${sessionCode}/participants/${participantId}/status`).set(status);
        } catch (error) {
            console.error('Error updating participant status:', error);
        }
    }, 500),

    /**
     * Listen to session changes
     */
    listenToSession(sessionCode, callback) {
        const ref = database.ref(`sessions/${sessionCode}`);

        const listener = ref.on('value', (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.val());
            } else {
                Utils.showError('Workshop session ended or not found');
            }
        }, (error) => {
            console.error('Session listener error:', error);
            Utils.showError('Lost connection to workshop. Attempting to reconnect...');
        });

        // Store for cleanup
        activeListeners.push({ ref, event: 'value', callback: listener });

        return () => ref.off('value', listener);
    },

    /**
     * Listen to participants
     */
    listenToParticipants(sessionCode, onAdded, onRemoved) {
        const ref = database.ref(`sessions/${sessionCode}/participants`);

        const addedListener = ref.on('child_added', (snapshot) => {
            if (onAdded) onAdded(snapshot.val());
        });

        const removedListener = ref.on('child_removed', (snapshot) => {
            if (onRemoved) onRemoved(snapshot.val());
        });

        activeListeners.push(
            { ref, event: 'child_added', callback: addedListener },
            { ref, event: 'child_removed', callback: removedListener }
        );

        return () => {
            ref.off('child_added', addedListener);
            ref.off('child_removed', removedListener);
        };
    },

    /**
     * Save transcript
     */
    async saveTranscript(sessionCode, tableNumber, phaseIndex, transcript, duration) {
        try {
            const transcriptData = {
                sessionCode,
                tableNumber,
                phaseIndex,
                transcript,
                duration,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            const newRef = database.ref(`transcripts/${sessionCode}`).push();
            await newRef.set(transcriptData);

            Utils.trackEvent('transcript', 'save', `table${tableNumber}_phase${phaseIndex}`);
            return newRef.key;

        } catch (error) {
            console.error('Error saving transcript:', error);
            Utils.showError('Failed to save transcript');
            return null;
        }
    },

    /**
     * Get transcripts for session
     */
    async getTranscripts(sessionCode, phaseIndex = null) {
        try {
            let ref = database.ref(`transcripts/${sessionCode}`);

            if (phaseIndex !== null) {
                ref = ref.orderByChild('phaseIndex').equalTo(phaseIndex);
            }

            const snapshot = await ref.once('value');
            const transcripts = [];

            snapshot.forEach((child) => {
                transcripts.push({ id: child.key, ...child.val() });
            });

            return transcripts;

        } catch (error) {
            console.error('Error getting transcripts:', error);
            return [];
        }
    },

    /**
     * Save synthesized themes
     */
    async saveThemes(sessionCode, tableNumber, themes, synthesis) {
        try {
            const themeData = {
                sessionCode,
                tableNumber,
                themes,
                synthesis,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            await database.ref(`themes/${sessionCode}/table${tableNumber}`).set(themeData);

            Utils.trackEvent('themes', 'save', `table${tableNumber}`);
            return true;

        } catch (error) {
            console.error('Error saving themes:', error);
            Utils.showError('Failed to save themes');
            return false;
        }
    },

    /**
     * Listen to themes
     */
    listenToThemes(sessionCode, callback) {
        const ref = database.ref(`themes/${sessionCode}`);

        const listener = ref.on('value', (snapshot) => {
            const themes = snapshot.val() || {};
            callback(themes);
        });

        activeListeners.push({ ref, event: 'value', callback: listener });

        return () => ref.off('value', listener);
    },

    /**
     * Update session phase
     */
    async updatePhase(sessionCode, phaseIndex) {
        try {
            await database.ref(`sessions/${sessionCode}/phase`).set(phaseIndex);
            Utils.trackEvent('session', 'phase_change', `phase${phaseIndex}`);
            return true;
        } catch (error) {
            console.error('Error updating phase:', error);
            return false;
        }
    },

    /**
     * Update timer
     */
    async updateTimer(sessionCode, active, duration) {
        try {
            await database.ref(`sessions/${sessionCode}`).update({
                timerActive: active,
                timerDuration: duration
            });
            return true;
        } catch (error) {
            console.error('Error updating timer:', error);
            return false;
        }
    },

    /**
     * End session
     */
    async endSession(sessionCode) {
        try {
            await database.ref(`sessions/${sessionCode}/status`).set('ended');
            Utils.trackEvent('session', 'end', sessionCode);
            return true;
        } catch (error) {
            console.error('Error ending session:', error);
            return false;
        }
    },

    /**
     * Cleanup all listeners
     */
    cleanup() {
        activeListeners.forEach(({ ref, event, callback }) => {
            ref.off(event, callback);
        });
        activeListeners.length = 0;
        console.log('🧹 Firebase listeners cleaned up');
    },

    /**
     * Set up presence system (online/offline detection)
     */
    setupPresence(sessionCode, participantId) {
        const presenceRef = database.ref(`sessions/${sessionCode}/participants/${participantId}/status`);
        const connectedRef = database.ref('.info/connected');

        connectedRef.on('value', (snapshot) => {
            if (snapshot.val() === true) {
                // Set up onDisconnect handler
                presenceRef.onDisconnect().set('offline');
                presenceRef.set('online');
            }
        });

        return () => {
            connectedRef.off();
            presenceRef.set('offline');
        };
    }
};

// Make FirebaseService globally available
window.FirebaseService = FirebaseService;

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    FirebaseService.cleanup();
});
