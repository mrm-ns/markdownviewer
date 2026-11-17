#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""append_changelog.py — 向 CHANGELOG.md 顶部插入一条版本记录（不解析、不重排原文件）。

为什么要有它：与 `append_log.py` 同一思路 —— 写日志不该先把整个日志读一遍。
CHANGELOG.md 已经很长（1000+ 行），每次发版都要「读全文 → 找插入点 → 重写全文」，
既慢又容易在正则上翻车。

**与 append_log.py 的一个关键差异**：append_log.py 是**追加到文件末尾**；
CHANGELOG 的规范是**最新在最上面**（倒序），所以本脚本是**顶部插入**。
为了保住「代价与日志长度无关」，它不做全文解析，而是**只读取文件开头的一小段**
（默认 8KB）来定位插入点：说明块之后、第一条 `## [v...]` 记录之前。

用法:
  python append_changelog.py 1.1.11 "做了什么、为什么"        # 插入到顶部，自动补当天日期
  python append_changelog.py 1.1.11 -m "内容" --section 修复  # 指定分类（新增/修复/优化/说明）
  python append_changelog.py 1.1.11 -m "内容" --date 2026-09-24
  python append_changelog.py 1.1.11 --stdin                  # 内容来自标准输入（可多行）
  python append_changelog.py 1.1.11 -m "内容" --dry-run       # 只显示将要写入的片段
  python append_changelog.py --tail 2                        # 只看末尾 2 条记录（此选项才读取文件）
  python append_changelog.py 1.1.11 -m "内容" -f 其他.md      # 换目标文件

默认目标：脚本同目录的 `CHANGELOG.md`。
写入格式（与仓库现有结构一致）：
    ## [v1.1.11] - 2026-09-24
    ### 新增
    - **做了什么**
