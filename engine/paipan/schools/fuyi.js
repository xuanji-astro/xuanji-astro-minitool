// SPDX-License-Identifier: AGPL-3.0-only · 玄玑 xuanji-paipan
// 扶抑派（底子派）v1（10-07 命理组定，多派交叉论证的第一派）：只按扶抑取用，不掺别派。
// 先看「病」在哪（哪一组五行让身过强或过弱），再定药；中和＝无病，扶抑派不表态（交给别派和用户答题）。
//   身弱：官杀重→用印、喜比劫；财重→用比劫、喜印（财印有战＝印也透干时，单用比劫，印不取）；食伤重→用印、喜比劫；
//         （财印有战单用比劫，是判例库第一号拿「印运反而最难」换来的教训）
//         没有单一重病→印、比劫，司令定先后。
//   身强：印多→用财、喜食伤；比劫多或禄刃当令→用官杀、喜食伤（官杀无力而食伤有力时食伤升首取）；
//         没有单一重病→食伤、财、官杀，司令定先后。
//   忌神＝致病的那组，仇神＝生忌神的那组（跟喜撞了就不算仇）；表里没提到的五行作闲（不喜不忌，打分 0）。
//   月令司令排序是本派的：表取完之后，只排喜神内部先后（有单一重病时用神不动，只排次取；没有时整组排）。
// 不做的（都是别派的步骤）：调候（穷通宝鉴）、病药（神峰通考，这次撤出、挂起）、按格名改判、从格专旺（交格局派）。
// 「哪组算重」用透干、地支本气和藏干、月令、成局算力量，门槛（FORCE）是施工时先定的，待命理组看样盘再校。
// 现有的 bazi.usefulGods（引擎四步混合版）原样保留，页面照旧用它，直到多派一起切换。

import { BASIC_MAPPINGS, getWuxing } from 'mingyu-core/bazi';
import { scoreGanZhi, xiJiOf, tenGodOf } from '../components/luck.js';
import { LUCK_SCORE, LUCK_TIERS } from '../config.js';
import { encounterYear } from './encounter.js';
import { tierOf } from '../components/shensha.js';

const SHENG = BASIC_MAPPINGS.WUXING_SHENG, KE = BASIC_MAPPINGS.WUXING_KE;
const keyOf = (map, v) => Object.keys(map).find((k) => map[k] === v);
const LABEL = { resource: '印星', companion: '比劫', output: '食伤', wealth: '财星', officer: '官杀' };
const NAME = { resource: '印', companion: '比劫', output: '食伤', wealth: '财', officer: '官杀' };
const KEYS = ['year', 'month', 'day', 'hour'];

export function groupsOf(dm) {
  return { resource: keyOf(SHENG, dm), companion: dm, output: SHENG[dm], wealth: KE[dm], officer: keyOf(KE, dm) };
}

// 力量：年月时干透一个 1；地支本气 1、藏干中气余气各 0.3；月令本气再加 1；三合三会成局（化神旺相、没被局外冲破）加 2
export const FORCE = { stem: 1, main: 1, sub: 0.3, month: 1, formation: 2, heavy: 2, gap: 1, weak: 1, strong: 1.5 };
const FORMATIONS = [
  [['亥', '卯', '未'], '木'], [['寅', '卯', '辰'], '木'], [['寅', '午', '戌'], '火'], [['巳', '午', '未'], '火'],
  [['巳', '酉', '丑'], '金'], [['申', '酉', '戌'], '金'], [['申', '子', '辰'], '水'], [['亥', '子', '丑'], '水'],
];
export function formations(raw) {
  const P = raw.pillars, season = raw.wuxingSeasonStatus ?? {}, all = KEYS.map((k) => P[k]?.zhi).filter(Boolean), have = new Set(all), out = new Set();
  for (const [bs, wx] of FORMATIONS) {
    if (!bs.every((b) => have.has(b)) || (season[wx] !== '旺' && season[wx] !== '相')) continue;
    if (!all.some((b) => !bs.includes(b) && bs.some((m) => BASIC_MAPPINGS.DI_ZHI_CHONG[m] === b))) out.add(wx);
  }
  return out;
}
export function forcesOf(raw) {
  const P = raw.pillars, H = raw.hiddenStems ?? {}, f = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const k of ['year', 'month', 'hour']) if (P[k]?.gan) f[getWuxing(P[k].gan)] += FORCE.stem;
  for (const k of KEYS) (H[k] ?? []).forEach((s, i) => { if (s) f[getWuxing(s)] += i === 0 ? FORCE.main : FORCE.sub; });
  const m0 = H.month?.[0]; if (m0) f[getWuxing(m0)] += FORCE.month;
  for (const wx of formations(raw)) f[wx] += FORCE.formation;
  return f;
}

// 禄刃当令：月支是日主的禄（临官），或阳干的刃（帝旺）；阴干不论刃（10-06 定）
const LU = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
const REN = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };

