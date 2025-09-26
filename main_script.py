import psutil
import win32gui
import win32process
import mysql.connector
import time 
import datetime
import os
import json
import getpass
import ctypes
import threading 
import schedule
from contextlib import contextmanager
from Google_API import create_service
from gmail_api import init_gmail_service,send_email
import logging
from queue import Queue
logging.basicConfig(filename='monitor.log', level=logging.INFO, format='%(asctime)s - %(message)s')

last_cleanup_time=None
def connect_db():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="password",
        database="process_db"
    )
@contextmanager
def get_db_cursor(dictionary=False):
    conn = connect_db()
    try:
        cursor = conn.cursor(dictionary=dictionary)
        yield cursor
        conn.commit()
    finally:
        cursor.close()
        conn.close()

def display_usage(cpu_usage,mem_usage,bars=50):
    
    cpu_percent = (cpu_usage/100.0)
    
    cpu_bar = "▊" * int(cpu_percent*bars) + "-"  * (bars-int(cpu_percent*bars))
    
    mem_percent = (mem_usage/100.0)
    mem_bar = "▊" * int(mem_percent*bars) + "-" *(bars-int(mem_percent*bars))
    
    print(f"\r CPU Usage: | |{cpu_bar}| {cpu_usage:.2f}%" ,end=" ")
    print(f" Memory Usage: | |{mem_bar}| {mem_usage:.2f}%" ,end="\r")

def log_system_stats(cpu_usage, mem_usage):
    try:
        timestamp = datetime.datetime.now()
        with get_db_cursor() as cursor:


            query = "INSERT INTO system_logs (cpu_percent, memory_percent, timestamp) VALUES (%s, %s, %s)"
            cursor.execute(query, (cpu_usage, mem_usage, timestamp))

            print(f" [Logged] CPU: {cpu_usage:.2f}%, Memory: {mem_usage:.2f}%")
    except Exception as e:
        print(f"[Error Logging System Stats] {e}")
        
def monitor_and_log_system_usage():
    cpu_usage = psutil.cpu_percent(interval=1)
    mem_usage = psutil.virtual_memory().percent

    display_usage(cpu_usage, mem_usage)       
    log_system_stats(cpu_usage, mem_usage) 
    generate_system_status_json(cpu_usage,mem_usage)
    


def generate_system_status_json(cpu,memory):
    with get_db_cursor() as cursor:

        cursor.execute("SELECT cpu_threshold, memory_threshold FROM monitor_settings WHERE id = 1")
        row = cursor.fetchone()
        cpu_thresh, mem_thresh = row if row else (80, 75)

        # Get current stats
        cpu_percent = cpu
        memory_percent = memory

        # Prepare data
        export_data = {
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "cpu_status": f"High CPU: {cpu:.1f}% (limit {cpu_thresh}%)" if cpu > cpu_thresh else f"Normal CPU: {cpu:.1f}%",
            "memory_status": f"High Memory: {memory:.1f}% (limit {mem_thresh}%)" if memory > mem_thresh else f"Normal Memory: {memory:.1f}%",
            "cpu_percent": cpu_percent,
            "memory_percent": memory_percent
        }

        # Save JSON
        os.makedirs("export", exist_ok=True)
        file_path = os.path.join("export", "system_status.json")
        with open(file_path, "w") as f:
            json.dump(export_data, f, indent=4)

        
    return file_path



