// 身强身弱校正（照网站校正页的问法，10-10）：网站上先试过、定了以后各处一起改——
// 网站 Godness bazi/school-view.js calibratePage 的题、选项、算分原样搬到这里，接口（Skill、Kimi）和小工具用同一份；改题、改分要两边一起改。
// ① 8 道日常性格题，每题 5 个选项，有的偏身强、有的偏身弱、有的不偏。哪个选项偏哪边只在这里，回包不给（零暗示）。
// ② 「过去这些年，哪些方面有过大变化」：用户自己说哪一年、什么事、好事还是坏事。
//    扶抑派身强喜的五行、身弱喜的五行正好把五行分成两半（vote.favorable_if）；好事＝对顺的那边是证据，坏事＝对另一边是证据。
// 10-14 命理组 裁定（大运把流年抵掉了：戊辰这类两字同五行的大运永远自带 2 票）：哪边顺只看流年两个字，一喜一忌抵平＝那一年不计分；
//    大运只定分量：大运两个字都站在流年那一边记 2 分，只沾一个字或全不沾记 1 分。
// 10-13 命理组 裁定（「校正的本分是核盘，不是翻盘」）：性格题每题 1 分，每一边各自最多算 2 分；每题第六项「说不准／都不好说」不算分。
// 定案（10-14 命理组 门槛）：这一边总分 ≥ 4，其中至少 2 分来自大事；
//    顺盘（定到盘面原判那一边，或原判待定）：领先 ≥ 2；
//    逆盘（几种判法一致或多数、要定到反面）：领先 ≥ 3，并且至少 2 件大事站在翻转方向（同边加倍的那件按 1 件数）。
//    否则「没对上」，保持原来的判断。只答性格题的一律不定案。
// 定了以后跟网站一样：拿接口出过题的干支纯年（前 3 个），都按这一边当「核一核」的回答，接着走原来那条路定身强身弱、挑派、出喜用和大运。
const SCHEMA = 'xuanji.calib/0.1';
const RULES = { lead: 2, flipLead: 3, min: 4, eventMin: 2, flipEvents: 2, traitCap: 2, traits: 8, maxEvents: 30, years: 3 };
const RULES2 = { traitCap: 2, flipLead: 3, flipHits: 2, sure: 2, sureHits: 2, gapBase: 1, periodCap: 3, periodSpan: 15, maxPeriods: 6, maxTurns: 6 };   // 10-30 用 1000 张编的盘对比过三种门槛，取中间这套（见 CC 作战板 10-30）

