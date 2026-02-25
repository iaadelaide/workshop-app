/**
 * Workshop/Facilitator View Logic
 * Handles workshop creation, participant management, and theme generation
 */

let jitsiApi = null;
let sessionData = null;
let facilitatorId = null;
let participants = {};
let currentPhase = 0;
let timerInterval = null;
let timerSeconds = 0;

/**
 * Initialize workshop view
 */
async function init() {
    console.log('🚀 Initializing workshop view...');

    // Initialize theme
    Utils.initTheme();

    // Check browser support
    if (!Utils.checkBrowserSupport()) {
        return;
    }

    // Check if resuming existing session
    const urlParams = Utils.getUrlParams();
    let savedCode, savedId;

    try {
        savedCode = localStorage.getItem('facilitator_code');
        savedId = localStorage.getItem('facilitator_id');
    } catch (error) {
        console.warn('Could not access localStorage:', error);
    }

    // If resuming session, auto-load workshop screen
    // (Note: workshop creation screen doesn't have a code input - code is generated)

    // Set up event listeners
    setupEventListeners();

    // Initialize Firebase
    await FirebaseService.init();

    // Auto-create session if specified
    if (urlParams.get('auto') === 'true') {
        setTimeout(() => handleCreateSubmit({ preventDefault: () => { } }), 1000);
    }

    console.log('✅ Workshop view ready');
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Create form submission
    document.getElementById('create-form')?.addEventListener('submit', handleCreateSubmit);

    // Phase selector
    document.getElementById('phase-select')?.addEventListener('change', handlePhaseChange);

    // Timer controls
    document.getElementById('start-timer')?.addEventListener('click', () => startTimer(5 * 60));
    document.getElementById('stop-timer')?.addEventListener('click', stopTimer);

    // Generate themes button (debounced to prevent spam clicking)
    const generateBtn = document.getElementById('generate-themes');
    if (generateBtn) {
        generateBtn.addEventListener('click', Utils.debounce(handleGenerateThemes, 2000, true));
    }

    // End session button
    document.getElementById('end-session')?.addEventListener('click', handleEndSession);

    // Copy code button
    document.getElementById('copy-code')?.addEventListener('click', handleCopyCode);

    // Theme toggle button
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        Utils.toggleTheme();
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);
}

/**
 * Handle create workshop form submission
 */
