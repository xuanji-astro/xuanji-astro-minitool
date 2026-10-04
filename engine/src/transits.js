// 西盘应期 v0：跨几十年的行运扫描（规则 2026-10-01 先定死再跑，教科书口径）
// 星历、相位定义、宫位落点全部用天机页 tianji_personal.js 导出的扫描件（TJME.lon / houseOfC / BODIES），算法不改；
// 这里只做三件它没做的：①逐次（每一轮过境）而不是区间最紧一次 ②加四轴 ③木土进宫、回归、小限。
const { TJME } = require('./engines.js');

const SIGNS = TJME.SIGNS;
const RULER = { 白羊: '火星', 金牛: '金星', 双子: '水星', 巨蟹: '月亮', 狮子: '太阳', 处女: '水星', 天秤: '金星', 天蝎: '火星', 射手: '木星', 摩羯: '土星', 水瓶: '土星', 双鱼: '木星' };   // 古典守护，同 tianji_personal.js
const ASP = [[0, '合'], [60, '六合'], [90, '刑'], [120, '拱'], [180, '冲']];   // 同 tianji_personal.js
const SLOW = ['土星', '天王', '海王', '冥王'];
const ORB = 1.5;   // 慢星紧相位，同天机日报「大背景」的 1.5°

// 宫位 → 领域（报告里用的几块人生）
const HOUSE_DOMAIN = { 1: '自我', 2: '钱', 3: '学习', 4: '家庭居所', 5: '感情', 6: '工作', 7: '感情', 8: '钱', 9: '远方', 10: '事业认可', 11: '人脉', 12: '远方' };
const ANGLE_DOMAIN = { 上升: '自我', 天顶: '事业认可', 天底: '家庭居所', 下降: '感情' };
const NATURE = { 金星: '感情', 月亮: '家庭居所', 太阳: '自我' };

