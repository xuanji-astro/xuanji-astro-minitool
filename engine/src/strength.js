// 身强身弱多口径投票 v0（2026-10-02）
// 主判＝几套八字算法多数决；西盘主体力量尺子只当佐证、不进票；问问题校正只在分歧时补充（规则待审定）。
// 票：①排盘引擎 mingyu 七档 ②旺衰打分法（第三方 MIT 代码 vendor/yiqi_wangshuai 原样，交叉核对脚本的同一函数；对外只叫「旺衰打分法」，不写别家名字）③新派（月令 50%，10-01 规格 v1）。
// 分歧规则（10-05 定）：方向一致才算多数——强、弱都有票就是硬分歧→待定，不管几比几；中对一边＝软分歧→偏那一边；
// 有一票判到极档只触发引擎按从格／专旺复核，复核成立（pattern.isSpecial）才按特殊格局论；时辰不详→待定。
// v1.2（10-06，用户反馈）：三票里只有一票有方向（另外的中和或弃权），不管哪边都降待定、用经历核；强弱向的说法只在实锤档放行（firm）。
// v1.3（10-06 折数 v0）：旺衰打分法的「得令」按月令伤情打折，见 monthHurt；半合六合不折、负分照折（10-06 判）。
// v1.3 补：三票都没方向、西盘尺子明确强或弱 → 待定出题（kind 尺子有方向）。
const fs = require('fs'), vm = require('vm'), path = require('path');
const { judgeWangShuai } = require('../vendor/yiqi_wangshuai/wang-shuai.js');
const { feelAsk } = require('./feel.js');
const rctx = { module: { exports: {} }, Math, Object };
vm.createContext(rctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'vendor', 'ruler_v0.js'), 'utf8'), rctx, { filename: 'ruler_v0.js' });
// 西盘尺子分位（thresholds_locked.json，两万合成盘，跑真人盘前锁定，规则 SHA a7cb360a）
const WEST_TH = { full: [0.81, 1.07], half: [0.85, 1.0] };

// ── 新派（月令 50%）v1：2026-10-01 规格，照写不改 ──
const GAN = '甲乙丙丁戊己庚辛壬癸', ZHI = '子丑寅卯辰巳午未申酉戌亥';
const GEL = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
const MAINQI = { 子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬' };
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }, KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const elG = (g) => GEL[GAN.indexOf(g)], elZ = (z) => elG(MAINQI[z]);
const CHONG = (x, y) => Math.abs(ZHI.indexOf(x) - ZHI.indexOf(y)) === 6;
const XING2 = [['寅', '巳'], ['巳', '申'], ['申', '寅'], ['丑', '戌'], ['戌', '未'], ['未', '丑'], ['子', '卯']];
const isXing = (x, y) => XING2.some(([a, b]) => (a === x && b === y) || (a === y && b === x)) || (x === y && ['辰', '午', '酉', '亥'].includes(x));
const fu = (e, dmEl) => e === dmEl || SHENG[e] === dmEl;   // 生我（印）或同我（比劫）＝扶
function kongWang(gz) { const i = GAN.indexOf(gz[0]), j = ZHI.indexOf(gz[1]), head = ((j - i) % 12 + 12) % 12; return [ZHI[(head + 10) % 12], ZHI[(head + 11) % 12]]; }
function xinpai(P) {
  const dm = P.day.gan, dmEl = elG(dm), steps = [];
  if (!P.hour || !P.hour.gan) return { level: null, side: null, status: '区间', why: '缺时柱：时干是「再有一项」的三个候选之一，缺了就只出区间不出档' };
  // 1 空亡：月支落空改用年支当月令
  const kw = kongWang(P.day.gan + P.day.zhi);
  const lingKey = kw.includes(P.month.zhi) ? 'year' : 'month', ling = P[lingKey].zhi, lingEl = elZ(ling);
  if (lingKey === 'year') steps.push(`月支${P.month.zhi}落空，改用年支${ling}当月令`);
  // 2 月令对日干（只看本气）
  const isFu = fu(lingEl, dmEl);
  steps.push(`月令${ling}（${lingEl}）${isFu ? '生扶' : '克泄耗'}日主${dm}（${dmEl}）`);
  // 3 月令受伤：被另外两支（年支／日支，月令是年支时为月支／日支）冲、克、刑，各记一次
  const others = (lingKey === 'month' ? ['year', 'day'] : ['month', 'day']).map((k) => P[k].zhi);
  const how = (z) => [CHONG(z, ling) && '冲', KE[elZ(z)] === lingEl && '克', isXing(z, ling) && '刑'].filter(Boolean).join('');
  const hurt = others.filter((z) => how(z));
  if (hurt.length) steps.push(`月令被${hurt.map((z) => z + how(z)).join('、')}，伤 ${hurt.length} 次`);
  if (hurt.length >= 2) return { level: null, side: null, status: '区间', why: steps.concat('伤两次，月令无力，只出区间不出档').join('；') };
  // 4 再有一项：月干、时干、日支本气；年支生扶月令
  const three = [['月干', elG(P.month.gan)], ['时干', elG(P.hour.gan)], ['日支', elZ(P.day.zhi)]];
  const yearHelps = lingKey === 'month' && (elZ(P.year.zhi) === lingEl || SHENG[elZ(P.year.zhi)] === lingEl);
  const all7 = [elG(P.year.gan), elG(P.month.gan), elG(P.hour.gan), elZ(P.year.zhi), elZ(P.month.zhi), elZ(P.day.zhi), elZ(P.hour.zhi)];
  let level;
  if (isFu && all7.every((e) => fu(e, dmEl))) level = '从强';
  else if (!isFu && all7.every((e) => !fu(e, dmEl))) level = '从弱';
  else if (isFu) {
    const hit = three.filter(([, e]) => fu(e, dmEl)).map(([k]) => k);
    level = hit.length || yearHelps ? '身旺' : '身弱';
    steps.push(hit.length ? `再有${hit.join('、')}生扶` : yearHelps ? '年支生扶月令' : '月干、时干、日支都不扶（月令只占一半，另一半全失）');
  } else {
    const hit = three.filter(([, e]) => !fu(e, dmEl)).map(([k]) => k);
    level = hit.length || yearHelps ? '身弱' : '身旺';
    steps.push(hit.length ? `再有${hit.join('、')}克泄耗` : yearHelps ? '年支生扶月令' : '月干、时干、日支都不制');
  }
  if (level === '从强' || level === '从弱') steps.push('全局一色，按从格档；接特殊格局复核，不直接输出');
  return { level, side: /强|旺/.test(level) ? '强' : '弱', extreme: level.startsWith('从'), why: steps.join('；') };
}

