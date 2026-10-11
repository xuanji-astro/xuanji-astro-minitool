// 推导层：把引擎的交接包（xuanji.handoff/0.1）整理成每一屏要说的话。纯函数、零随机数（同盘同结论）。
// 只做「挑」和「排」，不另算命理：时间敏感度、身强投票、应期年份都是引擎算好的。

export const SRC_LABEL = { birth_certificate: '出生证／医院记录', family_clear: '家人记得清楚', family_rough: '家人大概记得', unknown: '不确定' };
export const PRE_LABEL = { minute: '精确到分钟', within_15min: '前后 15 分钟', within_1h: '前后 1 小时', unknown: '不确定' };
const PRE_MIN = { minute: 5, within_15min: 15, within_1h: 60, unknown: 60 };

// 盘指纹：同 method.js 的 FNV-1a，喂生辰串（同一张盘永远同一个数）
export function fp(str) { let h = 0x811c9dc5; for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; }
export const chartKey = (b) => `${b.date} ${b.time || '--:--'} ${b.city} ${b.gender || b.sex}`;
export const chartId = (b) => 'XJ' + fp(chartKey(b)).toString(36).toUpperCase().padStart(7, '0');

const hhmm = (s) => { const m = String(s || '').match(/(\d{1,2}):(\d{2})$/); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null; };

// ① 出生时间可信度：边界（引擎 boundary）× 用户给的来源和精度。精度越粗，离交界多远才算安全也跟着放宽。
// rectified：时辰已经用定时辰定下来——不再报离时辰交界几分钟、压宫头的星、「时柱可能变」（Skill 报告同一口径）；上升、天顶换座照实说
export function reliability(out, rectified = false) {
  const b = out.birth, bd = out.method.boundary || {}, bz = out.bazi && out.bazi.status === 'ok' ? out.bazi : null;
  const known = !!b.time, w = PRE_MIN[b.time_precision] || 60, coarse = w >= 60;
  const solid = ['birth_certificate', 'family_clear'].includes(b.time_source) && ['minute', 'within_15min'].includes(b.time_precision);
  const risks = [];
  if (!known) {
    risks.push({ k: 'unknown', text: '出生时间不详：上升、宫位算不出，八字只看三柱' });
  } else {
    // 只知道大概时间：上升一小时能走 15°，先说这一条，再补最近的一两个交界
    if (coarse) risks.push({ k: 'coarse', text: '时间只精确到前后 1 小时：上升、宫位和时柱都可能变', why: '上升大约每 4 分钟走 1°，一小时就是 15°' });
    if (bd.hour) {
      const near = Math.min(bd.hour.minutes_from_prev, bd.hour.minutes_to_next), toNext = bd.hour.minutes_to_next <= bd.hour.minutes_from_prev;
      if (near < Math.max(15, w)) risks.push({ k: 'hour', text: `离${toNext ? bd.hour.branch + '／' + bd.hour.next_branch : bd.hour.prev_branch + '／' + bd.hour.branch}时交界 ${near} 分钟`, why: '真太阳时跨过时辰交界，时柱就换了，八字会变一柱' });
    }
    for (const [k, name] of [['asc', '上升'], ['mc', '天顶']]) {
      const a = bd[k]; if (!a) continue;
      const edge = Math.min(a.deg_in_sign, 30 - a.deg_in_sign);
      if (edge < Math.max(2, w / 4)) risks.push({ k, text: `${name}在${a.sign} ${a.deg_in_sign.toFixed(1)}°，离换星座 ${edge.toFixed(1)}°`, why: `${name}大约每 4 分钟走 1°，差几分钟就可能换到隔壁星座` });
    }
    for (const c of bd.cusp_planets || []) risks.push({ k: 'cusp', text: `${c.n}压在 ${c.cusp} 宫宫头（差 ${Math.abs(c.deg_from_cusp).toFixed(1)}°）`, why: '出生时间差几分钟，这颗星就落进隔壁宫' });
  }
  if (rectified) for (let i = risks.length - 1; i >= 0; i--) if (['hour', 'cusp', 'coarse'].includes(risks[i].k)) risks.splice(i, 1);
  risks.splice(3);   // 最多说三条，按 时辰 → 上升 → 天顶 → 宫头 的顺序
  const level = !known || coarse ? 'check' : !risks.length ? 'ok' : solid ? 'sensitive' : 'check';
  return {
    level,                                                  // ok 放心用 · sensitive 敏感 · check 值得校时
    head: { ok: '这张盘可以放心用', sensitive: '这张盘对出生时间敏感', check: '这张盘值得校时' }[level],
    clock: b.time, solar: bz && bz.input && bz.input.trueSolarTime ? hhmm(bz.input.trueSolarTime) : null,
    source: SRC_LABEL[b.time_source] || '不确定', precision: PRE_LABEL[b.time_precision] || '不确定',
    place: b.place, risks, solid,
  };
}

