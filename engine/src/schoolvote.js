// 多派交叉论证·投票层 v0（10-08 施工；命理组架构细案 v1 第三、四节，10-07 回信第 5 条「合成一轮问」）
// 投票层只裁决、不判断：三派（扶抑／调候／格局）在排盘服务里各自算好的流年顺逆原样拿来，挑年问用户；
// 用户对上哪派，那一派的说法上桌，其余收起；永远不改任何派的内部规则。东西方不混，西盘不进这一层。
// 一轮「核核你」：首轮最多 3 题、加问最多 2 题、一张盘总共最多 5 题，同一年不重复问。内部两本账：
//   身强身弱（feel.js 原样：两种读法选哪种）；派别（这一年用户觉得顺还是糟，跟各派的预言对）。
// 一题两用：题目沿用「用你的经历核一次」的两种读法（10-05 定的问法：一条一件事、带质地，不问「哪年明不明显」）。
//   干支纯年里两种读法正好一好一坏：帮身的年（印比）身弱读法是好的那条，耗身的年（食伤财官）身强读法是好的那条；
//   选了好的那条＝那年顺，坏的那条＝那年糟；「都沾」「记不清」不进派别账。背离年两条各半好半坏，只进身强身弱账。
// 各派的预言：流年档位 0～1＝顺、3～4＝逆，2 平稳＝这派这年没表态，不拿来记账。扶抑派分身强、身弱两套，各算一个候选；
//   哪套作数看身强身弱那本账（核过的定案优先，没核过看几种判法的起点；起点也没方向就两套都留着）。
// 挑年：派别有分歧的年（不同派一说顺、一说逆）先，「干净」的年（流年跟原局无冲、无合〔含三合半合〕、无刑）先，再照 feel 的先后。
//   身强身弱要核：首轮 3 题，照 feel 的规矩帮身、耗身两类都要有，同类里先挑派别有分歧的（一题两用）；
//   不用核（核过了，或特殊格局）：首轮只问派别，挑分歧最大的 1～2 年；三派全一致也固定问 1 年（防三派同错）。
// 计分：某一派至少对上 2 年（三派全一致时对上那 1 年）、一年都没对不上＝这一派上桌；几派同时满足、还有题能把它们分开就再问一年，分不开才算并列；
//   都不满足、题还没问满就加问；问满了还没有＝对不上任何派，降置信：只讲趋势方向，不出断语。
// 从强疑似（格局派 v1.4，10-09 定）：印比占比 0.70～0.75 的盘，格局派照正格出、另附一份从强读法（qiang_doubt）。投票层把它当格局派的
//   第二套候选（「格局·从强」），首轮必出一题财官年核它（从强说这年逆）；核中（答了逆、没有答顺的）才翻面用从强读法，没核过照正格走。
// 门槛都在 RULES 里，是施工先定的，封档验证时按判例库再校。
const { yearItem, feelScore, hash, RULES: FEEL } = require('./feel.js');
const { runNoteWord } = require('./schoolwords.js');

const RULES = { first: 3, schoolFirst: 2, max: 5, smooth: 1, rough: 3, winMin: 2, order: ['扶抑', '格局', '调候'] };
const SCHEMA = 'xuanji.school_vote/0.1';

const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const CHONG = (a, b) => Math.abs(ZHI.indexOf(a) - ZHI.indexOf(b)) === 6;
const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const XING2 = [['寅', '巳'], ['巳', '申'], ['申', '寅'], ['丑', '戌'], ['戌', '未'], ['未', '丑'], ['子', '卯']];
const XING = (a, b) => XING2.some(([x, y]) => (x === a && y === b) || (x === b && y === a)) || (a === b && '辰午酉亥'.includes(a));
const GANHE = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };
const GANCHONG = { 甲: '庚', 庚: '甲', 乙: '辛', 辛: '乙', 丙: '壬', 壬: '丙', 丁: '癸', 癸: '丁' };

