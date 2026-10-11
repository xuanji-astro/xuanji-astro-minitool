// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 流盘：大运／流年／流月三列、小运、流月节气。口径：流盘口径 v1（2026-10-03）。
// 页面是陈列层：这里只给数据，不判吉凶。
//   地势＝日主在该柱地支的十二长生；自坐＝该柱天干在自己地支的十二长生。
//   运上神煞：凡以本命某柱干支为基准查表的照查（基准仍取本命）；柱位自身即神煞的（日柱／时柱形态）不查。
//   小运：时柱起，一岁一柱；阳年生男、阴年生女顺排，阴年生男、阳年生女逆排（与大运顺逆同一把尺子）。
//   流月：十二节划月，节气时刻取引擎真节气表。

import { ShenShaCalculator, COMMON_BAZI_SHENSHA_NAMES, SIXTY_CYCLE, NAYIN_MAP, getLifeStage, getYearMonthsGanZhi } from 'mingyu-core/bazi';
import { chartFromGanZhi } from './chart.js';
import { fixShenshaTables } from './shenshaFix.js';

const COMMON = new Set(COMMON_BAZI_SHENSHA_NAMES);
// 柱位专属（日柱／时柱自身形态即神煞），运上不查
const NATAL_ONLY = new Set(['十灵日', '六秀日', '十恶大败', '孤鸾煞', '九丑', '天转', '地转', '阴阳差错', '阴差阳错', '魁罡', '金神', '童子煞', '日德', '日贵']);
const YANG = new Set(['甲', '丙', '戊', '庚', '壬']);

const calcCommon = new ShenShaCalculator();
const calcClassical = new ShenShaCalculator({ variants: { referenceProfile: 'classical' } });

const nayinOf = (gz) => (NAYIN_MAP && (NAYIN_MAP[gz] || NAYIN_MAP[gz[0] + gz[1]])) || '';

// 把运柱放在第四位，跟本命前三柱一起按引擎同一套查法排，再过一遍本服务对引擎的修正（与本命同口径）
function luckShensha(natal, gz, gender) {
  const arr = [natal.year, natal.month, natal.day, gz].map((s) => [s[0], s[1]]);
  const raw = calcCommon.calculateAllShenSha(arr, gender);
  const cls = calcClassical.calculateAllShenSha(arr, gender);
  const chart = chartFromGanZhi({ year: natal.year, month: natal.month, day: natal.day, hour: gz });
  chart.pillars.day.nayin = nayinOf(natal.day);
  chart.pillars.hour.shensha = [...raw.hour];
  fixShenshaTables(chart, { shensha: { hour: cls.hour } });
  return chart.pillars.hour.shensha.filter((n) => COMMON.has(n) && !NATAL_ONLY.has(n));
}

// 一个干支对这张本命盘的整列（六十甲子各算一次，大运／流年／小运／流月都查这张表）
function column(natal, gz, gender) {
  const p = chartFromGanZhi({ year: natal.year, month: natal.month, day: natal.day, hour: gz }).pillars.hour;
  const dayGan = natal.day[0];
  return {
    tenGod: p.tenGod,
    hidden: p.hidden,
    lifeStage: getLifeStage(dayGan, gz[1]),
    ziZuo: getLifeStage(gz[0], gz[1]),
    shensha: luckShensha(natal, gz, gender),
  };
}

const cycleIndex = (gz) => SIXTY_CYCLE.indexOf(gz);
const cycleAt = (i) => SIXTY_CYCLE[((i % 60) + 60) % 60];
const pad = (n) => String(n).padStart(2, '0');
const CAL_MIN = 1900, CAL_MAX = 2100;

/**
 * @param natal { year, month, day, hour|null }：本命四柱干支
 * @param birthYear 出生公历年（流年岁数＝虚岁，跟大运图一致：year − birthYear + 1）
 * @param gender 'male' | 'female'
 * @param years 从出生年起排多少年（默认 100）
 */
