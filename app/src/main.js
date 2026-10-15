// 玄玑 xuanji-astro 小红书小工具：排完盘进一个完整的结果页（顶部出生信息＋五个标签：封面／验证／星盘／八字／时间线），
// 每页都能一层层展开看数据；页底统一「保存、分享与继续」和「方法与边界」。专业感靠能点进去看，引流到 Skill 和创始人。
// 样子照 Skill 报告模板 v0.6；按钮不放页面最上沿（小红书顶栏会盖住）。
import { h, s as svgEl, fold, chips, select, pad2 } from './ui.js';
import * as D from './derive.js';
import * as store from './store.js';
import { wheel, starBadge } from './wheel.js';
import { extras } from './extras.js';

const TOOL = 'xuanji-astro-minitool 0.1.0';
const app = document.getElementById('app');
const bar = document.getElementById('bar');
const S = { input: null, base: null, out: null, side: null, nodes: [], ans: {}, feel: [], feelSkip: false, feelLog: [], calib: null, ev: [], cal: null, rect: null, rt: null, id: null, tab: 'cover', nowY: new Date().getFullYear() };
let X_ = { out: null, x: null };
const X = () => (X_.out === S.out ? X_.x : (X_ = { out: S.out, x: extras(S.out) }).x);   // 盘面扩展：每张盘只算一次
// 用你的经历核一次：计分交给引擎（回答只在这台手机上）；身强身弱一律从 ST() 取，定下来的高于三种判法
const VOTE = () => (S.out.method.bazi && S.out.method.bazi.strength ? S.out.method.bazi.strength.vote : null);
const DM = () => (S.out.bazi.status === 'ok' ? S.out.bazi.bazi.pillars.day.gan : null);
const FS = () => { const v = VOTE(); return v && v.feel && v.feel.enough && S.feel.length && DM() ? window.XJ.feelScore(DM(), S.feel, v.feel) : null; };
// 定时辰（Skill 同一份打分脚本）：定在隔壁时辰（b）以后，整盘改用交界另一侧那张（S.rect.request），身强身弱也按新盘重判
const RECT_DONE = () => !!(S.rect && (S.rect.result === 'a' || S.rect.result === 'b'));
const EFF = () => (S.rect && S.rect.result === 'b' ? S.rect.request : S.input);
const HOUR = () => (RECT_DONE() ? S.rect.hours[S.rect.result] : null);
const rectSkip = () => (RECT_DONE() ? new Set([...S.rect.events.map((e) => e.year), ...S.rect.asked]) : null);
const nodesOf = (o) => D.pickNodes(o, 3, rectSkip());   // 定下来以后，过去节点不拿你说过、被问过的年份
function useRect(rec) {
  S.rect = (rec && rec.rect) || null;
  if (S.rect && S.rect.result === 'b') { S.base = S.out = window.XJ.compute(S.rect.request); S.side = null; }
  S.nodes = nodesOf(S.out);
}
const RC = () => { if (S.rect && S.rect.result !== 'uncertain') return null; try { return window.XJ.rect.candidate(S.base, S.input); } catch (e) { return null; } };
const HELD = () => { const l = S.feelLog.filter((x) => x.dm === DM()); return l.length ? l[l.length - 1] : null; };
// 身强身弱校正（10-10 起，8 道题＋大事，跟网站、Skill、Kimi 同一套）：定下来的高于老的核一核回答
const CAL = () => { const c = S.calib && S.out.method.bazi && S.out.method.bazi.calib; return c && c.result && c.result.status === '定案' ? c.result : null; };
const CAN_CAL = () => !!(S.out.method.bazi && S.out.method.bazi.calib && S.out.method.bazi.calib.ask);
const ST = () => (CAL() ? D.strength(S.out, null, null, S.base, CAL()) : D.strength(S.out, FS(), HELD(), S.base));
// 核一核（10-08 起，跟 Skill、Kimi 同一套）：题从引擎的 check 出（同一轮核身强身弱和派别），回答带着整盘重算，身强身弱和上桌的派别都由引擎按回答定
const CK = () => { const c = S.out.method.bazi && S.out.method.bazi.check; return c && c.enough ? c : null; };
const SCH = () => (S.out.method.bazi && S.out.method.bazi.school) || null;
const MUTE = () => { const s = SCH(); return !!(s && s.by === '默认' && s.check === '降置信'); };   // 三派都对不上：不标某年顺逆
const ANS = () => { const dm = S.base && S.base.bazi.status === 'ok' ? S.base.bazi.bazi.pillars.day.gan : null; return S.feel.filter((a) => a.dm === dm).map((a) => ({ year: a.year, pick: a.pick })); };
function loadFeel(rec) {
  S.feel = (rec && rec.feel) || store.feelOfDate(S.input.date, S.id) || []; S.feelSkip = !!(rec && rec.feelSkip);
  S.feelLog = (rec && Array.isArray(rec.feelLog) && rec.feelLog) || [];
  S.calib = (rec && rec.calib) || null; S.ev = (rec && Array.isArray(rec.events) && rec.events) || [];
  if (S.feel.length && !(rec && rec.feel)) store.setFeel(S.id, S.feel);
  settle();
}
// 定案（10-05 定）：身强身弱的定案是喜忌、大运、时间线的唯一输入。核出来的定案跟排盘引擎方向相反时，整盘带着定案重算（S.out），原盘留在 S.base；
// 出题按原盘（引擎保证），翻过来以后再核题目不变。加问、挂起时沿用上一次的定案，证据够了才改判；每次改判记一条（只在这台手机，不展示）。
// 用户先看到的那一边：几种判法的结论有方向就是结论（没核过时整盘已按它排，10-06 定），否则是引擎的底子（中和的喜忌底子同身强）
const shownSide = (o) => {
  const v = o.method.bazi && o.method.bazi.strength && o.method.bazi.strength.vote, s = v && v.verdict.side;
  if (s === '强' || s === '弱') return s;
  const lv = o.bazi.status === 'ok' ? o.bazi.bazi.strength || '' : ''; return /强|旺/.test(lv) ? '强' : /弱|衰/.test(lv) ? '弱' : '强';
};
function settle() {
  // 身强身弱校正定过的（10-10 起）：整盘带着它交给引擎重算，老的核一核回答不再参与
  if (S.calib) {
    const key = JSON.stringify(['calib', S.calib, S.base && S.base.input]);
    if (key === S.ansKey) return;
    S.ansKey = key; S.out = window.XJ.compute({ ...EFF(), calib: S.calib }); S.side = null; S.nodes = nodesOf(S.out); return;
  }
  const fs = FS(), last = HELD();
  if (fs && fs.status === '定案' && (!last || last.side !== fs.decided)) {
    S.feelLog = [...S.feelLog, { t: Date.now(), dm: DM(), side: fs.decided, from: last ? last.side : shownSide(S.base), asked: fs.asked }];
    store.setFeelLog(S.id, S.feelLog);
  }
  // 带着回答整盘重算：身强身弱、派别由引擎按回答定（同服务端）；加问、挂起时身强身弱沿用上一次的定案
  const cur = HELD(), want = cur && cur.side !== shownSide(S.base) ? cur.side : null, ans = ANS();
  const hold = cur && !(fs && fs.status === '定案') ? cur.side : null, key = JSON.stringify([ans, hold, S.base && S.base.input]);
  if (key === S.ansKey) return;
  S.ansKey = key;
  S.out = ans.length ? window.XJ.compute({ ...EFF(), answers: ans, ...(hold ? { strength: hold } : {}) }) : want ? window.XJ.compute({ ...EFF(), strength: want }) : S.base;
  S.side = want; S.nodes = nodesOf(S.out);
}
const TABS = [['cover', '封面'], ['verify', '验证'], ['chart', '星盘'], ['bazi', '八字'], ['time', '时间线']];
const TIER = [['顺风', '#c40018', '#fff'], ['偏顺', '#fbe9eb', '#9a0013'], ['平稳', '#efeeec', '#555'], ['偏紧', '#dcd9d5', '#2a2a2a'], ['逆风', '#111', '#fff']];   // 档位同报告，颜色红白黑
const EL = { 木: '#3f9b6b', 火: '#e0623f', 土: '#c99636', 金: '#8e97a8', 水: '#4a7fd6' };   // 同报告

// ── 引擎：页面先出首页，引擎在后台按网站同样的顺序加载（async=false 保证按序执行） ──
const ENGINE = ['engine/astronomy.js', 'engine/asteroid-ephem.js', 'engine/asteroid-ephem-ext.js', 'engine/natal.js', 'engine/engine_mbti_core.js', 'engine/cities.js', 'engine/tianji_personal.js', 'engine/xj_ephem.js', 'engine/xj_engine.js'];
// 单文件预览版（scripts/single_html.py）把引擎直接内联在前面，这时 window.XJ 已经有了，不再加载
const engineReady = (window.XJ ? Promise.resolve() : new Promise((ok, fail) => {
  let left = ENGINE.length;
  for (const src of ENGINE) {
    const el = document.createElement('script'); el.src = './' + src; el.async = false;
    el.addEventListener('load', () => { if (--left === 0) ok(); });
    el.addEventListener('error', () => fail(new Error('引擎文件没加载上：' + src)));
    document.body.appendChild(el);
  }
})).then(() => { if (window.XJ_EPHEM) { window.XJ.loadEphem(window.XJ_EPHEM); window.XJ_EPHEM = null; } });

// ── 通用小件 ──
function setBar({ back, next, label, disabled, pill } = {}) {
  bar.replaceChildren();
  if (back) bar.appendChild(h('button', { class: 'b-back', type: 'button', 'aria-label': '返回', on: { click: back } }, h('i')));
  if (pill) bar.appendChild(h('button', { class: 'b-pill', type: 'button', text: pill, on: { click: goBack } }));
  if (next) bar.appendChild(h('button', { class: 'b-next', type: 'button', disabled: !!disabled, on: { click: next } }, label));
}
function show(view, ...args) { closeSheet(true); const el = VIEWS[view](...args); app.replaceChildren(el); app.dataset.v = view; window.scrollTo(0, 0); }
// 页面历史：每往里走一层记一笔 history。小红书顶栏的「‹」如果按浏览器规矩回退，和我们自己的返回走同一条路；
// 宿主不认 history（回退没反应）时，我们的返回 350ms 后自己切页，不会卡住。
const NAV = [['home', []]]; let depth = 0;
const hist = (fn, d) => { try { history[fn]({ xj: d }, ''); } catch (e) { /* 宿主禁了也照常切页 */ } };
function go(view, ...args) { depth += 1; NAV.length = depth; NAV.push([view, args]); hist('pushState', depth); show(view, ...args); }
function swap(view, ...args) { NAV[depth] = [view, args]; hist('replaceState', depth); show(view, ...args); }   // 原地换页（正在排盘→结果／失败），不多记一笔
function unwind(to) {
  if (depth <= to) return swap(...NAV[to]);
  let popped = false; const mark = () => { popped = true; };
  window.addEventListener('popstate', mark, { once: true });
  try { history.go(to - depth); } catch (e) { /* 落到下面的兜底 */ }
  setTimeout(() => { window.removeEventListener('popstate', mark); if (!popped) { depth = to; NAV.length = depth + 1; show(...NAV[depth]); } }, 350);
}
const goBack = () => unwind(Math.max(0, depth - 1));
const goHome = () => unwind(0);
window.addEventListener('popstate', (e) => {
  const d = e.state && typeof e.state.xj === 'number' && NAV[e.state.xj] ? e.state.xj : 0;
  depth = d; const [v, a] = NAV[d]; show(v, ...(v === 'busy' ? [] : a));
});
const h2 = (text, lead) => [h('h2', { class: 'h2', text }), lead ? h('p', { class: 'lead', text: lead }) : null];
const divd = () => h('div', { class: 'divd' }, h('i'), h('b'), h('i'));
// 一行键值；带 onTap 的整行可点，右边一个 ›
const rows = (list) => h('div', { class: 'kv' }, list.filter(Boolean).map(([k, v, onTap]) => onTap
  ? h('button', { class: 'r tap', type: 'button', on: { click: onTap } }, h('span', { text: k }), val(v), h('i', { class: 'chev', text: '›' }))
  : h('div', { class: 'r' }, h('span', { text: k }), val(v), h('i'))));
const val = (v) => (typeof v === 'string' ? h('b', { text: v }) : h('b', {}, v));   // 值可以是字，也可以是「字＋小字」
// 单文件预览版把图片内联成 window.XJ_IMG（scripts/single_html.py）；小工具包里走 img/ 下的文件
const imgSrc = (name) => (window.XJ_IMG && window.XJ_IMG[name]) || `./img/${name}.png`;
const img = (name, cls) => h('img', { class: cls, src: imgSrc(name), alt: '执天玄玑' });
const col = (...kids) => h('div', { class: 'col' }, kids);
// 恒星图例用的小四芒星（不用 ✧ 字符：iPhone 上会显示成方块）
const starIcon = () => svgEl('svg', { viewBox: '-5 -5 10 10', width: 10, height: 10, style: 'vertical-align:-1px;margin-right:4px' }, svgEl('polygon', { points: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const a = k * Math.PI / 4, r = k % 2 ? 1.4 : 4.6; return (r * Math.cos(a)).toFixed(2) + ',' + (-r * Math.sin(a)).toFixed(2); }).join(' '), fill: '#8a8580' }));
const ANS_CLS = { obvious: 'f1', partial: 'f2', miss: 'f3' };
// 「按需展开」：标题＋一行说明＋右边「展开 +」，点了在下面就地展开（内容点开时才生成）
function acc(title, sub, build, open = false) {
  const box = h('div', { class: 'acc' + (open ? ' open' : '') }), body = h('div', { class: 'acc-b' });
  let built = false;
  const toggle = () => { if (!built) { body.append(build()); built = true; } box.classList.toggle('open'); };
  box.append(h('button', { class: 'acc-h', type: 'button', on: { click: toggle } }, h('div', {}, h('b', { text: title }), sub ? h('span', { text: sub }) : null), h('em', {}, h('span', { class: 'acc-t' }), h('i'))), body);
  if (open) { body.append(build()); built = true; }
  return box;
}

// ── 明细抽屉：可以一层层点进去，左上「返回」回上一层 ──
let sheetStack = [];
function openSheet(title, build) { sheetStack.push({ title, build }); paintSheet(); }
function paintSheet() {
  let mask = document.querySelector('.sheet-mask'), sh = document.querySelector('.sheet');
  if (!mask) {
    mask = h('div', { class: 'sheet-mask', on: { click: () => closeSheet() } });
    sh = h('div', { class: 'sheet', role: 'dialog' });
    document.body.append(mask, sh);
    requestAnimationFrame(() => { mask.classList.add('on'); sh.classList.add('on'); });
  }
  const top = sheetStack[sheetStack.length - 1];
  sh.replaceChildren(
    h('div', { class: 'sheet-hd' }, h('i', { class: 'grab' }),
      sheetStack.length > 1 ? h('button', { type: 'button', text: '‹ 返回', on: { click: () => { sheetStack.pop(); paintSheet(); } } }) : null,
      h('h3', { text: top.title }),
      h('button', { type: 'button', text: '收起', on: { click: () => closeSheet() } })),
    h('div', { class: 'sheet-bd' }, top.build(),
      h('button', { class: 'sheet-cta', type: 'button', on: { click: () => go('share') } },
        '这一项如何作用于你的处境？', h('b', { text: '交由 Xuanji Skill 继续解读，或申请创始人复核 ›' }))));
  sh.querySelector('.sheet-bd').scrollTop = 0;
}
function closeSheet(now) {
  sheetStack = [];
  const mask = document.querySelector('.sheet-mask'), sh = document.querySelector('.sheet');
  if (!mask) return;
  if (now) { mask.remove(); sh.remove(); return; }
  mask.classList.remove('on'); sh.classList.remove('on');
  setTimeout(() => { mask.remove(); sh.remove(); }, 260);
}

