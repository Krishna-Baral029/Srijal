from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_mail import Mail, Message
import database
from datetime import datetime
import os
from functools import wraps
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Mail configuration
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.getenv('EMAIL_USER')
app.config['MAIL_PASSWORD'] = os.getenv('EMAIL_PASS')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('EMAIL_USER')

mail = Mail(app)

# Security headers
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    return response

# Configure CORS with strict options
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5500",
            "https://srijal-portfolio.onrender.com",
            "https://sandeshbro-ux.github.io"
        ],
        "methods": ["POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "max_age": 3600,
        "supports_credentials": True
    }
})

# Rate limiting decorator
def rate_limit(limit=5, window=60):
    def decorator(f):
        # Store last request times per IP
        requests = {}
        
        @wraps(f)
        def wrapped(*args, **kwargs):
            # Get real IP, considering proxies
            ip = request.headers.get('X-Forwarded-For', request.remote_addr)
            if ip:
                ip = ip.split(',')[0].strip()
            
            # Get current time
            now = time.time()
            
            # Initialize request list for this IP
            if ip not in requests:
                requests[ip] = []
            
            # Remove old requests
            requests[ip] = [req_time for req_time in requests[ip] if now - req_time < window]
            
            # Check if rate limit is exceeded
            if len(requests[ip]) >= limit:
                return jsonify({
                    'success': False,
                    'error': 'Too many requests. Please try again later.',
                    'remainingTime': window - (now - requests[ip][0])
                }), 429
            
            # Add current request
            requests[ip].append(now)
            
            return f(*args, **kwargs)
        return wrapped
    return decorator

# Initialize the database
database.init_db()

@app.route('/api/check-cooldown', methods=['POST'])
@rate_limit(limit=10, window=60)  # 10 requests per minute
def check_cooldown():
    can_send, remaining_time = database.can_send_message(request)
    
    return jsonify({
        'canSend': can_send,
        'remainingTime': remaining_time * 1000
    })

@app.route('/api/send-message', methods=['POST'])
@rate_limit(limit=5, window=60)  # 5 requests per minute
def send_message():
    # Validate request body
    if not request.is_json:
        return jsonify({
            'success': False,
            'error': 'Invalid request format'
        }), 400
    
    data = request.get_json()
    required_fields = ['name', 'email', 'message']
    
    if not all(field in data for field in required_fields):
        return jsonify({
            'success': False,
            'error': 'Missing required fields'
        }), 400
    
    # Check message length
    if len(data['message']) > 1000:  # Limit message length
        return jsonify({
            'success': False,
            'error': 'Message too long'
        }), 400
    
    can_send, remaining_time = database.can_send_message(request)
    
    if not can_send:
        return jsonify({
            'success': False,
            'error': 'Please wait before sending another message',
            'remainingTime': remaining_time * 1000
        })
    
    try:
        # Send email
        msg = Message(
            subject=f"New Portfolio Message from {data['name']}",
            recipients=[os.getenv('EMAIL_USER')],
            body=f"""
            New message from your portfolio website:
            
            Name: {data['name']}
            Email: {data['email']}
            
            Message:
            {data['message']}
            """
        )
        mail.send(msg)
        
        # Update the cooldown timer for this user
        database.update_last_message_time(request)
        
        return jsonify({
            'success': True,
            'message': 'Message sent successfully'
        })
        
    except Exception as e:
        app.logger.error(f"Error sending email: {e}")
        return jsonify({
            'success': False,
            'error': 'Error sending message. Please try again.'
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