async function handleCreateSubmit(e) {
    e.preventDefault();

    const nameInput = document.getElementById('facilitator-name');
    const createButton = document.getElementById('create-button');

    // Validate name
    const name = Utils.validateParticipantName(nameInput?.value || 'Facilitator');
    if (!name && nameInput) return;

    // Disable form
    if (createButton) {
        createButton.disabled = true;
        createButton.querySelector('.btn-text')?.classList.add('hidden');
        createButton.querySelector('.btn-loading')?.classList.remove('hidden');
    }

    try {
        // Generate session code and facilitator ID
        const sessionCode = Utils.generateRoomCode();
        facilitatorId = Utils.generateParticipantId();

        // Create session in Firebase
        Utils.setLoading(true, 'Creating workshop...');
        const created = await FirebaseService.createSession(sessionCode, facilitatorId, name || 'Facilitator');

        if (!created) {
            throw new Error('Failed to create session');
        }

        // Save to localStorage
        try {
            localStorage.setItem('facilitator_code', sessionCode);
            localStorage.setItem('facilitator_id', facilitatorId);
            localStorage.setItem('facilitator_name', name || 'Facilitator');
        } catch (error) {
            console.warn('Could not save session to localStorage:', error);
        }

        // Listen to session updates
        FirebaseService.listenToSession(sessionCode, handleSessionUpdate);

        // Listen to participants
        FirebaseService.listenToParticipants(
            sessionCode,
            handleParticipantAdded,
            handleParticipantRemoved
        );

        // Load Jitsi and join video conference
        await loadJitsiScript();
        await joinVideoConference(sessionCode, name || 'Facilitator');

        // Switch to workshop screen
        switchScreen('workshop');

        // Update display
        document.getElementById('display-workshop-code').textContent = sessionCode;

        // Generate shareable link
        const shareUrl = `${window.location.origin}/participant-new.html?code=${sessionCode}`;
        const shareLinkInput = document.getElementById('share-link');
        if (shareLinkInput) {
            shareLinkInput.value = shareUrl;
        }

        Utils.setLoading(false);
        Utils.showSuccess('Workshop created successfully!');
        Utils.trackEvent('workshop', 'create', sessionCode);

    } catch (error) {
        console.error('Error creating workshop:', error);
        Utils.showError('Failed to create workshop. Please try again.');
        Utils.trackEvent('workshop', 'create_error', error.message);

        // Re-enable form
        if (createButton) {
            createButton.disabled = false;
            createButton.querySelector('.btn-text')?.classList.remove('hidden');
            createButton.querySelector('.btn-loading')?.classList.add('hidden');
        }
        Utils.setLoading(false);
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
                    displayName: `[HOST] ${displayName}`
                }
            };

            jitsiApi = new JitsiMeetExternalAPI(CONFIG.JITSI.DOMAIN, options);

            // Set up event listeners
            jitsiApi.addEventListener('videoConferenceJoined', () => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeoutId);

                console.log('✅ Joined video conference as host');
                addActivity('Workshop started');
                resolve();
            });

            jitsiApi.addEventListener('videoConferenceLeft', () => {
                console.log('Left video conference');
                addActivity('Video ended');
            });

            jitsiApi.addEventListener('participantJoined', (participant) => {
                console.log('Participant joined video:', participant);
            });

            jitsiApi.addEventListener('participantLeft', (participant) => {
                console.log('Participant left video:', participant);
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
 * Handle session updates
 */
function handleSessionUpdate(session) {
    sessionData = session;
    currentPhase = session.phase || 0;

    // Update phase selector
    const phaseSelect = document.getElementById('phase-select');
    if (phaseSelect && phaseSelect.value != currentPhase) {
        phaseSelect.value = currentPhase;
    }
}

/**
 * Handle participant added
 */
function handleParticipantAdded(participant) {
    participants[participant.id] = participant;
    updateParticipantsList();
    addActivity(`${participant.name} joined`);

    Utils.trackEvent('workshop', 'participant_joined', participant.name);
}

/**
 * Handle participant removed
 */
function handleParticipantRemoved(participant) {
    delete participants[participant.id];
    updateParticipantsList();
    addActivity(`${participant.name} left`);

    Utils.trackEvent('workshop', 'participant_left', participant.name);
}

/**
 * Update participants list UI
 */
function updateParticipantsList() {
    const list = document.getElementById('participants-list');
    if (!list) return;

    const count = Object.keys(participants).length;
    document.getElementById('participant-count').textContent = count;

    list.innerHTML = '';

    if (count === 0) {
        list.innerHTML = '<p class="empty-state">No participants yet</p>';
        return;
    }

    Object.values(participants).forEach(participant => {
        const item = document.createElement('div');
        item.className = 'participant-item';

        const avatar = document.createElement('div');
        avatar.className = 'participant-avatar';
        avatar.textContent = participant.name.charAt(0).toUpperCase();

        const info = document.createElement('div');
        info.className = 'participant-info';

        const name = document.createElement('div');
        name.className = 'participant-name';
        name.textContent = participant.name;

        const status = document.createElement('div');
        status.className = 'participant-status';
        status.textContent = participant.status === 'online' ? 'Active' : 'Offline';

        info.appendChild(name);
        info.appendChild(status);

        const indicator = document.createElement('div');
        indicator.className = `participant-indicator ${participant.status}`;

        item.appendChild(avatar);
        item.appendChild(info);
        item.appendChild(indicator);

        list.appendChild(item);
    });
}

/**
 * Add activity log entry
 */
function addActivity(text) {
    const list = document.getElementById('activity-list');
    if (!list) return;

    const item = document.createElement('div');
    item.className = 'activity-item';

    const time = document.createElement('span');
    time.className = 'activity-time';
    time.textContent = Utils.formatTimestamp(Date.now());

    const textSpan = document.createElement('span');
    textSpan.className = 'activity-text';
    textSpan.textContent = text;

    item.appendChild(time);
    item.appendChild(textSpan);

    list.insertBefore(item, list.firstChild);

    // Keep only last 50 items
    while (list.children.length > 50) {
        list.removeChild(list.lastChild);
    }
}

/**
 * Handle phase change
 */
async function handlePhaseChange(e) {
    const newPhase = parseInt(e.target.value);

    if (!sessionData) return;

    await FirebaseService.updatePhase(sessionData.code, newPhase);
    addActivity(`Phase changed to ${newPhase + 1}`);

    Utils.showSuccess(`Moved to Phase ${newPhase + 1}`);
    Utils.trackEvent('workshop', 'phase_change', `phase_${newPhase}`);
}

/**
 * Start timer
 */
function startTimer(seconds) {
    if (timerInterval) stopTimer();

    timerSeconds = seconds;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timerSeconds--;
        updateTimerDisplay();

        if (timerSeconds <= 0) {
            stopTimer();
            Utils.showSuccess('Timer finished!');
            addActivity('Timer finished');
        }
    }, 1000);

    if (sessionData) {
        FirebaseService.updateTimer(sessionData.code, true, seconds);
    }

    addActivity(`Timer started: ${Math.floor(seconds / 60)} minutes`);
}

