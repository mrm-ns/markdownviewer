@echo off
chcp 65001 >nul
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
    echo 正在启动 Markdown Viewer...
    python serve.py
) else (
    echo 未检测到 Python，将尝试直接打开 index.html
    start "" "%~dp0index.html"
)
pause
