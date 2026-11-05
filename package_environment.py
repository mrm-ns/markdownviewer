#!/usr/bin/env python3
"""打包 Markdown Viewer 项目及运行环境脚本。

用法：
    python package_environment.py

会生成：
    markdown-viewer-portable.zip
"""
import hashlib
import os
import re
import sys
import zipfile

BASE = os.path.dirname(os.path.abspath(__file__))
OUTPUT = os.path.join(BASE, 'markdown-viewer-portable.zip')

FILES = [
    'index.html',
    'app.js',
    'hutao.ico',
    'compute_icon_hash.py',
    'css/style.css',
    'js/app.js',
    'js/bash.js',
    'js/ini.js',
    'js/conf.js',
    'js/keepalived.js',
    'js/python.js',
    'js/javascript.js',
    'js/json.js',
    'js/yaml.js',
    'js/sql.js',
    'README.md',
    'ENVIRONMENT.md',
    'sample.md',
    'keepalived.md',
    'themes/keepalived.theme.json',
    'serve.py',
    'make_backup.py',
    'add_language.py',
    'package_environment.py',
    'start.bat',
    'start.sh',
]

# 校验图标哈希，避免打包出去后因哈希不匹配导致无法启动
ICON_PATH = os.path.join(BASE, 'hutao.ico')
APP_JS_PATH = os.path.join(BASE, 'app.js')

with open(ICON_PATH, 'rb') as f:
    icon_hash = hashlib.sha256(f.read()).hexdigest()

with open(APP_JS_PATH, 'r', encoding='utf-8') as f:
    app_js = f.read()

m = re.search(r"EXPECTED_ICON_HASH\s*=\s*'([^']+)'", app_js)
if not m:
    print('错误：未在 app.js 中找到 EXPECTED_ICON_HASH')
    sys.exit(1)

expected = m.group(1).strip().lower()
if expected == 'replace_with_sha256':
    print('错误：EXPECTED_ICON_HASH 还是占位符，请先运行 python compute_icon_hash.py 并填写。')
    sys.exit(1)

if icon_hash.lower() != expected:
    print('错误：hutao.ico 的哈希与 app.js 中的 EXPECTED_ICON_HASH 不一致。')
    print(f'当前 hutao.ico SHA-256: {icon_hash}')
    print(f'app.js 中配置的哈希:   {expected}')
    sys.exit(1)

print('图标哈希校验通过，开始打包...')

with zipfile.ZipFile(OUTPUT, 'w', zipfile.ZIP_DEFLATED) as zf:
    for name in FILES:
        path = os.path.join(BASE, name)
        if os.path.exists(path):
            zf.write(path, name)
            print(f'added: {name}')
        else:
            print(f'missing: {name}')

print(f'\n打包完成: {OUTPUT}')
