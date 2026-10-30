// 「玄玑的方法」层：把盘面按我们自己的口径和词库整理好，交给 Skill 报告原样引用。
// 八字词库＝网站生辰页（words.js）；西盘庙旺落陷＝_正典/dignity_table.md；人格＝engine_mbti_core.js 同一套词典和张力算法。
const W = require('./words.js');
const { MBTI } = require('./engines.js');
const fs = require('fs'), vm = require('vm'), path = require('path');
// 七星力量＝西盘尺子 v0 的单星公式（vendor/ruler_v0.js 原样复制，锁定 SHA a7cb360a），只取 starStrength，不改
const rctx = { module: { exports: {} }, Math, Object };
vm.createContext(rctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'vendor', 'ruler_v0.js'), 'utf8'), rctx, { filename: 'ruler_v0.js' });
const starStrength = rctx.starStrength;

const hash = (str) => { let h = 0x811c9dc5; for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };

// ── 八字 ──
const TIER_NAME = ['上上', '上', '中', '下', '下下'];   // 同 luck-words.js 档位说明
const BASIS_WORDS = {
  month: { 扶身: '月令扶身：出生的季节在帮你', 相持: '月令相持：出生的季节不帮也不压', 制身: '月令制身：出生的季节在压你' },
  root: { strong: '通根强：地支里有稳的根', has: '有根：地支里有根但不深', none: '无根：地支里没有根，根基靠后天补' },
  momentum: { 扶身: '得势：其余各柱多数站你这边', 相持: '势均：其余各柱帮你的和耗你的差不多', 制身: '失势：其余各柱多数在耗你' },
};
function baziMethod(bz, birth) {
  if (!bz || bz.status !== 'ok') return null;
  const b = bz.bazi, c = bz.components, dm = b.dayMaster, img = W.DAY_GAN[dm.gan] || [null, null];
  const words = W.luckWords(b.luck.cycles);
  const sw = W.shenshaWords, so = W.shenshaOrigins;
  const seed = `${birth.date} ${birth.time || ''} ${birth.city} ${birth.sex}`;
  const fav = b.usefulGods.favorableWuxing;
  return {
    day_master: { gan: dm.gan, element: dm.element, yin_yang: dm.yinYang, day_gan_zhi: c.dayMasterCard.dayGanZhi, image: img[0], image_line: img[1] },
    pattern: { name: b.pattern.name, is_special: b.pattern.isSpecial, status: b.pattern.status,
      label: W.patternLabel(c.tenGodBar, b.strength, b.pattern) || null, huaming: W.huamingOf(b.pattern) || null },
    strength: { level: b.strength, type: c.wuxingRing.type, basis: b.strengthBasis,
      basis_words: b.strengthBasis ? [BASIS_WORDS.month[b.strengthBasis.month], BASIS_WORDS.root[b.strengthBasis.root], BASIS_WORDS.momentum[b.strengthBasis.momentum]].filter(Boolean) : [] },
    useful: { favorable: fav, unfavorable: b.usefulGods.unfavorableWuxing, useful: b.usefulGods.useful, avoid: b.usefulGods.avoid },
    // 岁数统一周岁（10-18）：保留交运时实足周岁的老键，另给交运年份内满周岁；用户可见句子统一按后者说。
    // 老版排盘服务只有虚岁时，start_age／age_kind 仍照旧；新句子不再复用排盘服务的旧 label。
    luck: b.luck.cycles.map((cy, i) => ({ seq: cy.seq, gan_zhi: cy.ganZhi, start_year: cy.startYear, end_year: cy.endYear,
      start_age: cy.startAgeFull ?? cy.startAge, start_year_age: cy.startYear - Number(birth.date.slice(0, 4)), end_age: cy.startAgeFull != null ? cy.startAgeFull + 10 : cy.endAge, age_kind: cy.startAgeFull != null ? '周岁' : '虚岁',
      label: `${cy.startYear} 年交运（那年满 ${cy.startYear - Number(birth.date.slice(0, 4))} 周岁） · ${cy.ganZhi}（${cy.startYear}–${cy.endYear}）`,
      tier: cy.tier, tier_name: TIER_NAME[cy.tier] ?? null, title: words[i] ? words[i].title : null, line: words[i] ? words[i].line : null })),
    shensha: {
      dimensions: c.shenshaPanel.dimensions.map((d) => ({ key: d.key, name: d.name, score: d.score, tier: d.tier, shensha: d.shensha, words: (sw.dims[d.key] || [])[d.tier] ?? null })),
      featured: c.shenshaPanel.featured.map((f) => ({ name: f.name, stars: f.stars, rarity: f.rarity, pillars: f.pillars, words: sw.featured[f.name] ?? null, origin: so.stars[f.name] ?? null })),
    },
    fit: W.fit(fav, dm, birth.sex),
    lucky: W.lucky(fav, seed),
  };
}

