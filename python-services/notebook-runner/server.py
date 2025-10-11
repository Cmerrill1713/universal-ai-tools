#!/usr/bin/env python3
import json, sys, traceback, multiprocessing as mp, io, contextlib, os
from http.server import BaseHTTPRequestHandler, HTTPServer

def run_code(code: str, timeout: int = 10, cwd: str | None = None):
    def _target(q, cwd_):
        stdout = io.StringIO()
        stderr = io.StringIO()
        try:
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                if cwd_ and os.path.isdir(cwd_):
                    os.chdir(cwd_)
                safe_builtins = {
                    'print': print, 'range': range, 'len': len, 'str': str, 'int': int, 'float': float,
                    'bool': bool, 'list': list, 'dict': dict, 'set': set, 'tuple': tuple, 'enumerate': enumerate
                }
                exec(compile(code, '<notebook>', 'exec'), {'__builtins__': safe_builtins}, {})
            q.put({'ok': True, 'stdout': stdout.getvalue(), 'stderr': stderr.getvalue()})
        except Exception:
            q.put({'ok': False, 'stdout': stdout.getvalue(), 'stderr': stderr.getvalue() + traceback.format_exc()})

    q = mp.Queue()
    p = mp.Process(target=_target, args=(q, cwd))
    p.start()
    p.join(timeout)
    if p.is_alive():
        p.terminate()
        return {'ok': False, 'stdout': '', 'stderr': f'Timeout after {timeout}s'}
    return q.get()

class Handler(BaseHTTPRequestHandler):
    def _send(self, status=200, obj=None):
        data = json.dumps(obj or {}).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if self.path != '/run':
            self._send(404, {'error': 'not found'})
            return
        length = int(self.headers.get('Content-Length', '0'))
        body = self.rfile.read(length)
        try:
            payload = json.loads(body.decode('utf-8'))
        except Exception:
            self._send(400, {'error': 'invalid json'})
            return
        code = payload.get('code') or ''
        timeout = int(payload.get('timeout_sec') or 10)
        cwd = payload.get('cwd')
        if not code.strip():
            self._send(400, {'error': 'code required'})
            return
        res = run_code(code, timeout, cwd)
        self._send(200, res)

def main():
    addr = ('127.0.0.1', 8767)
    httpd = HTTPServer(addr, Handler)
    print(f'Notebook runner listening on http://{addr[0]}:{addr[1]}')
    httpd.serve_forever()

if __name__ == '__main__':
    mp.set_start_method('spawn')
    main()
