// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 运年合看（遭遇层，10-08 命理组定；10-09 收窄）：流年先遭遇、后喜忌。三派共用，喜忌由各派自己给。
// 原局是病案、大运揭病、流年引爆：流年干支进场，先算它跟原局、大运碰出了什么；遭遇层有结论就由它定档，一档之内仍按喜忌分排。
// 总纲（10-09）：强信号动分，弱信号只出注记不动分——宁可少算，不可错算。
//   强：点燃、合化成局改姓、喜神被合走、冲大喜（或冲的提纲是喜）降档；
//   弱：牵绊（合而化不成）、忌神被合、冲小喜（变动）、冲忌神、天干冲克——只出注记，给文字层讲形态用。
//   1 点燃：这步大运挂着交战、破格之类的注记，流年支跟运支冲刑破、或冲原局交战涉及的字＝点燃，至少偏紧。
//     哪些注记、交战双方是谁由派自己给（fire）；交战、破格、破从是原局结构，三派共用（geju.js 的 gejuL0）；
//   2 合化改姓：流年支跟原局、大运的支三合三会，或带中神半合；化神当令（旺、相）又没被局外冲破＝化成，流年支按化神算。
//     大运支参与合化（运与原局三合是正经应期），其余遭遇一律只看原局；
//   3 天干合走：流年干被原局年月时干五合合住——喜神被合，喜落空，这个字不计分；忌神被合只是绊住，照算；
//   4 天干冲克：流年干是大喜、大忌，被原局年月时干克住，记「喜被克」「忌被克」，不动档（10-09 定：判例上还没有支持它动分的格，先观测）；
//     合住它的那个字贪合忘克，不算；
//   5 冲：流年支冲原局大喜之神、或冲的提纲是喜＝喜损，降一档；冲小喜只记「变动」（涟漪不是伤）；冲提纲、冲用神记「大忌年」；冲忌神只记注记。
//     同年有大喜级信号（用神透干、药到），冲不降档，一律只记「变动」——冲只定动，不定吉凶。
//   从强例外（10-09）：从强盘的财、官杀两个五行，流年里出现就按大忌出分——不合化、不合走、不打折、不论冲克（hard）。

import { BASIC_MAPPINGS, HIDDEN_STEMS, getWuxing } from 'mingyu-core/bazi';
import { LUCK_SCORE, LUCK_TIERS } from '../config.js';
import { tierOf } from '../components/shensha.js';

export const ENCOUNTER = {
  ignite: 3,    // 点燃：至少偏紧（档位 3）
};

const CHONG = BASIC_MAPPINGS.DI_ZHI_CHONG, HE = BASIC_MAPPINGS.TIAN_GAN_WU_HE, KE = BASIC_MAPPINGS.WUXING_KE;
const KEYS = ['year', 'month', 'day', 'hour'], SEEN = ['year', 'month', 'hour'];   // 天干的遭遇不算日干（日主自己）
const HEART = { 水: '子', 木: '卯', 火: '午', 金: '酉' };   // 中神；化成以后流年支按中神的本气天干算
const JU = [
  [['申', '子', '辰'], '水', '三合'], [['亥', '卯', '未'], '木', '三合'], [['寅', '午', '戌'], '火', '三合'], [['巳', '酉', '丑'], '金', '三合'],
  [['亥', '子', '丑'], '水', '三会'], [['寅', '卯', '辰'], '木', '三会'], [['巳', '午', '未'], '火', '三会'], [['申', '酉', '戌'], '金', '三会'],
];

// 流年支跟原局、大运的支合成什么局：三合三会（流年补齐）先，带中神的半合次之；化成＝化神旺相、局外没有支冲局里的支
export function huaOf(raw, runZhi, z) {
  const P = raw.pillars, season = raw.wuxingSeasonStatus ?? {};
  const others = [...KEYS.map((k) => P[k]?.zhi), runZhi].filter(Boolean);
  let hit = null;
  for (const [bs, wx, how] of JU) if (!hit && bs.includes(z) && bs.every((b) => b === z || others.includes(b))) hit = { bs, wx, how };
  for (const [bs, wx, how] of JU) {
    if (hit || how !== '三合' || !bs.includes(z)) continue;
    const mate = bs.find((b) => b !== z && others.includes(b) && (b === HEART[wx] || z === HEART[wx]));
    if (mate) hit = { bs: [z, mate], wx, how: '半合' };
  }
  if (!hit) return null;
  const broken = [...others, z].some((b) => !hit.bs.includes(b) && hit.bs.some((x) => CHONG[x] === b));
  return { ...hit, cheng: (season[hit.wx] === '旺' || season[hit.wx] === '相') && !broken };
}

