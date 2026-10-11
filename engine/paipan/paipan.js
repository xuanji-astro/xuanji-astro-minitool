// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 生辰 → 排盘 → 接口返回的整份数据

import { baziCalculator, COMMON_BAZI_SHENSHA_NAMES, getWuxing } from 'mingyu-core/bazi';
import { resolveBirthPlace, searchBirthPlaces } from 'mingyu-core/location';
import { CONFIG_VERSION, SHENSHA_DIMENSIONS } from './config.js';
import { chartFromMingyu, PILLAR_KEYS } from './chart.js';
import { fixShenshaTables } from './shenshaFix.js';
import { fixUsefulGod, isClimateUseful, weakClimate, presentWuxing } from './usefulGodFix.js';
import { usefulGodForSide, SIDE_STATUS } from './strengthSide.js';
import { fuyiSchool } from './schools/fuyi.js';
import { tiaohouSchool } from './schools/tiaohou.js';
import { gejuSchool, gejuL0 } from './schools/geju.js';
import { wuxingRing, strengthBasis } from './components/wuxingRing.js';
import { tenGodBar } from './components/tenGodBar.js';
import { shenshaPanel } from './components/shensha.js';
import { luckCycles } from './components/luck.js';
import { liupan, birthTerm, qiyun, monthTable } from './liupan.js';

export const ENGINE = 'mingyu-core@0.3.0';
const COMMON_SHENSHA = new Set(COMMON_BAZI_SHENSHA_NAMES);
const SCORED_SHENSHA = new Set(SHENSHA_DIMENSIONS.flatMap((d) => Object.keys(d.members)));

export class InputError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function resolvePlace(city) {
  const place = resolveBirthPlace(city) ?? searchBirthPlaces(city, { limit: 1 })[0] ?? null;
  if (!place || typeof place.longitude !== 'number') {
    throw new InputError('LOCATION_NOT_FOUND', '找不到这个出生城市');
  }
  return place;
}

export function parseInput(body) {
  if (!body || typeof body !== 'object') throw new InputError('BAD_REQUEST', '请求体必须是 JSON 对象');
  const { date, time = null, city, gender, timeMode = 'true_solar', strength = null } = body;
  if (!TIME_MODES.includes(timeMode)) throw new InputError('TIME_MODE_INVALID', 'timeMode 只能是 true_solar 或 clock');
  // 身强身弱的定案（几种判法合判或用户核过的）：喜忌按它取；不传＝照引擎自己的档位
  if (strength !== null && strength !== '强' && strength !== '弱') throw new InputError('STRENGTH_INVALID', 'strength 只能是 强、弱 或不传');

  const m = typeof date === 'string' && date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new InputError('DATE_REQUIRED', '出生日期格式应为 YYYY-MM-DD');
  const [year, month, day] = m.slice(1).map(Number);

  let hour = null;
  let minute = null;
  if (time !== null) {
    const t = typeof time === 'string' && time.match(/^(\d{2}):(\d{2})$/);
    if (!t) throw new InputError('TIME_INVALID', '出生时间格式应为 HH:mm，不详请传 null');
    [hour, minute] = t.slice(1).map(Number);
    if (hour > 23 || minute > 59) throw new InputError('TIME_INVALID', '出生时间超出范围');
  }

  // 性别不许默认
  if (gender !== 'male' && gender !== 'female') {
    throw new InputError('GENDER_REQUIRED', '性别必须由用户选择：male 或 female');
  }
  if (typeof city !== 'string' || !city.trim()) throw new InputError('CITY_REQUIRED', '出生城市必填');

  return { year, month, day, hour, minute, gender, timeMode, strength, place: resolvePlace(city.trim()) };
}

// 时间口径：true_solar＝按出生地经度和均时差校正（默认）；clock＝直接用北京时间（钟表时间，不少排盘软件这样排）
export const TIME_MODES = ['true_solar', 'clock'];
const MODE_CN = { true_solar: '真太阳时', clock: '北京时间' };
// 钟表时间 → 引擎时辰编号（0 早子 00–01、1 丑 01–03 … 11 亥 21–23、12 晚子 23–24）
const clockTimeIndex = (h) => (h === 23 ? 12 : Math.floor((h + 1) / 2));

