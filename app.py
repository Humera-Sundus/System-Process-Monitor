import psutil
import getpass
import sys
import os
from io import BytesIO
import json
from flask import Flask, render_template, jsonify, request, send_file
from flask_cors import CORS
import mysql.connector
from datetime import datetime, timedelta
from main_script import kill_process, restart_process, get_visible_active_apps, enqueue_settings_update,get_monitor_settings,get_idle_time

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__)
CORS(app)  # Allow frontend to access backend API

# Database connection
def connect_db():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="password",
        database="process_db"
    )

@app.context_processor
def inject_request():
    return dict(request=request)

# Route to fetch all process logs
@app.route('/')
def homepage():
    user = getpass.getuser().capitalize()  # Get system username
    return render_template('dashboard.html', user=user)  
@app.route('/api/list-processes')
def list_processes():
    try:
        visible_apps = get_visible_active_apps()  # Fetch active processes
        current_user = getpass.getuser()
        
        print(f"Current User: {current_user}")
        print("[DEBUG] List of visible processes Flask can see:")
        
        for app in visible_apps:
            print(f"PID: {app['pid']} | Name: {app['name']} | Username: {app['username']}")

        return jsonify(visible_apps)  # Return all processes as JSON

    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route('/api/debug-processes', methods=['GET'])
def debug_processes():
    try:
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'username']):
            processes.append(proc.info)
        return jsonify(processes)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/processes', methods=['GET'])
def get_process_logs():
    try:
        db = connect_db()
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT * FROM process_logs ORDER BY timestamp DESC LIMIT 10")
        processes = cursor.fetchall()
        cursor.close()
        db.close()
        
        # Convert any non-serializable values to strings
        for proc in processes:
            for key, value in proc.items():
                if not isinstance(value, (str, int, float, bool, type(None))):
                    proc[key] = str(value)
                    
        return jsonify(processes)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/system-stats')
def system_stats():
    cpu_usage = psutil.cpu_percent(interval=1)
    memory_info = psutil.virtual_memory()
    memory_usage = memory_info.percent

    print(f"CPU Usage: {cpu_usage}%, Memory Usage: {memory_usage}%")  # Debugging

    return jsonify({
        'cpu_usage': cpu_usage,
        'memory_usage': memory_usage
    })
@app.route('/api/historical-system-stats', methods=['GET'])
def historical_stats():
    range_param = request.args.get('range', 'day')
    time_threshold = {
        'day': datetime.now() - timedelta(days=1),
        'week': datetime.now() - timedelta(weeks=1),
        'month': datetime.now() - timedelta(days=30),
    }.get(range_param, datetime.now() - timedelta(days=1))

    #print(f"Time threshold: {time_threshold}")  # Debug print
    #print(f"Time threshold type: {type(time_threshold)}")  # Debug print

    try:
        db = connect_db()
        cursor = db.cursor(dictionary=True)
        time_threshold_str = time_threshold.strftime('%Y-%m-%d %H:%M:%S')
        query = f"""
            SELECT 
                DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i:%s') as timestamp,
                cpu_percent, 
                memory_percent
            FROM system_logs
            WHERE timestamp >= '{time_threshold_str}'
            ORDER BY timestamp
        """
        cursor.execute(query)
    
        results = cursor.fetchall()
        cursor.close()
        db.close()
        
        if not results:
            return jsonify([{
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'cpu_percent': 0,
                'memory_percent': 0
            }])
            
        return jsonify(results)
    except Exception as e:
        print(f"Detailed error: {str(e)}") 
        return jsonify({"error": str(e)}), 500

@app.route('/api/resource-intensive-processes', methods=['GET'])
def resource_intensive_processes():
    try:
        db = connect_db()
        cursor = db.cursor(dictionary=True)
        # grab the top 10 CPU-hogging entries from your system_logs
        cursor.execute("""
            SELECT 
              process_name,
              pid,
              cpu_percent AS cpu_usage,
              memory_percent AS memory_usage
            FROM system_logs
            ORDER BY cpu_percent DESC
            LIMIT 10
        """)
        rows = cursor.fetchall()
        cursor.close()
        db.close()
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route('/api/idle-time', methods=['GET'])
def get_idle_time_logs():
    try:
        db = connect_db()
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT * FROM idle_time_logs ORDER BY timestamp DESC LIMIT 10")
        idle_times = cursor.fetchall()
        cursor.close()
        db.close()
    
        for item in idle_times:
            for key, value in item.items():
                if not isinstance(value, (str, int, float, bool, type(None))):
                    item[key] = str(value)
                    
        return jsonify(idle_times)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/idle-dashboard', methods=['GET'])
def get_latest_idle_time():
    try:
        db = connect_db()
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT idle_seconds FROM idle_time_logs ORDER BY timestamp DESC LIMIT 1")
        result = cursor.fetchone()
        cursor.close()
        db.close()

        if result:
            idle_minutes = round(result['idle_seconds'] / 60, 1)  # convert to minutes
            return jsonify({'latest_idle_min': idle_minutes})
        else:
            return jsonify({'latest_idle_min': 0})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/kill-process', methods=['POST'])
