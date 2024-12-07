from flask import Flask, render_template, jsonify, request, redirect, url_for, session
from flask_socketio import SocketIO, emit
import websocket
import json
import threading
import time
from collections import deque
import datetime
import webbrowser
import os
from functools import wraps
import secrets
import eventlet

eventlet.monkey_patch()

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)
socketio = SocketIO(app, async_mode='eventlet', cors_allowed_origins="*", logger=True, engineio_logger=True)

# Authentication credentials
USERNAME = "Bijibiji"
PASSWORD = "Smilebright@work"

# Login required decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Store last 20 digits for each market
market_data = {
    'R_10': {'digits': deque(maxlen=20), 'prices': deque(maxlen=20)},
    'R_25': {'digits': deque(maxlen=20), 'prices': deque(maxlen=20)},
    'R_50': {'digits': deque(maxlen=20), 'prices': deque(maxlen=20)},
    'R_75': {'digits': deque(maxlen=20), 'prices': deque(maxlen=20)},
    'R_100': {'digits': deque(maxlen=20), 'prices': deque(maxlen=20)},
    '1HZ10V': {'digits': deque(maxlen=20), 'prices': deque(maxlen=20)},
    '1HZ25V': {'digits': deque(maxlen=20), 'prices': deque(maxlen=20)},
    '1HZ50V': {'digits': deque(maxlen=20), 'prices': deque(maxlen=20)},
    '1HZ75V': {'digits': deque(maxlen=20), 'prices': deque(maxlen=20)},
    '1HZ100V': {'digits': deque(maxlen=20), 'prices': deque(maxlen=20)}
}

# WebSocket connection
ws = None

def on_ws_message(ws, message):
    data = json.loads(message)
    if data.get('msg_type') == 'tick':
        tick = data.get('tick', {})
        symbol = tick.get('symbol')
        price = tick.get('quote')
        
        if symbol and price and symbol in market_data:
            last_digit = int(str(price).split('.')[-1][-1])
            market_data[symbol]['digits'].append(last_digit)
            market_data[symbol]['prices'].append(price)
            
            socketio.emit('market_update', {
                'symbol': symbol,
                'price': price,
                'last_digit': last_digit,
                'digit_history': list(market_data[symbol]['digits']),
                'analysis': analyze_digits(symbol),
                'timestamp': datetime.datetime.now().strftime('%H:%M:%S')
            })

def analyze_digits(symbol):
    if symbol not in market_data or not market_data[symbol]['digits']:
        return None
        
    digits = list(market_data[symbol]['digits'])
    analysis = {}
    
    for target_digit in range(10):
        higher_count = sum(1 for d in digits if d > target_digit)
        lower_count = sum(1 for d in digits if d < target_digit)
        equal_count = sum(1 for d in digits if d == target_digit)
        total = len(digits)
        
        analysis[target_digit] = {
            'higher_prob': (higher_count / total) * 100 if total > 0 else 0,
            'lower_prob': (lower_count / total) * 100 if total > 0 else 0,
            'equal_prob': (equal_count / total) * 100 if total > 0 else 0,
            'higher_count': higher_count,
            'lower_count': lower_count,
            'equal_count': equal_count
        }
    
    return analysis

def connect_websocket():
    global ws
    websocket.enableTrace(False)
    ws = websocket.WebSocketApp(
        "wss://ws.binaryws.com/websockets/v3?app_id=1089",
        on_message=on_ws_message,
        on_error=lambda ws, error: connect_websocket(),
        on_close=lambda ws, code, msg: connect_websocket(),
        on_open=lambda ws: [ws.send(json.dumps({"ticks": symbol, "subscribe": 1})) for symbol in market_data.keys()]
    )
    wst = threading.Thread(target=ws.run_forever)
    wst.daemon = True
    wst.start()

@app.route('/')
def root():
    if 'logged_in' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'logged_in' in session:
        return redirect(url_for('dashboard'))
        
    error = None
    if request.method == 'POST':
        if request.form['username'] == USERNAME and request.form['password'] == PASSWORD:
            session['logged_in'] = True
            session.permanent = True  # Make session persistent
            return redirect(url_for('dashboard'))
        else:
            error = 'Invalid credentials. Please try again.'
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.clear()  # Clear all session data
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    return render_template('dashboard.html')

if __name__ == '__main__':
    # Start WebSocket connection
    connect_websocket()
    
    if os.environ.get('RENDER'):
        # Running on Render.com
        socketio.run(app)
    else:
        # Running locally
        socketio.run(app, host='0.0.0.0', port=5000, debug=True)
