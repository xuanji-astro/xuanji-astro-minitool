// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 上游修正一：mingyu-core 0.3.0 的劫煞、亡神查法表在「亥卯未」「巳酉丑」两组互换了。
// 古法按三合局推：劫煞在局之绝地，亡神在局之临官。
//   申子辰（水）劫煞巳、亡神亥；亥卯未（木）劫煞申、亡神寅
//   寅午戌（火）劫煞亥、亡神巳；巳酉丑（金）劫煞寅、亡神申
// 查法沿用引擎的口径：年支或日支任一查到即算。

import { PILLAR_KEYS } from './chart.js';

const SAN_HE = { 申: '水', 子: '水', 辰: '水', 亥: '木', 卯: '木', 未: '木', 寅: '火', 午: '火', 戌: '火', 巳: '金', 酉: '金', 丑: '金' };
const JIE_SHA = { 水: '巳', 木: '申', 火: '亥', 金: '寅' };
const WANG_SHEN = { 水: '亥', 木: '寅', 火: '巳', 金: '申' };

const TABLES = { 劫煞: JIE_SHA, 亡神: WANG_SHEN };

// 上游修正二：mingyu-core 0.3.0 整理常用神煞名单时，把岁神「福星」（年支往后第 9 位）改名成了「福星贵人」，
// 两个不相干的神煞混在一起，会多出假的福星贵人。这里按福星贵人原诀重算（年干或日干查）：
// 「甲丙相邀入虎乡，更游鼠穴最高强；戊猴己未丁宜亥，乙癸逢牛卯禄昌；庚赶马头辛到巳，壬骑龙背喜非常」
// 口径选择（查法有两个版本、都有出处的，选跟主流排盘软件一致的那版）：
// ① 天乙贵人：古诀两版——「甲戊庚牛羊……六辛逢马虎」（庚看丑未）与「甲戊兼牛羊……庚辛逢马虎」（庚看午寅）。
//    引擎用前一版，这里用后一版，只影响年干或日干是庚的盘
const TIAN_YI = { 甲: ['丑', '未'], 戊: ['丑', '未'], 乙: ['子', '申'], 己: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'], 壬: ['卯', '巳'], 癸: ['卯', '巳'], 庚: ['午', '寅'], 辛: ['午', '寅'] };
// ② 德秀贵人：引擎默认口径的德秀是简化版，会多排；改用引擎古法口径的结果（按《三命通会·论德秀》）
// ③ 学堂：纳音长生位，引擎只按年柱纳音查；再按日柱纳音查一次（年、日两查）
const NAYIN_CHANGSHENG = { 金: '巳', 木: '亥', 水: '申', 土: '申', 火: '寅' };

const FU_XING = { 甲: ['寅', '子'], 丙: ['寅', '子'], 乙: ['丑', '卯'], 癸: ['丑', '卯'], 戊: ['申'], 己: ['未'], 丁: ['亥'], 庚: ['午'], 辛: ['巳'], 壬: ['辰'] };

const setHit = (pillar, name, hit) => {
  const has = pillar.shensha.includes(name);
  if (hit && !has) pillar.shensha.push(name);
  if (!hit && has) pillar.shensha = pillar.shensha.filter((n) => n !== name);
};

// classicalRaw：同一张盘用引擎古法口径排的结果（只取德秀贵人），没有就不动德秀
export function fixShenshaTables(chart, classicalRaw = null) {
  const yearZhi = chart.pillars.year.zhi;
  const dayZhi = chart.pillars.day.zhi;
  for (const key of PILLAR_KEYS) {
    const pillar = chart.pillars[key];
    if (!pillar?.shensha) continue;
    const yg = chart.pillars.year.gan, dg = chart.pillars.day.gan;
    setHit(pillar, '福星贵人', FU_XING[yg].includes(pillar.zhi) || FU_XING[dg].includes(pillar.zhi));
    setHit(pillar, '天乙贵人', TIAN_YI[yg].includes(pillar.zhi) || TIAN_YI[dg].includes(pillar.zhi));
    if (classicalRaw) setHit(pillar, '德秀贵人', (classicalRaw.shensha?.[key] ?? []).includes('德秀贵人'));
    const dayNayinEl = String(chart.pillars.day.nayin ?? '').slice(-1);
    if (key !== 'day' && NAYIN_CHANGSHENG[dayNayinEl] === pillar.zhi) setHit(pillar, '学堂', true);
    for (const [name, table] of Object.entries(TABLES)) {
      const hit = table[SAN_HE[yearZhi]] === pillar.zhi || table[SAN_HE[dayZhi]] === pillar.zhi;
      const has = pillar.shensha.includes(name);
      if (hit && !has) pillar.shensha.push(name);
      if (!hit && has) pillar.shensha = pillar.shensha.filter((n) => n !== name);
    }
  }
  return chart;
}
