/**
 * Participant View Logic
 * Handles participant joining, video conference, and recording
 */

let jitsiApi = null;
let sessionData = null;
let participantId = null;
let isRecording = false;
let recordingStartTime = null;
let recordingInterval = null;
let mediaRecorder = null;
let audioChunks = [];
let speechRecognition = null;
let presenceCleanup = null; // Stores the Firebase presence cleanup function

/**
 * Initialize participant view
 */
async function init() {
    console.log('🚀 Initializing participant view...');

    // Initialize theme
    Utils.initTheme();

    // Check browser support
    if (!Utils.checkBrowserSupport()) {
        document.getElementById('join-button').disabled = true;
        return;
    }

    // Check if already in a session (from URL or localStorage)
    const urlParams = Utils.getUrlParams();
    let savedCode, savedName, savedId;

    try {
        savedCode = localStorage.getItem('workshop_code');
        savedName = localStorage.getItem('participant_name');
        savedId = localStorage.getItem('participant_id');
    } catch (error) {
        console.warn('Could not access localStorage:', error);
    }

    if (urlParams.get('code') && urlParams.get('name')) {
        document.getElementById('room-code').value = urlParams.get('code');
        document.getElementById('participant-name').value = urlParams.get('name');
    } else if (savedCode && savedName && savedId) {
        // Auto-rejoin if recently disconnected
        const rejoined = await autoRejoin(savedCode, savedName, savedId);
        if (rejoined) return;
    }

    // Set up event listeners
    setupEventListeners();

    // Initialize Firebase
    await FirebaseService.init();

    console.log('✅ Participant view ready');
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Join form submission
    document.getElementById('join-form').addEventListener('submit', handleJoinSubmit);

    // Leave button
    document.getElementById('leave-button')?.addEventListener('click', handleLeave);

    // Record button
    document.getElementById('record-button')?.addEventListener('click', toggleRecording);

    // Themes button - toggle drawer checkbox
    document.getElementById('themes-button')?.addEventListener('click', () => {
        const drawerCheckbox = document.getElementById('themes-drawer');
        if (drawerCheckbox) drawerCheckbox.checked = true;
    });

    // Close themes panel - uncheck drawer
    document.getElementById('close-themes')?.addEventListener('click', () => {
        const drawerCheckbox = document.getElementById('themes-drawer');
        if (drawerCheckbox) drawerCheckbox.checked = false;
    });

    // Theme toggle button
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        Utils.toggleTheme();
    });

    // Auto-format room code input
    const codeInput = document.getElementById('room-code');
    codeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);
}

/**
 * Handle join form submission
 */
async function handleJoinSubmit(e) {
    e.preventDefault();

    const nameInput = document.getElementById('participant-name');
    const codeInput = document.getElementById('room-code');
    const joinButton = document.getElementById('join-button');

    // Validate inputs
    const name = Utils.validateParticipantName(nameInput.value);
    const code = Utils.validateRoomCode(codeInput.value);

    if (!name || !code) return;

    // Disable form
    joinButton.disabled = true;
    joinButton.querySelector('.btn-text').classList.add('hidden');
    joinButton.querySelector('.btn-loading').classList.remove('hidden');

    try {
        // Generate participant ID
        participantId = Utils.generateParticipantId();

        // Join session in Firebase
        Utils.setLoading(true, 'Joining workshop...');
        const joined = await FirebaseService.joinSession(code, participantId, name);

        if (!joined) {
            throw new Error('Failed to join session');
        }

        // Save to localStorage for auto-rejoin
        try {
            localStorage.setItem('workshop_code', code);
            localStorage.setItem('participant_name', name);
            localStorage.setItem('participant_id', participantId);
        } catch (error) {
            console.warn('Could not save session to localStorage:', error);
        }

        // Set up presence
        presenceCleanup = FirebaseService.setupPresence(code, participantId);

        // Listen to session updates
        FirebaseService.listenToSession(code, handleSessionUpdate);

        // Listen to themes
        FirebaseService.listenToThemes(code, handleThemesUpdate);

        // Load Jitsi and join video conference
        await loadJitsiScript();
        await joinVideoConference(code, name);

        // Switch to workshop screen
        switchScreen('workshop');

        // Update display
        document.getElementById('display-code').textContent = code;
        document.getElementById('display-name').textContent = name;
        updateConnectionStatus('online');

        Utils.setLoading(false);
        Utils.showSuccess('Joined workshop successfully!');
        Utils.trackEvent('participant', 'join_success', code);

    } catch (error) {
        console.error('Error joining workshop:', error);
        Utils.showError('Failed to join workshop. Please try again.');
        Utils.trackEvent('participant', 'join_error', error.message);

        // Re-enable form
        joinButton.disabled = false;
        joinButton.querySelector('.btn-text').classList.remove('hidden');
        joinButton.querySelector('.btn-loading').classList.add('hidden');
        Utils.setLoading(false);
    }
}

/**
 * Auto-rejoin previous session
 */