// ── 首页 ──
function home() {
  const recent = store.list();
  let manage = false;
  const list = h('div', { class: 'col' });
  const paint = () => {
    list.replaceChildren(...store.list().map((r) => {
      const b = r.input, done = Object.keys(r.answers || {}).length;
      return h('div', { class: 'recent' },
        h('button', { class: 'recent-main', type: 'button', on: { click: () => (manage ? null : reopen(r.id)) } },
          h('div', { class: 'r-when', text: `${b.date} · ${b.time || '时间不详'}` }),
          h('div', { class: 'r-where', text: r.place || b.city }),
          h('div', { class: 'r-tags', text: [r.tags && r.tags.base, r.tags && r.tags.asc && `上升${r.tags.asc}`, done ? `已验证 ${done} 个节点` : null].filter(Boolean).join(' · ') || ' ' })),
        manage ? h('button', { class: 'r-del', type: 'button', text: '删除', on: { click: () => { store.remove(r.id); paint(); if (!store.list().length) show('home'); } } }) : null);
    }));
  };
  paint();
  setBar({});
  return h('section', { class: 'v home' },
    h('div', { class: 'hero' }, h('div', { class: 'icon' }, img('mark', '')),
      h('div', { class: 'brandline' }, h('i'), 'XUANJI OBSERVATORY', h('i')),
      h('h1', { class: 'brand', text: '执天玄玑' }),
      h('p', { class: 'tagline', text: '观天之道，执天之行' }),
      h('p', { class: 'tagsrc', text: '——《黄帝阴符经》' }),
      h('p', { class: 'tagsub', text: '以生辰为钥，启一页只属于你的天象' })),
    h('button', { class: 'cta', type: 'button', text: '开始排盘', on: { click: () => go('form') } }),
    recent.length ? h('div', { class: 'recent-box' },
      h('div', { class: 'row' }, h('div', {}, h('div', { class: 'h3', text: '最近的观测' }), h('div', { class: 'mono small faint', text: `${recent.length} / ${store.MAX} · LOCAL ARCHIVE` })),
        h('button', { class: 'ghost', type: 'button', text: '管理', on: { click: (e) => { manage = !manage; e.currentTarget.textContent = manage ? '完成' : '管理'; paint(); } } })),
      list) : null);
}

// ── 出生信息 ──
function form(prefill) {
  const f = { y: 1995, mo: null, d: null, hh: null, mi: null, noTime: false, prov: null, city: null, dist: null, gender: null, src: null, pre: null, ...prefill };
  const years = []; for (let y = new Date().getFullYear(); y >= 1930; y--) years.push([y, `${y} 年`]);
  const dim = () => (f.mo ? new Date(f.y, f.mo, 0).getDate() : 31);
  const placeBox = h('div', { class: 'place' }), timeRow = h('div', { class: 'triple' }), srcBox = h('div', { class: 'col tight' }), dayBox = h('span', {});
  const valid = () => f.y && f.mo && f.d && (f.noTime || (f.hh != null && f.mi != null)) && f.prov && f.city && f.gender;
  const refresh = () => setBar({ next: submit, label: '排盘', disabled: !valid() });
  const paintDays = () => { if (f.d > dim()) f.d = null; dayBox.replaceChildren(select(Array.from({ length: dim() }, (_, i) => [i + 1, `${i + 1} 日`]), f.d, (v) => { f.d = +v; refresh(); }, '日')); };
  const paintTime = () => {
    timeRow.replaceChildren(
      select(Array.from({ length: 24 }, (_, i) => [i, `${pad2(i)} 时`]), f.hh, (v) => { f.hh = +v; refresh(); }, '时'),
      select(Array.from({ length: 60 }, (_, i) => [i, `${pad2(i)} 分`]), f.mi, (v) => { f.mi = +v; refresh(); }, '分'),
      h('button', { type: 'button', class: 'chip' + (f.noTime ? ' on' : ''), text: '不知道', on: { click: () => { f.noTime = !f.noTime; paintTime(); paintSrc(); refresh(); } } }));
    for (const el of timeRow.querySelectorAll('select')) el.disabled = f.noTime;
  };
  const paintSrc = () => {
    srcBox.replaceChildren(...(f.noTime ? [] : [
      h('label', { class: 'lab', text: '时间从哪来' }), chips(Object.entries(D.SRC_LABEL), f.src, (v) => { f.src = v; }),
      h('label', { class: 'lab', text: '准到什么程度' }), chips(Object.entries(D.PRE_LABEL), f.pre, (v) => { f.pre = v; }),
    ]));
  };
  const paintPlace = () => {
    const C = window.CITY_DATA;
    if (!C) { placeBox.replaceChildren(h('div', { class: 'faint small', text: '城市表加载中…' })); engineReady.then(paintPlace); return; }
    const provs = Object.keys(C), cities = f.prov ? Object.keys(C[f.prov]) : [], dists = f.prov && f.city ? Object.keys(C[f.prov][f.city]) : [];
    placeBox.replaceChildren(
      select(provs, f.prov, (v) => { f.prov = v; f.city = null; f.dist = null; paintPlace(); refresh(); }, '省'),
      select(cities, f.city, (v) => { f.city = v; f.dist = null; paintPlace(); refresh(); }, '市'),
      select(dists, f.dist, (v) => { f.dist = v; }, '区县'));
  };
  function submit() {
    if (!valid()) return;
    const city = [f.prov, f.city !== f.prov ? f.city : '', f.dist || ''].join('');
    run({ date: `${f.y}-${pad2(f.mo)}-${pad2(f.d)}`, time: f.noTime ? null : `${pad2(f.hh)}:${pad2(f.mi)}`, city, gender: f.gender, time_source: f.noTime ? 'unknown' : f.src || 'unknown', time_precision: f.noTime ? 'unknown' : f.pre || 'unknown' }, f);
  }
  paintDays(); paintTime(); paintSrc(); paintPlace(); refresh();
  return h('section', { class: 'v' },
    h('div', { class: 'eyebrow', text: 'BIRTH DATA · 出生时空' }), h('h2', { class: 'h1', text: '你来到世间的那一刻' }), divd(),
    h('div', { class: 'card fields' },
      h('label', { class: 'lab', text: '出生日期' }),
      h('div', { class: 'triple' }, select(years, f.y, (v) => { f.y = +v; paintDays(); refresh(); }), select(Array.from({ length: 12 }, (_, i) => [i + 1, `${i + 1} 月`]), f.mo, (v) => { f.mo = +v; paintDays(); refresh(); }, '月'), dayBox),
      h('label', { class: 'lab', text: '出生时间' }), timeRow,
      h('label', { class: 'lab', text: '出生地' }), placeBox,
      h('label', { class: 'lab', text: '性别' }), chips([['female', '女'], ['male', '男']], f.gender, (v) => { f.gender = v; refresh(); }),
      srcBox),
    h('p', { class: 'privacy', text: '全部计算在本机完成，出生信息不离开这台设备' }));
}

// ── 计算 ──
function busy() { setBar({}); return h('section', { class: 'v busy' }, h('div', { class: 'icon' }, img('mark', '')), h('div', { class: 'busy-t', text: '正在排盘' })); }
async function run(input, formState) {
  NAV[depth] = ['form', [formState]];   // 从结果页退回来，出生信息还在
  go('busy'); const tok = depth;
  const still = () => depth === tok && NAV[depth][0] === 'busy';
  await new Promise((r) => setTimeout(r, 60));   // 先让「正在排盘」画出来，再开始算（算的时候主线程是忙的）
  try {
    await engineReady; await new Promise((r) => setTimeout(r, 30));
    const out = window.XJ.compute(input);
    S.input = input; S.base = S.out = out; S.side = null; S.id = D.chartId(input); S.nodes = D.pickNodes(out); S.tab = 'cover';
    const old = store.get(S.id); S.ans = (old && old.answers) || {};
    const w = out.method.west;
    store.put({ id: S.id, input, form: formState, place: out.birth.place ? out.birth.place.name : input.city, answers: S.ans, at: Date.now(),
      tags: { base: out.astro_mbti && out.astro_mbti.base_type, asc: w && w.big3 && w.big3.asc ? w.big3.asc.sign : null } });
    useRect(store.get(S.id)); loadFeel(store.get(S.id));
    if (still()) swap('result');
  } catch (e) { if (still()) swap('fail', e, formState); }
}
function reopen(id) {
  const r = store.get(id); if (!r) return;
  go('busy'); const tok = depth;
  const still = () => depth === tok && NAV[depth][0] === 'busy';
  setTimeout(async () => {
    try {
      await engineReady; S.input = r.input; S.base = S.out = window.XJ.compute(r.input); S.side = null; S.id = id; S.nodes = D.pickNodes(S.out); S.ans = r.answers || {}; useRect(r); loadFeel(r); S.tab = 'cover';
      if (still()) swap('result');
    } catch (e) { if (still()) swap('fail', e, r.form); }
  }, 60);
}
function fail(e, formState) {
  setBar({ next: () => (NAV[depth - 1] && NAV[depth - 1][0] === 'form' ? goBack() : swap('form', formState)), label: '改一下再排' });
  const msg = e && e.code === 'LOCATION_NOT_FOUND' ? '这个地方没找到，换成上一级城市试试' : e && e.message ? e.message : String(e);
  return h('section', { class: 'v' }, h('h2', { class: 'h1', text: '这张盘没排出来' }), h('p', { class: 'lead', text: msg }));
}

// ── 结果页：顶部出生信息＋五个标签 ──
function result() {
  setBar({});
  const o = S.out, r = D.reliability(o, RECT_DONE()), b = o.birth, w = o.method.west;
  const where = r.place ? shortPlace(r.place.name) : b.city;
  const body = h('div', { class: 'tabbody' });
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const paint = () => {
    tabs.replaceChildren(...TABS.map(([k, t]) => h('button', { class: 'tab' + (S.tab === k ? ' on' : ''), type: 'button', role: 'tab', text: t, on: { click: () => { S.tab = k; paint(); window.scrollTo(0, Math.min(window.scrollY, top.offsetTop)); } } })));
    body.replaceChildren(TAB[S.tab](), endLinks());
  };
  const top = h('div', { class: 'rhead' },
    // 定时辰定下来以后只说定在哪个时辰，不报几点几分（交界另一侧那个时间只是代表）
    h('div', { class: 'rh-t', text: RECT_DONE() ? `${where} · ${S.input.date} · ${HOUR()}` : `${where} · ${b.date}${b.time ? ' ' + b.time : ''}` }),
    RECT_DONE() ? h('div', { class: 'rh-s' }, w && w.big3 && w.big3.asc ? `上升 ${w.big3.asc.sign}座 · ` : '', '时辰 你亲手定的 · 可信度 ', h('b', { class: 'verdict-ok', text: '已校准' }))
      : h('div', { class: 'rh-s' }, w && w.big3 && w.big3.asc ? `上升 ${w.big3.asc.sign}座 · ` : '', `有效精度 ${b.time ? PREC[b.time_precision] || '未标注' : '时辰不详'} · 可信度 `, h('b', { class: 'verdict-' + r.level, text: { ok: '可放心使用', sensitive: '边界敏感', check: '建议校时' }[r.level] })));
  paint();
  return h('section', { class: 'v result' }, top, tabs, body);
}
const goTab = (k) => { S.tab = k; show('result'); };
// 「浙江省杭州市西湖区」→「浙江 · 杭州 · 西湖区」（省、市去掉后缀，区县照写）
function shortPlace(n) {
  const out = []; let rest = n;
  const pm = rest.match(/^(.+?)(省|自治区|特别行政区)/); if (pm) { out.push(pm[1].replace(/(壮族|回族|维吾尔)$/, '')); rest = rest.slice(pm[0].length); }
  const cm = rest.match(/^(.+?)(市|自治州|地区|盟)/); if (cm) { out.push(cm[1]); rest = rest.slice(cm[0].length); }
  if (rest) out.push(rest);
  return out.join(' · ');
}
const PREC = { minute: '±分钟级', within_15min: '±15 分钟', within_1h: '±1 小时', unknown: '未标注' };
function endLinks() {
  return h('div', { class: 'endlinks' },
    h('button', { class: 'cta dark', type: 'button', text: '保存、分享与继续解读', on: { click: () => go('share') } }),
    h('button', { class: 'linkrow', type: 'button', on: { click: () => go('method') } }, h('div', {}, h('b', { text: '方法与边界' }), h('span', { text: '计算体系、精度与适用范围' })), h('i', { class: 'chev', text: '→' })),
    h('button', { class: 'linkrow tohome', type: 'button', on: { click: goHome } }, h('div', {}, h('b', { text: '回到首页' }), h('span', { text: '再排一张，或查看最近的观测' })), h('i', { class: 'chev', text: '→' })));
}