// 有力（命理组 10-10 判）：透干或得令（月令本气是它），二占其一——制是个动作，药神要动得了手；
// 只占通根（地支本气有它，不透不当令）＝「药在库」，不算有力、不能免罪（逢岁运透出时解当年之忌，记 v2 待办）
function strongWhy(raw, wx) {
  const P = raw.pillars, H = raw.hiddenStems ?? {}, r = [];
  if (['year', 'month', 'hour'].some((k) => P[k]?.gan && getWuxing(P[k].gan) === wx)) r.push('透干');
  if (H.month?.[0] && getWuxing(H.month[0]) === wx) r.push('得令');
  if (KEYS.some((k) => H[k]?.[0] && getWuxing(H[k][0]) === wx)) r.push('通根');
  return r;
}

// 病：在候选组里力量最大、到了「重」的门槛、又比第二名高出一截，才算单一重病；否则没有单一重病
function illOf(f, g, cands) {
  const rank = cands.map((k) => [k, f[g[k]]]).sort((a, b) => b[1] - a[1]);
  return rank[0][1] >= FORCE.heavy && rank[0][1] - (rank[1]?.[1] ?? 0) >= FORCE.gap ? rank[0][0] : null;
}

// side＝'强'｜'弱'｜'中'。返回扶抑派的喜忌（中和返回 abstain）
export function fuyiUseful(raw, side) {
  const dayGan = raw.pillars?.day?.gan, dm = getWuxing(dayGan), g = groupsOf(dm);
  if (side === '中') return { abstain: true, why: '中和＝无病，扶抑派不表态；交给别派和用户答题，核出强弱再按那边取' };
  const f = forcesOf(raw), stems = ['year', 'month', 'hour'].map((k) => raw.pillars[k]?.gan).filter(Boolean);
  let ill = null, fav, why;
  if (side === '弱') {
    ill = illOf(f, g, ['officer', 'wealth', 'output']);
    if (ill === 'officer') { fav = ['resource', 'companion']; why = '官杀重，用印化杀生身，比劫帮身'; }
    else if (ill === 'wealth') {
      const war = stems.some((s) => getWuxing(s) === g.resource);
      fav = war ? ['companion'] : ['companion', 'resource'];
      why = war ? '财重而印也透＝财印有战，单用比劫，印不取' : '财多身弱，用比劫担财，印次之';
    } else if (ill === 'output') { fav = ['resource', 'companion']; why = '食伤重，用印制食伤兼生身'; }
    else { fav = ['resource', 'companion']; why = '没有单一重病，印比扶身，司令定先后'; }
  } else {
    const ren = LU[dayGan] === raw.pillars.month?.zhi || REN[dayGan] === raw.pillars.month?.zhi;
    ill = illOf(f, g, ['resource', 'companion']) ?? (ren ? 'companion' : null);
    if (ill === 'resource') { fav = ['wealth', 'output']; why = '印多为病，用财破印，食伤泄秀'; }
    else if (ill === 'companion') {
      const flip = f[g.officer] < FORCE.weak && f[g.output] >= FORCE.strong;
      fav = flip ? ['output', 'officer'] : ['officer', 'output'];
      why = `${ren && illOf(f, g, ['resource', 'companion']) !== 'companion' ? '禄刃当令' : '比劫多'}，${flip ? '官杀无力、食伤有力，食伤升首取' : '用官杀制比劫，食伤泄'}`;
    } else { fav = ['output', 'wealth', 'officer']; why = '没有单一重病，泄耗克，司令定先后'; }
  }
  let favWx = fav.map((k) => g[k]);
  // 司令排序：只排喜神内部先后；有单一重病时用神（首取）不动
  const cw = raw.monthCommander ? getWuxing(raw.monthCommander) : null, head = ill ? 1 : 0;
  if (cw && favWx.slice(head).includes(cw)) favWx = [...favWx.slice(0, head), cw, ...favWx.slice(head).filter((x) => x !== cw)];
  // 忌神＝致病的那组；仇神＝生忌神的那组（跟喜撞了不算）；没有单一重病时，忌＝扶抑的另一边整组
  // 制衡扫描（命理组 10-10：喜忌误判的病根是「单链连坐」）：定仇之前先看病神有没有被有力之神制住——
  //   病神被克它的那组有力制住（印多被财制、比劫多被官杀制……）；官多为病另看印化官；财多为病另看印制食伤（制住生病的那组本身）。
  //   制住了，生病神的那组就不连坐：回到总则位置（身强泄耗克、身弱印比里有它就作喜，排在最后，标「喜中带压」），不在总则里就作闲。
  let unfavKeys, scan = null;
  const kOf = (wx) => Object.keys(g).find((k) => g[k] === wx);
  if (ill) {
    const ji = g[ill], chou = keyOf(SHENG, ji), chouKey = kOf(chou);
    if (favWx.includes(chou)) unfavKeys = [ill];
    else {
      const guards = [[kOf(keyOf(KE, ji)), '制' + NAME[ill]]];
      if (ill === 'officer') guards.push(['resource', '化官杀']);
      if (ill === 'wealth') guards.push(['resource', '制' + NAME[chouKey]]);
      const looked = guards.map(([k, how]) => ({ k, how, by: strongWhy(raw, g[k]) }));
      const hit = looked.find((x) => x.by.includes('透干') || x.by.includes('得令')), store = hit ? null : looked.find((x) => x.by.includes('通根'));
      scan = { x: NAME[chouKey], y: NAME[ill], guards: guards.map(([k, how]) => `${NAME[k]}${how}`), guard: hit ? `${NAME[hit.k]}${hit.how}（${hit.by.join('、')}）` : null, verdict: hit ? '免罪' : '定罪',
        ...(store ? { inStore: `${NAME[store.k]}只在地支本气有根＝药在库（不算有力）` } : {}) };
      // 免罪＝不按「助病」连坐，回到总则位置：身强总则喜泄耗克、身弱总则喜印比——在总则喜里就作喜（排最后，喜中带压），不在就照总则作忌
      const general = side === '弱' ? ['resource', 'companion'] : ['output', 'wealth', 'officer'];
      if (hit && general.includes(chouKey)) {
        favWx = [...favWx, chou]; scan.place = '回喜（喜中带压）'; unfavKeys = [ill];
        why += `；${NAME[chouKey]}生${NAME[ill]}本该作仇，但${NAME[hit.k]}${hit.how}有力，${NAME[chouKey]}回喜（喜中带压）`;
      } else { if (hit) scan.place = '照总则仍作忌'; unfavKeys = [ill, chouKey]; }
    }
  } else unfavKeys = side === '弱' ? ['output', 'wealth', 'officer'] : ['resource', 'companion'];
  const unfavWx = unfavKeys.map((k) => g[k]).filter((wx) => !favWx.includes(wx));
  const label = (wx) => LABEL[Object.keys(g).find((k) => g[k] === wx)];
  return {
    favorableWuxing: favWx, unfavorableWuxing: unfavWx,
    primaryFavorableWuxing: favWx[0], primaryUnfavorableWuxing: unfavWx[0],
    useful: label(favWx[0]), avoid: label(unfavWx[0]),
    ill: ill ? NAME[ill] : null, why, ...(scan ? { scan } : {}),
  };
}