def kill_process_route():
    try:
        data = request.json
        process_name = data.get('process_name')
        current_user = getpass.getuser()
        print(f"Received request to kill process: {process_name}")  


        if not process_name:
            return jsonify({"error": "Process name is required"}), 400
        print(f"Received request to kill process: {process_name}")
        print(f"Current User (Flask): {current_user}")

        result = kill_process(process_name)
        print(f" Result: {result}")
        return jsonify({"message": f"Attempted to kill process: {process_name}", "result": result}), 200
    except Exception as e:
        print(f"⚠️ Error in /api/kill-process: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/restart-process', methods=['POST'])
def restart_process_route():
    try:
        data = request.json
        process_name = data.get('process_name')

        if not process_name:
            return jsonify({"error": "Process name is required"}), 400

        result = restart_process(process_name)
        return jsonify({"message": f"Attempted to restart process: {process_name}", "result": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Route to get active processes directly (not from DB)
@app.route('/api/active-processes', methods=['GET'])
def get_active_processes():
    try:
        active_processes = get_visible_active_apps()
        
        # Convert any non-serializable values to strings
        for proc in active_processes:
            for key, value in proc.items():
                if not isinstance(value, (str, int, float, bool, type(None))):
                    proc[key] = str(value)
        
        return jsonify(active_processes)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/export-system-status', methods=['GET'])
def export_system_status():
    cpu = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory().percent
    idle_time = get_idle_time()

    # Get thresholds from DB
    settings = get_monitor_settings()
    cpu_threshold = settings.get("cpu_threshold", 80)
    memory_threshold = settings.get("memory_threshold", 75)

    # Build the JSON response
    export_data = {
        "cpu_usage_percent": cpu,
        "memory_usage_percent": memory,
        "idle_time_seconds": idle_time,
        "thresholds": {
            "cpu_threshold": cpu_threshold,
            "memory_threshold": memory_threshold
        },
        "threshold_exceeded": {
            "cpu_exceeded": cpu > cpu_threshold,
            "memory_exceeded": memory > memory_threshold
        },
        "exported_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    # Create file-like object from JSON
    json_str = json.dumps(export_data, indent=2)
    buffer = BytesIO(json_str.encode('utf-8'))
    buffer.seek(0)

    return send_file(
        buffer,
        mimetype='application/json',
        as_attachment=True,
        download_name='system_status_export.json'

    )


@app.route('/export-data', methods=['POST'])
def export_data():
    data = request.json  # JSON from the frontend
    filename = "process_monitor_export.json"
    
    downloads_dir = os.path.join(os.path.expanduser("~"), "Downloads")
    os.makedirs(downloads_dir, exist_ok=True)
    file_path = os.path.join(downloads_dir, filename)

    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    return jsonify({'success': True, 'filePath': file_path})

@app.route('/clear-all-data', methods=['POST'])
def clear_all_data():
    try:
        conn = mysql.connector.connect(
            host='localhost',
            user='root',
            password='15374826',
            database='process_db'
        )
        cursor = conn.cursor()

        # Delete data from both tables
        cursor.execute("DELETE FROM idle_time_logs")
        cursor.execute("DELETE FROM system_logs")
        cursor.execute("DELETE FROM process_logs")
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({'success': True, 'message': 'All monitoring data deleted successfully.'})
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})




@app.route('/api/settings', methods=['GET'])
def get_settings():
    try:
        # Fetch monitor settings from the database
        settings = get_monitor_settings()

        # Fetch blacklisted processes from the database
        db = connect_db()
        cursor = db.cursor()
        cursor.execute("SELECT process_name FROM blacklisted_processes")
        rows = cursor.fetchall()
        cursor.close()
        db.close()

        # Get the blacklist as a list
        blacklist = [row[0] for row in rows]

        # Combine settings and blacklist into one response
        response = {
            'settings': settings,    # CPU, memory thresholds, refresh interval
            'blacklist': blacklist   # List of blacklisted processes
        }

        return jsonify(response), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/settings', methods=['POST'])
def save_settings():
    try:
        payload = request.get_json()

        # — General Settings —
        if any(key in payload for key in ('theme', 'refresh_interval', 'email_notify')):
            enqueue_settings_update('general', {
                'theme': payload.get('theme'),
                'refresh_interval': payload.get('refresh_interval'),
                'email_notify': payload.get('email_notify')
            })

        # — Process Settings —
        elif any(key in payload for key in ('cpu_threshold', 'memory_threshold', 'process_blacklist')):
            enqueue_settings_update('process', {
                'cpu_threshold': payload.get('cpu_threshold'),
                'memory_threshold': payload.get('memory_threshold'),
                'process_blacklist': payload.get('process_blacklist')
            })

        # — Data Management Settings —
        elif 'auto_cleanup_days' in payload:
            enqueue_settings_update('data', {
                'auto_cleanup_days': payload.get('auto_cleanup_days')
            })

        else:
            return jsonify({'error': 'No valid settings fields found'}), 400

        return jsonify({'message': 'Settings update enqueued'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/blacklist', methods=['GET'])
def get_blacklist():
    try:
        db = connect_db()
        cursor = db.cursor()
        cursor.execute("SELECT process_name FROM blacklisted_processes")
        rows = cursor.fetchall()
        cursor.close()
        db.close()

        blacklist = [row[0] for row in rows]
        return jsonify({'blacklist': blacklist})
    except Exception as e:
        return jsonify({'error': str(e)}), 500



@app.route('/historical-trends')
def historical_trends():
    return render_template('historical_trends.html')

@app.route('/idle-time')
def idle_time():
    return render_template('idle_time.html')

@app.route('/settings')
def settings():
    return render_template('settings.html')

if __name__ == '__main__':
   
    app.run(host='0.0.0.0', port=5000, debug=False,use_reloader=False)
