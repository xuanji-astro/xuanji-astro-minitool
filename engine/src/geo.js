// 城市 → 经纬度：用网站同一份 cities.js（省/市/区三级，GCJ-02，占星误差可忽略）
const { CITY_DATA } = require('./engines.js');

// 直辖市省、市同名（北京市北京市）→ 只留一个
const join = (...xs) => xs.filter((x, i) => x && x !== xs[i - 1]).join('');

/* 11-18 改写。原来的认法：区县名「包含」就算（石渠县里有「渠县」、江城区里有「城区」），
   省名对上就行、不看市名 → 城市表 3209 个区县认错 33 个（石渠县→达州渠县 870 公里，真太阳时差 35 分钟；大同市矿区→阳泉矿区）。
   现在：省、市从头认（全称或简称都试，几种读法里挑认得最具体的），区县名要整个对上（或去掉「区／县／市／旗」对上）；
   写了市只在这个市里找；对不上的老地名退回市一级（不跑去别的城市）；没写市又有同名区县的认不准，返回 null，不猜。
   只写到市＝这个市的中心城区，只写到省＝第一个市的中心城区，跟网站档案「区县不详／城市不详」同一条（城市表头一个区，重庆取渝中区）；原来取各区平均。 */
const ETH = /(藏族|羌族|彝族|苗族|侗族|土家族|布依族|哈尼族|傣族|景颇族|傈僳族|白族|壮族|回族|蒙古族|哈萨克|朝鲜族|柯尔克孜|黎族|土族|撒拉族|仫佬族|毛南族|仡佬族|瑶族|畲族|水族|满族|锡伯族|达斡尔族|鄂伦春族|鄂温克族)/;
const uniq = (a) => [...new Set(a.filter((x) => x && x.length >= 2))].sort((x, y) => y.length - x.length);
const provKeys = (p) => uniq([p, p.replace(/(壮族|回族|维吾尔)?(省|市|自治区|特别行政区)$/, '')]);
const cityKeys = (c) => { const i = c.search(ETH), k = [c, c.replace(/(市|地区|盟)$/, ''), c.replace(/自治州$/, '')]; if (i >= 2) k.push(c.slice(0, i), c.slice(0, i) + '州'); return uniq(k); };
const distKeys = (d) => uniq([d, d.replace(/(自治县|自治旗|林区|特区|区|县|市|旗)$/, '')]);
const centerOf = (p, c) => { const ds = CITY_DATA[p][c] || {}, ks = Object.keys(ds), k = ks.includes('渝中区') ? '渝中区' : ks[0]; return k ? ds[k] : null; };
function locate(city) {
  const q = String(city || '').replace(/\s+/g, '');
  if (!q) return null;
  const provs = Object.keys(CITY_DATA), C = [];   // 候选：[几级（3 区县全名／2 市／1.8 区县简称／1 省）, 认上几个字, 省, 市, 区县, 经纬度, 是否整名对上]；区县简称（去掉区县）撞上市名时认市：「大同」＝大同市不是大庆大同区，「新疆乌鲁木齐」＝乌鲁木齐市不是乌鲁木齐县
  const P0 = [[null, 0]].concat(provs.flatMap((p) => provKeys(p).filter((k) => q.startsWith(k)).map((k) => [p, k.length])));
  for (const [p, pl] of P0) {
    const r1 = q.slice(pl), pool = p ? [p] : provs;
    if (p && !r1) { const c0 = Object.keys(CITY_DATA[p])[0], ll = c0 && centerOf(p, c0); if (ll) C.push([1, pl, p, c0, '', ll, true]); continue; }
    const C0 = [[null, null, 0]].concat(pool.flatMap((pp) => Object.keys(CITY_DATA[pp]).flatMap((c) => cityKeys(c).filter((k) => r1.startsWith(k)).map((k) => [pp, c, k.length]))));
    for (const [pp, c, cl] of C0) {
      const r2 = r1.slice(cl);
      if (c && !r2) { const ll = centerOf(pp, c); if (ll) C.push([2, pl + cl, pp, c, '', ll, true]); continue; }
      let hit = false;
      for (const xp of c ? [pp] : pool) for (const xc of c ? [c] : Object.keys(CITY_DATA[xp])) for (const [d, ll] of Object.entries(CITY_DATA[xp][xc])) {
        if (distKeys(d).includes(r2)) { C.push([r2 === d ? 3 : 1.8, pl + cl + r2.length, xp, xc, d, ll, true]); hit = true; }
      }
      if (c && !hit) { const ll = centerOf(pp, c); if (ll) C.push([2, pl + cl, pp, c, '', ll, false]); }   // 老地名、写错的区县：退回这个市
    }
  }
  if (!C.length) return null;
  C.sort((a, b) => (b[6] - a[6]) || (b[0] - a[0]) || (b[1] - a[1]));
  const top = C[0], same = C.filter((x) => x[6] === top[6] && x[0] === top[0] && x[1] === top[1]);
  if (new Set(same.map((x) => x[2] + x[3] + x[4])).size > 1) return null;   // 同样具体的有两处（没写市、两个市都有这个区）：认不准，不猜
  const [, , p, c, d, ll] = top;
  return { lat: +(+ll[0]).toFixed(4), lon: +(+ll[1]).toFixed(4), name: join(p, c, d) };
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