const TRAITS = [
  ['平时做事的节奏更像？', [['看状态来，松一阵紧一阵', '弱'], ['稳稳地推，一步一个脚印', ''], ['节奏快，偶尔顾此失彼', ''], ['我来定节奏，带着大家往前走', '强'], ['慢一点，常常被事情推着走', '弱']]],
  ['熟人最常夸你什么？', [['好相处，跟谁都处得来', '弱'], ['有冲劲，什么都敢试', '强'], ['靠谱，交给你就放心', ''], ['有主见，拍板快', '强'], ['细心，会照顾人', '弱']]],
  ['压力很大的时候，你通常？', [['先躲起来，谁也不想理', '弱'], ['找人说说，出去散散心', '弱'], ['冷静下来，一件件拆开处理', ''], ['盯住目标，硬扛过去', '强'], ['越难越来劲', '强']]],
  ['你最受不了哪一种？', [['没人懂你、被忽视', '弱'], ['被人拖慢、效率太低', '强'], ['被打乱安排、做不了主', '强'], ['被卷进争吵、不得安宁', '弱'], ['日子一成不变', '']]],
  ['拿主意时你更靠什么？', [['当下的感觉', '弱'], ['以前的经验', ''], ['多问多比，反复掂量', '弱'], ['先干起来，边做边调', '强'], ['看结果，快刀斩乱麻', '强']]],
  ['你的精力更像哪一种？', [['用完要一个人慢慢回血', '弱'], ['一直很足，停不下来', '强'], ['不高不低，细水长流', ''], ['平时省着，关键时刻爆发', ''], ['像发动机，很少熄火', '强']]],
  ['你更容易掉进哪种状态？', [['想太多', '弱'], ['起伏不大，很少掉进哪一种', ''], ['看事情，有时急有时慢', ''], ['太着急', '强'], ['太在意别人怎么看', '弱']]],   // 10-13 原来五项全算分（弱 3 强 2），换三项（命理组 核过）
  ['新机会摆在面前时？', [['随缘，不强求', '弱'], ['真感兴趣才去争', ''], ['先掂量稳不稳', ''], ['主动去争，想证明自己', '强'], ['一定要拿下', '强']]],
];
for (const t of TRAITS) t[1].push(['说不准／都不好说', '']);   // 10-13：每题第六个选项，不算分
// 10-30 补全（用户反馈「恋爱、桃花」这些没有，事件太少）：每个方面补常见的几件，加「人际」。选哪件事只是帮用户想起来，算分只看哪一年、好事还是坏事
const DOMAINS = [
  ['感情', ['初恋', '谈恋爱', '桃花旺', '遇到正缘', '订婚', '结婚', '冷战', '失恋', '分手', '离婚', '复合', '被背叛', '被骗', '单身很久']],
  ['事业', ['找到工作', '升职', '加薪', '降职', '被裁员', '跳槽', '换岗位', '创业', '签下大单', '合作破裂', '公司倒闭', '失业', '转行', '出名走红']],
  ['钱财', ['第一桶金', '收入大涨', '收入大减', '投资赚钱', '意外之财', '中奖', '买房', '买车', '投资亏损', '被骗钱', '借出去没还', '负债', '还清欠债', '破产']],
  ['学业', ['中考', '高考', '落榜', '考上好学校', '考研', '留学', '毕业', '休学', '考试受阻', '考证', '获奖']],
  ['健康', ['大病', '手术', '住院', '意外受伤', '慢性病', '失眠焦虑', '心理困扰', '走出低谷', '康复', '减肥成功']],
  ['家庭', ['孩子出生', '怀孕', '亲人离世', '亲人重病', '父母离婚', '和家人闹翻', '安家置业', '搬家移民', '家道中落', '家庭变故']],
  ['人际', ['遇到贵人', '被人帮了大忙', '被小人陷害', '朋友反目', '官司纠纷', '名声受损']],
];
// 结果卡四格（话是我们写的，都往好里说）
const RES = {
  强: [['能量核心', '底气足、恢复快，越忙越有劲。'], ['性格心态', '有主见，认准了不轻易动摇。'], ['行事风格', '自己拿主意，推进快、效率高。'], ['社交倾向', '气场足，常是大家的主心骨。']],
  弱: [['能量核心', '心思细、感受深，独处就能回血。'], ['性格心态', '温和体贴，想得周全又细腻。'], ['行事风格', '稳妥，看清再动，有人撑最出彩。'], ['社交倾向', '好相处、会照顾人，让人安心。']],
};
const SAY = {
  done: '身强身弱是对整张盘力量的概括，具体还要结合整体结构和现实情况。',
  none: (base) => `回答两边差不多，${base ? `还是按原来的偏${base}看` : '先保持原来的看法'}。多说几件这些年的大事，可以再看一次。`,   // 10-14 命理组 给的白话
  flip: (base) => `和盘面原判（身${base}）相反，是按你的经历定的。`,
};
const GAN_E = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const ZHI_E = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const GZ = (y) => '甲乙丙丁戊己庚辛壬癸'[((y - 4) % 10 + 10) % 10] + '子丑寅卯辰巳午未申酉戌亥'[((y - 4) % 12 + 12) % 12];
const KEYS = 'ABCDEF';

