// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 上游修正：mingyu-core 0.3.0 取用的「调候」一步（applyClimateAdjustment）把调候五行加进喜、同时从忌里删掉，删了不补。
// 调候序列把扶抑分出的忌全占了时，忌组为空、五行全喜（300 张编的盘里约 2.3%，庚日巳月偏弱最多），
// 大运流年也跟着没有扣分。口径（10-04 定案）：分组逻辑不动，只在忌组为空时放回一个——
// 从被调候挪走的五行里取调候序列最末位那个，撤出喜用、记入忌组。忌不空的盘一概不动。
//
// 引擎不导出调候序列，取法：
//   扶抑的忌组 ← usefulGod.matchedRules 第一条（基础取用规则 id，下表照 mingyu-core 0.3.0 baziUsefulGodRules.js）
//   调候序列   ← strategyTrace 里引擎写的「调候优先:火 -> 木 -> 水」（引擎原样拼出的完整序列）
// 两样对不上（例如引擎升级改了写法）就不动，测试会报出来。

import { BASIC_MAPPINGS } from 'mingyu-core/bazi';

const SHENG = BASIC_MAPPINGS.WUXING_SHENG; // 我生
const KE = BASIC_MAPPINGS.WUXING_KE; // 我克
const keyOf = (map, v) => Object.keys(map).find((k) => map[k] === v);

function groupsOf(dm) {
  return { resource: keyOf(SHENG, dm), companion: dm, output: SHENG[dm], wealth: KE[dm], officer: keyOf(KE, dm) };
}

// 基础取用规则 → 扶抑分出的忌组（没命中基础规则时引擎默认取泄耗克，忌印比）
const BASE_AVOID = {
  'follow-special-strong': ['wealth', 'officer'],
  'follow-special-weak': ['resource', 'companion'],
  'balance-strong': ['resource', 'companion'],
  'balance-weak': ['output', 'wealth', 'officer'],
  'balance-neutral': ['resource', 'companion'],
};
const DEFAULT_AVOID = ['resource', 'companion'];

const LABEL = { resource: '印星', companion: '比劫', output: '食伤', wealth: '财星', officer: '官杀' };
function labelOf(dm, wx) {
  const g = groupsOf(dm);
  return LABEL[Object.keys(g).find((k) => g[k] === wx)] ?? '暂无';
}

const CLIMATE_PREFIX = '调候优先:';

export function climateOrderOf(useful) {
  const line = (useful.strategyTrace ?? []).find((t) => t.startsWith(CLIMATE_PREFIX));
  return line ? line.slice(CLIMATE_PREFIX.length).split(' -> ').map((s) => s.trim()).filter(Boolean) : [];
}

export function baseAvoidOf(useful, dm) {
  const g = groupsOf(dm);
  const id = useful.matchedRules?.[0]?.id;
  return (BASE_AVOID[id] ?? DEFAULT_AVOID).map((k) => g[k]);
}

// useful＝引擎的 analysis.usefulGod；dm＝日主五行。忌不空原样返回；要放回时返回新对象，不改引擎结果。
export function fixUsefulGod(useful, dm) {
  const fav = useful?.favorableWuxing ?? [];
  if (!useful || !dm || fav.length === 0 || (useful.unfavorableWuxing ?? []).length > 0) return useful;
  const order = climateOrderOf(useful);
  const baseAvoid = baseAvoidOf(useful, dm);
  // 忌组为空，说明扶抑的忌全被调候挪走：每一个都必须在调候序列里、也都在喜用里
  if (!baseAvoid.every((wx) => order.includes(wx) && fav.includes(wx))) return useful;
  const back = [...order].reverse().find((wx) => baseAvoid.includes(wx));
  const favorableWuxing = fav.filter((wx) => wx !== back);
  return {
    ...useful,
    favorableWuxing,
    unfavorableWuxing: [back],
    primaryFavorableWuxing: favorableWuxing[0],
    secondaryFavorableWuxing: favorableWuxing.slice(1),
    primaryUnfavorableWuxing: back,
    secondaryUnfavorableWuxing: [],
    useful: labelOf(dm, favorableWuxing[0]),
    avoid: labelOf(dm, back),
    primaryUseful: labelOf(dm, favorableWuxing[0]),
    primaryAvoid: labelOf(dm, back),
    strategyTrace: [...(useful.strategyTrace ?? []), `忌组放回:${back}（调候挪空忌组，取调候序列末位）`],
  };
}

// 用神是不是「调候取用」：用神那个五行按扶抑本该是忌，是调候把它取成了用（例如身偏弱的庚金生巳月，用神取火＝官杀）。
// 界面在用神旁边标「调候取用」，免得跟身强身弱的结论看着矛盾。传入修正后的喜忌。
export function isClimateUseful(useful, dm) {
  const wx = useful?.primaryFavorableWuxing;
  if (!wx || !dm) return false;
  return climateOrderOf(useful).includes(wx) && baseAvoidOf(useful, dm).includes(wx);
}
