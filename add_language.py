#!/usr/bin/env python3
"""自动添加新的代码块高亮 JS 配置文件。

用法：
    python add_language.py <language>
    python add_language.py --scan

示例：
    python add_language.py docker
    python add_language.py --scan
"""
import os
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
JS_DIR = os.path.join(BASE, 'js')
ROOT_APP = os.path.join(BASE, 'app.js')
CORE_APP = os.path.join(JS_DIR, 'app.js')
MAKE_BACKUP = os.path.join(BASE, 'all_backup.py')
PACKAGE_ENV = os.path.join(BASE, 'packup.py')

# 这些是核心文件，不作为子配置自动添加
CORE_JS = {'app.js'}


def read(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def write(path, text):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def add_to_list_if_missing(path, line):
    """在 Python FILES 列表中插入一行（如果不存在）。"""
    text = read(path)
    if line in text:
        return False
    # 在第一个 'README.md' 前插入，保持文件列表区域整洁
    marker = "    'README.md',"
    if marker in text:
        text = text.replace(marker, line + '\n' + marker, 1)
    else:
        text = text.rstrip() + '\n' + line + '\n'
    write(path, text)
    return True


def add_config_file(lang):
    """把 js/<lang>.js 加入根 app.js 的 CONFIG_FILES。"""
    path = ROOT_APP
    text = read(path)
    line = "  '" + lang + ".js',"
    # 兼容 tab 缩进
    if re.search(r"['\"]js/" + re.escape(lang) + r"\.js['\"]", text):
        return False
    # 在 'js/nginx.js' 或 'js/sql.js' 后插入
    anchor = "'js/nginx.js',"
    if anchor in text:
        text = text.replace(anchor, anchor + "\n  '" + lang + ".js',", 1)
    else:
        # 在 'js/yaml.js' 后插入
        anchor2 = "'js/yaml.js',"
        if anchor2 in text:
            text = text.replace(anchor2, anchor2 + "\n  '" + lang + ".js',", 1)
        else:
            text = text.rstrip() + "\n  '" + lang + ".js',\n"
    write(path, text)
    return True


def add_fallback(lang):
    """在 js/app.js 的 getSyntaxRules fallback 中加入 <lang>: []。"""
    path = CORE_APP
    text = read(path)
    if re.search(r'\b' + re.escape(lang) + r'\s*:', text):
        return False
    # 在 nginx: [] 后插入
    anchor = "nginx: [],"
    if anchor in text:
        text = text.replace(anchor, anchor + "\n            " + lang + ": []", 1)
    else:
        text = text.rstrip() + "\n            " + lang + ": []\n"
    write(path, text)
    return True


def add_highlight_mapping(lang):
    """在 js/app.js 的 highlightCode 中加入识别分支。"""
    path = CORE_APP
    text = read(path)
    if re.search(r"l === '" + re.escape(lang) + r"'", text):
        return False
    # 在 text/txt 分支后插入
    anchor = "if (l === 'text' || l === 'txt') return highlightWithRules(code, getSyntaxRules('text'));"
    if anchor in text:
        line = "if (l === '" + lang + "') return highlightWithRules(code, getSyntaxRules('" + lang + "'));"
        text = text.replace(anchor, anchor + "\n    " + line, 1)
    else:
        # 在 return escapeHtml(code); 前插入
        line = "if (l === '" + lang + "') return highlightWithRules(code, getSyntaxRules('" + lang + "'));"
        text = text.replace("    return escapeHtml(code);", "    " + line + "\n    return escapeHtml(code);", 1)
    write(path, text)
    return True


def create_template(lang):
    """如果 js/<lang>.js 不存在，创建模板。"""
    path = os.path.join(JS_DIR, lang + '.js')
    if os.path.exists(path):
        return False
    content = """/* {LANG} 代码块高亮子配置 */
(function () {{
  'use strict';

  window.MD_SYNTAX_RULES = window.MD_SYNTAX_RULES || {{}};

  window.MD_SYNTAX_RULES.{LANG} = [
    {{ className: 'comment', pattern: /#[^\\n]*/ }},
    {{ className: 'string', pattern: /"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'/ }},
    {{ className: 'number', pattern: /\\b\\d+(?:\\.\\d+)?\\b/ }},
    {{ className: 'keyword', pattern: /\\b(?:TODO|FIXME|KEYWORD)\\b/i }}
  ];
}})();
""".format(LANG=lang)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    return True


def process_lang(lang):
    lang = lang.strip().lower()
    if not lang or not re.match(r'^[a-z0-9_]+$', lang):
        print(f'跳过非法语言名: {lang}')
        return
    created = create_template(lang)
    added = []
    if add_config_file(lang):
        added.append('app.js CONFIG_FILES')
    if add_fallback(lang):
        added.append('js/app.js fallback')
    if add_highlight_mapping(lang):
        added.append('js/app.js highlightCode')
    # all_backup.py 和 packup.py 会自动收集 js/ 目录，无需手动添加
    print(f'语言: {lang}')
    if created:
        print('  - 已创建 js/%s.js 模板' % lang)
    if added:
        print('  - 已更新: ' + ', '.join(added))
    else:
        print('  - 无需更新（可能已经配置过）')


def scan_all():
    if not os.path.isdir(JS_DIR):
        print('js 目录不存在')
        return
    for name in sorted(os.listdir(JS_DIR)):
        if not name.endswith('.js') or name in CORE_JS:
            continue
        lang = name[:-3]
        process_lang(lang)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    if sys.argv[1] == '--scan':
        scan_all()
    else:
        process_lang(sys.argv[1])


if __name__ == '__main__':
    main()