export function liupan({ natal, birthYear, gender, years = 100 }) {
  const cols = {};
  for (const gz of SIXTY_CYCLE) cols[gz] = column(natal, gz, gender);
  // 小运：时柱起，逐岁一柱；时辰不详就没有小运
  const forward = YANG.has(natal.year[0]) === (gender === 'male');
  const hourIdx = natal.hour ? cycleIndex(natal.hour) : -1;
  const list = [];
  for (let y = birthYear; y < birthYear + years; y++) {
    const age = y - birthYear + 1;
    list.push({
      year: y,
      age,
      ganZhi: cycleAt(y - 1984),   // 1984 甲子年
      xiaoyun: hourIdx >= 0 ? cycleAt(hourIdx + (forward ? age : -age)) : null,
    });
  }
  return { cols, forward, years: list };
}

// 某一年的十二个流月：立春起到次年小寒，节气当天的月.日＋节名＋月干支
export function liuyue(year) {
  return getYearMonthsGanZhi(year).map((m) => {
    const [, mm, dd] = m.startDate.split('-');
    return { ganZhi: m.ganZhi, term: m.startTermName, date: `${Number(mm)}.${Number(dd)}`, start: m.startDateTime };
  });
}

const fmtDot = (t) => `${t.year}.${pad(t.month)}.${pad(t.day)} ${pad(t.hour)}:${pad(t.minute)}`;
const toDate = (t) => new Date(Date.UTC(t.year, t.month - 1, t.day, t.hour || 0, t.minute || 0));

// 出生落在哪个「节」之后多久（生辰盘信息条「出生于小暑(…)后16天20小时」）。时辰不详只算到天。
export function birthTerm({ year, month, day, hour = null, minute = null }) {
  const months = [...(year - 1 >= CAL_MIN ? getYearMonthsGanZhi(year - 1) : []), ...getYearMonthsGanZhi(year)];
  const at = new Date(Date.UTC(year, month - 1, day, hour ?? 12, minute ?? 0));
  const parse = (s) => { const [d, hm = '00:00'] = s.split(' '); const [y, mo, dd] = d.split('-').map(Number); const [h, mi] = hm.split(':').map(Number); return { year: y, month: mo, day: dd, hour: h, minute: mi }; };
  let hit = null;
  for (const m of months) { const st = parse(m.startDateTime); if (toDate(st) <= at) hit = { m, st }; }
  if (!hit) return null;
  if (hour === null) {
    const days = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(hit.st.year, hit.st.month - 1, hit.st.day)) / 864e5);
    return { name: hit.m.startTermName, time: fmtDot(hit.st), days, hours: null };
  }
  const mins = Math.round((at - toDate(hit.st)) / 6e4);
  return { name: hit.m.startTermName, time: fmtDot(hit.st), days: Math.floor(mins / 1440), hours: Math.floor((mins % 1440) / 60) };
}

// 起运：引擎第一段「小运」的结束时刻＝首运交脱时刻；岁数＝出生到交运的实足年数（一位小数，跟常见排盘软件写法一致）
export function qiyun(raw, birth) {
  const xy = (raw.luckInfo?.cycles ?? []).find((c) => c.isXiaoyun);
  const t = xy?.endSolarTime;
  if (!t) return null;
  const b = new Date(Date.UTC(birth.year, birth.month - 1, birth.day, birth.hour ?? 12, birth.minute ?? 0));
  const age = Math.round(((toDate(t) - b) / (365.2422 * 864e5)) * 10) / 10;
  return { date: `${t.year}-${pad(t.month)}-${pad(t.day)}`, age };
}

// 流月节气表：每年十二个节的月.日＋月干支（立春起到次年小寒）。跟出生信息无关，按年缓存（进程内）
const MONTHS_BY_YEAR = new Map();
export function monthTable(fromYear, count) {
  const out = {};
  for (let y = Math.max(fromYear, CAL_MIN); y < Math.min(fromYear + count, CAL_MAX + 1); y++) {   // 引擎节气表只覆盖 1900–2100
    if (!MONTHS_BY_YEAR.has(y)) { const ms = liuyue(y); MONTHS_BY_YEAR.set(y, { d: ms.map((m) => m.date), gz: ms.map((m) => m.ganZhi).join('') }); }
    out[y] = MONTHS_BY_YEAR.get(y);
  }
  return out;
}
