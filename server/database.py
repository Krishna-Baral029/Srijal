import sqlite3
from datetime import datetime, timedelta
import hashlib
import re
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_db_connection():
    """Create a database connection with proper error handling"""
    try:
        conn = sqlite3.connect('messages.db')
        conn.row_factory = sqlite3.Row  # Enable row factory for better data access
        return conn
    except sqlite3.Error as e:
        logger.error(f"Database connection error: {e}")
        raise

def init_db():
    """Initialize the database with proper error handling"""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS message_cooldowns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip_address TEXT NOT NULL,
                user_hash TEXT NOT NULL,
                last_message_time TIMESTAMP NOT NULL,
                attempt_count INTEGER DEFAULT 0,
                UNIQUE(ip_address),
                UNIQUE(user_hash)
            )
        ''')
        conn.commit()
        logger.info("Database initialized successfully")
    except sqlite3.Error as e:
        logger.error(f"Database initialization error: {e}")
        raise
    finally:
        if conn:
            conn.close()

def get_user_identifier(request):
    """
    Create a unique user identifier using multiple factors to prevent bypassing
    """
    try:
        # Get IP address (including X-Forwarded-For for proxy cases)
        ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        if ip:
            ip = ip.split(',')[0].strip()
        
        # Get browser fingerprint
        user_agent = request.headers.get('User-Agent', '')
        accept_language = request.headers.get('Accept-Language', '')
        accept_encoding = request.headers.get('Accept-Encoding', '')
        
        # Create a unique identifier combining multiple factors
        identifier = f"{ip}|{user_agent}|{accept_language}|{accept_encoding}"
        
        # Hash the identifier using SHA-256
        return hashlib.sha256(identifier.encode()).hexdigest()
    except Exception as e:
        logger.error(f"Error generating user identifier: {e}")
        # Return a temporary identifier if there's an error
        return hashlib.sha256(str(datetime.now()).encode()).hexdigest()

def is_valid_request(request):
    """
    Validate the request to prevent automated submissions
    """
    try:
        # Check if request has required headers
        if not request.headers.get('User-Agent'):
            logger.warning("Request rejected: No User-Agent header")
            return False
        
        # Check for common bot patterns
        user_agent = request.headers.get('User-Agent', '').lower()
        bot_patterns = ['bot', 'crawler', 'spider', 'http', 'curl', 'wget']
        if any(pattern in user_agent for pattern in bot_patterns):
            logger.warning(f"Request rejected: Bot pattern detected in User-Agent: {user_agent}")
            return False
        
        # Check for missing or suspicious headers
        required_headers = ['Accept', 'Accept-Language', 'Accept-Encoding']
        for header in required_headers:
            if not request.headers.get(header):
                logger.warning(f"Request rejected: Missing required header: {header}")
                return False
        
        return True
    except Exception as e:
        logger.error(f"Error validating request: {e}")
        return False

def is_valid_email(email):
    """Validate email format"""
    try:
        # Basic email validation using regex
        email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
        return bool(email_pattern.match(email))
    except Exception as e:
        logger.error(f"Error validating email: {e}")
        return False

def can_send_message(request):
    """Check if a user can send a message with proper error handling"""
    conn = None
    try:
        if not is_valid_request(request):
            logger.warning("Invalid request detected")
            return False, 43200  # 12 hours in seconds
        
        user_hash = get_user_identifier(request)
        ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        if ip:
            ip = ip.split(',')[0].strip()
        
        conn = get_db_connection()
        c = conn.cursor()
        
        # Check both IP and user hash
        c.execute('''
            SELECT last_message_time, attempt_count 
            FROM message_cooldowns 
            WHERE ip_address = ? OR user_hash = ?
        ''', (ip, user_hash))
        
        result = c.fetchone()
        
        if result:
            last_message_time = datetime.fromisoformat(result['last_message_time'])
            attempt_count = result['attempt_count']
            current_time = datetime.now()
            time_diff = current_time - last_message_time
            cooldown_period = timedelta(hours=12)
            
            # Increase cooldown if multiple attempts detected
            if attempt_count > 3:
                cooldown_period = timedelta(hours=24)  # Double cooldown for suspicious activity
                logger.warning(f"Extended cooldown applied for IP: {ip} due to multiple attempts")
            
            if time_diff < cooldown_period:
                remaining_time = (cooldown_period - time_diff).total_seconds()
                
                # Update attempt count
                c.execute('''
                    UPDATE message_cooldowns 
                    SET attempt_count = attempt_count + 1 
                    WHERE ip_address = ? OR user_hash = ?
                ''', (ip, user_hash))
                conn.commit()
                
                return False, int(remaining_time)
        
        return True, 0
        
    except Exception as e:
        logger.error(f"Error checking message permission: {e}")
        return False, 43200  # Default to 12-hour cooldown on error
    finally:
        if conn:
            conn.close()

def update_last_message_time(request):
    """Update the last message time with proper error handling"""
    conn = None
    try:
        user_hash = get_user_identifier(request)
        ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        if ip:
            ip = ip.split(',')[0].strip()
        
        conn = get_db_connection()
        c = conn.cursor()
        current_time = datetime.now().isoformat()
        
        # Update or insert for IP address
        c.execute('''
            INSERT INTO message_cooldowns (ip_address, user_hash, last_message_time, attempt_count)
            VALUES (?, ?, ?, 0)
            ON CONFLICT(ip_address) 
            DO UPDATE SET last_message_time = ?, attempt_count = 0
        ''', (ip, user_hash, current_time, current_time))
        
        # Update or insert for user hash
        c.execute('''
            INSERT INTO message_cooldowns (ip_address, user_hash, last_message_time, attempt_count)
            VALUES (?, ?, ?, 0)
            ON CONFLICT(user_hash) 
            DO UPDATE SET last_message_time = ?, attempt_count = 0
        ''', (ip, user_hash, current_time, current_time))
        
        conn.commit()
        logger.info(f"Successfully updated cooldown for IP: {ip}")
        
    except Exception as e:
        logger.error(f"Error updating message time: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()
