# 管线对照瑞士星历：同一批时刻，瑞士星历（seas_18，SWIEPH）算谷神星地心视黄经，对照我们管线（JPL 日心位置→减地球→光行时→当日黄道）。
# 用法：<装了 pyswisseph 的 python> test/ext_gate_swiss.py <瑞士星历文件目录>
import json, os, sys
import swisseph as swe
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
swe.set_ephe_path(sys.argv[1])
ours = json.load(open(os.path.join(ROOT, '.cache', 'ext_gate_ours.json')))
from datetime import datetime
def jd(iso): d = datetime.strptime(iso[:16], '%Y-%m-%dT%H:%M'); return swe.julday(d.year, d.month, d.day, d.hour + d.minute / 60)
errs = []
for iso, L in ours['ceres']['ours']:
    xx, flag = swe.calc_ut(jd(iso), swe.CERES, swe.FLG_SWIEPH)
    assert flag & swe.FLG_SWIEPH, '没用上瑞士星历文件'
    errs.append(abs(((L - xx[0] + 540) % 360) - 180))
import math
print(f'ceres（管线 vs 瑞士星历 seas_18）：{len(errs)} 点 · 最大误差 {max(errs) * 60:.2f}′ · 均方根 {math.sqrt(sum(e * e for e in errs) / len(errs)) * 60:.2f}′')
