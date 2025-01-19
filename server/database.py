import sqlite3
from datetime import datetime, timedelta
import hashlib

def init_db():
    conn = sqlite3.connect('messages.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS message_cooldowns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_address TEXT NOT NULL,
            last_message_time TIMESTAMP NOT NULL,
            UNIQUE(ip_address)
        )
    ''')
    conn.commit()
    conn.close()

def get_user_identifier(request):
    # Use IP address and basic browser info to identify unique users
    ip = request.remote_addr
    user_agent = request.headers.get('User-Agent', '')
    identifier = f"{ip}_{user_agent}"
    return hashlib.md5(identifier.encode()).hexdigest()

def can_send_message(request):
    user_id = get_user_identifier(request)
    conn = sqlite3.connect('messages.db')
    c = conn.cursor()
    
    c.execute('SELECT last_message_time FROM message_cooldowns WHERE ip_address = ?', (user_id,))
    result = c.fetchone()
    
    if result is None:
        conn.close()
        return True, 0
    
    last_message_time = datetime.fromisoformat(result[0])
    current_time = datetime.now()
    time_diff = current_time - last_message_time
    cooldown_period = timedelta(hours=12)
    
    if time_diff >= cooldown_period:
        conn.close()
        return True, 0
    
    remaining_time = (cooldown_period - time_diff).total_seconds()
    conn.close()
    return False, int(remaining_time)

def update_last_message_time(request):
    user_id = get_user_identifier(request)
    conn = sqlite3.connect('messages.db')
    c = conn.cursor()
    current_time = datetime.now().isoformat()
    
    c.execute('''
        INSERT INTO message_cooldowns (ip_address, last_message_time)
        VALUES (?, ?)
        ON CONFLICT(ip_address) 
        DO UPDATE SET last_message_time = ?
    ''', (user_id, current_time, current_time))
    
    conn.commit()
    conn.close()