// ② 身强身弱：三路投票原样摆出来，结论跟着投票走；分歧就不硬判
const SIDE_WORD = { 强: '身强', 弱: '身弱', 中: '中和', 待定: '暂不硬判' };
// fs＝「用你的经历核一次」的计分结果（引擎 feelScore 算好的）；定下来的高于三种判法
// held＝上一次的定案（改判记录最后一条）：这次在加问或挂起，证据还不够改判，结论先按它
export function strength(out, fs, held, base = null, cal = null) {
  const s = out.method.bazi && out.method.bazi.strength, v = s && s.vote;
  if (!v) return null;
  const vd = v.verdict;
  // v1.2／v1.3（10-06）：只有一路有方向＝孤票、三路都中和但星盘偏一边＝尺子有方向，都降待定、必问
  const agree = vd.agree === '一致' ? '三路判法方向一致' : vd.agree === '多数' ? '三路里两路一致' : vd.kind === '硬分歧' ? '存在硬分歧' : vd.kind === '孤票' ? '只有一路说出强弱' : vd.kind === '尺子有方向' ? '星盘另有倾向' : vd.kind === '软分歧' ? '存在软分歧' : vd.agree === '时辰不详' ? '时辰不详，只排三柱' : '票数不够';
  return {
    verdict: SIDE_WORD[vd.side] || vd.side, side: vd.side, agree, kind: vd.kind,
    votes: v.votes.map((x) => ({ school: x.school, level: x.level || (x.status === '区间' ? '只出区间' : '—'), why: x.why || '' })),
    // 特殊格局只认复核结果（pattern.isSpecial）；一票判到极档只触发复核，没成立就照常三票（10-05 定）
    special: !!vd.special,
    review: vd.special ? '这张盘按特殊格局论，喜忌按格局取，不按身强身弱这套' : vd.kind === '硬分歧' ? '几路判法说法相反，要结合可验证的年份继续确认'
      : vd.kind === '孤票' ? '只有一路判法说出了强弱，单凭它不下结论。这张盘强弱两可，细节以你的经历为准'
      : vd.kind === '尺子有方向' ? '三路判法都说不偏不倚，星盘却偏向一边。这张盘强弱两可，细节以你的经历为准' : null,
    basis: s.basis_words || [],
    favorable: out.method.bazi.useful ? out.method.bazi.useful.favorable : [],
    unfavorable: out.method.bazi.useful ? out.method.bazi.useful.unfavorable : [],
    favorableIf: v.favorable_if,
    feel: v.feel && v.feel.enough ? v.feel : null, need: !!(v.feel && v.feel.need), feelWhy: v.feel && !v.feel.enough ? v.feel.why : null, young: !!(v.feel && !v.feel.enough && v.feel.young),
    ...(cal && cal.status === '定案' ? calibMine(out, cal, base) : mine(out, v, fs, held, base)),
  };
}
// 身强身弱校正定下来的（10-10 起）：结论换成你的，整盘已按它重排；跟你先看到的喜用不一样，就摆出来作对照
function calibMine(out, cal, base) {
  const u = (o) => (o && o.method.bazi && o.method.bazi.useful ? o.method.bazi.useful : null), was = base && base !== out ? u(base) : null, now = u(out);
  const old = was && now && (was.favorable.join('') !== now.favorable.join('') || was.unfavorable.join('') !== now.unfavorable.join('')) ? was : null;
  return { calib: cal, mine: true, verdict: SIDE_WORD[cal.side], side: cal.side, kind: null, review: null, agree: '你亲手定的', hold: null, turned: false,
    ...(old ? { flip: { favorable: old.favorable, unfavorable: old.unfavorable } } : {}) };
}
// 你亲手定的：结论换成你的。定案跟你先看到的结论方向相反时，整盘已按定案重算（喜用、大运、时间线），这里摆出你先看到的喜用作对照
// base＝没核过时那一版（没核过、结论跟引擎档位不同的盘，那一版已经按结论排过，10-06 定）
function mine(out, v, fs, held, base) {
  if (!fs) return {};
  const side = fs.status === '定案' ? fs.decided : held ? held.side : null;
  if (!side) return fs.status === '挂起' ? { fs, review: fs.why + '；可以把盘和回答交给创始人人工复核' } : { fs };
  const u = (o) => (o && o.method.bazi && o.method.bazi.useful ? o.method.bazi.useful : null), was = base && base !== out ? u(base) : null, now = u(out);
  const old = was && now && (was.favorable.join('') !== now.favorable.join('') || was.unfavorable.join('') !== now.unfavorable.join('')) ? was : null;
  return {
    fs, mine: true, verdict: SIDE_WORD[side], side, kind: null, review: null, agree: '你亲手定的',
    hold: fs.status === '定案' ? null : fs.status,   // 加问／挂起：结论先按上一次的
    turned: !!(held && held.side === side && held.from !== side),   // 这一次定案把结论翻了过来（时间线重排过）
    ...(old ? { flip: { favorable: old.favorable, unfavorable: old.unfavorable } } : {}),
  };
}