// ── 西盘 ──
const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const RULER = { 白羊: '火星', 金牛: '金星', 双子: '水星', 巨蟹: '月亮', 狮子: '太阳', 处女: '水星', 天秤: '金星', 天蝎: '火星', 射手: '木星', 摩羯: '土星', 水瓶: '土星', 双鱼: '木星' };   // 古典守护，同西盘尺子 v0
const MODERN = { 天蝎: '冥王', 水瓶: '天王', 双鱼: '海王' };
// _正典/dignity_table.md：入庙／入旺／落陷／落弱；三王星只取表里确定的格（带问号的不用）
const DIG = {
  太阳: { 入庙: ['狮子'], 入旺: ['白羊'], 落陷: ['水瓶'], 落弱: ['天秤'] },
  月亮: { 入庙: ['巨蟹'], 入旺: ['金牛'], 落陷: ['摩羯'], 落弱: ['天蝎'] },
  水星: { 入庙: ['双子', '处女'], 入旺: ['处女'], 落陷: ['射手', '双鱼'], 落弱: ['双鱼'] },
  金星: { 入庙: ['金牛', '天秤'], 入旺: ['双鱼'], 落陷: ['天蝎', '白羊'], 落弱: ['处女'] },
  火星: { 入庙: ['白羊', '天蝎'], 入旺: ['摩羯'], 落陷: ['天秤', '金牛'], 落弱: ['巨蟹'] },
  木星: { 入庙: ['射手', '双鱼'], 入旺: ['巨蟹'], 落陷: ['双子', '处女'], 落弱: ['摩羯'] },
  土星: { 入庙: ['摩羯', '水瓶'], 入旺: ['天秤'], 落陷: ['巨蟹', '狮子'], 落弱: ['白羊'] },
  天王: { 入庙: ['水瓶'], 入旺: ['天蝎'], 落陷: ['狮子'], 落弱: ['金牛'] },
  海王: { 入庙: ['双鱼'], 入旺: [], 落陷: ['处女'], 落弱: [] },
  冥王: { 入庙: ['天蝎'], 入旺: [], 落陷: ['金牛'], 落弱: [] },
};
const dignity = (p, sign) => { const d = DIG[p]; if (!d) return null; for (const k of ['入庙', '入旺', '落陷', '落弱']) if (d[k].includes(sign)) return k; return '平'; };
const houseKind = (h) => ([1, 4, 7, 10].includes(h) ? '角宫' : [2, 5, 8, 11].includes(h) ? '续宫' : '果宫');
const ASP_WORDS = ['六合', '合', '冲', '刑', '拱'];
function parseAsp(t) { for (const w of ASP_WORDS) { const i = t.indexOf(w); if (i > 0) return [t.slice(0, i), w, t.slice(i + w.length)]; } return null; }

function westMethod(N) {
  if (!N) return null;
  const asc = N.angles.asc.sign, rulerOfAsc = RULER[asc];
  const asps = (N.asp || []).map((x) => parseAsp(x.t || x)).filter(Boolean);
  const rules = (p) => N.houses.filter((h) => RULER[h.sign] === p || MODERN[h.sign] === p).map((h) => h.num);
  const one = (p) => ({
    n: p.n, sign: p.sign, deg: p.deg, min: p.min, house: p.house, house_kind: houseKind(p.house), rx: !!p.rx,
    dignity: dignity(p.n, p.sign), rules_houses: rules(p.n), is_chart_ruler: p.n === rulerOfAsc,
    aspects: asps.filter((a) => a[0] === p.n || a[2] === p.n).map((a) => ({ with: a[0] === p.n ? a[2] : a[0], type: a[1] })),
  });
  const planets = N.planets.map(one);
  const CLASSIC = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星'];
  const power = CLASSIC.map((n) => ({ n, v: Math.round(starStrength(N, n, true) * 100) / 100 })).sort((x, y) => y.v - x.v);
  power.forEach((x, i) => { const p = planets.find((q) => q.n === x.n); p.power = x.v; p.power_rank = i + 1; });
  const by = Object.fromEntries(planets.map((p) => [p.n, p]));
  return {
    big3: {
      sun: by['太阳'], moon: by['月亮'],
      asc: { sign: asc, deg: N.angles.asc.deg, min: N.angles.asc.min, ruler: rulerOfAsc, ruler_detail: by[rulerOfAsc] || null },
      mc: { sign: N.angles.mc.sign, deg: N.angles.mc.deg, min: N.angles.mc.min },
    },
    planets,
    power_rank: power,   // 七星力量（西盘尺子单星公式：庙旺 × 落宫 × 相位扶克 × 逆行），1 最强
    house_system: 'Placidus',
  };
}

