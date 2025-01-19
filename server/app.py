from flask import Flask, request, jsonify
from flask_cors import CORS
import database
from datetime import datetime
import os

app = Flask(__name__)

# Configure CORS for your Render domain
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5500",  # Local development
            "https://srijal-portfolio.onrender.com",  # Render domain
            "https://sandeshbro-ux.github.io"  # GitHub Pages domain
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Initialize the database
database.init_db()

@app.route('/api/check-cooldown', methods=['POST'])
def check_cooldown():
    can_send, remaining_time = database.can_send_message(request)
    
    return jsonify({
        'canSend': can_send,
        'remainingTime': remaining_time * 1000  # Convert to milliseconds for JavaScript
    })

@app.route('/api/send-message', methods=['POST'])
def send_message():
    can_send, remaining_time = database.can_send_message(request)
    
    if not can_send:
        return jsonify({
            'success': False,
            'error': 'Please wait before sending another message',
            'remainingTime': remaining_time * 1000
        })
    
    # Update the cooldown timer for this user
    database.update_last_message_time(request)
    
    # Here you would handle the actual message sending
    # For now, we'll just return success
    return jsonify({
        'success': True,
        'message': 'Message sent successfully'
    })

if __name__ == '__main__':
    # Get port from environment variable (Render sets this)
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
