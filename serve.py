#!/usr/bin/env python3
"""本地静态服务器：在项目目录下运行 python serve.py [port]

性能优化（全部基于 Python 标准库，无任何第三方依赖）：
    1. HTTP/1.1 + keep-alive —— 一次连接复用加载所有资源，不再每个文件新建 TCP 连接
    2. 条件缓存（Last-Modified / 304）—— 刷新时未改动的文件不再重传，同时保留改代码后生效的能力
    3. gzip 压缩（按 Accept-Encoding）—— 文本资源体积约降 70%
    4. 多线程处理 —— 并发请求互不阻塞

支持 PDF 导出 API：
    POST /api/export-pdf   body=HTML内容  → 返回 application/pdf

PDF 引擎：
    默认用系统自带的 Chromium 内核浏览器（Edge / Chrome）以无头模式生成 PDF，
    无需安装任何第三方软件，且**输出无水印**。
    （原先用 Prince，但其免费「非商业授权」会在每页右上角盖 "Prince" 水印，
      该水印由二进制强制添加，没有参数或 CSS 能去掉，只能靠购买授权。
      如已购买 Prince 授权，可用环境变量 MD_PDF_ENGINE=prince 切回去。）
"""
import gzip
import http.server
import json
import os
import shutil
import socketserver
import subprocess
import sys
import tempfile
from email.utils import parsedate_to_datetime
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

# ---------- PDF 引擎探测 ----------

# Chromium 内核浏览器在 PATH 上的常见命令名（按优先级）
_CHROMIUM_CMDS = (
    'msedge', 'microsoft-edge', 'google-chrome', 'google-chrome-stable',
    'chrome', 'chromium', 'chromium-browser',
)


def find_chromium():
    """查找可用的 Chromium 内核浏览器，返回可执行文件路径；找不到返回 None。

    顺序：环境变量覆盖 → PATH → 各平台默认安装位置。
    环境变量 MD_PDF_BROWSER 可指定任意路径（如绿色版 / 自定义安装位置）。
    """
    override = os.environ.get('MD_PDF_BROWSER', '').strip()
    if override:
        return override if os.path.exists(override) else None

    for name in _CHROMIUM_CMDS:
        found = shutil.which(name)
        if found:
            return found

    if sys.platform == 'win32':
        # 注意：64 位 Windows 上 Edge 也装在 Program Files (x86) 下，两个都要查
        roots = (
            os.environ.get('ProgramFiles(x86)'),
            os.environ.get('ProgramFiles'),
            os.environ.get('LOCALAPPDATA'),
        )
        rels = (
            os.path.join('Microsoft', 'Edge', 'Application', 'msedge.exe'),
            os.path.join('Google', 'Chrome', 'Application', 'chrome.exe'),
        )
        for root in roots:
            if not root:
                continue
            for rel in rels:
                candidate = os.path.join(root, rel)
                if os.path.exists(candidate):
                    return candidate
    elif sys.platform == 'darwin':
        for candidate in (
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ):
            if os.path.exists(candidate):
                return candidate
    else:
        for candidate in (
            '/usr/bin/chromium', '/usr/bin/chromium-browser',
            '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
            '/snap/bin/chromium',
        ):
            if os.path.exists(candidate):
                return candidate

    return None


def build_chromium_args(browser, html_path, pdf_path, profile_dir):
    """拼出无头浏览器的打印参数（单独抽出来便于静态校验）。

    关键参数说明：
        --headless=new        无头模式（Chrome 132+ 起 old headless 已移除，new 是唯一实现）
        --user-data-dir=...   **必须**用独立的临时 profile：若复用用户默认 profile，
                              在用户已开着浏览器时会把请求交给已运行实例，导致不产出 PDF
        --no-pdf-header-footer 关掉默认的页眉页脚（否则会印上文件路径/日期/页码）
        --print-to-pdf=...    输出路径
        末尾是待打印页面：用 file:// URI，HTML 内的图片已是 data: URL，自包含无需联网
        不传 --css-dpi：Chromium 排版本身就按 96 CSS px/英寸，与 CSS 的 px 一致
    """
    return [
        browser,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--user-data-dir=' + profile_dir,
        '--no-pdf-header-footer',
        '--print-to-pdf=' + pdf_path,
        Path(html_path).as_uri(),
    ]


