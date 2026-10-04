// 单人盘的拼装：生辰＋八字原件 → 数据交接包。不联网、不存档、不读文件。
// 服务端 profile.js（八字走排盘服务）和小红书离线小工具（八字在本机算）共用这一份，两边口径一字不差。
const { natal, mbtiChart, MBTI } = require('./engines.js');
const { baziMethod, westMethod, personaMethod } = require('./method.js');
const { strengthVote } = require('./strength.js');
const W = require('./words.js');
const { pickQuotes } = require('./quotes.js');
const { boundary } = require('./boundary.js');
const { timing } = require('./timing.js');
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
  return {
    date: b.date, y: +m[1], mo: +m[2], d: +m[3], h, mi, city: String(b.city).trim(), place, gender: b.gender,
    time_source: TIME_SOURCES.includes(b.time_source) ? b.time_source : 'unknown',
    time_precision: TIME_PRECISIONS.includes(b.time_precision) ? b.time_precision : 'unknown',
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
function assemble(inp, N, bz, { version, lite, now = new Date() } = {}) {
  const timeKnown = inp.h !== null;
  const birth = { date: inp.date, time: timeKnown ? `${String(inp.h).padStart(2, '0')}:${String(inp.mi).padStart(2, '0')}` : null, city: inp.city,
                  place: inp.place, tz: 8, sex: inp.gender, time_source: inp.time_source, time_precision: inp.time_precision };
  const ch = N ? mbtiChart(N) : null;
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
        /* 10-03 定：格局小结后半截跟最终投票走——强→身旺、弱→身衰；待定、中和、时辰不详不写，只留「财旺」「杀旺」这一截。
           以前用的是排盘引擎那一票（七档），跟投票结论可能说反（同一屏一处身旺一处身弱）。主站生辰页不动。 */
        const sd = m.strength.vote && m.strength.vote.verdict && m.strength.vote.verdict.side;
        m.pattern.label = W.patternLabel(bz.components.tenGodBar, sd === '强' || sd === '弱' ? sd : '', bz.bazi.pattern) || null;
        return m; })(),
      west: westMethod(N),
      persona: ch ? personaMethod(ch, MBTI.derive(ch), MBTI.tools(ch), `${birth.date} ${birth.time} ${birth.city} ${birth.sex}`) : null,
      timing: timing(bz, N, inp.gender, now, { lite }),
    },
  };
  // 引语候选：按生辰种子和今年顺逆从引语库挑，报告只许用这几句
  const ty = out.method.timing && out.method.timing.years.find((y) => y.year === now.getFullYear());
  out.method.boundary = boundary(bz, N);
  out.method.quotes = pickQuotes(`${birth.date} ${birth.time || ''} ${birth.city} ${birth.sex}`, ty ? ty.tier : null);
  return out;
}

module.exports = { TIME_SOURCES, TIME_PRECISIONS, InputError, parseInput, chartDataOf, astroMbti, natalOf, assemble };
