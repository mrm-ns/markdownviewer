#!/usr/bin/env python3
"""自动更新 Markdown Viewer 版本号（开发工具）。

用法：
    python update_version.py            # 交互式：显示当前版本，回车接受自动递增的版本号，或手动输入
    python update_version.py 1.0.13     # 直接指定新版本号

会同步修改：
    - js/app.js   的 console.log 版本字符串
    - index.html 的 <link> / <script> 的 ?v= 参数（两处）

修改后请按 AI_DEVELOPMENT.md §9 流程继续执行：
    1. 在 CHANGELOG.md 顶部添加 [v<新版本号>] 的更新记录
    2. python all_backup.py 生成备份
"""
import os
import re
import subprocess
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
INDEX_HTML = os.path.join(BASE, 'index.html')
APP_JS = os.path.join(BASE, 'js', 'app.js')

# 拆分后（v1.1.0 起）js/app.js 由 src/ 下的功能片段拼接生成，
# 版本字符串的真实来源在片段 60-ui-init.js 里。
# 只改 js/app.js 会在下次拼接时被覆盖，所以这里同时改片段并重新拼接。
VERSION_FRAGMENT = os.path.join(BASE, 'src', '60-ui-init.js')
BUNDLE_SCRIPT = os.path.join(BASE, 'tools', 'split_app.js')


def read_file(path):
    # newline='' 保持原始换行符（\r\n / \n），避免写回时改动全文件行尾
    with open(path, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def write_file(path, content):
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(content)


def get_current_version():
    # 以 js/app.js 的 console.log 版本字符串为权威来源（与 all_backup.py 一致）
    content = read_file(APP_JS)
    m = re.search(r'离线渲染器已启用\s*\(v([^)]+)\)', content)
    if not m:
        print('错误：未在 js/app.js 中找到版本字符串，请手动检查。')
        sys.exit(1)
    return m.group(1).strip()


def get_index_versions(content):
    return re.findall(r'\?v=([0-9.]+)', content)


def suggest_next(version):
    parts = version.split('.')
    try:
        parts[-1] = str(int(parts[-1]) + 1)
    except ValueError:
        pass
    return '.'.join(parts)


def validate_version(v):
    return bool(re.fullmatch(r'\d+(?:\.\d+)*', v or ''))


def main():
    current = get_current_version()

    # 检查 index.html 中的版本号是否与 js/app.js 一致
    index_content = read_file(INDEX_HTML)
    index_versions = get_index_versions(index_content)
    if index_versions and set(index_versions) != {current}:
        print(f'警告：index.html 中的版本号 {sorted(set(index_versions))} 与 js/app.js 的 {current} 不一致，将以 js/app.js 为准。')

    # 确定新版本号
    new_version = None
    if len(sys.argv) > 1:
        new_version = sys.argv[1].strip()
        if not validate_version(new_version):
            print(f'错误：版本号格式不正确：{new_version}（应类似 1.0.13）')
            sys.exit(1)
    else:
        suggested = suggest_next(current)
        answer = input(f'当前版本：{current}。回车使用建议版本 {suggested}，或输入新版本号：').strip()
        new_version = answer if answer else suggested
        if not validate_version(new_version):
            print(f'错误：版本号格式不正确：{new_version}')
            sys.exit(1)

    if new_version == current:
        print(f'版本号未变化（仍是 {current}），无需修改。')
        return

    # 修改版本字符串的真实来源：拆分后是 src/60-ui-init.js（js/app.js 是拼接产物）。
    # 若片段存在就改片段并重新拼接；片段不存在（尚未拆分）则退回直接改 js/app.js。
    version_re = r'(离线渲染器已启用\s*\(v)[^)]*(\))'
    use_fragment = os.path.exists(VERSION_FRAGMENT)
    target = VERSION_FRAGMENT if use_fragment else APP_JS
    target_content = read_file(target)
    target_new, n_app = re.subn(
        version_re,
        lambda m: m.group(1) + new_version + m.group(2),
        target_content, count=1)
    if n_app != 1:
        print(f'错误：{os.path.relpath(target, BASE)} 中未找到版本字符串，未做任何修改。')
        sys.exit(1)

    # 修改 index.html 的全部 ?v= 参数
    index_new, n_index = re.subn(r'\?v=[0-9.]+', '?v=' + new_version, index_content)
    if n_index == 0:
        print('错误：index.html 中未找到 ?v= 版本参数，未做任何修改。')
        sys.exit(1)

    write_file(target, target_new)
    write_file(INDEX_HTML, index_new)

    # 改的是片段时必须重新拼接，否则 js/app.js 里仍是旧版本号
    if use_fragment:
        print('  重新拼接 js/app.js ...')
        rc = subprocess.call(['node', BUNDLE_SCRIPT, '--bundle'], cwd=BASE)
        if rc != 0:
            print('错误：重新拼接 js/app.js 失败，请手动运行 node tools/split_app.js --bundle')
            sys.exit(1)

    # 验证
    after_app = get_current_version()
    after_index = get_index_versions(read_file(INDEX_HTML))
    ok = after_app == new_version and after_index and set(after_index) == {new_version}
    print(f'版本号已从 {current} 更新为 {new_version}')
    print(f'  - {"src/60-ui-init.js" if use_fragment else "js/app.js"} : 已更新（{n_app} 处）')
    print(f'  - index.html  : 已更新（{n_index} 处）')
    if ok:
        print('验证通过。')
    else:
        print('警告：验证失败，请手动检查相关文件。')
        sys.exit(1)

    print()
    print('接下来请按 AI_DEVELOPMENT.md §9 流程继续执行：')
    print(f'  1. 在 CHANGELOG.md 顶部添加 [v{new_version}] 的更新记录')
    print('  2. python all_backup.py 生成备份')


if __name__ == '__main__':
    main()
