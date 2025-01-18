const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

// Create a new database in the server directory
const dbPath = path.join(__dirname, 'ratelimit.db');
const db = new sqlite3.Database(dbPath);

// Initialize the database with our rate limit table
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS rate_limits (
        device_id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        attempts INTEGER DEFAULT 0,
        last_ip TEXT,
        user_agent TEXT
    )`);
});

// Generate a device fingerprint
function generateDeviceFingerprint(req) {
    const components = [
        req.ip,
        req.headers['user-agent'] || '',
        req.headers['accept-language'] || '',
        req.headers['sec-ch-ua'] || '',
        req.headers['sec-ch-ua-platform'] || '',
        req.headers['sec-ch-ua-mobile'] || '',
        req.headers['x-forwarded-for'] || '',
        req.headers['x-real-ip'] || ''
    ];
    
    return crypto
        .createHash('sha256')
        .update(components.join('|'))
        .digest('hex');
}

// Check if a device can send a message
function checkRateLimit(deviceId) {
    return new Promise((resolve, reject) => {
        const now = Date.now();
        const cooldownHours = 12;
        const cooldownMs = cooldownHours * 60 * 60 * 1000;

        db.get(
            'SELECT * FROM rate_limits WHERE device_id = ?',
            [deviceId],
            (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!row) {
                    resolve({ 
                        canSend: true,
                        timeLeft: 0,
                        attempts: 0
                    });
                    return;
                }

                let timeLeft = (row.timestamp + cooldownMs) - now;
                
                // Add penalty time for multiple attempts
                if (row.attempts > 3) {
                    timeLeft += (row.attempts - 3) * 2 * 60 * 60 * 1000; // 2 hours per extra attempt
                }

                resolve({
                    canSend: timeLeft <= 0,
                    timeLeft: Math.max(0, timeLeft),
                    attempts: row.attempts
                });
            }
        );
    });
}

// Record a message attempt
function recordAttempt(req, success = true) {
    const deviceId = generateDeviceFingerprint(req);
    const now = Date.now();

    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO rate_limits (device_id, timestamp, attempts, last_ip, user_agent)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(device_id) DO UPDATE SET
             timestamp = CASE WHEN ? THEN ? ELSE timestamp END,
             attempts = attempts + 1,
             last_ip = ?,
             user_agent = ?`,
            [
                deviceId, now, 1, req.ip, req.headers['user-agent'] || '',
                success, now, req.ip, req.headers['user-agent'] || ''
            ],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

// Clean up expired rate limits
function cleanupRateLimits() {
    const now = Date.now();
    const cooldownMs = 12 * 60 * 60 * 1000;

    db.run(
        'DELETE FROM rate_limits WHERE timestamp < ? AND attempts < 4',
        [now - cooldownMs],
        (err) => {
            if (err) console.error('Error cleaning up rate limits:', err);
        }
    );
}

// Run cleanup every hour
setInterval(cleanupRateLimits, 60 * 60 * 1000);

module.exports = {
    generateDeviceFingerprint,
    checkRateLimit,
    recordAttempt,
    cleanupRateLimits
};
