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

# 显式列出根目录下的文件（这些文件必须存在）
ROOT_FILES = [
    'index.html',
    'app.js',
    'hutao.ico',
    'README.md',
    'ENVIRONMENT.md',
    'sample.md',
    'keepalived.md',
    'serve.py',
    'start.bat',
    'start.sh',
]

# 需要整体打包的目录（递归包含其下所有文件）
DIRS = [
    'css',
    'js',
    'themes',
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

# 收集所有需要打包的文件路径（相对于 BASE）
files_to_pack = set()

# 添加根目录文件
for fname in ROOT_FILES:
    path = os.path.join(BASE, fname)
    if os.path.exists(path):
        files_to_pack.add(fname)   # 存储相对路径
    else:
        print(f'警告：根目录文件不存在，跳过：{fname}')

# 添加目录下的所有文件
for dirname in DIRS:
    dir_path = os.path.join(BASE, dirname)
    if not os.path.isdir(dir_path):
        print(f'警告：目录不存在，跳过：{dirname}')
        continue
    for root, dirs, files in os.walk(dir_path):
        for file in files:
            full_path = os.path.join(root, file)
            # 计算相对于 BASE 的相对路径
            rel_path = os.path.relpath(full_path, BASE)
            files_to_pack.add(rel_path)

# 如果没有文件，提示并退出
if not files_to_pack:
    print('错误：没有找到任何文件可以打包。')
    sys.exit(1)

# 创建 ZIP 文件
with zipfile.ZipFile(OUTPUT, 'w', zipfile.ZIP_DEFLATED) as zf:
    for rel_path in sorted(files_to_pack):
        full_path = os.path.join(BASE, rel_path)
        zf.write(full_path, rel_path)
        print(f'added: {rel_path}')

print(f'\n打包完成: {OUTPUT}')