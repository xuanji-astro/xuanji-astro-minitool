// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 五行能量环：加权占比 + 每行挂的十神 + 类型标签

import { ELEMENTS, WUXING_RING, STRENGTH_TYPE_MAP } from '../config.js';
import { presentPillars } from '../chart.js';

// 取整后残差归原始值最大的一项，保证总和 100
function roundToHundred(raw) {
  const total = ELEMENTS.reduce((sum, el) => sum + raw[el], 0);
  const exact = Object.fromEntries(ELEMENTS.map((el) => [el, (raw[el] / total) * 100]));
  const rounded = Object.fromEntries(ELEMENTS.map((el) => [el, Math.round(exact[el])]));
  const residual = 100 - ELEMENTS.reduce((sum, el) => sum + rounded[el], 0);
  const largest = ELEMENTS.reduce((best, el) => (exact[el] > exact[best] ? el : best), ELEMENTS[0]);
  rounded[largest] += residual;
  return { exact, rounded };
}

export function classify(percent, thresholds = WUXING_RING.typeThresholds) {
  const values = ELEMENTS.map((el) => percent[el]);
  const range = Math.max(...values) - Math.min(...values);
  const dominant = ELEMENTS.reduce((best, el) => (percent[el] > percent[best] ? el : best), ELEMENTS[0]);
  if (range <= thresholds.balancedMax) return { type: '均衡型', range, dominant };
  if (range <= thresholds.dominantMax) return { type: `${dominant}旺型`, range, dominant };
  return { type: '极强型', range, dominant };
}

// 引擎身强弱七档 → 类型标签；时辰不详或引擎没给结论就不给标签（不硬凑）
export function strengthType(dms, timeKnown = true) {
  if (!timeKnown) return { type: null };
  return { type: STRENGTH_TYPE_MAP[dms?.status] ?? null };
}

// 引擎身强弱的三项定性依据（月令／通根／得势），原样转出给解读层讲「为什么这么判」；时辰不详或读不全就不给
export function strengthBasis(dms, timeKnown = true) {
  const d = dms?.details;
  if (!timeKnown || !d) return null;
  const basis = (d.ruleBasis ?? []).join('；');
  const month = basis.match(/月令与司令合看为(扶身|相持|制身)/)?.[1];
  const momentum = basis.match(/中余气合看为(扶身|相持|制身)/)?.[1];
  if (!month || !momentum) return null;
  return { month, root: d.hasStrongRoot ? 'strong' : d.hasRoot ? 'has' : 'none', momentum };
}

export function wuxingRing(chart, cfg = WUXING_RING, dms = null, timeKnown = true) {
  const raw = Object.fromEntries(ELEMENTS.map((el) => [el, 0]));
  const tenGods = Object.fromEntries(ELEMENTS.map((el) => [el, []]));
  const addTenGod = (el, name) => {
    if (!tenGods[el].includes(name)) tenGods[el].push(name);
  };

  for (const [key, pillar] of presentPillars(chart)) {
    const isDayStem = key === 'day';
    if (!isDayStem || cfg.includeDayMaster) raw[pillar.ganElement] += cfg.stemWeight;
    if (!isDayStem) addTenGod(pillar.ganElement, pillar.tenGod);

    const weights = cfg.hiddenWeightsByCount[pillar.hidden.length];
    pillar.hidden.forEach((h, i) => {
      raw[h.element] += weights[i];
      addTenGod(h.element, h.tenGod);
    });
  }
  // 日主固定挂在本行最后
  tenGods[chart.dayMaster.element].push('日主');

  const { exact, rounded } = roundToHundred(raw);
  const label = classify(rounded, cfg.typeThresholds);

  return {
    // 标签由引擎身强弱七档映射；时辰不详或引擎没给结论就不给标签
    type: strengthType(dms, timeKnown).type,
    strength: dms?.status && dms.status !== '未知' ? dms.status : null,
    rangeType: label.type,
    range: label.range,
    dominant: label.dominant,
    dayMasterElement: chart.dayMaster.element,
    rows: ELEMENTS.map((el) => ({
      element: el,
      percent: rounded[el],
      exact: Math.round(exact[el] * 100) / 100,
      tenGods: tenGods[el],
    })),
  };
}
