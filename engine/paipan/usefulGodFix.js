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

import { BASIC_MAPPINGS, getWuxing } from 'mingyu-core/bazi';

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

// 10-06 定（规则 v0）：身弱档调候不许压扶抑。mingyu-core 的调候一步不跟扶抑比输赢，直接把调候字挪进喜的最前、从忌里删掉；
// 身强档这样没问题（身能任泄），身弱档等于往弱身上再泄。所以普通格局、身弱档（偏弱／身弱／极弱，含按定案换到身弱档）
// 调候生效时，喜忌按扶抑重排，调候字按它对日主的作用处理：
//   帮身（印、比劫）：本来就在扶抑的喜里，照旧，但不抢首位（排在扶抑喜神之后作次席）；
//   泄耗（食伤、财）：不进喜，回到忌；
//   克身（官杀）：局里有印通关（四柱天干、地支本气见印）作次喜，排在扶抑喜神之后；没有印就不进喜。
// 扶抑的喜＝印、比劫，月令司令在其中就排最前（同引擎的司令排序）；忌＝食伤、财、官杀里没进喜的，顺序同引擎。身强档、特殊格局不动。
// 调候提示（取用层次、病药提示）照旧留在 strategyTrace 里。
const WEAK = /弱|衰/;
export function presentWuxing(raw) {
  const P = raw?.pillars ?? {}, out = new Set();
  for (const k of ['year', 'month', 'day', 'hour']) for (const x of [P[k]?.gan, P[k]?.zhi]) if (x) out.add(getWuxing(x));
  return out;
}
export function weakClimate(useful, dm, { status, present, commander } = {}) {
  if (!useful || !dm || !WEAK.test(status ?? '') || useful.matchedRules?.[0]?.id !== 'balance-weak') return useful;
  const order = climateOrderOf(useful);
  if (!order.length) return useful;
  const g = groupsOf(dm), hasYin = !!present?.has(g.resource);
  const kind = (wx) => (wx === g.resource || wx === g.companion ? 'help' : wx === g.officer ? 'ctrl' : 'drain');
  const held = order.filter((wx) => kind(wx) === 'drain' || (kind(wx) === 'ctrl' && !hasYin));
  const second = order.filter((wx) => kind(wx) === 'ctrl' && hasYin);
  let fav = [g.resource, g.companion];
  if (commander && fav.includes(commander)) fav = [commander, ...fav.filter((wx) => wx !== commander)];
  fav = [...fav, ...second.filter((wx) => !fav.includes(wx))];
  const unfav = [g.output, g.wealth, g.officer].filter((wx) => !fav.includes(wx));
  if (fav.join() === (useful.favorableWuxing ?? []).join() && unfav.join() === (useful.unfavorableWuxing ?? []).join()) return useful;
  return {
    ...useful,
    favorableWuxing: fav,
    unfavorableWuxing: unfav,
    primaryFavorableWuxing: fav[0],
    secondaryFavorableWuxing: fav.slice(1),
    primaryUnfavorableWuxing: unfav[0],
    secondaryUnfavorableWuxing: unfav.slice(1),
    useful: labelOf(dm, fav[0]),
    avoid: labelOf(dm, unfav[0]),
    primaryUseful: labelOf(dm, fav[0]),
    primaryAvoid: labelOf(dm, unfav[0]),
    strategyTrace: [...(useful.strategyTrace ?? []), `身弱调候不压扶抑（规则 v0）：${[held.length ? `${held.join('')}不进喜` : '', second.length ? `${second.join('')}有印通关作次喜` : ''].filter(Boolean).join('，') || '调候字帮身，排在扶抑之后'}；最终取用:${fav.join(' -> ')}`],
  };
}

// 用神是不是「调候取用」：用神那个五行按扶抑本该是忌，是调候把它取成了用（例如身偏弱的庚金生巳月，用神取火＝官杀）。
// 界面在用神旁边标「调候取用」，免得跟身强身弱的结论看着矛盾。传入修正后的喜忌。
export function isClimateUseful(useful, dm) {
  const wx = useful?.primaryFavorableWuxing;
  if (!wx || !dm) return false;
  return climateOrderOf(useful).includes(wx) && baseAvoidOf(useful, dm).includes(wx);
}
