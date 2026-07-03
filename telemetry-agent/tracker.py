import os
import time
import requests
import psutil
from datetime import datetime
from dotenv import load_dotenv

# Load win32 libraries safely if on Windows
IS_WINDOWS = False
try:
    import win32gui
    import win32process
    IS_WINDOWS = True
except ImportError:
    pass

# Load environment variables
load_dotenv()

DEVICE_ID = os.getenv('DEVICE_ID', 'unknown-device')
SERVER_URL = os.getenv('SERVER_URL', 'http://localhost:5000/api/telemetry')
TEST_MODE = os.getenv('TEST_MODE', 'false').lower() == 'true'

# Category mappings
CATEGORY_MAPPINGS = {
    'Code.exe': 'Coding',
    'WindowsTerminal.exe': 'Coding',
    'VALORANT-Win64-Shipping.exe': 'Gaming',
    'efootball.exe': 'Gaming',
    'chrome.exe': 'Browsing',
    'msedge.exe': 'Browsing',
    'brave.exe': 'Browsing'
}

def get_active_process():
    if not IS_WINDOWS:
        return 'Other'
    
    try:
        hwnd = win32gui.GetForegroundWindow()
        if hwnd:
            # Get process ID from active window handle
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            process = psutil.Process(pid)
            return process.name()
    except Exception:
        # Fail silently and return generic category
        pass
    return 'Other'

def get_category(process_name):
    return CATEGORY_MAPPINGS.get(process_name, 'Other')

def main():
    # Adjust loop and transmission intervals based on TEST_MODE
    # Normal: tick every 60s, send every 5 minutes (5 ticks)
    # Test: tick every 5s, send every 15s (3 ticks)
    tick_interval = 5 if TEST_MODE else 60
    send_ticks = 3 if TEST_MODE else 5

    print("==================================================")
    print("      LIFEOS TELEMETRY AGENT RUNNING              ")
    print(f"Device ID: {DEVICE_ID}")
    print(f"Target Server: {SERVER_URL}")
    print(f"Mode: {'TEST (Accelerated)' if TEST_MODE else 'PRODUCTION'}")
    print(f"Tick Interval: {tick_interval}s | Send Interval: {tick_interval * send_ticks}s")
    print("==================================================")

    # State accumulation variables
    tick_count = 0
    cpu_samples = []
    ram_samples = []
    category_counts = {
        'Coding': 0,
        'Gaming': 0,
        'Browsing': 0,
        'Other': 0
    }

    while True:
        try:
            # 1. Capture Active Process and Category
            process_name = get_active_process()
            category = get_category(process_name)
            
            # Record category active time (each tick is 1 minute in production, or 1 tick unit in test)
            category_counts[category] += 1

            # 2. Capture System Health Statistics
            cpu_usage = psutil.cpu_percent(interval=None)
            ram_usage = psutil.virtual_memory().percent
            cpu_samples.append(cpu_usage)
            ram_samples.append(ram_usage)

            # Compute current uptime
            uptime_seconds = int(time.time() - psutil.boot_time())

            # Print active window & usage snapshot log
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Tick {tick_count + 1}/{send_ticks}: Active={process_name} ({category}) | CPU={cpu_usage}% | RAM={ram_usage}%")

            tick_count += 1

            # 3. Check if it is time to aggregate and transmit payload
            if tick_count >= send_ticks:
                avg_cpu = sum(cpu_samples) / len(cpu_samples)
                avg_ram = sum(ram_samples) / len(ram_samples)

                # Prepare JSON payload
                payload = {
                    "device_id": DEVICE_ID,
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "cpu_usage_avg": round(avg_cpu, 2),
                    "ram_usage_avg": round(avg_ram, 2),
                    "uptime_seconds": uptime_seconds,
                    "activity_breakdown": {
                        "Coding": category_counts['Coding'],
                        "Gaming": category_counts['Gaming'],
                        "Browsing": category_counts['Browsing'],
                        "Other": category_counts['Other']
                    }
                }

                print("\n>>> AGGREGATING AND TRANSMITTING TELEMETRY PAYLOAD <<<")
                import json
                print(json.dumps(payload, indent=4))

                # Attempt HTTP POST request
                try:
                    response = requests.post(SERVER_URL, json=payload, timeout=5)
                    print(f"Server Response Status Code: {response.status_code}")
                    print(f"Server Response Body: {response.text}\n")
                except requests.exceptions.ConnectionError:
                    print("Transmission Status: FAILED (Cannot connect to local API server - Server is likely offline)\n")
                except Exception as ex:
                    print(f"Transmission Status: FAILED ({str(ex)})\n")

                # Reset accumulation metrics
                tick_count = 0
                cpu_samples = []
                ram_samples = []
                category_counts = {
                    'Coding': 0,
                    'Gaming': 0,
                    'Browsing': 0,
                    'Other': 0
                }

            # Wait for next tick
            time.sleep(tick_interval)

        except KeyboardInterrupt:
            print("\nTelemetry agent stopped by user.")
            break
        except Exception as e:
            print(f"Error in tracking loop: {str(e)}")
            time.sleep(5)

if __name__ == '__main__':
    main()