async function autoRejoin(code, name, id) {
    try {
        Utils.setLoading(true, 'Rejoining workshop...');

        const exists = await FirebaseService.sessionExists(code);
        if (!exists) {
            try {
                localStorage.clear();
            } catch (error) {
                console.warn('Could not clear localStorage:', error);
            }
            Utils.setLoading(false);
            return false;
        }

        participantId = id;
        await FirebaseService.joinSession(code, participantId, name);
        presenceCleanup = FirebaseService.setupPresence(code, participantId);
        FirebaseService.listenToSession(code, handleSessionUpdate);
        FirebaseService.listenToThemes(code, handleThemesUpdate);

        await loadJitsiScript();
        await joinVideoConference(code, name);

        switchScreen('workshop');
        document.getElementById('display-code').textContent = code;
        document.getElementById('display-name').textContent = name;
        updateConnectionStatus('online');

        Utils.setLoading(false);
        Utils.showSuccess('Rejoined workshop!');
        return true;

    } catch (error) {
        console.error('Auto-rejoin failed:', error);
        localStorage.clear();
        Utils.setLoading(false);
        return false;
    }
}

/**
 * Load Jitsi Meet script
 */
function loadJitsiScript() {
    return new Promise((resolve, reject) => {
        if (window.JitsiMeetExternalAPI) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load Jitsi Meet'));
        document.head.appendChild(script);
    });
}

/**
 * Join video conference
 */
async function joinVideoConference(roomCode, displayName) {
    return new Promise((resolve, reject) => {
        let timeoutId = null;
        let resolved = false;

        try {
            const options = {
                ...CONFIG.JITSI.OPTIONS,
                roomName: roomCode,
                parentNode: document.getElementById('jitsi-container'),
                userInfo: {
                    displayName
                }
            };

            jitsiApi = new JitsiMeetExternalAPI(CONFIG.JITSI.DOMAIN, options);

            // Set up event listeners
            jitsiApi.addEventListener('videoConferenceJoined', () => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeoutId);

                console.log('✅ Joined video conference');
                updateConnectionStatus('online');
                const recordBtn = document.getElementById('record-button');
                if (recordBtn) recordBtn.disabled = false;
                resolve();
            });

            jitsiApi.addEventListener('videoConferenceLeft', handleVideoLeft);
            jitsiApi.addEventListener('readyToClose', handleVideoLeft);

            jitsiApi.addEventListener('participantJoined', (participant) => {
                console.log('Participant joined:', participant);
            });

            // Timeout fallback
            timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    reject(new Error('Video conference connection timeout'));
                }
            }, CONFIG.APP.CONNECTION_TIMEOUT);

        } catch (error) {
            resolved = true;
            if (timeoutId) clearTimeout(timeoutId);
            reject(error);
        }
    });
}

/**
 * Handle session updates from Firebase
 */
function handleSessionUpdate(session) {
    sessionData = session;

    // Update phase indicator
    const phaseIndicator = document.getElementById('phase-indicator');
    if (phaseIndicator && session.phase !== undefined) {
        phaseIndicator.textContent = `Phase ${session.phase + 1}`;
    }

    // Check if session ended
    if (session.status === 'ended') {
        Utils.showError('Workshop session has ended', 0);
        setTimeout(() => handleLeave(), 3000);
    }
}

/**
 * Handle themes updates
 */
function handleThemesUpdate(themes) {
    const themesList = document.getElementById('themes-list');
    if (!themesList) return;

    // Clear existing
    themesList.innerHTML = '';

    const tables = Object.keys(themes);
    if (tables.length === 0) {
        themesList.innerHTML = '<p class="empty-state">No themes generated yet</p>';
        return;
    }

    // Display themes by table
    tables.forEach(tableKey => {
        const data = themes[tableKey];
        const tableDiv = document.createElement('div');
        tableDiv.className = 'theme-group';

        const header = document.createElement('h3');
        header.textContent = `Table ${data.tableNumber}`;
        tableDiv.appendChild(header);

        if (data.themes && data.themes.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'theme-list';

            data.themes.forEach(theme => {
                const li = document.createElement('li');
                li.className = 'theme-item';
                li.textContent = theme;
                ul.appendChild(li);
            });

            tableDiv.appendChild(ul);
        }

        if (data.synthesis) {
            const synthesis = document.createElement('p');
            synthesis.className = 'synthesis-text';
            synthesis.textContent = data.synthesis;
            tableDiv.appendChild(synthesis);
        }

        themesList.appendChild(tableDiv);
    });
}

/**
 * Toggle recording
 */
async function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

/**
 * Start recording audio
 */
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Initialize speech recognition
        initSpeechRecognition();

        // Initialize media recorder as fallback
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.addEventListener('dataavailable', (event) => {
            audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener('stop', async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await sendToWhisper(audioBlob);

            // Stop stream
            stream.getTracks().forEach(track => track.stop());
        });

        mediaRecorder.start();
        isRecording = true;
        recordingStartTime = Date.now();

        // Update UI
        document.getElementById('record-button').classList.add('recording');
        document.getElementById('recording-indicator').classList.remove('hidden');
        updateRecordingDuration();

        Utils.trackEvent('recording', 'start', sessionData?.code);

    } catch (error) {
        console.error('Recording error:', error);
        Utils.showError('Failed to start recording. Please check microphone permissions.');
    }
}

