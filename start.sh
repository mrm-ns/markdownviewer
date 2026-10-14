#!/usr/bin/env bash
# Markdown Viewer 启动脚本
cd "$(dirname "$0")"

if command -v python3 >/dev/null 2>&1; then
    echo "正在启动 Markdown Viewer..."
    python3 serve.py
elif command -v python >/dev/null 2>&1; then
    echo "正在启动 Markdown Viewer..."
    python serve.py
else
    echo "未检测到 Python，尝试直接打开 index.html"
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open index.html
    elif command -v open >/dev/null 2>&1; then
        open index.html
    else
        echo "请手动打开 index.html"
    fi
fi
