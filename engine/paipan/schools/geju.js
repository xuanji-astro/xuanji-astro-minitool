// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 格局派 v1.2（10-07 命理组规则表 v1＋当晚三定：破格之神永不抵消、格神按顺用逆用入喜忌、逆用格未成未破取制化之神；
// 10-08 五处：相神永保、其余双面身份一律作闲、逆用格神本身小忌、偏印格独立成败；多派交叉论证的第三派）：主线依《子平真诠》——以月令取格、以透干会局定格、
// 以成败救应定高低、以相神定喜忌。不论扶抑强弱（「身弱难任」用格局派自己的力量对比，不借扶抑派的票）。
// 五步各自成函数，每步留判据记录（命中哪条、条件值），投票层要拿记录出对照年：
//   取格 → 从格专旺（命中就走特殊管线）→ 成败 → 救应 → 相神与喜忌 → 岁运（按天干打分，注记只标不改分）。
// 「见」＝天干透出（年、月、时干）；地支里藏的不算见，会局另算。忌一律可带条件（字无善恶，局面定吉凶）。
// 数值门槛都在 GEJU 里，是施工先定的，封档验证按判例再校。

import { BASIC_MAPPINGS, HIDDEN_STEMS, getWuxing, getTenGod } from 'mingyu-core/bazi';
import { forcesOf, formations, FORCE } from './fuyi.js';
import { luckByStems } from './score.js';

export const GEJU = {
  near: 1,            // 取格第 2 步：两个透干力量差不到 1 算相近，取跟月令本气相生的
  weakGap: 1,         // 身弱难任：财（或伤官）的力量 ≥ 印＋比劫＋日主自身 1 分 再多 1
  congForce: 6,       // 从格：所从一方力量 ≥6
  congShare: 0.7,     // 且占全局（除日主外）≥70%
  congHelp: 1,        // 印比力量 <1 才算无生扶（0～1 之间记假从）
  congPick: 0.6,      // 所从之神：一组占财官食伤合计 ≥60% 就从那一组，否则从势
  zhuanShare: 0.8,    // 专旺：日主同气占全局 ≥80%
  zhuanBreak: 1,      // 专旺无破：官杀力量 <1
  qiangShare: 0.85,   // 从强（v1.3）：印比同党（日干算 1）占全局 ≥85%，克泄方无本气根、无透干＝真从强
  qiangJia: 0.7,      // ≥70%、克泄方单点力量都 <1.5（微根、弱透）＝假从强
  qiangSure: 0.75,    // 假从强 0.70～0.75 记「疑似」（v1.4）：照正格走，投票层拿财官年题核，核中才翻面；≥0.75 直接翻面
  qiangPoint: 1.5,
  xiaoRepeat: 2,      // 偏印格「枭重逢」：透干里偏印至少 2 个
};

const STEMS = '甲乙丙丁戊己庚辛壬癸';
const SHENG = BASIC_MAPPINGS.WUXING_SHENG, KE = BASIC_MAPPINGS.WUXING_KE, HE = BASIC_MAPPINGS.TIAN_GAN_WU_HE;
const keyOf = (map, v) => Object.keys(map).find((k) => map[k] === v);
const KEYS = ['year', 'month', 'day', 'hour'];
const GROUP = { 比劫: ['比肩', '劫财'], 印: ['正印', '偏印'], 食伤: ['食神', '伤官'], 财: ['正财', '偏财'], 官杀: ['正官', '七杀'] };
const LABEL = { 比劫: '比劫', 印: '印星', 食伤: '食伤', 财: '财星', 官杀: '官杀' };
const groupOf = (god) => Object.keys(GROUP).find((k) => GROUP[k].includes(god));
const LU = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
const REN = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };   // 阴干不论刃（10-06 定）
const HEART = { 水: '子', 木: '卯', 火: '午', 金: '酉' };   // 三合中神，会局取格用中神的本气天干
const FORMATIONS = [
  [['亥', '卯', '未'], '木'], [['寅', '卯', '辰'], '木'], [['寅', '午', '戌'], '火'], [['巳', '午', '未'], '火'],
  [['巳', '酉', '丑'], '金'], [['申', '酉', '戌'], '金'], [['申', '子', '辰'], '水'], [['亥', '子', '丑'], '水'],
];
const NAME_OF = { 正官: '正官格', 七杀: '七杀格', 正财: '正财格', 偏财: '偏财格', 正印: '正印格', 偏印: '偏印格', 食神: '食神格', 伤官: '伤官格' };
const ZHUAN = { 木: '曲直格', 火: '炎上格', 土: '稼穑格', 金: '从革格', 水: '润下格' };

