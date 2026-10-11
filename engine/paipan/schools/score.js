// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 按天干打分（调候派、格局派共用，10-07 命理组定；10-08 流年加运年合看）：大运／流年的天干和地支本气天干各算一次喜忌，再加十神一项；
// 权重跟扶抑派的大运分同一套（config LUCK_SCORE）：大喜＝首喜、小喜＝次喜、大忌＝首忌、小忌＝次忌。

import { HIDDEN_STEMS, getTenGod } from 'mingyu-core/bazi';
import { LUCK_SCORE, LUCK_TIERS, TEN_GOD_GROUPS } from '../config.js';
import { tierOf } from '../components/shensha.js';
import { encounterYear } from './encounter.js';

// u＝{ stems: { yong, zuo, da, xiao }, useful, avoid }（useful／avoid 是十神组名：印星、比劫、食伤、财星、官杀）
const xjOf = (u, cfg) => { const { yong = [], zuo = [], da = [], xiao = [] } = u.stems;
  return (s) => (yong.includes(s) ? cfg.xiJi.primaryFavorable : zuo.includes(s) ? cfg.xiJi.favorable : da.includes(s) ? cfg.xiJi.primaryUnfavorable : xiao.includes(s) ? cfg.xiJi.unfavorable : 0); };
const tgOf = (dayGan, u, cfg) => (s) => { const god = getTenGod(s, dayGan); return TEN_GOD_GROUPS[u.useful]?.includes(god) ? cfg.tenGod.useful : TEN_GOD_GROUPS[u.avoid]?.includes(god) ? cfg.tenGod.avoid : 0; };

export function scoreStems(ganZhi, dayGan, u, cfg = LUCK_SCORE) {
  const xj = xjOf(u, cfg), tg = tgOf(dayGan, u, cfg);
  const gan = ganZhi[0], zhi = HIDDEN_STEMS[ganZhi[1]][0];
  const score = cfg.base + cfg.xiJiWeight * (xj(gan) + xj(zhi)) + cfg.tenGodWeight * (tg(gan) + tg(zhi));
  return Math.min(cfg.clip[1], Math.max(cfg.clip[0], score));
}

// 大运和每年的顺逆（只出分数和档位，干支、岁数看 bazi.luck）。流年走运年合看（encounter.js）：先遭遇、后喜忌。可选项：
//   noteOf(干支)＝派自己的注记（大运、流年都挂，只标不改分）；runNotes(干支)＝只挂在大运上的共用注记（交战、破格这类原局结构）；
//   igniteOf(大运干支)＝返回「这步大运的注记被哪一年引动」的判断函数；big、hard 原样交给遭遇层（大喜级信号、从强例外）
export function luckByStems(raw, u, { noteOf = null, runNotes = null, igniteOf = null, big = null, hard = null } = {}) {
  const dayGan = raw.pillars.day.gan, xj = xjOf(u, LUCK_SCORE), tg = tgOf(dayGan, u, LUCK_SCORE);
  const own = (gz) => (noteOf ? noteOf(gz) ?? [] : []);
  return (raw.luckInfo?.cycles ?? []).filter((c) => !c.isXiaoyun).map((c, i) => {
    const score = scoreStems(c.ganZhi, dayGan, u), notes = [...own(c.ganZhi), ...(runNotes ? runNotes(c.ganZhi) : [])];
    const fire = igniteOf ? igniteOf(c.ganZhi) : null;
    return {
      seq: i + 1, ganZhi: c.ganZhi, score, tier: tierOf(score, LUCK_TIERS), ...(notes.length ? { notes } : {}),
      years: (c.years ?? []).filter((y) => y.year >= c.year && y.year <= c.year + 9).map((y) => {
        const e = encounterYear(raw, c.ganZhi, y.ganZhi, xj, { tg, fire, big, hard }), ns = [...own(y.ganZhi), ...e.notes];
        return { year: y.year, ganZhi: y.ganZhi, score: e.score, tier: e.tier, ...(ns.length ? { notes: ns } : {}) };
      }),
    };
  });
}
