


import threading
import webview
import time
import schedule
from app import app  # Your Flask app
from main_script import start_monitoring, track_idle_time, monitor_system, handle_settings_updates,send_email_to_user

# Start Flask server
def start_flask():
    app.run(debug=False, port=5000, use_reloader=False)

# Start idle time tracking in a thread
def start_idle_time_tracking():
    idle_time_thread = threading.Thread(target=track_idle_time, name="Idle_time_Thread", daemon=True)
    idle_time_thread.start()

# Start background monitors
def settings_monitor():
    monitor_thread = threading.Thread(target=monitor_system, name="Settings_Monitor_Thread", daemon=True)
    monitor_thread.start()

    settings_thread = threading.Thread(target=handle_settings_updates, name="Settings_Update_Thread", daemon=True)
    settings_thread.start()

# Start all background jobs
def run_data_collector():
    monitoring_thread = threading.Thread(target=start_monitoring, name="System_Monitor_Thread", daemon=True)
    monitoring_thread.start()

    start_idle_time_tracking()
    settings_monitor()

def schedule_email_jobs():
    # Start sending emails every 4 hours AFTER a short delay
    def delayed_first_email():
        print("[INFO] Waiting for fresh data before first email...")
        time.sleep(60)  # 3 minutes delay
        send_email_to_user()
    threading.Thread(target=delayed_first_email, daemon=True).start()

    # Then schedule for every 4 hours
    schedule.every(4).hours.do(send_email_to_user)

#def run_scheduled_jobs():
 
    #while True:
     #schedule.run_pending()
      #  time.sleep(1)
    # Run schedule tasks

# Launch pywebview window
def create_window():
    webview.create_window("System Monitor", "http://localhost:5000", width=1200, height=800)
    webview.start()  # Must run on main thread

if __name__ == '__main__':
    # Start Flask in background
    flask_thread = threading.Thread(target=start_flask, daemon=True)
    flask_thread.start()

    # Start background data collection in another thread
    data_collector_thread = threading.Thread(target=run_data_collector, daemon=True)
    data_collector_thread.start()
    
    schedule_email_jobs()  # Register email job *after* starting app
    
   # schedule_thread = threading.Thread(target=run_scheduled_jobs, daemon=True)
    #schedule_thread.start()
    # Start the webview (on main thread)
    create_window()



