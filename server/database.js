const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ratelimit.db');
const db = new sqlite3.Database(dbPath);

// Initialize database
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS rate_limits (
            device_id TEXT PRIMARY KEY,
            last_attempt DATETIME DEFAULT CURRENT_TIMESTAMP,
            attempts INTEGER DEFAULT 1,
            ip_address TEXT,
            user_agent TEXT
        )
    `);
});

// Generate a unique device fingerprint
function generateDeviceFingerprint(req) {
    const components = [
        req.headers['user-agent'],
        req.ip,
        req.headers['accept-language']
    ];
    return Buffer.from(components.join('|')).toString('base64');
}

// Check if user can send message
async function checkRateLimitStatus(deviceId) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                last_attempt,
                attempts,
                ip_address,
                user_agent
            FROM rate_limits 
            WHERE device_id = ? 
            OR ip_address = (SELECT ip_address FROM rate_limits WHERE device_id = ?)
            OR user_agent = (SELECT user_agent FROM rate_limits WHERE device_id = ?)
            ORDER BY last_attempt DESC
            LIMIT 1
        `;
        
        db.get(query, [deviceId, deviceId, deviceId], (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            if (!row) {
                resolve(true);
                return;
            }

            const lastAttempt = new Date(row.last_attempt);
            const now = new Date();
            const timeDiffMs = now - lastAttempt;
            const hoursDiff = timeDiffMs / (1000 * 60 * 60);
            const cooldownHours = 12;

            if (hoursDiff >= cooldownHours) {
                resolve(true);
            } else {
                const remainingMs = (cooldownHours * 60 * 60 * 1000) - timeDiffMs;
                resolve({
                    allowed: false,
                    remainingMs: remainingMs,
                    remainingHours: remainingMs / (1000 * 60 * 60)
                });
            }
        });
    });
}

// Get remaining cooldown time
async function getRemainingCooldown(deviceId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT last_attempt, attempts FROM rate_limits WHERE device_id = ?`,
            [deviceId],
            (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!row) {
                    resolve(null);
                    return;
                }

                const lastAttempt = new Date(row.last_attempt);
                const now = new Date();
                const elapsedMs = now - lastAttempt;
                const cooldownMs = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
                const remainingMs = Math.max(0, cooldownMs - elapsedMs);

                if (remainingMs <= 0) {
                    // Clean up old entry if cooldown has expired
                    db.run(`DELETE FROM rate_limits WHERE device_id = ?`, [deviceId]);
                    resolve(null);
                } else {
                    resolve({
                        totalMs: remainingMs,
                        hours: Math.floor(remainingMs / (1000 * 60 * 60)),
                        minutes: Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60)),
                        seconds: Math.floor((remainingMs % (1000 * 60)) / 1000)
                    });
                }
            }
        );
    });
}

// Record an attempt with multiple identifiers
async function recordAttempt(req) {
    return new Promise((resolve, reject) => {
        const deviceId = req.body.deviceId || req.cookies.device_id;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];
        
        const query = `
            INSERT OR REPLACE INTO rate_limits (
                device_id,
                last_attempt,
                attempts,
                ip_address,
                user_agent
            ) VALUES (?, CURRENT_TIMESTAMP, COALESCE(
                (SELECT attempts + 1 FROM rate_limits WHERE device_id = ?),
                1
            ), ?, ?)
        `;
        
        db.run(query, [deviceId, deviceId, ipAddress, userAgent], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Clean up expired entries
function cleanupExpiredEntries() {
    const twelveHoursAgo = new Date(Date.now() - (12 * 60 * 60 * 1000));
    db.run(
        `DELETE FROM rate_limits WHERE last_attempt < ?`,
        [twelveHoursAgo.toISOString()]
    );
}

// Run cleanup every hour
setInterval(cleanupExpiredEntries, 60 * 60 * 1000);

// Graceful shutdown
process.on('SIGINT', () => {
    db.close(() => {
        process.exit(0);
    });
});

module.exports = {
    generateDeviceFingerprint,
    checkRateLimitStatus,
    getRemainingCooldown,
    recordAttempt
};
