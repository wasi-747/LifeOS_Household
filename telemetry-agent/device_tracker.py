import os
import time
import requests
import psutil
import threading
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv
from collections import defaultdict

# Load win32 libraries safely if on Windows
IS_WINDOWS = False
try:
    import win32gui
    import win32process
    IS_WINDOWS = True
except ImportError:
    pass

def get_storage_dir():
    """Get the folder where we should read/write configuration files."""
    if getattr(sys, 'frozen', False):
        # Bundled via PyInstaller
        return os.path.dirname(sys.executable)
    else:
        # Running from source
        return os.path.dirname(os.path.abspath(__file__))

# Load environment variables
STORAGE_DIR = get_storage_dir()
load_dotenv(os.path.join(STORAGE_DIR, '.env'))

SERVER_URL = os.getenv('SERVER_URL', 'https://lifeos-household.onrender.com/api')
DEVICE_TOKEN = os.getenv('DEVICE_TOKEN', '')
DEVICE_ID = os.getenv('DEVICE_ID', '')
PAUSE_FILE = os.path.join(STORAGE_DIR, '.pause')

# Tracking state
is_paused = False
is_running = True
consent_active = True
last_consent_check = None

# Session accumulation
current_session = {
    'app_name': None,
    'start_time': None,
    'duration_seconds': 0
}
usage_batch = []
batch_lock = threading.Lock()

# Constants
BATCH_INTERVAL_SECONDS = 300  # Send batch every 5 minutes
SESSION_TICK_SECONDS = 60    # Check active app every minute
CONSENT_CHECK_INTERVAL = 300 # Check consent every 5 minutes
GPU_CHECK_INTERVAL = 10      # Check GPU every 10 seconds during active session

def get_active_process_name():
    """Get the name of the currently active process without window titles."""
    if not IS_WINDOWS:
        return 'Unknown'
    
    try:
        hwnd = win32gui.GetForegroundWindow()
        if hwnd:
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            process = psutil.Process(pid)
            return process.name()
    except Exception:
        pass
    return 'Unknown'

