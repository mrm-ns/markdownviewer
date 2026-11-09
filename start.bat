@echo off
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
    echo ========================================
    echo   Markdown Viewer Local Server
    echo   URL: http://localhost:8000
    echo   Press Ctrl+C to stop
    echo ========================================
    start "" "http://localhost:8000"
    python serve.py
) else (
    echo [INFO] Python not found, opening index.html directly.
    echo [INFO] PDF export requires Python. Please install Python and retry.
    start "" "%~dp0index.html"
    pause
)