# 需要 gzip 压缩的文本类扩展名（二进制文件如 png/ico/pdf 不压缩）
COMPRESSIBLE_EXT = {
    '.html', '.htm', '.js', '.mjs', '.css', '.json', '.md', '.markdown',
    '.svg', '.txt', '.xml', '.map'
}
# 小于该长度不压缩：压缩收益低于开销
COMPRESS_MIN_BYTES = 512
# gzip 结果缓存条数上限（按 路径+mtime+大小 命中，文件改动后自动失效）
GZIP_CACHE_MAX = 64

_gzip_cache = {}


def gzip_cached(abs_path, mtime_ns, size, data):
    """返回压缩结果，按 (路径, mtime, 大小) 缓存，避免每次请求重复压缩。"""
    key = (abs_path, mtime_ns, size)
    cached = _gzip_cache.get(key)
    if cached is not None:
        return cached
    packed = gzip.compress(data, 6)
    if len(_gzip_cache) >= GZIP_CACHE_MAX:
        _gzip_cache.clear()
    _gzip_cache[key] = packed
    return packed


class Handler(http.server.SimpleHTTPRequestHandler):
    # HTTP/1.1：启用 keep-alive（默认的 HTTP/1.0 会在每次响应后断开连接）
    protocol_version = 'HTTP/1.1'

    def end_headers(self):
        # no-cache：允许缓存但每次校验。既能在刷新时用 304 省掉传输，
        # 又能保证改动 JS/CSS 后刷新即可拿到新版（no-store 会导致每次都全量重传）
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    # ---------- 静态文件：条件缓存 + gzip ----------
    def serve_static(self):
        """带 Last-Modified 校验与 gzip 的静态响应；不适用时返回 False 交回父类处理。"""
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return False
        try:
            st = os.stat(path)
        except OSError:
            return False

        # 条件请求：文件自上次访问未改动 → 304，省掉整个响应体
        ims = self.headers.get('If-Modified-Since')
        if ims:
            try:
                if parsedate_to_datetime(ims).timestamp() >= int(st.st_mtime):
                    self.send_response(304, 'Not Modified')
                    self.send_header('Content-Length', '0')
                    self.end_headers()
                    return True
            except (TypeError, ValueError, OverflowError):
                pass

        try:
            with open(path, 'rb') as f:
                data = f.read()
        except OSError:
            return False

        body = data
        encoding = None
        ext = os.path.splitext(path)[1].lower()
        if (ext in COMPRESSIBLE_EXT
                and len(data) >= COMPRESS_MIN_BYTES
                and 'gzip' in self.headers.get('Accept-Encoding', '').lower()):
            packed = gzip_cached(path, st.st_mtime_ns, st.st_size, data)
            # 压缩后反而更大时（极小/高熵内容）不采用
            if len(packed) < len(data):
                body = packed
                encoding = 'gzip'

        self.send_response(200)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Last-Modified', self.date_time_string(int(st.st_mtime)))
        if encoding:
            self.send_header('Content-Encoding', encoding)
            self.send_header('Vary', 'Accept-Encoding')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)
        return True

    def do_GET(self):
        # 避免 favicon.ico 404 导致浏览器/代理等待
        if self.path == '/favicon.ico':
            # 204 按规范不带实体，也不能带 Content-Length（否则 keep-alive 下客户端会等待）
            self.send_response(204, 'No Content')
            self.end_headers()
            return
        if not self.serve_static():
            super().do_GET()

    def do_HEAD(self):
        if not self.serve_static():
            super().do_HEAD()

    # ---------- PDF 导出 API ----------
    def do_POST(self):
        if self.path == '/api/export-pdf':
            self._handle_export_pdf()
        else:
            self.send_error(404, 'Not Found')

    def send_json(self, code, payload):
        """发送 JSON 响应。HTTP/1.1 下必须带 Content-Length，否则客户端无法判断响应结束。"""
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _handle_export_pdf(self):
        tmp_html = tmp_pdf = tmp_profile = None
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            html_bytes = self.rfile.read(content_length)
            html_content = html_bytes.decode('utf-8')

            # 写入临时 HTML 文件
            tmp_html = tempfile.NamedTemporaryFile(
                suffix='.html', delete=False, dir=BASE_DIR, mode='w', encoding='utf-8'
            )
            tmp_html.write(html_content)
            tmp_html.close()

            # 输出临时 PDF 文件
            tmp_pdf = tempfile.NamedTemporaryFile(
                suffix='.pdf', delete=False, dir=BASE_DIR
            )
            tmp_pdf.close()

            engine = os.environ.get('MD_PDF_ENGINE', '').strip().lower()

            if engine == 'prince':
                # 兼容路径：已购买 Prince 授权时可用（无授权会带 "Prince" 水印）
                result = subprocess.run(
                    ['prince', '--javascript', '--css-dpi', '96',
                     '-o', tmp_pdf.name, tmp_html.name],
                    capture_output=True, text=True, timeout=60
                )
                err_text = (result.stderr or '').strip()
            else:
                # 默认：Chromium 内核无头浏览器（无水印、无需额外安装）
                browser = find_chromium()
                if not browser:
                    self.send_json(500, {
                        'error': '未找到 Edge / Chrome 浏览器。PDF 导出需要 Chromium 内核浏览器；'
                                 '请安装 Microsoft Edge 或 Google Chrome，'
                                 '或用环境变量 MD_PDF_BROWSER 指定浏览器可执行文件路径。'
                    })
                    return

                tmp_profile = tempfile.mkdtemp(prefix='md-pdf-profile-', dir=BASE_DIR)
                result = subprocess.run(
                    build_chromium_args(browser, tmp_html.name, tmp_pdf.name, tmp_profile),
                    capture_output=True, text=True, timeout=60
                )
                # 浏览器的 stderr 里会有大量与失败无关的告警，只在真正失败时才用
                err_text = (result.stderr or '').strip()

            # 判定成功与否看**产物**而不是退出码：
            # 浏览器有时会带着告警返回非 0，但 PDF 其实已经正常生成
            pdf_ok = os.path.exists(tmp_pdf.name) and os.path.getsize(tmp_pdf.name) > 0
            if not pdf_ok:
                self.send_json(500, {'error': err_text or 'PDF 生成失败：未产出文件'})
                return

            # 读取 PDF 并返回
            with open(tmp_pdf.name, 'rb') as f:
                pdf_data = f.read()

            self.send_response(200)
            self.send_header('Content-Type', 'application/pdf')
            self.send_header('Content-Length', str(len(pdf_data)))
            self.send_header('Content-Disposition', 'attachment; filename="export.pdf"')
            self.end_headers()
            self.wfile.write(pdf_data)

        except FileNotFoundError:
            self.send_json(500, {'error': '未找到浏览器或 prince 命令，请检查安装与环境变量'})
        except subprocess.TimeoutExpired:
            self.send_json(504, {'error': 'PDF 生成超时'})
        except Exception as e:
            self.send_json(500, {'error': str(e)})
        finally:
            # 清理临时文件（HTML / PDF / 浏览器 profile 目录）
            for path in (tmp_html, tmp_pdf):
                if path is None:
                    continue
                try:
                    if os.path.exists(path.name):
                        os.unlink(path.name)
                except OSError:
                    pass
            if tmp_profile:
                shutil.rmtree(tmp_profile, ignore_errors=True)


class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """多线程服务器：单个慢请求（如导出 PDF）不再阻塞其他资源加载。"""
    daemon_threads = True
    allow_reuse_address = True


Handler.extensions_map.update({
    '.md': 'text/markdown',
    '.markdown': 'text/markdown',
})

with ThreadingServer(('', PORT), Handler) as httpd:
    print(f'Serving at http://localhost:{PORT}  (Ctrl+C to stop)')
    httpd.serve_forever()
