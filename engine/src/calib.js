// 身强身弱校正（照网站校正页的问法，10-10）：网站上先试过、定了以后各处一起改——
// 网站 Godness bazi/school-view.js calibratePage 的题、选项、算分原样搬到这里，接口（Skill、Kimi）和小工具用同一份；改题、改分要两边一起改。
// ① 8 道日常性格题，每题 5 个选项，有的偏身强、有的偏身弱、有的不偏。哪个选项偏哪边只在这里，回包不给（零暗示）。
// ② 「过去这些年，哪些方面有过大变化」：用户自己说哪一年、什么事、好事还是坏事。每一条按那一年的流年加所在大运四个字算：
//    扶抑派身强喜的五行、身弱喜的五行正好把五行分成两半（vote.favorable_if），四个字落在哪边多，那一年就对哪边顺；
//    好事＝对那边是证据，坏事＝对另一边是证据；流年和大运同一边（|lean| ≥ 2）记 2 分，否则 1 分。
// 两类合起来，一边比另一边多 3 分以上、并且至少 4 分，才定；否则「没对上」，保持原来的判断。
// 定了以后跟网站一样：拿接口出过题的干支纯年（前 3 个），都按这一边当「核一核」的回答，接着走原来那条路定身强身弱、挑派、出喜用和大运。
const SCHEMA = 'xuanji.calib/0.1';
const RULES = { lead: 3, min: 4, traits: 8, maxEvents: 30, years: 3 };

const TRAITS = [
  ['平时做事的节奏更像？', [['看状态来，松一阵紧一阵', '弱'], ['稳稳地推，一步一个脚印', ''], ['节奏快，偶尔顾此失彼', ''], ['我来定节奏，带着大家往前走', '强'], ['慢一点，常常被事情推着走', '弱']]],
  ['熟人最常夸你什么？', [['好相处，跟谁都处得来', '弱'], ['有冲劲，什么都敢试', '强'], ['靠谱，交给你就放心', ''], ['有主见，拍板快', '强'], ['细心，会照顾人', '弱']]],
  ['压力很大的时候，你通常？', [['先躲起来，谁也不想理', '弱'], ['找人说说，出去散散心', '弱'], ['冷静下来，一件件拆开处理', ''], ['盯住目标，硬扛过去', '强'], ['越难越来劲', '强']]],
  ['你最受不了哪一种？', [['没人懂你、被忽视', '弱'], ['被人拖慢、效率太低', '强'], ['被打乱安排、做不了主', '强'], ['被卷进争吵、不得安宁', '弱'], ['日子一成不变', '']]],
  ['拿主意时你更靠什么？', [['当下的感觉', '弱'], ['以前的经验', ''], ['多问多比，反复掂量', '弱'], ['先干起来，边做边调', '强'], ['看结果，快刀斩乱麻', '强']]],
  ['你的精力更像哪一种？', [['用完要一个人慢慢回血', '弱'], ['一直很足，停不下来', '强'], ['不高不低，细水长流', ''], ['平时省着，关键时刻爆发', ''], ['像发动机，很少熄火', '强']]],
  ['你更容易掉进哪种状态？', [['想太多', '弱'], ['太保守', '弱'], ['太纠结', '弱'], ['太着急', '强'], ['太较真', '强']]],
  ['新机会摆在面前时？', [['随缘，不强求', '弱'], ['真感兴趣才去争', ''], ['先掂量稳不稳', ''], ['主动去争，想证明自己', '强'], ['一定要拿下', '强']]],
];
const DOMAINS = [
  ['感情', ['初恋', '遇到正缘', '订婚', '结婚', '冷战', '分手', '离婚', '复合', '被骗']],
  ['事业', ['找到工作', '升职', '降职', '跳槽', '创业', '公司倒闭', '失业', '转行']],
  ['钱财', ['第一桶金', '投资赚钱', '意外之财', '买房', '买车', '投资亏损', '负债', '破产']],
  ['学业', ['高考', '考研', '留学', '休学', '考试受阻', '考证', '获奖']],
  ['健康', ['大病', '意外受伤', '心理困扰', '减肥成功']],
  ['家庭', ['孩子出生', '亲人离世', '安家置业', '搬家移民', '家道中落', '家庭变故']],
];
// 结果卡四格（话是我们写的，都往好里说）
const RES = {
  强: [['能量核心', '底气足、恢复快，越忙越有劲。'], ['性格心态', '有主见，认准了不轻易动摇。'], ['行事风格', '自己拿主意，推进快、效率高。'], ['社交倾向', '气场足，常是大家的主心骨。']],
  弱: [['能量核心', '心思细、感受深，独处就能回血。'], ['性格心态', '温和体贴，想得周全又细腻。'], ['行事风格', '稳妥，看清再动，有人撑最出彩。'], ['社交倾向', '好相处、会照顾人，让人安心。']],
};
const SAY = {
  done: '身强身弱是对整张盘力量的概括，具体还要结合整体结构和现实情况。',
  none: '这些答案，两边差不太多：先保持原来的看法；多说几件大事，再看一次。',
};
const GAN_E = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const ZHI_E = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
const GZ = (y) => '甲乙丙丁戊己庚辛壬癸'[((y - 4) % 10 + 10) % 10] + '子丑寅卯辰巳午未申酉戌亥'[((y - 4) % 12 + 12) % 12];
const KEYS = 'ABCDE';

