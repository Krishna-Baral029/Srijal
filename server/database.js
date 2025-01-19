const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'ratelimit.db');
const db = new sqlite3.Database(dbPath);

// Initialize database with IP-based rate limiting table
db.serialize(() => {
    // Drop existing table to ensure clean slate
    db.run(`DROP TABLE IF EXISTS rate_limits`);
    
    // Create new table focused on IP-based rate limiting
    db.run(`
        CREATE TABLE IF NOT EXISTS rate_limits (
            ip_address TEXT PRIMARY KEY,
            last_attempt DATETIME DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
            attempts INTEGER DEFAULT 1
        )
    `);
    
    // Create index for faster lookups
    db.run(`CREATE INDEX IF NOT EXISTS idx_ip_last_attempt ON rate_limits(ip_address, last_attempt)`);
});

// Check if IP can send message
async function checkRateLimitStatus(ipAddress) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                last_attempt,
                attempts,
                strftime('%s', 'now') - strftime('%s', last_attempt) as seconds_elapsed
            FROM rate_limits 
            WHERE ip_address = ?
        `;
        
        db.get(query, [ipAddress], (err, row) => {
            if (err) {
                console.error('Database error:', err);
                reject(err);
                return;
            }

            if (!row) {
                resolve({ allowed: true });
                return;
            }

            const cooldownHours = 12;
            const cooldownSeconds = cooldownHours * 60 * 60;
            const secondsElapsed = row.seconds_elapsed;
            
            if (secondsElapsed >= cooldownSeconds) {
                resolve({ allowed: true });
            } else {
                const remainingSeconds = cooldownSeconds - secondsElapsed;
                const remainingMs = remainingSeconds * 1000;
                const remainingHours = Math.floor(remainingSeconds / 3600);
                const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);
                const remainingSecondsDisplay = Math.floor(remainingSeconds % 60);
                
                resolve({
                    allowed: false,
                    remainingMs,
                    remainingHours,
                    remainingMinutes,
                    remainingSeconds: remainingSecondsDisplay
                });
            }
        });
    });
}

// Record an attempt from an IP
async function recordAttempt(ipAddress) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT OR REPLACE INTO rate_limits (
                ip_address,
                last_attempt,
                attempts
            ) VALUES (?, strftime('%Y-%m-%d %H:%M:%f', 'now'), COALESCE(
                (SELECT attempts + 1 FROM rate_limits WHERE ip_address = ?),
                1
            ))
        `;
        
        db.run(query, [ipAddress, ipAddress], (err) => {
            if (err) {
                console.error('Database error:', err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

// Clean up expired entries (older than 12 hours)
async function cleanupExpiredEntries() {
    return new Promise((resolve, reject) => {
        const query = `
            DELETE FROM rate_limits 
            WHERE strftime('%s', 'now') - strftime('%s', last_attempt) >= ?
        `;
        
        const cooldownSeconds = 12 * 60 * 60; // 12 hours in seconds
        
        db.run(query, [cooldownSeconds], (err) => {
            if (err) {
                console.error('Database error:', err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

// Get remaining cooldown time for an IP
async function getRemainingCooldown(ipAddress) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                last_attempt,
                attempts
            FROM rate_limits 
            WHERE ip_address = ?
        `;
        
        db.get(query, [ipAddress], (err, row) => {
            if (err) {
                console.error('Database error:', err);
                reject(err);
                return;
            }

            if (!row) {
                resolve({ allowed: true, remainingMs: 0 });
                return;
            }

            const lastAttempt = new Date(row.last_attempt);
            const now = new Date();
            const timeDiffMs = now - lastAttempt;
            const cooldownHours = 12;
            const cooldownMs = cooldownHours * 60 * 60 * 1000;

            if (timeDiffMs >= cooldownMs) {
                resolve({ allowed: true, remainingMs: 0 });
            } else {
                const remainingMs = cooldownMs - timeDiffMs;
                resolve({
                    allowed: false,
                    remainingMs: remainingMs,
                    remainingHours: remainingMs / (1000 * 60 * 60)
                });
            }
        });
    });
}

// Run cleanup every hour
setInterval(cleanupExpiredEntries, 60 * 60 * 1000);

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});

module.exports = {
    checkRateLimitStatus,
    recordAttempt,
    cleanupExpiredEntries,
    getRemainingCooldown
};
