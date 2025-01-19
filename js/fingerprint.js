// Browser Fingerprinting Utility
async function generateBrowserFingerprint() {
    try {
        const components = [
            navigator.userAgent,
            navigator.language,
            new Date().getTimezoneOffset(),
            screen.width,
            screen.height,
            screen.colorDepth,
            navigator.hardwareConcurrency,
            navigator.deviceMemory || '',
            navigator.platform,
            navigator.vendor,
            'canvas:' + await getCanvasFingerprint(),
            'audio:' + await getAudioFingerprint(),
            'webgl:' + await getWebGLFingerprint(),
            localStorage.getItem('persistent_id') || '' // Include any existing ID
        ];

        // Generate hash
        const text = components.join('|||');
        let hash = await sha256(text);
        
        // Store the hash persistently
        localStorage.setItem('persistent_id', hash);
        
        // Also store in a HTTP-only cookie for additional persistence
        document.cookie = `device_id=${hash}; path=/; max-age=31536000; SameSite=Strict; Secure`;
        
        return hash;
    } catch (error) {
        console.error('Error generating fingerprint:', error);
        const fallback = localStorage.getItem('persistent_id') || Date.now().toString(16);
        localStorage.setItem('persistent_id', fallback);
        return fallback;
    }
}

// Canvas fingerprinting
async function getCanvasFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 200;
    canvas.height = 200;
    
    // Draw various shapes and text
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125,1,62,20);
    ctx.fillStyle = "#069";
    ctx.fillText("Hello, world!", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("Hello, world!", 4, 17);
    
    return canvas.toDataURL();
}

// Audio fingerprinting
async function getAudioFingerprint() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const analyser = audioContext.createAnalyser();
        const gainNode = audioContext.createGain();
        const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
        
        return audioContext.sampleRate.toString();
    } catch (e) {
        return '';
    }
}

// WebGL fingerprinting
async function getWebGLFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return '';
        
        return [
            gl.getParameter(gl.VENDOR),
            gl.getParameter(gl.RENDERER),
            gl.getParameter(gl.VERSION)
        ].join(':::');
    } catch (e) {
        return '';
    }
}

// SHA-256 hashing function
async function sha256(text) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Check rate limit with multiple storage mechanisms
async function checkRateLimit() {
    const fingerprint = await generateBrowserFingerprint();
    
    // Check cookie first
    const cookieValue = document.cookie.split('; ').find(row => row.startsWith('lastSubmission_'))?.split('=')[1];
    
    // Check localStorage as backup
    const localStorageValue = localStorage.getItem(`lastSubmission_${fingerprint}`);
    
    const lastSubmission = cookieValue || localStorageValue;
    
    if (lastSubmission) {
        const timeDiff = Date.now() - parseInt(lastSubmission);
        const hoursLeft = Math.ceil((43200000 - timeDiff) / 3600000); // 12 hours in milliseconds
        
        if (timeDiff < 43200000) { // 12 hours in milliseconds
            throw new Error(`Please wait ${hoursLeft} hour(s) before sending another message.`);
        }
    }
    
    return fingerprint;
}

// Update submission time in all storage mechanisms
async function updateLastSubmission(fingerprint) {
    const timestamp = Date.now().toString();
    
    // Update cookie (HTTP-only, secure)
    document.cookie = `lastSubmission_${fingerprint}=${timestamp}; path=/; max-age=43200; SameSite=Strict; Secure`;
    
    // Update localStorage as backup
    localStorage.setItem(`lastSubmission_${fingerprint}`, timestamp);
}