def get_visible_active_apps():
    visible_apps = []
    current_user = getpass.getuser()

    def callback(hwnd, process_pids):
        if win32gui.IsWindowVisible(hwnd): # Check if window is visible
            placement = win32gui.GetWindowPlacement(hwnd) 
            if placement[1] == 2:  # Check if window is minimized
                return
            _, found_pid = win32process.GetWindowThreadProcessId(hwnd)
            if found_pid in process_pids:
                process_pids[found_pid] = True # Mark process as having an active visible window
    # Get all running processes
    process_pids = {proc.info['pid']: False for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent','username'])}
   
    # Enumerate through all windows and mark visible, non-minimized ones
    win32gui.EnumWindows(callback, process_pids)
    # Get the PID of the foreground window (the one in focus)
    foreground_hwnd = win32gui.GetForegroundWindow()
    _, foreground_pid = win32process.GetWindowThreadProcessId(foreground_hwnd)

    # Filter out only those with an active, visible window that are not minimized or in the background
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent','username']):
        if process_pids.get(proc.info['pid'], False):
            if proc.info['pid'] != foreground_pid:
                visible_apps.append(proc.info)

    return visible_apps

def log_processes_to_db():
    global last_cleanup_time
    print("Logging processes to the database...")
    try:
    
        with get_db_cursor() as cursor:
    
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS process_logs(
                id INT AUTO_INCREMENT PRIMARY KEY,
                timestamp DATETIME,
                pid INT,
                process_name VARCHAR(225),
                cpu_usage FLOAT,
                memory_usage FLOAT,
                username VARCHAR(225))"""
            )

            # Display Running Active GUI Applications
            running_apps = get_visible_active_apps()



            if running_apps:
                insert_query="""INSERT INTO process_logs(timestamp,pid,process_name,cpu_usage,memory_usage,username)VALUES(NOW(),%s,%s,%s,%s,%s)"""
                process_data=[(app['pid'],app['name'],app['cpu_percent'],app['memory_percent'],app['username'])for app in running_apps]
                if process_data:
                    cursor.executemany(insert_query,process_data)
                    
                    print(f"Inserted {len(process_data)} rows.\n")
                else:
                    print("No running applications to log.")
                

                print(f"\n{'PID':<10} {'Name':<30} {'CPU (%)':<10} {'Memory (%)':<10} {'Username' : <30}")
                print("=" * 65)
                if running_apps:
                    for app in running_apps:
                        print(f"{app['pid']:<10} {app['name']:<30} {app['cpu_percent']:<10.2f} {app['memory_percent']:<10.2f} {app['username']:<30}")
                else:
                    print("No visible applications are currently running.")
    except Exception as e:
            print(f"Error in logging processes to database. {e}")

def clean_old_process_logs():
    """Deletes process logs older than 7 days."""
    try:
        with get_db_cursor() as cursor:

        # Delete logs older than 7 days
            delete_query = "DELETE FROM process_logs WHERE timestamp < NOW() - INTERVAL 7 DAY"
            cursor.execute(delete_query)
            print("\n Old process logs deleted (cleanup every 7 days).")

    except Exception as e:
        print(f"Error in cleaning up old logs: {e}")


        
def send_email_to_user():
    settings_path = os.path.join(os.path.expanduser("~"), "Downloads", "process_monitor_export.json")

    if not os.path.exists(settings_path):
        print("Settings file not found. Skipping email.")
        return

    with open(settings_path, 'r') as f:
        settings = json.load(f)

    # Check if enableNotifications is true (can be a boolean or string based on how it's saved)
    is_enabled = settings.get("settings", {}).get("enableNotifications", False)
    if not is_enabled or str(is_enabled).lower() != "true":
        print("Email notifications disabled. Skipping email.")
        return

    else:
        print("\nSending Email..\n")
        try:
        
            client_file = "client_secret.json"
            service = init_gmail_service(client_file)
            to_address = "reciever's email"
            email_subject = "System Status Report"
            email_body="Please find the attached system status report in JSON format."
            cpu_usage = psutil.cpu_percent(interval=1)
            mem_usage = psutil.virtual_memory().percent
            json_file_path = generate_system_status_json(cpu_usage,mem_usage)

            response_email_sent=send_email(
                service,
                to_address,
                email_subject,
                email_body,
                body_type='plain',
                attachment_paths=[json_file_path]
            )
            print(response_email_sent)
        except Exception as e:
            print(f"Error in sending email: {e}")


def create_table():
    with get_db_cursor() as cursor:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS idle_time_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                timestamp DATETIME NOT NULL,
                idle_seconds INT NOT NULL
            )
        """)
# Insert idle time into database
def log_idle_time(idle_seconds):
    with get_db_cursor() as cursor:
        query = "INSERT INTO idle_time_logs (timestamp, idle_seconds) VALUES (%s, %s)"
        values = (datetime.datetime.now(), idle_seconds)
        cursor.execute(query, values)