function ctxOf(raw) {
  const P = raw.pillars, dm = P.day.gan, dmWx = getWuxing(dm), tg = (s) => getTenGod(s, dm);
  const visible = ['year', 'month', 'hour'].map((k) => P[k]?.gan).filter(Boolean);
  const see = (gods) => visible.filter((s) => [].concat(gods).includes(tg(s)));
  const seeG = (g) => see(GROUP[g]);
  const stemsOf = (gods) => [...STEMS].filter((s) => [].concat(gods).includes(tg(s)));
  // 力量分跟扶抑派同一份原料；格局派多一步：月支被会局合走（三合三会，或被两个中神半合）时，月支的力量挪到化出的五行
  //（判例一号：「月令巳火被两个酉拉向金，日主唯一的月令根被合走，化成了财」）
  const f = { ...forcesOf(raw) }, ju = huiJu(raw)[0], mz = P.month.zhi;
  if (ju) {
    const H = HIDDEN_STEMS[mz] ?? [];
    let moved = 0;
    H.forEach((st, i) => { if (!st) return; const w = (i === 0 ? FORCE.main + FORCE.month : FORCE.sub); f[getWuxing(st)] -= w; moved += w; });
    f[ju.wx] += moved;
  }
  const gwx = { 比劫: dmWx, 印: keyOf(SHENG, dmWx), 食伤: SHENG[dmWx], 财: KE[dmWx], 官杀: keyOf(KE, dmWx) };
  const force = (g) => f[gwx[g]];
  const total = Object.values(f).reduce((a, b) => a + b, 0);
  // 被合去：透出的这个天干，别的透干里有它的五合对象
  const heQu = (s) => visible.filter((x) => x !== s || visible.filter((y) => y === s).length > 1).some((x) => HE[s] === x);
  return { P, dm, dmWx, tg, visible, see, seeG, stemsOf, f, gwx, force, total, heQu };
}

// 会局：三合三会齐（化神旺相、没被局外冲破）；或月支被至少两个中神半合（判例一号：巳被两个酉合走）
function huiJu(raw) {
  const P = raw.pillars, season = raw.wuxingSeasonStatus ?? {}, all = KEYS.map((k) => P[k]?.zhi).filter(Boolean), m = P.month.zhi, out = [];
  for (const [bs, wx] of FORMATIONS) {
    if (!bs.includes(m) || !bs.every((b) => all.includes(b)) || (season[wx] !== '旺' && season[wx] !== '相')) continue;
    if (!all.some((b) => !bs.includes(b) && bs.some((x) => BASIC_MAPPINGS.DI_ZHI_CHONG[x] === b))) out.push({ wx, how: '三合三会成局' });
  }
  const mates = BASIC_MAPPINGS.DI_ZHI_SAN_HE[m] ?? [], heart = [m, ...mates].find((z) => Object.values(HEART).includes(z));
  if (heart && heart !== m) {
    const others = ['year', 'day', 'hour'].map((k) => P[k]?.zhi).filter(Boolean);
    if (others.filter((z) => z === heart).length >= 2 && !out.some((x) => x.wx === getWuxing(heart))) out.push({ wx: getWuxing(heart), how: `月支${m}被两个${heart}半合` });
  }
  return out;
}

// 一、取格：依次判，命中即停（判例一号定的先后：月令本气是比劫时，先看中余气透干、会局，都取不到财官印食才转禄刃）
//   1 月令本气透干 → 2 中气余气透干（多透取力量大的；相近取跟本气相生的）→ 3 地支会局 → 4 月令本气是比劫禄刃 → 另取财官食 → 5 月令本气（不透，以力主）
export function quGe(raw) {
  const c = ctxOf(raw), m = c.P.month.zhi, H = HIDDEN_STEMS[m];
  const mainGod = c.tg(H[0]), mainBi = GROUP.比劫.includes(mainGod);
  if (!mainBi && c.visible.includes(H[0])) return { step: '月令本气透干', stem: H[0], god: mainGod, name: NAME_OF[mainGod] };
  const sub = H.slice(1).filter((s) => s && c.visible.includes(s) && !GROUP.比劫.includes(c.tg(s)));
  if (sub.length) {
    const ranked = sub.map((s) => ({ s, f: c.f[getWuxing(s)] })).sort((a, b) => b.f - a.f);
    let pick = ranked[0];
    if (ranked[1] && ranked[0].f - ranked[1].f < GEJU.near) {
      const mw = getWuxing(H[0]), qing = (s) => SHENG[getWuxing(s)] === mw || SHENG[mw] === getWuxing(s);
      pick = ranked.find((x) => qing(x.s)) ?? ranked[0];
    }
    return { step: '中气余气透干', stem: pick.s, god: c.tg(pick.s), name: NAME_OF[c.tg(pick.s)] };
  }
  for (const ju of huiJu(raw)) {
    const s = HIDDEN_STEMS[HEART[ju.wx] ?? m][0], god = c.tg(s);
    if (!GROUP.比劫.includes(god)) return { step: `地支会局（${ju.how}，化${ju.wx}）`, stem: s, god, name: NAME_OF[god] };
  }
  if (mainBi) {
    const name = LU[c.dm] === m ? '建禄格' : REN[c.dm] === m ? '月刃格' : '月劫格';
    const cand = ['财', '官杀', '食伤'].flatMap((g) => c.seeG(g).map((s) => ({ s, g, f: c.force(g) }))).sort((a, b) => b.f - a.f);
    return { step: '月支为比劫禄刃，不立正格', name, jianlu: true, stem: cand[0]?.s ?? null, god: cand[0] ? c.tg(cand[0].s) : null,
      why: cand[0] ? `另取透出的${cand[0].g}（${cand[0].s}）为用，向${NAME_OF[c.tg(cand[0].s)] ?? cand[0].g}上靠` : '财官食都不透，没有可取的' };
  }
  return { step: '月令本气（不透，以力主）', stem: H[0], god: mainGod, name: NAME_OF[mainGod] };
}

