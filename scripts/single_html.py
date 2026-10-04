#!/usr/bin/env python3
"""单文件预览：把 dist/pkg 整包（样式、字体、图标、引擎、界面）内联进一个 HTML，双击就能在电脑浏览器里点，不用登录、不用起服务。
只给内部看样用；小红书上架用 pack.py 出的 zip（受控引擎文件原样，不内联）。
asteroid-ephem.js 的注释里有一段 Shift-JIS 日文，内联进 UTF-8 页面前按行转成 UTF-8（只动注释，代码逐字相同，见下方断言）。
用法：python3 scripts/single_html.py [输出路径]"""
import os, re, sys, base64
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); PKG = os.path.join(ROOT, 'dist', 'pkg')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', 'xuanji-astro_preview.html')
def text(rel):
    b = open(os.path.join(PKG, rel), 'rb').read(); lines = []
    for ln in b.split(b'\n'):
        try: lines.append(ln.decode('utf-8'))
        except UnicodeDecodeError: lines.append(ln.decode('cp932'))
    t = '\n'.join(lines)
    strip = lambda s: re.sub(r'//[^\n]*', '', re.sub(r'/\*.*?\*/', '', s, flags=re.S))
    assert strip(t) == strip(b.decode('utf-8', 'replace')), rel + '：转码动到了代码'
    assert '</script' not in t.lower(), rel + '：里面有 </script，不能直接内联'
    return t
b64 = lambda rel: base64.b64encode(open(os.path.join(PKG, rel), 'rb').read()).decode()
css = text('style.css').replace("url('./fonts/serif-b.woff2')", "url(data:font/woff2;base64," + b64('fonts/serif-b.woff2') + ")")
# 样式里引用的图片（宣纸纹理等）也内联
css = re.sub(r"url\('\./img/([a-z0-9_-]+\.png)'\)", lambda m: "url(data:image/png;base64," + b64('img/' + m.group(1)) + ")", css)
assert './img/' not in css, 'style.css 里还有没内联的图片'
app = text('app.js')
# 图片：main.js 的 img() 先找 window.XJ_IMG，单文件里没有 img/ 目录
imgs = {os.path.splitext(f)[0]: 'data:image/png;base64,' + b64('img/' + f) for f in sorted(os.listdir(os.path.join(PKG, 'img'))) if f.endswith('.png')}
assert './img/' not in app.replace('`./img/${', ''), 'app.js 里还有写死的 img/ 路径'
ENGINE = ['astronomy.js', 'asteroid-ephem.js', 'asteroid-ephem-ext.js', 'natal.js', 'engine_mbti_core.js', 'cities.js', 'tianji_personal.js', 'xj_ephem.js', 'xj_engine.js']   # 同 main.js ENGINE 顺序
html = ['<!DOCTYPE html>', '<html lang="zh-CN">', '<head>', '<meta charset="UTF-8" />',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />',
        '<title>执天玄玑 · 小工具预览</title>', '<style>', css, '</style>', '</head>', '<body>', '<main id="app"></main>', '<nav id="bar"></nav>']
html += ['<script>\n' + text('engine/' + f) + '\n</script>' for f in ENGINE]
html += ['<script>\nwindow.XJ_IMG = ' + __import__('json').dumps(imgs) + ';\n</script>', '<script>\n' + app + '\n</script>', '</body>', '</html>']
open(OUT, 'w', encoding='utf-8').write('\n'.join(html))
print('单文件预览', f'{os.path.getsize(OUT) / 1024 / 1024:.2f}MB', '→', OUT)
