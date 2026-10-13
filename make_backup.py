#!/usr/bin/env python3
"""生成当前项目快照 zip，版本号取自 js/app.js 中的当前版本。

用法：
    python make_backup.py

会生成：
    markdown-viewer-v<当前版本>.zip
"""
import os
import re
import zipfile

BASE = os.path.dirname(os.path.abspath(__file__))


def get_current_version():
    app_js = os.path.join(BASE, 'js', 'app.js')
    try:
        with open(app_js, 'r', encoding='utf-8') as f:
            content = f.read()
        m = re.search(r'离线渲染器已启用\s*\(v([^)]+)\)', content)
        if m:
            return m.group(1).strip()
    except OSError:
        pass
    return 'unknown'


VERSION = get_current_version()
OUTPUT = os.path.join(BASE, f'markdown-viewer-v{VERSION}.zip')

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
    'README.md',
    'sample.md',
    'keepalived.md',
    'themes/keepalived.theme.json',
    'serve.py',
    'make_backup.py',
]

with zipfile.ZipFile(OUTPUT, 'w', zipfile.ZIP_DEFLATED) as zf:
    for name in FILES:
        path = os.path.join(BASE, name)
        if os.path.exists(path):
            zf.write(path, name)
            print(f'added: {name}')
        else:
            print(f'missing: {name}')

print(f'\n备份完成: {OUTPUT}')
