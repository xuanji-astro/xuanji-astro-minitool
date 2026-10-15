// 单人盘的拼装：生辰＋八字原件 → 数据交接包。不联网、不存档、不读文件。
// 服务端 profile.js（八字走排盘服务）和小红书离线小工具（八字在本机算）共用这一份，两边口径一字不差。
const { natal, mbtiChart, MBTI } = require('./engines.js');
const { baziMethod, westMethod, personaMethod } = require('./method.js');
const { strengthVote } = require('./strength.js');
const { feelAsk, feelScore } = require('./feel.js');
const { checkPlan, checkScore, schoolsBrief } = require('./schoolvote.js');
const { calibAsk, calibParse, calibScore, calibAnswers, calibResult, SCHEMA: CALIB_SCHEMA } = require('./calib.js');
const { turnText } = require('./schoolwords.js');
const W = require('./words.js');
const { pickQuotes } = require('./quotes.js');
const { boundary } = require('./boundary.js');
const { timing, baziLights } = require('./timing.js');
const { locate } = require('./geo.js');

const TIME_SOURCES = ['birth_certificate', 'family_clear', 'family_rough', 'unknown'];
const TIME_PRECISIONS = ['minute', 'within_15min', 'within_1h', 'unknown'];

class InputError extends Error { constructor(code, msg) { super(msg); this.code = code; } }

