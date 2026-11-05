#!/usr/bin/env python3
"""生成当前项目快照 zip，版本号取自 js/app.js 中的当前版本。

用法：
    python make_backup.py

会生成：
    backup/markdown-viewer-v<当前版本>.zip
"""
import hashlib
import os
import re
import sys
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
BACKUP_DIR = os.path.join(BASE, 'backup')
os.makedirs(BACKUP_DIR, exist_ok=True)
OUTPUT = os.path.join(BACKUP_DIR, f'markdown-viewer-v{VERSION}.zip')

# ---------- 图标哈希校验（保持不变） ----------
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

print('图标哈希校验通过，开始备份...')

# ---------- 自动收集所有文件（排除 backup 目录） ----------
files_to_pack = []

for root, dirs, files in os.walk(BASE):
    # 只跳过顶层的 backup 目录，避免递归打包旧备份
    if root == BASE and 'backup' in dirs:
        dirs.remove('backup')   # 不进入 backup 目录

    for fname in files:
        full_path = os.path.join(root, fname)
        rel_path = os.path.relpath(full_path, BASE)
        # 额外安全过滤：确保不会意外包含 backup 目录下的文件（理论上不会，因为 dirs 已跳过）
        if rel_path.startswith('backup' + os.sep) or rel_path == 'backup':
            continue
        files_to_pack.append(rel_path)

# 排序以保持输出一致
files_to_pack.sort()

# 如果没有文件，提示退出
if not files_to_pack:
    print('错误：没有找到任何文件可以打包。')
    sys.exit(1)

# ---------- 创建 ZIP ----------
with zipfile.ZipFile(OUTPUT, 'w', zipfile.ZIP_DEFLATED) as zf:
    for rel_path in files_to_pack:
        full_path = os.path.join(BASE, rel_path)
        zf.write(full_path, rel_path)
        print(f'added: {rel_path}')

print(f'\n备份完成: {OUTPUT}')