// ③ 过去节点：只从两套同亮（mirror）的候选里挑 3 个，领域不重样、年份拉开；全局太空泛、官非不拿来验
export const DOMAIN_LINE = {
  事业认可: '被正式认可：升学、录取、获奖，或拿到一个职位、名分',
  工作: '工作换了轨道：换工作、换岗位，或开始做一件新的事',
  感情: '感情有明显的推进、拉扯或结束',
  家庭: '家里有一件大事：搬家、家人变动，或家里的格局变了',
  迁移远方: '离开原来的地方：去外地读书、换城市，或出远门很久',
  钱: '钱上有一次大的进出：一笔大收入、大开销，或投资起落',
  自我: '你自己变了一次：状态、形象，或对自己的看法明显不同',
};
export function pickNodes(out, n = 3, skip = null) {   // skip：定时辰时你已经说过、被问过的年份，不再拿来验
  const t = out.method.timing;
  const cand = ((t && t.past_candidates) || []).filter((c) => c.mirror && DOMAIN_LINE[c.domain] && !(skip && skip.has(c.year)));
  const picked = [];
  const ok = (c, gap, distinct) => picked.length < n && !picked.includes(c) && picked.every((p) => Math.abs(p.year - c.year) >= gap && (!distinct || p.domain !== c.domain));
  for (const [gap, distinct] of [[3, true], [1, true], [3, false]]) for (const c of cand) if (ok(c, gap, distinct)) picked.push(c);
  return picked.sort((a, b) => a.year - b.year).map((c) => ({ id: `${c.year}-${c.domain}`, year: c.year, age: c.age, domain: c.domain, line: DOMAIN_LINE[c.domain], bazi: c.bazi, west: c.west, score: c.score }));
}
export const ANSWERS = [['obvious', '明显'], ['partial', '部分'], ['miss', '不符合']];
export function tally(nodes, ans) {
  const t = { obvious: 0, partial: 0, miss: 0, open: 0 };
  for (const x of nodes) { const a = ans[x.id]; if (a && t[a] !== undefined) t[a]++; else t.open++; }
  return t;
}

// ④ 玄玑看见的你：一句（出厂底色的那句话）＋三个结构，每条标出处
export function seen(out, nowY) {
  const p = out.method.persona, bz = out.method.bazi, w = out.method.west;
  const head = p ? { line: p.base.line, src: `星盘人格 · 出厂底色 ${p.base.type} ${p.base.name}` } : null;
  const items = [];
  if (bz) {
    const dm = bz.day_master, pt = bz.pattern;
    items.push({ k: '你是什么结构', text: `${dm.gan}${dm.element}日主，${dm.image}：${dm.image_line}`, sub: pt && pt.huaming ? `${pt.name}｜${pt.huaming.line}` : pt ? pt.name : null, src: '八字' });
  }
  if (p) {
    const top = w && w.planets ? [...w.planets].sort((a, b) => a.power_rank - b.power_rank)[0] : null;
    items.push({ k: '你最强的能力', text: p.base.stack.dom.word, sub: top ? `星盘里最有力的是${top.n}（${top.sign}${top.house ? ' ' + top.house + ' 宫' : ''}）` : null, src: top ? '人格 × 西盘' : '人格' });
  }
  const st = stage(out, nowY);
  if (st && st.now) items.push({ k: '你现在最该注意什么', text: st.now.text, sub: st.luck ? `${st.luck.gan_zhi}大运：${st.luck.line}` : null, src: st.now.src });
  return { head, items };
}