def get_gpu_utilization():
    """Get GPU utilization for the active process. Returns None if unavailable."""
    try:
        # Try nvidia-smi for NVIDIA GPUs
        import subprocess
        result = subprocess.run(
            ['nvidia-smi', '--query-compute-apps=pid,used_memory', '--format=csv,noheader,nounits'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0 and result.stdout.strip():
            lines = result.stdout.strip().split('\n')
            for line in lines:
                parts = line.split(',')
                if len(parts) >= 2:
                    try:
                        pid = int(parts[0].strip())
                        mem_usage = int(parts[1].strip()) if parts[1].strip() else 0
                        # Get current active PID
                        hwnd = win32gui.GetForegroundWindow()
                        if hwnd:
                            _, active_pid = win32process.GetWindowThreadProcessId(hwnd)
                            if pid == active_pid:
                                # Estimate GPU % based on memory usage (rough approximation)
                                # This is a simplified approach since nvidia-smi doesn't directly give %
                                return min(100, mem_usage / 10)  # Assume 10MB = 1% roughly
                    except (ValueError, IndexError):
                        continue
    except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
        pass
    
    return None

def check_consent_status():
    """Check if consent is still active for this device."""
    global consent_active, last_consent_check
    
    if not DEVICE_TOKEN:
        print("[WARNING] No device token configured. Consent check skipped.")
        return
    
    try:
        headers = {'Authorization': f'Bearer {DEVICE_TOKEN}'}
        response = requests.get(
            f'{SERVER_URL}/device-consent/status',
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            consent_active = data.get('isActive', False)
            last_consent_check = datetime.now()
            
            if not consent_active:
                print("[INFO] Consent revoked. Stopping data collection.")
        else:
            print(f"[WARNING] Consent check failed: {response.status_code}")
    except Exception as e:
        print(f"[ERROR] Consent check error: {e}")

def send_usage_batch():
    """Send accumulated usage data to the server."""
    global usage_batch, consent_active
    
    with batch_lock:
        if not usage_batch or not consent_active:
            return
        
        batch_to_send = usage_batch.copy()
        usage_batch.clear()
    
    try:
        headers = {'Authorization': f'Bearer {DEVICE_TOKEN}'}
        payload = {'sessions': batch_to_send}
        
        response = requests.post(
            f'{SERVER_URL}/device-usage/ingest',
            json=payload,
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 201:
            print(f"[INFO] Sent {len(batch_to_send)} usage sessions successfully.")
        elif response.status_code == 403:
            print("[WARNING] Consent not active. Stopping collection.")
            consent_active = False
        else:
            print(f"[ERROR] Failed to send batch: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"[ERROR] Send batch error: {e}")
        # Re-add failed batch
        with batch_lock:
            usage_batch.extend(batch_to_send)

def finalize_session():
    """Finalize the current session and add to batch."""
    global current_session, usage_batch
    
    if current_session['app_name'] and current_session['duration_seconds'] > 0:
        session_data = {
            'app_name': current_session['app_name'],
            'duration_seconds': current_session['duration_seconds'],
            'gpu_avg_percent': current_session.get('gpu_avg_percent'),
            'started_at': current_session['start_time'].isoformat()
        }
        
        with batch_lock:
            usage_batch.append(session_data)
        
        print(f"[SESSION] {current_session['app_name']}: {current_session['duration_seconds']}s")
    
    # Reset current session
    current_session = {
        'app_name': None,
        'start_time': None,
        'duration_seconds': 0,
        'gpu_avg_percent': None
    }

def tracking_loop():
    """Main tracking loop that monitors active applications."""
    global current_session, is_paused, consent_active, is_running
    
    gpu_samples = []
    
    while is_running:
        if is_paused or not consent_active:
            time.sleep(SESSION_TICK_SECONDS)
            continue
        
        try:
            active_app = get_active_process_name()
            now = datetime.now()
            
            # If app changed or no current session, finalize previous
            if current_session['app_name'] and current_session['app_name'] != active_app:
                finalize_session()
                gpu_samples = []
            
            # Start or continue session
            if not current_session['app_name']:
                current_session['app_name'] = active_app
                current_session['start_time'] = now
                current_session['duration_seconds'] = 0
                current_session['gpu_avg_percent'] = None
                print(f"[START] Tracking: {active_app}")
            
            # Increment duration
            current_session['duration_seconds'] += SESSION_TICK_SECONDS
            
            # Sample GPU periodically
            gpu = get_gpu_utilization()
            if gpu is not None:
                gpu_samples.append(gpu)
            
            # Calculate average GPU for the session
            if gpu_samples:
                current_session['gpu_avg_percent'] = sum(gpu_samples) / len(gpu_samples)
            
            time.sleep(SESSION_TICK_SECONDS)
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"[ERROR] Tracking loop error: {e}")
            time.sleep(SESSION_TICK_SECONDS)

def batch_sender_loop():
    """Separate thread to send batches at intervals."""
    global is_running
    
    while is_running:
        time.sleep(BATCH_INTERVAL_SECONDS)
        if not is_paused and consent_active:
            finalize_session()
            send_usage_batch()

def consent_check_loop():
    """Separate thread to periodically check consent status."""
    global is_running
    
    while is_running:
        time.sleep(CONSENT_CHECK_INTERVAL)
        check_consent_status()

def check_pause_file():
    """Check if pause file exists."""
    global is_paused
    while is_running:
        is_paused = os.path.exists(PAUSE_FILE)
        if is_paused:
            print("[PAUSED] Tracking paused by user.")
        time.sleep(5)

def print_menu():
    """Print the tray menu options."""
    print("\n" + "="*50)
    print("  LifeOS Device Usage Tracker")
    print("="*50)
    print(f"  Device ID: {DEVICE_ID or 'Not paired'}")
    print(f"  Server: {SERVER_URL}")
    print(f"  Status: {'PAUSED' if is_paused else 'RUNNING'}")
    print(f"  Consent: {'ACTIVE' if consent_active else 'INACTIVE'}")
    print("="*50)
    print("  Commands:")
    print("    p  - Pause/Resume tracking")
    print("    s  - Send batch now")
    print("    q  - Quit")
    print("="*50 + "\n")

def handle_user_input():
    """Handle user commands from stdin."""
    global is_running, is_paused
    
    while is_running:
        try:
            cmd = input().strip().lower()
            
            if cmd == 'q':
                print("[INFO] Shutting down...")
                is_running = False
                break
            elif cmd == 'p':
                is_paused = not is_paused
                if is_paused:
                    # Create pause file
                    with open(PAUSE_FILE, 'w') as f:
                        f.write('paused')
                    print("[INFO] Tracking paused.")
                else:
                    # Remove pause file
                    if os.path.exists(PAUSE_FILE):
                        os.remove(PAUSE_FILE)
                    print("[INFO] Tracking resumed.")
            elif cmd == 's':
                finalize_session()
                send_usage_batch()
            elif cmd == 'm':
                print_menu()
            else:
                print("[INFO] Unknown command. Press 'm' for menu.")
        except EOFError:
            break
        except Exception as e:
            print(f"[ERROR] Input error: {e}")

def pair_device(pairing_code):
    """Pair this device using a pairing code."""
    global DEVICE_TOKEN, DEVICE_ID
    
    try:
        # Generate a unique device ID
        import uuid
        DEVICE_ID = str(uuid.uuid4())
        
        payload = {
            'pairingCode': pairing_code,
            'deviceId': DEVICE_ID,
            'deviceName': f"{os.getenv('COMPUTERNAME', 'Unknown')}-{os.getenv('USERNAME', 'User')}",
            'os': sys.platform
        }
        
        response = requests.post(
            f'{SERVER_URL}/devices/pair',
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            DEVICE_TOKEN = data['deviceToken']
            
            # Save to .env file
            env_file = os.path.join(STORAGE_DIR, '.env')
            with open(env_file, 'a') as f:
                f.write(f'\nDEVICE_TOKEN={DEVICE_TOKEN}\n')
                f.write(f'DEVICE_ID={DEVICE_ID}\n')
            
            print(f"[SUCCESS] Device paired successfully!")
            print(f"[INFO] Device ID: {DEVICE_ID}")
            print(f"[INFO] Token saved to .env file")
            return True
        else:
            print(f"[ERROR] Pairing failed: {response.status_code}")
            print(response.text)
            return False
    except Exception as e:
        print(f"[ERROR] Pairing error: {e}")
        return False

def main():
    global is_running
    
    print("="*50)
    print("  LifeOS Device Usage Tracker")
    print("="*50)
    
    # Check if already paired
    if not DEVICE_TOKEN:
        print("\n[SETUP] Device not paired yet.")
        pairing_code = input("Enter pairing code from your LifeOS account: ").strip()
        
        if not pair_device(pairing_code):
            print("[FATAL] Failed to pair device. Exiting.")
            return
    
    # Initial consent check
    check_consent_status()
    
    if not consent_active:
        print("[WARNING] No active consent. Tracking will not start until consent is granted.")
    
    # Start background threads
    tracking_thread = threading.Thread(target=tracking_loop, daemon=True)
    batch_thread = threading.Thread(target=batch_sender_loop, daemon=True)
    consent_thread = threading.Thread(target=consent_check_loop, daemon=True)
    pause_thread = threading.Thread(target=check_pause_file, daemon=True)
    input_thread = threading.Thread(target=handle_user_input, daemon=True)
    
    tracking_thread.start()
    batch_thread.start()
    consent_thread.start()
    pause_thread.start()
    input_thread.start()
    
    print_menu()
    print("[INFO] Tracker started. Press 'm' for menu, 'q' to quit.\n")
    
    # Wait for user input thread (main thread)
    input_thread.join()
    
    # Cleanup
    is_running = False
    finalize_session()
    send_usage_batch()
    
    # Clean up pause file
    if os.path.exists(PAUSE_FILE):
        os.remove(PAUSE_FILE)
    
    print("[INFO] Tracker stopped.")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n[INFO] Interrupted by user.")
        is_running = False
    except Exception as e:
        print(f"[FATAL] Unexpected error: {e}")