// 一年的分数、档位和遭遇注记。xj(天干)＝这一派的喜忌分（大喜 2、小喜 1、闲 0、小忌 -1、大忌 -2）；tg(天干)＝十神项（权重 0 时不起作用）；
// fire(流年干支)＝这步大运的注记被引动了没有（返回 { why, run, src, trig }，或 null）；big(流年干支)＝派自己的大喜级信号（如药到，返回缘由数组或 null）；
// hard(天干)＝从强例外：这个字不进遭遇层，出现即按它的喜忌出分
export function encounterYear(raw, runGz, yearGz, xj, { tg = () => 0, fire = null, big = null, hard = null, cfg = LUCK_SCORE } = {}) {
  const P = raw.pillars, [g, z] = yearGz, notes = [];
  let zs = HIDDEN_STEMS[z][0], gw = 1;
  const zHard = !!hard?.(zs), gHard = !!hard?.(g), vg = xj(g);
  if (!zHard) {
    const hua = huaOf(raw, runGz?.[1], z), mates = hua ? hua.bs.filter((b) => b !== z).join('') : '';
    if (hua?.cheng) {
      const rep = HIDDEN_STEMS[HEART[hua.wx]][0];   // 化成同一行（亥入亥子丑水局）不改姓，照原来的本气算
      if (getWuxing(rep) !== getWuxing(zs)) { notes.push({ kind: '合化', why: [`${z}与${mates}${hua.how}，化${hua.wx}`] }); zs = rep; }
    } else if (hua) notes.push({ kind: '牵绊', why: [`${z}与${mates}${hua.how}，化神${hua.wx}不当令或被冲，化不成`] });
  }
  const he = gHard ? null : SEEN.map((k) => P[k]?.gan).find((s) => s && HE[g] === s);
  if (he && vg > 0) { gw = 0; notes.push({ kind: '喜落空', why: [`${g}被${he}合住`] }); }
  else if (he && vg < 0) notes.push({ kind: '忌神被合', why: [`${g}被${he}合住，绊而不解`] });
  const raw0 = cfg.base + cfg.xiJiWeight * (gw * vg + xj(zs)) + cfg.tenGodWeight * (gw * tg(g) + tg(zs));
  const score = Math.min(cfg.clip[1], Math.max(cfg.clip[0], raw0));
  let tier = tierOf(score, LUCK_TIERS);
  const bigWhy = [...(gw && vg === cfg.xiJi.primaryFavorable ? [`${g}是用神，透出`] : []), ...(big?.(yearGz) ?? [])];
  if (!zHard) {
    const xs = [], ji = [], dj = [], bd = [];
    for (const k of KEYS.filter((k) => P[k]?.zhi && CHONG[z] === P[k].zhi)) {
      const n = P[k].zhi, v = xj(HIDDEN_STEMS[n][0]);
      if (bigWhy.length) { bd.push(`${z}冲${n}`); continue; }
      if (v === cfg.xiJi.primaryFavorable || (k === 'month' && v > 0)) xs.push(`${z}冲${n}`);
      else if (v > 0) bd.push(`${z}冲${n}`);
      else if (v < 0) ji.push(`${z}冲${n}`);
      if (k === 'month') dj.push(`${z}冲提纲${n}`);
      else if (v === cfg.xiJi.primaryFavorable) dj.push(`${z}冲用神${n}`);
    }
    if (xs.length) { tier = Math.min(LUCK_TIERS.length, tier + 1); notes.push({ kind: '喜损', why: xs }); }
    if (ji.length) notes.push({ kind: '冲忌', why: ji });
    if (dj.length) notes.push({ kind: '大忌年', why: [...new Set(dj)] });
    if (bd.length) notes.push({ kind: '变动', why: [...bd, bigWhy.length ? `同年${bigWhy.join('、')}，冲不降档` : '冲的是小喜，只定动、不降档'] });
  }
  if (gw && !gHard && Math.abs(vg) === cfg.xiJi.primaryFavorable) {
    const by = [...new Set(SEEN.map((k) => P[k]?.gan).filter((s) => s && s !== HE[g] && KE[getWuxing(s)] === getWuxing(g)))];
    if (by.length) notes.push({ kind: vg > 0 ? '喜被克' : '忌被克', why: [`${g}被${by.join('')}克`] });
  }
  const lit = fire ? fire(yearGz) : null;
  if (lit) { tier = Math.max(tier, ENCOUNTER.ignite); notes.push({ kind: '点燃', ...lit }); }
  return { score, tier, notes };
}