const norm = (lv) => {
  if (!lv) return null;
  if (/从强|极强|极旺/.test(lv)) return { side: '强', extreme: true };
  if (/从弱|极弱/.test(lv)) return { side: '弱', extreme: true };
  if (/强|旺/.test(lv)) return { side: '强', extreme: false };
  if (/弱|衰/.test(lv)) return { side: '弱', extreme: false };
  if (/中和|均衡|平/.test(lv)) return { side: '中', extreme: false };
  return null;
};

// ── v1.3 月令伤情折数 v0（10-06）：只折旺衰打分法的「得令」一项，各项连乘，折后不低于原分的 10%（防把身弱盘折进从格）──
// 认定全按局里现有口径，这里只做折分：空亡按日柱旬空；合化跟排盘引擎的成局规则走（mingyu collectEstablishedBranchFormations：
// 三合三会三支齐、化神得月令旺相、没被局外地支冲破＝成化，月令本身不是化神那一行才算「化为他五行」；三支齐但没成局＝合而不化）；
// 半合、六合不进折数（10-06 判：只认引擎成局规则里的事件）。逢冲看年、日、时三支，月令是受克一方 ×0.6，否则 ×0.7，不重复乘。
// 得令是负分（月令克泄耗日主）照折、保符号（判：折的是月令这个支点的力道，忌神的根受伤是松绑）。
const FORMATIONS = [[['亥', '卯', '未'], '木'], [['寅', '卯', '辰'], '木'], [['寅', '午', '戌'], '火'], [['巳', '午', '未'], '火'],
  [['巳', '酉', '丑'], '金'], [['申', '酉', '戌'], '金'], [['申', '子', '辰'], '水'], [['亥', '子', '丑'], '水']];
