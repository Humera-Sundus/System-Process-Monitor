# System Process Monitor App

A desktop + web-based system monitoring tool built with **Flask, PyWebView, and MySQL**.  
It tracks running processes, CPU/Memory usage, idle time, and sends email alerts using Gmail API.

---

## 🚀 Features
- Monitor running processes with CPU & Memory usage
- Track idle time of the user
- Store logs in MySQL database
- Send email alerts using Gmail API (OAuth2)
- Frontend built with Flask templates + Tailwind
- Packaged into desktop app using PyInstaller + PyWebView

---

## 📂 Project Structure
project/
│── app.py # Flask app entry point
│── main.py # PyWebView + desktop wrapper
│── main_script.py # Core monitoring logic
│── gmail_api.py # Handles sending emails via Gmail API
│── Google_API.py # Google API service creation
│── requirements.txt # Python dependencies
│── templates/ # HTML files
│── static/ # CSS, JS, images

> ⚠️ Note: `client_secret.json` and `token.json` are **not included**. You must generate them yourself (see setup).


## Install Dependencies 
pip install -r requirements.txt

## Set up Database
Create a MySQL database (process_db) and create the table (system_logs) other tables will be created from main_script.py.

Run the SQL scripts from the project (if you have .sql file with schema).

Update database connection in main_script.py / app.py.

## Configure Google API
Go to Google Cloud Console

Enable Gmail API and create OAuth2 credentials.

Download the client_secret.json file.

Place it in the project root (same folder as main.py).

The first run will create token.json automatically.

## Run the App
python main.py 

## Build the .exe file 

pyinstaller --noconfirm --onefile --windowed --add-data "templates;templates" --add-data "static;static" main.py