// 二、从格与专旺（命中就走特殊管线，不再论正格成败）
export function congZhuan(raw) {
  const c = ctxOf(raw), yang = '甲丙戊庚壬'.includes(c.dm), rec = {};
  // 专旺：日主同气（含日干自身 1 分）占全局 ≥80%，官杀力量 <1
  const same = (c.f[c.dmWx] + 1) / (c.total + 1);
  rec.专旺 = { share: +same.toFixed(2), guansha: +c.force('官杀').toFixed(2) };
  if (same >= GEJU.zhuanShare && c.force('官杀') < GEJU.zhuanBreak) return { kind: '专旺', name: ZHUAN[c.dmWx], rec };
  // 从强（v1.3，10-08 命理组定）：印比同党强极、克泄方（财、官杀、食伤）将绝。跟专旺各过各的门槛，专旺先判、优先。
  // 单点力量＝一个位置给克泄方的力量：透干 1、地支本气 1（月令再加 1）、中余气 0.3、成局 2
  const kx = new Set(['财', '官杀', '食伤'].map((g) => c.gwx[g])), tong = (c.force('印') + c.force('比劫') + 1) / (c.total + 1);
  const kxRoot = KEYS.some((k) => c.P[k]?.zhi && kx.has(getWuxing(HIDDEN_STEMS[c.P[k].zhi][0])));
  const kxStem = c.visible.some((s) => kx.has(getWuxing(s)));
  const kxPoint = Math.max(0, ...c.visible.filter((s) => kx.has(getWuxing(s))).map(() => FORCE.stem),
    ...KEYS.flatMap((k) => (HIDDEN_STEMS[c.P[k]?.zhi] ?? []).map((s, i) => (!s || !kx.has(getWuxing(s)) ? 0 : i ? FORCE.sub : FORCE.main + (k === 'month' ? FORCE.month : 0)))),
    ...[...formations(raw)].filter((wx) => kx.has(wx)).map(() => FORCE.formation));
  rec.从强 = { share: +tong.toFixed(2), kx_root: kxRoot, kx_stem: kxStem, kx_point: +kxPoint.toFixed(2) };
  if (tong >= GEJU.qiangShare && !kxRoot && !kxStem) return { kind: '从强', name: '从强格', rec };
  if (tong >= GEJU.qiangJia && kxPoint < GEJU.qiangPoint) {
    if (tong >= GEJU.qiangSure) return { kind: '从强', name: '从强格', jia: true, rec };
    rec.从强.doubt = true;   // 疑似（v1.4）：不翻面，往下照正格判；gejuSchool 另附一份从强读法给投票层核
  }
  // 从格三条件。无根 v1 只认有没有（地支本气是比劫或印），根被合去、冲破先不算；
  // 取格那边已经用了「月支被会局合走、力量挪化神」，从格无根将来要跟它统一（v2 议题，挂账）
  const root = KEYS.some((k) => c.P[k]?.zhi && ['比劫', '印'].includes(groupOf(c.tg(HIDDEN_STEMS[c.P[k].zhi][0]))));
  const help = c.force('印') + c.force('比劫');
  const opp = c.force('财') + c.force('官杀') + c.force('食伤');
  rec.从格 = { root, help: +help.toFixed(2), opp: +opp.toFixed(2), share: +(opp / c.total).toFixed(2) };
  if (root || help >= GEJU.congHelp || opp < GEJU.congForce || opp / c.total < GEJU.congShare) return { kind: null, rec };
  const top = ['财', '官杀', '食伤'].map((g) => [g, c.force(g)]).sort((a, b) => b[1] - a[1])[0];
  const target = top[1] / opp >= GEJU.congPick ? top[0] : '势';
  if (yang && target !== '势' && !(c.seeG(target).length && huiJu(raw).some((x) => x.wx === c.gwx[target]))) return { kind: null, rec: { ...rec, 阳干从严: `所从的${target}要透干且会局，没满足` } };
  if (c.dmWx === '火' && GROUP.比劫.includes(c.tg(c.P.month.gan))) return { kind: null, rec: { ...rec, 火日主从严: '月干比劫自立，不从' } };
  const name = { 财: '从财格', 官杀: '从杀格', 食伤: '从儿格', 势: '从势格' }[target];
  return { kind: '从格', name, target, jia: help > 0, rec };
}