function monthHurt(P, season) {
  const m = P.month.zhi, mEl = elZ(m), items = [];
  if (kongWang(P.day.gan + P.day.zhi).includes(m)) items.push(['落空亡', 0.5]);
  const all = ['year', 'month', 'day', 'hour'].filter((k) => P[k] && P[k].zhi).map((k) => P[k].zhi), have = new Set(all);
  let he = null;
  for (const [br, el] of FORMATIONS) {
    if (!br.includes(m) || el === mEl || !br.every((b) => have.has(b))) continue;
    const made = (season[el] === '旺' || season[el] === '相') && !all.some((b) => !br.includes(b) && br.some((x) => CHONG(x, b)));
    if (made) { he = [`被合化为${el}`, 0.5]; break; }
    he = he || ['被合而不化', 0.8];
  }
  if (he) items.push(he);
  const chong = ['year', 'day', 'hour'].filter((k) => P[k] && P[k].zhi && CHONG(P[k].zhi, m)).map((k) => P[k].zhi);
  if (chong.length) items.push(chong.some((z) => KE[elZ(z)] === mEl) ? ['逢冲且受克', 0.6] : ['逢冲', 0.7]);
  const f = items.reduce((x, [, k]) => x * k, 1);
  return { factor: items.length ? Math.max(f, 0.1) : 1, items };
}
// 档位和置信度阈值同 vendor/yiqi_wangshuai/wang-shuai.js（vendor 原样不动，折分后在这里重新落档）
const wsLevel = (s) => (s >= 8 ? '极旺(可能从强)' : s >= 3 ? '偏旺' : s > -2.5 ? '中和' : s > -8 ? '偏弱' : '极弱(可能从弱)');
const wsConfidence = (s) => { const d = Math.min(...[3, -2.5, 8, -8].map((t) => Math.abs(s - t))); return d > 2 ? '高' : d > 0.8 ? '中' : '低'; };
function wangShuaiVote(P, season) {
  const g = (x) => ({ gan: x.gan, zhi: x.zhi });
  const w = judgeWangShuai({ 年: g(P.year), 月: g(P.month), 日: g(P.day), 时: g(P.hour) }), bd = w.breakdown;
  const hurt = monthHurt(P, season || {}), cut = hurt.factor < 1;
  const ling = cut ? +(bd.得令 * hurt.factor).toFixed(2) : bd.得令;
  const score = cut ? +(ling + bd.长生 + bd.得地 + bd.得势).toFixed(2) : w.score, level = cut ? wsLevel(score) : w.verdict;
  return { school: '旺衰打分法', level, ...norm(level), score, confidence: cut ? wsConfidence(score) : w.confidence,
           month_hurt: cut ? { items: hurt.items.map(([k, x]) => `${k}×${x}`), factor: +hurt.factor.toFixed(3), ling_raw: bd.得令, ling, score_raw: w.score, level_raw: w.verdict } : null,
           why: `得令 ${cut ? `${bd.得令}→${ling}（月令${hurt.items.map(([k]) => k).join('、')}，折到 ${+hurt.factor.toFixed(3)}）` : bd.得令}、长生 ${bd.长生}、得地 ${bd.得地}、天干得势 ${bd.得势}` };
}

// ── 体感判官（2026-10-01 SOP）：两派喜忌相反时，挑近几年两派各自的「干支纯年」问顺逆，反推喜忌 ──
const ganzhiOf = (y) => GAN[((y - 4) % 10 + 10) % 10] + ZHI[((y - 4) % 12 + 12) % 12];
function favorableSets(dm) {
  const e = elG(dm), keMe = Object.keys(KE).find((x) => KE[x] === e), shengMe = Object.keys(SHENG).find((x) => SHENG[x] === e);
  return { 强: [SHENG[e], KE[e], keMe], 弱: [shengMe, e] };   // 身强喜克泄耗（食伤、财、官杀），身弱喜生扶（印、比劫）
}
function tiganAsk(P, nowY) {
  const sets = favorableSets(P.day.gan), cand = { 强: [], 弱: [] };
  for (let y = nowY - 1; y >= nowY - 8; y--) {
    const gz = ganzhiOf(y), eg = elG(gz[0]), ez = elZ(gz[1]);
    if (!(eg === ez || SHENG[eg] === ez || SHENG[ez] === eg)) continue;   // 干支互克的混杂年不用
    for (const side of ['强', '弱']) if (sets[side].includes(eg) && sets[side].includes(ez) && cand[side].length < 2) cand[side].push({ year: y, gan_zhi: gz, elements: [...new Set([eg, ez])], if_smooth: side });
  }
  const first = [];
  const order = [...cand.强, ...cand.弱].sort((a, b) => b.year - a.year);
  if (order[0]) first.push(order[0]);
  const other = order[0] ? cand[order[0].if_smooth === '强' ? '弱' : '强'][0] : null;
  if (other) first.push(other);
  for (const c of order) if (first.length < 3 && !first.includes(c)) first.push(c);
  return { sop: '问感受不问事件；零暗示（不说按哪派该顺）；一次最多三个年份；允许没感觉；全指向同一组定案，一错一对加问一年，全没感觉标体感不可判',
           favorable_if: sets, candidates: [...cand.强, ...cand.弱].sort((a, b) => b.year - a.year), first_ask: first.sort((a, b) => b.year - a.year),
           enough: cand.强.length > 0 && cand.弱.length > 0 };
}