// ── 标签一：封面 ──
// 封面卡：大标题（出厂底色名／日主意象）＋这张盘自己的星图徽章＋四格签名＋出生信息。分享页的分享卡也用这一张。
function coverCard() {
  const o = S.out, p = o.method.persona, mb = o.method.bazi, w = o.method.west, d = o.western.data, stg = D.stage(o, S.nowY), r = D.reliability(o), b = o.birth;
  // 标题：日主意象（生辰页词库原句），第二行是它的意象句；八字没排出来时退回出厂底色名
  const t1 = mb ? mb.day_master.image : p ? p.base.name : '玄玑底图', t2 = mb ? mb.day_master.image_line : p ? p.base.type : '';
  const b3 = w && w.big3, luck = stg && stg.luck;
  const caps = [b3 && `${b3.asc.sign}上升 · 外在形态`, b3 && `太阳${b3.sun.sign} · 力量第 ${b3.sun.power_rank}`, b3 && `月亮${b3.moon.sign} · 第 ${b3.moon.house} 宫`, luck && `${luck.gan_zhi}大运 · 至 ${luck.end_year}`].filter(Boolean);
  const emblem = d && w ? starBadge(d).el : h('div', { class: 'sigil-empty' }, img('mark', ''));
  const cells = [['底色', p ? `${p.base.type}` : '—'], ['日主', mb ? `${mb.day_master.gan}${mb.day_master.element}` : '—'], ['上升', b3 ? b3.asc.sign : '不详'], ['大运', luck ? luck.gan_zhi : '—']];
  return h('div', { class: 'covercard' }, RECT_DONE() ? img('mark', 'rt-mark md rt-cseal') : null,   // 时辰亲手定过：卡上盖一枚标识（10-04 确认图 14）
    h('div', { class: 'cc-top' }, h('span', { text: 'XUANJI OBSERVATION' }), h('span', { class: 'mono', text: S.id })),
    h('div', { class: 'cc-t1', text: t1 }), t2 ? h('div', { class: 'cc-t2', text: t2 }) : null,
    h('div', { class: 'cc-mid' }, h('div', { class: 'cc-caps' }, caps.map((x) => h('div', { text: x }))), emblem),
    h('div', { class: 'cc-cells' }, cells.map(([k, v]) => h('div', {}, h('span', { text: k }), h('b', { text: v })))),
    h('div', { class: 'cc-foot' }, h('span', { class: 'mono', text: `${RECT_DONE() ? `${S.input.date} · ${HOUR()}（亲定）` : `${b.date}${b.time ? ' ' + b.time : ''}`} · ${r.place ? `${r.place.lat.toFixed(1)}°N ${r.place.lon.toFixed(1)}°E` : b.city}` }), h('b', { text: '执天玄玑' })));
}
function coverTab() {
  const o = S.out, sn = D.seen(o, S.nowY), p = o.method.persona;
  return col(
    coverCard(),
    acc('这枚徽章如何生成', '星芒的长短与落点只属于这张盘', () => h('div', { class: 'why' },
      h('p', {}, h('b', { text: '四根长芒：' }), '上火、左土、下风、右水，长度对应十大行星在该元素星座中的数量。'),
      h('p', {}, h('b', { text: '外圈刻度：' }), '每格 5°，黑点为十大行星与凯龙在出生时刻的黄经位置，上升点置于左侧。'),
      h('p', {}, h('b', { text: '中心红点：' }), '执天玄玑的观测原点。'),
      h('p', { text: '计算不含随机数：同一张盘永远生成同一枚徽章，出生时刻不同，芒长与落点随之改变。' }))),
    sn.head ? h('p', { class: 'seen', text: sn.head.line }) : null,
    sn.head ? h('div', { class: 'seen-src' }, h('span', { class: 'badge differ', text: sn.head.src })) : null,
    h('div', { class: 'card' }, h('div', { class: 'lb', text: '封面短章' }), h('div', { class: 'brief' }, sn.items.map((x) => h('div', { class: 'bi' },
      h('div', { class: 'row' }, h('span', { class: 'bk', text: x.k }), h('span', { class: 'badge agree', text: x.src })),
      h('p', { class: 'bt', text: x.text }), x.sub ? h('p', { class: 'bs', text: x.sub }) : null))),
      acc('这一页怎么来的', '每句话的出处', () => h('div', { class: 'why' },
        sn.head ? h('p', {}, h('b', { text: '大字那句：' }), `星盘人格出厂底色 ${p.base.type} ${p.base.name} 的人格句，同一张盘永远是同一句。`) : null,
        h('p', {}, h('b', { text: '你是什么结构：' }), '八字日主的意象和格局花名，出自玄玑生辰页同一套词库。'),
        h('p', {}, h('b', { text: '你最强的能力：' }), '出厂底色的主导功能，加上星盘里力量排第一的星。'),
        h('p', {}, h('b', { text: '现在最该注意什么：' }), '今年八字流年和星盘行运亮灯的领域，两套同时亮的排在前面。')))),
    progressCard());
}
function progressCard() {
  const o = S.out, r = D.reliability(o), st = ST(), t = D.tally(S.nodes, S.ans), stg = D.stage(o, S.nowY);
  const nxt = stg && stg.years.flatMap((y) => y.items.filter((x) => x.mirror).map((x) => `${y.year} 年${x.domain}窗口`))[0];
  const unsure = S.rect && S.rect.result === 'uncertain';
  const items = [
    RECT_DONE() ? ['ok', '已确认', `出生时辰：${HOUR()}（你亲手定的）`, 'verify'] : unsure ? ['q', '待确认', `出生时辰在${S.rect.hours.a}和${S.rect.hours.b}之间`, 'verify']
      : r.solid ? ['ok', '已确认', `出生时间来源：${r.source}`, 'verify'] : ['q', '待确认', `出生时间来源：${r.source}`, 'verify'],
    st ? (st.kind || st.side === '待定' ? ['q', '待确认', `身强身弱：${st.verdict}`, 'verify'] : ['ok', '已判定', `身强身弱：${st.verdict}`, 'verify']) : null,
    S.nodes.length ? (t.open ? ['w', '待核对', `过去节点：${S.nodes.length - t.open} / ${S.nodes.length}`, 'verify'] : ['ok', '已验证', `过去节点：${S.nodes.length} 个`, 'verify']) : null,
    RECT_DONE() ? ['ok', '已确认', `时辰交界：定在${HOUR()}`, 'verify'] : r.level !== 'ok' ? ['q', '待确认', '出生时间边界', 'verify'] : null,
    nxt ? ['w', '待观察', nxt, 'time'] : null,
  ].filter(Boolean);
  return h('div', { class: 'card prog' }, h('div', { class: 'lb', text: '玄玑已经认识你到这里' }),
    h('ul', {}, items.map(([c, k, v, tab]) => h('li', { class: 'st-' + c }, h('button', { type: 'button', on: { click: () => goTab(tab) } }, h('span', { text: k }), h('em', { text: v }), h('i', { class: 'chev', text: '›' }))))));
}

// ── 标签二：验证（时间可信度／身强身弱／过去节点）──
const diffMin = (a, b) => { const [ha, ma] = a.split(':').map(Number), [hb, mb] = b.split(':').map(Number); let d = hb * 60 + mb - (ha * 60 + ma); if (d > 720) d -= 1440; if (d < -720) d += 1440; return d === 0 ? '一致' : `${d > 0 ? '晚' : '早'} ${Math.abs(d)} 分钟`; };
function verifyTab() {
  const o = S.out, r = D.reliability(o, RECT_DONE()), st = ST(), b = o.birth;
  const out = [];
  out.push(...h2('出生时间可信度', RECT_DONE() ? '你已经亲手把时辰定下来了。' : '先校验出生时间对盘面的影响范围，再进入解读。'),
    RECT_DONE() ? rectCard(r) : h('div', { class: 'card' }, h('div', { class: 'vt verdict-' + r.level, text: r.head }),
      rows([['钟表时间', r.clock || '不详'], r.clock ? ['真太阳时', r.solar ? `${r.solar}（${diffMin(r.clock, r.solar)}）` : '—'] : null, r.clock ? ['时间来源', r.source] : null, r.clock ? ['精度', r.precision] : null]),
      r.risks.length ? h('div', { class: 'timenote' + (r.level === 'ok' ? '' : ' warn') }, r.risks.map((x) => h('div', { text: x.text }))) : h('div', { class: 'timenote', text: '时辰、上升、天顶都离交界有一段距离，宫头上也没有压着的星。' }),
      rectEntry()),
    acc('查看依据', '真太阳时、时辰交界、上升换座、宫头', () => h('div', { class: 'why' },
      r.risks.filter((x) => x.why).map((x) => h('p', {}, h('b', { text: x.text }), h('br'), x.why)),
      r.solar ? h('p', { text: '八字按出生地的真太阳时排时柱：钟表时间按经度和当天的均时差校正。星盘按钟表时间排，1986–1991 年的夏令时已经扣掉。' }) : null,
      h('p', { text: '离交界越近，出生时间差几分钟就越可能改掉结论；所以玄玑先说清楚这张盘能用到哪一步。' }),
      RECT_DONE() ? h('p', { text: '时辰是你用经历定下来的。只定到时辰，不报几点几分；上升和宫位要精确到分钟，定时辰管不到。' }) : null)));
  if (st) out.push(h('div', { class: 'gap' }), ...h2('身强身弱', st.calib ? `按你答的 ${st.calib.used.traits} 道题${st.calib.used.events ? `和说的 ${st.calib.used.events} 件大事` : ''}，定在身${st.side}。` : st.mine ? (st.hold ? `结论先按你上次核定的身${st.side}。` : `你核的流年里，选的都是身${st.side}的人才会遇到的样子。`) : '三种判法各投一票，只给起点；做个身强身弱校正才算定。西盘不进身强身弱。'),
    strengthCard(st),
    acc('为什么不是数五行？', '月令、通根、得势和喜忌', () => h('div', { class: 'why' },
      h('p', { text: '身强身弱看的是日主有没有得到支撑，不是哪种五行个数多。三路判法各看一个侧面：' }),
      st.basis.map((x) => h('p', { class: 'li', text: x })),
      st.votes.filter((v) => v.why).map((v) => h('p', { class: 'li' }, h('b', { text: v.school + '：' }), v.why)),
      st.favorable.length ? h('p', {}, h('b', { text: '喜用：' }), st.favorable.join(' '), st.unfavorable.length ? `　忌：${st.unfavorable.join(' ')}` : '') : null,
      st.kind ? h('p', { text: '几路判法说法不一样时，玄玑不硬判，要用过去发生过的事继续确认。' }) : null)));
  out.push(h('div', { class: 'gap' }), ...nodesBlock());
  return col(...out);
}
// ── 身强身弱卡：三种判法＋身强身弱校正（10-10 起 8 道题＋大事；硬分歧主动请你校正；其余结论照给，有疑问再校正；定下来以后显示你亲手定的）──
const FEEL_LINE = '这是你这张盘的结构，不会随年份变。';
const TURNED = '你后来核的回答攒够了证据，结论修正了，之前的时间线按新结论重排。';   // 方向翻了必须明示（10-05 定），不静默换结论
const LATER = '等经历再多一些，随时可以回来核。';
const feelPicks = () => { const m = new Map(); for (const a of S.feel) if (a.dm === DM()) m.set(a.year, a.pick); return m; };
const feelItem = (y) => { const f = VOTE().feel; return [...f.first_ask, ...f.extra].find((x) => x.year === y) || window.XJ.feelItem(DM(), y, null, +S.out.birth.date.slice(0, 4)); };
function strengthCard(st) {
  const voteRows = st.votes.map((v) => [v.school, v.level, v.why ? () => openSheet(v.school, () => h('div', { class: 'card' }, h('p', { text: v.why }))) : null]);
  const again = (text) => h('button', { class: 'fe-again', type: 'button', text, on: { click: startCal } });
  if (st.calib) {   // 身强身弱校正定下来的（10-10 起）：结果卡照网站四格
    return h('div', { class: 'card' },
      h('div', { class: 'row' }, h('div', {}, h('div', { class: 'lb', text: '玄玑结论 · 你亲手定的' }), h('div', { class: 'type', text: st.calib.type })), img('mark', 'fe-mark')),
      rows(voteRows.concat([['你的校正', `身${st.side}（定案）`]])),
      st.calib.flip ? h('p', { class: 'cal-flip', text: st.calib.flip }) : null,
      h('div', { class: 'cal-g4' }, st.calib.cards.map((c) => h('div', {}, h('b', { text: c.title }), h('p', { text: c.text })))),
      st.flip ? h('div', { class: 'kv fe-chg' }, h('div', { class: 'r' }, h('span', { text: '喜用' }), h('b', {}, h('s', { text: st.flip.favorable.join('') }), st.favorable.join(''))), h('div', { class: 'r' }, h('span', { text: '忌' }), h('b', {}, h('s', { text: st.flip.unfavorable.join('') }), st.unfavorable.join('')))) : null,
      h('p', { class: 'fe-line', text: st.calib.say }), again('重新校正 ›'));
  }
  if (st.mine) {
    const holdNote = st.hold === '加问' ? `这次的回答跟上次有出入，再看一年就能定；结论先按上次定的身${st.side}。` : st.hold === '挂起' ? `这次的回答跟上次有出入，两种读法拉不开；结论先按上次定的身${st.side}，可以把盘和回答交给创始人人工复核。` : null;
    return h('div', { class: 'card' },
      h('div', { class: 'row' }, h('div', {}, h('div', { class: 'lb', text: '玄玑结论 · 你亲手定的' }), h('div', { class: 'type', text: st.verdict })), img('mark', 'fe-mark')),
      rows(voteRows.concat([['你的体感', `身${st.side}（定案）`]])),
      [...feelPicks()].sort((a, b) => b[0] - a[0]).map(([y, pick]) => { const it = feelItem(y);
        return h('div', { class: 'fe-yr' }, h('div', {}, h('b', { text: String(y) }), it.gan_zhi, h('span', { text: it.head + (it.focus && it.focus.length ? ` · 那年动的是${it.focus.join('、')}` : '') })),
          h('p', { text: '你选了：' + (it.readings[pick] || (pick === '都沾' ? '两种都沾一点（不计）' : '记不清（不计）')) }),
          it.readings[pick] ? h('i', { text: `按身${pick === '强' ? '弱' : '强'}来读，这一年会是：${it.readings[pick === '强' ? '弱' : '强']}` }) : null); }),
      st.flip ? h('div', { class: 'kv fe-chg' }, h('div', { class: 'r' }, h('span', { text: '喜用' }), h('b', {}, h('s', { text: st.flip.favorable.join('') }), st.favorable.join(''))), h('div', { class: 'r' }, h('span', { text: '忌' }), h('b', {}, h('s', { text: st.flip.unfavorable.join('') }), st.unfavorable.join('')))) : null,
      holdNote ? h('div', { class: 'timenote' + (st.hold === '挂起' ? ' warn' : ''), text: holdNote }) : null,
      st.turned && !st.hold ? h('div', { class: 'timenote', text: TURNED }) : null,
      h('p', { class: 'fe-line', text: FEEL_LINE }), CAN_CAL() ? again('换成新的校正：8 道小题 ›') : null);
  }
  const fs = st.fs, card = h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', {}, h('div', { class: 'lb', text: '玄玑结论' }), h('div', { class: 'type', text: st.verdict })), h('span', { class: 'badge ' + (st.kind ? 'warn' : 'agree'), text: st.agree })), rows(voteRows));
  if (S.calNone && CAN_CAL()) card.append(h('div', { class: 'timenote', text: '你上次校正的答案，两边差不太多，先保持原来的看法；多填几件大事，再看一次。' }), again('再校正一次 ›'));
  else if (CAN_CAL() && st.need && S.feelSkip) card.append(h('div', { class: 'timenote', text: '你选了先不校正，身强身弱先不下结论。' }), again('想校正的时候，做 8 道小题 ›'));
  else if (CAN_CAL() && st.need) card.append(h('div', { class: 'fe-cal' },
    h('p', { text: `${st.kind === '孤票' ? `三种判法里只有一种说出了强弱（${st.votes.map((v) => v.level).join('、')}），单凭它不下结论` : `三种判法在你这里分歧：${st.votes.map((v) => v.level).join('、')}`}。做个身强身弱校正：8 道日常小题，再说几件这些年的大事，两三分钟。` }),
    h('button', { class: 'cta dark', type: 'button', text: '做个身强身弱校正', on: { click: startCal } }),
    h('button', { class: 'fe-skip', type: 'button', text: '不用，先照现在的看', on: { click: () => { S.feelSkip = true; store.setFeel(S.id, null, true); show('result'); } } })));
  else {
    if (st.review) card.append(h('div', { class: 'timenote warn', text: st.feelWhy && st.need ? `几路判法说法相反，身强身弱先不下结论，两种都有可能。${st.young ? '你记得清的年份还不够三个' : st.feelWhy}，${LATER}` : st.review }));
    if (CAN_CAL()) card.append(again('对这个结论有疑问？做个身强身弱校正 ›'));
  }
  return card;
}
// ── 身强身弱校正（10-10 起，照网站校正页：8 道日常小题＋这些年的大事，跟 Skill、Kimi 同一套；题和算分都在引擎里，回答只在这台手机上）──
function startCal() {
  const last = S.calib || S.calTry || null;   // 上次选的先勾好（同网站）
  S.cal = { home: depth, traits: last && Array.isArray(last.traits) ? last.traits.slice() : Array(8).fill(null) };
  if (!S.ev.length) S.ev.push({});
  go('calib');
}
const calAsk = () => S.out.method.bazi.calib.ask;
function calib() {
  setBar({ pill: '‹ 回到结果' });
  const C = S.cal, btn = h('button', { class: 'cta dark', type: 'button', text: '下一步' });
  const ready = () => { btn.disabled = C.traits.some((x) => x == null); };
  const card = (t, i) => {
    const box = h('div', { class: 'card node' });
    const paint = () => box.replaceChildren(h('div', { class: 'node-y' }, h('b', { text: `第 ${i + 1} 题` })), h('p', { class: 'node-l', text: t.q }),
      ...t.options.map((o, j) => h('button', { class: 'fe-opt' + (C.traits[i] === j ? ' on' : ''), type: 'button', text: `${o.key}. ${o.text}`, on: { click: () => { C.traits[i] = j; paint(); ready(); } } })));
    paint(); return box;
  };
  btn.addEventListener('click', () => go('calibEv'));
  ready();
  return h('section', { class: 'v' }, h('div', { class: 'eyebrow', text: 'STRENGTH · 身强身弱' }), h('h2', { class: 'h1', text: '身强身弱校正' }),
    h('p', { class: 'lead', text: '8 道日常小题，每题选一个最像你的。' }), calAsk().traits.map(card), btn, h('p', { class: 'fe-fine', text: '只记你选了哪一项，存在这台手机上。' }));
}
// 你说的大事（身强身弱校正和定时辰共用一份，说一次两处用）：方面 → 那件事 → 哪一年 → 好事还是坏事；方面和可选的事跟网站、Skill 同一张表
const evDone = (e) => !!(e.year && e.domain);
function evEditor(list, onChange) {
  const A = window.XJ.rect.AREAS, birthY = +S.input.date.slice(0, 4), box = col();
  const yrs = []; for (let y = S.nowY; y >= birthY + 12; y--) yrs.push([y, `${y} 年`]);
  const paint = () => box.replaceChildren(...list.map((e, i) => h('div', { class: 'pe' },
    h('div', { class: 'pe-h' }, h('b', { text: `第 ${i + 1} 件` }), list.length > 1 ? h('button', { class: 'pe-x', type: 'button', text: '×', 'aria-label': '删掉这一件', on: { click: () => { list.splice(i, 1); paint(); onChange(); } } }) : null),
    h('label', { class: 'lab', text: '哪方面' }), chips(Object.keys(A).map((k) => [k, k]), e.domain, (v) => { if (e.domain !== v) { e.domain = v; delete e.event; paint(); } onChange(); }),
    e.domain ? [h('label', { class: 'lab', text: '什么事' }), chips(A[e.domain].map((k) => [k, k]), e.event, (v) => { e.event = v; onChange(); })] : null,
    h('div', { class: 'pe-2' }, h('div', {}, h('label', { class: 'lab', text: '哪一年' }), select(yrs, e.year, (v) => { e.year = +v; onChange(); }, '选年份')),
      h('div', {}, h('label', { class: 'lab', text: '对你来说' }), chips([[true, '好事'], [false, '坏事']], e.good, (v) => { e.good = v; onChange(); }, 'pe-gb'))))),
    ...(list.length < 12 ? [h('button', { class: 'rt-add', type: 'button', text: '＋ 再加一件', on: { click: () => { list.push({}); paint(); onChange(); } } })] : []));
  paint(); return box;
}
const evClean = (list) => list.filter(evDone).map((e) => ({ year: e.year, domain: e.domain, ...(e.event ? { event: e.event } : {}), ...(typeof e.good === 'boolean' ? { good: e.good } : {}) }));
function calibEv() {
  setBar({ pill: '‹ 改一下题' });
  const q = calAsk().events, btn = h('button', { class: 'cta dark', type: 'button', text: '看结果' });
  const ed = evEditor(S.ev, () => store.setEvents(S.id, evClean(S.ev)));
  btn.addEventListener('click', () => {
    // 好坏说不上来的那件不交给校正（同 Skill、Kimi）；定时辰那边照样能用
    S.calTry = { traits: S.cal.traits.slice(), events: evClean(S.ev).filter((e) => typeof e.good === 'boolean') };
    go('calibRes');
  });
  return h('section', { class: 'v' }, h('div', { class: 'eyebrow', text: 'STRENGTH · 身强身弱' }), h('h2', { class: 'h1', text: '过去这些年' }),
    h('p', { class: 'lead', text: `${q.q}${q.hint}` }), h('div', { class: 'card fields' }, ed), btn,
    h('p', { class: 'privacy', text: '只记哪一年、哪类事、好事坏事，存在这台手机上，不上传' }));
}
function calibRes() {
  setBar({});
  const T = S.calTry, o = window.XJ.compute({ ...EFF(), calib: T }), r = o.method.bazi && o.method.bazi.calib && o.method.bazi.calib.result;
  const home = S.cal ? S.cal.home : 1;
  if (!r || r.status !== '定案') {
    return h('section', { class: 'v' }, h('div', { class: 'eyebrow', text: 'STRENGTH · 身强身弱' }), h('div', { class: 'card cal-res none' }, h('h2', { class: 'h2', text: '这些答案，两边差不太多' }), h('p', { class: 'lead', text: r && r.say ? r.say.replace(/^回答两边差不多，/, '') : '先保持原来的看法。回去多填几件大事，再看一次。' })),   // 10-14 起照引擎给的话（命理组：还是按原来的偏X看）
      h('div', { class: 'cal-nav' }, h('button', { class: 'fe-skip', type: 'button', text: '回去补经历', on: { click: goBack } }), h('button', { class: 'cta dark', type: 'button', text: '知道了', on: { click: () => { S.calNone = true; S.tab = 'verify'; unwind(home); } } })));
  }
  const fav = o.method.bazi.useful ? o.method.bazi.useful.favorable : [];
  return h('section', { class: 'v' }, h('div', { class: 'eyebrow', text: 'STRENGTH · 身强身弱' }),
    h('div', { class: 'card cal-res' }, h('div', { class: 'cal-rh' }, h('span', { text: '你的校正结果为：' }), h('button', { class: 'fe-again', type: 'button', text: '重新校正', on: { click: () => { S.cal.traits = Array(8).fill(null); unwind(home + 1); } } })),
      h('div', { class: 'cal-type', text: `【${r.type}】` }), r.flip ? h('p', { class: 'cal-flip', text: r.flip }) : null,   // 定到盘面原判的反面要明说（10-13 命理组，同网站）
      h('div', { class: 'cal-g4' }, r.cards.map((c) => h('div', {}, h('b', { text: c.title }), h('p', { text: c.text })))),
      fav.length ? rows([['喜用', fav.join('、')]]) : null,
      h('p', { class: 'fe-line', text: r.say })),
    h('div', { class: 'cal-nav' }, h('button', { class: 'fe-skip', type: 'button', text: '不修改', on: { click: () => unwind(home) } }),
      h('button', { class: 'cta dark', type: 'button', text: `确定修改为${r.type}`, on: { click: () => { S.calib = T; S.calNone = false; store.setCalib(S.id, T); settle(); S.tab = 'verify'; unwind(home); } } })));
}