// 三、成败与救应（正格）：返回 { status, hits:[破或成], rescue, xiang（相神天干或组）, bing（格病）, po（破格之神的十神）}
export function chengBai(raw, ge) {
  const c = ctxOf(raw), god = ge.god, g = groupOf(god);
  const first = (gr) => c.seeG(gr)[0] ?? null;
  const weakFor = (gr) => c.force(gr) >= c.force('印') + c.force('比劫') + 1 + GEJU.weakGap;
  const r = { status: '未成未破', hits: [], rescue: null, xiang: null, bing: null, po: [] };
  const done = (status, xiang, extra = {}) => Object.assign(r, { status, xiang }, extra);
  // 配置有疵（规则表 v1.2，成败层的质地注记，喜忌不动）：顺用格格神克相神、两字在年月两干挨着（中间没隔日主），相碍
  const posOf = (s) => ['year', 'month', 'hour'].filter((k) => c.P[k]?.gan === s);
  const flawed = (res, kind) => {
    const ys = res.xiang?.stem, gp = posOf(ge.stem), yp = ys ? posOf(ys) : [];
    if (kind && gp.length && yp.length && [...gp, ...yp].includes('year') && [...gp, ...yp].includes('month') && ge.stem !== ys) res.flaw = `${kind}，配置有疵`;
    return res;
  };
  if (god === '正官') {
    r.po = ['伤官', '七杀'];
    const shang = c.see('伤官')[0];
    if (shang) { r.hits.push('伤官见官'); const yin = first('印'); if (yin) return done('破而有救', { stem: yin }, { rescue: '有印制伤' }); if (c.heQu(shang)) return done('破而有救', { stem: ge.stem }, { rescue: '伤官被合住' }); return done('破格', { group: '印' }); }
    if (c.see('七杀').length) { r.hits.push('官杀混杂'); return done('破格', { group: '食伤' }); }
    if (c.heQu(ge.stem) && c.visible.includes(ge.stem)) { r.hits.push('官星被合去'); return done('破格', { group: '财' }); }
    const cai = first('财'), yin = first('印');
    if (cai || yin) { r.hits.push(cai && yin ? '财印相辅' : cai ? '财生官' : '印护官'); return done('成格', { stem: cai ?? yin }); }
    return done('未成未破', { stem: ge.stem });
  }
  if (g === '财') {
    if (weakFor('财')) {
      r.bing = '财格身弱难任'; r.po = [...GROUP.财, ...GROUP.官杀];
      const bj = first('比劫');
      if (bj) { r.hits.push('财格身弱难任'); return done('破而有救', { stem: bj, noYin: true }, { rescue: '比劫帮身任财（此时比劫是救应，不是破格）' }); }
      r.hits.push('财格身弱难任'); return done('破格', { group: '比劫', noYin: true });
    }
    r.po = GROUP.比劫;
    if (c.seeG('比劫').length) {
      r.hits.push('比劫争财');
      const ss = first('食伤'), gs = first('官杀');
      if (ss) return done('破而有救', { stem: ss }, { rescue: '食伤通关' });
      if (gs) return done('破而有救', { stem: gs }, { rescue: '官杀制劫' });
      return done('破格', { group: '食伤' });
    }
    if (c.visible.includes(ge.stem) && c.heQu(ge.stem)) { r.hits.push('财星被合去'); return done('破格', { group: '食伤' }); }
    const gs = first('官杀'), ss = first('食伤'), yin = first('印');
    if (gs || ss || yin) { r.hits.push(gs ? '财生官' : ss ? '财逢食生' : '财格配印'); return flawed(done('成格', { stem: gs ?? ss ?? yin }), !gs && !ss ? '财印相碍' : null); }
    return done('未成未破', { stem: ge.stem });
  }
  if (god === '偏印') {   // 偏印格（枭）逆用，独立成败（10-08 定）：见财＝制枭，财是相神不是破格（偏印遇财，反辱为荣）；原局透食神的「枭夺食」v2 再议
    r.po = [];
    const cai = first('财'), gs = first('官杀'), ss = first('食伤');
    if (cai) { r.hits.push('偏印遇财（制枭）'); return done('成格', { stem: cai }); }
    // 枭重逢无制（规则表 v1.2）：透干里偏印至少两个、又没有财制，破格；破格之神是枭，相神取能救的财，盼岁运带来
    if (c.see('偏印').length >= GEJU.xiaoRepeat) { r.hits.push('枭重逢无制'); r.po = ['偏印']; return done('破格', { group: '财' }); }
    if (gs || ss) { r.hits.push(gs ? '官杀生印' : '印配食伤泄秀'); return flawed(done('成格', { stem: gs ?? ss }), ss && !gs ? '印食相碍' : null); }
    return done('未成未破', { group: '财' });   // 逆用格未成未破，相神取制化之神
  }
  if (g === '印') {
    r.po = GROUP.财;
    if (c.seeG('财').length) {
      r.hits.push('贪财坏印');
      const bj = first('比劫'), gs = first('官杀');
      if (bj) return done('破而有救', { stem: bj }, { rescue: '比劫制财护印' });
      if (gs) return done('破而有救', { stem: gs }, { rescue: '官杀通关' });
      return done('破格', { group: '比劫' });
    }
    const gs = first('官杀'), ss = first('食伤');
    if (gs || ss) { r.hits.push(gs ? '官杀生印' : '印配食伤泄秀'); return flawed(done('成格', { stem: gs ?? ss }), ss && !gs ? '印食相碍' : null); }
    return done('未成未破', { stem: ge.stem });
  }
  if (god === '食神') {
    r.po = ['偏印'];
    if (c.see('偏印').length) { r.hits.push('枭神夺食'); const cai = first('财'); if (cai) return done('破而有救', { stem: cai }, { rescue: '财制枭' }); return done('破格', { group: '财' }); }
    const cai = first('财'), sha = c.see('七杀')[0];
    if (cai || sha) { r.hits.push(cai ? '食神生财' : '食神制杀'); return done('成格', { stem: cai ?? sha }); }
    return done('未成未破', { stem: ge.stem });
  }
  if (god === '七杀') {
    r.po = GROUP.财;
    const ss = first('食伤'), yin = first('印');
    if (ss) { r.hits.push('杀逢食制'); return done('成格', { stem: ss }); }
    if (c.seeG('财').length) { r.hits.push('财党杀而无制'); if (c.visible.includes(ge.stem) && c.heQu(ge.stem)) return done('破而有救', { stem: ge.stem }, { rescue: '合杀留清' }); return done('破格', { group: '食伤' }); }
    if (yin) { r.hits.push('杀印相生'); return done('成格', { stem: yin }); }
    return done('未成未破', { group: '食伤' });
  }
  if (god === '伤官') {
    const jinShui = c.dmWx === '金' && ['亥', '子', '丑'].includes(c.P.month.zhi);
    r.po = jinShui ? [] : ['正官'];
    if (c.see('正官').length && !jinShui) { r.hits.push('伤官见官'); return done('破格', { group: '印' }); }
    if (c.see('正官').length && jinShui) { r.hits.push('金水伤官喜见官（调候条款）'); return done('成格', { stem: c.see('正官')[0] }); }
    const yin = first('印'), cai = first('财');
    if (yin && weakFor('食伤')) { r.hits.push('伤官配印（身弱伤官旺）'); return done('成格', { stem: yin }); }
    if (cai) { r.hits.push('伤官生财'); return done('成格', { stem: cai }); }
    if (yin) { r.hits.push('伤官配印'); return done('成格', { stem: yin }); }
    return done('未成未破', { group: weakFor('食伤') ? '印' : '财' });   // 逆用格未成未破，相神取制化之神：伤官身弱取印、身强取财
  }
  return r;
}