function parseInput(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new InputError('INPUT_INVALID', '请求体要 JSON 对象');
  const m = String(b.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new InputError('DATE_REQUIRED', '出生日期要 YYYY-MM-DD');
  const calendar = new Date(0);
  calendar.setUTCFullYear(+m[1], +m[2] - 1, +m[3]);
  if (calendar.getUTCFullYear() !== +m[1] || calendar.getUTCMonth() !== +m[2] - 1 || calendar.getUTCDate() !== +m[3]) throw new InputError('DATE_INVALID', '出生日期不存在');
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
  // 投票胜出的派（多派交叉论证，10-08）：用户核过、对上哪一派；喜忌和大运流年的顺逆按那一派上色。不传＝页面照旧
  if (b.school != null && !['扶抑', '调候', '格局'].includes(b.school)) throw new InputError('SCHOOL_INVALID', 'school 只能是 扶抑、调候、格局 或不传');
  // 「核核你」的回答（10-08）：这一轮问过的年份和选的那条（同一轮累积着传）；接口自己算身强身弱定案和胜出的派
  const ok = (a) => a && Number.isInteger(a.year) && a.year > 1900 && a.year < 2100 && PICKS.includes(a.pick);
  if (b.answers != null && (!Array.isArray(b.answers) || b.answers.length > 12 || !b.answers.every(ok))) throw new InputError('ANSWERS_INVALID', 'answers 是 [{ year, pick }]，pick 只能是 弱、强、都沾、记不清，最多 12 条');
  // 身强身弱校正（照网站校正页的问法，10-10，见 calib.js）：8 道性格题选的哪一项＋自己说的几件大事；接口算分，定了就照网站那样转成回答
  const calib = b.calib == null ? null : calibParse(b.calib);
  if (b.calib != null && !calib) throw new InputError('CALIB_INVALID', 'calib 是 { traits: [8 个 A–F 或 null，F＝说不准], events: [{ domain, event, year, good }] }，events 最多 30 条');
  return {
    date: b.date, y: +m[1], mo: +m[2], d: +m[3], h, mi, city: String(b.city).trim(), place, gender: b.gender,
    time_source: TIME_SOURCES.includes(b.time_source) ? b.time_source : 'unknown',
    time_precision: TIME_PRECISIONS.includes(b.time_precision) ? b.time_precision : 'unknown',
    strength: b.strength == null ? null : b.strength,
    school: b.school == null ? null : b.school,
    answers: b.answers == null ? null : b.answers.map((a) => ({ year: a.year, pick: a.pick })),
    calib,
  };
}

const PICKS = ['弱', '强', '都沾', '记不清'];
// 回答里身强身弱那本账定下来没有（feel 原规则：两年同一种、另一种零票）。时辰不详、特殊格局不问经历，也不从回答里定
function strengthOfAnswers(inp, bz) {
  if (!inp.answers || inp.strength || !bz || bz.status !== 'ok' || !bz.bazi.pillars.hour || !bz.bazi.pillars.hour.gan || (bz.bazi.pattern && bz.bazi.pattern.isSpecial)) return null;
  const dm = bz.bazi.pillars.day.gan, sc = feelScore(dm, inp.answers.map((a) => ({ ...a, dm })), null);
  return sc.decided || null;
}

// 身强身弱校正第二步（10-10）：view＝没答题时的那一份（不带回答；几种判法的结论跟引擎档位不同时已带结论重排——跟网站拿到的 /v1/bazi_view 一样，
// 由调用方 assemble(没回答的 inp, null, bz, { lite: true, auto }) 算好传进来）。按它的扶抑两边喜忌和大运算分；定了就拿它出过题的纯年按那一边当回答
// （跟网站 calibratePage 一样），接着走原来那条路定身强身弱、挑派。没对上：照用户传的 answers（没传就是没核过）。传了 strength 不收校正
function calibInput(inp, view) {
  if (!inp.calib) return inp;
  const mb = view && view.method && view.method.bazi, ck = mb && mb.check;
  if (inp.strength || !ck || !ck.enough) return { ...inp, calib_result: { schema: CALIB_SCHEMA, status: '不适用', side: null, why: inp.strength ? '已经传了 strength' : '这张盘不做校正（时辰不详、特殊格局，或近几年没有能对照的年份）' } };
  const vote = mb.strength && mb.strength.vote;
  const sc = calibScore(inp.calib, { favIf: vote && vote.favorable_if, cycles: view.bazi && view.bazi.bazi && view.bazi.bazi.luck ? view.bazi.bazi.luck.cycles : [], verdict: vote && vote.verdict });
  const answers = calibAnswers(ck, sc.side);
  return { ...inp, ...(answers ? { answers } : {}), calib_result: calibResult(sc, answers) };
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
  const v = strengthVote(bz), s = v && !v.verdict.special ? v.verdict.side : null;
  return (s === '强' || s === '弱') && sideOfLevel(bz.bazi.strength) !== s ? s : null;
}

// 按胜出的派看这张盘：喜忌换成那一派的，大运流年的分数和档位换成那一派的（派内规则原样，投票层不改）；
// 扶抑派要知道身强身弱哪一边（定案、自动结论、几种判法的起点依次取），没方向或那一派不表态就不换
const SCHOOL_KEY = { 扶抑: 'fuyi', 调候: 'tiaohou', 格局: 'geju' };
function schoolView(bz, name, side) {
  const S = bz && bz.status === 'ok' && bz.bazi.schools, k = SCHOOL_KEY[name];
  if (!S || !k || !S[k]) return null;
  const u = k === 'fuyi' ? (side && S.fuyi.sides ? S.fuyi.sides[side] : null) : S[k];
  if (!u || u.abstain || !u.luck) return null;
  const cycles = bz.bazi.luck.cycles.map((c, i) => {
    const l = u.luck[i]; if (!l || l.ganZhi !== c.ganZhi) return c;
    const ys = new Map((l.years || []).map((y) => [y.year, y]));
    const yv = (y) => { const v = ys.get(y.year), t = turnText(name, v.notes, v.tier); return { ...y, score: v.score, tier: v.tier, ...(t ? { turn: t } : {}) }; };
    return { ...c, score: l.score, tier: l.tier, years: (c.years || []).map((y) => (ys.has(y.year) ? yv(y) : y)) };
  });
  const fav = u.favorableWuxing || [], unf = u.unfavorableWuxing || [];
  return { ...bz, bazi: { ...bz.bazi, usefulGods: { ...bz.bazi.usefulGods, favorableWuxing: fav, unfavorableWuxing: unf, primaryFavorableWuxing: u.primaryFavorableWuxing || fav[0] || null,
    primaryUnfavorableWuxing: u.primaryUnfavorableWuxing || unf[0] || null, useful: u.useful || null, avoid: u.avoid || null, climateUseful: false }, luck: { ...bz.bazi.luck, cycles } } };
}

const withQiang = (bz) => ({ ...bz, bazi: { ...bz.bazi, schools: { ...bz.bazi.schools, geju: { ...bz.bazi.schools.geju.qiang_doubt, school: '格局' } } } });

function assemble(inp, N, bz0, { version, lite, now = new Date(), auto = null } = {}) {
  // 胜出的派：身强身弱那一边按定案、自动结论、几种判法的起点依次取（只有扶抑派用得上）
  const ok0 = bz0 && bz0.status === 'ok', v0 = ok0 && bz0.bazi.schools ? strengthVote(bz0) : null, vs0 = v0 && v0.verdict.side;
  let schoolSide = inp.strength || auto || (vs0 === '强' || vs0 === '弱' ? vs0 : null), school = inp.school, schoolBy = inp.school ? '指定' : null;
  // 带了回答、没指定派：按回答挑胜出的派（只看问过的年份上各派的预言，跟挑年的先后无关）
  const dmOf = () => bz0.bazi.pillars.day.gan, ansDm = inp.answers && ok0 ? inp.answers.map((a) => ({ ...a, dm: dmOf() })) : null;
  let ckStatus = null, bzS = bz0;
  if (!school && ansDm && bz0.bazi.schools) {
    const p0 = checkPlan({ dm: dmOf(), P: bz0.bazi.pillars, nowY: now.getFullYear(), birthY: +bz0.input.date.slice(0, 4), lights: null, schools: bz0.bazi.schools, strengthSide: schoolSide, strengthNeed: false });
    const sc0 = p0 && p0.enough ? checkScore(dmOf(), ansDm, p0) : null, pref = sc0 && sc0.schools.prefer;
    ckStatus = sc0 ? sc0.status : null;
    if (pref) { const [nm, sd] = pref.split('·'); school = nm; schoolBy = '核核你'; if (sd && nm === '扶抑') schoolSide = sd; }
    // 格局派从强疑似核中了：页面、三派说法里的格局派都换成从强那套（没核中照正格，不出从强喜忌）
    if (sc0 && sc0.schools.qiang && sc0.schools.qiang.verified) bzS = withQiang(bz0);
  }
  // 没核过、核到一半、核的几年三派都对不上，或指定的那派不表态：替用户先定一派（10-08 她定：不管怎样都要让用户知道自己的喜用，
  // 我们替他定或他做题定）。按主干先后整派取，不拼各派的一半：扶抑（身强身弱有方向、不是特殊格局）→ 格局 → 调候；页面标「还没核准」
  const requested = school;
  let viewed = school ? schoolView(bzS, school, schoolSide) : null;
  if (!viewed && ok0 && bz0.bazi.schools) {
    for (const nm of ['扶抑', '格局', '调候']) {
      if (nm === '扶抑' && (!schoolSide || (v0 && v0.verdict.special))) continue;
      const v = schoolView(bzS, nm, schoolSide);
      if (v) { school = nm; schoolBy = '默认'; viewed = v; break; }
    }
  }
  const bz = viewed || bz0;
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
        m.strength.vote = strengthVote(bz0);
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
        // 三派各自的说法，给文字层（上桌的派按它说，其余收起可点开）；school＝这次按哪一派上色的
        const vside = m.strength.vote && m.strength.vote.verdict.side;
        m.schools = schoolsBrief(bzS && bzS.bazi && bzS.bazi.schools, schoolSide || inp.strength || auto || (vside === '强' || vside === '弱' ? vside : null));
        if (school) m.school = { name: school, side: school === '扶抑' ? schoolSide : null, by: schoolBy, applied: !!viewed,
          ...(schoolBy === '默认' ? { unconfirmed: true, check: ckStatus, ...(requested && requested !== school ? { requested } : {}) } : {}),
          why: !viewed ? '三派都说不了，页面照旧' : schoolBy !== '默认' ? '喜忌和大运流年的顺逆按这一派'
            : requested && requested !== school ? `指定的${requested}派对这张盘不表态，先按这一派说，还没核准`
            : ckStatus === '降置信' ? '核的几年三派都对不上，先按这一派说，还没核准' : ckStatus ? '还没核完，先按这一派说' : '还没核过，先按这一派说' };
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
  const birthY = bz && bz.input && bz.input.date ? +bz.input.date.slice(0, 4) : null;
  // 出题按原盘：带了定案用引擎那套喜忌，按某一派上色时也回到原盘（题目和描述不跟着变）
  const lightsOf = () => (applied ? baziLights({ ...bz0, bazi: { ...bz0.bazi, usefulGods: ss.engineUsefulGods } }, inp.gender, now.getFullYear() - 12, now.getFullYear() - 1)
    : viewed ? baziLights(bz0, inp.gender, now.getFullYear() - 12, now.getFullYear() - 1) : out.method.timing ? out.method.timing.years : null);
  let lights = null;
  if (sv && sv.feel) {
    lights = lightsOf();
    sv.feel = { need: sv.feel.need, ...feelAsk(bz.bazi.pillars.day.gan, now.getFullYear(), birthY, lights) };
  }
  // 多派交叉论证·投票层（10-08）：排盘服务并排出了三派（bazi.schools）才出；跟「核一次」合成一轮问，同一份回答记两本账（见 schoolvote.js）。
  // 身强身弱那本账：核过的定案优先，没核过看几种判法的起点；没核过、又能问经历的盘，这一轮先核身强身弱
  if (out.method.bazi && bz && bz.status === 'ok' && bz.bazi.schools) {
    const dd = sv && sv.decided, vs = sv && sv.verdict && sv.verdict.side;
    out.method.bazi.check = checkPlan({ dm: bz.bazi.pillars.day.gan, P: bz.bazi.pillars, nowY: now.getFullYear(), birthY, lights: lights || lightsOf(), schools: bz0.bazi.schools,
      strengthSide: dd ? dd.side : vs === '强' || vs === '弱' ? vs : null, strengthNeed: !!(sv && sv.feel && sv.feel.enough && !dd) });
    // 带了回答：两本账记到哪一步、下一题问哪年（定案、加问、降置信）；身强身弱从回答里定的，回包 strength_from_answers 记一笔
    const ck = out.method.bazi.check;
    if (ansDm && ck && ck.enough) ck.score = { ...checkScore(dmOf(), ansDm, ck), ...(inp.strength_by === '核核你' ? { strength_from_answers: inp.strength } : {}) };
    // 身强身弱校正（10-10）：能核的盘给题（8 道性格题＋大事，跟网站同一套）；带了 calib 再给结果（身X型、四格；没对上一句话）
    if (ck && (ck.enough || inp.calib_result)) out.method.bazi.calib = { ...(ck.enough ? { ask: calibAsk() } : {}), result: inp.calib_result || null };
  }
  out.method.quotes = pickQuotes(`${birth.date} ${birth.time || ''} ${birth.city} ${birth.sex}`, ty ? ty.tier : null);
  return out;
}

module.exports = { TIME_SOURCES, TIME_PRECISIONS, InputError, parseInput, chartDataOf, astroMbti, natalOf, autoSideOf, strengthOfAnswers, calibInput, assemble };