// 题（给宿主和页面照着问）：选项不标偏哪边
function calibAsk() {
  return {
    schema: SCHEMA,
    traits: TRAITS.map(([q, ops], i) => ({ no: i + 1, q, options: ops.map(([t], j) => ({ key: KEYS[j], text: t })) })),
    events: { q: '过去这些年，哪些方面有过大变化？', hint: '可以说好几件；每件事说是哪一年、好事还是坏事。说上 4～5 件最准。', domains: DOMAINS.map(([name, list]) => ({ name, events: list })) },
    periods: { q: '有没有哪几年，整体特别难或者特别顺？', hint: '选从哪年到哪年；说不上是哪一件事也没关系。' },   // 10-30 加
    turns: { q: '有没有哪一年，开始明显变好或者变差？', hint: '选那一年，再选是开始变好还是开始变差。' },   // 10-30：去掉「不说也能看结果」，只答性格题定不下来
    rules: { flip_lead: RULES2.flipLead, flip_hits: RULES2.flipHits, sure: RULES2.sure, sure_hits: RULES2.sureHits, gap_base: RULES2.gapBase, trait_cap: RULES2.traitCap },
  };
}

// 入参检查：calib＝{ traits: [8 个，每个是 A–F 或 0–5 或 null；F＝说不准], events: [{ domain, event?, year, good }] }；返回规整过的一份，不合法返回 null
function calibParse(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const tr = c.traits == null ? [] : c.traits;
  if (!Array.isArray(tr) || tr.length > RULES.traits) return null;
  const traits = [];
  for (let k = 0; k < RULES.traits; k++) {
    const v = tr[k];
    if (v == null) traits.push(null);
    else if (Number.isInteger(v) && v >= 0 && v < KEYS.length) traits.push(v);
    else if (typeof v === 'string' && v.length === 1 && KEYS.includes(v.toUpperCase())) traits.push(KEYS.indexOf(v.toUpperCase()));
    else return null;
  }
  const ev = c.events == null ? [] : c.events;
  if (!Array.isArray(ev) || ev.length > RULES.maxEvents) return null;
  const events = [];
  for (const x of ev) {
    if (!x || typeof x !== 'object' || !Number.isInteger(x.year) || x.year <= 1900 || x.year >= 2100 || typeof x.good !== 'boolean') return null;
    const d = DOMAINS.find((z) => z[0] === x.domain);
    if (x.domain != null && !d) return null;
    if (x.event != null && (typeof x.event !== 'string' || x.event.length > 20)) return null;
    events.push({ domain: x.domain || null, event: x.event || null, year: x.year, good: x.good });
  }
  // 哪几年整体很难／很顺（从哪年到哪年），哪一年开始变好／变差
  const yr = (y) => Number.isInteger(y) && y > 1900 && y < 2100;
  const pr = c.periods == null ? [] : c.periods, tn = c.turns == null ? [] : c.turns;
  if (!Array.isArray(pr) || pr.length > RULES2.maxPeriods || !Array.isArray(tn) || tn.length > RULES2.maxTurns) return null;
  const periods = [], turns = [];
  for (const x of pr) { if (!x || typeof x !== 'object' || !yr(x.from) || !yr(x.to) || x.to < x.from || x.to - x.from > RULES2.periodSpan || typeof x.good !== 'boolean') return null; periods.push({ from: x.from, to: x.to, good: x.good }); }
  for (const x of tn) { if (!x || typeof x !== 'object' || !yr(x.year) || typeof x.up !== 'boolean') return null; turns.push({ year: x.year, up: x.up }); }
  return { traits, events, periods, turns };
}