// ── 人格：出厂底色＋重生人格（天赋矿）＋人格 Buff ──
// 天赋矿张力算法同 engine_mbti_core.js mineTension（欲望星×痛点星的相位，按欲望星落座锁定的功能计分）；
// 这里只多记一份「哪条相位喂了哪个功能」，总分用引擎自己的 mine 校验（见测试）。
const DESIRE = new Set(['火星', '金星', '太阳', '月亮', '北交点', '莉莉丝']);
const PAIN = new Set(['凯龙', '土星', '冥王', '南交点']);
const HARDW = { 刑: 1.0, 冲: 0.9, 合: 0.8, 六合: 0.4, 拱: 0.4 };
const W_TOOL = { 太阳: 3, 月亮: 3, 水星: 2, 金星: 2, 火星: 2, 木星: 1, 土星: 1 };
const pfunc = (p, s) => MBTI.lockFunc(W_TOOL[p] !== undefined ? p : '火星', s);

function mineSources(ch) {
  const sign = {};
  (ch.planets || []).forEach((p) => { sign[p.n] = p.sign; });
  (ch.points || []).forEach((p) => { sign[p.n] = p.sign; });
  const out = [];
  (ch.aspects || []).map(parseAsp).filter(Boolean).forEach(([x, t, y]) => {
    const dx = DESIRE.has(x), dy = DESIRE.has(y), px = PAIN.has(x), py = PAIN.has(y);
    if ((dx && py) || (px && dy)) {
      const des = dx ? x : y;
      if (sign[des]) out.push({ aspect: x + t + y, desire: des, pain: dx ? y : x, desire_sign: sign[des], funcs: pfunc(des, sign[des]), weight: HARDW[t] || 0.3 });
    }
  });
  if (sign['北交点']) out.push({ aspect: '北交点落' + sign['北交点'], desire: '北交点', pain: null, desire_sign: sign['北交点'], funcs: MBTI.ELEM_FUNC[MBTI.SIGN_ELEM[sign['北交点']]].slice(), weight: 0.3 });
  return out;
}

function personaMethod(ch, bc, tk, seed) {
  const pick = (arr, salt) => (arr && arr.length ? arr[hash(seed + '|' + salt) % arr.length] : null);
  const fw = (f) => ({ f, word: MBTI.FUNC_ONE[f] || null });
  const t = bc.rank[0][0], st = MBTI.STACKS[t], nb = MBTI.neighborInfo(t);
  const p1 = bc.rank[0][1], p2 = bc.rank[1][1], margin = +Math.log10(p1 / p2).toFixed(2);   // 同 profile.js astroMbti
  const src = mineSources(ch);
  const rebirth = tk.top3.slice(0, 2).map((r) => {
    const s2 = MBTI.STACKS[r.type];
    return {
      type: r.type, name: pick(MBTI.SOUL_NAMES[r.type], 'rb' + r.type), scene: MBTI.PERSONA_SCENE[r.type] || null,
      dom: fw(s2[0]), aux: fw(s2[1]), mine_func: fw(r.mineFunc),
      sources: src.filter((x) => x.funcs.includes(r.mineFunc)).map((x) => ({ aspect: x.aspect, desire: x.desire, pain: x.pain, desire_sign: x.desire_sign })),   // 权重不出服务
    };
  });
  return {
    base: {
      type: t, name: pick(MBTI.SOUL_NAMES[t], 'name'), line: pick(MBTI.SOUL_LINES[t], 'line'),
      // 每型解说两句（前一句戳痛、后一句封神），line 按生辰二选一；报告封面第三句要正向，固定给封神那句（10-11）
      cover_line: (MBTI.SOUL_LINES[t] || [])[1] || null,
      stack: { dom: fw(st[0]), aux: fw(st[1]), tert: fw(st[2]), inf: fw(st[3]) },
      neighbor: nb ? { type: nb.neighbor, aux: fw(nb.neighborAux) } : null,
      runner_up: bc.rank[1][0], margin_log10: margin,
      lead: margin > 1 ? '明显领先' : margin < 0.3 ? '两型很接近' : '有一定领先',
    },
    locks: Object.keys(W_TOOL).filter((p) => ch.planets.some((x) => x.n === p)).map((p) => { const s = ch.planets.find((x) => x.n === p).sign; return { planet: p, sign: s, funcs: pfunc(p, s) }; }),
    rebirth,
    rebirth_note: '两张不分先后',
    buffs: (tk.buffs || []).map(fw),
  };
}

module.exports = { baziMethod, westMethod, personaMethod, mineSources, dignity, houseKind };
