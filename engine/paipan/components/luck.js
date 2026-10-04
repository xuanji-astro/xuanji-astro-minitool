// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 大运 / 流年分数：喜用驱动

import { HIDDEN_STEMS, getTenGod, getWuxing } from 'mingyu-core/bazi';
import { LUCK_SCORE, LUCK_TIERS, TEN_GOD_GROUPS } from '../config.js';
import { tierOf } from './shensha.js';

function xiJiOf(stem, useful, cfg) {
  const el = getWuxing(stem);
  if (el === useful.primaryFavorableWuxing) return cfg.xiJi.primaryFavorable;
  if (useful.favorableWuxing.includes(el)) return cfg.xiJi.favorable;
  if (el === useful.primaryUnfavorableWuxing) return cfg.xiJi.primaryUnfavorable;
  if (useful.unfavorableWuxing.includes(el)) return cfg.xiJi.unfavorable;
  return 0;
}

function tenGodOf(stem, dayGan, useful, cfg) {
  const god = getTenGod(stem, dayGan);
  if (TEN_GOD_GROUPS[useful.useful]?.includes(god)) return cfg.tenGod.useful;
  if (TEN_GOD_GROUPS[useful.avoid]?.includes(god)) return cfg.tenGod.avoid;
  return 0;
}

// 喜用没定下来（例如时辰不详的三柱盘）时返回 null
export function scoreGanZhi(ganZhi, dayGan, useful, cfg = LUCK_SCORE) {
  if (!useful?.primaryFavorableWuxing) return null;
  const gan = ganZhi[0];
  const zhiMain = HIDDEN_STEMS[ganZhi[1]][0];
  const xiJi = xiJiOf(gan, useful, cfg) + xiJiOf(zhiMain, useful, cfg);
  const tenGod = tenGodOf(gan, dayGan, useful, cfg) + tenGodOf(zhiMain, dayGan, useful, cfg);
  const score = cfg.base + cfg.xiJiWeight * xiJi + cfg.tenGodWeight * tenGod;
  return Math.min(cfg.clip[1], Math.max(cfg.clip[0], score));
}

function scored(ganZhi, dayGan, useful) {
  const score = scoreGanZhi(ganZhi, dayGan, useful);
  return { score, tier: score === null ? null : tierOf(score, LUCK_TIERS) };
}

export function luckCycles(raw, dayGan, useful) {
  const cycles = (raw.luckInfo?.cycles ?? []).filter((c) => !c.isXiaoyun);
  return {
    startInfo: raw.luckInfo?.startInfo ?? '',
    cycles: cycles.map((c, i) => ({
      seq: i + 1,
      ganZhi: c.ganZhi,
      startAge: c.age,
      endAge: c.age + 9,
      startYear: c.year,
      endYear: c.year + 9,
      ...scored(c.ganZhi, dayGan, useful),
      // 引擎把交运那一年同时列在前后两步里（一步 11 年）；只留本步起止年之间的十年，不跟下一步重叠
      years: (c.years ?? []).filter((y) => y.year >= c.year && y.year <= c.year + 9).map((y) => ({
        year: y.year,
        age: y.age,
        ganZhi: y.ganZhi,
        ...scored(y.ganZhi, dayGan, useful),
      })),
    })),
  };
}