// 这一年对身强、身弱哪边顺（同网站 lean()）：n 只算流年两个字，> 0 身强那边顺，< 0 身弱那边顺，0＝一喜一忌（不计分）；
// w＝大运两个字都在 n 那边记 2，否则 1
function leanOf(y, favIf, cycles) {
  const gz = GZ(y), c = (cycles || []).find((z) => z.startYear <= y && y <= z.endYear), luck = c && c.ganZhi ? c.ganZhi : null;
  if (!favIf) return { n: 0, w: 0, gan_zhi: gz, luck };
  const side1 = (e) => (favIf.强 || []).includes(e) ? 1 : (favIf.弱 || []).includes(e) ? -1 : 0;
  const n = side1(GAN_E[gz[0]]) + side1(ZHI_E[gz[1]]);
  if (!n) return { n: 0, w: 0, gan_zhi: gz, luck };
  const to = Math.sign(n);
  return { n, w: luck && side1(GAN_E[luck[0]]) === to && side1(ZHI_E[luck[1]]) === to ? 2 : 1, gan_zhi: gz, luck };
}

// 计分（同网站 score()）：favIf＝method.bazi.strength.vote.favorable_if，cycles＝bazi.luck.cycles，verdict＝vote.verdict（都取没答题时那一份）
function calibScore(calib, { favIf, cycles, verdict }) {
  const tr = { 强: 0, 弱: 0 }, evp = { 强: 0, 弱: 0 }, evn = { 强: 0, 弱: 0 };
  calib.traits.forEach((j, k) => { const sd = j == null ? '' : TRAITS[k][1][j][1]; if (sd) tr[sd]++; });
  const events = calib.events.map((x) => {
    const l = leanOf(x.year, favIf, cycles);
    if (!l.n) return { ...x, gan_zhi: l.gan_zhi, luck: l.luck, to: null, weight: 0 };
    const to = (l.n > 0) === x.good ? '强' : '弱';
    evp[to] += l.w; evn[to]++;
    return { ...x, gan_zhi: l.gan_zhi, luck: l.luck, to, weight: l.w };
  });
  const n = { 强: Math.min(tr.强, RULES.traitCap) + evp.强, 弱: Math.min(tr.弱, RULES.traitCap) + evp.弱 };   // 性格题每边最多 2 分
  // 盘面原判：几种判法一致或多数看强（弱）才算有方向；待定的盘两个方向门槛一样
  const vd = verdict || {}, base = (vd.side === '强' || vd.side === '弱') && (vd.agree === '一致' || vd.agree === '多数') ? vd.side : null;
  const ok = (sd) => {
    const ot = sd === '强' ? '弱' : '强';
    if (n[sd] < RULES.min || evp[sd] < RULES.eventMin) return false;   // 总分到 4，其中至少 2 分来自大事（只答性格题的定不了）
    if (base && sd !== base) return n[sd] - n[ot] >= RULES.flipLead && evn[sd] >= RULES.flipEvents;   // 逆盘：领先 3，至少 2 件大事在翻转方向
    return n[sd] - n[ot] >= RULES.lead;   // 顺盘、待定的盘：领先 2
  };
  const side = ok('强') ? '强' : ok('弱') ? '弱' : null;
  return { side, base, flip: !!(side && base && side !== base), tally: n, traits: calib.traits.filter((j) => j != null).length, events };
}

// 定了以后交给原来那条路的回答（同网站 finish()）：接口出过题的干支纯年（首轮在前、加问备选在后，去掉背离年）前 3 个，都按这一边
function calibAnswers(check, side) {
  if (!check || !side) return null;
  return [...(check.first_ask || []), ...(check.extra || [])].filter((x) => x.pure !== false && x.kind !== '背离').slice(0, RULES.years).map((x) => ({ year: x.year, pick: side }));
}

