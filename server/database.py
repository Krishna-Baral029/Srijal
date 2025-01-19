import sqlite3
from datetime import datetime, timedelta
import hashlib
import re

def init_db():
    conn = sqlite3.connect('messages.db')
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
    conn.close()

def get_user_identifier(request):
    """
    Create a unique user identifier using multiple factors to prevent bypassing
    """
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
    
    # Hash the identifier
    return hashlib.sha256(identifier.encode()).hexdigest()

def is_valid_request(request):
    """
    Validate the request to prevent automated submissions
    """
    # Check if request has required headers
    if not request.headers.get('User-Agent'):
        return False
        
    # Check for common bot patterns
    user_agent = request.headers.get('User-Agent', '').lower()
    bot_patterns = ['bot', 'crawler', 'spider', 'http', 'curl', 'wget']
    if any(pattern in user_agent for pattern in bot_patterns):
        return False
    
    # Check for missing or suspicious headers
    required_headers = ['Accept', 'Accept-Language', 'Accept-Encoding']
    for header in required_headers:
        if not request.headers.get(header):
            return False
    
    return True

def can_send_message(request):
    if not is_valid_request(request):
        return False, 43200  # 12 hours in seconds
        
    user_hash = get_user_identifier(request)
    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    if ip:
        ip = ip.split(',')[0].strip()
    
    conn = sqlite3.connect('messages.db')
    c = conn.cursor()
    
    try:
        # Check both IP and user hash
        c.execute('''
            SELECT last_message_time, attempt_count 
            FROM message_cooldowns 
            WHERE ip_address = ? OR user_hash = ?
        ''', (ip, user_hash))
        
        result = c.fetchone()
        
        if result:
            last_message_time, attempt_count = result
            last_message_time = datetime.fromisoformat(last_message_time)
            current_time = datetime.now()
            time_diff = current_time - last_message_time
            cooldown_period = timedelta(hours=12)
            
            # Increase cooldown if multiple attempts detected
            if attempt_count > 3:
                cooldown_period = timedelta(hours=24)  # Double cooldown for suspicious activity
            
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
        
    finally:
        conn.close()

def update_last_message_time(request):
    user_hash = get_user_identifier(request)
    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    if ip:
        ip = ip.split(',')[0].strip()
    
    conn = sqlite3.connect('messages.db')
    c = conn.cursor()
    current_time = datetime.now().isoformat()
    
    try:
        c.execute('''
            INSERT INTO message_cooldowns (ip_address, user_hash, last_message_time, attempt_count)
            VALUES (?, ?, ?, 0)
            ON CONFLICT(ip_address) 
            DO UPDATE SET last_message_time = ?, attempt_count = 0
        ''', (ip, user_hash, current_time, current_time))
        
        c.execute('''
            INSERT INTO message_cooldowns (ip_address, user_hash, last_message_time, attempt_count)
            VALUES (?, ?, ?, 0)
            ON CONFLICT(user_hash) 
            DO UPDATE SET last_message_time = ?, attempt_count = 0
        ''', (ip, user_hash, current_time, current_time))
        
        conn.commit()
    finally:
        conn.close()