function nodesBlock() {
  const nodes = S.nodes;
  const head = RECT_DONE() && nodes.length ? h2(`定下来以后，玄玑再说${cnN(nodes.length)}件你没提过的事`, `用${HOUR()}这张盘挑的年份，请逐条标注：明显、部分、不符合。`) : h2('让玄玑看看你经历过什么', nodes.length ? '以下年份由八字流年与西盘行运在同一人生领域同时触发。请逐条标注：明显、部分、不符合。' : (S.out.birth.time ? '本盘未检出两套体系同时触发的过去年份；单一体系的信号不作为验证项。' : '出生时间不详，西盘行运无法落宫；本项只在两套体系同时触发时输出，故暂缺。'));
  if (!nodes.length) return head;
  const tallyBox = col();
  const paint = () => {
    const t = D.tally(nodes, S.ans);
    tallyBox.replaceChildren(...(t.open ? [] : [
      h('div', { class: 'card tally' }, [['obvious', '明显'], ['partial', '部分'], ['miss', '不符合']].map(([k, w]) => h('div', {}, h('b', { text: String(t[k]) }), h('span', { text: `条${w}` })))),
      acc('为什么玄玑会看到这些？', '每一年两套体系各自的触发项', () => h('div', {}, nodes.map((x) => h('div', { class: 'ev' },
        h('b', { text: `${x.year} · ${x.domain}` }),
        h('p', { class: 'li', text: '八字：' + x.bazi.slice(0, 3).join('；') }),
        h('p', { class: 'li', text: '星盘：' + x.west.slice(0, 3).join('；') }))),
        h('p', { class: 'faint small', text: '只挑八字流年和星盘行运在同一年、同一块人生同时亮的年份。' }))),
    ]));
  };
  const cards = nodes.map((x) => {
    const row = D.ANSWERS.map(([k, w]) => h('button', { type: 'button', class: 'ans' + (S.ans[x.id] === k ? ' ' + ANS_CLS[k] : ''), text: w, on: { click: (e) => {
      S.ans[x.id] = k; store.setAnswer(S.id, x.id, k);
      for (const b of e.currentTarget.parentNode.children) b.classList.remove('f1', 'f2', 'f3'); e.currentTarget.classList.add(ANS_CLS[k]); paint();
    } } }));
    return h('div', { class: 'card node' }, h('div', { class: 'node-y' }, h('b', { text: `${x.year} 年` }), h('span', { text: `${x.age} 岁` })), h('p', { class: 'node-l', text: x.line }), h('div', { class: 'ans-row' }, row));
  });
  paint();
  return [...head, ...cards, tallyBox];
}