// 「北京时间」口径也要扣夏令时（10-10 定）：1986–1991 年夏天钟表拨快了 1 小时，按钟表排要先换回标准时。
// 真太阳时那边引擎按时区自己扣；这里用系统时区库（Intl）查那一刻当地比当年 1 月快了多少分钟，快了就减回去。
function offsetAt(tz, utcMs) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - utcMs) / 60000);
}
export function standardClock(input) {
  if (input.hour === null) return input;
  const tz = input.place?.timeZoneId ?? 'Asia/Shanghai';
  try {
    const wall = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute ?? 0);
    const amb = dstAmbiguous(input);
    const dst = (amb != null ? amb * 60 : offsetAt(tz, wall - offsetAt(tz, wall - 8 * 3600e3) * 60e3)) - offsetAt(tz, Date.UTC(input.year, 0, 15, 4));
    if (dst <= 0) return input;
    const t = new Date(wall - dst * 60e3);
    return { ...input, year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate(), hour: t.getUTCHours(), minute: t.getUTCMinutes() };
  } catch (_) { return input; }   // 时区库查不到就照原样
}
// 夏令时结束那天 1 点到 2 点走了两遍（引擎要求给固定偏移才肯排）：按夏令时那一遍（第一遍，钟表还拨快着）排，回 UTC+9
export function dstAmbiguous(input) {
  if (input.hour === null) return null;
  const tz = input.place?.timeZoneId ?? 'Asia/Shanghai';
  try {
    const wall = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute ?? 0);
    const hits = [-12, -11, -10, -9, -8, -7, -6, -5].map((h) => wall + h * 3600e3).filter((u) => u + offsetAt(tz, u) * 60e3 === wall).map((u) => offsetAt(tz, u));
    return hits.length > 1 ? Math.max(...hits) / 60 : null;
  } catch (_) { return null; }
}
// 夏令时开始那天钟表从 2 点直接拨到 3 点，这一小时里的钟点不存在（引擎会直接报错）：按没拨快的标准时理解，换成同一时刻的夏令钟点
export function dstGap(input) {
  if (input.hour === null) return null;
  const tz = input.place?.timeZoneId ?? 'Asia/Shanghai';
  try {
    const wall = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute ?? 0);
    const utc = wall - offsetAt(tz, wall - 8 * 3600e3) * 60e3;
    if (utc + offsetAt(tz, utc) * 60e3 === wall) return null;
    const t = new Date(wall - offsetAt(tz, Date.UTC(input.year, 0, 15, 4)) * 60e3 + offsetAt(tz, wall - offsetAt(tz, Date.UTC(input.year, 0, 15, 4)) * 60e3) * 60e3);
    return { ...input, year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate(), hour: t.getUTCHours(), minute: t.getUTCMinutes() };
  } catch (_) { return null; }
}

function runEngine(input, shenShaScope, mode = input.timeMode, profile = null) {
  const base = {
    year: input.year,
    month: input.month,
    day: input.day,
    gender: input.gender,
    isLunar: false,
    shenShaScope,
    ...(profile ? { shenShaVariants: { referenceProfile: profile } } : {}),
  };
  // 时辰不详：走三柱模式，不许默认成午时
  if (input.hour === null) {
    return baziCalculator.calculateBazi({ ...base, isThreePillars: true, useTrueSolarTime: false });
  }
  if (mode === 'clock') {
    const s = standardClock(input);
    return baziCalculator.calculateBazi({ ...base, year: s.year, month: s.month, day: s.day, timeIndex: clockTimeIndex(s.hour), useTrueSolarTime: false });
  }
  return baziCalculator.calculateBazi({
    ...base,
    timeIndex: 0,
    useTrueSolarTime: true,
    birthHour: input.hour,
    birthMinute: input.minute,
    birthPlace: input.place.displayName,
    birthLongitude: input.place.longitude,
    // 按出生日期查当时的法定时区，1986–1991 夏令时由引擎处理；结束那天重复的一小时按夏令时那一遍
    timeZoneId: input.place.timeZoneId ?? 'Asia/Shanghai',
    ...(dstAmbiguous(input) != null ? { timezone: dstAmbiguous(input) } : {}),
  });
}

const pad = (n) => String(n).padStart(2, '0');

