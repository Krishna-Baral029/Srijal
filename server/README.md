# Contact Form Server

This server handles the cooldown timer for the contact form. It ensures that each user can only send one message every 12 hours, regardless of which device they use.

## Setup

1. Install Python 3.7 or higher if not already installed

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Start the server:
```bash
python app.py
```

The server will run on `http://localhost:5000`

## How it works

- Uses SQLite database to store user message timestamps
- Each user gets a unique ID stored in their browser's localStorage
- The server tracks the last message time for each user
- Enforces a 12-hour cooldown period between messages
- Works across different devices for the same user ID