// ── 定时辰（10-05 定：小工具也做，照 10-04 确认图）：打分是 Skill 同一份脚本（XJ.rect），这里只管问和摆 ──
const cnN = D.cnNum;
// 验证页入口：出生时间离时辰交界近、来源又不是出生证时才有（Skill 同一条规则）；核过但存疑的，可以再核一次
function rectEntry() {
  const c = RC(); if (!c) return null;
  if (S.rect && S.rect.result === 'uncertain') return h('div', { class: 'rt-cal' },
    h('p', { text: `你核过一次：两边还分不出来，时辰先存疑。最后一柱是${S.rect.pillars.a}还是${S.rect.pillars.b}，跟它有关的说法两种都有可能，其他照常看。想彻底定下来，最直接的办法是找出生证或医院记录。` }),
    h('button', { class: 'fe-again', type: 'button', text: '再核一次 ›', on: { click: startRect } }));
  const bh = S.base.method.boundary.hour, n = Math.ceil(c.side === 'prev' ? bh.minutes_from_prev : bh.minutes_to_next);
  const [x, y] = c.side === 'prev' ? [c.to, c.from] : [c.from, c.to];
  return h('div', { class: 'rt-cal' },
    h('p', { text: `你的时间离${x}时和${y}时的交界只有 ${n} 分钟，八字最后一柱会因此不同。说几件记得清的事，玄玑帮你把它定下来。` }),
    h('button', { class: 'cta dark', type: 'button', text: '定一下时辰 · 约两分钟', on: { click: startRect } }),
    h('div', { class: 'rt-hint', text: '全部在这台手机上算，不上传' }));
}
// 交界另一侧再排一张（本机算，几百毫秒），然后进「说几件大事」
function startRect() {
  const c = RC(); if (!c) return;
  const prev = S.rect && S.rect.result === 'uncertain' ? S.rect : null;
  if (S.ev.length < 3) for (let k = S.ev.length; k < 3; k++) S.ev.push({});   // 大事跟身强身弱校正共用一份（10-10 起），说过的直接带上
  S.rt = { c, home: depth, alt: null, kids: prev ? prev.children.length > 0 : false,
    ch: prev && prev.children.length ? prev.children.map((k) => ({ ...k })) : [{}], ask: null, ans: { targeted: {}, good: {} } };
  go('busy'); const tok = depth;
  setTimeout(() => {
    try { S.rt.alt = window.XJ.compute(c.request); if (depth === tok) swap('rect'); } catch (e) { if (depth === tok) unwind(S.rt.home); }
  }, 60);
}
function rect() {
  setBar({ pill: '‹ 回到结果' });
  const R = S.rt, birthY = +S.input.date.slice(0, 4);
  const kyrs = []; for (let y = S.nowY; y >= birthY + 14; y--) kyrs.push([y, `${y} 年`]);
  const kidBox = col(), btn = h('button', { class: 'cta dark', type: 'button', text: '下一步' });
  const ready = () => { btn.disabled = S.ev.filter(evDone).length < 3; store.setEvents(S.id, evClean(S.ev)); };
  const ed = evEditor(S.ev, ready);
  const kidRow = (k) => {
    const dayBox = h('div', { class: 'rt-day' });
    const paintDay = () => dayBox.replaceChildren(...(k.month === 2 ? [select(Array.from({ length: 29 }, (_, i) => [i + 1, `${i + 1} 日`]), k.day, (v) => { k.day = +v; }, '几号')] : []));
    paintDay();
    return h('div', { class: 'rt-kid' }, select(kyrs, k.year, (v) => { k.year = +v; }, '哪一年'),
      select(Array.from({ length: 12 }, (_, i) => [i + 1, `${i + 1} 月`]), k.month, (v) => { k.month = +v; if (k.month !== 2) delete k.day; paintDay(); }, '几月'), dayBox);
  };
  const paintKids = () => (kidBox.style.display = R.kids ? '' : 'none', kidBox.replaceChildren(...(R.kids ? [...R.ch.map(kidRow), R.ch.length < 6 ? h('button', { class: 'rt-add', type: 'button', text: '＋ 再加一个孩子', on: { click: () => { R.ch.push({}); paintKids(); } } }) : null,
    h('p', { class: 'rt-hint', text: '1 月、2 月出生的，选上月份（2 月还要几号）' })] : []).filter(Boolean)));
  btn.addEventListener('click', () => {
    R.events = evClean(S.ev);
    // 说了「孩子出生」的，那一年也算进孩子（月份没填的照「有孩子吗」那里补；命理组 10-10）
    const born = R.events.filter((e) => e.event === '孩子出生').map((e) => e.year), kids = R.kids ? R.ch.filter((k) => k.year) : [];
    for (const y of born) if (!kids.some((k) => k.year === y)) kids.push({ year: y });
    R.children = kids.map((k) => ({ year: k.year, ...(k.month ? { month: k.month } : {}), ...(k.month === 2 && k.day ? { day: k.day } : {}) }));
    R.ask = window.XJ.rect.plan(S.base, R.alt, { events: R.events, children: R.children }, { now: new Date() });
    R.ans = { targeted: {}, good: {} };
    go('rectAsk');
  });
  ready(); paintKids();
  return h('section', { class: 'v' }, h('div', { class: 'eyebrow', text: 'TIME · 定时辰' }), h('h2', { class: 'h1', text: '把时辰定下来' }),
    h('p', { class: 'lead' }, '说几件你记得清的大事：', h('br'), '哪一年、什么事，对你来说是好事还是坏事。'),
    h('div', { class: 'card fields' }, ed),
    h('div', { class: 'card fields' }, h('label', { class: 'lab', text: '有孩子吗？' }), chips([[false, '没有'], [true, '有']], R.kids, (v) => { R.kids = v; paintKids(); }), kidBox),
    h('p', { class: 'privacy', text: '只记哪一年、哪类事、好事坏事，全部在这台手机上算，不上传' }), btn);
}
// 玄玑问你几年：专挑两张盘说法相反的年份，问有没有这几类事（下面带「比如」）；答「有」再问一句好事还是坏事（命理组 10-10）。题目、年份都由脚本出，不标哪年对哪张盘
function rectAsk() {
  setBar({ pill: '‹ 改一下大事' });
  const R = S.rt, A = R.ask, birthY = +S.input.date.slice(0, 4), btn = h('button', { class: 'cta dark', type: 'button', text: '定下来' });
  const ready = () => { btn.disabled = A.targeted.some((k) => !R.ans.targeted[k.id]); };
  const card = (k) => {
    const box = h('div', { class: 'card node' });
    const opt = (bag, v, t) => h('button', { type: 'button', class: 'ans' + (bag[k.id] === v ? ' f1' : ''), text: t, on: { click: () => { bag[k.id] = v; if (bag === R.ans.targeted && v !== '有') delete R.ans.good[k.id]; paint(); ready(); } } });
    const paint = () => box.replaceChildren(...[h('div', { class: 'node-y' }, h('b', { text: `${k.year} 年` }), h('span', { text: `${k.year - birthY} 岁` })),
      h('p', { class: 'node-l', text: k.ask }), h('p', { class: 'node-s', text: '比如：' + k.eg }),
      h('div', { class: 'ans-row' }, [['有', '有'], ['没有', '没有'], ['记不清', '记不清']].map(([v, t]) => opt(R.ans.targeted, v, t))),
      R.ans.targeted[k.id] === '有' ? h('div', { class: 'rt-fu' }, h('span', { text: A.follow_up }), h('div', { class: 'ans-row two' }, [['好事', '好事'], ['坏事', '坏事']].map(([v, t]) => opt(R.ans.good, v, t)))) : null].filter(Boolean));
    paint(); return box;
  };
  btn.addEventListener('click', () => {
    const answers = { targeted: { ...R.ans.targeted }, good: { ...R.ans.good } };
    finishRect(window.XJ.rect.score(S.base, R.alt, { events: R.events, children: R.children }, A, answers), answers);
  });
  ready();
  return h('section', { class: 'v' }, h('div', { class: 'eyebrow', text: 'TIME · 定时辰' }), h('h2', { class: 'h1', text: '玄玑想问你几年' }),
    A.targeted.length ? h('p', { class: 'lead', text: '只问有没有这几类事，想不起来选「记不清」。' }) : h('p', { class: 'lead', text: '你说的这几件已经够了，直接定。' }),
    A.targeted.map(card), btn);
}
// 定下来：存本机（只有年份和方面、题和回答、结果）；定在隔壁时辰就整盘换过去，身强身弱按新盘重判
function finishRect(r, answers) {
  const R = S.rt, A = S.base, B = R.alt, win = r.result === 'uncertain' ? null : r.result;
  const it = D.rectItems(A, B, { events: R.events, ask: R.ask, answers }, window.XJ.rect.weight, window.XJ.rect.domainOf);
  const va = D.strength(A), vb = D.strength(B), fav = (o) => (o.method.bazi && o.method.bazi.useful ? o.method.bazi.useful.favorable.join('') : '');
  S.rect = { at: Date.now(), request: R.c.request, events: R.events, children: R.children,
    asked: R.ask.targeted.map((k) => k.year),
    result: r.result, hours: r.hours, pillars: { a: A.bazi.bazi.pillars.hour.ganZhi, b: B.bazi.bazi.pillars.hour.ganZhi }, lean: r.lean, tie: r.tie_broken_by_children,
    items: it.map((x) => ({ year: x.year, kind: x.kind, domain: x.domain || null, event: x.event || null, ans: x.ans || null, side: x.side })), why: win ? D.rectWhy(it, r.hours, win) : [],
    change: win === 'b' ? { strength: [va ? va.verdict : '—', vb ? vb.verdict : '—'], fav: [fav(A), fav(B)] } : null };
  store.setRect(S.id, S.rect);
  if (win === 'b') { S.base = S.out = B; S.side = null; }
  S.nodes = nodesOf(S.out); settle(); S.tab = 'verify';
  if (win) swap('rectDone'); else unwind(R.home);
}
// 定下来的那一刻
function rectDone() {
  setBar({});
  const R = S.rect, win = R.result, d = new Date(R.at), home = S.rt ? S.rt.home : 1, by = R.items.filter((x) => x.side === win);   // 站在定下来那边的几件
  const yrs = [...new Set(by.map((x) => x.year))].sort((a, b) => a - b);
  return h('section', { class: 'v rt-rit' }, img('mark', 'rt-mark lg'), h('div', { class: 'ey', text: '你亲手定下的时辰' }),
    h('div', { class: 'pz' }, win === 'b' ? [h('span', { class: 'old', text: R.pillars.a }), h('span', { class: 'arw', text: '→' })] : null, h('span', { class: 'new', text: R.pillars[win] })),
    h('div', { class: 'shi', text: R.hours[win].split('').join(' ') }),
    h('div', { class: 'by' }, `由你的 ${by.length} 件经历定下`, h('br'), yrs.join(' · ')),
    h('div', { class: 'dt', text: `${d.getFullYear()} · ${pad2(d.getMonth() + 1)} · ${pad2(d.getDate())}` }),
    h('button', { class: 'b-pill rt-go', type: 'button', text: '看看定下来以后的盘', on: { click: () => unwind(home) } }));
}
// 定下来以后的出生时间卡：揭晓（定在哪个时辰、怎么定的）＋ 变化（最后一柱、身强身弱、喜用）
function rectCard(r) {
  const R = S.rect, win = R.result, lose = win === 'a' ? 'b' : 'a', hr = R.hours[win];
  const ys = R.items.map((x) => x.year), lo = Math.min(...ys), hi = Math.max(...ys), X = (y) => (hi === lo ? 50 : 6 + ((y - lo) / (hi - lo)) * 88);
  const seen = {}, nudge = R.items.map((x) => { const k = seen[x.year] = (seen[x.year] || 0) + 1; return (k - 1) * 5; });   // 同一年两件，第二个点往右挪一点，免得叠在一起
  const cls = (x) => (x.side === win ? 'y' : x.side === lose ? 'o' : 'n') + (x.kind === 'feel' ? ' f' : '');
  const lab = (x) => (x.kind === 'feel' ? x.ans.replace(/^.*是/, '') : (x.event || { 工作: '工作', 事业认可: '事业', 感情: '感情', 家庭: '家里', 钱: '钱', 迁移远方: '去外地' }[x.domain]) + (x.ans === '没有' ? '·没有' : ''));
  const tl = h('div', { class: 'rt-tl' }, h('div', { class: 'rt-ax' }), R.items.map((x, i) => [h('div', { class: 'rt-dt ' + cls(x), style: { left: Math.min(97, X(x.year) + nudge[i]) + '%' } }),
    h('div', { class: 'rt-lab', style: { left: Math.min(94, X(x.year) + nudge[i]) + '%', top: i % 2 ? '64px' : '4px' } }, String(x.year), h('br'), lab(x))]));
  return h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'vt verdict-ok', text: `时辰定在${hr}` }), img('mark', 'rt-mark sm')),
    rows([['钟表时间', S.input.time], win === 'a' && r.solar ? ['真太阳时', `${r.solar}（${diffMin(r.clock, r.solar)}）`] : null, ['定下的时辰', `${hr} · ${R.pillars[win]}`], ['怎么定的', `你的 ${R.items.filter((x) => x.side === win).length} 件经历`]]),
    R.items.length ? [tl, h('div', { class: 'rt-lg' }, h('span', {}, h('i', { class: 'y' }), `站在${hr}这边`), h('span', {}, h('i', { class: 'o' }), `站在${R.hours[lose]}这边`), R.items.some((x) => !x.side) ? h('span', {}, h('i', { class: 'n' }), '两边一样，不算') : null)] : null,
    R.why.length ? h('ul', { class: 'rt-why' }, R.why.map(([c, t]) => h('li', { class: c, text: t }))) : null,
    r.risks.length ? h('div', { class: 'timenote warn' }, r.risks.map((x) => h('div', { text: x.text }))) : null,
    h('div', { class: 'kv rt-chg' }, win === 'b' ? [rowChg('最后一柱', R.pillars.a, R.pillars.b), rowChg('身强身弱', R.change.strength[0], R.change.strength[1]), rowChg('喜用', R.change.fav[0], R.change.fav[1])]
      : h('div', { class: 'r' }, h('span', { text: '最后一柱' }), h('b', { text: `${R.pillars.a}（不变）` }), h('i'))));
}
const rowChg = (k, a, b) => h('div', { class: 'r' }, h('span', { text: k }), a === b ? h('b', { text: `${b}（不变）` }) : h('b', {}, h('s', { text: a }), b), h('i'));

// ── 标签三：星盘 ──
// 默认就摊开整张盘的数据（四轴、行星、小行星虚点、相位表、宫头、元素模式），截一张图就够拿去解读；解释和明细再点开。
const POINT_LINE = { 太阳: '太阳反映主体意志和人生方向。', 月亮: '月亮反映情绪反应和内心安全感的来源。', 上升: '上升是外在气质和第一印象的主要观察窗口。' };
const SIGNS12 = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const ELEM = { 火: ['白羊', '狮子', '射手'], 土: ['金牛', '处女', '摩羯'], 风: ['双子', '天秤', '水瓶'], 水: ['巨蟹', '天蝎', '双鱼'] };
const MODE = { 基本: ['白羊', '巨蟹', '天秤', '摩羯'], 固定: ['金牛', '狮子', '天蝎', '水瓶'], 变动: ['双子', '处女', '射手', '双鱼'] };
const ELC = { 火: '#d8432f', 土: '#a8841c', 风: '#3d8f4f', 水: '#2f5fc4', 基本: '#c40018', 固定: '#111', 变动: '#8a8580' };
const ASPS = [[0, '合', 8], [60, '六', 4], [90, '刑', 6], [120, '拱', 6], [180, '冲', 8], [45, '半', 2], [135, '补', 2], [150, '梅', 2]];   // 前五种同星盘图（引擎 ASP_DEF 容许度）；后三种小相位只显示不计分
const ABBR = { 太阳: '日', 月亮: '月', 水星: '水', 金星: '金', 火星: '火', 木星: '木', 土星: '土', 天王: '天', 海王: '海', 冥王: '冥', 凯龙: '凯', 上升: '升', 天顶: '中' };
const L_ = (p) => (typeof p.L === 'number' ? p.L : SIGNS12.indexOf(p.sign) * 30 + p.deg + (p.min || 0) / 60);
const dm = (p) => `${p.sign} ${p.deg}°${pad2(p.min)}′`;
function aspectGrid(d) {
  const B = d.planets.map((p) => ({ n: p.n, L: L_(p) })).concat([{ n: '上升', L: d.angles.asc.L }, { n: '天顶', L: d.angles.mc.L }]);
  const hit = (a, b) => { let x = Math.abs(a - b) % 360; if (x > 180) x = 360 - x; for (const [deg, t, orb] of ASPS) { const o = Math.abs(x - deg); if (o <= orb) return { t, o }; } return null; };
  const grid = h('div', { class: 'agrid', style: { gridTemplateColumns: `30px repeat(${B.length - 1}, 1fr)` } });
  for (let i = 1; i < B.length; i++) {
    grid.appendChild(h('span', { class: 'ag-k', text: ABBR[B[i].n] || B[i].n[0] }));
    for (let j = 0; j < B.length - 1; j++) {
      if (j >= i) { grid.appendChild(h('span', { class: 'ag-x' })); continue; }
      const a = hit(B[i].L, B[j].L);
      grid.appendChild(a ? h('span', { class: 'ag-c ' + ({ 冲: 'hard', 刑: 'hard', 拱: 'soft', 六: 'soft', 合: 'conj', 半: 'minor', 补: 'minor', 梅: 'minor' })[a.t] }, h('b', { text: a.t }), h('i', { text: a.o.toFixed(0) + '°' })) : h('span', { class: 'ag-c' }));
    }
  }
  grid.appendChild(h('span', { class: 'ag-k' }));
  for (let j = 0; j < B.length - 1; j++) grid.appendChild(h('span', { class: 'ag-k', text: ABBR[B[j].n] || B[j].n[0] }));
  return grid;
}
function distBars(d) {
  const ten = d.planets.filter((p) => !['凯龙'].includes(p.n));
  const bar = (groups) => Object.entries(groups).map(([k, signs]) => { const who = ten.filter((p) => signs.includes(p.sign)); return h('div', { class: 'dist-r' },
    h('span', { class: 'serif', style: { color: ELC[k] }, text: k }), h('div', { class: 'bar' }, h('i', { style: { width: (who.length / ten.length) * 100 + '%', background: ELC[k] } })), h('span', { class: 'dist-n', text: String(who.length) }), h('span', { class: 'dist-w', text: who.map((p) => ABBR[p.n]).join('') })); });
  return h('div', { class: 'dist' }, h('div', { class: 'lb', text: '元素' }), bar(ELEM), h('div', { class: 'lb', style: { marginTop: '10px' }, text: '模式' }), bar(MODE));
}
function chartTab() {
  const o = S.out, w = o.method.west, d = o.western.data, p = o.method.persona;
  if (!d || !w || !w.big3) return col(...h2('星盘', '出生时间不详，星盘的上升和宫位排不出来；八字和时间线还能看。'));
  const b3 = w.big3, P = (n) => w.planets.find((x) => x.n === n), A = d.angles;
  const ruler = w.planets.find((x) => x.is_chart_ruler);
  const coord = (label, title, sub, line, more) => h('div', { class: 'coord' },
    h('div', { class: 'lb', text: label }), h('div', { class: 'co-t', text: title }), sub ? h('div', { class: 'co-s', text: sub }) : null, h('p', { class: 'co-l', text: line }),
    acc('展开完整坐标', null, more));
  const x = X(), pts = [...(d.asteroids || []), ...(x ? x.asteroids : []), ...(d.points || []), ...(x ? x.points : [])];
  return col(
    h('div', { class: 'card chartcard' }, h('div', { class: 'row' }, h('b', { class: 'ctitle', text: '本命星盘' }), h('span', { class: 'faint small', text: 'Placidus 分宫 · 回归黄道' })), wheel(d, X()),
      h('div', { class: 'legend' }, h('span', {}, h('i', { style: { borderColor: '#d8432f' } }), '冲'), h('span', {}, h('i', { class: 'dash', style: { borderColor: '#d8432f' } }), '刑'), h('span', {}, h('i', { style: { borderColor: '#2a9d8f' } }), '拱'), h('span', {}, h('i', { class: 'dash', style: { borderColor: '#2a9d8f' } }), '六合'), h('span', {}, h('i', { class: 'dot', style: { borderColor: '#d8432f' } }), '半刑·补八分'), h('span', {}, h('i', { class: 'dot', style: { borderColor: '#8a5fc4' } }), '梅花'), h('span', { text: 'R 逆行' })),
      h('div', { class: 'legend' }, h('span', { style: { color: '#b0479a' }, text: '谷智婚灶灵爱莉 小行星' }), h('span', { style: { color: '#2a9d9d' }, text: '北南福精宿东 虚点' }), h('span', { text: '升降中底 四轴' }), h('span', { class: 'lg-star' }, starIcon(), '恒星')),
      h('div', { class: 'axes' }, [['上升 ASC', A.asc], ['天顶 MC', A.mc], ['下降 DSC', A.dsc], ['天底 IC', A.ic]].map(([k, x]) => h('div', {}, h('span', { text: k }), h('b', { text: dm(x) }))))),
    ...h2('本命盘数据', '全部计算结果按原值列出，可直接用于复核与转交。'),
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'lb', text: '行星位置' }), h('span', { class: 'faint small', text: ruler ? `命主星 ${ruler.n}` : '' })),
      h('div', { class: 'ptbl' }, h('div', { class: 'rowd th' }, h('span', { text: '星体' }), h('span', { text: '星座 · 度数' }), h('span', { text: '宫位' }), h('span', { text: '庙旺' }), h('i')),
        w.planets.map((x) => h('button', { class: 'rowd tap', type: 'button', on: { click: () => openSheet(`${x.n} · ${x.sign}`, () => planetDetail(x)) } },
          h('span', { text: x.n }), h('b', { style: { textAlign: 'left' }, text: `${dm(x)}${x.rx ? ' R' : ''}` }), h('b', { text: x.house ? `${x.house} 宫` : '' }),
          h('span', { class: 'dg ' + (/庙|旺/.test(x.dignity) ? 'good' : /陷|弱/.test(x.dignity) ? 'bad' : ''), text: x.dignity && x.dignity !== '平' ? x.dignity : '—' }), h('i', { class: 'chev', text: '›' }))))),
    h('div', { class: 'card' }, h('div', { class: 'lb', text: '小行星与虚点' }), h('div', { class: 'ptbl' }, pts.map((x) => h('div', { class: 'rowd' },
      h('span', { text: x.n }), h('b', { style: { textAlign: 'left' }, text: `${dm(x)}${x.rx && !/交点/.test(x.n) ? ' R' : ''}` }), h('b', { text: x.house ? `${x.house} 宫` : '' }), h('span'), h('i'))))),
    x ? h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'lb', text: '恒星' }), h('span', { class: 'faint small', text: '只标合相 · 容许度 1°' })), h('div', { class: 'ptbl stbl' }, x.stars.map((st) => h('div', { class: 'rowd' },
      h('span', { text: st.n }), h('b', { style: { textAlign: 'left' }, text: `${st.sign} ${st.deg}°${pad2(st.min)}′` }), h('b', { class: st.conj.length ? 'conj-hit' : 'faint', text: st.conj.length ? st.conj.map((c) => `合${c.n} ${c.orb.toFixed(1)}°`).join('、') : '—' }), h('span'), h('i'))))) : null,
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'lb', text: '相位表' }), h('span', { class: 'faint small', text: '格子里是相位和容许度' })), h('div', { class: 'scrollx' }, aspectGrid(d)),
      h('div', { class: 'legend' }, h('span', { class: 'ag-l conj', text: '合' }), h('span', { class: 'ag-l hard', text: '冲 刑' }), h('span', { class: 'ag-l soft', text: '拱 六合' }), h('span', { class: 'ag-l minor', text: '半刑 补八分 梅花' }))),
    h('div', { class: 'card' }, h('div', { class: 'lb', text: '十二宫宫头' }), h('div', { class: 'houses' }, d.houses.map((x) => h('div', {}, h('span', { text: `${x.num} 宫` }), h('b', { text: dm(x) }))))),
    h('div', { class: 'card' }, distBars(d), h('div', { class: 'lb', style: { marginTop: '12px' }, text: '行星力量排名' }), h('div', { class: 'mini' }, (w.power_rank || []).map((x, i) => h('span', { text: `${i + 1}. ${x.n} ${x.v}` })))),
    h('div', { class: 'gap' }), ...h2('三个基础坐标', '以上升、太阳、月亮确立盘面轮廓。'),
    coord('上升', `${b3.asc.sign}座 ${b3.asc.deg}°${pad2(b3.asc.min)}′`, `命主星 ${b3.asc.ruler}${b3.asc.ruler_detail ? ` · ${b3.asc.ruler_detail.sign} ${b3.asc.ruler_detail.house} 宫 · ${b3.asc.ruler_detail.dignity}` : ''}`, POINT_LINE.上升,
      () => b3.asc.ruler_detail ? planetDetail(b3.asc.ruler_detail) : h('p', { class: 'faint', text: '—' })),
    coord('太阳', `${b3.sun.sign}座 · 第 ${b3.sun.house} 宫`, `${b3.sun.dignity || '平'} · 力量第 ${b3.sun.power_rank} 名`, POINT_LINE.太阳, () => planetDetail(P('太阳'))),
    coord('月亮', `${b3.moon.sign}座 · 第 ${b3.moon.house} 宫`, `${b3.moon.dignity || '平'} · 力量第 ${b3.moon.power_rank} 名`, POINT_LINE.月亮, () => planetDetail(P('月亮'))),
    p ? [h('div', { class: 'gap' }), ...h2('星盘人格', '出厂底色是由星盘推出的人格结构模型，不等同于自测 MBTI。'),
      h('div', { class: 'card' }, rows([['出厂底色', `${p.base.type} ${p.base.name}`, () => openSheet('星盘人格', personaSheet)], ['第二候选', `${p.base.runner_up}（${p.base.lead}）`], ['重生人格', p.rebirth.map((x) => `${x.type} ${x.name}`).join(' · '), () => openSheet('星盘人格', personaSheet)], p.buffs.length ? ['Buff', p.buffs.map((x) => x.f).join(' ')] : null, ['主导功能', `${p.base.stack.dom.f} ${p.base.stack.dom.word.replace(/（.*$/, '')}`]]))] : null);
}

