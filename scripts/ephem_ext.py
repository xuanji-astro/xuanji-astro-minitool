#!/usr/bin/env python3
"""生成 engine/ext/asteroid-ephem-ext.js：灵神星（16 Psyche）、爱神星（433 Eros）。
数据＝JPL Horizons 日心黄道 J2000 位置，每 10 天一格，1930–2100（scripts/fetch_jpl_ext.py 取，存 .cache/jpl_ext.json）。
受控的 asteroid-ephem.js 一字不动，新增天体都在这份扩展文件里；只上盘面，不进计分、应期、身强、交接数据。
用法：python3 scripts/ephem_ext.py [--with-ceres]   （--with-ceres 只给验收用：同一管线算谷神星，对照瑞士星历）"""
import json, struct, base64, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = json.load(open(os.path.join(ROOT, '.cache', 'jpl_ext.json')))
names = ['psyche', 'eros'] + (['ceres'] if '--with-ceres' in sys.argv else [])
jd0 = J['psyche']['vec'][0][0]; n = len(J['psyche']['vec'])
data = {}
for nm in names:
    v = J[nm]['vec']; assert len(v) == n and abs(v[0][0] - jd0) < 1e-6 and all(abs(v[i][0] - jd0 - 10 * i) < 1e-6 for i in range(n))
    data[nm] = base64.b64encode(struct.pack('<%df' % (3 * n), *[c for r in v for c in r[1:]])).decode()
js = f"""// 扩展小行星星历：灵神星（16 Psyche）、爱神星（433 Eros）。scripts/ephem_ext.py 生成，别手改。
// 数据：JPL Horizons 日心黄道 J2000 位置（AU），每 10 天一格，JD(TDB) {jd0:.1f} 起共 {n} 格（1930–2100），四点拉格朗日插值。
// 地心位置＝小行星日心 − 地球日心（Astronomy Engine），一次光行时修正，再用 Astronomy.Ecliptic 转当日黄道，口径同 computeNatal 的行星。
// 只上盘面，不进计分、应期、身强与交接数据。受控的 asteroid-ephem.js 不动。
(function () {{
  var D = {{ jd0: {jd0}, step: 10, n: {n}, bodies: {json.dumps(data)} }};
  var cache = {{}};
  function table(nm) {{
    if (cache[nm]) return cache[nm];
    var bin = atob(D.bodies[nm]), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return (cache[nm] = new Float32Array(u8.buffer));
  }}
  function helio(nm, jd) {{   // 日心黄道 J2000 [x,y,z]（AU）：取左右各两格做四点拉格朗日插值
    var f = table(nm), u = (jd - D.jd0) / D.step, i = Math.max(1, Math.min(D.n - 3, Math.floor(u))), s = u - i, out = [0, 0, 0];
    var w = [-s * (s - 1) * (s - 2) / 6, (s + 1) * (s - 1) * (s - 2) / 2, -(s + 1) * s * (s - 2) / 2, (s + 1) * s * (s - 1) / 6];
    for (var k = 0; k < 4; k++) for (var c = 0; c < 3; c++) out[c] += w[k] * f[(i - 1 + k) * 3 + c];
    return out;
  }}
  var EPS = 23.4392911 * Math.PI / 180, CE = Math.cos(EPS), SE = Math.sin(EPS), LT = 0.0057755183;   // J2000 黄赤交角；光行 1 AU 的天数
  function eqj(v) {{ return [v[0], v[1] * CE - v[2] * SE, v[1] * SE + v[2] * CE]; }}
  function geoLon(nm, date) {{
    var A = window.Astronomy, t = A.MakeTime(date), jd = t.tt + 2451545.0, e = A.HelioVector(A.Body.Earth, t);
    var a = eqj(helio(nm, jd)), g = [a[0] - e.x, a[1] - e.y, a[2] - e.z], r = Math.sqrt(g[0] * g[0] + g[1] * g[1] + g[2] * g[2]);
    a = eqj(helio(nm, jd - r * LT)); g = [a[0] - e.x, a[1] - e.y, a[2] - e.z];
    var L = A.Ecliptic(new A.Vector(g[0], g[1], g[2], t)).elon;
    return L < 0 ? L + 360 : L;
  }}
  var NAMES = {json.dumps(names)};
  window.asteroidEphemExt = function (date) {{
    var out = {{}}, d0 = new Date(date.getTime() - 864e5), d1 = new Date(date.getTime() + 864e5);
    for (var k = 0; k < NAMES.length; k++) {{
      var nm = NAMES[k], L = geoLon(nm, date), a = geoLon(nm, d0), b = geoLon(nm, d1), dd = ((b - a + 540) % 360) - 180;
      out[nm] = {{ L: L, rx: dd < 0 }};
    }}
    return out;
  }};
}})();
"""
out = os.path.join(ROOT, 'engine', 'ext', 'asteroid-ephem-ext.js') if '--with-ceres' not in sys.argv else os.path.join(ROOT, '.cache', 'asteroid-ephem-ext_with_ceres.js')
open(out, 'w', encoding='utf-8').write(js)
print(os.path.relpath(out, ROOT), os.path.getsize(out) // 1024, 'KB')