function pillarTable(chart) {
  return Object.fromEntries(
    PILLAR_KEYS.map((key) => {
      const p = chart.pillars[key];
      if (!p) return [key, null];
      return [
        key,
        {
          gan: p.gan,
          zhi: p.zhi,
          ganZhi: p.ganZhi,
          tenGod: p.tenGod,
          hidden: p.hidden,
          nayin: p.nayin,
          kongWang: p.kongWang,
          lifeStage: p.lifeStage,
          ziZuo: p.ziZuo,
          shensha: p.shensha.filter((name) => COMMON_SHENSHA.has(name)),
        },
      ];
    }),
  );
}

// 常用神煞（common）和全量（all）是两套叫法，全量里「天罗」不等于常用的「天罗地网」。
// 以常用为主，只从全量里补图谱要打分、常用里又没有的名字（如六厄）。
export function extraScoredShensha(allScopeRaw) {
  return Object.fromEntries(
    PILLAR_KEYS.map((key) => [
      key,
      (allScopeRaw.shensha?.[key] ?? []).filter((name) => SCORED_SHENSHA.has(name) && !COMMON_SHENSHA.has(name)),
    ]),
  );
}

const usefulGodsOf = (useful, dm) => ({
  favorableWuxing: useful.favorableWuxing ?? [],
  unfavorableWuxing: useful.unfavorableWuxing ?? [],
  primaryFavorableWuxing: useful.primaryFavorableWuxing ?? null,
  primaryUnfavorableWuxing: useful.primaryUnfavorableWuxing ?? null,
  useful: useful.useful ?? null,
  avoid: useful.avoid ?? null,
  climateUseful: isClimateUseful(useful, dm),   // 用神由调候取、按扶抑本该是忌
});