const SANHE = [['申', '子', '辰'], ['亥', '卯', '未'], ['寅', '午', '戌'], ['巳', '酉', '丑']], HEART = '子卯午酉';
const ZHI_MAIN = { 子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬' };
// 流年跟原局碰了什么（干净年＝一样都没有）：支冲、六合、刑、半合（带中神的两支）、三合（流年补齐原局两支）；干合、干冲。
// 三合半合 10-08 补上（判例一号就是巳酉半合改了全盘的性，流年撞上合局那年不干净，拿来出题会把账记错派）
function touchOf(gz, P) {
  const ks = ['year', 'month', 'day', 'hour'].filter((k) => P[k] && P[k].zhi), out = [], zs = ks.map((k) => P[k].zhi);
  for (const g of SANHE.filter((x) => x.includes(gz[1]))) {
    const rest = g.filter((z) => z !== gz[1]);
    if (rest.every((z) => zs.includes(z))) out.push(`${gz[1]}${rest.join('')}三合`);
    for (const z of rest) if (zs.includes(z) && (HEART.includes(z) || HEART.includes(gz[1]))) out.push(`${gz[1]}${z}半合`);
  }
  for (const k of ks) {
    const z = P[k].zhi, g = P[k].gan;
    if (CHONG(gz[1], z)) out.push(`${gz[1]}${z}冲`);
    if (LIUHE[gz[1]] === z) out.push(`${gz[1]}${z}合`);
    if (XING(gz[1], z)) out.push(`${gz[1]}${z}刑`);
    if (GANHE[gz[0]] === g) out.push(`${gz[0]}${g}合`);
    if (GANCHONG[gz[0]] === g) out.push(`${gz[0]}${g}冲`);
  }
  return [...new Set(out)];
}

const say = (tier) => (tier === null || tier === undefined ? null : tier <= RULES.smooth ? '顺' : tier >= RULES.rough ? '逆' : null);
// 纯年选了哪种读法＝那年顺还是糟
const feltOf = (kind, pick) => (pick !== '弱' && pick !== '强' ? null : (kind === '扶') === (pick === '弱') ? '顺' : '逆');

// 候选：扶抑·强、扶抑·弱、调候、格局（从强疑似再加「格局·从强」）；不表态的派不进
function candidatesOf(schools) {
  if (!schools) return [];
  const out = [], f = schools.fuyi && schools.fuyi.sides;
  for (const side of ['强', '弱']) if (f && f[side] && !f[side].abstain) out.push({ key: `扶抑·${side}`, school: '扶抑', side, u: f[side] });
  if (schools.tiaohou && !schools.tiaohou.abstain) out.push({ key: '调候', school: '调候', u: schools.tiaohou });
  if (schools.geju && !schools.geju.abstain) out.push({ key: '格局', school: '格局', u: schools.geju });
  if (schools.geju && schools.geju.qiang_doubt) out.push({ key: '格局·从强', school: '格局', side: '从强', doubt: true, u: schools.geju.qiang_doubt });
  return out.map((c) => ({ ...c, years: new Map((c.u.luck || []).flatMap((cy) => (cy.years || []).map((y) => [y.year, y]))) }));
}
const cover = (pred, cs) => cs.filter((c) => pred[c.key]).length;   // 这一年有几派明确表态
const liveOf = (cands, side) => cands.filter((c) => c.school !== '扶抑' || !side || c.side === side);
// 不同派之间有没有一说顺、一说逆（扶抑两套自己跟自己不算）
function splitOf(pred, live) {
  const ks = live.map((c) => c.key);
  for (const a of ks) for (const b of ks) if (a < b && pred[a] && pred[b] && pred[a] !== pred[b] && a.split('·')[0] !== b.split('·')[0]) return true;
  return false;
}

// 出题计划。strengthSide＝身强身弱那本账现在的方向（核过的定案，或几种判法的起点），没方向给 null；strengthNeed＝这轮要不要核身强身弱
function checkPlan({ dm, P, nowY, birthY, lights, schools, strengthSide = null, strengthNeed = false }) {
  const cands = candidatesOf(schools), qc = cands.find((c) => c.doubt);
  if (!cands.length) return null;
  const live = liveOf(cands, strengthSide), L = lights instanceof Map ? lights : new Map((lights || []).map((r) => [r.year, r.bazi]));
  const pool = [];
  for (let y = nowY - 1; y >= nowY - FEEL.span; y--) {
    if (birthY && y - birthY < FEEL.minAge) continue;
    const it = yearItem(dm, y, L.get(y), birthY);
    const predictions = Object.fromEntries(cands.map((c) => [c.key, say(c.years.get(y) && c.years.get(y).tier)]));
    const touch = touchOf(it.gan_zhi, P);
    pool.push({ ...it, predictions, split: it.pure && splitOf(predictions, live), cover: cover(predictions, live), clean: !touch.length, touch,
      ...(qiangOf(qc, it, predictions) ? { qiang_check: true } : {}) });
  }
  const feelRank = (a, b) => ((b.lit > 0) - (a.lit > 0)) || (b.typical - a.typical) || (b.lit - a.lit) || (b.year - a.year);
  const rank = (a, b) => (b.split - a.split) || (b.cover - a.cover) || (b.clean - a.clean) || feelRank(a, b);
  const pure = pool.filter((x) => x.pure).sort(rank);
  let first;
  if (strengthNeed) {
    const fu = pure.filter((x) => x.kind === '扶'), hao = pure.filter((x) => x.kind === '耗');
    if (fu.length && hao.length && pure.length >= RULES.first) { first = [fu[0], hao[0]]; first.push(pure.find((x) => !first.includes(x))); }
  }
  if (!first) {   // 只问派别：有分歧的挑 1～2 年；三派全一致固定问 1 年（挑有派明确表态的）
    const sp = pure.filter((x) => x.split);
    first = sp.length ? sp.slice(0, RULES.schoolFirst) : pure.filter((x) => live.some((c) => x.predictions[c.key])).slice(0, 1);
  }
  // 从强疑似必出一题财官年：挑正格那套不说逆的（问了分得开）、干净的、近的；身强身弱要核时顶掉第三题（它是耗身年，帮身耗身两类照样都有）
  if (qc && !first.some((x) => x.qiang_check)) {
    const q = pure.filter((x) => x.qiang_check && !first.includes(x)).sort((a, b) => ((a.predictions['格局'] === '逆') - (b.predictions['格局'] === '逆')) || (b.clean - a.clean) || (b.year - a.year))[0];
    if (q) { if (first.length >= RULES.first) first[first.length - 1] = q; else first.push(q); }
  }
  if (!first.length) return { schema: SCHEMA, enough: false, why: '近几年没有能拿来对照的干支纯年', candidates: cands.map(brief) };
  first.sort((a, b) => b.year - a.year);
  const extra = [...pure.filter((x) => !first.includes(x)), ...(strengthNeed ? pool.filter((x) => !x.pure && x.kind === '背离').sort(feelRank) : [])];
  const s0 = hash(dm) & 1;
  [...first, ...extra].forEach((x, i) => { x.order = (i + s0) % 2 ? ['强', '弱'] : ['弱', '强']; });
  return {
    schema: SCHEMA, enough: true, rules: RULES, strength_need: strengthNeed, strength_side: strengthSide,
    agree: !pool.some((x) => x.split),   // 窗口里没有一年各派说法相反＝三派一致（仍固定问一年）
    candidates: cands.map(brief), first_ask: first, extra,
  };
}
// 题核从强的年：干支纯年、干或支本气是财官（从强的大忌），从强那套说这年逆
const qiangOf = (qc, it, pred) => !!(qc && it.pure && pred[qc.key] === '逆' && [it.gan_zhi[0], ZHI_MAIN[it.gan_zhi[1]]].some((s) => (qc.u.stems.da || []).includes(s)));
const brief = (c) => ({ key: c.key, school: c.school, side: c.side || null, ...(c.doubt ? { doubt: true } : {}), useful: c.u.useful || null, avoid: c.u.avoid || null,
  favorable: c.u.favorableWuxing || [], unfavorable: c.u.unfavorableWuxing || [], stems: c.u.stems || null });

// 计分：answers＝[{ year, dm, pick: '弱'|'强'|'都沾'|'记不清' }]（跟 feel 同一份回答，同一年以最后一次为准）
function checkScore(dm, answers, plan) {
  if (!plan || !plan.enough) return null;
  const items = new Map([...plan.first_ask, ...plan.extra].map((x) => [x.year, x]));
  const last = new Map();
  for (const a of answers || []) if (a && a.dm === dm && items.has(a.year)) last.set(a.year, a.pick);
  const strength = plan.strength_need ? feelScore(dm, answers, { enough: true, first_ask: plan.first_ask, extra: plan.extra }) : null;
  const side = (strength && strength.decided) || plan.strength_side;
  const tally = Object.fromEntries(plan.candidates.map((c) => [c.key, { hit: 0, miss: 0 }]));
  for (const [y, pick] of last) {
    const it = items.get(y), felt = it.pure ? feltOf(it.kind, pick) : null;
    if (!felt) continue;
    for (const k of Object.keys(tally)) { const p = it.predictions[k]; if (p) tally[k][p === felt ? 'hit' : 'miss']++; }
  }
  // 从强疑似：题核的年答了逆、没有答顺的＝核中，格局派换从强那套；否则照正格那套
  const qc = plan.candidates.find((c) => c.doubt);
  let qiang = null;
  if (qc) {
    qiang = { hit: 0, miss: 0 };
    for (const [y, pick] of last) { const it = items.get(y), felt = it.qiang_check ? feltOf(it.kind, pick) : null; if (felt) qiang[felt === '逆' ? 'hit' : 'miss']++; }
    qiang.verified = qiang.hit > 0 && qiang.miss === 0;
  }
  const live = plan.candidates.filter((c) => (c.school !== '扶抑' || !side || c.side === side) && (!qc || c.school !== '格局' || !!c.doubt === qiang.verified)).map((c) => c.key);
  const ok = live.filter((k) => tally[k].miss === 0 && tally[k].hit >= (plan.agree ? 1 : RULES.winMin));   // 三派全一致只问一年，对上就算
  const top = Math.max(0, ...ok.map((k) => tally[k].hit)), best = ok.filter((k) => tally[k].hit === top)
    .sort((a, b) => RULES.order.indexOf(a.split('·')[0]) - RULES.order.indexOf(b.split('·')[0]));
  const asked = last.size, strengthDone = !strength || strength.status !== '加问';
  // 下一题：派别没分出来，就在还没被排除的几派里挑——有分歧的先，表态的派多的先，干净的先，近的先；
  // 纯年的题同时进身强身弱账，所以派别要问就先问派别；派别分出来了、身强身弱还没定，照 feel 的下一题
  const rest = [...plan.first_ask, ...plan.extra].filter((x) => !last.has(x.year));
  const alive = plan.candidates.filter((c) => live.includes(c.key) && tally[c.key].miss === 0);
  const schoolNext = best.length ? null : rest.filter((x) => x.pure && cover(x.predictions, alive))
    .sort((a, b) => (splitOf(b.predictions, alive) - splitOf(a.predictions, alive)) || (cover(b.predictions, alive) - cover(a.predictions, alive)) || (b.clean - a.clean) || (b.year - a.year))[0] || null;
  // 几派同时满足：还有题可问、又有一年能把它们分开，就再问那一年；分不开（它们说法本来一样）才算并列
  const tied = best.length > 1 ? plan.candidates.filter((c) => best.includes(c.key)) : null;
  const tieBreak = tied ? rest.filter((x) => x.pure && splitOf(x.predictions, tied)).sort((a, b) => (b.clean - a.clean) || (b.year - a.year))[0] || null : null;
  const next = asked >= RULES.max ? null : schoolNext || tieBreak || (!strengthDone && strength.next) || null;
  // 两本账打架（10-08 定）：身强身弱账定了一边，派别账里扶抑的另一套却对上了、留下的这套没对上——线上照身强身弱账出，内部打标记，封档验证单独抽看
  const other = side && plan.candidates.find((c) => c.school === '扶抑' && c.side !== side), kept = side && plan.candidates.find((c) => c.school === '扶抑' && c.side === side);
  const conflict = !!(other && tally[other.key].miss === 0 && tally[other.key].hit >= RULES.winMin && (!kept || !ok.includes(kept.key)));
  const schools = { tally, live, prefer: best[0] || null, tie: best.length > 1 ? best : null, ...(qiang ? { qiang } : {}), ...(conflict ? { internal: { ledger_conflict: true } } : {}) };
  const pending = !!next && (!!tieBreak || !strengthDone);
  const status = best.length && !pending ? '定案' : next ? '加问' : best.length ? '定案' : '降置信';
  // 问过的年份和回答（给页面列出来）：felt＝这一年用户觉得顺还是糟（背离年、都沾、记不清没有）
  const answered = [...last].map(([y, pick]) => { const it = items.get(y); return { year: y, gan_zhi: it.gan_zhi, pick, felt: it.pure ? feltOf(it.kind, pick) : null }; });
  return { status, asked, answers: answered, strength, schools, next,
    why: status === '降置信' ? '问到的年份对不上任何一派：只讲趋势方向，不出断语' : null };
}

// 三派各自的说法（给文字层：上桌的那派按它说，其余收起、可点开）。扶抑派给 side 那一套，没方向两套都给
const TIER = ['顺风', '偏顺', '平稳', '偏紧', '逆风'];
function schoolsBrief(schools, side) {
  if (!schools) return null;
  const one = (u, extra, nm) => (!u || u.abstain ? { abstain: true, why: (u && u.why) || null } : {
    useful: u.useful || null, avoid: u.avoid || null, favorable: u.favorableWuxing || [], unfavorable: u.unfavorableWuxing || [], stems: u.stems || null, ...extra,
    luck: (u.luck || []).map((c) => ({ gan_zhi: c.ganZhi, tier: c.tier, tier_name: TIER[c.tier] ?? null, ...(c.notes ? { notes: c.notes.map((n) => runNoteWord(nm, n)) } : {}) })) });   // 大运注记各派用自己的名词（扶抑、调候不挂格局派的词）
  const f = schools.fuyi && schools.fuyi.sides, g = schools.geju, t = schools.tiaohou;
  return {
    扶抑: !f ? null : side ? { side, ...one(f[side], { why: f[side] && f[side].why }, '扶抑') } : { sides: { 强: one(f.强, { why: f.强 && f.强.why }, '扶抑'), 弱: one(f.弱, { why: f.弱 && f.弱.why }, '扶抑') } },
    调候: !t ? null : one(t, { rule: t.rule && typeof t.rule === 'object' ? { label: t.rule.label, hint: t.rule.hint } : null }, '调候'),
    格局: !g ? null : one(g, { name: g.name || null, kind: g.kind || null, status: g.steps && g.steps.成败 ? g.steps.成败.status : null, hits: g.steps && g.steps.成败 ? g.steps.成败.hits : null, ge_bing: g.ge_bing || null }, '格局'),
  };
}

module.exports = { checkPlan, checkScore, schoolsBrief, candidatesOf, touchOf, feltOf, RULES, SCHEMA, TIER };