// ── 标签四：八字 ──
function baziTab() {
  const o = S.out, bz = o.bazi.status === 'ok' ? o.bazi : null, mb = o.method.bazi, st = ST(), stg = D.stage(o, S.nowY);
  if (!bz) return col(...h2('八字', '八字没排出来。'));
  const P = bz.bazi.pillars, K = ['year', 'month', 'day', 'hour'], NM = ['年柱', '月柱', '日柱', '时柱'];
  // 用神「调候取用」：排盘标了用神是调候取的（climateUseful），而且跟这一页的身强身弱结论看着相反，才标
  const tiao = !!(st && AGAINST[st.side] && mb.useful && AGAINST[st.side].includes(mb.useful.useful) && bz.bazi.usefulGods && bz.bazi.usefulGods.climateUseful);
  const wx = bz.components && bz.components.wuxingRing && bz.components.wuxingRing.rows;
  return col(
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', { class: 'ctitle', text: '四柱八字' }), h('span', { class: 'faint small', text: '真太阳时 · 节气换月' })),
      h('div', { class: 'pillars' }, K.map((k, i) => { const x = P[k]; return h('button', { class: 'pl tap' + (k === 'day' ? ' me' : ''), type: 'button', disabled: !x, on: { click: () => x && openSheet(`${NM[i]} · ${x.ganZhi}`, () => pillarDetail(x)) } },
        h('small', { text: NM[i] }), h('span', { class: 'tg', text: x ? (k === 'day' ? '日主' : x.tenGod) : '' }), h('span', { class: 'gz', text: x ? x.gan : '?' }), h('span', { class: 'gz', text: x ? x.zhi : '?' }),
        h('span', { class: 'hid', text: x && x.hidden ? x.hidden.map((y) => y.tenGod).join(' ') : '' })); })),
      wx ? h('div', { class: 'wx' }, wx.map((r) => h('div', { class: 'wxrow' }, h('span', { class: 'serif', style: { color: EL[r.element] }, text: r.element }), h('div', { class: 'bar' }, h('i', { style: { width: r.percent + '%', background: EL[r.element] } })), h('span', { class: 'pc', text: r.percent + '%' })))) : null),
    ...h2('日主与格局', null),
    h('div', { class: 'card idn' }, h('div', { class: 'lb', text: '日主' }), h('div', { class: 'co-t', text: `${mb.day_master.gan}${mb.day_master.element} · ${mb.day_master.image}` }), h('p', { class: 'co-l', text: mb.day_master.image_line }),
      mb.pattern ? [h('div', { class: 'lb', style: { marginTop: '12px' }, text: '格局' }), h('div', { class: 'co-t', text: mb.pattern.name + (mb.pattern.label ? ` · ${mb.pattern.label}` : '') }), mb.pattern.huaming ? h('p', { class: 'co-l', text: mb.pattern.huaming.line }) : null,
        mb.pattern.huaming && mb.pattern.huaming.desc ? acc('展开格局说明', null, () => h('p', { class: 'sub', text: mb.pattern.huaming.desc })) : null] : null),
    h('div', { class: 'card' }, rows([st ? ['身强身弱', `${st.verdict} · ${st.agree}`, () => goTab('verify')] : null, st && st.favorable.length ? ['喜用', st.favorable.join(' ')] : null, st && st.unfavorable.length ? ['忌', st.unfavorable.join(' ')] : null,
      SCH() ? ['按哪一派', schoolWord(SCH()), () => openSheet('三派各怎么说', schoolsSheet)] : null,
      mb.useful && mb.useful.useful ? (tiao
        ? ['用神 / 忌神', [`${mb.useful.useful} / ${mb.useful.avoid || '—'}`, h('small', { class: 'kv-note', text: '调候取用' })], () => openSheet('调候取用', () => tiaoSheet(bz, mb, st))]
        : ['用神 / 忌神', `${mb.useful.useful} / ${mb.useful.avoid || '—'}`]) : null,
      mb.lucky ? ['幸运色', mb.lucky.colors.map((c) => c.name).join('、')] : null, mb.lucky && mb.lucky.directions ? ['方位', mb.lucky.directions.join('、')] : null,
      mb.fit && mb.fit.jobs.length ? ['适合行业', mb.fit.jobs.slice(0, 5).join('、')] : null])),
    mb.shensha && mb.shensha.dimensions ? [h('div', { class: 'gap' }), ...h2('神煞', '仅列辨识度较高的维度；完整明细可展开。'),
      h('div', { class: 'card ss' }, mb.shensha.dimensions.map((x) => h('button', { class: 'ssr tap', type: 'button', on: { click: () => openSheet('神煞', shenshaSheet) } },
        h('span', { text: x.name }), h('div', { class: 'bar' }, h('i', { style: { width: Math.max(4, Math.min(100, x.score)) + '%' } })), h('span', { class: 'ssv', text: String(x.score) }))))] : null,
    mb.luck ? [h('div', { class: 'gap' }), ...h2('大运', '十年一运；展开可查看该运内逐年的触发领域。'),
      h('div', { class: 'card' }, h('div', { class: 'lucks' }, mb.luck.slice(0, 8).map((l) => h('button', { class: 'lk tap' + (stg && stg.luck && stg.luck.seq === l.seq ? ' now' : ''), type: 'button', on: { click: () => openSheet(`${l.gan_zhi}大运`, () => luckDetail(l)) } }, h('b', { text: l.gan_zhi[0] }), h('b', { text: l.gan_zhi[1] }), h('span', { text: `${l.start_age}${l.age_kind === '周岁' ? '周岁' : '岁'}` })))))] : null);
}

// 三派（扶抑、调候、格局）各按整套方法算，喜用和顺逆按上桌的那一派；还没核准时标出来（10-08 起）
const schoolWord = (s) => `${s.name}派` + (s.by === '核核你' ? ' · 你的经历对上了' : s.by === '默认' ? ' · 先按这一派说，还没核准' : '');
function schoolsSheet() {
  const all = S.out.method.bazi.schools || {}, now = SCH();
  const nw = (t) => h('span', { text: t, style: { whiteSpace: 'nowrap' } });   // 「喜金水」「忌土火」各自不拆行
  const xi = (u) => (!u || u.abstain ? '这张盘它不表态' : [nw(`喜${(u.favorable || []).join('')}`), '　', nw(`忌${(u.unfavorable || []).join('') || '—'}`)]);
  // 扶抑派分身强、身弱两套：身强身弱还没定时两套都列，不替用户选一边；格局派写它自己取的格（八字页「格局」那行照旧是排盘的格名，10-09 定）
  const line = (k, u, sub) => h('p', { class: 'li' }, h('b', { text: `${k}派${sub || ''}${now && now.name === k ? '（现在按它）' : ''}：` }), xi(u));
  return h('div', { class: 'card why' },
    h('p', { text: '八字分三派，各按自己整套方法取喜用、看每年顺不顺，不拼各派的一半。做个身强身弱校正，对上哪一派，喜用和时间线就按哪一派。' }),
    ['扶抑', '调候', '格局'].flatMap((k) => { const u = all[k]; return u && u.sides ? ['强', '弱'].map((sd) => line(k, u.sides[sd], ` · 身${sd}那套`)) : [line(k, u, u && u.side ? ` · 身${u.side}` : u && u.name ? ` · 取${u.name}` : '')]; }));
}
// 用神「调候取用」的说明：只看身强身弱，这一行本该避开；生的月份寒暖燥湿偏得厉害，先调候
const AGAINST = { 弱: ['食伤', '财星', '官杀'], 强: ['印星', '比劫'] };   // 身弱忌泄耗克、身强忌印比
function tiaoSheet(bz, mb, st) {
  const u = bz.bazi.usefulGods, el = u.primaryFavorableWuxing, mz = bz.bazi.pillars.month.zhi;
  return h('div', { class: 'card why' },
    h('p', { text: `用神${mb.useful.useful}（${el}）不是按身强身弱取的。只看${st.verdict}，${el}这一行本该避开；但这张盘生在${mz}月，寒暖燥湿偏得厉害，按《穷通宝鉴》的调候法先取${el}，所以用神是${mb.useful.useful}。` }),
    h('p', { text: '喜用、忌和大运好坏，都已经把调候算进去了。' }));
}

// ── 标签五：时间线 ──
function timeTab() {
  const o = S.out, t = o.method.timing, mb = o.method.bazi, stg = D.stage(o, S.nowY);
  if (!t) return col(...h2('时间线', '八字没排出来，时间线算不了。'));
  const L = stg && stg.luck, next = L && mb.luck.find((x) => x.seq === L.seq + 1);
  const pct = L ? Math.round(((S.nowY - L.start_year + 0.5) / (L.end_year - L.start_year + 1)) * 100) : 0;
  return col(
    S.side ? h('div', { class: 'timenote fe-turn', text: `时间线按你核定的身${S.side}排。` }) : null,
    MUTE() ? h('div', { class: 'timenote', text: '核的几年三派都对不上：流年先不标顺逆，只看每年哪几块在动；往后的经历可以再核。' }) : null,
    h('div', { class: 'eyebrow', text: '你现在所在的时间段' }),
    L ? h('div', { class: 'now' }, h('div', { class: 'now-t', text: `${L.gan_zhi}大运 · ${stg.gz}流年` }), h('div', { class: 'now-s', text: `${L.start_year} — ${L.end_year}　${L.title ? L.title.join(' · ') : ''}` }),
      next ? h('div', { class: 'now-s', text: `下一步大运：${next.start_year} 年起 ${next.gan_zhi}` }) : null, h('div', { class: 'progress' }, h('i', { style: { width: pct + '%' } }))) : null,
    ...h2('接下来三年', '按年列出八字与西盘的触发领域；「两套同亮」为两套体系同年同域触发。'),
    stg.years.map((y) => h('button', { class: 'next tap', type: 'button', on: { click: () => openYear(y.year) } },
      h('span', { class: 'y', text: String(y.year) }),
      h('span', { class: 'd' }, y.shift ? h('span', { class: 'dom shift', text: '换挡年' }) : null, y.items.slice(0, 4).map((x) => h('span', { class: 'dom' + (x.mirror ? ' mirror' : ''), text: x.word + (x.mirror ? ' · 两套同亮' : '') }))),
      h('i', { class: 'chev', text: '›' }))),
    h('div', { class: 'gap' }), ...h2('按需展开完整周期', '上方为当前所处阶段；完整计算表保留于此，追溯前后周期时展开。'),
    h('div', { class: 'accs' },
      acc('完整大运表', `${mb.luck.length} 个阶段 · 查看完整人生周期`, () => rows(mb.luck.map((l) => [luckAge(l), `${l.gan_zhi} · ${luckYears(l)}${L && L.seq === l.seq ? ' · 当前' : ''}`, () => openSheet(`${l.gan_zhi}大运`, () => luckDetail(l))]))),
      acc('流年表', `${S.nowY - 5}–${S.nowY + 9} · 每年八字和星盘各亮了哪块`, () => yearsTable(t.years.filter((y) => y.year >= S.nowY - 5 && y.year <= S.nowY + 9))),
      t.months && t.months.length ? acc('近三年星盘窗口', `${t.months.length} 个窗口 · 精确到月`, monthsSheet) : null,
      t.months_bazi && t.months_bazi.length ? acc('八字流月高发月', `${t.months_bazi.length} 年 · 只细化已经亮灯的流年`, monthsBaziSheet) : null,
      t.life_cycles && t.life_cycles.length ? acc('一生大周期', `${t.life_cycles.length} 个节点 · 木星回归、土星回归等`, lifeSheet) : null));
}
const yearOf = (y) => (S.out.method.timing ? S.out.method.timing.years.find((x) => x.year === y) : null);
const openYear = (y) => { const yy = yearOf(y); if (yy) openSheet(`${yy.year} ${yy.gan_zhi}年`, () => yearDetail(yy)); };
const TAB = { cover: coverTab, verify: verifyTab, chart: chartTab, bazi: baziTab, time: timeTab };

