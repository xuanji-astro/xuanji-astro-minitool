// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 生辰 → 排盘 → 接口返回的整份数据

import { baziCalculator, COMMON_BAZI_SHENSHA_NAMES } from 'mingyu-core/bazi';
import { resolveBirthPlace, searchBirthPlaces } from 'mingyu-core/location';
import { CONFIG_VERSION, SHENSHA_DIMENSIONS } from './config.js';
import { chartFromMingyu, PILLAR_KEYS } from './chart.js';
import { fixShenshaTables } from './shenshaFix.js';
import { fixUsefulGod, isClimateUseful } from './usefulGodFix.js';
import { wuxingRing, strengthBasis } from './components/wuxingRing.js';
import { tenGodBar } from './components/tenGodBar.js';
import { shenshaPanel } from './components/shensha.js';
import { luckCycles } from './components/luck.js';

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
  const { date, time = null, city, gender, timeMode = 'true_solar' } = body;
  if (!TIME_MODES.includes(timeMode)) throw new InputError('TIME_MODE_INVALID', 'timeMode 只能是 true_solar 或 clock');

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

  return { year, month, day, hour, minute, gender, timeMode, place: resolvePlace(city.trim()) };
}

// 时间口径：true_solar＝按出生地经度和均时差校正（默认）；clock＝直接用北京时间（钟表时间，不少排盘软件这样排）
export const TIME_MODES = ['true_solar', 'clock'];
const MODE_CN = { true_solar: '真太阳时', clock: '北京时间' };
// 钟表时间 → 引擎时辰编号（0 早子 00–01、1 丑 01–03 … 11 亥 21–23、12 晚子 23–24）
const clockTimeIndex = (h) => (h === 23 ? 12 : Math.floor((h + 1) / 2));

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
    return baziCalculator.calculateBazi({ ...base, timeIndex: clockTimeIndex(input.hour), useTrueSolarTime: false });
  }
  return baziCalculator.calculateBazi({
    ...base,
    timeIndex: 0,
    useTrueSolarTime: true,
    birthHour: input.hour,
    birthMinute: input.minute,
    birthPlace: input.place.displayName,
    birthLongitude: input.place.longitude,
    // 按出生日期查当时的法定时区，1986–1991 夏令时由引擎处理
    timeZoneId: input.place.timeZoneId ?? 'Asia/Shanghai',
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

export function paipan(body) {
  const input = parseInput(body);
  const raw = runEngine(input, 'common');
  const chart = fixShenshaTables(chartFromMingyu(raw, extraScoredShensha(runEngine(input, 'all'))), runEngine(input, 'common', input.timeMode, 'classical'));
  const analysis = raw.analysis ?? {};
  const useful = fixUsefulGod(analysis.usefulGod ?? {}, chart.dayMaster.element);
  const timeKnown = input.hour !== null;
  const t = raw.timing?.enabled ? raw.timing.correctedTime : null;

  // 两种口径的日柱＋时柱对一下：不一样就提示（出生时间离时辰交界近的人，我们跟只用钟表时间的软件会排出不同的时柱）
  let timeCheck = null;
  const warnings = [...(raw.warnings ?? [])];
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

  return {
    version: { api: 'v1', engine: ENGINE, config: CONFIG_VERSION },
    input: {
      date: `${input.year}-${pad(input.month)}-${pad(input.day)}`,
      time: timeKnown ? `${pad(input.hour)}:${pad(input.minute)}` : null,
      city: input.place.displayName,
      longitude: input.place.longitude,
      gender: input.gender,
      timeKnown,
      timeMode: input.timeMode,
      trueSolarTime: t ? `${t.year}-${pad(t.month)}-${pad(t.day)} ${pad(t.hour)}:${pad(t.minute)}` : null,
    },
    warnings,
    timeCheck,
    bazi: {
      pillars: pillarTable(chart),
      dayMaster: chart.dayMaster,
      strength: analysis.dayMasterStrength?.status ?? '未知',
      strengthBasis: strengthBasis(analysis.dayMasterStrength, timeKnown),
      pattern: {
        name: analysis.mingGe?.pattern ?? '未知',
        isSpecial: analysis.mingGe?.isSpecial ?? false,
        status: analysis.mingGe?.fulfillment?.status ?? null,
      },
      usefulGods: {
        favorableWuxing: useful.favorableWuxing ?? [],
        unfavorableWuxing: useful.unfavorableWuxing ?? [],
        primaryFavorableWuxing: useful.primaryFavorableWuxing ?? null,
        primaryUnfavorableWuxing: useful.primaryUnfavorableWuxing ?? null,
        useful: useful.useful ?? null,
        avoid: useful.avoid ?? null,
        climateUseful: isClimateUseful(useful, chart.dayMaster.element),   // 用神由调候取、按扶抑本该是忌
      },
      luck: luckCycles(raw, chart.dayMaster.gan, useful),
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