// 方向一致才算多数：强、弱都有票＝硬分歧（待定，用经历核），不管几比几；其余过半定，中对一边＝软分歧（偏那一边）
function decide(sides, timeKnown) {
  if (!timeKnown) return { side: '待定', agree: '时辰不详', kind: null };
  if (!sides.length) return { side: '待定', agree: '无票', kind: null };
  const count = { 强: 0, 中: 0, 弱: 0 };
  for (const x of sides) count[x]++;
  if (count.强 && count.弱) return { side: '待定', agree: '分歧', kind: '硬分歧' };
  if (count.强 + count.弱 === 1) return { side: '待定', agree: '孤票', kind: '孤票' };   // v1.2：只有一票有方向，不管哪边（只剩它一票也算）
  if (sides.every((x) => x === sides[0])) return { side: sides[0], agree: '一致', kind: null };
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]);
  if (top[0][1] > sides.length / 2) return { side: top[0][0], agree: '多数', kind: null };
  return { side: count.强 ? '强' : '弱', agree: '分歧', kind: '软分歧' };
}

function strengthVote(bz, N, now = new Date()) {
  if (!bz || bz.status !== 'ok') return null;
  const b = bz.bazi, P = b.pillars, timeKnown = !!(P.hour && P.hour.gan);
  const votes = [];
  votes.push({ school: '排盘引擎', level: b.strength, ...norm(b.strength), why: '月令、通根、得势三项合看（七档）' });
  if (timeKnown) votes.push(wangShuaiVote(P, b.wuxingSeason));
  const xp = xinpai(P);
  votes.push({ school: '新派', ...xp });

  let west = { school: '西盘主体力量尺子 v0', role: '佐证，不进票', tier: '缺料不判' };
  if (N) {
    const S = Math.round(rctx.S(N, false) * 100) / 100, [lo, hi] = WEST_TH.full;
    west = { ...west, S, tier: S > hi ? '强' : S < lo ? '弱' : '中', why: '太阳和命主星的庙旺、宫位、相位合算，和两万张合成盘比上下三成' };
  }

  const cast = votes.filter((v) => v.side);
  let { side, agree, kind } = decide(cast.map((v) => v.side), timeKnown);
  // v1.3 补（10-06）：三票都没方向（中和或弃权）、西盘尺子却明确强或弱——按孤票同等待遇，待定、出题。
  // 中和取泄耗克＝隐含偏强，尺子反向时喜忌就整套反了，不问不行
  if (side === '中' && (west.tier === '强' || west.tier === '弱')) ({ side, agree, kind } = { side: '待定', agree: '中和·尺子有方向', kind: '尺子有方向' });
  const extreme = cast.some((v) => v.extreme);
  // v1.2 实锤档：三票同向，或两票同向＋西盘尺子同向。强弱向的说法（身旺身衰、花名、神煞话术）只在实锤档放行
  const same = cast.filter((v) => v.side === side).length;
  const firm = (side === '强' || side === '弱') && (same >= 3 || (same >= 2 && west.tier === side));
  const needReview = kind === '硬分歧' || kind === '孤票' || kind === '尺子有方向';
  return {
    schema: 'xuanji.strength_vote/0.2',
    rule: 'v1.3：三票（排盘引擎／旺衰打分法／新派），方向一致才算多数；强、弱都有票＝硬分歧→待定，用经历核；只有一票有方向＝孤票→待定，用经历核；三票都没方向但西盘尺子明确强或弱→待定，用经历核；强弱向的说法只在实锤档（三票同向，或两票同向＋西盘同向）放行；旺衰打分法的得令按月令伤情打折；一票判到极档只触发从格复核，复核成立才按特殊格局论；时辰不详不判；西盘只佐证；外部排盘软件的结果只存档不计票。',
    votes, west,
    verdict: { side, agree, kind, extreme, firm, special: !!(b.pattern && b.pattern.isSpecial), need_review: needReview,
               west_agrees: west.tier === '缺料不判' || side === '待定' ? null : west.tier === side },
    favorable_if: favorableSets(P.day.gan),
    ask: needReview ? tiganAsk(P, now.getFullYear()) : null,
    // 用你的经历核一次（10-05）：硬分歧、孤票必问，其余可选；特殊格局（复核成立）、时辰不详不问；一票极档但复核没成立的照问
    feel: timeKnown && !(b.pattern && b.pattern.isSpecial)
      ? { need: needReview, ...feelAsk(P.day.gan, now.getFullYear(), bz.input && bz.input.date ? Number(bz.input.date.slice(0, 4)) : null) } : null,
  };
}

module.exports = { strengthVote, tiganAsk, xinpai, favorableSets, decide, monthHurt, wangShuaiVote };
