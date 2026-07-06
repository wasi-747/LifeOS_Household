# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for LifeOS Device Tracker
"""
import sys
from PyInstaller.utils.hooks import collect_data_files

block_cipher = None

# Collect data files from python-dotenv
datas = collect_data_files('dotenv')

a = Analysis(
    ['device_tracker.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=[
        'psutil',
        'requests',
        'dotenv',
        'win32gui',
        'win32process',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='LifeOSAgent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Show console for user interaction
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # Add icon file path if available
)
