// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 历法口径（命理组 11-02 五条裁定，1102jw）：
//   v2_absolute（新算法，国内境外同一套）：年柱、月柱、月令司令、季节、起运交运大运、八字流年流月，一律拿「出生那一刻」（世界时）去比节气的那一刻；
//     日柱、时柱、时辰交界照旧按出生地真太阳时（或钟表口径的当地标准时）。节气表是北京时间（东八、不带夏令时），所以把出生那一刻换成北京时间钟面再去比，两边同一个时间尺度。
//   v1_legacy（老算法）：整盘都用当地真太阳时的钟面去比北京时间的节气。没有 IANA 时区的国内老档案留着它，旧盘逐字复现，不批量重写。
// 做法：引擎（mingyu-core）把一个钟面同时用于四柱和起运，这里在它算完核心数据之后，把年柱月柱、起运、司令所用的时刻换成北京钟面，日柱时柱不动，再交给引擎往下算十神神煞旺衰喜用。
import { SolarTime, EightChar, Gender } from 'tyme4ts';
import { baziCalculator, calculateMingGua, checkJieqiBoundary, buildBaziWarningEvidence } from 'mingyu-core/bazi';

export const CALENDAR_RULES = ['v1_legacy', 'v2_absolute'];

const BJ = 8 * 3600e3;
// 世界时 → 北京时间钟面（节气表的时间尺度）
export function beijingFace(utcMs) {
  const t = new Date(utcMs + BJ);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate(), hour: t.getUTCHours(), minute: t.getUTCMinutes(), second: t.getUTCSeconds() };
}
// 北京时间钟面 → 世界时
export const beijingToUtc = (b) => Date.UTC(b.year, b.month - 1, b.day, b.hour ?? 0, b.minute ?? 0, b.second ?? 0) - BJ;

const col = (c) => ({ gan: c.getHeavenStem().getName(), zhi: c.getEarthBranch().getName(), ganZhi: c.getName() });
const midYearPillar = (y) => SolarTime.fromYmdHms(y, 6, 1, 12, 0, 0).getLunarHour().getEightChar().getYear().getName();
const isTermWarning = (w) => w.includes('节气') || w.includes('交节');

const coreOriginal = baziCalculator.calculateCoreBazi;
baziCalculator.calculateCoreBazi = function calculateCoreBaziWithRule(person) {
  const core = coreOriginal.call(this, person);
  const b = person.absoluteBeijing;
  if (!b) return core;   // v1_legacy：引擎原样
  const st = SolarTime.fromYmdHms(b.year, b.month, b.day, b.hour, b.minute, b.second ?? 0);
  const abs = st.getLunarHour().getEightChar();
  const eightChar = new EightChar(abs.getYear(), abs.getMonth(), core.eightChar.getDay(), core.eightChar.getHour());
  const pillars = { ...core.pillars, year: col(abs.getYear()), month: col(abs.getMonth()) };
  const solarYear = st.getSolarDay().getYear(), mingGuaYear = midYearPillar(solarYear) === pillars.year.ganZhi ? solarYear : solarYear - 1;
  const luckInfo = this.luckCalculator.calculateLuckInfo(st, person.gender === 'male' ? Gender.MAN : Gender.WOMAN, core.dayMaster.gan);
  // 交节提示：原来拿当地真太阳时钟面去比，换成北京钟面比；时辰交界、换日照旧按当地
  let warnings = core.warnings;
  if (core.timing?.enabled) warnings = [...core.warnings.filter((w) => !isTermWarning(w)), ...checkJieqiBoundary(b)];
  return {
    ...core,
    pillars,
    eightChar,
    solarTime: st,   // 往下算季节、月令司令用它（绝对时刻）
    luckInfo,
    liunian: this.flattenLiunian(luckInfo),
    mingGua: calculateMingGua(mingGuaYear, person.gender),
    warnings,
    ...buildBaziWarningEvidence(warnings),
  };
};