# Idle Time Tracking Class
class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]

def get_idle_time():
    """Returns the idle time in seconds."""
    lii = LASTINPUTINFO()
    lii.cbSize = ctypes.sizeof(LASTINPUTINFO)

    if ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lii)):
        millis_since_last_input = ctypes.windll.kernel32.GetTickCount() - lii.dwTime
       # print(f"Millis since last input: {millis_since_last_input}")
        return millis_since_last_input / 1000  # Convert to seconds
    else:
        return 0

# Function to track idle time in a separate thread
def track_idle_time():
    idle_threshold = 300  # 5 minutes
    create_table()  # Ensure table exists

    was_idle = False
    idle_start_time = None  # Store the time when idle started

    while True:
        idle_time = get_idle_time()

        if idle_time >= idle_threshold and not was_idle:
            # User just became idle
            was_idle = True
            idle_start_time = time.time()  # Store actual system time when idle started
            logging.info(f"Idle time logged: {idle_time} seconds")

            print("User is now idle...")

        elif idle_time < idle_threshold and was_idle:
            # User is active again, calculate total idle time
            total_idle_time = time.time() - idle_start_time  # Calculate total idle duration
            print(f"User was idle for {total_idle_time:.2f} seconds. Logging to database...")
            log_idle_time(int(total_idle_time))

            # Reset idle status
            was_idle = False
            idle_start_time = None

        time.sleep(5)  # Check every 5 seconds

    
def kill_process(name):
    current_user = getpass.getuser()
    print(f"Current User: {current_user}")
    found = False
    visible_apps=get_visible_active_apps()
    #for process in psutil.process_iter(['pid', 'name', 'username']):
    for app in visible_apps:
        process_name=app['name']
        process_user=app['username']
        process_pid=app['pid']
         # Print process details
        #print(f"Checking processes - | PID: {process_pid} | Name: {process_name} | Username: {process_user} |")
        if process_user and process_name:
            if process_name.lower() == name.lower() and current_user in process_user:
                try:
                    
                    proc= psutil.Process(process_pid)
                    print(f"[DEBUG] Checking process: {app}")
                    proc.terminate()
                    time.sleep(0.5)
                    
                    if not psutil.pid_exists(process_pid):
                        print(f"Killed {name} (PID:{process_pid}✅)")
                    else:
                        print(f"Failed to kill {name} (PID:{process_pid})❌")
                    found=True
                except psutil.AccessDenied:
                    print(f"Permission Denied to Kill {name} | PID: {process_pid}❌")
                except Exception as e:
                    print(f"Error terminating {name} | PID: {process_pid}: {e}")
    if not found:
        print(f"No process found with name: {name} owned by {current_user}")

def restart_process(name):
    current_user = getpass.getuser()
    process_found=False
    visible_apps=get_visible_active_apps()
    
    #for process in psutil.process_iter(['pid', 'name', 'exe', 'username']):
    for app in visible_apps:
        process_name=app['name']
        process_user=app['username']
        process_pid=app['pid']
        
        #print(f"Checking processes - | PID: {process_pid} | Name: {process_name} | Username: {process_user} |")
        if process_user and process_name:
            if process_name.lower() == name.lower() and current_user in process_user:
                process_found=True
                try:
                    proc= psutil.Process(process_pid)
                    #xe_path = process.info['exe']  # Get executable path
                    
                    #f not exe_path:  
                     #  print(f"Cannot restart {name}, path not found.")
                      # return
                    
                    proc.terminate()  # Kill process
                    proc.wait()  # Ensure process is terminated

                    new_process = psutil.Popen(name)#estart process
                    print(f"Restarted {name} with new PID: {new_process.pid} ✅")
                    
                    return
                except psutil.AccessDenied:
                    print(f"Permission denied to restart {name} (PID: {proc})")
                except Exception as e:
                    print(f"Error restarting {name} (PID: {proc}): {e}")
    
    print(f"No process found with name: {name} owned by {current_user}")

