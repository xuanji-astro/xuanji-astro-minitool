// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 调候派 v1.1（10-07 命理组定，多派交叉论证的第二派）：只按《穷通宝鉴》调候取用，不论身强身弱，不掺扶抑、病药、格局。
//   日主＋月令（及节气、透藏等条件）查调候用神表（引擎 mingyu-core 0.3.0 的 404 条 CLIMATE_RULES，按引擎同一个匹配函数取第一条）。
//   **按天干记、按天干打分**（调候本是天干体系，「先丙后辛」点的是天干）：用神（排第一的）＝大喜，佐神（其后的）＝小喜；
//   天干从规则原句按顺序取（跳过开头的日干，跳过「忌／无／不」后面的字）；原句只说到五行的，退回五行（该五行两个天干都算）。
//   地支按本气天干进表（子→癸、亥→壬、寅→甲……），中气余气不进调候打分。
//   忌：原文写明的照原文取（ORIGINAL_JI，可带条件：「X 为忌，当且仅当条件 C」，字无善恶、局面定吉凶）；
//       没写的按推法——克用神的天干＝大忌；克佐神的、与用神天干相合（合绊，如用丙遇辛）的＝小忌；跟喜撞了不算忌；其余作闲（0）。
//   推法是命理组定的，不是原文，判例库攒够了再校。查不到规则的盘，调候派不表态。
// 大运流年顺逆跟扶抑派同一套分数口径（大喜＝首喜、小喜＝次喜、大忌＝首忌、小忌＝次忌，再加十神一项），只是逐个天干比。

import { BASIC_MAPPINGS, HIDDEN_STEMS, getWuxing } from 'mingyu-core/bazi';
import { luckByStems } from './score.js';

// 引擎没导出调候规则表和匹配函数，按文件取（版本钉在 0.3.0，测试会报出升级后的变化）
let BAZI;
try { BAZI = import.meta.resolve('mingyu-core/bazi'); } catch { BAZI = new URL('../../node_modules/mingyu-core/dist/bazi/index.js', import.meta.url).href; }
const { CLIMATE_RULES } = await import(new URL('./baziTherapeuticRules.js', BAZI).href);
const { matchFirstRule } = await import(new URL('./baziRuleMatcher/index.js', BAZI).href);

const SHENG = BASIC_MAPPINGS.WUXING_SHENG, KE = BASIC_MAPPINGS.WUXING_KE, HE = BASIC_MAPPINGS.TIAN_GAN_WU_HE;
const keyOf = (map, v) => Object.keys(map).find((k) => map[k] === v);
const LABEL = { resource: '印星', companion: '比劫', output: '食伤', wealth: '财星', officer: '官杀' };
const KEYS = ['year', 'month', 'day', 'hour'];

// 原文明写的忌（规则 id → 天干，可带条件）。when：'有甲'／'无甲'＝原局天干透甲或地支本气是甲（寅）算有甲
//   壬水酉月两条：「忌戊土浊塞」「甲制戊土保清」——戊为忌，当且仅当原局无甲（有甲制戊，甲戊并用反而清贵）；
//   辛金酉月白虎格「最忌丙火破局」；辛金未月「忌戊出」（无甲那条）；辛金未月「庚又出干制甲」——庚为忌，当且仅当原局有甲；
//   辛金子月「切忌癸出冻金，而困丙火」；癸水未月「忌丁火透出」。
export const ORIGINAL_JI = {
  'you-month-ren-jia-drain-soil': [{ stem: '戊', when: '无甲' }],
  'you-month-ren-jia-wu': [{ stem: '戊', when: '无甲' }],
  'you-month-xin-white-tiger-with-fire-ordinary': [{ stem: '丙' }],
  'wei-month-xin-wu-visible-no-jia-break': [{ stem: '戊' }],
  'wei-month-xin-wu-jia-geng-break': [{ stem: '庚', when: '有甲' }],
  'zi-month-xin-gui-visible-bing-visible-no-ren': [{ stem: '癸' }],
  'wei-month-gui-ding-break-metal': [{ stem: '丁' }],
};

// 取用上下文：照引擎 baziAnalysisPipeline 的拼法（同 strengthSide.js），时辰不详时少一柱
const FORMATIONS = [
  [['亥', '卯', '未'], '木'], [['寅', '卯', '辰'], '木'], [['寅', '午', '戌'], '火'], [['巳', '午', '未'], '火'],
  [['巳', '酉', '丑'], '金'], [['申', '酉', '戌'], '金'], [['申', '子', '辰'], '水'], [['亥', '子', '丑'], '水'],
];
function contextOf(raw) {
  const P = raw.pillars, H = raw.hiddenStems ?? {}, ks = KEYS.filter((k) => P[k]?.gan), season = raw.wuxingSeasonStatus ?? {};
  const counts = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const k of ks) { counts[getWuxing(P[k].gan)] += 1; counts[getWuxing(P[k].zhi)] += 1; }
  const all = ks.map((k) => P[k].zhi), have = new Set(all), formationWuxings = [];
  for (const [bs, wx] of FORMATIONS) {
    if (!bs.every((b) => have.has(b)) || (season[wx] !== '旺' && season[wx] !== '相')) continue;
    if (!all.some((b) => !bs.includes(b) && bs.some((m) => BASIC_MAPPINGS.DI_ZHI_CHONG[m] === b)) && !formationWuxings.includes(wx)) formationWuxings.push(wx);
  }
  return {
    yearStem: P.year.gan, monthBranch: P.month.zhi, hourBranch: P.hour?.zhi ?? null,
    dayMaster: getWuxing(P.day.gan), dayStem: P.day.gan, currentJieqi: raw.seasonInfo?.currentJieqi,
    visibleStems: ks.map((k) => P[k].gan),
    visibleStemSources: ks.map((k) => ({ pillar: k, stem: P[k].gan })),
    hiddenStems: ks.flatMap((k) => (H[k] ?? HIDDEN_STEMS[P[k].zhi])).filter(Boolean),
    hiddenStemSources: ks.map((k) => ({ pillar: k, branch: P[k].zhi, stems: (H[k] ?? HIDDEN_STEMS[P[k].zhi]).filter(Boolean) })),
    formationWuxings, wuxingCounts: counts,
  };
}