// 学龄（10-06）：22 岁及以下的年份按学业说——「工作」说成学业，「事业认可」说成考试升学；领域名本身不改（模板只认原名）
const STUDY_WORD = { 工作: '学业', 事业认可: '考试升学' };
export const domainWord = (domain, context) => (context === '学业' && STUDY_WORD[domain]) || domain;

// ⑤ 你现在在哪里：今年＋往后两年里亮的领域（两套同亮排前），只给方向，不展开
export function stage(out, nowY) {
  const t = out.method.timing, bz = out.method.bazi;
  if (!t) return null;
  const luck = bz && bz.luck ? bz.luck.find((l) => l.start_year <= nowY && nowY <= l.end_year) || null : null;
  const fut = (t.future || []).filter((c) => c.year >= nowY && c.year <= nowY + 2 && c.domain !== '全局');
  const byYear = [];
  for (const c of fut) {
    const ty = (t.years || []).find((x) => x.year === c.year);
    let y = byYear.find((x) => x.year === c.year); if (!y) byYear.push((y = { year: c.year, items: [], context: ty ? ty.context : null, shift: ty ? ty.shift : null }));
    y.items.push({ domain: c.domain, word: domainWord(c.domain, y.context), mirror: c.mirror, score: c.score, bazi: c.bazi, west: c.west });
  }
  for (const y of byYear) y.items.sort((a, b) => (b.mirror - a.mirror) || (b.score - a.score));
  const thisY = byYear.find((y) => y.year === nowY);
  const top = thisY && thisY.items[0];
  const now = top ? { text: `${nowY} 年，${thisY.items.slice(0, 2).map((x) => x.word).join('、')}在动${top.mirror ? '，八字和星盘同时亮' : ''}`, src: top.mirror ? '八字 × 西盘' : top.bazi.length ? '八字' : '西盘' } : null;
  const year = (t.years || []).find((y) => y.year === nowY);
  return { luck, gz: year ? year.gan_zhi : null, now, years: byYear.slice(0, 3), months: (t.months || []).slice(0, 4) };
}

// ⑧ 创始人深读：只在这张盘确实有一层要人来取舍时出现
export function founderReasons(out, nodes, ans, fs, held) {
  const r = [], rel = reliability(out), s = strength(out, fs, held), tl = tally(nodes, ans);
  if (rel.level === 'check') r.push('出生时间值得校时');
  if (s && (s.review || s.hold === '挂起')) r.push(s.fs && s.fs.status === '挂起' ? '身强身弱用经历核过，两种读法还拉不开' : s.special ? '这张盘是特殊格局' : '身强身弱几路判法相反');
  if (nodes.length && tl.obvious >= 2 && tl.open === 0) r.push('过去节点大多说中，值得往深里读');
  if (tl.miss >= 2) r.push('过去节点有两条以上对不上，盘和经历要人来对');
  return r;
}

