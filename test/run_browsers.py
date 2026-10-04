# 用 Playwright 在 Chromium 和 WebKit 里各跑一遍 test/run.html，报告逐字一致的条数和每盘耗时
import sys, json, threading, http.server, socketserver, os, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
engines = sys.argv[1:] or ['chromium', 'webkit']
with sync_playwright() as p:
    for name in engines:
        b = getattr(p, name).launch(); pg = b.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.goto(f'http://127.0.0.1:{port}/test/run.html')
        try: pg.wait_for_function('window.__RESULT', timeout=900000, polling=2000)
        except Exception as e: print(name, '超时', errs[:3]); b.close(); continue
        if errs and not pg.evaluate('window.__RESULT'): print(name, '页面报错', errs[:3]); b.close(); continue
        r = pg.evaluate('window.__RESULT')
        ms = r['ms']; print(f"{name}: 逐字一致 {r['same']}/{len(ms)}  取整到 1e-6 后一致 {r['sameRounded']}/{len(ms)}  首盘 {ms[0] if ms else '-'}ms  其余中位 {sorted(ms[1:])[len(ms[1:])//2] if len(ms)>1 else '-'}ms  合计 {sum(ms)}ms  页面报错 {len(errs)}  星历表 {r.get('ephDays')} 格")
        for d in r['diff'][:5]: print('  diff', json.dumps(d, ensure_ascii=False)[:300])
        for e in errs[:3]: print('  err', e)
        b.close()
srv.shutdown()
