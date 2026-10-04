# 冒烟：24 张合成盘逐张从「最近的盘」打开，五个标签全点一遍、所有「展开」都打开、每类明细点开一次，再进保存分享页和方法页；
# 收页面报错、CSP 违规，并核对宋体显示的字都在子集里。不加任何调试开关：直接往本机档案（localStorage）放合成盘。
import sys, os, json, threading, http.server, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PKG = os.path.join(ROOT, 'dist', 'pkg')
ENG = sys.argv[1] if len(sys.argv) > 1 else 'webkit'
CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'"
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self): self.send_header('Content-Security-Policy', CSP); self.send_header('Cache-Control', 'no-store'); super().end_headers()
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Q, directory=PKG)); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
fx = json.load(open(os.path.join(ROOT, 'test', 'fixtures', 'expected.json'), encoding='utf-8'))
chars = set(json.load(open(os.path.join(ROOT, 'app', 'fonts', 'serif-chars.json'), encoding='utf-8')))
SERIF = """(sel) => { const out = []; const root = document.querySelector(sel); if (!root) return ''; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const n = w.currentNode, p = n.parentElement; if (!p || !n.textContent.trim()) continue;
    if (/XJSerif/.test(getComputedStyle(p).fontFamily.split(',')[0])) out.push(n.textContent); } return out.join(''); }"""
issues, missing, pages, sheets = [], set(), 0, 0
IMGS = "() => [...document.images].map(i => i.complete && i.naturalWidth > 0)"   # 每张图都要真的加载出来（10-02 单文件版图标空白，之前只查报错没查图）
def check(pg, sel='#app'):
    global missing
    missing |= {c for c in pg.evaluate(SERIF, sel) if c not in chars and ord(c) > 0x7f}
with sync_playwright() as p:
    b = getattr(p, ENG).launch()
    pg = b.new_context(viewport={'width': 390, 'height': 844}).new_page()
    pg.on('pageerror', lambda e: issues.append('pageerror ' + str(e)[:200]))
    pg.on('console', lambda m: issues.append('console ' + m.text[:200]) if m.type == 'error' else None)
    pg.goto(f'http://127.0.0.1:{port}/index.html')
    cases = fx['cases']
    for start in range(0, len(cases), 5):
        batch = cases[start:start + 5]
        recs = [{'id': f'T{start + i}', 'input': c['input'], 'answers': {}, 'place': c['input']['city'], 'at': 0, 'tags': {}} for i, c in enumerate(batch)]
        pg.evaluate("r => localStorage.setItem('xj.archive.v1', JSON.stringify(r))", recs); pg.reload(); pg.wait_for_timeout(300)
        for i in range(len(batch)):
            pg.wait_for_selector('.recent-main')
            if not all(pg.evaluate(IMGS)): issues.append('图片没加载出来（首页）')
            pg.query_selector_all('.recent-main')[i].click()
            pg.wait_for_selector('.rhead', timeout=60000)
            for t in range(5):
                pg.query_selector_all('.tab')[t].click(); pg.wait_for_timeout(60)
                for card in pg.query_selector_all('.node'): card.query_selector_all('.ans')[0].click()
                for a in pg.query_selector_all('.tabbody .acc-h'): a.click()
                check(pg); pages += 1
                seen = set()
                for el in pg.query_selector_all('.tabbody .tap'):
                    cls = el.get_attribute('class')
                    if cls in seen or not el.is_visible() or el.evaluate('e => e.disabled'): continue
                    seen.add(cls)
                    before = pg.evaluate('document.querySelector("#app").dataset.v + "|" + (document.querySelector(".tab.on")||{}).textContent')
                    el.click(); pg.wait_for_timeout(60)
                    if pg.query_selector('.sheet'):
                        check(pg, '.sheet'); sheets += 1
                        inner = pg.query_selector('.sheet .rowd.tap')
                        if inner: inner.click(); pg.wait_for_timeout(60); check(pg, '.sheet'); sheets += 1
                        pg.click('.sheet-hd button:last-child'); pg.wait_for_timeout(280)
                    if pg.evaluate('document.querySelector("#app").dataset.v + "|" + (document.querySelector(".tab.on")||{}).textContent') != before:
                        pg.query_selector_all('.tab')[t].click(); pg.wait_for_timeout(60)
            pg.click('.cta.dark'); pg.wait_for_timeout(100)
            for n in pg.query_selector_all('.numd:not(.open) .numd-h'): n.click()
            pg.wait_for_timeout(150)
            if not all(pg.evaluate(IMGS)): issues.append('图片没加载出来（分享页）')
            check(pg); pages += 1
            pg.click('.linkrow'); pg.wait_for_timeout(80)
            for a in pg.query_selector_all('.acc-h'): a.click()
            check(pg); pages += 1
            v = lambda: pg.evaluate('document.querySelector("#app").dataset.v')
            pg.go_back(); pg.wait_for_timeout(80)
            if v() != 'share': issues.append(f'浏览器回退：方法页应回到分享页，实际 {v()}')
            pg.click('.b-pill'); pg.wait_for_timeout(450)
            if v() != 'result': issues.append(f'底部返回：分享页应回到结果页，实际 {v()}')
            pg.click('.tohome'); pg.wait_for_selector('.home', timeout=3000)
    b.close()
srv.shutdown()
print(f'{ENG}: 合成盘 {len(fx["cases"])} 张 · 走过 {pages} 页 · 点开明细 {sheets} 次 · 报错 {len(issues)} · 宋体缺字 {len(missing)} {"".join(sorted(missing))[:80]}')
for x in issues[:10]: print(' ', x)
