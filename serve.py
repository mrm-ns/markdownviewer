#!/usr/bin/env python3
"""本地静态服务器：在项目目录下运行 python serve.py [port]

性能优化（全部基于 Python 标准库，无任何第三方依赖）：
    1. HTTP/1.1 + keep-alive —— 一次连接复用加载所有资源，不再每个文件新建 TCP 连接
    2. 条件缓存（Last-Modified / 304）—— 刷新时未改动的文件不再重传，同时保留改代码后生效的能力
    3. gzip 压缩（按 Accept-Encoding）—— 文本资源体积约降 70%
    4. 多线程处理 —— 并发请求互不阻塞

支持 PDF 导出 API：
    POST /api/export-pdf   body=HTML内容  → 返回 application/pdf
"""
import gzip
import http.server
import json
import os
import socketserver
import subprocess
import sys
import tempfile
from email.utils import parsedate_to_datetime

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

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

            # 调用 prince 生成 PDF
            result = subprocess.run(
                ['prince', '--javascript', '--css-dpi', '96',
                 '-o', tmp_pdf.name, tmp_html.name],
                capture_output=True, text=True, timeout=60
            )

            if result.returncode != 0 and not os.path.exists(tmp_pdf.name):
                self.send_json(500, {'error': result.stderr.strip() or 'prince 转换失败'})
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
            self.send_json(500, {'error': '未找到 prince 命令，请确认已安装并添加到环境变量'})
        except subprocess.TimeoutExpired:
            self.send_json(504, {'error': 'prince 转换超时'})
        except Exception as e:
            self.send_json(500, {'error': str(e)})
        finally:
            # 清理临时文件
            for path in (locals().get('tmp_html'), locals().get('tmp_pdf')):
                if path is None:
                    continue
                try:
                    if os.path.exists(path.name):
                        os.unlink(path.name)
                except OSError:
                    pass


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
