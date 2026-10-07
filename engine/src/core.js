// 单人盘的拼装：生辰＋八字原件 → 数据交接包。不联网、不存档、不读文件。
// 服务端 profile.js（八字走排盘服务）和小红书离线小工具（八字在本机算）共用这一份，两边口径一字不差。
const { natal, mbtiChart, MBTI } = require('./engines.js');
const { baziMethod, westMethod, personaMethod } = require('./method.js');
const { strengthVote } = require('./strength.js');
const { feelAsk } = require('./feel.js');
const W = require('./words.js');
const { pickQuotes } = require('./quotes.js');
const { boundary } = require('./boundary.js');
const { timing, baziLights } = require('./timing.js');
const { locate } = require('./geo.js');

const TIME_SOURCES = ['birth_certificate', 'family_clear', 'family_rough', 'unknown'];
const TIME_PRECISIONS = ['minute', 'within_15min', 'within_1h', 'unknown'];

class InputError extends Error { constructor(code, msg) { super(msg); this.code = code; } }

function parseInput(b) {
  const m = String(b.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new InputError('DATE_REQUIRED', '出生日期要 YYYY-MM-DD');
  let h = null, mi = null;
  if (b.time != null) {
    const t = String(b.time).match(/^(\d{2}):(\d{2})$/);
    if (!t || +t[1] > 23 || +t[2] > 59) throw new InputError('TIME_INVALID', '出生时间要 HH:mm，时辰不详传 null');
    [h, mi] = [+t[1], +t[2]];
  }
  const place = locate(b.city);
  if (!place) throw new InputError('LOCATION_NOT_FOUND', '找不到这个城市（目前只支持中国省市区）');
  if (!['male', 'female'].includes(b.gender)) throw new InputError('GENDER_REQUIRED', '性别要 male 或 female');
  // 身强身弱的定案：用户拿经历核过、定下来的那一边（强／弱）。喜忌、时间线、格局小结都跟它走；不传＝按几种判法的结论
  if (b.strength != null && b.strength !== '强' && b.strength !== '弱') throw new InputError('STRENGTH_INVALID', 'strength 只能是 强、弱 或不传');
  return {
    date: b.date, y: +m[1], mo: +m[2], d: +m[3], h, mi, city: String(b.city).trim(), place, gender: b.gender,
    time_source: TIME_SOURCES.includes(b.time_source) ? b.time_source : 'unknown',
    time_precision: TIME_PRECISIONS.includes(b.time_precision) ? b.time_precision : 'unknown',
    strength: b.strength == null ? null : b.strength,
  };
}

// 盘面快照：与 index.html _chartDataOf 同形状（档案 charts.chart_data 也是这份）
const chartDataOf = (N) => ({
  planets: N.planets.map((p) => ({ n: p.n, sign: p.sign, deg: p.deg, min: p.min, house: p.house, rx: p.rx })),
  asteroids: (N.asteroids || []).map((p) => ({ n: p.n, sign: p.sign, deg: p.deg, min: p.min, house: p.house, rx: p.rx })),
  houses: (N.houses || []).map((x) => ({ num: x.num, sign: x.sign, deg: x.deg, min: x.min })),
  angles: N.angles, points: N.points, aspects: (N.asp || []).map((x) => x.t),
});

// 出厂底色＋重生人格：引擎原样输出，只取结论层（rank 全表、张力表、权重不出服务）
function astroMbti(N) {
  const ch = mbtiChart(N), bc = MBTI.derive(ch), tk = MBTI.tools(ch);
  const [[t1, p1], [t2, p2]] = bc.rank;
  return {
    label: '出厂底色（星盘人格结构，不是自测 MBTI）',
    base_type: t1,
    runner_up: t2,
    margin_log10: +Math.log10(p1 / p2).toFixed(2),
    rebirth: tk.top3.slice(0, 2).map((x) => x.type),   // 两张不分先后
    buffs: tk.buffs,
  };
}

// 时辰不详：西盘没有上升和宫位，出厂底色依赖上升和宫位 ⇒ 都不出，只回八字（三柱）
const natalOf = (inp) => inp.h === null ? null : natal({ y: inp.y, mo: inp.mo, d: inp.d, h: inp.h, mi: inp.mi, tz: 8, lat: inp.place.lat, lon: inp.place.lon, sex: inp.gender === 'female' ? '女' : '男' });

// bz＝排盘服务 /v1/bazi 的回包加 status（服务端经 HTTP 拿，小工具本机调同一份 paipan()）；version 由调用方给（服务端按 vendor 文件算 SHA）
// 定案（10-05 定）：身强身弱的定案是喜忌、时间线、格局小结的唯一输入。用户核过的（inp.strength）高于几种判法的结论。
// 跟排盘引擎方向相反时，排盘服务按定案的档位重取喜忌（回包 bazi.strengthSide.applied），时间线这里按定案的强弱重算；
// 出题仍按原盘（引擎自己那套喜忌），翻过来以后再核，题目和描述不跟着变。
const SIDE_STATUS = { 强: '身强', 弱: '身弱' };
const STRONG_HUAMING = new Set(['阳刃格', '食神制杀']);   // 花名里带身强身弱断语的格（v1.2 只在实锤档放行）
const sideOfLevel = (lv) => (/强|旺/.test(lv || '') ? '强' : /弱|衰/.test(lv || '') ? '弱' : null);
// 用户先看到的那一边：结论有方向就是结论，否则是引擎的底子（中和的喜忌底子是泄耗克，跟身强同一套）
const shownSide = (vote, engine) => (vote.verdict.side === '强' || vote.verdict.side === '弱' ? vote.verdict.side : engine || '强');
function decidedOf(inp, bz, vote) {
  if (!inp.strength || !vote || !vote.feel) return null;   // 特殊格局、时辰不详不问经历，也不收定案
  const ss = bz.bazi.strengthSide, engine = sideOfLevel(bz.bazi.strength);
  return {
    side: inp.strength, by: '你的经历', engine, flipped: inp.strength !== shownSide(vote, engine),   // 跟用户先看到的结论方向相反＝要明说
    applied: !!(ss && ss.applied), why: ss ? ss.why : '排盘服务还没升级，喜忌和时间线仍按引擎原样',
  };
}
// 没核过的盘（10-06 定）：几种判法的结论有方向（强或弱），跟排盘引擎自己的档位不同（例如引擎中和、另两路判弱＝多数·身弱），
// 喜忌和时间线也按结论重取：复用定案那条 strength 入参，不另开路径。用户没核过、没经历过翻转，不算改判，不弹提示；
// 回包 vote.auto 记一笔（引擎哪档到哪边、为什么），攒样本用，界面不显示。调用方拿到 side 后带 strength 再排一次盘，assemble 时传 auto。
function autoSideOf(inp, bz, N) {
  if (inp.strength || !bz || bz.status !== 'ok') return null;
  const v = strengthVote(bz, N), s = v && !v.verdict.special ? v.verdict.side : null;
  return (s === '强' || s === '弱') && sideOfLevel(bz.bazi.strength) !== s ? s : null;
}

function assemble(inp, N, bz, { version, lite, now = new Date(), auto = null } = {}) {
  const timeKnown = inp.h !== null;
  const birth = { date: inp.date, time: timeKnown ? `${String(inp.h).padStart(2, '0')}:${String(inp.mi).padStart(2, '0')}` : null, city: inp.city,
                  place: inp.place, tz: 8, sex: inp.gender, time_source: inp.time_source, time_precision: inp.time_precision };
  const ch = N ? mbtiChart(N) : null;
  const eff = inp.strength || auto;   // 用户核过的定案优先，其次是没核过时几种判法的结论
  const ss = eff && bz && bz.status === 'ok' ? bz.bazi.strengthSide : null, applied = !!(ss && ss.applied && ss.engineUsefulGods);
  /* 10-03 定「杂气收口」：传统「杂气」只用于辰戌丑未月；引擎在别的月也出「杂气X格」→ 对外的格局名去掉「杂气」（引擎不动；网站生辰页同一口径） */
  const bp = bz && bz.bazi && bz.bazi.pattern, mz = bz && bz.bazi && bz.bazi.pillars && bz.bazi.pillars.month && bz.bazi.pillars.month.zhi;
  if (bp && /^杂气.+格$/.test(bp.name || '') && mz && !'辰戌丑未'.includes(mz)) bp.name = bp.name.slice(2);
  const out = {
    schema: version.schema,
    version,
    birth,
    western: N ? { time_convention: 'civil_clock+cn_dst', data: chartDataOf(N) } : { status: 'needs_birth_time' },
    astro_mbti: N ? astroMbti(N) : { status: 'needs_birth_time' },
    bazi: bz,
    method: {
      schema: 'xuanji.method/0.1',
      bazi: (() => {
        const m = baziMethod(bz, birth); if (!m) return m;
        m.strength.vote = strengthVote(bz, N);
        if (m.strength.vote) m.strength.vote.decided = decidedOf(inp, bz, m.strength.vote);
        if (m.strength.vote && auto) m.strength.vote.auto = { side: auto, from: bz.bazi.strength, cause: m.strength.vote.verdict.agree === '多数' ? '多数裁决' : '软分歧偏向', applied, why: ss ? ss.why : '带定案重排没成功，喜忌和时间线仍按引擎原样' };
        /* 10-03 定：格局小结后半截跟最终投票走——强→身旺、弱→身衰；待定、中和、时辰不详不写，只留「财旺」「杀旺」这一截。
           以前用的是排盘引擎那一票（七档），跟投票结论可能说反（同一屏一处身旺一处身弱）。主站生辰页不动。用户核过的定案优先。 */
        /* v1.2（10-06）：身旺身衰只在实锤档写（三票同向，或两票同向＋西盘同向）；用户拿经历核过的定案也算实锤。其余只留前半截 */
        const dd = m.strength.vote && m.strength.vote.decided, vd = m.strength.vote && m.strength.vote.verdict;
        const sd = dd ? dd.side : vd && vd.firm ? vd.side : '';
        m.pattern.label = W.patternLabel(bz.components.tenGodBar, sd === '强' || sd === '弱' ? sd : '', bz.bazi.pattern) || null;
        /* v1.2 展示收口（10-06）：带强弱断语的花名（阳刃格「天生一股狠劲」、食神制杀「杀旺身轻」）只在实锤档或用户核过时出，
           其余换成不带强弱的一版（huamingSoft）；阴干没有羊刃，引擎的「劫财格／月刃格」在阴干上不借阳刃格那套，用劫财格的。格局说明不留空 */
        const hm = m.pattern.huaming, yinDm = '乙丁己辛癸'.includes(bz.bazi.dayMaster && bz.bazi.dayMaster.gan), soft = W.huamingSoft;
        const swap = (k) => (soft[k] ? { key: k, line: soft[k].line, desc: soft[k].desc, soft: true } : null);
        if (hm && hm.key === '阳刃格' && yinDm) m.pattern.huaming = swap('劫财格');
        else if (hm && STRONG_HUAMING.has(hm.key) && !(dd || (vd && vd.firm))) m.pattern.huaming = swap(hm.key);
        return m; })(),
      west: westMethod(N),
      persona: ch ? personaMethod(ch, MBTI.derive(ch), MBTI.tools(ch), `${birth.date} ${birth.time} ${birth.city} ${birth.sex}`) : null,
      timing: timing(applied ? { ...bz, bazi: { ...bz.bazi, strength: SIDE_STATUS[eff] } } : bz, N, inp.gender, now, { lite }),
    },
  };
  // 引语候选：按生辰种子和今年顺逆从引语库挑，报告只许用这几句
  const ty = out.method.timing && out.method.timing.years.find((y) => y.year === now.getFullYear());
  out.method.boundary = boundary(bz, N);
  // 用你的经历核一次：挑年和描述要按这个人的时间线（逐年八字亮灯），所以等时间线算完再出；年份跟着 now 走
  const sv = out.method.bazi && out.method.bazi.strength && out.method.bazi.strength.vote;
  if (sv && sv.feel) {
    const birthY = +bz.input.date.slice(0, 4);
    const lights = applied ? baziLights({ ...bz, bazi: { ...bz.bazi, usefulGods: ss.engineUsefulGods } }, inp.gender, now.getFullYear() - 12, now.getFullYear() - 1)
      : out.method.timing ? out.method.timing.years : null;
    sv.feel = { need: sv.feel.need, ...feelAsk(bz.bazi.pillars.day.gan, now.getFullYear(), birthY, lights) };
  }
  out.method.quotes = pickQuotes(`${birth.date} ${birth.time || ''} ${birth.city} ${birth.sex}`, ty ? ty.tier : null);
  return out;
}

module.exports = { TIME_SOURCES, TIME_PRECISIONS, InputError, parseInput, chartDataOf, astroMbti, natalOf, autoSideOf, assemble };
