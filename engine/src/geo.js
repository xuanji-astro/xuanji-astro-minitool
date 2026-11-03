// 城市 → 经纬度：用网站同一份 cities.js（省/市/区三级，GCJ-02，占星误差可忽略）
const { CITY_DATA } = require('./engines.js');

// 直辖市省、市同名（北京市北京市）→ 只留一个
const join = (...xs) => xs.filter((x, i) => x && x !== xs[i - 1]).join('');
const strip = (s) => s.replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔|自治州|地区|盟)$/g, '');

// 输入可以是「浙江省杭州市西湖区」「杭州市」「杭州」；取最具体的一级，市级取各区平均
function locate(city) {
  const q = String(city || '').trim();
  if (!q) return null;
  let best = null;
  for (const [prov, cities] of Object.entries(CITY_DATA)) {
    for (const [c, districts] of Object.entries(cities)) {
      for (const [d, ll] of Object.entries(districts)) {
        if (q.includes(d) && (q.includes(strip(c)) || q.includes(strip(prov)))) return { lat: ll[0], lon: ll[1], name: join(prov, c, d) };
      }
      const key = strip(c);
      if (key && q.includes(key) && (!best || key.length > best.k.length)) {
        const v = Object.values(districts);
        best = { k: key, lat: v.reduce((a, x) => a + x[0], 0) / v.length, lon: v.reduce((a, x) => a + x[1], 0) / v.length, name: join(prov, c) };
      }
    }
  }
  // 只写到省一级、城市表里又没有同名市的（重庆市＝重庆城区＋重庆郊县）：取这个省第一个市（城区）的平均
  if (!best) {
    for (const [prov, cities] of Object.entries(CITY_DATA)) {
      const pk = strip(prov);
      if (pk && q.includes(pk)) {
        const [c, districts] = Object.entries(cities)[0], v = Object.values(districts);
        best = { lat: v.reduce((a, x) => a + x[0], 0) / v.length, lon: v.reduce((a, x) => a + x[1], 0) / v.length, name: join(prov, c) };
        break;
      }
    }
  }
  return best && { lat: +best.lat.toFixed(4), lon: +best.lon.toFixed(4), name: best.name };
}
module.exports = { locate };

/* ── 境外／港澳台（1102jw，11-02）──
   ① 港澳台在国内城市表里：1986–1991 那几年没有大陆夏令时，按各自时区算（给 zone）。
   ② 境外：主站「问一件事」那张七万城表（GeoNames cities5000，CC BY 4.0，vendor/world-cities.json.gz，跟主站 yinzhan/ 逐字节一样）；
      时区查 vendor/cities-world-tz.json（OSM 时区边界＋tzdata，城市点和四周 2 公里本国同一套钟点才算定；交界上的留空＝不给算，生成脚本在主站包 _工具/_打包_1102jw境外出生/时区表/）。
   输入「城市」「城市, 国家」「城市, 州, 国家」都行，中文英文都认；同名的按国家、州对上的优先，再按人口。 */
const PROV_ZONE = { 香港特别行政区: 'Asia/Hong_Kong', 澳门特别行政区: 'Asia/Macau', 台湾省: 'Asia/Taipei' };
const provZone = (name) => { for (const [p, z] of Object.entries(PROV_ZONE)) if (String(name || '').startsWith(p)) return z; return ''; };
let _W = null, _T = null;
function world() {
  if (_W) return _W;
  const src = require('./world.js')();   // 读三份数据（服务端读文件；小工具打包时换成空的，境外城市由页面自己搜好、带 zone＋ll 进来）
  if (!src) { _W = []; _W.US = {}; return _W; }
  const d = src.cities, C = d.country || {}, E = src.admin;
  _T = src.tz;
  _W = d.rows.map(([zh, en, asc, cc, a1, lat, lon, pop, alts, ens]) => {
    const country = C[cc] || cc, reg = (a1 ? a1 + ' · ' : '') + country, key = String(lat) + ',' + String(lon);
    const i = cc === 'CN' ? -1 : Object.prototype.hasOwnProperty.call(_T.k, key) ? _T.k[key] : Object.prototype.hasOwnProperty.call(_T.r, reg) ? _T.r[reg] : -1;
    return { zh: zh || en, en, cc, a1: a1 || '', a1e: (a1 && E.reg[reg]) || '', country, countryE: E.country[country] || '', lat, lon, pop: pop || 0, cn: cc === 'CN',
      zone: i >= 0 ? _T.z[i] || '' : '', names: [zh, en, asc].concat(alts || [], ens || []).filter(Boolean).map((x) => String(x).toLowerCase()) };
  });
  _W.US = E.us;
  return _W;
}
const tokens = (q) => String(q || '').toLowerCase().split(/[,，、;；\/·|]+/).map((x) => x.trim()).filter(Boolean);
function locateWorld(q) {
  const ts = tokens(q); if (!ts.length) return null;
  const W = world(), name = ts[0], rest = ts.slice(1).map((t) => (W.US[t.toUpperCase()] || t).toLowerCase());
  const same = (s, t) => !!s && (s.toLowerCase() === t || s.toLowerCase().replace(/[省州市县区都府]$/, '') === t.replace(/[省州市县区都府]$/, ''));
  let best = null, bs = -1;
  for (const r of W) {
    if (!r.names.includes(name)) continue;
    let s = 0; for (const t of rest) { if (same(r.country, t) || same(r.countryE, t) || r.cc.toLowerCase() === t || (t === 'usa' && r.cc === 'US') || (t === 'uk' && r.cc === 'GB')) s += 2; else if (same(r.a1, t) || same(r.a1e, t)) s += 3; }
    if (s > bs || (s === bs && r.pop > best.pop)) { best = r; bs = s; }
  }
  if (!best) return null;
  /* 中国大陆的（英文写的杭州之类）照国内老口径：zone 空串；境外 zone 空串＝城在本国时区交界上，调用方要拦 */
  return { lat: best.lat, lon: best.lon, name: best.zh + (best.a1 ? ' · ' + best.a1 : '') + ' · ' + best.country, zone: best.zone, world: !best.cn, cn: best.cn };
}
const LATIN = /[A-Za-z]/;
// 国内、港澳台、境外一起认。返回 { lat, lon, name, zone }：zone 空串＝国内大陆（东八，1986–1991 夏令时按大陆口径扣，老规矩）
function locateAny(city) {
  const q = String(city || '').trim(); if (!q) return null;
  if (!LATIN.test(q)) { const d = locate(q); if (d) return { ...d, zone: provZone(d.name) }; }
  return locateWorld(q) || (LATIN.test(q) ? (() => { const d = locate(q); return d && { ...d, zone: provZone(d.name) }; })() : null);
}
module.exports.locateAny = locateAny;
module.exports.locateWorld = locateWorld;
module.exports.provZone = provZone;