settings_queue = Queue()
def handle_settings_updates():
    while True:
        if not settings_queue.empty():
            print("[⚡DEBUG] processing settings update…")
            update = settings_queue.get()
            setting_type = update.get("type")
            data = update.get("data")
            
            with get_db_cursor() as cursor:
            
                if setting_type == "general":
                    cursor.execute("""
                        UPDATE monitor_settings SET theme=%s, refresh_interval=%s, email_notify=%s WHERE id=1
                    """, (data['theme'], data['refresh_interval'], data['email_notify']))

                elif setting_type == "process":
                    cursor.execute("""
                        UPDATE monitor_settings SET cpu_threshold=%s, memory_threshold=%s WHERE id=1
                    """, (data['cpu_threshold'], data['memory_threshold']))
                    try:
                        cursor.execute("DELETE FROM blacklisted_processes")
                        raw = data.get('process_blacklist') or ''

    #: support both list and string
                        if isinstance(raw, list):
                            lines = [line.strip() for line in raw if line.strip()]
                        elif isinstance(raw, str):
                            lines = [line.strip() for line in raw.splitlines() if line.strip()]
                        else:
                            lines = []

                        for proc_name in lines:
                            cursor.execute(
                            "INSERT INTO blacklisted_processes (process_name) VALUES (%s)",
                            (proc_name,)
                                )
                    except mysql.connector.Error as err:
                            print(f"Error: {err}")

                elif setting_type == "data":
                    cursor.execute("""
                        UPDATE monitor_settings SET auto_cleanup_days=%s WHERE id=1
                    """, (data['auto_cleanup_days'],))

def enqueue_settings_update(section_type, data_dict):
    """
    section_type: 'general', 'process', or 'data'
    data_dict: only the fields for that section
    """
    settings_queue.put({
        'type': section_type,
        'data': data_dict
    })

def fetch_blacklist():
    """Return a set of lower-cased process names to kill."""

    with get_db_cursor() as cursor:
        cursor.execute("SELECT process_name FROM blacklisted_processes")
        rows = cursor.fetchall()

    return {row[0].lower() for row in rows}


def enforce_blacklist():
    """Kill any visible app whose name is in the blacklist."""
    blacklist = fetch_blacklist()
    if not blacklist:
        return

    for app in get_visible_active_apps(blacklist):
        name = app['name'].lower()
        if name in blacklist:
            # Reuse your existing kill_process() logic
            kill_process(app['name'])
           

def monitor_system():
    while True:
        enforce_blacklist()

        try:
            with get_db_cursor() as cursor:
                cursor.execute(
                    "SELECT cpu_threshold, memory_threshold, refresh_interval "
                    "FROM monitor_settings WHERE id = 1"
                )
                row = cursor.fetchone()
        except Exception as e:
            print(f"❌ DB error: {e}. Retrying in 5s…")
            time.sleep(5)
            continue

        if row:
            cpu_thresh, mem_thresh, refresh_interval = row
        else:
            cpu_thresh, mem_thresh, refresh_interval = 80, 75, 30
            print("⚠️ No settings found—using defaults (80%, 75%, 30s)")

        time.sleep(refresh_interval/ 1000.0)

def get_monitor_settings():
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT cpu_threshold, memory_threshold, refresh_interval, theme, email_notify, id, username, auto_cleanup_days 
                FROM monitor_settings 
                WHERE id=1
            """)
            result = cursor.fetchone()

            if result:
                return {
                    'cpu_threshold': result[0],
                    'memory_threshold': result[1],
                    'refresh_interval': result[2],
                    'theme': result[3],
                    'email_notify': bool(result[4]),
                    'id': result[5],
                    'username': result[6],
                    'auto_cleanup_days': result[7]
                }
            else:
                return {'error': 'Settings not found'}

    except Exception as e:
        return {'error': str(e)}





def start_monitoring():
    schedule.every(15).seconds.do(log_processes_to_db)  
    schedule.every(1).days.do(clean_old_process_logs)  # Adjust this as needed
    schedule.every(30).seconds.do(monitor_and_log_system_usage)
    
    logging.info("Monitoring started...")

    while True:
        schedule.run_pending()
        time.sleep(1)



if __name__ == "__main__":
    send_email_to_user()
    schedule.run_pending()
    time.sleep(1)




