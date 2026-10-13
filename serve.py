#!/usr/bin/env python3
"""简单静态服务器：在项目目录下运行 python serve.py [port]"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 开发阶段禁用缓存，避免改代码后浏览器仍加载旧版 JS/CSS
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_GET(self):
        # 避免 favicon.ico 404 导致浏览器/代理等待
        if self.path == '/favicon.ico':
            self.send_response(204, 'No Content')
            self.end_headers()
            return
        super().do_GET()


Handler.extensions_map.update({
    '.md': 'text/markdown',
    '.markdown': 'text/markdown',
})

with socketserver.TCPServer(('', PORT), Handler) as httpd:
    print(f'Serving at http://localhost:{PORT}  (Ctrl+C to stop)')
    httpd.serve_forever()