// 顺用逆用（《子平真诠》顺逆章，10-07 定）：财官印食顺用（格神是要生护的宝），杀伤枭刃（劫）逆用（格神是要制化的虎）
const SHUN = ['正官', '正财', '偏财', '正印', '食神'], NI = ['七杀', '伤官', '偏印'];

// 四、相神与喜忌（按天干，v1.2：10-07 全表替换＋10-08 总纲）。
//   总纲：一个字在喜忌两侧都有身份时，相神身份最高、永远保喜；其余双面身份一律作闲（功过对冲，不奖不罚）。
//   定死的只有对格局纯恶无功的字：破格之神（大忌，有破格必有忌，体检红线）、纯仇（生破格之神、又不生格神相神的）。
//   1 破格之神＝大忌，永不抵消；
//   2 用神＝相神那一类的天干（本身是破格之神的除外，如正官格里同组的七杀）；
//   3 仇＝生破格之神的，小忌；相神本身不算仇；
//   4 逆用格：生扶格神者（格神同五行两干含格神自己＋生它的五行）＝小忌（助虐；格神再逢＝病加重）；
//   5 佐＝生相神者＋（顺用格、格神本身没被列为破格之神时：格神那一类＋生格神者）；
//   双面作闲：佐神同时是仇、助虐、克相神、或扶破格之神（同五行），佐跟忌两边都作闲；顺用格的格神本身是格的体，不因克相神、跟破格之神同五行作闲。
function xiJi(raw, xiang, poGods, opts = {}) {
  const c = ctxOf(raw), allOf = (wx) => [...STEMS].filter((s) => getWuxing(s) === wx);
  const shengOf = (stems) => [...new Set([...new Set(stems.map(getWuxing))].flatMap((wx) => allOf(keyOf(SHENG, wx))))];
  const da = c.stemsOf(poGods), daWx = new Set(da.map(getWuxing));
  const grp = xiang.stem ? groupOf(c.tg(xiang.stem)) : xiang.group;
  const yong = grp ? c.stemsOf(GROUP[grp]).filter((s) => !da.includes(s)) : [], yongWx = new Set(yong.map(getWuxing));
  const geStems = opts.geGod ? c.stemsOf(GROUP[groupOf(opts.geGod)]) : [];
  const ni = NI.includes(opts.geGod), shun = SHUN.includes(opts.geGod) && !poGods.includes(opts.geGod);
  const keep = (s) => !da.includes(s) && !yong.includes(s);
  const chou = shengOf(da).filter(keep);
  const zhu = ni ? [...new Set([...geStems, ...shengOf(geStems)])].filter(keep) : [];
  let zuo = [...new Set([...shengOf(yong), ...(shun ? [...geStems, ...shengOf(geStems)] : [])])].filter(keep);
  if (opts.noYin) zuo = zuo.filter((s) => groupOf(c.tg(s)) !== '印');   // 财格身弱难任：印犯旺财、引财印交战，生身有功、触财有过，作闲
  const ti = (s) => shun && geStems.includes(s);
  const twoFaced = new Set(zuo.filter((s) => chou.includes(s) || zhu.includes(s) || (!ti(s) && (yongWx.has(KE[getWuxing(s)]) || daWx.has(getWuxing(s))))));
  const off = (s) => !twoFaced.has(s);
  return { yong, zuo: zuo.filter(off), da, xiao: [...new Set([...chou, ...zhu])].filter(off) };
}

