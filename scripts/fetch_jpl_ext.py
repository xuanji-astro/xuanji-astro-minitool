# 从 JPL Horizons 取：①日心黄道 J2000 位置（每 10 天，1930–2100）给预算表；②地心视黄经（每月，1980–2030）给验收。只取公开天文数据，不含任何人的出生信息。
import json, urllib.request, urllib.parse, sys, os
API = 'https://ssd.jpl.nasa.gov/api/horizons.api'
def q(params):
    url = API + '?' + urllib.parse.urlencode({**params, 'format': 'json'})
    with urllib.request.urlopen(url, timeout=120) as r: return json.load(r)['result']
def rows(txt):
    s = txt.index('$$SOE') + 5; e = txt.index('$$EOE'); return [l for l in txt[s:e].strip().split('\n') if l.strip()]
out = {}
for name, cmd in [('psyche', "'16;'"), ('eros', "'433;'"), ('ceres', "'1;'")]:
    v = q({'COMMAND': cmd, 'OBJ_DATA': "'NO'", 'MAKE_EPHEM': "'YES'", 'EPHEM_TYPE': "'VECTORS'", 'CENTER': "'500@10'", 'REF_PLANE': "'ECLIPTIC'", 'REF_SYSTEM': "'ICRF'",
           'START_TIME': "'1930-01-01'", 'STOP_TIME': "'2101-01-20'", 'STEP_SIZE': "'10 d'", 'VEC_TABLE': "'1'", 'OUT_UNITS': "'AU-D'", 'CSV_FORMAT': "'YES'", 'VEC_LABELS': "'NO'"})
    vec = [[float(c) for c in (r.split(',')[0], r.split(',')[2], r.split(',')[3], r.split(',')[4])] for r in rows(v)]
    o = q({'COMMAND': cmd, 'OBJ_DATA': "'NO'", 'MAKE_EPHEM': "'YES'", 'EPHEM_TYPE': "'OBSERVER'", 'CENTER': "'500@399'", 'QUANTITIES': "'31'",
           'START_TIME': "'1980-01-01'", 'STOP_TIME': "'2030-12-01'", 'STEP_SIZE': "'1 MO'", 'CSV_FORMAT': "'YES'", 'ANG_FORMAT': "'DEG'", 'TIME_DIGITS': "'MINUTES'"})
    obs = []
    for r in rows(o):
        c = [x.strip() for x in r.split(',')]
        obs.append([c[0], float(c[3]), float(c[4])])   # 日期（UT）、黄经（of date）、黄纬
    out[name] = {'vec': vec, 'obs': obs}
    print(name, 'vec', len(vec), 'obs', len(obs), 'first obs', obs[0][:2])
json.dump(out, open(sys.argv[1] if len(sys.argv) > 1 else 'jpl.json', 'w'))
