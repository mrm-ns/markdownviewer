#!/usr/bin/env python3
"""打包 Markdown Viewer 便携版（发给终端用户、双击 index.html 即可用）。

用法：
    python packup.py

会生成：
    markdown-viewer-portable.zip

打包内容 = 根目录的必需文件 + ROOT_FILES + DIRS 三个目录（css / js / themes）。
`src/`、`tools/` 与各种 .py 构建脚本**故意不入包** —— 它们是开发用的，终端用户不需要
（`serve.py` 例外：PDF 导出要靠它）。

打包前会做三项校验，任何一项不过都直接退出（宁可不出包，也不能出坏包）：
  1. 图标哈希：hutao.ico 的 SHA-256 必须等于 app.js 里的 EXPECTED_ICON_HASH
     —— 它错了应用连启动都过不去；
  2. 必需根文件存在（见 REQUIRED_ROOT）；
  3. **运行时素材自检**：源码（index.html / app.js / js/app.js / css/style.css）里
     按相对路径引用、且磁盘上确实存在的素材（.ico/.jpg/.png/.svg/.woff…），
     必须全在打包清单里。
     —— 这条是踩坑后加的：水印素材 hutao-logo-300.jpg / hutao.jpg 曾被漏掉，
     便携版导出的 PDF 于是静默没有 logo（代码里是优雅降级，不会报错，只表现为「少了东西」）。
"""
import hashlib
import os
import re
import sys
import zipfile

BASE = os.path.dirname(os.path.abspath(__file__))
OUTPUT = os.path.join(BASE, 'markdown-viewer-portable.zip')

# 缺了就打不开 / 起不来的文件
REQUIRED_ROOT = [
    'index.html',
    'app.js',
    'hutao.ico',          # index.html 的 favicon + 根 app.js 的哈希校验对象
    'serve.py',           # PDF 导出接口
]

# 其余根目录文件（存在即打包，缺失只警告：文档、示例、启动脚本之类）
OPTIONAL_ROOT = [
    'README.md',
    'ENVIRONMENT.md',
    'sample.md',
    'start.bat',
    'start.sh',
    'setup-env.bat',
    'setup-env.ps1',
    'hutao.jpg',              # PDF 水印回退用原图（小图缺失时读它）
    'hutao-logo-300.jpg',     # PDF 水印首选的小图，见 AGENTS.md §6.16
]

# 需要整体打包的目录（递归包含其下所有文件）
DIRS = [
    'css',
    'js',        # 含 js/app.js 核心逻辑 + 各语言高亮规则 + file-icons.js
    'themes',
]

# 运行时素材自检：扫描这些源码，抽出相对路径素材引用
ASSET_EXT = ('.ico', '.jpg', '.jpeg', '.png', '.svg', '.gif', '.webp', '.woff', '.woff2')
SCAN_SOURCES = ['index.html', 'app.js', 'js/app.js', 'css/style.css']

ICON_PATH = os.path.join(BASE, 'hutao.ico')
APP_JS_PATH = os.path.join(BASE, 'app.js')


def collect_files():
    """返回 (打包清单, 缺失的必需文件, 缺失的可选文件)。"""
    files, missing_required, missing_optional = set(), [], []
    for fname in REQUIRED_ROOT:
        if os.path.exists(os.path.join(BASE, fname)):
            files.add(fname)
        else:
            missing_required.append(fname)
    for fname in OPTIONAL_ROOT:
        if os.path.exists(os.path.join(BASE, fname)):
            files.add(fname)
        else:
            missing_optional.append(fname)
    for dirname in DIRS:
        dir_path = os.path.join(BASE, dirname)
        if not os.path.isdir(dir_path):
            missing_required.append(dirname + '/')
            continue
        for root, _, names in os.walk(dir_path):
            for name in names:
                rel = os.path.relpath(os.path.join(root, name), BASE)
                files.add(rel.replace('\\', '/'))
    return files, missing_required, missing_optional


def referenced_assets():
    """从源码里抽出「相对路径的素材引用」，返回 {相对路径: 文本形式}。"""
    found = {}
    for src in SCAN_SOURCES:
        path = os.path.join(BASE, src)
        if not os.path.exists(path):
            continue
        text = open(path, encoding='utf-8', errors='replace').read()
        # HTML 的 src=/href=、CSS 的 url(...)、JS 里的字符串字面量
        cands = re.findall(r'(?:src|href)\s*=\s*["\']([^"\']+)["\']', text)
        cands += re.findall(r'url\(\s*["\']?([^"\')\s]+)["\']?\s*\)', text)
        cands += re.findall(r'["\']([^"\'<>\s]+\.(?:ico|jpe?g|png|svg|gif|webp|woff2?))["\']', text, re.I)
        for raw in cands:
            u = raw.split('?')[0].split('#')[0].strip()
            if not u or u.startswith(('http://', 'https://', 'data:', '//', '#')):
                continue
            if not u.lower().endswith(ASSET_EXT):
                continue
            if u.startswith('/'):        # 站点绝对路径（如 serve.py 里的 /favicon.ico 路由）
                continue
            rel = os.path.normpath(u).replace('\\', '/')
            if os.path.exists(os.path.join(BASE, rel)):
                found[rel] = raw
    return found


# ---------- 校验 1：图标哈希 ----------
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
print('✓ 图标哈希校验通过')

# ---------- 校验 2：必需文件 ----------
files_to_pack, missing_required, missing_optional = collect_files()
if missing_required:
    print('错误：必需文件/目录不存在，无法打包：' + '、'.join(missing_required))
    sys.exit(1)
print('✓ 必需文件齐全，共收集 %d 个文件' % len(files_to_pack))
for fname in missing_optional:
    print(f'  警告：可选文件不存在，跳过：{fname}')

# ---------- 校验 3：运行时素材自检 ----------
assets = referenced_assets()
absent = {rel: raw for rel, raw in assets.items() if rel not in files_to_pack}
if absent:
    print('错误：以下素材被源码引用、磁盘上也存在，但没有进打包清单'
          '（便携版会静默缺少它们）：')
    for rel, raw in sorted(absent.items()):
        print(f'  - {rel}   （源码里写作 {raw}）')
    print('  修法：把该文件加进本脚本的 REQUIRED_ROOT/OPTIONAL_ROOT。')
    sys.exit(1)
print('✓ 运行时素材自检通过（源码引用 %d 个素材，全部在包内）' % len(assets))

# ---------- 写 zip ----------
total = 0
with zipfile.ZipFile(OUTPUT, 'w', zipfile.ZIP_DEFLATED) as zf:
    for rel_path in sorted(files_to_pack):
        full_path = os.path.join(BASE, rel_path)
        zf.write(full_path, rel_path)
        total += os.path.getsize(full_path)

print('\n打包完成: %s' % OUTPUT)
print('共 %d 个文件，原始体积 %.1f KB，zip 体积 %.1f KB'
      % (len(files_to_pack), total / 1024, os.path.getsize(OUTPUT) / 1024))