export function climateRuleOf(raw) {
  if (!raw?.pillars?.month?.zhi || !raw.pillars.day?.gan) return null;
  return matchFirstRule(CLIMATE_RULES, contextOf(raw)) ?? null;
}

// 规则原句里按顺序出现的天干：跳过开头的日干，跳过「忌、无、不、恐」后面紧跟的字
const STEMS = '甲乙丙丁戊己庚辛壬癸', NEG = '忌无不恐';
function stemsIn(text, dayStem) {
  const t = [...(text ?? '')], out = [];
  t.forEach((ch, i) => { if (STEMS.includes(ch) && !(i === 0 && ch === dayStem) && !NEG.includes(t[i - 1] ?? '') && !out.includes(ch)) out.push(ch); });
  return out;
}
const STEMS_OF = (wx) => [...STEMS].filter((s) => getWuxing(s) === wx);
// 每个用神、佐神五行落到哪些天干：先看提示句，再看规则名、说明；都没有就退回五行（两个天干都算）
function orderStems(rule, order, dayStem) {
  return order.map((wx) => {
    for (const t of [rule.hint, rule.label, rule.description]) { const s = stemsIn(t, dayStem).filter((x) => getWuxing(x) === wx); if (s.length) return { wx, stems: s, from: '原句' }; }
    return { wx, stems: STEMS_OF(wx), from: '五行' };
  });
}
const hasJia = (raw) => ['year', 'month', 'hour'].some((k) => raw.pillars[k]?.gan === '甲') || KEYS.some((k) => raw.pillars[k]?.zhi && HIDDEN_STEMS[raw.pillars[k].zhi][0] === '甲');
const KE_STEMS = (stem) => STEMS_OF(keyOf(KE, getWuxing(stem)));   // 克这个天干的（同五行两个都算）

export function tiaohouUseful(raw) {
  const rule = climateRuleOf(raw);
  if (!rule) return { abstain: true, why: '调候用神表里查不到这张盘对应的条目，调候派不表态' };
  const dayStem = raw.pillars.day.gan;
  const order = [...new Set([...(rule.favorableOrder ?? []), rule.usefulWuxing].filter(Boolean))];
  const os = orderStems(rule, order, dayStem);
  const yong = os[0].stems, zuo = [...new Set(os.slice(1).flatMap((x) => x.stems))].filter((s) => !yong.includes(s)), xi = new Set([...yong, ...zuo]);
  let da = [], xiao = [], source;
  const orig = (ORIGINAL_JI[rule.id] ?? []).filter((x) => !x.when || (x.when === '有甲') === hasJia(raw));
  if (ORIGINAL_JI[rule.id]) { source = '原文'; da = orig.map((x) => x.stem).filter((s) => !xi.has(s)); }
  if (!ORIGINAL_JI[rule.id] || !orig.length) {
    source = ORIGINAL_JI[rule.id] ? '原文条件不成立，按推法' : '推法';
    da = [...new Set(yong.flatMap(KE_STEMS))].filter((s) => !xi.has(s));
    const mates = yong.map((s) => HE[s]).filter(Boolean);
    xiao = [...new Set([...zuo.flatMap(KE_STEMS), ...mates])].filter((s) => !xi.has(s) && !da.includes(s));
  }
  const dm = getWuxing(dayStem), g = { resource: keyOf(SHENG, dm), companion: dm, output: SHENG[dm], wealth: KE[dm], officer: keyOf(KE, dm) };
  const label = (stem) => (stem ? LABEL[Object.keys(g).find((k) => g[k] === getWuxing(stem))] ?? null : null);
  const wxOf = (arr) => [...new Set(arr.map((s) => getWuxing(s)))];
  return {
    stems: { yong, zuo, da, xiao },
    // 五行视图（给只认五行的地方看；同一五行可能一个天干喜、一个天干忌，所以五行视图只作参考）
    favorableWuxing: wxOf([...yong, ...zuo]), unfavorableWuxing: wxOf([...da, ...xiao]).filter((wx) => !wxOf([...yong, ...zuo]).includes(wx)),
    useful: label(yong[0]), avoid: label(da[0] ?? xiao[0]),
    ji_source: source, stems_from: os.map((x) => `${x.wx}:${x.from}`),
    rule: { id: rule.id, label: rule.label, hint: rule.hint ?? null },
  };
}

// l0＝格局派给的原局结构注记（交战、破格、破从：大运挂注记、流年引动点燃，三派共用，10-09 定）
export function tiaohouSchool(raw, l0 = null) {
  const dayGan = raw.pillars?.day?.gan;
  if (!dayGan) return null;
  const u = tiaohouUseful(raw);
  return {
    school: '调候',
    version: 'v1.1',
    rule: '调候派 v1.1（10-07）：按《穷通宝鉴》调候用神表取用，不论身强身弱；按天干记、按天干打分（地支取本气天干）；用神大喜、佐神小喜；忌照原文（可带条件），无原文按推法（克用神大忌，克佐神、合绊用神小忌，撞喜不算，其余闲）；查不到条目不表态',
    ...(u.abstain ? u : { ...u, luck: luckByStems(raw, u, l0 ? { runNotes: l0.notes, igniteOf: l0.ignite } : {}) }),
  };
}