/**
 * Stop timer
 */
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    if (sessionData) {
        FirebaseService.updateTimer(sessionData.code, false, 0);
    }

    timerSeconds = 0;
    updateTimerDisplay();

    addActivity('Timer stopped');
}

/**
 * Update timer display
 */
function updateTimerDisplay() {
    const display = document.getElementById('timer-display');
    if (!display) return;

    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;

    display.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Update styling based on time remaining
    display.classList.remove('warning', 'danger');

    if (timerSeconds <= 60 && timerSeconds > 0) {
        display.classList.add('danger');
    } else if (timerSeconds <= 120 && timerSeconds > 60) {
        display.classList.add('warning');
    }
}

/**
 * Handle generate themes
 */
async function handleGenerateThemes() {
    if (!sessionData) return;

    Utils.setLoading(true, 'Generating themes from transcripts...');

    try {
        // Get all transcripts for current phase
        const transcripts = await FirebaseService.getTranscripts(sessionData.code, currentPhase);

        if (transcripts.length === 0) {
            Utils.showError('No transcripts found for this phase');
            Utils.setLoading(false);
            return;
        }

        // Group by table
        const tableTranscripts = {};
        transcripts.forEach(t => {
            if (!tableTranscripts[t.tableNumber]) {
                tableTranscripts[t.tableNumber] = [];
            }
            tableTranscripts[t.tableNumber].push(t.transcript);
        });

        // Generate themes for each table
        for (const [tableNum, texts] of Object.entries(tableTranscripts)) {
            const combinedText = texts.join('\n\n');

            // Call OpenAI proxy to extract themes
            const themes = await generateThemesFromText(combinedText);

            // Save themes to Firebase
            await FirebaseService.saveThemes(
                sessionData.code,
                parseInt(tableNum),
                themes,
                null // Synthesis will be done separately
            );
        }

        Utils.setLoading(false);
        Utils.showSuccess('Themes generated successfully!');
        addActivity('Themes generated from transcripts');

        Utils.trackEvent('workshop', 'generate_themes', `phase_${currentPhase}`);

    } catch (error) {
        console.error('Error generating themes:', error);
        Utils.showError('Failed to generate themes');
        Utils.setLoading(false);
    }
}

/**
 * Generate themes from text using OpenAI
 */
async function generateThemesFromText(text) {
    try {
        const response = await fetch(CONFIG.API.OPENAI_PROXY, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: `Extract 3-5 key themes from the following discussion transcript. Return only a JSON array of short theme labels (3-7 words each):\n\n${text}`,
                maxTokens: 200
            })
        });

        if (!response.ok) throw new Error('OpenAI API error');

        const data = await response.json();
        return Utils.safeJsonParse(data.themes, ['Theme 1', 'Theme 2', 'Theme 3']);

    } catch (error) {
        console.error('Error calling OpenAI:', error);
        return ['Theme extraction failed'];
    }
}

/**
 * Handle copy workshop code
 */
async function handleCopyCode() {
    const code = sessionData?.code || document.getElementById('display-workshop-code')?.textContent;
    if (code) {
        await Utils.copyToClipboard(code);
    }
}

/**
 * Handle end session
 */
async function handleEndSession() {
    const confirmed = confirm('Are you sure you want to end this workshop? All participants will be disconnected.');
    if (!confirmed) return;

    Utils.setLoading(true, 'Ending workshop...');

    try {
        if (sessionData) {
            await FirebaseService.endSession(sessionData.code);
        }

        cleanup();
        localStorage.clear();

        Utils.setLoading(false);
        Utils.showSuccess('Workshop ended');

        // Return to create screen after delay
        setTimeout(() => {
            switchScreen('create');
            window.location.reload();
        }, 2000);

        Utils.trackEvent('workshop', 'end', sessionData?.code);

    } catch (error) {
        console.error('Error ending session:', error);
        Utils.showError('Failed to end session properly');
        Utils.setLoading(false);
    }
}

/**
 * Switch between screens
 */
function switchScreen(screenName) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    const targetScreen = document.getElementById(`${screenName}-screen`);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
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

    // Stop timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    // Clean up Firebase
    FirebaseService.cleanup();

    console.log('🧹 Workshop view cleaned up');
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