/**
 * Stop recording
 */
function stopRecording() {
    if (speechRecognition) {
        speechRecognition.stop();
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }

    isRecording = false;
    clearInterval(recordingInterval);

    // Update UI
    document.getElementById('record-button').classList.remove('recording');
    document.getElementById('recording-indicator').classList.add('hidden');

    Utils.trackEvent('recording', 'stop', sessionData?.code);
}

/**
 * Initialize Web Speech API
 */
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        console.warn('Speech Recognition not supported');
        return;
    }

    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = CONFIG.SPEECH.CONTINUOUS;
    speechRecognition.interimResults = CONFIG.SPEECH.INTERIM_RESULTS;
    speechRecognition.lang = CONFIG.SPEECH.LANGUAGE;

    let finalTranscript = '';

    speechRecognition.onresult = (event) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }

        console.log('Transcript:', finalTranscript + interimTranscript);
    };

    speechRecognition.onend = async () => {
        if (finalTranscript.trim()) {
            await saveTranscript(finalTranscript.trim());
        }
    };

    speechRecognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
    };

    speechRecognition.start();
}

/**
 * Send audio to Whisper API (fallback)
 */
async function sendToWhisper(audioBlob) {
    try {
        const formData = new FormData();
        formData.append('audio', audioBlob);
        formData.append('language', 'en');

        const response = await fetch(CONFIG.API.WHISPER_PROXY, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Whisper API error');

        const data = await response.json();
        if (data.transcript) {
            await saveTranscript(data.transcript);
        }

    } catch (error) {
        console.error('Whisper error:', error);
        Utils.showError('Failed to transcribe audio');
    }
}

/**
 * Save transcript to Firebase
 */
async function saveTranscript(transcript) {
    if (!sessionData || !transcript) return;

    const duration = Math.floor((Date.now() - recordingStartTime) / 1000);

    await FirebaseService.saveTranscript(
        sessionData.code,
        sessionData.tableNumber || 1,
        sessionData.phase || 0,
        transcript,
        duration
    );

    Utils.showSuccess('Transcript saved!');
}

/**
 * Update recording duration display
 */
function updateRecordingDuration() {
    // Clear any existing interval first
    if (recordingInterval) {
        clearInterval(recordingInterval);
    }

    recordingInterval = setInterval(() => {
        if (!isRecording) {
            clearInterval(recordingInterval);
            recordingInterval = null;
            return;
        }

        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;

        const durationEl = document.getElementById('recording-duration');
        if (durationEl) {
            durationEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(status) {
    const indicator = document.getElementById('connection-status');
    if (!indicator) return;

    const statusText = indicator.querySelector('.status-text');
    const statusDot = indicator.querySelector('.status-dot');

    indicator.className = 'status-indicator';
    indicator.classList.add(`status-${status}`);

    const statusLabels = {
        'online': 'Connected',
        'offline': 'Disconnected',
        'connecting': 'Connecting...'
    };

    statusText.textContent = statusLabels[status] || status;
}

/**
 * Handle video left
 */
function handleVideoLeft() {
    console.log('Left video conference');
    updateConnectionStatus('offline');
}

/**
 * Handle leave workshop
 */
async function handleLeave() {
    const confirmed = confirm('Are you sure you want to leave the workshop?');
    if (!confirmed) return;

    Utils.setLoading(true, 'Leaving workshop...');

    // Stop recording if active
    if (isRecording) {
        stopRecording();
    }

    // Update status in Firebase
    if (sessionData && participantId) {
        await FirebaseService.updateParticipantStatus(
            sessionData.code,
            participantId,
            'offline'
        );
    }

    // Clean up
    cleanup();

    // Clear saved data
    localStorage.clear();

    // Return to join screen
    switchScreen('join');
    Utils.setLoading(false);

    Utils.trackEvent('participant', 'leave', sessionData?.code);
}

/**
 * Switch between screens
 */
function switchScreen(screenName) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    document.getElementById(`${screenName}-screen`).classList.add('active');
}

/**
 * Cleanup resources
 */
function cleanup() {
    // Dispose Jitsi
    if (jitsiApi) {
        jitsiApi.dispose();
        jitsiApi = null;
    }

    // Stop recording
    if (isRecording) {
        stopRecording();
    }

    // Clean up presence
    if (presenceCleanup) {
        try {
            presenceCleanup();
        } catch (error) {
            console.warn('Error cleaning up presence:', error);
        }
        presenceCleanup = null;
    }

    // Clean up Firebase
    FirebaseService.cleanup();

    console.log('🧹 Participant view cleaned up');
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