// 回包里的结果（给宿主和页面说）：定了给身X型、四格、一句提醒；没对上给一句话
function calibResult(sc, answers) {
  const side = sc.side;
  return {
    schema: SCHEMA, status: side ? '定案' : '没对上', side, type: side ? `身${side}型` : null,
    cards: side ? RES[side].map(([title, text]) => ({ title, text })) : null,
    say: side ? SAY.done : SAY.none(sc.base),
    flip: sc.flip ? SAY.flip(sc.base) : null,   // 定到盘面原判的反面要明说（同网站 .xbc-flip）
    used: { traits: sc.traits, events: sc.events.length },
    // 留痕核对用，对用户不报分数。用户说的大事不回显：回包会进 Skill／插件的网页报告（链接能转发），经历只留件数（10-10）
    detail: { tally: sc.tally, answers: answers || null },
  };
}


// ── 10-30 起：几套喜用直接对经历──
// 起因：一位用户（强弱三票打架、默认按格局派给了喜金水）怎么校都是「印证不足」。原来只分身强、身弱两边：
//   ① 一年里一喜一忌（比如木火各一个字）整年不计分，偏偏转折的年份多是这种；② 调候派、格局派根本不参加校正；③ 强弱定不了的盘默认按格局派，没有依据。
// 新办法，所有盘一套：
//   · 候选＝这张盘上几派给出的喜用（扶抑身强、扶抑身弱、调候、格局，格局派疑似从强再加一套；特殊格局盘的格局派就是从格那套）。答案只从盘上来，用户只能说经历，不能自己挑。
//   · 每件事逐套记分：这一年流年两个字在这一套里喜 +1、忌 -1、闲 0，合起来大于 0＝这一套说这年顺，小于 0＝难，等于 0＝这一套这年不表态（只是这一套不记，别的套照记）。
//     对上记 +分、对不上记 −分；大运两个字都站在同一边记 2 分，否则 1 分（10-14 命理组「流年定方向、大运定分量」照旧）。
//   · 性格题只说身强身弱：只加给整套站在身强或身弱一边的候选，每边最多 2 分（10-13「性格题每边最多 2 分」照旧）。
//   · 默认那套（没校正时页面给的）占先：强弱有方向、特殊格局的盘，别的套要领先默认 3 分、至少对上 2 件、还比第二名多才换（「校正的本分是核盘，不是翻盘」）；默认那套要比第二名多、至少对上 2 件才算核准；
//     强弱定不了的盘没有原判，谁领先给谁；比第二名多不到 2 分写「更接近」，也照它给（一定给答案）。只有一件能看出方向的经历都没有，才保持暂定。
const sig = (c) => [...c.fav].sort().join('') + '|' + [...c.bad].sort().join('');
const SCHOOL_RANK = { 扶抑: 0, 格局: 1, 调候: 2 };
// 候选：schools＝排盘服务的 bazi.schools；同一套喜忌只留一个（扶抑身弱跟调候一样时，只看名次在前的那派）
function calibSets(schools) {
  if (!schools) return [];
  const f = schools.fuyi && schools.fuyi.sides, out = [];
  const add = (key, school, side, u, doubt) => { if (u && !u.abstain && (u.favorableWuxing || []).length) out.push({ key, school, side: side || null, doubt: !!doubt, fav: u.favorableWuxing || [], bad: u.unfavorableWuxing || [], rank: SCHOOL_RANK[school] * 10 + (doubt ? 5 : 0) + (side === '弱' ? 1 : 0) }); };
  if (f) for (const sd of ['强', '弱']) add(`扶抑·${sd}`, '扶抑', sd, f[sd]);
  add('格局', '格局', null, schools.geju);
  if (schools.geju && schools.geju.qiang_doubt) add('格局·从强', '格局', null, schools.geju.qiang_doubt, true);
  add('调候', '调候', null, schools.tiaohou);
  const seen = new Map(); for (const c of out.sort((a, b) => a.rank - b.rank)) { const k = sig(c); if (seen.has(k)) seen.get(k).also.push(c.key); else seen.set(k, { ...c, also: [] }); }
  return [...seen.values()];
}
// 这一年这一套怎么看：n＞0 顺、＜0 难、0 不表态；w＝大运两个字都在同一边记 2，否则 1
function leanSet(y, c, cycles) {
  const gz = GZ(y), v = (e) => (c.fav.includes(e) ? 1 : c.bad.includes(e) ? -1 : 0), n = v(GAN_E[gz[0]]) + v(ZHI_E[gz[1]]);
  if (!n) return { n: 0, w: 0 };
  const cy = (cycles || []).find((z) => z.startYear <= y && y <= z.endYear), lk = cy && cy.ganZhi, to = Math.sign(n);
  return { n, w: lk && v(GAN_E[lk[0]]) === to && v(ZHI_E[lk[1]]) === to ? 2 : 1 };
}
// 强弱定不了的盘没校正时默认给哪套（10-30）：原来按「扶抑→格局→调候」的施工顺序落到格局派，常常是几派里唯一唱反调的那个。
// 改成：每个五行看几套里多数说喜还是忌（扶抑身强、身弱两套按三种判法各投给哪边加权），跟多数最一致的那一套整套取，不拼半套
function consensusSet(sets, votes) {
  const live = sets.filter((c) => !c.doubt); if (!live.length) return null;
  // 判中和的那票有分数的（旺衰打分法），按分数偏哪边算半票：比如 -0.45 是「差一点就偏弱」
  const lean = (v) => (v.side === '强' || v.side === '弱' ? [v.side, 1] : v.side === '中' && Number.isFinite(v.score) && v.score ? [v.score > 0 ? '强' : '弱', 0.5] : [null, 0]);
  let n强 = 0, n弱 = 0; for (const v of votes || []) { const [sd, w] = lean(v); if (sd === '强') n强 += w; else if (sd === '弱') n弱 += w; }
  const tot = Math.max(1, n强 + n弱);
  const wt = (c) => (c.key === '扶抑·强' ? n强 / tot : c.key === '扶抑·弱' ? n弱 / tot : 1);
  const say = (c, e) => (c.fav.includes(e) ? 1 : c.bad.includes(e) ? -1 : 0), maj = {};
  for (const e of '木火土金水') maj[e] = Math.sign(live.reduce((a, c) => a + wt(c) * say(c, e), 0));
  const agree = (c) => [...'木火土金水'].filter((e) => maj[e] && say(c, e) === maj[e]).length * wt(c);
  return [...live].sort((a, b) => (agree(b) - agree(a)) || (a.rank - b.rank))[0];
}
// 记分和定案。sets＝calibSets，dflt＝没校正时页面给的那套的 key，base＝强弱有方向（一致、多数）或特殊格局，fi＝vote.favorable_if
function calibPick(calib, { sets, dflt, base, cycles, fi }) {
  const tr = { 强: 0, 弱: 0 }; calib.traits.forEach((j, k) => { const sd = j == null ? '' : TRAITS[k][1][j][1]; if (sd) tr[sd]++; });
  const sideOf = (c) => (fi && c.fav.every((e) => (fi.强 || []).includes(e)) ? '强' : fi && c.fav.every((e) => (fi.弱 || []).includes(e)) ? '弱' : null);
  const T = sets.map((c) => ({ ...c, s: 0, hit: 0, miss: 0 }));
  let info = 0;
  // 转折年＝那一年跟前一年各算一件（开始变好＝那年好、前一年难）
  const evs = [...calib.events, ...(calib.turns || []).flatMap((t) => [{ year: t.year, good: t.up }, { year: t.year - 1, good: !t.up }])];
  for (const ev of evs) {
    let any = false;
    for (const c of T) { const l = leanSet(ev.year, c, cycles); if (!l.n) continue; any = true; if ((l.n > 0) === ev.good) { c.s += l.w; c.hit++; } else { c.s -= l.w; c.miss++; } }
    if (any) info++;
  }
  // 一段时间：逐年对，合起来最多 ±3 分、记一件，不让一段话压过别的经历
  for (const pd of calib.periods || []) {
    let any = false;
    for (const c of T) {
      let net = 0; for (let y = pd.from; y <= pd.to; y++) { const l = leanSet(y, c, cycles); if (l.n) net += (l.n > 0) === pd.good ? l.w : -l.w; }
      if (!net) continue; any = true; c.s += Math.max(-RULES2.periodCap, Math.min(RULES2.periodCap, net)); if (net > 0) c.hit++; else c.miss++;
    }
    if (any) info++;
  }
  for (const c of T) { const sd = sideOf(c); if (sd) c.s += Math.min(tr[sd], RULES2.traitCap); }
  const D = T.find((c) => c.key === dflt || c.also.includes(dflt)) || T[0];
  const R = [...T].sort((a, b) => (b.s - a.s) || ((b === D) - (a === D)) || (a.rank - b.rank)), top = R[0], gap = R[1] ? top.s - R[1].s : 99;
  const tally = Object.fromEntries(T.map((c) => [c.key, { score: c.s, hit: c.hit, miss: c.miss }]));
  if (!info) return { key: D.key, status: '暂定', reason: 'few', tally, info };
  if (base) {
    if (top === D) return { key: D.key, status: gap >= RULES2.gapBase && D.hit >= RULES2.sureHits ? '定案' : '暂定', reason: 'few', tally, info };
    return top.s - D.s >= RULES2.flipLead && top.hit >= RULES2.flipHits && gap >= RULES2.gapBase
      ? { key: top.key, status: '定案', flip: true, tally, info } : { key: D.key, status: '没对上', reason: 'mixed', tally, info };
  }
  return { key: top.key, status: gap >= RULES2.sure && top.hit >= RULES2.sureHits ? '定案' : '更接近', tally, info };
}
// 回包（给宿主和页面说）：老字段照留（status 定案／没对上／不适用，type，cards，say，flip）；新加 school（定到哪一套）、close（领先不多，写「更接近」）、favorable／unfavorable
const SAY2 = {
  few: '你说的经历还不够看出方向，先按盘面看。再说几件这些年的大事，或者哪几年特别难、特别顺，就能定下来。',
  mixed: '你说的经历跟盘面原来的看法不太一致，但还不够换掉它，先按盘面看。再多说几件，会更准。',
  close: '按你说的经历，更接近这一套；再多说几件这些年的大事，会更准。',
};
// 没定也给答案：status 照旧回「没对上」，同时给出现在按的那一套（keep），页面写「先按盘面看」
function calibResult2(pk, set, base) {
  const ok = pk.status === '定案' || pk.status === '更接近', fy = set && set.school === '扶抑' ? set.side : null;
  return {
    schema: SCHEMA, status: ok ? '定案' : '没对上', close: pk.status === '更接近', keep: !ok,
    side: ok ? fy : null, type: !set ? null : fy ? `身${fy}型` : `喜${set.fav.join('、')}`,
    cards: ok && fy ? RES[fy].map(([title, text]) => ({ title, text })) : null,
    school: set ? { key: set.key, name: set.school, side: fy } : null,
    favorable: set ? set.fav : null, unfavorable: set ? set.bad : null,
    say: ok ? (pk.status === '更接近' ? SAY2.close : SAY.done) : SAY2[pk.reason] || SAY2.few,
    flip: ok && pk.flip ? (base ? `和盘面原来的看法（${base}）不同，是按你的经历定的。` : '是按你的经历定的。') : null,
    used: { traits: null, events: null },
    detail: { tally: pk.tally, picked: pk.key, info: pk.info },   // 留痕核对用，对用户不报分数
  };
}

module.exports = { SCHEMA, RULES, RULES2, TRAITS, DOMAINS, RES, GZ, calibAsk, calibParse, calibScore, calibAnswers, calibResult, leanOf, calibSets, leanSet, consensusSet, calibPick, calibResult2 };