"""
import argparse
import datetime
import pathlib
import re
import sys

BASE = pathlib.Path(__file__).resolve().parent
DEFAULT_CHANGELOG = BASE / "CHANGELOG.md"

# 定位插入点时最多读取的**字符**数：说明块 + 第一条记录必然落在文件开头，
# 读这么多足够，代价与日志总长度无关（详见模块 docstring）。
# 注意单位是字符不是字节 —— 本文件多为中文，按字节算会少读很多。
HEAD_CHARS = 8192

SECTIONS = ("新增", "修复", "优化", "说明")


def _utf8_stdio():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


def read_head(path: pathlib.Path, limit: int = HEAD_CHARS) -> str:
    """只读取文件开头 limit **字符**（用于定位插入点）。

    注意单位是字符不是字节：本文件多为中文，8192 字节 ≈ 2700 字符，
    而插入点可能落在更深处，所以这里按字符读并在调用处与字符偏移对齐。
    """
    with path.open("r", encoding="utf-8", newline="") as fh:
        return fh.read(limit)


def find_insert_offset(head: str) -> int:
    """在文件开头里定位「新记录应插入的字符偏移」。

    优先级：
      1. 已有历史记录 → 第一条 `## [v...]` 之前；
      2. 没有历史记录（全新文件）→ 顶部说明块之后（文件末尾）。

    说明块只包含「开头的 `#` 标题 / `>` 引用行 / `---` 分隔线 / 空行」，
    一旦遇到别的正文就停下 —— 否则会把整份文件都当作说明块吞掉（踩过：
    只在说明块的文件里，新记录被插到了标题**之前**）。
    """
    m = re.search(r"^## \[v", head, re.MULTILINE)
    if m:
        return m.start()

    pos = 0
    for line in head.splitlines(keepends=True):
        stripped = line.strip()
        is_rule = bool(stripped) and set(stripped) <= {"-"}
        is_title = stripped.startswith("#") and not stripped.startswith("## [v")
        if stripped == "" or stripped.startswith(">") or is_rule or is_title:
            pos += len(line)
            continue
        break
    return pos


def build_entry(version: str, message: str, section: str, date: str) -> str:
    """生成一条记录（末尾带换行）。多行内容归入同一个条目。"""
    lines = [ln.strip() for ln in message.strip().splitlines() if ln.strip()]
    first = lines[0] if lines else ""
    if first.startswith("-"):
        body = [first]
    else:
        body = [f"- **{first}**"]
    for extra in lines[1:]:
        body.append(extra if extra.startswith("-") else "  " + extra)
    # 末尾留一个空行：否则下一条 `## [v...]` 会紧贴在最后一行后面，
    # 视觉上两条记录粘成一块（踩过）。
    return f"## [v{version}] - {date}\n### {section}\n" + "\n".join(body) + "\n\n"

def insert_entry(path: pathlib.Path, entry: str) -> int:
    """把 entry 插入到 path 的插入点，返回写入的字符数。

    做法：读够定位所需的头部 → 从头逐字符搬到插入点 → 写新记录 → 把余下内容流式搬完。
    **只用一条读取流**：先 read(offset) 跳过插入点之前的内容，再分块读到结尾。
    这里曾犯过一个错：既写入 head[offset:]（定位时读到的那一段），又接着流式读取
    文件的其余部分，于是 offset..HEAD 之间的内容被写了**两遍**，日志凭空多出十几 KB
    （实测 107KB → 122KB，且旧版本标题重复出现）。**定位用的头部只用于算偏移，
    绝不能当成正文的一部分再写一次。**
    """
    # 先用一条流读完「说明块 + 第一条记录」所在的头部，只为定位
    with path.open("r", encoding="utf-8", newline="") as fh:
        head = fh.read(HEAD_CHARS)

    # 空文件（或只有空白）：没有可定位的头部，直接把记录写进去即可
    if not head.strip():
        offset = 0
        before = "---\n\n" if head == "" else "---\n\n"
    else:
        offset = find_insert_offset(head)
        # 边界：插入点之前是「说明块」，之后必须留一个干净的 `---` 分隔。
        # 说明块本身通常以 `---` 结尾（仓库现状如此），此时不再重复添加，否则会出现
        # 连续两条 `---`（踩过）。判据：插入点往前的最后一行是否为分隔线或空行。
        stripped_prefix = head[:offset].rstrip("\n")
        lines = stripped_prefix.splitlines()
        last_line = lines[-1].strip() if lines else ""

        if last_line == "---":
            before = stripped_prefix + "\n\n"      # 说明块已带分隔线
        elif last_line == "":
            before = "---\n\n"                     # 文件开头就是空的，直接起分隔线
        else:
            before = stripped_prefix + "\n\n---\n\n"

    tmp = path.with_suffix(path.suffix + ".tmp")
    try:
        with path.open("r", encoding="utf-8", newline="") as src, \
                tmp.open("w", encoding="utf-8", newline="") as dst:
            dst.write(before)
            dst.write(entry.rstrip("\n") + "\n\n")
            src.read(offset)                   # 跳过插入点之前的内容（已写入 before）
            # 原插入点的前导空行会和 entry 末尾的空行叠成两个空行，先吃掉它们
            first = src.read(65536)
            dst.write(first.lstrip("\r\n"))
            while True:                        # 余下内容流式搬运，不整体载入内存
                chunk = src.read(65536)
                if not chunk:
                    break
                dst.write(chunk)
        tmp.replace(path)
    except Exception:
        if tmp.exists():
            tmp.unlink()
        raise
    return len(before) + len(entry)


def tail(path: pathlib.Path, n: int) -> int:
    if not path.exists():
        sys.stderr.write(f"[append_changelog] 日志不存在：{path}\n")
        return 1
    text = path.read_text(encoding="utf-8")
    versions = re.findall(r"^## \[v([^\]]+)\] - (.+)$", text, re.MULTILINE)
    if not versions:
        sys.stderr.write(f"[append_changelog] 未找到任何版本记录（{path.name}）\n")
        return 1
    for ver, date in versions[:n]:      # 倒序排列，取开头即为最新
        print(f"v{ver}  {date}")
    print(f"[append_changelog] 共 {len(versions)} 条，已显示最新 {min(n, len(versions))} 条（{path.name}）")
    return 0


def _sanitize(text: str) -> str:
    """剔除无法编码为 UTF-8 的代理字符（surrogates）。

    为什么要这一步：Windows 下用管道传入中文时（`"..." | python x.py --stdin`），
    PowerShell 可能把文本拆成孤立的代理码位，直接写文件会抛
    `UnicodeEncodeError: surrogates not allowed`。这里就地清洗，
    让脚本在任何终端下都能正常工作，而不是丢一个 traceback 给用户。
    """
    return text.encode("utf-8", "ignore").decode("utf-8", "ignore")


def main(argv=None) -> int:
    _utf8_stdio()
    ap = argparse.ArgumentParser(
        prog="append_changelog.py",
        description="向 CHANGELOG.md 顶部插入一条版本记录（不解析、不重排原文件）。",
    )
    ap.add_argument("version", nargs="?", help="版本号，如 1.1.11（--tail 时可省略）")
    ap.add_argument("text", nargs="*", help="记录内容；也可用 -m / --stdin")
    ap.add_argument("-m", "--message", default=None, help="记录内容（优先于位置参数）")
    ap.add_argument("-f", "--file", default=str(DEFAULT_CHANGELOG), help="目标文件（默认 CHANGELOG.md）")
    ap.add_argument("--date", default=None, help="日期 YYYY-MM-DD（默认今天）")
    ap.add_argument("--section", default="新增", choices=SECTIONS, help="分类（默认 新增）")
    ap.add_argument("--stdin", action="store_true", help="从标准输入读取内容")
    ap.add_argument("--tail", type=int, default=None, help="只打印最新 N 条记录（会读取文件）")
    ap.add_argument("--dry-run", action="store_true", help="只显示将要写入的内容，不真正写入")
    ap.add_argument("--force", action="store_true", help="即使已存在同版本记录也照写")
    args = ap.parse_args(argv)

    path = pathlib.Path(args.file)
    if args.tail is not None:
        return tail(path, args.tail)

    if not args.version:
        sys.stderr.write("[append_changelog] 缺少版本号；用法：python append_changelog.py 1.1.11 \"内容\"\n")
        return 2
    version = args.version.strip().lstrip("v")
    if not re.fullmatch(r"\d+(?:\.\d+)*", version):
        sys.stderr.write(f"[append_changelog] 版本号格式不正确：{args.version}（应类似 1.1.11）\n")
        return 2

    if args.stdin:
        content = sys.stdin.buffer.read().decode("utf-8", "replace")
    elif args.message:
        content = args.message
    else:
        content = " ".join(args.text)
    content = _sanitize(content).strip()
    if not content:
        sys.stderr.write("[append_changelog] 内容为空；用法：python append_changelog.py 1.1.11 \"做了什么、为什么\"\n")
        return 2

    if not path.exists():
        sys.stderr.write(f"[append_changelog] 目标文件不存在：{path}\n")
        return 1

    if not args.force:
        head = read_head(path)
        if re.search(r"^## \[v" + re.escape(version) + r"\]", head, re.MULTILINE):
            sys.stderr.write(f"[append_changelog] 已存在 v{version} 记录，未写入（用 --force 可强制写入）\n")
            return 3
    date = args.date or datetime.date.today().isoformat()
    entry = build_entry(version, content, args.section, date)

    if args.dry_run:
        sys.stdout.write("[dry-run] 将插入到文件顶部：\n" + entry)
        return 0

    written = insert_entry(path, entry)
    sys.stdout.write(f"[append_changelog] 已写入 {path.name} 顶部：v{version}（{args.section}，{written} 字符）\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
