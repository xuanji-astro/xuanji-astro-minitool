// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 按定案的强弱重取喜忌（10-05 定：身强身弱的定案是喜忌、大运流年吉凶的唯一输入）。
// 引擎只按它自己判的七档取用。定案（几种判法合判，或用户拿经历核过）跟引擎方向相反时，
// 用引擎同一个取用函数 determineUsefulGod 在「身强」或「身弱」档上重取一遍：扶抑、调候、司令、病药各步照旧，只换档位；格局沿用引擎的。
// 引擎不导出它喂给取用的那份上下文（透干、藏干、成局、五行计数、节气），这里照 mingyu-core 0.3.0 baziAnalysisPipeline.js 原样拼。
// 拼得对不对每次自证：先用引擎自己的档位重算一遍，跟引擎原结果逐字段相同才换档；不同（例如引擎升级改了上下文）就不换，applied:false。

import { determineUsefulGod, getWuxing, BASIC_MAPPINGS } from 'mingyu-core/bazi';

export const SIDE_STATUS = { 强: '身强', 弱: '身弱' };
const SIDE_OF = (status) => (/强|旺/.test(status ?? '') ? '强' : /弱|衰/.test(status ?? '') ? '弱' : null);
const KEYS = ['year', 'month', 'day', 'hour'];

// 三合、三会：化神得月令（旺、相）且没被局外地支冲破才算成局（同 baziFormationUtils.js collectEstablishedBranchFormations）
const FORMATIONS = [
  [['亥', '卯', '未'], '木'], [['寅', '卯', '辰'], '木'], [['寅', '午', '戌'], '火'], [['巳', '午', '未'], '火'],
  [['巳', '酉', '丑'], '金'], [['申', '酉', '戌'], '金'], [['申', '子', '辰'], '水'], [['亥', '子', '丑'], '水'],
];
function formationWuxings(P, season) {
  const all = KEYS.map((k) => P[k].zhi), have = new Set(all), out = new Set();
  for (const [branches, wx] of FORMATIONS) {
    if (!branches.every((b) => have.has(b))) continue;
    if (season[wx] !== '旺' && season[wx] !== '相') continue;
    const broken = all.some((b) => !branches.includes(b) && branches.some((m) => BASIC_MAPPINGS.DI_ZHI_CHONG[m] === b));
    if (!broken) out.add(wx);
  }
  return [...out];
}

function contextOf(raw) {
  const P = raw.pillars, H = raw.hiddenStems;
  const counts = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const k of KEYS) { counts[getWuxing(P[k].gan)] += 1; counts[getWuxing(P[k].zhi)] += 1; }
  return {
    yearStem: P.year.gan,
    hourBranch: P.hour.zhi,
    currentJieqi: raw.seasonInfo?.currentJieqi,
    visibleStems: KEYS.map((k) => P[k].gan).filter(Boolean),
    visibleStemSources: KEYS.map((k) => ({ pillar: k, stem: P[k].gan })).filter((s) => Boolean(s.stem)),
    hiddenStems: KEYS.flatMap((k) => H[k]).filter(Boolean),
    hiddenStemSources: KEYS.map((k) => ({ pillar: k, branch: P[k].zhi, stems: H[k].filter(Boolean) })),
    formationWuxings: formationWuxings(P, raw.wuxingSeasonStatus ?? {}),
    wuxingCounts: counts,
  };
}

const usefulAt = (raw, status, ctx) => determineUsefulGod(status, raw.analysis.mingGe, getWuxing(raw.pillars.day.gan), raw.pillars.month.zhi, raw.monthCommander, raw.pillars.day.gan, ctx);

// side＝'强'｜'弱'。返回 { useful（引擎原样格式，未经 fixUsefulGod）, info }；不换档时 useful 为 null。
export function usefulGodForSide(raw, side) {
  const a = raw.analysis ?? {}, own = a.dayMasterStrength?.status ?? null;
  const info = { side, status: SIDE_STATUS[side], engine: own, applied: false, why: null };
  if (raw.isThreePillars) return { useful: null, info: { ...info, why: '时辰不详，只排三柱，不按定案换档' } };
  if (a.mingGe?.isSpecial) return { useful: null, info: { ...info, why: '特殊格局按格局取用，不按身强身弱换档' } };
  if (SIDE_OF(own) === side) return { useful: null, info: { ...info, why: '定案跟引擎同向，喜忌照引擎原样' } };
  const ctx = contextOf(raw);
  if (JSON.stringify(usefulAt(raw, own, ctx)) !== JSON.stringify(a.usefulGod)) return { useful: null, info: { ...info, why: '取用上下文自证没过，没换档' } };
  return { useful: usefulAt(raw, SIDE_STATUS[side], ctx), info: { ...info, applied: true } };
}
