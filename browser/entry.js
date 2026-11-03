// 小工具引擎入口：生辰 → 数据交接包（xuanji.handoff/0.1），和服务端 /v1/profile 同一套拼装（engine/src/core.js），
// 只是八字不走排盘服务，改在本机调同一份 paipan()（engine/paipan，AGPL）。全程不联网。
import core from '../engine/src/core.js';
import transits from '../engine/src/transits.js';
import feel from '../engine/src/feel.js';   // 用你的经历核一次：计分在本机（回答不出这台手机）
import { paipan, InputError as PaipanInputError } from '../engine/paipan/paipan.js';
import { candidate as rectCandidate, plan as rectPlan, score as rectScore, weight as rectWeight, AREAS as rectAreas, domainOf as rectDomainOf } from '../engine/skill/rectify.mjs';   // 定时辰：Skill 同一份打分脚本

const { parseInput, natalOf, autoSideOf, strengthOfAnswers, calibInput, assemble, InputError } = core;
const hhmm = (inp) => (inp.h == null ? null : `${String(inp.h).padStart(2, '0')}:${String(inp.mi).padStart(2, '0')}`);

// 同 profile.js bazi()：先用用户写的城市；排盘认不出时用我们解析出的全称再试一次。走一遍 JSON 往返，和服务端收到的回包一模一样。
function baziLocal(inp) {
  const call = (city) => {
    try { return { ok: true, body: JSON.parse(JSON.stringify(paipan({ date: inp.date, time: hhmm(inp), city, gender: inp.gender, ...(inp.strength ? { strength: inp.strength } : {}), calendarRule: inp.calendarRule || 'v2_absolute', ...(inp.place && inp.place.zone ? { zone: inp.place.zone, ll: (+inp.place.lat).toFixed(4) + ',' + (+inp.place.lon).toFixed(4) } : {}) })   /* 1102jw：境外／港澳台带出生地时区名和经纬度（同 profile.js）；历法口径同 profile.js（小工具每次新排＝v2_absolute：年柱月柱、起运按出生那一刻比节气） */)) }; }
    catch (e) { if (e instanceof PaipanInputError) return { ok: false, body: { error: { code: e.code, message: e.message } } }; throw e; }
  };
  let r = call(inp.city);
  if (r.body && r.body.error && r.body.error.code === 'LOCATION_NOT_FOUND' && inp.place && inp.place.name && inp.place.name !== inp.city) r = call(inp.place.name);
  return r.ok ? { status: 'ok', ...r.body } : { status: 'error', http: 400, error: r.body.error };
}

/* global XJ_VERSION */
function compute(body, { now = new Date(), lite = false } = {}) {
  let inp = parseInput(body);
  const N = natalOf(inp);
  let bz = baziLocal(inp);
  // 同 profile.js withCalib：身强身弱校正（8 道题＋大事、一段时间、转折年）——先照没答题的样子排一遍，拿盘上几套喜用逐套对经历（rc.16），定了就按那一套
  if (inp.calib) {
    const inp1 = { ...inp, answers: null, calib: null }, a1 = autoSideOf(inp1, bz, null);
    let b1 = bz; if (a1) { const r = baziLocal({ ...inp1, strength: a1 }); if (r.status === 'ok') b1 = r; }
    inp = calibInput(inp, assemble(inp1, null, b1, { version: XJ_VERSION, lite: true, now, auto: a1 }));
    // 同 profile.js（rc.16）：校正定到扶抑某一边，带定案再排一次；定到调候、格局不用重排
    if (inp.strength_by === '你的经历') { const b2 = baziLocal(inp); if (b2.status === 'ok') bz = b2; }
  }
  // 同 profile.js：「核一核」的回答里身强身弱定了，当作核过的定案带着再排一次；派别由 assemble 按回答挑（10-08 起，跟 Skill、Kimi 同一套）
  const fromAns = strengthOfAnswers(inp, bz);
  if (fromAns) { inp = { ...inp, strength: fromAns, strength_by: '核核你' }; const b2 = baziLocal(inp); if (b2.status === 'ok') bz = b2; }
  // 同 profile.js：没核过、几种判法的结论跟引擎档位不同，带结论再排一次（10-06 定）
  const auto = autoSideOf(inp, bz, N);
  if (auto) { const b2 = baziLocal({ ...inp, strength: auto }); if (b2.status === 'ok') bz = b2; }
  return assemble(inp, N, bz, { version: XJ_VERSION, lite, now, auto });
}

// 慢星星历预算表（scripts/ephem_table.mjs 生成）：把同一批 UTC 零点取样的位置先填进缓存，手机上不用现算
function loadEphem(tab) {
  if (!tab) return 0;
  let n = 0;
  for (const [m, b64] of Object.entries(tab.movers)) {
    const bin = atob(b64), len = bin.length, k = len / 8, u8 = new Uint8Array(len);
    // planes8：第 j 个字节平面是所有数的第 j 个字节（scripts/ephem_table.mjs），还原回 Float64 原值
    if (tab.enc === 'planes8') { for (let j = 0; j < 8; j++) for (let i = 0; i < k; i++) u8[i * 8 + j] = bin.charCodeAt(j * k + i); }
    else for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
    transits.ephemFill(m, tab.day0, new Float64Array(u8.buffer));
    n += k;
  }
  return n;
}

window.XJ = { compute, loadEphem, feelScore: feel.feelScore, feelItem: feel.yearItem, rect: { candidate: rectCandidate, plan: rectPlan, score: rectScore, weight: rectWeight, AREAS: rectAreas, domainOf: rectDomainOf }, InputError, version: XJ_VERSION };