export function paipan(body) {
  const entered = parseInput(body), gapped = dstGap(entered), input = gapped ?? entered;
  const raw = runEngine(input, 'common');
  const chart = fixShenshaTables(chartFromMingyu(raw, extraScoredShensha(runEngine(input, 'all'))), runEngine(input, 'common', input.timeMode, 'classical'));
  const analysis = raw.analysis ?? {};
  // 定案跟引擎方向相反时按定案的档位重取（strengthSide.js）；喜忌、大运吉凶都跟着换，bazi.strength 仍是引擎自己的七档（它是几种判法之一）
  const side = input.strength ? usefulGodForSide(raw, input.strength) : null;
  // 外层修正两道：身弱档调候不压扶抑（10-06 规则 v0），再是忌组放回（10-04）
  const dmWx = chart.dayMaster.element, ctx = { present: presentWuxing(raw), commander: raw.monthCommander ? getWuxing(raw.monthCommander) : null };
  const own = fixUsefulGod(weakClimate(analysis.usefulGod ?? {}, dmWx, { ...ctx, status: analysis.dayMasterStrength?.status }), dmWx);
  const useful = side && side.useful ? fixUsefulGod(weakClimate(side.useful, dmWx, { ...ctx, status: SIDE_STATUS[input.strength] }), dmWx) : own;
  const timeKnown = input.hour !== null;
  const t = raw.timing?.enabled ? raw.timing.correctedTime : null;

  // 两种口径的日柱＋时柱对一下：不一样就提示（出生时间离时辰交界近的人，我们跟只用钟表时间的软件会排出不同的时柱）
  let timeCheck = null;
  const warnings = [...(raw.warnings ?? [])];
  if (dstAmbiguous(input) != null) warnings.push('出生时间落在 1986–1991 年夏令时结束那天走了两遍的一小时里（钟表从 2 点拨回 1 点），按夏令时那一遍排。');
  if (gapped) warnings.push('出生时间落在 1986–1991 年夏令时开始那天被跳过的一小时里（钟表从 2 点直接拨到 3 点），按没拨快的标准时排。');
  if (timeKnown) {
    const otherMode = input.timeMode === 'clock' ? 'true_solar' : 'clock';
    const other = runEngine(input, 'common', otherMode);
    const dh = (r) => `${r.pillars.day.ganZhi}日 ${r.pillars.hour.ganZhi}时`;
    const differs = dh(raw) !== dh(other);
    timeCheck = { mode: input.timeMode, pillars: dh(raw), other: { mode: otherMode, pillars: dh(other) }, differs };
    if (differs) {
      warnings.push(`出生时间接近时辰交界：按${MODE_CN.clock}排是${dh(input.timeMode === 'clock' ? raw : other)}，按${MODE_CN.true_solar}排是${dh(input.timeMode === 'clock' ? other : raw)}，本盘按${MODE_CN[input.timeMode]}。`);
    }
  }

  // 出生时刻：真太阳时口径用校正后的时刻，钟表口径用原时刻；时辰不详只到日
  const birthAt = t && input.timeMode !== 'clock'
    ? { year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute }
    : { year: input.year, month: input.month, day: input.day, hour: input.hour, minute: input.minute };
  const natalGZ = Object.fromEntries(PILLAR_KEYS.map((k) => [k, chart.pillars[k]?.ganZhi ?? null]));

  return {
    version: { api: 'v1', engine: ENGINE, config: CONFIG_VERSION },
    input: {
      date: `${entered.year}-${pad(entered.month)}-${pad(entered.day)}`,   // 回显用户填的（夏令时跳过的那一小时也照填的回显）
      time: timeKnown ? `${pad(entered.hour)}:${pad(entered.minute)}` : null,
      city: input.place.displayName,
      longitude: input.place.longitude,
      gender: input.gender,
      timeKnown,
      timeMode: input.timeMode,
      trueSolarTime: t ? `${t.year}-${pad(t.month)}-${pad(t.day)} ${pad(t.hour)}:${pad(t.minute)}` : null,
      birthTerm: birthTerm(birthAt),
    },
    warnings,
    timeCheck,
    bazi: {
      pillars: pillarTable(chart),
      dayMaster: chart.dayMaster,
      strength: analysis.dayMasterStrength?.status ?? '未知',
      strengthBasis: strengthBasis(analysis.dayMasterStrength, timeKnown),
      // 传了 strength 才有：{ side, status, engine, applied, why }；换了档时多 engineUsefulGods＝引擎自己那套（界面对照旧喜用、出题仍按原盘用）
      ...(side ? { strengthSide: { ...side.info, ...(side.useful ? { engineUsefulGods: usefulGodsOf(own, chart.dayMaster.element) } : {}) } } : {}),
      pattern: {
        name: analysis.mingGe?.pattern ?? '未知',
        isSpecial: analysis.mingGe?.isSpecial ?? false,
        status: analysis.mingGe?.fulfillment?.status ?? null,
      },
      usefulGods: usefulGodsOf(useful, chart.dayMaster.element),
      luck: luckCycles(raw, chart.dayMaster.gan, useful, input.year),
      // 多派交叉论证（10-07 起）：各派按自己整套方法各算各的，并排出；usefulGods／luck 是现在页面用的引擎混合版，多派一起切换前照旧
      schools: (() => { const l0 = gejuL0(raw); return { fuyi: fuyiSchool(raw, l0), tiaohou: tiaohouSchool(raw, l0), geju: gejuSchool(raw) }; })(),
      // 五行旺相休囚死（按月令）：生辰盘最底下一行「土旺 金相 火休 木囚 水死」
      wuxingSeason: raw.wuxingSeasonStatus ?? null,
      // 参数页：胎元（月柱推）、胎息（日柱推）、命宫／身宫（要时辰，时辰不详不给）、命卦（出生年＋性别）
      params: {
        taiYuan: raw.taiYuan ?? null,
        taiXi: raw.taiXi ?? null,
        mingGong: timeKnown ? raw.mingGong ?? null : null,
        shenGong: timeKnown ? raw.shenGong ?? null : null,
        mingGua: raw.mingGua ? { gua: raw.mingGua.gua, eastWest: raw.mingGua.eastWest } : null,
      },
      // 流盘（生辰历页「流盘」页签）：cols＝六十甲子各自对本命的整列（大运／流年／小运／流月都查它）；years＝出生起一百年的流年＋小运；months＝每年十二个节的月.日＋月干支
      liupan: {
        qiyun: qiyun(raw, birthAt),
        ...liupan({ natal: natalGZ, birthYear: input.year, gender: input.gender }),
        months: monthTable(input.year - 1, 101),
      },
    },
    components: {
      dayMasterCard: {
        dayGanZhi: chart.pillars.day.ganZhi,
        gan: chart.dayMaster.gan,
        element: chart.dayMaster.element,
        yinYang: chart.dayMaster.yinYang,
      },
      wuxingRing: wuxingRing(chart, undefined, analysis.dayMasterStrength ?? null, timeKnown),
      tenGodBar: tenGodBar(chart),
      shenshaPanel: shenshaPanel(chart),
    },
  };
}