const body = (n) => TJME.BODIES.find((b) => b[0] === n)[1];
// 慢星星历缓存（10-02 部署前）：行运扫描都在 UTC 零点取样，同一天同一颗星对所有用户都一样——算过就记下，
// 下次直接取。数值就是 TJME.lon 自己算出来的那个，结果逐位不变；只快。启动后另有后台线程预算常用年份（ephem_warm.js）。
const EPH_DAY0 = Date.UTC(1900, 0, 1) / 864e5, EPH_N = Date.UTC(2101, 0, 1) / 864e5 - EPH_DAY0;
const EPH = new Map();   // 星名 → Float64Array（1900–2100 每天一格，NaN＝还没算）
function lonOf(m, d) {
  const t = d.getTime(), k = t / 864e5 - EPH_DAY0;
  if (t % 864e5 !== 0 || k < 0 || k >= EPH_N) return TJME.lon(body(m), d);
  let c = EPH.get(m); if (!c) EPH.set(m, (c = new Float64Array(EPH_N).fill(NaN)));
  let v = c[k];
  if (v !== v) { v = TJME.lon(body(m), d); c[k] = v; }
  return v;
}
function ephemFill(m, day0, arr) { let c = EPH.get(m); if (!c) EPH.set(m, (c = new Float64Array(EPH_N).fill(NaN))); for (let i = 0; i < arr.length; i++) { const k = day0 + i - EPH_DAY0; if (k >= 0 && k < EPH_N && c[k] !== c[k]) c[k] = arr[i]; } }
const angDist = (a, b) => { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const ymd = (d) => d.toISOString().slice(0, 10);

// 本命点：十大行星＋四轴；每个点带「它管哪几块人生」
function natalPoints(N) {
  const cusps = N.houses.map((h) => h.L);
  const ascRuler = RULER[N.angles.asc.sign];
  const pts = N.planets.filter((p) => p.n !== '凯龙').map((p) => {
    const ruled = N.houses.filter((h) => RULER[h.sign] === p.n).map((h) => h.num);
    const doms = new Set([...ruled.map((h) => HOUSE_DOMAIN[h]), HOUSE_DOMAIN[p.house], NATURE[p.n]].filter(Boolean));
    return { n: p.n, L: p.L, key: p.n === '太阳' || p.n === '月亮' || p.n === ascRuler, domains: [...doms], why: `落${p.house}宫` + (ruled.length ? `、${ruled.join('、')}宫主` : '') + (p.n === ascRuler ? '、命主星' : '') };
  });
  const A = N.angles;
  for (const [n, L] of [['上升', A.asc.L], ['天顶', A.mc.L], ['下降', (A.asc.L + 180) % 360], ['天底', (A.mc.L + 180) % 360]])
    pts.push({ n, L, key: true, angle: true, domains: [ANGLE_DOMAIN[n]], why: '四轴' });
  return { pts, cusps };
}

// 逐日扫，连续在容许度内的日子算一次过境；同一组合 400 天内的几次（逆行来回）并成一个窗口
function scanAspects(N, from, to, step = 1, opt = {}) {
  const { pts } = natalPoints(N);
  const movers = [...SLOW, '木星'];
  const open = {}, passes = [];
  for (let t = from.getTime(); t <= to.getTime(); t += step * 864e5) {
    const d = new Date(t);
    for (const m of movers) {
      const L = lonOf(m, d);
      for (const p of pts) {
        const dd = angDist(L, p.L);
        for (const [a, nm] of ASP) {
          if (m === '木星' && nm !== '合' && !(opt.jupiterSoft && (nm === '拱' || nm === '六合'))) continue;   // 木星只看合（月历另看拱、六合）
          const key = m + nm + p.n, orb = Math.abs(dd - a);
          if (orb <= ((opt.orb && opt.orb[m]) || ORB)) {
            const o = open[key] || (open[key] = { mover: m, asp: nm, point: p, start: d, best: { orb, date: d } });
            if (orb < o.best.orb) o.best = { orb, date: d };
            o.last = d;
          } else if (open[key]) { passes.push(open[key]); delete open[key]; }
        }
      }
    }
  }
  passes.push(...Object.values(open));
  const merged = [];
  for (const p of passes.sort((a, b) => a.start - b.start)) {
    const key = p.mover + p.asp + p.point.n;
    const prev = merged.find((x) => x.key === key && p.start - x.last < 400 * 864e5);
    if (prev) { prev.last = p.last; prev.exacts.push(ymd(p.best.date)); }
    else merged.push({ key, mover: p.mover, asp: p.asp, point: p.point, start: p.start, last: p.last, exacts: [ymd(p.best.date)] });
  }
  return merged;
}

// 木星、土星进宫（Placidus 宫头，同天机 houseOfC）；逆行退回再进只记第一次
function scanIngress(N, from, to, step = 1) {
  const { cusps } = natalPoints(N), out = [];
  for (const m of ['土星', '木星']) {
    let prev = TJME.houseOfC(lonOf(m, from), cusps), seen = new Set();
    for (let t = from.getTime() + step * 864e5; t <= to.getTime(); t += step * 864e5) {
      const d = new Date(t), h = TJME.houseOfC(lonOf(m, d), cusps);
      if (h !== prev) {
        const k = m + h + d.getUTCFullYear();
        if (!seen.has(m + h) || !out.find((x) => x.k === k)) out.push({ k, mover: m, house: h, date: ymd(d) });
        seen.add(m + h); prev = h;
      }
    }
  }
  return out.filter((x, i, a) => a.findIndex((y) => y.mover === x.mover && y.house === x.house && Math.abs(new Date(y.date) - new Date(x.date)) < 400 * 864e5) === i);
}

// 小限：每岁一宫（整宫制，从上升星座起），当年主星＝那一宫星座的守护星
function profection(N, age) {
  const ai = SIGNS.indexOf(N.angles.asc.sign), house = (age % 12) + 1, sign = SIGNS[(ai + age % 12) % 12];
  return { age, house, sign, lord: RULER[sign], domain: HOUSE_DOMAIN[house] };
}

// 按年打分：每年每块人生多少分、为什么
function westYearly(N, birthYear, fromYear, toYear) {
  const from = new Date(Date.UTC(fromYear, 0, 1)), to = new Date(Date.UTC(toYear, 11, 31));
  const asp = scanAspects(N, from, to), ing = scanIngress(N, from, to);
  const years = {};
  const add = (y, dom, w, why) => { if (y < fromYear || y > toYear) return; const r = (years[y] = years[y] || {}); (r[dom] = r[dom] || { w: 0, why: [] }); r[dom].w += w; r[dom].why.push(why); };
  for (const a of asp) {
    const hard = a.asp === '合' || a.asp === '冲' || a.asp === '刑';
    let w;
    if (a.mover === '木星') w = a.point.key ? 1.5 : 0.8;
    else if (!hard) w = 0.8;
    else w = a.point.angle ? 3 : a.point.key ? 2.5 : 1.5;
    const ys = new Set(a.exacts.map((e) => +e.slice(0, 4)));
    for (const y of ys) {
      const pf = profection(N, y - birthYear);
      const lordHit = pf.lord === a.point.n;
      for (const dom of a.point.domains) add(y, dom, lordHit ? w * 1.5 : w, `${a.mover}${a.asp}本命${a.point.n}（${a.point.why}）${lordHit ? '·当年小限主星' : ''}`);
    }
  }
  for (const i of ing) add(+i.date.slice(0, 4), HOUSE_DOMAIN[i.house], i.mover === '土星' ? 1.5 : 1, `${i.mover}进${i.house}宫`);
  for (const a of asp.filter((x) => x.asp === '合' && x.mover === x.point.n)) for (const e of new Set(a.exacts.map((x) => +x.slice(0, 4)))) add(e, '全局', 2, `${a.mover}回归`);
  for (let y = fromYear; y <= toYear; y++) { const pf = profection(N, y - birthYear); add(y, pf.domain, 0.5, `小限走${pf.house}宫（主星${pf.lord}）`); }
  return { years, aspects: asp, ingress: ing };
}

module.exports = { westYearly, scanAspects, scanIngress, profection, natalPoints, lonOf, ephemFill, EPH };

// ── v1（2026-10-01 收紧，原则先定再跑）：只算慢星对关键点的硬相位；一颗本命星只归一块人生（天机口径：宫主 > 落宫 > 本性）；一次过境只算最紧那一年 ──
const DOMAIN_HOUSES_V1 = { 感情: [7, 5], 家庭居所: [4], 远方: [9, 12], 事业认可: [10], 工作: [6], 钱: [2, 8], 自我: [1] };
const NATURE_V1 = { 金星: '感情', 月亮: '家庭居所', 太阳: '自我', 木星: '远方', 土星: '事业认可', 火星: '工作', 水星: '自我' };
function domainOfV1(N, p) {
  const order = Object.keys(DOMAIN_HOUSES_V1);
  for (const dom of order) for (const h of DOMAIN_HOUSES_V1[dom]) { const cusp = N.houses.find((x) => x.num === h); if (cusp && RULER[cusp.sign] === p.n) return { dom, why: `${h}宫主` }; }
  for (const dom of order) if (DOMAIN_HOUSES_V1[dom].includes(p.house)) return { dom, why: `落${p.house}宫` };
  return NATURE_V1[p.n] ? { dom: NATURE_V1[p.n], why: '按本性' } : null;
}
function westYearlyV1(N, birthYear, fromYear, toYear, step = 1) {
  const from = new Date(Date.UTC(fromYear, 0, 1)), to = new Date(Date.UTC(toYear, 11, 31));
  const asp = scanAspects(N, from, to, step), ing = scanIngress(N, from, to, step);
  const ascRuler = RULER[N.angles.asc.sign];
  const domRulers = new Set(Object.values(DOMAIN_HOUSES_V1).flat().map((h) => RULER[N.houses.find((x) => x.num === h).sign]));
  const years = {};
  const add = (y, dom, w, why) => { if (y < fromYear || y > toYear || !dom) return; const r = (years[y] = years[y] || {}); (r[dom] = r[dom] || { w: 0, why: [] }); r[dom].w += w; r[dom].why.push(why); };
  for (const a of asp) {
    if (!['合', '冲', '刑'].includes(a.asp)) continue;
    const p = a.point, nat = N.planets.find((x) => x.n === p.n);
    if (p.angle && a.asp !== '合') continue;   // 四轴互为对冲和四分：冲上升＝合下降、刑上升＝合天顶或天底，只算合，避免一件事记两次
    const keyPt = p.angle || p.n === '太阳' || p.n === '月亮' || p.n === ascRuler || domRulers.has(p.n);
    if (!keyPt) continue;
    if (a.mover === '木星' && !(p.angle || p.n === '太阳' || p.n === '月亮' || p.n === ascRuler)) continue;
    const d = p.angle ? { dom: ANGLE_DOMAIN[p.n], why: '四轴' } : domainOfV1(N, nat);
    if (!d) continue;
    const peak = a.exacts.slice().sort()[Math.floor((a.exacts.length - 1) / 2)];   // 多次过境取中间那次，一次过境只算一年
    const y = +peak.slice(0, 4), pf = profection(N, y - birthYear), lordHit = pf.lord === p.n;
    const w = (a.mover === '木星' ? 1.5 : p.angle ? 3 : 2) * (lordHit ? 1.5 : 1);
    add(y, d.dom, w, `${a.mover}${a.asp}本命${p.n}（${d.why}）${lordHit ? '·小限主星' : ''}`);
  }
  for (const i of ing) if ([1, 4, 7, 10].includes(i.house) || (i.mover === '木星' && [5, 9].includes(i.house))) add(+i.date.slice(0, 4), HOUSE_DOMAIN[i.house], i.mover === '土星' ? 1.5 : 1, `${i.mover}进${i.house}宫`);
  for (const a of asp.filter((x) => x.asp === '合' && x.mover === x.point.n)) add(+a.exacts[0].slice(0, 4), '全局', 2, `${a.mover}回归`);
  return { years, aspects: asp, ingress: ing };
}
module.exports.westYearlyV1 = westYearlyV1;

// ── 月历（2026-10-02：行运写到更多年、近两年半细到月）──
// 只列事实窗口，不打分：v1 那套硬相位（慢星→关键点、四轴只算合）＋木星合／拱／六合日月和命主星＋木星回归＋木土进每一宫。
const TONE = { 土星: '压力', 天王: '突变', 海王: '迷雾', 冥王: '重塑' };
const ym = (d) => ymd(d).slice(0, 7);
function westWindows(N, from, to) {
  const asp = scanAspects(N, from, to, 1, { jupiterSoft: true }), ing = scanIngress(N, from, to, 1);
  const ascRuler = RULER[N.angles.asc.sign];
  const domRulers = new Set(Object.values(DOMAIN_HOUSES_V1).flat().map((h) => RULER[N.houses.find((x) => x.num === h).sign]));
  const out = [];
  for (const a of asp) {
    const p = a.point, nat = N.planets.find((x) => x.n === p.n), hard = ['合', '冲', '刑'].includes(a.asp);
    if (p.angle && a.asp !== '合') continue;
    let d, tone;
    if (a.mover === '木星') {
      if (a.asp === '合' && p.n === '木星') { d = { dom: '全局', why: '木星回归' }; tone = '机会'; }
      else if (p.angle || p.n === '太阳' || p.n === '月亮' || p.n === ascRuler) { d = p.angle ? { dom: ANGLE_DOMAIN[p.n], why: '四轴' } : domainOfV1(N, nat); tone = hard ? '机会' : '顺风'; }
      else continue;
    } else {
      if (!hard) continue;
      if (!(p.angle || p.n === '太阳' || p.n === '月亮' || p.n === ascRuler || domRulers.has(p.n))) continue;
      d = a.mover === p.n && a.asp === '合' ? { dom: '全局', why: `${a.mover}回归` } : p.angle ? { dom: ANGLE_DOMAIN[p.n], why: '四轴' } : domainOfV1(N, nat); tone = TONE[a.mover];
    }
    if (!d) continue;
    out.push({ kind: '相位', mover: a.mover, asp: a.asp, point: p.n, domain: d.dom, tone, start: ym(a.start), end: ym(a.last), exacts: a.exacts,
               why: d.why.endsWith('回归') ? d.why : `${a.mover}${a.asp}本命${p.n}（${d.why}）` });
  }
  for (const i of ing) out.push({ kind: '进宫', mover: i.mover, house: i.house, domain: HOUSE_DOMAIN[i.house], tone: i.mover === '木星' ? '机会' : '压力', start: i.date.slice(0, 7), end: i.date.slice(0, 7), exacts: [i.date], why: `${i.mover}进${i.house}宫` });
  return out.sort((x, y) => x.start.localeCompare(y.start) || (x.kind === '进宫') - (y.kind === '进宫'));
}

// 一生的大周期：木星回归、土星回归／对冲、天王四分／对冲、海王四分、冥王四分（木土天海冥自己对自己），凯龙回归、交点回归（用排盘引擎逐月取位置）
// 粗步长找「黄经差过零」再二分到天（只要年份和精准日，不用逐日扫）；同一组合几次来回（逆行）并成一次
const LIFE_DEF = { 木星: [[0, '木星回归']], 土星: [[0, '土星回归'], [180, '土星对冲']], 天王: [[90, '天王四分'], [180, '天王对冲']], 海王: [[90, '海王四分']], 冥王: [[90, '冥王四分']] };
const LIFE_STEP = { 木星: 8, 土星: 15, 天王: 30, 海王: 30, 冥王: 30 }, LIFE_GAP = { 木星: 400, 土星: 400, 天王: 1000, 海王: 1000, 冥王: 1000 };
const wrap = (x) => ((x % 360) + 540) % 360 - 180;
function lifeCycles(N, birth, natalAt, maxAge = 90) {
  const end = birth.getTime() + maxAge * 365.2422 * 864e5, out = [];
  const age = (d) => Math.floor((d - birth) / (365.2422 * 864e5));
  for (const [m, defs] of Object.entries(LIFE_DEF)) {
    const L0 = N.planets.find((p) => p.n === m).L, B = body(m), st = LIFE_STEP[m] * 864e5;
    const targets = defs.flatMap(([a, name]) => (a === 0 || a === 180 ? [[(L0 + a) % 360, name]] : [[(L0 + a) % 360, name], [(L0 - a + 360) % 360, name]]));
    const hits = targets.map(() => []);
    let t0 = Math.floor((birth.getTime() + 3 * 365.2422 * 864e5) / 864e5) * 864e5, l0 = lonOf(m, new Date(t0));   // 起点对齐整天，取样才吃得到星历缓存
    for (let t1 = t0 + st; t1 <= end; t0 = t1, t1 += st) {
      const l1 = lonOf(m, new Date(t1));
      targets.forEach(([T], k) => {
        const f0 = wrap(l0 - T), f1 = wrap(l1 - T);
        if (Math.sign(f0) === Math.sign(f1) || Math.abs(f0) > 60 || Math.abs(f1) > 60) return;
        let a = t0, b = t1, fa = f0;
        while (b - a > 36e5) { const c = (a + b) / 2, fc = wrap(TJME.lon(B, new Date(c)) - T); if (Math.sign(fc) === Math.sign(fa)) { a = c; fa = fc; } else b = c; }   // 精到一小时（原来一天，日期会差一天）
        hits[k].push(new Date(b));
      });
      l0 = l1;
    }
    const byName = {};
    targets.forEach(([, name], k) => (byName[name] = (byName[name] || []).concat(hits[k])));
    for (const [name, ds] of Object.entries(byName)) {
      const groups = [];
      for (const d of ds.sort((x, y) => x - y)) { const g = groups[groups.length - 1]; if (g && d - g[g.length - 1] < LIFE_GAP[m] * 864e5) g.push(d); else groups.push([d]); }
      for (const g of groups) out.push({ name, mover: m, age: age(g[0]), year: g[0].getUTCFullYear(), exacts: g.map(ymd) });
    }
  }
  // 凯龙、北交点：引擎逐月取位置，找最接近本命位置的那个月
  const slowPt = (n, name, ages) => {
    const p0 = N.planets.concat(N.points || []).find((x) => x.n === n); if (!p0 || !natalAt) return;
    for (const [a0, a1] of ages) {
      let best = null;
      for (let m = a0 * 12; m <= a1 * 12; m += 2) {
        const d = new Date(birth.getTime() + m * 30.4369 * 864e5), X = natalAt(d), q = X && X.planets.concat(X.points || []).find((x) => x.n === n);
        if (!q) continue;
        const orb = angDist(q.L, p0.L); if (!best || orb < best.orb) best = { orb, d };
      }
      if (best && best.orb <= 3) out.push({ name, mover: n, age: age(best.d), year: best.d.getUTCFullYear(), exacts: [ymd(best.d).slice(0, 7)] });
    }
  };
  slowPt('凯龙', '凯龙回归', [[46, 54]]);
  slowPt('北交点', '交点回归', [[17, 20], [36, 39], [54, 58], [73, 76]].filter(([a]) => a < maxAge));
  return out.filter((x) => x.age <= maxAge).sort((a, b) => a.age - b.age || a.name.localeCompare(b.name));
}
module.exports.westWindows = westWindows;
module.exports.lifeCycles = lifeCycles;

// ── 西盘行运 v2 第一步（2026-10-01 审回：毛病 1＋2）──
// ①双轨记账：宫位轨（宫主 > 落宫，同 v1）和本性轨（只许用下表）各算各的；同一触点两轨落同一领域只计一次（取高）
//   「兼」的领域按半分记（未给分值，暂定，待确认）；火星、土星的官非只记候选半分，不单独亮灯
// ②按轴记账：合上升或下降 → 自我＋感情；合天顶或天底 → 事业认可＋家庭，两域各记全分
const NATURE_V2 = { 金星: [['感情', 1], ['钱', 0.5]], 太阳: [['事业认可', 1], ['自我', 0.5]], 月亮: [['家庭居所', 1]], 火星: [['官非', 0.5]], 水星: [['工作', 1]], 木星: [['事业认可', 1]], 土星: [['官非', 0.5]] };
const AXIS_V2 = { 上升: ['自我', '感情'], 下降: ['自我', '感情'], 天顶: ['事业认可', '家庭居所'], 天底: ['事业认可', '家庭居所'] };
function houseDomainV2(N, p) {
  const order = Object.keys(DOMAIN_HOUSES_V1);
  for (const dom of order) for (const h of DOMAIN_HOUSES_V1[dom]) { const cusp = N.houses.find((x) => x.num === h); if (cusp && RULER[cusp.sign] === p.n) return { dom, why: `${h}宫主` }; }
  for (const dom of order) if (DOMAIN_HOUSES_V1[dom].includes(p.house)) return { dom, why: `落${p.house}宫` };
  return null;
}
// 西盘 v2.2 归口修补（10-02 审回全文，opt.v22 开）：
//   本性轨补回 v1 有的：木星兼远方、土星兼事业认可；火星兼自身（健康，记在「自我」）
//   宫位轨补四块人生：5 宫兼家庭（子女）、9 宫兼学习、12 宫兼官非候选和自身、6 宫兼自身
//   宫主多宫按宫位权重取（角宫 1/10/7/4 → 5/9 → 其他），不再按对象键序（隐 bug）
//   进宫：木星进 2/8 宫记钱 1；土星进 2/8 宫记钱压力候选 0.5（不开闸）
const NATURE_V22 = { ...NATURE_V2, 木星: [['事业认可', 1], ['远方', 0.5]], 土星: [['官非', 0.5], ['事业认可', 0.5]], 火星: [['官非', 0.5], ['自我', 0.5]] };
const HOUSE_V22 = { 1: [['自我', 1]], 2: [['钱', 1]], 4: [['家庭居所', 1]], 5: [['感情', 1], ['家庭居所', 0.5]], 6: [['工作', 1], ['自我', 0.5]], 7: [['感情', 1]], 8: [['钱', 1]], 9: [['远方', 1], ['学习', 0.5]], 10: [['事业认可', 1]], 12: [['远方', 1], ['官非', 0.5], ['自我', 0.5]] };
const HOUSE_PRIORITY = [1, 10, 7, 4, 5, 9, 2, 8, 6, 12];
function houseTrackV22(N, p) {
  const ruled = HOUSE_PRIORITY.find((h) => { const c = N.houses.find((x) => x.num === h); return c && RULER[c.sign] === p.n; });
  const h = ruled || (HOUSE_V22[p.house] ? p.house : null);
  return h ? { h, list: HOUSE_V22[h], why: ruled ? `${h}宫主` : `落${h}宫` } : null;
}
// 西盘 v2 第二步（10-02：先收紧再扩）：opt.tight＝天王海王冥王容许度收到 1°、只作世代背景（分数减半、不能单独让一块亮灯）；opt.mercuryGuanfei＝水星本性另记官非候选半分（可选增补，跑对照）
const GEN = new Set(['天王', '海王', '冥王']);
function westYearlyV2(N, birthYear, fromYear, toYear, step = 1, opt = {}) {
  const from = new Date(Date.UTC(fromYear, 0, 1)), to = new Date(Date.UTC(toYear, 11, 31));
  const asp = scanAspects(N, from, to, step, opt.tight ? { orb: { 天王: 1, 海王: 1, 冥王: 1, ...(opt.orbSat ? { 土星: 1 } : {}) } } : {}), ing = scanIngress(N, from, to, step);   // 对照旋钮：orbSat＝土星也收到 1°；noJian＝本性轨不记「兼」
  const ascRuler = RULER[N.angles.asc.sign];
  const years = {};
  const add = (y, dom, w, why, bg) => { if (y < fromYear || y > toYear || !dom) return; const r = (years[y] = years[y] || {}); (r[dom] = r[dom] || { w: 0, why: [], gate: false }); r[dom].w += w; r[dom].why.push(why); if (!bg) r[dom].gate = true; };
  for (const a of asp) {
    if (!['合', '冲', '刑'].includes(a.asp)) continue;
    const p = a.point, nat = N.planets.find((x) => x.n === p.n);
    if (p.angle && a.asp !== '合') continue;
    if (a.mover === '木星' && !(p.angle || p.n === '太阳' || p.n === '月亮' || p.n === ascRuler)) continue;
    const bg = !!opt.tight && GEN.has(a.mover);
    const peak = a.exacts.slice().sort()[Math.floor((a.exacts.length - 1) / 2)];
    const y = +peak.slice(0, 4), pf = profection(N, y - birthYear), lordHit = pf.lord === p.n;
    const base = (a.mover === '木星' ? 1.5 : p.angle ? 3 : 2) * (lordHit ? 1.5 : 1) * (bg ? 0.5 : 1), tag = `${a.mover}${a.asp}本命${p.n}${bg ? '（世代背景）' : ''}`;
    const doms = {};   // 领域 → [分, 原因]，同域取高
    const put = (dom, w, why) => { if (!dom) return; if (!doms[dom] || doms[dom][0] < w) doms[dom] = [w, why]; };
    if (p.angle) for (const dom of AXIS_V2[p.n]) put(dom, base, `${tag}（${p.n === '上升' || p.n === '下降' ? '关系轴' : '根基轴'}）`);
    else if (opt.v22) {
      const ht = houseTrackV22(N, nat);
      if (ht) for (const [dom, k] of ht.list) put(dom, base * k, `${tag}（${ht.why}${k < 1 ? '·兼' : ''}）`);
      for (const [dom, k] of NATURE_V22[p.n] || []) put(dom, base * k, `${tag}（${p.n}本性${k < 1 ? '·兼' : ''}）`);
    } else {
      const hd = houseDomainV2(N, nat);
      if (hd) put(hd.dom, base, `${tag}（${hd.why}）`);
      for (const [dom, k] of NATURE_V2[p.n] || []) if (!(opt.noJian && k < 1 && dom !== '官非')) put(dom, base * k, `${tag}（${p.n}本性${k < 1 ? '·兼' : ''}）`);
      if (opt.mercuryGuanfei && p.n === '水星') put('官非', base * 0.5, `${tag}（水星本性·文书，官非候选）`);
    }
    for (const [dom, [w, why]] of Object.entries(doms)) add(y, dom, w, why + (lordHit ? '·小限主星' : ''), bg || dom === '官非');   // 官非候选半分也不开闸
  }
  for (const i of ing) if ([1, 4, 7, 10].includes(i.house) || (i.mover === '木星' && [5, 9].includes(i.house))) add(+i.date.slice(0, 4), HOUSE_DOMAIN[i.house], i.mover === '土星' ? 1.5 : 1, `${i.mover}进${i.house}宫`);
  if (opt.v22) for (const i of ing) if ([2, 8].includes(i.house)) add(+i.date.slice(0, 4), '钱', i.mover === '木星' ? 1 : 0.5, `${i.mover}进${i.house}宫${i.mover === '土星' ? '（财务压力候选）' : ''}`, i.mover === '土星');
  for (const a of asp.filter((x) => x.asp === '合' && x.mover === x.point.n)) add(+a.exacts[0].slice(0, 4), '全局', 2, `${a.mover}回归`);
  return { years, aspects: asp, ingress: ing };
}
module.exports.westYearlyV2 = westYearlyV2;

// 次限月亮 v0（10-02 裁决：行运是环境、次限是内应，两个同响才叫事）
// 一年＝一天：出生后第 t 年的次限月亮＝出生后第 t 天的月亮位置。三条紧箍咒：
//   ①容许度 ≤1°，入相出相都算；②只记合、冲、刑，对本命日月水金火和四轴；③木星不碰（这里本来就只看月亮）
// 领域照西盘 v2：行星走宫位轨（宫主优先、落宫其次）＋本性轨（兼按半分）；四轴按轴记账
const PROG_TARGETS = ['太阳', '月亮', '水星', '金星', '火星'];
function progressedMoonYearly(N, birthUtc, fromYear, toYear, opt = {}) {   // opt.houseOnly＝只走宫位轨（对照）
  const MOON = body('月亮'), YEAR = 365.2422 * 864e5, b0 = birthUtc.getTime();
  const targets = N.planets.filter((p) => PROG_TARGETS.includes(p.n)).map((p) => ({ n: p.n, L: p.L, nat: p }));
  const A = N.angles;
  for (const [n, L] of [['上升', A.asc.L], ['天顶', A.mc.L]]) targets.push({ n, L, angle: true });
  const years = {};
  for (let y = fromYear; y <= toYear; y++) {
    const seen = new Set();
    for (let k = 0; k <= 26; k++) {   // 每半个月取一次（次限月亮一年约走 13°，半月约 0.5°）
      const t = Date.UTC(y, 0, 1) + k * (YEAR / 26);
      if (t < b0) continue;
      const pm = TJME.lon(MOON, new Date(b0 + (t - b0) / 365.2422));
      for (const tg of targets) for (const [ang, nm] of [[0, '合'], [180, '冲'], [90, '刑']]) {
        const key = tg.n + nm; if (seen.has(key)) continue;
        if (Math.abs(angDist(pm, tg.L) - ang) > 1) continue;
        seen.add(key);
        const tag = `次限月亮${nm}本命${tg.n}`, doms = {};
        const put = (dom, w, why) => { if (dom && (!doms[dom] || doms[dom][0] < w)) doms[dom] = [w, why]; };
        if (tg.angle) for (const dom of AXIS_V2[tg.n]) put(dom, 1, `${tag}（${tg.n === '上升' ? '关系轴' : '根基轴'}）`);
        else {
          const hd = houseDomainV2(N, tg.nat);
          if (hd) put(hd.dom, 1, `${tag}（${hd.why}）`);
          if (!opt.houseOnly) for (const [dom, kk] of NATURE_V2[tg.n] || []) if (dom !== '官非') put(dom, kk, `${tag}（${tg.n}本性${kk < 1 ? '·兼' : ''}）`);
        }
        const r = (years[y] = years[y] || {});
        for (const [dom, [w, why]] of Object.entries(doms)) { (r[dom] = r[dom] || { w: 0, why: [] }); r[dom].w = Math.max(r[dom].w, w); r[dom].why.push(why); }
      }
    }
  }
  return { years };
}
module.exports.progressedMoonYearly = progressedMoonYearly;
