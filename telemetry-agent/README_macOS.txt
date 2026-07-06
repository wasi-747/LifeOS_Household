LifeOS Device Usage Tracker (macOS)
==================================

This folder contains the macOS tracking agent for LifeOS.

Prerequisites:
- Python 3.8 or higher installed on your Mac.

How to install & run:
1. Open Terminal.
2. Navigate to this folder:
   cd /path/to/extracted/folder
3. Install required packages:
   pip install -r requirements.txt
4. Run the tracker:
   python device_tracker.py
5. When prompted, enter the pairing code from your LifeOS account.

Notes:
- You will need to grant Terminal permission to record active processes (Accessibility / Automation permissions) if prompted by macOS.
- No window titles, browser history, or screen contents are tracked.
