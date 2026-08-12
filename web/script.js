// --- DOM refs ---
const tokenInput = document.getElementById('tokenInput');
const eyeToggle = document.getElementById('eyeToggle');
const channelsInput = document.getElementById('channelsInput');
const intervalInput = document.getElementById('intervalInput');
const messageInput = document.getElementById('messageInput');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const logContainer = document.getElementById('logContainer');

// --- Eye toggle for token (inițial) --
let tokenVisible = false;
let tokenRealValue = '';

// Funcție care actualizează afișajul în funcție de tokenVisible
function updateTokenDisplay() {
    if (tokenVisible) {
        tokenInput.value = tokenRealValue;
        eyeToggle.textContent = '🙈';
    } else {
        tokenInput.value = '•'.repeat(tokenRealValue.length);
        eyeToggle.textContent = '👁️';
    }
}

// La fiecare tastare, salvăm textul real (eliminăm punctele)
tokenInput.addEventListener('input', function() {
    const real = this.value.replace(/•/g, '');
    tokenRealValue = real;
    if (!tokenVisible) {
        this.value = '•'.repeat(real.length);
    } else {
        this.value = real;
    }
});

// Butonul eye toggle – comută vizibilitatea
eyeToggle.addEventListener('click', () => {
    tokenVisible = !tokenVisible;
    updateTokenDisplay();
});

// --- Terminal ---
function addLog(text) {
    const line = document.createElement('div');
    line.className = 'log-line';
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${hh}:${mm}:${ss}`;
    line.textContent = `[${timestamp}] ${text}`;
    logContainer.appendChild(line);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// --- Exposed function for Python to push logs ---
eel.expose(log_push);
function log_push(msg) {
    addLog(msg);
}

// --- Exposed function to update button states ---
eel.expose(update_buttons);
function update_buttons(state) {
    if (state === 'running') {
        startBtn.disabled = true;
        stopBtn.disabled = false;
    } else {
        startBtn.disabled = false;
        stopBtn.disabled = true;
    }
}

// ========== CONFIG LOAD / SAVE ==========

async function loadConfig() {
    try {
        const config = await eel.get_config()();
        if (config) {
            if (config.token) {
                tokenInput.value = config.token;
                tokenRealValue = config.token;
            }
            if (config.channels) channelsInput.value = config.channels;
            if (config.interval) intervalInput.value = config.interval;
            if (config.message) messageInput.value = config.message;
            console.log('✅ Config loaded from local storage.');
        }
    } catch (e) {
        console.log('ℹ️ No saved config found.');
    }
    // După încărcare, forțează starea ascunsă (puncte)
    tokenVisible = false;
    updateTokenDisplay();
}

function saveConfig() {
    eel.save_config_frontend(
        tokenRealValue,   // trimite tokenul real
        channelsInput.value,
        intervalInput.value,
        messageInput.value
    );
}

// ========== AUTO-SAVE ON KEYSTROKE (debounced) ==========

let saveTimeout;

function autoSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        console.log('💾 Auto-saving...');
        saveConfig();
    }, 400);
}

tokenInput.addEventListener('input', autoSave);
channelsInput.addEventListener('input', autoSave);
intervalInput.addEventListener('input', autoSave);
messageInput.addEventListener('input', autoSave);

// ========== START / STOP ==========

// --- Start button ---
startBtn.onclick = function() {
    const token = tokenRealValue;
    const channels = channelsInput.value;
    const interval = intervalInput.value;
    const message = messageInput.value;

    if (!token) { addLog('❌ Token is required'); return; }
    if (!channels) { addLog('❌ Channel IDs are required'); return; }
    if (!message.trim()) { addLog('❌ Message cannot be empty'); return; }

    eel.start_bot(token, channels, interval, message);
};

// --- Stop button ---
stopBtn.addEventListener('click', () => {
    addLog('⏹ Stopping...');
    eel.stop_bot();
});

// ========== LOAD ON STARTUP ==========
loadConfig();

// ========== GUIDE BUTTON ==========
document.getElementById('guideBtn').addEventListener('click', () => {
    document.getElementById('guidePopup').classList.add('show');
});

document.getElementById('closeGuideBtn').addEventListener('click', () => {
    document.getElementById('guidePopup').classList.remove('show');
});

document.getElementById('guidePopup').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        document.getElementById('guidePopup').classList.remove('show');
    }
});

console.log('✨ Ready with auto-save and token masking.');