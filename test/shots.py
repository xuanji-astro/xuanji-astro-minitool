# 手机尺寸走一遍完整流程并逐页截图（WebKit＝iPhone 内核）；服务端加上和小红书容器同样严格的 CSP，内联脚本／外链会直接报错。
# 用法：python3 test/shots.py OUTDIR [webkit|chromium]   —— 只用合成盘（杭州假人），不碰真人数据
import sys, os, threading, http.server, functools, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PKG = os.path.join(ROOT, 'dist', 'pkg')
OUT = sys.argv[1]; ENG = sys.argv[2] if len(sys.argv) > 2 else 'webkit'; os.makedirs(OUT, exist_ok=True)
CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'"
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self): self.send_header('Content-Security-Policy', CSP); self.send_header('Cache-Control', 'no-store'); super().end_headers()
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=PKG)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
FAKE = dict(y='1996', mo='5', d='20', hh='10', mi='30', prov='浙江省', city='杭州市', dist='西湖区')
issues = []
with sync_playwright() as p:
    b = getattr(p, ENG).launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=ENG != 'webkit' and True or None, has_touch=True)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: issues.append('pageerror ' + str(e)[:200]))
    pg.on('console', lambda m: issues.append('console ' + m.text[:200]) if m.type in ('error', 'warning') else None)
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(600)
    shot = lambda n: pg.screenshot(path=os.path.join(OUT, n + '.png'), full_page=True)
    shot('01_home')
    pg.click('.cta'); pg.wait_for_timeout(300)
    pg.wait_for_function("document.querySelectorAll('.place select').length === 3", timeout=30000)
    sels = pg.query_selector_all('.fields select')
    sels[0].select_option(FAKE['y']); sels[1].select_option(FAKE['mo'])
    pg.query_selector_all('.fields select')[2].select_option(FAKE['d'])
    t = pg.query_selector_all('.fields .triple')[1].query_selector_all('select'); t[0].select_option(FAKE['hh']); t[1].select_option(FAKE['mi'])
    pg.query_selector_all('.place select')[0].select_option(FAKE['prov']); pg.wait_for_timeout(100)
    pg.query_selector_all('.place select')[1].select_option(FAKE['city']); pg.wait_for_timeout(100)
    pg.query_selector_all('.place select')[2].select_option(FAKE['dist'])
    pg.click('text=女'); pg.click('text=家人记得清楚'); pg.click('text=前后 15 分钟')
    shot('02_form')
    pg.click('.b-next'); pg.wait_for_timeout(150); shot('03_busy')
    pg.wait_for_selector('.rhead', timeout=60000); pg.wait_for_timeout(400)
    for t, n in enumerate(['04_cover', '05_verify', '06_chart', '07_bazi', '08_time']):
        pg.query_selector_all('.tab')[t].click(); pg.wait_for_timeout(250)
        if n == '05_verify':
            for k, card in enumerate(pg.query_selector_all('.node')): card.query_selector_all('.ans')[[0, 0, 1][k % 3]].click()
        if n in ('08_time',):
            pg.query_selector_all('.accs .acc-h')[0].click(); pg.wait_for_timeout(150)
        pg.wait_for_timeout(200); shot(n)
    pg.query_selector_all('.tab')[2].click(); pg.wait_for_timeout(200)
    pg.query_selector_all('.ptbl .rowd.tap')[0].click(); pg.wait_for_timeout(400); shot('09_drawer_planet'); pg.click('.sheet-hd button:last-child'); pg.wait_for_timeout(400)
    pg.click('.cta.dark'); pg.wait_for_timeout(300); shot('10_share')
    pg.click('.linkrow'); pg.wait_for_timeout(300); shot('11_method')
    pg.click('.b-pill'); pg.wait_for_timeout(450); pg.click('.b-pill'); pg.wait_for_timeout(450); pg.click('.tohome'); pg.wait_for_timeout(500); shot('12_home_again')
    b.close()
srv.shutdown()
print('截图', len(os.listdir(OUT)), '张 →', OUT); print('问题', len(issues)); [print(' ', x) for x in issues[:12]]
