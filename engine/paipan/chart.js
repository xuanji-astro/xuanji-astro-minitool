// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 把 mingyu-core 的排盘结果整理成本服务内部统一的盘结构，组件只吃这个结构。

import { HIDDEN_STEMS, getTenGod, getWuxing } from 'mingyu-core/bazi';

export const PILLAR_KEYS = ['year', 'month', 'day', 'hour'];

const YANG_STEMS = new Set(['甲', '丙', '戊', '庚', '壬']);

function buildPillar(gan, zhi, dayGan, isDay) {
  return {
    gan,
    zhi,
    ganZhi: gan + zhi,
    ganElement: getWuxing(gan),
    tenGod: isDay ? '日主' : getTenGod(gan, dayGan),
    hidden: HIDDEN_STEMS[zhi].map((stem) => ({
      stem,
      element: getWuxing(stem),
      tenGod: getTenGod(stem, dayGan),
    })),
  };
}

// 只凭干支建盘（测试和对账用）。hour 为 null 表示时辰不详。
export function chartFromGanZhi({ year, month, day, hour }) {
  const src = { year, month, day, hour };
  const dayGan = day[0];
  const pillars = {};
  for (const key of PILLAR_KEYS) {
    if (!src[key]) {
      pillars[key] = null;
      continue;
    }
    pillars[key] = buildPillar(src[key][0], src[key][1], dayGan, key === 'day');
  }
  return {
    pillars,
    dayMaster: {
      gan: dayGan,
      element: getWuxing(dayGan),
      yinYang: YANG_STEMS.has(dayGan) ? '阳' : '阴',
    },
  };
}

// mingyu-core 排盘结果 → 内部盘结构，附上表格页要的纳音、空亡、地势、自坐、神煞
// extraShensha：另一次全量神煞排盘里补进来的名字（按柱），已由调用方筛过
export function chartFromMingyu(raw, extraShensha = {}) {
  const p = raw.pillars;
  const chart = chartFromGanZhi({
    year: p.year.ganZhi,
    month: p.month.ganZhi,
    day: p.day.ganZhi,
    hour: raw.isThreePillars ? null : p.hour.ganZhi,
  });
  for (const key of PILLAR_KEYS) {
    const pillar = chart.pillars[key];
    if (!pillar) continue;
    pillar.nayin = raw.nayin?.[key] ?? '';
    pillar.kongWang = raw.kongWang?.[key] ?? [];
    pillar.lifeStage = raw.pillarLifeStages?.[key] ?? '';
    pillar.ziZuo = raw.ziZuo?.[key] ?? '';
    const base = raw.shensha?.[key] ?? [];
    pillar.shensha = [...base, ...(extraShensha[key] ?? []).filter((name) => !base.includes(name))];
  }
  return chart;
}

export function presentPillars(chart) {
  return PILLAR_KEYS.filter((key) => chart.pillars[key]).map((key) => [key, chart.pillars[key]]);
}
