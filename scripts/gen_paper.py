#!/usr/bin/env python3
"""宣纸纹理平铺块（10-02 从三种背景里定稿的「宣纸墨韵」）：细噪点＋短纤维，只有暗面、半透明，叠在浅底上。种子写死，重跑结果一样。
用法：python3 scripts/gen_paper.py → app/img/paper.png"""
import math, os, random
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
random.seed(20261002); W = 240
im = Image.new('L', (W, W), 128); px = im.load()
for y in range(W):
    for x in range(W): px[x, y] = 128 + random.randint(-14, 14)
im = im.filter(ImageFilter.GaussianBlur(.6)); d = ImageDraw.Draw(im)
for _ in range(70):
    x, y, a, L = random.randint(0, W), random.randint(0, W), random.random() * math.pi, random.randint(8, 30)
    d.line([(x, y), (x + L * math.cos(a), y + L * math.sin(a))], fill=128 + random.choice([-26, 26]), width=1)
px = im.load(); out = Image.new('RGBA', (W, W)); po = out.load()
for y in range(W):
    for x in range(W):
        v = px[x, y] - 128; po[x, y] = (60, 40, 20, int(-v * 1.1)) if v < 0 else (0, 0, 0, 0)
out.save(os.path.join(ROOT, 'app', 'img', 'paper.png'), optimize=True)
print('paper.png', os.path.getsize(os.path.join(ROOT, 'app', 'img', 'paper.png')) // 1024, 'KB')