// ── 明细内容 ──
function planetDetail(p) {
  if (!p) return h('p', { class: 'faint', text: '—' });
  return col(
    h('div', { class: 'card' }, rows([['位置', `${p.sign} ${p.deg}°${pad2(p.min)}′${p.rx ? ' · 逆行' : ''}`], p.house ? ['落宫', `${p.house} 宫${p.house_kind ? ' · ' + p.house_kind : ''}`] : null, ['庙旺', p.dignity || '平'], p.rules_houses && p.rules_houses.length ? ['守护', p.rules_houses.map((x) => x + ' 宫').join('、') + (p.is_chart_ruler ? ' · 命主星' : '')] : null, p.power != null ? ['力量', `${p.power} · 第 ${p.power_rank} 名`] : null])),
    p.aspects && p.aspects.length ? h('div', { class: 'card' }, h('div', { class: 'lb', text: '相位' }), rows(p.aspects.map((a) => [a.type, a.with]))) : null);
}
function pillarDetail(x) {
  return h('div', { class: 'card' }, rows([['干支', `${x.ganZhi} · ${x.tenGod || ''}`], ['藏干', (x.hidden || []).map((y) => `${y.stem}${y.element}·${y.tenGod}`).join('　')], x.nayin ? ['纳音', x.nayin] : null, x.lifeStage ? ['十二长生', x.lifeStage] : null, x.ziZuo ? ['自坐', x.ziZuo] : null, x.kongWang ? ['空亡', x.kongWang.join('')] : null, x.shensha && x.shensha.length ? ['神煞', x.shensha.join('、')] : null]));
}
// 大运岁数统一周岁（10-06）：「3 周岁起运」，年份写到下一步交运那年；老版排盘只有虚岁时照旧显示区间
const luckAge = (l) => (l.age_kind === '周岁' ? `${l.start_age} 周岁${l.seq === 1 ? '起运' : '交运'}` : `${l.start_age}–${l.end_age} 岁`);
const luckYears = (l) => (l.age_kind === '周岁' ? `${l.start_year}–${l.start_year + 10}` : `${l.start_year}–${l.end_year}`);
function luckDetail(l) {
  const ys = (S.out.method.timing ? S.out.method.timing.years : []).filter((y) => y.year >= l.start_year && y.year <= l.end_year);
  return col(
    h('div', { class: 'card' }, rows([['年份', luckYears(l)], ['年龄', luckAge(l)], l.tier_name ? ['档位', l.tier_name] : null]), l.title ? h('div', { class: 'co-t', style: { marginTop: '6px' }, text: l.title.join(' · ') }) : null, l.line ? h('p', { class: 'co-l', text: l.line }) : null),
    ys.length ? yearsTable(ys) : null);
}
function yearsTable(ys) {
  return h('div', { class: 'card ytbl' }, ys.map((y) => {
    const t = MUTE() ? ['—', '#f4f3f1', '#999'] : TIER[y.tier] || TIER[2], lit = [...new Set([...Object.keys(y.bazi || {}), ...Object.keys(y.west || {})])].filter((k) => k !== '全局');
    return h('button', { class: 'rowd tap', type: 'button', on: { click: () => openSheet(`${y.year} ${y.gan_zhi}年`, () => yearDetail(y)) } },
      h('span', { text: String(y.year) }), h('span', { class: 'tier', style: { background: t[1], color: t[2] }, text: t[0] }),
      h('b', { style: { textAlign: 'left', fontSize: '13px' }, text: (y.shift ? '换挡 ' : '') + (lit.length ? lit.map((k) => D.domainWord(k, y.context) + (y.mirror.includes(k) ? '◆' : '')).join(' ') : '—') }), h('i', { class: 'chev', text: '›' }));
  }), h('p', { class: 'faint small', text: '◆ 八字和星盘同一年、同一块人生同时亮　换挡＝交大运前后一年，两边同一块都在动' }));
}
function yearDetail(y) {
  const t = MUTE() ? ['还没核准，先不标'] : TIER[y.tier] || TIER[2];
  const block = (title, obj) => Object.keys(obj || {}).length ? h('div', { class: 'card' }, h('div', { class: 'lb', text: title }), Object.entries(obj).map(([k, v]) => h('div', { class: 'ev' },
    h('div', { class: 'row' }, h('b', { text: D.domainWord(k, y.context) + (y.mirror.includes(k) ? ' · 两套同亮' : '') }), h('span', { class: 'faint small', text: `信号 ${v.w}${v.neg ? ' · 偏紧' : ''}` })),
    v.why.map((w) => h('p', { class: 'li small', text: w }))))) : null;
  return col(
    h('div', { class: 'card' }, rows([['年龄', `${y.age} 周岁${y.context === '学业' ? ' · 按上学的年纪说' : ''}`], ['大运', y.luck || '—'], ['整体', t[0]]])),
    y.turn && !MUTE() ? h('div', { class: 'timenote', text: y.turn }) : null,
    y.shift ? h('div', { class: 'timenote', text: `换挡年：${y.shift.when === '当年' ? '交大运这一年' : '交大运前后一年'}（${y.shift.luck}），${y.shift.domains.map((k) => D.domainWord(k, y.context)).join('、')}两边都在动。${y.shift.note}。` }) : null,
    block('八字', y.bazi), block('星盘行运', y.west),
    !Object.keys(y.bazi || {}).length && !Object.keys(y.west || {}).length ? h('p', { class: 'faint', text: '这一年没有亮灯的领域，是平稳的一年。' }) : null);
}
function shenshaSheet() {
  return col(...S.out.method.bazi.shensha.dimensions.map((x) => h('div', { class: 'card' },
    h('div', { class: 'row' }, h('span', { class: 'co-t', text: x.name }), h('span', { class: 'badge agree', text: `${x.score} 分` })),
    x.shensha.length ? h('div', { class: 'mini', style: { margin: '8px 0 6px' } }, x.shensha.map((n) => h('span', { text: n }))) : null,
    x.words ? h('p', { class: 'sub small', text: x.words }) : null)));
}
function personaSheet() {
  const p = S.out.method.persona, b = p.base, st = b.stack;
  return col(
    h('div', { class: 'card' }, h('div', { class: 'lb', text: '出厂底色' }), h('div', { class: 'type', style: { fontSize: '26px' }, text: `${b.type} ${b.name}` }), h('p', { class: 'sub small', text: b.line }),
      rows([['主导', `${st.dom.f} ${st.dom.word}`], ['辅助', `${st.aux.f} ${st.aux.word}`], ['第三', `${st.tert.f} ${st.tert.word}`], ['劣势', `${st.inf.f} ${st.inf.word}`], ['第二候选', `${b.runner_up}（${b.lead}）`]])),
    ...p.rebirth.map((r) => h('div', { class: 'card' }, h('div', { class: 'lb', text: '重生人格' }), h('div', { class: 'co-t', text: `${r.type} ${r.name}` }), r.scene ? h('p', { class: 'sub small', text: r.scene }) : null,
      rows((r.sources || []).map((x) => ['来自', x.aspect])))),
    p.buffs.length ? h('div', { class: 'card' }, h('div', { class: 'lb', text: 'Buff' }), rows(p.buffs.map((x) => [x.f, x.word]))) : null,
    p.locks && p.locks.length ? h('div', { class: 'card' }, h('div', { class: 'lb', text: '星座锁定的功能' }), rows(p.locks.map((x) => [x.planet, `${x.sign} · ${x.funcs.join(' ')}`]))) : null);
}
function monthsBaziSheet() {
  const yearCard = (yb) => h('div', { class: 'card' }, h('div', { class: 'lb', text: `${yb.year} ${yb.gan_zhi}年` }),
    yb.domains.map((dm) => h('div', { class: 'ev' }, h('b', { text: dm.domain }), rows(dm.months.map((m) => [m.gz, `${m.from.slice(5)} – ${m.to.slice(5)} · ${m.why.join('、')}`])))));
  return col(...S.out.method.timing.months_bazi.map(yearCard));
}
const lifeSheet = () => h('div', { class: 'card' }, rows(S.out.method.timing.life_cycles.map((c) => [`${c.age} 岁`, `${c.name} · ${c.year}`])));
function monthsSheet() {
  return col(...S.out.method.timing.months.map((m) => h('div', { class: 'card' },
    h('div', { class: 'row' }, h('b', { class: 'co-t', text: `${m.start} – ${m.end}` }), h('span', { class: 'badge agree', text: m.domain })),
    h('p', { class: 'sub small', text: m.why + (m.tone ? ` · ${m.tone}` : '') }),
    m.exacts && m.exacts.length ? h('p', { class: 'faint small', text: '精准：' + m.exacts.join('、') }) : null)));
}

// ── 保存、分享与继续 ──
function panel(i, n, title, ...body) {
  return h('div', { class: 'panel' }, h('div', { class: 'panel-h' }, h('b', { text: title }), h('span', { text: `${pad2(i)} / ${pad2(n)}` })), body,
    h('div', { class: 'panel-f' }, h('span', { text: S.id }), h('span', { text: 'XUANJI · ASTRO' })));
}
function dossier() {
  const o = S.out, r = D.reliability(o), st = ST(), w = o.method.west, d = o.western.data, bz = o.bazi.status === 'ok' ? o.bazi.bazi : null, mb = o.method.bazi, p = o.method.persona, stg = D.stage(o, S.nowY);
  const N = 5, out = [], ansW = Object.fromEntries(D.ANSWERS);
  out.push(panel(1, N, '出生时间', rows([['钟表时间', r.clock || '不详'], ['真太阳时', r.solar || '—'], ['出生地', r.place ? r.place.name : o.birth.city], r.place ? ['经纬度', `${r.place.lat.toFixed(2)}°N · ${r.place.lon.toFixed(2)}°E`] : null, ['时间来源', r.source], ['精度', r.precision], ['结论', r.head]])));
  if (d && w && w.big3) out.push(panel(2, N, '本命星盘', wheel(d), rows([['太阳', `${w.big3.sun.sign} ${w.big3.sun.house} 宫`], ['月亮', `${w.big3.moon.sign} ${w.big3.moon.house} 宫`], ['上升', `${w.big3.asc.sign} ${w.big3.asc.deg}°${pad2(w.big3.asc.min)}′`]])));
  if (bz) out.push(panel(3, N, '八字核心', h('div', { class: 'pillars' }, ['year', 'month', 'day', 'hour'].map((k, i) => { const x = bz.pillars[k]; return h('div', { class: 'pl' + (k === 'day' ? ' me' : '') }, h('small', { text: ['年柱', '月柱', '日柱', '时柱'][i] }), h('span', { class: 'gz', text: x ? x.gan : '?' }), h('span', { class: 'gz', text: x ? x.zhi : '?' })); })),
    rows([['日主', `${mb.day_master.gan}${mb.day_master.element} · ${mb.day_master.image}`], st ? ['身强身弱', st.verdict] : null, mb.pattern ? ['格局', mb.pattern.name] : null, stg && stg.luck ? ['当前大运', `${stg.luck.gan_zhi} ${stg.luck.start_year}–${stg.luck.end_year}`] : null])));
  if (p) out.push(panel(4, N, '星盘人格', rows([['出厂底色', `${p.base.type} ${p.base.name}`], ['重生人格', p.rebirth.map((x) => x.type).join(' · ')], p.buffs.length ? ['Buff', p.buffs.map((x) => x.f).join(' ')] : null])));
  out.push(panel(5, N, '已验证节点与当前阶段', S.nodes.length ? rows(S.nodes.map((x) => [`${x.year}`, `${x.domain} · ${ansW[S.ans[x.id]] || '待核对'}`])) : h('p', { class: 'faint', text: '没有可验证的过去节点。' }),
    stg ? h('div', { class: 'mini' }, stg.years.map((y) => h('span', { text: `${y.year} ${y.items.slice(0, 2).map((x) => x.domain).join('·')}` }))) : null));
  return col(...out);
}
function share() {
  const o = S.out, sn = D.seen(o, S.nowY), reasons = D.founderReasons(o, S.nodes, S.ans, FS(), HELD()), stg = D.stage(o, S.nowY), p = o.method.persona, mb = o.method.bazi;
  const text = D.handoff(o, S.nodes, S.ans, { nowY: S.nowY, tool: TOOL, fs: FS(), held: HELD(), hour: HOUR() });
  setBar({ pill: '‹ 回到结果' });
  const sig = [p && `底色 ${p.base.type} ${p.base.name}`, mb && `${mb.day_master.gan}${mb.day_master.element}日主 · ${mb.day_master.image}`, stg && stg.now ? stg.now.text.replace(/，八字和星盘同时亮$/, '') : null].filter(Boolean);
  const numbered = (no, title, tag, sub, build, open) => {
    const box = h('div', { class: 'numd' + (open ? ' open' : '') }), body = h('div', { class: 'numd-b' }); let built = false;
    const toggle = () => { if (!built) { body.append(build()); built = true; } box.classList.toggle('open'); };
    box.append(h('button', { class: 'numd-h', type: 'button', on: { click: toggle } }, h('span', { class: 'no', text: no }), h('div', {}, h('div', {}, h('b', { text: title }), h('span', { class: 'tag', text: tag })), h('p', { text: sub })), h('em', {}, h('span', { class: 'acc-t' }), h('i'))), body);
    if (open) { body.append(build()); built = true; }
    return box;
  };
  return h('section', { class: 'v' },
    h('div', { class: 'eyebrow', text: 'SAVE / SHARE / CONTINUE' }), h('h2', { class: 'h1', text: '保存、分享与继续解读' }),
    h('p', { class: 'lead', text: '分享卡用于发布，玄玑底图用于阅读与转交，结构数据用于继续分析。三者均在本机生成。' }),
    h('div', { class: 'numds' },
      numbered('01', '分享卡', '发布', '一张由这张盘驱动的封面，保留最少但最鲜明的个人签名。', () => col(coverCard(),
        sn.head ? h('div', { class: 'cover' }, h('div', { class: 'ct' }, img('mark', ''), 'XUANJI · 玄玑看见的你'), h('div', { class: 'cl', text: sn.head.line }), h('div', { class: 'ce' }, sig.map((x) => h('div', { text: x }))), h('div', { class: 'cf' }, h('span', { text: '西盘 × 八字 × 人格' }), h('b', { text: '执天玄玑' }))) : null,
        h('p', { class: 'faint small center', text: '两张都可以用系统截图保存' })), true),
      numbered('02', '玄玑底图', '阅读与转交', '五张同一装帧的结构卡：出生时间、星盘、八字、人格、已验证节点。', () => col(dossier(), h('p', { class: 'faint small center', text: '逐张截图保存' }))),
      numbered('03', '完整结构数据', '最高保真', '全选后交给支持 Xuanji Skill 的 AI，继续更深入的阅读。', () => {
        const pre = h('pre', { class: 'kl', text }), hint = h('div', { class: 'faint small center' });
        return col(h('p', { class: 'sub small', text: '数据自带接收方说明：装了 Skill 先重算核对；没装就直接读，并说明没有重算。' }), pre,
          h('button', { class: 'btn-ghost', type: 'button', text: '全选结构数据', on: { click: () => { const r = document.createRange(); r.selectNodeContents(pre); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); hint.textContent = '已全选，用系统菜单里的「拷贝」'; } } }), hint);
      })),
    h('div', { class: 'gap' }),
    ...h2('继续整理这张盘', '结构数据已就绪。按你的使用方式，选择一条继续的路径。'),
    h('div', { class: 'card route' }, h('div', { class: 'lb', text: 'A · 已经会用 Skill' }), h('p', { text: '在小红书搜索「山玉居士」（小红书号 622843294），于主页帖子获取开源 Skill。安装后将完整结构数据交给你的 AI 助手，继续提问事业、关系、阶段与具体事件。' })),
    h('div', { class: 'card route founder' }, h('div', { class: 'lb', text: 'B · 创始人复核' }), reasons.length ? h('h3', { text: '这张盘还有一层值得人工复核' }) : null,
      h('p', { text: (reasons.length ? reasons.join('；') + '。' : '') + '机器已把结构算清，复杂的取舍由创始人复核。在小红书私信「山玉居士」（小红书号 622843294），发送「深读」与上方结构数据，由创始人代为操作并解读。' })),
    h('div', { class: 'card route' }, h('div', { class: 'lb', text: 'C · 存进玄玑档案' }), h('p', { text: '让玄玑记住这是同一个你。网站目前为邀请内测：经由 Skill 存入档案后，本次标注的验证节点会一并保留，作为后续校准的依据。' })),
    h('button', { class: 'linkrow', type: 'button', on: { click: () => go('method') } }, h('div', {}, h('b', { text: '方法与边界' }), h('span', { text: '计算体系、精度与适用范围' })), h('i', { class: 'chev', text: '→' })));
}