// 题（给宿主和页面照着问）：选项不标偏哪边
function calibAsk() {
  return {
    schema: SCHEMA,
    traits: TRAITS.map(([q, ops], i) => ({ no: i + 1, q, options: ops.map(([t], j) => ({ key: KEYS[j], text: t })) })),
    events: { q: '过去这些年，哪些方面有过大变化？', hint: '可以说好几件；每件事说是哪一年、好事还是坏事。不说也能看结果，说得越多越准。', domains: DOMAINS.map(([name, list]) => ({ name, events: list })) },
    rules: { lead: RULES.lead, min: RULES.min },
  };
}

// 入参检查：calib＝{ traits: [8 个，每个是 A–E 或 0–4 或 null], events: [{ domain, event?, year, good }] }；返回规整过的一份，不合法返回 null
function calibParse(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const tr = c.traits == null ? [] : c.traits;
  if (!Array.isArray(tr) || tr.length > RULES.traits) return null;
  const traits = [];
  for (let k = 0; k < RULES.traits; k++) {
    const v = tr[k];
    if (v == null) traits.push(null);
    else if (Number.isInteger(v) && v >= 0 && v < 5) traits.push(v);
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
  return { traits, events };
}

// 这一年（流年两个字＋所在大运两个字）对身强、身弱哪边顺：> 0 身强那边顺，< 0 身弱那边顺
function leanOf(y, favIf, cycles) {
  if (!favIf) return { n: 0, gan_zhi: GZ(y), luck: null };
  const gz = GZ(y), es = [GAN_E[gz[0]], ZHI_E[gz[1]]];
  const c = (cycles || []).find((z) => z.startYear <= y && y <= z.endYear);
  if (c && c.ganZhi) es.push(GAN_E[c.ganZhi[0]], ZHI_E[c.ganZhi[1]]);
  let n = 0;
  for (const e of es) n += (favIf.强 || []).includes(e) ? 1 : (favIf.弱 || []).includes(e) ? -1 : 0;
  return { n, gan_zhi: gz, luck: c && c.ganZhi ? c.ganZhi : null };
}

// 计分（同网站 score()）：favIf＝method.bazi.strength.vote.favorable_if，cycles＝bazi.luck.cycles（都取没答题时那一份）
function calibScore(calib, { favIf, cycles }) {
  const n = { 强: 0, 弱: 0 };
  calib.traits.forEach((j, k) => { const sd = j == null ? '' : TRAITS[k][1][j][1]; if (sd) n[sd]++; });
  const events = calib.events.map((x) => {
    const l = leanOf(x.year, favIf, cycles);
    if (!l.n) return { ...x, gan_zhi: l.gan_zhi, luck: l.luck, to: null, weight: 0 };
    const w = Math.abs(l.n) >= 2 ? 2 : 1, to = (l.n > 0) === x.good ? '强' : '弱';   // 流年和大运同一边＝那几年整体就偏这边，分量重一点
    n[to] += w;
    return { ...x, gan_zhi: l.gan_zhi, luck: l.luck, to, weight: w };
  });
  const d = n.强 - n.弱, side = d >= RULES.lead && n.强 >= RULES.min ? '强' : -d >= RULES.lead && n.弱 >= RULES.min ? '弱' : null;
  return { side, tally: n, traits: calib.traits.filter((j) => j != null).length, events };
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
    say: side ? SAY.done : SAY.none,
    used: { traits: sc.traits, events: sc.events.length },
    // 留痕核对用，对用户不报分数。用户说的大事不回显：回包会进 Skill／插件的网页报告（链接能转发），经历只留件数（10-10）
    detail: { tally: sc.tally, answers: answers || null },
  };
}

module.exports = { SCHEMA, RULES, TRAITS, DOMAINS, RES, GZ, calibAsk, calibParse, calibScore, calibAnswers, calibResult, leanOf };
