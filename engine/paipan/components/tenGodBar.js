// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 十神占比条：扁平计数，固定十神顺序，零值保留

import { TEN_GOD_ORDER, TEN_GOD_BAR } from '../config.js';
import { presentPillars } from '../chart.js';

export function tenGodBar(chart, cfg = TEN_GOD_BAR) {
  const counts = Object.fromEntries(TEN_GOD_ORDER.map((name) => [name, 0]));
  let total = 0;

  for (const [key, pillar] of presentPillars(chart)) {
    if (key !== 'day') {
      counts[pillar.tenGod] += 1;
      total += 1;
    } else if (cfg.includeDayMaster) {
      counts['比肩'] += 1;
      total += 1;
    }
    for (const h of pillar.hidden) {
      counts[h.tenGod] += 1;
      total += 1;
    }
  }

  const rows = TEN_GOD_ORDER.map((name) => ({
    tenGod: name,
    count: counts[name],
    // 去尾取整；加一点余量防止 7/14×100 这类浮点误差被多砍 1
    percent: Math.floor((counts[name] * 100) / total + 1e-9),
  }));

  return {
    total,
    sum: rows.reduce((s, r) => s + r.percent, 0),
    rows,
  };
}
