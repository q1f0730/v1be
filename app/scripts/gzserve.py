#!/usr/bin/env python3
"""带 gzip 的静态服务器（预览用，零依赖）。

用法：python3 scripts/gzserve.py <端口> <目录>
- 文本类文件（html/js/css/json/svg/txt/map）且 >1KB、客户端 Accept-Encoding 含 gzip 时，返回 gzip（level 6），
  压缩结果按 (路径, mtime, 大小) 缓存在内存里，同一文件只压一次。
- /assets/ 下带 hash 的文件给长缓存（immutable），其他文件 no-cache。
- 多线程（ThreadingHTTPServer），只读，不列目录。
"""
import gzip, os, sys, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

COMPRESS = {'.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.map', '.xml', '.webmanifest'}
_cache, _lock = {}, threading.Lock()


def gz_bytes(path, st):
    key = (path, st.st_mtime_ns, st.st_size)
    with _lock:
        hit = _cache.get(key)
    if hit is not None:
        return hit
    with open(path, 'rb') as f:
        data = gzip.compress(f.read(), compresslevel=6, mtime=0)
    with _lock:
        for k in [k for k in _cache if k[0] == path]:
            del _cache[k]
        _cache[key] = data
    return data


class H(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript',
                      '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.css': 'text/css'}

    def list_directory(self, path):
        self.send_error(404); return None

    def end_headers(self):
        p = self.path.split('?', 1)[0]
        self.send_header('Cache-Control', 'public, max-age=31536000, immutable' if p.startswith('/assets/') else 'no-cache')
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            idx = os.path.join(path, 'index.html')
            if not self.path.split('?', 1)[0].endswith('/'):
                return super().send_head()
            path = idx
        ext = os.path.splitext(path)[1].lower()
        ae = self.headers.get('Accept-Encoding', '')
        if ext in COMPRESS and 'gzip' in ae and os.path.isfile(path):
            st = os.stat(path)
            if st.st_size > 1024:
                body = gz_bytes(path, st)
                self.send_response(200)
                self.send_header('Content-Type', self.guess_type(path) + ('; charset=utf-8' if ext in {'.html', '.js', '.mjs', '.css', '.json', '.txt', '.svg'} else ''))
                self.send_header('Content-Encoding', 'gzip')
                self.send_header('Vary', 'Accept-Encoding')
                self.send_header('Content-Length', str(len(body)))
                self.send_header('Last-Modified', self.date_time_string(st.st_mtime))
                self.end_headers()
                import io
                return io.BytesIO(body)
        return super().send_head()

    def log_message(self, fmt, *args):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3001
    root = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.getcwd()
    ThreadingHTTPServer.daemon_threads = True
    srv = ThreadingHTTPServer(('0.0.0.0', port), lambda *a, **k: H(*a, directory=root, **k))
    print(f'gzserve: http://0.0.0.0:{port}/ <- {root}', flush=True)
    srv.serve_forever()