// ── 方法与边界 ──
// 技术口径披露：每一条都对过引擎源码（computeNatal_受控版.js、paipan/、engine/src/），改口径要连这里一起改。
const FAQ = [
  ['体系基础', [
    ['本工具采用哪些体系？', '西方占星：回归黄道、Placidus 宫制、五种主要相位；八字：子平法四柱，排盘引擎 mingyu-core；星盘人格：由星盘推出的人格结构模型（出厂底色）。三套体系各自独立计算，互不借数。'],
    ['为什么同时使用星盘与八字？', '单一体系的命中可能出于巧合。只有当两套体系在同一年份、同一人生领域同时触发，才作为可验证的结论输出；本工具的过去节点与「两套同亮」标注都遵循这一条。'],
  ]],
  ['星历与精度', [
    ['行星位置如何计算？', '以 Astronomy Engine 计算地心视黄经（含光行差），换算至回归黄道。凯龙星与谷神、智神、婚神、灶神取自独立的小行星星历；凯龙与主流中文排盘软件的对照误差约 8 角分。'],
    ['灵神星、爱神星、恒星、精神点从哪里来？', '灵神星、爱神星取自 JPL Horizons 星历，与 JPL 地心黄经对照最大误差不足 0.5 角分。六颗恒星（轩辕十四、角宿一、心宿二、毕宿五、北落师门、大陵五）以 J2000.0 黄经按每年 50.29″ 推算岁差，只标与十大行星、四轴 1° 内的合相。精神点与福点共用昼夜判定。以上与半刑、补八分、梅花三种小相位一样，只在盘面显示，不参与任何计分与推算。'],
    ['交点与莉莉丝用平均值还是真实值？', '北交点、南交点为平均交点（Mean Node），恒为逆行；莉莉丝为平均远地点（Mean Lilith）。'],
    ['相位容许度是多少？', '合 8°、冲 8°、刑 6°、拱 6°、六合 4°。星盘图与相位表使用同一张容许度表。'],
    ['行星力量排名如何得出？', '本质力量（庙 1.5、旺 1.3、平 1.0、弱 0.7、陷 0.5）× 落宫（角宫 1.2、续宫 1.0、果宫 0.8）× 相位扶克修正；逆行另乘 0.7。'],
  ]],
  ['时间与坐标', [
    ['出生地坐标从哪里来？', '全国省、市、区三级行政区坐标库（GCJ-02）。只选到市一级时，取该市各区坐标的平均值。占星用途下的坐标误差可忽略。'],
    ['时区与夏令时如何处理？', '统一按 UTC+8。1986–1991 年中国实行夏令时，按当年起止日 02:00 的边界精确扣除。海外出生暂不支持。'],
    ['星盘与八字为什么用不同的时间？', '星盘按钟表时间与出生地经纬度排；八字按真太阳时（经度时差加均时差）定时柱。两者相差几分钟到几十分钟属正常。'],
    ['出生时间不确定怎么办？', '先看「出生时间可信度」：离时辰交界、上升换座与宫头都远，几分钟误差不改结论；卡在时辰交界上的，可以在验证页用你的经历「定一下时辰」；只知大概时间，建议校时，可申请创始人复核。'],
  ]],
  ['八字口径', [
    ['年、月以什么为界？', '立春换年，节气换月；23:00 换日线采用晚子时口径，与排盘引擎保持一致。'],
    ['喜用与格局从哪里来？', '八字分扶抑、调候、格局三派，各按自己整套方法算喜用和每年的顺逆，不拼各派的一半。做个身强身弱校正，对上哪一派就按哪一派说；还没核准时先按一派说，页面上标着。日主意象、格局花名与大运标题取自玄玑生辰页的同一套词库。'],
  ]],
  ['身强身弱 · 怎么算、为什么、怎么复核', [
    ['身强身弱是什么？为什么要判？', '说的是日主（出生那天的天干，代表你自己）在整张盘里有多大力量。它决定喜用：身强的人宜克泄耗，把力气用出去；身弱的人宜生扶，要有人帮、有底气。判反了，喜用整个反过来，后面的方向、每年顺不顺都会读反，所以要认真判。\n判强弱之前会先看整张盘是不是特殊格局（比如「从格」）；是的话不按身强身弱这套论，喜忌另有算法。'],
    ['怎么算的？', '三种判法各自独立投一票，票只给起点：方向一致，结论先照它给；说法不一样，就做个身强身弱校正（见第 4 条）。不管哪种，你校正过的才算定。\n① 排盘引擎：看月令（出生的季节帮不帮你）、通根（地支里有没有你的根）、得势（其余各柱帮你还是耗你），分七档；\n② 旺衰打分法：把得令、长生、得地、天干得势逐项打分相加；\n③ 新派：出生季节占一半分量，再看其余各柱。\n西方星盘不进身强身弱：东方的事用东方的判法加你的经历判，星盘只在报告里跟八字并排讲。'],
    ['为什么要三种一起投？', '每一派都有盲区：有的偏重季节，有的偏重根，有的只数五行多寡。几家一致的地方最可靠；不一致，说明光看盘判不了，这时候不硬判。'],
    ['三种判法说法不一样，怎么定？', '做个身强身弱校正，跟玄玑网站、Xuanji Skill 是同一套题和算法。\n① 8 道日常小题：做事的节奏、压力大时怎么办、拿主意靠什么……每题 5 个选项，有的像身强的人，有的像身弱的人，有的两边都有。不告诉你哪个选项偏哪边。\n② 再说几件这些年的大事：哪一年、什么事、对你来说是好事还是坏事。每一件按那一年的流年加上你当时走的大运来看：身强、身弱的人各喜一半的五行，那几个字落在哪边多，那一年就对哪边顺；事情顺，算那边的证据，不顺，算另一边的。流年和大运落在同一边的，分量重一点。\n两类合起来，一边比另一边多出 3 分以上、并且至少 4 分，才定下来；拉不开就先保持原来的看法，多说几件大事再看一次。\n三种判法说法一致时结论照给；你有疑问，也可以自己校正一次。'],
    ['为什么以你的经历为准？', '三种判法看的是同一张盘，打架时谁也说服不了谁；你平时是什么样的人、过去的日子怎么过来的，是盘以外唯一的证据。拿真实的样子和发生过的事去验两套读法，哪一套对得上就用哪一套：不是感觉压过道理，是用事实验算法。'],
    ['以后某一年感觉对不上，结论会变吗？', '不会。身强身弱是盘的结构，定下来不随年份变；每年顺不顺是天气，还受大运、身边的人和自己的选择影响。偶尔一年对不上是正常的，不因此翻案。走到帮身或耗身的大运，十年里感觉会整体偏一边，那是季节，不是结构变了。\n前提是盘不变：如果出生时间改了、换了一张盘，以新盘为准重判一次；你之前的回答照样拿来对照新盘。'],
    ['还是有疑问，怎么复核？', '随时可以重新校正。上次选的会先勾好，你改了再看结果；看完结果点「确定修改」才换，点「不修改」就照旧。\n校正出来的结论跟原来相反时，喜用、大运和整条时间线都按新结论重排，页面上会明说，不会悄悄换。仍有争议，可以把盘和你的回答交给创始人人工复核（见「保存、分享与继续」）。'],
  ]],
  ['定时辰 · 什么时候需要、怎么定、边界在哪', [
    ['定时辰是什么？什么时候需要？', '八字的最后一柱是时柱，两个小时换一个时辰。出生时间离时辰交界很近，时间又不是出生证上的（比如家里人回忆的），差几分钟就可能落到隔壁时辰，时柱整个换掉。只有这种时候才需要定。\n时间来自出生证、医院记录的，按记录排，不来回翻；离交界远的，也不用定。'],
    ['卡在交界上，会影响什么？', '时柱换了，八字里看子女、晚年的那一柱就换了，格局的成色和喜忌也可能跟着变；星盘上，上升点附近、压在宫位分界上的星，落在哪一宫可能会变。\n差十几分钟，整张盘的大结构通常不动，变的主要是时柱和这几处。'],
    ['怎么定的？', '把时间挪到交界另一侧，再排一张盘。两张盘放在一起，用你自己的经历去对：\n① 你先说几件记得清的大事：哪一年、什么事、对你来说是好事还是坏事，跟身强身弱校正是同一份，说过的直接带上；有孩子的，说一下孩子哪年出生。\n② 再专门问你几年：只挑两张盘说法正好相反的年份，问那一年有没有某类事（比如换工作、升职、搬家），你答「有／没有／记不清」；答「有」的，再说一句是好事还是坏事。'],
    ['怎么判？', '分两票。\n第一票看事：你说的大事和专门问的年份分开记账，合在一起判。一边要明显多出一截（多出四分之一以上），而且至少有两件站在这一边，才记这一票；不够就不记，宁可存疑，不降标准凑票。\n第二票看好坏：只看两张盘对那一年说法相反的（一张说顺、一张说闷），好事记给说顺的那张，坏事记给说闷的那张；同一年好坏都有的不记；至少两件指向同一张，而且多过另一张。\n孩子的出生年份不单独成票，只在两票一比一时用来打破平局。\n两票合起来：两票指向同一张，或者只有一票，就定这张；一比一时看孩子的出生年份；一票都没有，就先存疑。\n结果只有三种：原来的时辰、隔壁的时辰、还分不出来。分数由程序按固定规则算，不由人或 AI 现场判断，每个人用的是同一套规则（跟 Xuanji Skill 是同一份打分程序）。'],
    ['为什么不直接问「你觉得自己像哪个时辰」？', '感觉会被描述带着走。我们只问发生过什么、是好事还是坏事：不告诉你哪一年是为哪个时辰问的，也不暗示「按某张盘你那年该有什么」；题里的「比如」每个人都一样。「记不清」可以答，不算分，不硬让你回忆。'],
    ['分不出来怎么办？', '先存疑。跟时柱有关的说法两种都有可能，其他照常看。想彻底定下来，最直接的办法是找出生证或医院记录。'],
    ['定下来以后呢？', '就按定下来的时辰往下看，不再反复让你复核。定在隔壁时辰的，各页都改用那张盘，身强身弱也按新盘重判；你做身强身弱校正时的回答照样带过去，按新盘重算。\n只说定在哪个时辰，不报具体几点几分：挪过去的时间只是交界另一侧的一个代表时间，要精确到分钟的说法（比如上升、宫头）也不跟着定。'],
    ['你说的大事会去哪？', '只记哪一年、哪类事、好事还是坏事，不记你讲的细节；打分在这台手机上算，不上传，也不联网。'],
    ['这个方法管不到的', '时辰完全不知道的（十二个都有可能），不做，照年月日三柱排，跟时柱有关的结论不说；\n上升、天顶卡在换星座边界的，只如实告诉你，不拿来打分定；\n晚年的事（时柱主 48 岁以后）这一版还不拿来对。'],
  ]],
  ['应期与验证', [
    ['过去节点如何选取？', '八字流年（v2.1）与西盘行运（v1）分别计分，取二者在同一年、同一领域同时亮起的年份；按信号强度排序，领域不重复、年份间隔三年以上，至多三条。'],
    ['「顺风」「逆风」指什么？', '流年档位，由排盘引擎在所属大运内逐年给出，共五档：顺风、偏顺、平稳、偏紧、逆风。'],
    ['同一张盘每次结果一致吗？', '一致。计算全程不使用随机数；需要多选一的文案按盘面指纹确定性选取。'],
  ]],
  ['使用边界', [
    ['这些结果该如何使用？', '盘面与推算由系统计算；明显、部分、不符合由你亲手标注。本工具只呈现结构，不做长篇解读，深度解读交由 Xuanji Skill 与创始人。'],
    ['出生信息保存在哪里？', '全部计算在本机完成，不联网；最近五张盘，你做身强身弱校正时选的答案，以及你说的大事（哪一年、哪类事、好事坏事），保存在本机的小工具存储中，可在首页删除。'],
  ]],
];
function method() {
  const prev = NAV[depth - 1] && NAV[depth - 1][0];
  setBar({ pill: prev === 'share' ? '‹ 回到分享' : prev === 'result' ? '‹ 回到结果' : '‹ 首页' });
  const o = S.out;
  return h('section', { class: 'v' },
    h('div', { class: 'eyebrow', text: 'METHOD · 方法与边界' }), h('h2', { class: 'h1', text: '方法与边界' }),
    h('p', { class: 'lead', text: '这里披露本工具采用的体系、计算口径，以及可能与其他软件产生差异的地方，帮助你判断结果的适用范围。' }), divd(),
    FAQ.map(([g, qs]) => [h('div', { class: 'eyebrow', text: g }), h('div', { class: 'accs' }, qs.map(([q, a]) => acc(q, null, () => h('div', {}, a.split('\n').map((t) => h('p', { class: 'sub fe-p', text: t }))))))]),
    h('div', { class: 'card spec' },
      h('div', { class: 'spec-r' }, h('b', { text: '这个版本' }), h('p', { text: '离线观测版 0.1：全部在本机计算。更完整的推算与长篇解读在 Xuanji Skill 与玄玑网站。' })),
      o ? h('div', { class: 'spec-r' }, h('b', { text: '引擎' }), h('p', { class: 'mono', text: `natal ${o.version.natal} · astro-mbti ${o.version.astro_mbti} · ${o.method.timing ? o.method.timing.schema : ''}` })) : null,
      h('div', { class: 'spec-r' }, h('b', { text: '开源' }), h('p', { text: '本工具以 AGPL-3.0 许可开源，源码与第三方许可见 GitHub 仓库 xuanji-astro-minitool。八字排盘基于 mingyu-core（AGPL-3.0），天文计算 Astronomy Engine（MIT），标题字体由思源宋体子集化（SIL OFL 1.1）。' })),
      h('div', { class: 'spec-r' }, h('b', { text: '使用边界' }), h('p', { text: '本工具依据既定计算规则生成结构化结果，用于文化研究、自我探索与信息整理；不构成医疗、法律、财务、关系、教育、职业等专业建议，也不替你做决定。重要决定请依据可验证的信息、适当的专业意见与自己的判断。' }))),
    h('div', { class: 'foot' }, h('div', { class: 'motto', text: '盘定战场，不定战役。' })));
}

const VIEWS = { home, form, busy, fail, result, share, method, calib, calibEv, calibRes, rect, rectAsk, rectDone };
addEventListener('scroll', () => document.body.classList.toggle('scrolled', window.scrollY > 8), { passive: true });
hist('replaceState', 0);
show('home');
