#!/usr/bin/env python3
"""打小红书小工具 zip：dist/pkg 的「内容」压进 zip（index.html 在根），先按 minitool-builder 的自检清单逐条查，有一条不过就不出包。
用法：python3 scripts/pack.py [输出 zip 路径]"""
import os, re, sys, zipfile, hashlib
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PKG = os.path.join(ROOT, 'dist', 'pkg')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', 'xuanji-astro.zip')
ALLOWED = {'.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.json'}
BANNED = ['fetch(', 'XMLHttpRequest', 'new WebSocket', 'new EventSource', 'RTCPeerConnection', 'geolocation', 'navigator.clipboard', "execCommand('copy'",
          'navigator.bluetooth', 'navigator.usb', 'navigator.hid', 'navigator.serial', 'getBattery', 'navigator.credentials', 'navigator.locks',
          'enumerateDevices', 'getDisplayMedia', 'storage.persist', 'serviceWorker', 'new Worker(', 'SharedWorker', 'Accelerometer', 'Gyroscope', 'Magnetometer',
          'DeviceMotionEvent', 'DeviceOrientationEvent', 'devicemotion', 'deviceorientation', 'requestFullscreen', 'eval(', 'new Function', 'WebAssembly',
          'window.open(', 'window.prompt(', 'location.assign(', 'target="_blank"', ' download=', '<iframe', '<object']
# 零随机数（同盘同结论）：我们自己的代码里不许有 Math.random。网站受控引擎 engine_mbti_core.js 里 pickLine/pickName 用了随机，
# 但小工具走 method.js 的按盘指纹取一，不调这两个函数——下面查我们的代码确实没调用它们。
OURS = ['app.js', 'engine/xj_engine.js']
fail = []
files = []
for d, _, fs in os.walk(PKG):
    for f in fs:
        p = os.path.join(d, f); rel = os.path.relpath(p, PKG); files.append(rel)
        if f.startswith('.') or os.path.splitext(f)[1].lower() not in ALLOWED: fail.append(f'不允许的文件：{rel}')
        if not all(ord(c) < 128 for c in rel): fail.append(f'文件名不是 ASCII：{rel}')
if 'index.html' not in files: fail.append('根目录没有 index.html')
idx = open(os.path.join(PKG, 'index.html'), encoding='utf-8').read()
for pat, why in [(r'<script(?![^>]*\bsrc=)[^>]*>', '内联 <script>'), (r'\son[a-z]+\s*=', '行内事件'), (r'javascript:', 'javascript: 链接'), (r'<base\b', '<base>'), (r'http-equiv\s*=\s*["\']?Content-Security-Policy', '自建 CSP')]:
    if re.search(pat, idx, re.I): fail.append(f'index.html 有{why}')
if not re.search(r'viewport-fit=cover', idx) or 'lang="zh-CN"' not in idx or 'charset="UTF-8"' not in idx: fail.append('index.html 头部不合模板（viewport-fit / lang / charset）')
for rel in files:
    p = os.path.join(PKG, rel)
    if not rel.endswith(('.js', '.css', '.html')): continue
    t = open(p, 'rb').read().decode('utf-8', 'replace')
    if re.search(r'''(src|href)\s*=\s*["']https?://|url\(\s*["']?https?://|@import\s+["']?https?://''', t): fail.append(f'{rel} 引用了外部资源')
    if re.search(r'''(src|href)\s*=\s*["']/(?!/)''', t): fail.append(f'{rel} 用了绝对路径')
    for b in BANNED:
        if b in t: fail.append(f'{rel} 出现被禁用的「{b}」')
for ref in re.findall(r'''(?:src|href)=["']\./([^"']+)''', idx): 
    if ref not in files: fail.append(f'index.html 引用的 {ref} 不在包里')
for rel in OURS:
    t = open(os.path.join(PKG, rel), encoding='utf-8').read()
    for b in ['Math.random', 'pickLine', 'pickName']:
        if b in t: fail.append(f'{rel} 出现「{b}」（要零随机数）')
app = open(os.path.join(PKG, 'app.js'), encoding='utf-8').read()
for ref in re.findall(r'engine/[a-z_\-]+\.js', app):
    if ref not in files: fail.append(f'app.js 加载的 {ref} 不在包里')
big = [(r, os.path.getsize(os.path.join(PKG, r))) for r in files if r.endswith(('.png', '.jpg', '.webp')) and os.path.getsize(os.path.join(PKG, r)) > 500 * 1024]
for r, n in big: fail.append(f'图片超过 500KB：{r}')
if fail:
    print('不出包，有 %d 条没过：' % len(fail)); [print('  ✗', x) for x in fail]; sys.exit(1)
if os.path.exists(OUT): os.remove(OUT)
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    # 固定时间戳和权限：同一份源码打出的 zip 逐字节相同，上架包可以拿公开源码复现核对
    for rel in sorted(files):
        zi = zipfile.ZipInfo(rel, date_time=(1980, 1, 1, 0, 0, 0)); zi.external_attr = 0o644 << 16; zi.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(zi, open(os.path.join(PKG, rel), 'rb').read(), compresslevel=9)
with zipfile.ZipFile(OUT) as z: names = z.namelist()
assert 'index.html' in names and not any(n.startswith(('dist/', 'pkg/')) for n in names)
sha = hashlib.sha256(open(OUT, 'rb').read()).hexdigest()
print(f'自检全过 · {len(files)} 个文件 · zip {os.path.getsize(OUT) / 1024 / 1024:.2f}MB · sha256 {sha[:16]} → {OUT}')