// 给 AI 读的结构数据：只放结构和用户确认过的事，不放长篇解读；带出生信息，装了 Skill 的 Agent 可以重算核对
export function handoff(out, nodes, ans, meta) {
  const b = out.birth, rel = reliability(out), s = strength(out, meta.fs, meta.held), st = stage(out, meta.nowY), p = out.astro_mbti, w = out.method.west, bz = out.bazi && out.bazi.status === 'ok' ? out.bazi.bazi : null;
  const ansWord = Object.fromEntries(ANSWERS);
  const checks = nodes.filter((x) => ans[x.id]).map((x) => ({ statement: `${x.year} 年：${x.line}`, kind: 'year', year: x.year, domain: x.domain, mirror: true, answer: { obvious: '准', partial: '部分准', miss: '不准' }[ans[x.id]] }));
  const data = {
    profile: {
      birth: { date: b.date, time: b.time, city: b.place ? b.place.name : b.city, lat: b.place && b.place.lat, lon: b.place && b.place.lon, tz: b.tz, sex: b.sex, time_source: b.time_source, time_precision: b.time_precision },
      time_reliability: { level: rel.level, clock: rel.clock, true_solar: rel.solar, risks: rel.risks.map((x) => x.text) },
      western: w && w.big3 ? { sun: `${w.big3.sun.sign} ${w.big3.sun.house || '-'}宫`, moon: `${w.big3.moon.sign} ${w.big3.moon.house || '-'}宫`, asc: w.big3.asc ? `${w.big3.asc.sign} ${w.big3.asc.deg}°${w.big3.asc.min}'` : null, mc: w.big3.mc ? `${w.big3.mc.sign} ${w.big3.mc.deg}°${w.big3.mc.min}'` : null, power_rank: (w.power_rank || []).slice(0, 4) } : null,
      bazi: bz ? { pillars: ['year', 'month', 'day', 'hour'].map((k) => (bz.pillars[k] ? bz.pillars[k].ganZhi : null)), day_master: bz.dayMaster.gan, strength: s ? { verdict: s.verdict, agree: s.agree, votes: s.votes.map((v) => `${v.school}:${v.level}`), decided: s.mine ? s.side : null } : null, hour_rectified: meta.hour || null, pattern: out.method.bazi.pattern ? out.method.bazi.pattern.name : null, favorable: s ? s.favorable : null, luck_now: st && st.luck ? `${st.luck.gan_zhi} ${st.luck.start_year}-${st.luck.end_year}` : null, year_now: st ? st.gz : null } : null,
      persona: p && p.base_type ? { base: p.base_type, runner_up: p.runner_up, rebirth: p.rebirth, buffs: p.buffs } : null,
      current_timing: st ? st.years.map((y) => ({ year: y.year, domains: y.items.slice(0, 3).map((x) => x.domain + (x.mirror ? '(两套同亮)' : '')) })) : null,
      past_validation: checks.map((c) => ({ year: c.year, domain: c.domain, answer: c.answer })),
      checks,
      limitations: ['离线小工具结果；完整推算以 Xuanji Skill 重算为准', b.time ? null : '出生时间不详：无上升、宫位，八字三柱', meta.hour ? `出生时辰经定时辰定在${meta.hour}；birth.time 可能是交界另一侧的代表时间，不是实际几点几分，不要报给用户` : null].filter(Boolean),
      versions: { tool: meta.tool, schema: out.schema, natal: out.version.natal, astro_mbti: out.version.astro_mbti, timing: out.method.timing ? out.method.timing.schema : null },
    },
  };
  return ['<!-- XUANJI_STRUCTURED_HANDOFF v1 -->',
    '## 接收方说明（给 AI / Xuanji Skill）',
    '这份数据由执天玄玑小红书小工具在用户手机上离线算出。',
    '- 装了 Xuanji Skill：用 profile.birth 调 POST /v1/profile 重算核对；profile.bazi.strength.decided 有值（用户拿经历核过身强身弱）就当 strength 一起传；用户同意存档时，把 profile.checks 原样放进 /v1/profile/save 的 checks。',
    '- 没装：直接读这份数据回答，并说明它来自离线小工具、没有重算。',
    '- past_validation 是用户亲手核对过的，当事实用；其余是结构数据，不是结论。',
    '',
    '```json', JSON.stringify(data, null, 1), '```'].join('\n');
}