// 财格身弱难任的「财印交战」（10-07 定稿丙）：运／年支冲原局财支，或运／年干是印、跟原局透的财干天干相冲；
// 冲的一端被合住就解（运／年干跟原局天干或本柱坐支藏干相合；运／年支跟原局财支相合）。只标不改分
function sealClashOf(raw) {
  const c = ctxOf(raw), caiWx = c.gwx.财, yinWx = c.gwx.印;
  const caiZhi = KEYS.map((k) => c.P[k]?.zhi).filter((z) => z && getWuxing(HIDDEN_STEMS[z][0]) === caiWx);
  const caiGan = c.visible.filter((s) => getWuxing(s) === caiWx);
  return (gz) => {
    const [g, z] = gz, why = [];
    if (caiZhi.some((n) => BASIC_MAPPINGS.DI_ZHI_CHONG[z] === n)) why.push(`${z}冲财支`);
    if (getWuxing(g) === yinWx && caiGan.some((s) => BASIC_MAPPINGS.TIAN_GAN_CHONG[g] === s)) why.push(`${g}与财干相冲`);
    if (!why.length) return null;
    const ganHe = [...c.visible, ...HIDDEN_STEMS[z]].includes(HE[g]);
    const zhiHe = caiZhi.some((n) => BASIC_MAPPINGS.DI_ZHI_LIU_HE[z] === n || (BASIC_MAPPINGS.DI_ZHI_SAN_HE[z] ?? []).includes(n));
    return ganHe || zhiHe ? null : { kind: '财印交战', why };
  };
}

// 从强的喜忌（v1.3 翻面）：顺势喜印比、食伤泄秀可（小喜），忌财官（都是大忌）
function qiangOut(c, cz) {
  const yong = c.stemsOf([...GROUP.印, ...GROUP.比劫]), zuo = c.stemsOf(GROUP.食伤), da = c.stemsOf([...GROUP.财, ...GROUP.官杀]);
  return { kind: '从强', name: '从强格', jia: cz.jia || cz.rec.从强?.doubt, steps: { 从格专旺: cz.rec }, stems: { yong, zuo, da, xiao: [] }, po: [...GROUP.财, ...GROUP.官杀], bing: null };
}

// 格局派的主读法：专旺、从强、从格走特殊管线，其余取正格；不表态时返回 { abstain }
function mainOut(raw, c, cz) {
  if (cz.kind === '专旺') {
    const yong = c.stemsOf(GROUP.比劫), zuo = c.stemsOf([...GROUP.印, ...GROUP.食伤]), da = c.stemsOf(GROUP.官杀), xiao = c.stemsOf(GROUP.财);
    return { kind: '专旺', name: cz.name, steps: { 从格专旺: cz.rec }, stems: { yong, zuo, da, xiao }, po: [...GROUP.官杀], bing: null };
  }
  if (cz.kind === '从强') return qiangOut(c, cz);
  if (cz.kind === '从格') {
    const T = { 财: [['财'], ['食伤'], ['印', '比劫']], 官杀: [['官杀'], ['财'], ['食伤', '印', '比劫']], 食伤: [['食伤'], ['财'], ['印']], 势: [['财', '官杀', '食伤'], [], ['印', '比劫']] }[cz.target];
    const st = (gs) => gs.flatMap((x) => c.stemsOf(GROUP[x]));
    return { kind: '从格', name: cz.name, jia: cz.jia, steps: { 从格专旺: cz.rec }, stems: { yong: st(T[0]), zuo: st(T[1]), da: st(T[2]), xiao: [] }, po: T[2].flatMap((x) => GROUP[x]), bing: null };
  }
  const ge = quGe(raw);
  if (!ge.name && !ge.jianlu) return { abstain: true, why: '无格可取，格局派不表态', steps: { 取格: ge, 从格专旺: cz.rec } };
  // 刃、劫逆用，财官食都不透＝未成未破，相神取官杀（制刃劫），盼岁运带来；建禄不在逆用四格里，照旧不表态
  if (ge.jianlu && !ge.stem && ge.name === '建禄格') return { abstain: true, why: `${ge.name}，${ge.why}，格局派不表态`, steps: { 取格: ge, 从格专旺: cz.rec } };
  const cb = !ge.jianlu ? chengBai(raw, ge)
    : ge.stem ? { status: '建禄月劫取用', hits: [ge.why], rescue: null, xiang: { stem: ge.stem }, bing: null, po: [...GROUP.比劫] }
      : { status: '未成未破', hits: [`${ge.why}；${ge.name}逆用，相神取官杀制之，盼岁运带来`], rescue: null, xiang: { group: '官杀' }, bing: null, po: [...GROUP.比劫] };
  return { kind: ge.jianlu ? '建禄月劫' : '正格', name: ge.name, steps: { 取格: ge, 从格专旺: cz.rec, 成败: { status: cb.status, hits: cb.hits, rescue: cb.rescue, ...(cb.flaw ? { flaw: cb.flaw } : {}) } },
    stems: xiJi(raw, cb.xiang, cb.po, { noYin: !!cb.xiang?.noYin, geGod: ge.jianlu ? null : ge.god }), po: cb.po,
    bing: cb.bing || (/^破/.test(cb.status) ? cb.hits[0] : null), xiang: cb.xiang };   // 格病：破格或难任之处（规则表 v1.2，给投票层对表）
}