// 大运和每年的顺逆（只出分数和档位，干支、岁数看 bazi.luck）；流年走运年合看（encounter.js）：先遭遇、后喜忌；
// l0＝格局派给的原局结构注记（交战、破格、破从，三派共用）：大运挂注记，流年引动点燃
function luckOf(raw, dayGan, useful, l0 = null) {
  const sc = (gz) => { const score = scoreGanZhi(gz, dayGan, useful); return { score, tier: score === null ? null : tierOf(score, LUCK_TIERS) }; };
  const xj = (s) => xiJiOf(s, useful, LUCK_SCORE), tg = (s) => tenGodOf(s, dayGan, useful, LUCK_SCORE);
  const yr = (c, y) => {
    if (!useful?.primaryFavorableWuxing) return { year: y.year, ganZhi: y.ganZhi, ...sc(y.ganZhi) };
    const e = encounterYear(raw, c.ganZhi, y.ganZhi, xj, { tg, fire: l0 ? l0.ignite(c.ganZhi) : null });
    return { year: y.year, ganZhi: y.ganZhi, score: e.score, tier: e.tier, ...(e.notes.length ? { notes: e.notes } : {}) };
  };
  return (raw.luckInfo?.cycles ?? []).filter((c) => !c.isXiaoyun).map((c, i) => ({
    seq: i + 1, ganZhi: c.ganZhi, ...sc(c.ganZhi), ...(l0?.notes(c.ganZhi).length ? { notes: l0.notes(c.ganZhi) } : {}),
    years: (c.years ?? []).filter((y) => y.year >= c.year && y.year <= c.year + 9).map((y) => yr(c, y)),
  }));
}

export function fuyiSchool(raw, l0 = null) {
  const dayGan = raw.pillars?.day?.gan;
  if (!dayGan) return null;
  const sides = Object.fromEntries(['弱', '强', '中'].map((side) => {
    const u = fuyiUseful(raw, side);
    return [side, u.abstain ? u : { ...u, luck: luckOf(raw, dayGan, u, l0) }];
  }));
  return {
    school: '扶抑',
    version: 'v1.1',
    rule: '扶抑派 v1.1（10-10 加制衡扫描：病神被有力之神制住，生病神的那组不连坐作仇，回到总则位置）；v1（10-07）：先看病在哪再定药；身弱官杀重用印、财重用比劫（财印有战单用比劫）、食伤重用印；身强印多用财、比劫多或禄刃当令用官杀（官杀无力食伤有力则食伤先）；无单一重病按印比／食伤财官杀、司令定先后；忌＝致病组、仇＝生忌组、其余闲；中和不表态；不叠调候、病药，不论从格专旺',
    sides,
  };
}