// ⑥ 定时辰：打分用 Skill 同一份脚本（engine/skill/rectify.mjs，browser/entry.js 挂在 XJ.rect），这里只把结果摆给人看
export const RECT_DOMAINS = [['工作', '工作'], ['事业认可', '事业或名声'], ['感情', '感情'], ['家庭', '家里'], ['钱', '钱'], ['迁移远方', '搬家或去外地']];
const RD_SHORT = { 工作: '工作', 事业认可: '事业', 感情: '感情', 家庭: '家里', 钱: '钱', 迁移远方: '去外地' };
const EL5 = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水', 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const CN_N = ['零', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十'];
export const cnNum = (n) => CN_N[n] || String(n);
// 每一件站在哪边（只为展示，票数以 rectify.mjs 为准）：大事看两张盘那年那块谁更亮；专门问的看哪张盘亮、你答有没有；体感看哪张盘的喜忌对得上
export function rectItems(A, B, rt, weight, dOf = (e) => e.domain) {
  const ch = (o) => ({ Y: new Map(o.method.timing.years.map((r) => [r.year, r])) }), ca = ch(A), cb = ch(B);
  const uf = (o) => { const u = o.method.bazi && o.method.bazi.useful; return { fav: (u && u.favorable) || [], unfav: (u && u.unfavorable) || [] }; };
  const predict = (u, gz) => { const e = [EL5[gz[0]], EL5[gz[1]]]; return e.every((x) => u.fav.includes(x)) ? '顺' : e.every((x) => u.unfav.includes(x)) ? '闷' : null; };
  const out = [];
  // 你说的大事：具体的事归到六个方面再比两张盘（健康不进这一票，命理组 10-10）
  for (const e of rt.events) {
    const d = dOf(e); if (!d) continue;
    const a = weight(ca, e.year, d), b = weight(cb, e.year, d);
    out.push({ kind: 'told', year: e.year, domain: d, event: e.event || null, side: a > b ? 'a' : b > a ? 'b' : null, only: a === 0 || b === 0, none: a === 0 && b === 0 });
  }
  for (const k of rt.ask.targeted) {
    const v = rt.answers.targeted && rt.answers.targeted[k.id]; if (v !== '有' && v !== '没有') continue;
    const lit = weight(ca, k.year, k.domain) > 0 ? 'a' : 'b';
    out.push({ kind: 'asked', year: k.year, domain: k.domain, ans: v, lit, side: v === '有' ? lit : lit === 'a' ? 'b' : 'a' });
  }
  // 体感（10-10 起不单独问）：大事和追问里的好事坏事，只看两张盘说法相反的年份；同一年好坏都有的不记（同 rectify.mjs）
  const goods = [...rt.events.filter((e) => typeof e.good === 'boolean').map((e) => ({ year: e.year, good: e.good, what: e.event || RD_SHORT[dOf(e)] || e.domain })),
    ...rt.ask.targeted.filter((k) => rt.answers.targeted && rt.answers.targeted[k.id] === '有' && rt.answers.good && rt.answers.good[k.id]).map((k) => ({ year: k.year, good: rt.answers.good[k.id] === '好事', what: RD_SHORT[k.domain] + '的事' }))];
  const mixed = new Set(goods.filter((x) => goods.some((y) => y.year === x.year && y.good !== x.good)).map((x) => x.year));
  const ua = uf(A), ub = uf(B);
  for (const g of goods) {
    if (mixed.has(g.year)) continue;
    const gz = GZ(g.year), pa = predict(ua, gz), pb = predict(ub, gz); if (!pa || !pb || pa === pb) continue;
    out.push({ kind: 'feel', year: g.year, ans: `${g.what}是${g.good ? '好事' : '坏事'}`, side: g.good === (pa === '顺') ? 'a' : 'b' });
  }
  return out.sort((x, y) => x.year - y.year);
}
const GZ = (y) => '甲乙丙丁戊己庚辛壬癸'[((y - 4) % 10 + 10) % 10] + '子丑寅卯辰巳午未申酉戌亥'[((y - 4) % 12 + 12) % 12];
// 揭晓卡的几行理由（照 10-04 确认图的说法）
export function rectWhy(items, hours, win) {
  const W = hours[win], L = hours[win === 'a' ? 'b' : 'a'], lose = win === 'a' ? 'b' : 'a', D = (k) => k.event || RD_SHORT[k.domain];
  const yrs = (xs) => xs.map((x) => `${x.year} 年${D(x)}`).join('、');
  const lines = [];
  const toldW = items.filter((x) => x.kind === 'told' && x.side === win);
  const more = toldW.filter((x) => !x.only), only = toldW.filter((x) => x.only);
  if (more.length) lines.push(['y', `${yrs(more)}：${W}那张盘这${cnNum(more.length)}年亮得更多`]);
  if (only.length) lines.push(['y', `${yrs(only)}：只有${W}那张盘这${cnNum(only.length)}年是亮的`]);
  for (const x of items.filter((i) => i.kind === 'asked' && i.side === win)) lines.push(['y', x.ans === '有' ? `${x.year} 年${D(x)}有事：只有${W}那张盘这一年是亮的` : `${x.year} 年${D(x)}没什么事：那年只有${L}那张盘亮`]);
  const fw = items.filter((x) => x.kind === 'feel' && x.side === win);
  if (fw.length) lines.push(['y', `${[...fw].reverse().map((x) => `${x.year} 年${x.ans}`).join('、')}：正好对上${W}那张盘的喜忌`]);
  for (const x of items.filter((i) => i.side === lose)) lines.push(['o', x.kind === 'told' ? `${x.year} 年${D(x)}的事：${L}这边更亮一点` : x.kind === 'asked' ? (x.ans === '有' ? `${x.year} 年${D(x)}有事：只有${L}那张盘这一年是亮的` : `${x.year} 年${D(x)}没什么事：那年只有${W}那张盘亮`) : `${x.year} 年${x.ans}：对上的是${L}那张盘的喜忌`]);
  for (const x of items.filter((i) => i.kind === 'told' && !i.side)) lines.push(['n', `${x.year} 年${D(x)}：${x.none ? '两张盘那一年这一块都没亮' : '两边一样亮'}，不算`]);
  return lines;
}