// 一种读法的注记、点燃、大喜信号、从强例外（给岁运打分用）
const FIRE = ['财印交战', '破格', '破从', '破从强'];
export const L0_FIRE = ['财印交战', '破格', '破从'];   // 原局结构，不是格局派私见：三派共用（10-09 定）
function readingOf(raw, c, out) {
  // 相神原局不透（破格无救、逆用格未成未破取制化之神）：岁运见相神＝药到，文字层要会说「这年药到了」。打分里本来就是大喜；同年冲喜用不降档
  const yao = !['从格', '专旺', '从强'].includes(out.kind) && out.stems.yong.length && !out.stems.yong.some((s) => c.visible.includes(s)) ? out.stems.yong : [];
  const poStems = c.stemsOf(out.po), seal = out.bing === '财格身弱难任' ? sealClashOf(raw) : null;
  const congBreak = out.kind === '从格' ? c.stemsOf([...GROUP.印, ...GROUP.比劫]) : [];
  // 假从强：岁运扶起克泄之根（地支本气是财、官杀＝财星得地、官杀得根）记「破从强」，落回正格身强口径——跟假从同一纪律，只标不改分
  const qiangBreak = out.kind === '从强' && out.jia ? c.stemsOf([...GROUP.财, ...GROUP.官杀]) : [];
  const noteOf = (gz) => {
    const n = [], gan = gz[0], zhi = HIDDEN_STEMS[gz[1]][0];
    if (seal) { const x = seal(gz); if (x) n.push(x); }
    // god＝那个字的十神，给文字层按各派自己的话说（10-09 定：名词各用各的）
    if (congBreak.includes(gan) || congBreak.includes(zhi)) n.push({ kind: '破从', why: [`${congBreak.includes(gan) ? gan : gz[1]}是印比`], god: c.tg(congBreak.includes(gan) ? gan : zhi) });
    else if (qiangBreak.includes(zhi)) n.push({ kind: '破从强', why: [`${gz[1]}是${LABEL[groupOf(c.tg(zhi))]}之根，落回正格身强口径`], god: c.tg(zhi) });
    else if (out.kind !== '从格' && (poStems.includes(gan) || poStems.includes(zhi))) n.push({ kind: '破格', why: [`${poStems.includes(gan) ? gan : gz[1]}是破格之神`], god: c.tg(poStems.includes(gan) ? gan : zhi) });
    if (yao.includes(gan) || yao.includes(zhi)) n.push({ kind: '药到', why: [`${yao.includes(gan) ? gan : gz[1]}是相神，原局没透`] });
    return n;
  };
  // 运年合看第 1 类（10-09 收窄）：大运挂着交战、破格之类的注记，流年支跟运支冲刑破、或冲原局交战涉及的字＝点燃；
  // 交战一方透干不算扳机（甲午、乙巳都是印透，靠透干点火会连无事的年一起点着）
  const caiYin = c.stemsOf([...GROUP.财, ...GROUP.印]);
  const sidesOf = (kind) => (kind === '财印交战' ? caiYin : kind === '破从' ? congBreak : kind === '破从强' ? qiangBreak : poStems);
  const igniteOf = (runGz, kinds = FIRE) => {
    const rn = noteOf(runGz).filter((n) => kinds.includes(n.kind)), rz = runGz[1];
    if (!rn.length) return null;
    return ([, z]) => {
      const trig = [], add = (t) => { if (!trig.some((x) => x.how === t.how && x.to === t.to && x.at === t.at)) trig.push(t); };
      const how = BASIC_MAPPINGS.DI_ZHI_CHONG[z] === rz ? '冲' : (BASIC_MAPPINGS.DI_ZHI_XING[z] ?? []).includes(rz) ? '刑' : BASIC_MAPPINGS.DI_ZHI_PO[z] === rz ? '破' : null;
      if (how) add({ how, zhi: z, to: rz, at: '运' });
      for (const n of rn) {
        const sd = sidesOf(n.kind), k = KEYS.find((k) => c.P[k]?.zhi && BASIC_MAPPINGS.DI_ZHI_CHONG[z] === c.P[k].zhi && sd.includes(HIDDEN_STEMS[c.P[k].zhi][0]));
        if (k) add({ how: '冲', zhi: z, to: c.P[k].zhi, at: '原局' });
      }
      if (!trig.length) return null;
      // 点燃翻了方向，文字层要说得出为什么：哪步运、挂的什么病（连病因）、被什么引动。why 是格局派的话；run／src／trig 给各派按自己的名词重说
      const why = [`${runGz}运${rn.map((n) => `${n.kind}（${(n.why ?? []).join('、')}）`).join('、')}`, ...trig.map((t) => (t.at === '运' ? `${z}${t.how}运支${t.to}` : `${z}冲原局${t.to}`))];
      return { why, run: runGz, src: rn.map((n) => ({ kind: n.kind, why: n.why ?? [], ...(n.god ? { god: n.god } : {}) })), trig };
    };
  };
  const big = (gz) => (yao.includes(gz[0]) || yao.includes(HIDDEN_STEMS[gz[1]][0]) ? ['药到'] : null);
  // 从强例外（v1.4）：从强忌财官忌的是「出现」本身——财一露头群劫必争（财被比劫合＝争财，不是解救），官一进场即犯强；
  // 这两个五行的流年字不进遭遇层，出现即按大忌出分；遭遇层只用于喜神侧
  const hard = out.kind === '从强' ? (s) => out.stems.da.includes(s) : null;
  return { noteOf, igniteOf, big, hard };
}

// 一种读法出全套（喜忌、注记、岁运）
function schoolOf(raw, c, out) {
  const label = (s) => (s ? LABEL[groupOf(c.tg(s))] : null);
  const u = { stems: out.stems, useful: label(out.stems.yong[0]), avoid: label(out.stems.da[0] ?? out.stems.xiao[0]) };
  const r = readingOf(raw, c, out), wx = (arr) => [...new Set(arr.map(getWuxing))];
  return {
    kind: out.kind, name: out.name, ...(out.jia ? { jia: true } : {}),
    ...(out.bing ? { ge_bing: out.bing } : {}),
    steps: out.steps,
    stems: out.stems,
    favorableWuxing: wx([...out.stems.yong, ...out.stems.zuo]),
    unfavorableWuxing: wx([...out.stems.da, ...out.stems.xiao]).filter((x) => !wx([...out.stems.yong, ...out.stems.zuo]).includes(x)),
    useful: u.useful, avoid: u.avoid,
    luck: luckByStems(raw, u, { noteOf: r.noteOf, igniteOf: r.igniteOf, big: r.big, hard: r.hard }),
  };
}

const VERSION = 'v1.4';
const RULE = '格局派 v1.4（10-09）：依《子平真诠》以月令取格、透干会局定格、成败救应定高低、相神定喜忌（顺用格格神入喜、逆用格生扶格神者小忌；破格之神永远大忌；相神永远保喜，其余双面身份一律作闲；偏印格见财是制枭）；从强档：印比同党连日主 ≥85% 且克泄无根无透为真、≥75% 且克泄单点 <1.5 为假，0.70～0.75 记疑似（照正格走，投票层拿财官年核中才翻面），喜印比、忌财官，财官流年出现即按大忌、不进遭遇层，假从强遇财官之根记破从强；不论扶抑强弱；按天干打分；破格、破从、破从强、财印交战、药到只标注不改分；流年走运年合看（先遭遇后喜忌，强信号动分、弱信号只注记：大运注记被冲刑破引动则点燃、合化成局改姓、喜神被合走、冲大喜或冲喜的提纲降档；牵绊、忌神被合、冲小喜、冲忌神、天干冲克只注记；同年大喜级信号冲只记变动）';

export function gejuSchool(raw) {
  const dayGan = raw.pillars?.day?.gan;
  if (!dayGan || !raw.pillars.month?.zhi) return null;
  const c = ctxOf(raw), cz = congZhuan(raw), out = mainOut(raw, c, cz);
  // 从强疑似（v1.4）：页面照正格走、不出从强喜忌；从强读法另附给投票层出题核，核中才翻面
  const doubt = cz.rec.从强?.doubt ? { ...schoolOf(raw, c, qiangOut(c, cz)), doubt: true } : null;
  const extra = doubt ? { qiang_doubt: doubt } : {};
  if (out.abstain) return { school: '格局', version: VERSION, abstain: true, why: out.why, steps: out.steps, ...extra };
  return { school: '格局', version: VERSION, rule: RULE, ...schoolOf(raw, c, out), ...extra };
}

// 原局结构注记（交战、破格、破从）给扶抑、调候共用：大运挂注记、流年引动点燃。格局派不表态就没有
export function gejuL0(raw) {
  if (!raw.pillars?.day?.gan || !raw.pillars.month?.zhi) return null;
  const c = ctxOf(raw), out = mainOut(raw, c, congZhuan(raw));
  if (out.abstain) return null;
  const r = readingOf(raw, c, out);
  return { notes: (gz) => r.noteOf(gz).filter((n) => L0_FIRE.includes(n.kind)), ignite: (gz) => r.igniteOf(gz, L0_FIRE) };
}
