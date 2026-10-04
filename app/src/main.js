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
const S = { input: null, out: null, nodes: [], ans: {}, id: null, tab: 'cover', nowY: new Date().getFullYear() };
let X_ = { out: null, x: null };
const X = () => (X_.out === S.out ? X_.x : (X_ = { out: S.out, x: extras(S.out) }).x);   // 盘面扩展：每张盘只算一次
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
    S.input = input; S.out = out; S.id = D.chartId(input); S.nodes = D.pickNodes(out); S.tab = 'cover';
    const old = store.get(S.id); S.ans = (old && old.answers) || {};
    const w = out.method.west;
    store.put({ id: S.id, input, form: formState, place: out.birth.place ? out.birth.place.name : input.city, answers: S.ans, at: Date.now(),
      tags: { base: out.astro_mbti && out.astro_mbti.base_type, asc: w && w.big3 && w.big3.asc ? w.big3.asc.sign : null } });
    if (still()) swap('result');
  } catch (e) { if (still()) swap('fail', e, formState); }
}
function reopen(id) {
  const r = store.get(id); if (!r) return;
  go('busy'); const tok = depth;
  const still = () => depth === tok && NAV[depth][0] === 'busy';
  setTimeout(async () => {
    try {
      await engineReady; S.input = r.input; S.out = window.XJ.compute(r.input); S.id = id; S.nodes = D.pickNodes(S.out); S.ans = r.answers || {}; S.tab = 'cover';
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
  const o = S.out, r = D.reliability(o), b = o.birth, w = o.method.west;
  const where = r.place ? shortPlace(r.place.name) : b.city;
  const body = h('div', { class: 'tabbody' });
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const paint = () => {
    tabs.replaceChildren(...TABS.map(([k, t]) => h('button', { class: 'tab' + (S.tab === k ? ' on' : ''), type: 'button', role: 'tab', text: t, on: { click: () => { S.tab = k; paint(); window.scrollTo(0, Math.min(window.scrollY, top.offsetTop)); } } })));
    body.replaceChildren(TAB[S.tab](), endLinks());
  };
  const top = h('div', { class: 'rhead' },
    h('div', { class: 'rh-t', text: `${where} · ${b.date}${b.time ? ' ' + b.time : ''}` }),
    h('div', { class: 'rh-s' }, w && w.big3 && w.big3.asc ? `上升 ${w.big3.asc.sign}座 · ` : '', `有效精度 ${b.time ? PREC[b.time_precision] || '未标注' : '时辰不详'} · 可信度 `, h('b', { class: 'verdict-' + r.level, text: { ok: '可放心使用', sensitive: '边界敏感', check: '建议校时' }[r.level] })));
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
  return h('div', { class: 'covercard' },
    h('div', { class: 'cc-top' }, h('span', { text: 'XUANJI OBSERVATION' }), h('span', { class: 'mono', text: S.id })),
    h('div', { class: 'cc-t1', text: t1 }), t2 ? h('div', { class: 'cc-t2', text: t2 }) : null,
    h('div', { class: 'cc-mid' }, h('div', { class: 'cc-caps' }, caps.map((x) => h('div', { text: x }))), emblem),
    h('div', { class: 'cc-cells' }, cells.map(([k, v]) => h('div', {}, h('span', { text: k }), h('b', { text: v })))),
    h('div', { class: 'cc-foot' }, h('span', { class: 'mono', text: `${b.date}${b.time ? ' ' + b.time : ''} · ${r.place ? `${r.place.lat.toFixed(1)}°N ${r.place.lon.toFixed(1)}°E` : b.city}` }), h('b', { text: '执天玄玑' })));
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
  const o = S.out, r = D.reliability(o), st = D.strength(o), t = D.tally(S.nodes, S.ans), stg = D.stage(o, S.nowY);
  const nxt = stg && stg.years.flatMap((y) => y.items.filter((x) => x.mirror).map((x) => `${y.year} 年${x.domain}窗口`))[0];
  const items = [
    r.solid ? ['ok', '已确认', `出生时间来源：${r.source}`, 'verify'] : ['q', '待确认', `出生时间来源：${r.source}`, 'verify'],
    st ? (st.kind || st.side === '待定' ? ['q', '待确认', `身强身弱：${st.verdict}`, 'verify'] : ['ok', '已判定', `身强身弱：${st.verdict}`, 'verify']) : null,
    S.nodes.length ? (t.open ? ['w', '待核对', `过去节点：${S.nodes.length - t.open} / ${S.nodes.length}`, 'verify'] : ['ok', '已验证', `过去节点：${S.nodes.length} 个`, 'verify']) : null,
    r.level !== 'ok' ? ['q', '待确认', '出生时间边界', 'verify'] : null,
    nxt ? ['w', '待观察', nxt, 'time'] : null,
  ].filter(Boolean);
  return h('div', { class: 'card prog' }, h('div', { class: 'lb', text: '玄玑已经认识你到这里' }),
    h('ul', {}, items.map(([c, k, v, tab]) => h('li', { class: 'st-' + c }, h('button', { type: 'button', on: { click: () => goTab(tab) } }, h('span', { text: k }), h('em', { text: v }), h('i', { class: 'chev', text: '›' }))))));
}

// ── 标签二：验证（时间可信度／身强身弱／过去节点）──
const diffMin = (a, b) => { const [ha, ma] = a.split(':').map(Number), [hb, mb] = b.split(':').map(Number); let d = hb * 60 + mb - (ha * 60 + ma); if (d > 720) d -= 1440; if (d < -720) d += 1440; return d === 0 ? '一致' : `${d > 0 ? '晚' : '早'} ${Math.abs(d)} 分钟`; };
function verifyTab() {
  const o = S.out, r = D.reliability(o), st = D.strength(o), b = o.birth;
  const out = [];
  out.push(...h2('出生时间可信度', '先校验出生时间对盘面的影响范围，再进入解读。'),
    h('div', { class: 'card' }, h('div', { class: 'vt verdict-' + r.level, text: r.head }),
      rows([['钟表时间', r.clock || '不详'], r.clock ? ['真太阳时', r.solar ? `${r.solar}（${diffMin(r.clock, r.solar)}）` : '—'] : null, r.clock ? ['时间来源', r.source] : null, r.clock ? ['精度', r.precision] : null]),
      r.risks.length ? h('div', { class: 'timenote' + (r.level === 'ok' ? '' : ' warn') }, r.risks.map((x) => h('div', { text: x.text }))) : h('div', { class: 'timenote', text: '时辰、上升、天顶都离交界有一段距离，宫头上也没有压着的星。' })),
    acc('查看依据', '真太阳时、时辰交界、上升换座、宫头', () => h('div', { class: 'why' },
      r.risks.filter((x) => x.why).map((x) => h('p', {}, h('b', { text: x.text }), h('br'), x.why)),
      r.solar ? h('p', { text: '八字按出生地的真太阳时排时柱：钟表时间按经度和当天的均时差校正。星盘按钟表时间排，1986–1991 年的夏令时已经扣掉。' }) : null,
      h('p', { text: '离交界越近，出生时间差几分钟就越可能改掉结论；所以玄玑先说清楚这张盘能用到哪一步。' }))));
  if (st) out.push(h('div', { class: 'gap' }), ...h2('身强身弱', '三套判法独立投票；西盘主体力量仅作佐证，不计票。'),
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', {}, h('div', { class: 'lb', text: '玄玑结论' }), h('div', { class: 'type', text: st.verdict })), h('span', { class: 'badge ' + (st.kind ? 'warn' : 'agree'), text: st.agree })),
      rows(st.votes.map((v) => [v.school, v.level, v.why ? () => openSheet(v.school, () => h('div', { class: 'card' }, h('p', { text: v.why }))) : null]).concat(st.west ? [['西盘主体力量', `${st.west}（佐证）`]] : [])),
      st.review ? h('div', { class: 'timenote warn', text: st.review }) : null),
    acc('为什么不是数五行？', '月令、通根、得势和喜忌', () => h('div', { class: 'why' },
      h('p', { text: '身强身弱看的是日主有没有得到支撑，不是哪种五行个数多。三路判法各看一个侧面：' }),
      st.basis.map((x) => h('p', { class: 'li', text: x })),
      st.votes.filter((v) => v.why).map((v) => h('p', { class: 'li' }, h('b', { text: v.school + '：' }), v.why)),
      st.favorable.length ? h('p', {}, h('b', { text: '喜用：' }), st.favorable.join(' '), st.unfavorable.length ? `　忌：${st.unfavorable.join(' ')}` : '') : null,
      st.kind ? h('p', { text: '几路判法说法不一样时，玄玑不硬判，要用过去发生过的事继续确认。' }) : null)));
  out.push(h('div', { class: 'gap' }), ...nodesBlock());
  return col(...out);
}
function nodesBlock() {
  const nodes = S.nodes;
  const head = h2('让玄玑看看你经历过什么', nodes.length ? '以下年份由八字流年与西盘行运在同一人生领域同时触发。请逐条标注：明显、部分、不符合。' : (S.out.birth.time ? '本盘未检出两套体系同时触发的过去年份；单一体系的信号不作为验证项。' : '出生时间不详，西盘行运无法落宫；本项只在两套体系同时触发时输出，故暂缺。'));
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
  const o = S.out, bz = o.bazi.status === 'ok' ? o.bazi : null, mb = o.method.bazi, st = D.strength(o), stg = D.stage(o, S.nowY);
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
      mb.useful && mb.useful.useful ? (tiao
        ? ['用神 / 忌神', [`${mb.useful.useful} / ${mb.useful.avoid || '—'}`, h('small', { class: 'kv-note', text: '调候取用' })], () => openSheet('调候取用', () => tiaoSheet(bz, mb, st))]
        : ['用神 / 忌神', `${mb.useful.useful} / ${mb.useful.avoid || '—'}`]) : null,
      mb.lucky ? ['幸运色', mb.lucky.colors.map((c) => c.name).join('、')] : null, mb.lucky && mb.lucky.directions ? ['方位', mb.lucky.directions.join('、')] : null,
      mb.fit && mb.fit.jobs.length ? ['适合行业', mb.fit.jobs.slice(0, 5).join('、')] : null])),
    mb.shensha && mb.shensha.dimensions ? [h('div', { class: 'gap' }), ...h2('神煞', '仅列辨识度较高的维度；完整明细可展开。'),
      h('div', { class: 'card ss' }, mb.shensha.dimensions.map((x) => h('button', { class: 'ssr tap', type: 'button', on: { click: () => openSheet('神煞', shenshaSheet) } },
        h('span', { text: x.name }), h('div', { class: 'bar' }, h('i', { style: { width: Math.max(4, Math.min(100, x.score)) + '%' } })), h('span', { class: 'ssv', text: String(x.score) }))))] : null,
    mb.luck ? [h('div', { class: 'gap' }), ...h2('大运', '十年一运；展开可查看该运内逐年的触发领域。'),
      h('div', { class: 'card' }, h('div', { class: 'lucks' }, mb.luck.slice(0, 8).map((l) => h('button', { class: 'lk tap' + (stg && stg.luck && stg.luck.seq === l.seq ? ' now' : ''), type: 'button', on: { click: () => openSheet(`${l.gan_zhi}大运`, () => luckDetail(l)) } }, h('b', { text: l.gan_zhi[0] }), h('b', { text: l.gan_zhi[1] }), h('span', { text: `${l.start_age}岁` })))))] : null);
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
    h('div', { class: 'eyebrow', text: '你现在所在的时间段' }),
    L ? h('div', { class: 'now' }, h('div', { class: 'now-t', text: `${L.gan_zhi}大运 · ${stg.gz}流年` }), h('div', { class: 'now-s', text: `${L.start_year} — ${L.end_year}　${L.title ? L.title.join(' · ') : ''}` }),
      next ? h('div', { class: 'now-s', text: `下一步大运：${next.start_year} 年起 ${next.gan_zhi}` }) : null, h('div', { class: 'progress' }, h('i', { style: { width: pct + '%' } }))) : null,
    ...h2('接下来三年', '按年列出八字与西盘的触发领域；「两套同亮」为两套体系同年同域触发。'),
    stg.years.map((y) => h('button', { class: 'next tap', type: 'button', on: { click: () => openYear(y.year) } },
      h('span', { class: 'y', text: String(y.year) }),
      h('span', { class: 'd' }, y.items.slice(0, 4).map((x) => h('span', { class: 'dom' + (x.mirror ? ' mirror' : ''), text: x.domain + (x.mirror ? ' · 两套同亮' : '') }))),
      h('i', { class: 'chev', text: '›' }))),
    h('div', { class: 'gap' }), ...h2('按需展开完整周期', '上方为当前所处阶段；完整计算表保留于此，追溯前后周期时展开。'),
    h('div', { class: 'accs' },
      acc('完整大运表', `${mb.luck.length} 个阶段 · 查看完整人生周期`, () => rows(mb.luck.map((l) => [`${l.start_age}–${l.end_age} 岁`, `${l.gan_zhi} · ${l.start_year}–${l.end_year}${L && L.seq === l.seq ? ' · 当前' : ''}`, () => openSheet(`${l.gan_zhi}大运`, () => luckDetail(l))]))),
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
function luckDetail(l) {
  const ys = (S.out.method.timing ? S.out.method.timing.years : []).filter((y) => y.year >= l.start_year && y.year <= l.end_year);
  return col(
    h('div', { class: 'card' }, rows([['年份', `${l.start_year}–${l.end_year}`], ['年龄', `${l.start_age}–${l.end_age} 岁`], l.tier_name ? ['档位', l.tier_name] : null]), l.title ? h('div', { class: 'co-t', style: { marginTop: '6px' }, text: l.title.join(' · ') }) : null, l.line ? h('p', { class: 'co-l', text: l.line }) : null),
    ys.length ? yearsTable(ys) : null);
}
function yearsTable(ys) {
  return h('div', { class: 'card ytbl' }, ys.map((y) => {
    const t = TIER[y.tier] || TIER[2], lit = [...new Set([...Object.keys(y.bazi || {}), ...Object.keys(y.west || {})])].filter((k) => k !== '全局');
    return h('button', { class: 'rowd tap', type: 'button', on: { click: () => openSheet(`${y.year} ${y.gan_zhi}年`, () => yearDetail(y)) } },
      h('span', { text: String(y.year) }), h('span', { class: 'tier', style: { background: t[1], color: t[2] }, text: t[0] }),
      h('b', { style: { textAlign: 'left', fontSize: '13px' }, text: lit.length ? lit.map((k) => k + (y.mirror.includes(k) ? '◆' : '')).join(' ') : '—' }), h('i', { class: 'chev', text: '›' }));
  }), h('p', { class: 'faint small', text: '◆ 八字和星盘同一年、同一块人生同时亮' }));
}
function yearDetail(y) {
  const t = TIER[y.tier] || TIER[2];
  const block = (title, obj) => Object.keys(obj || {}).length ? h('div', { class: 'card' }, h('div', { class: 'lb', text: title }), Object.entries(obj).map(([k, v]) => h('div', { class: 'ev' },
    h('div', { class: 'row' }, h('b', { text: k + (y.mirror.includes(k) ? ' · 两套同亮' : '') }), h('span', { class: 'faint small', text: `信号 ${v.w}${v.neg ? ' · 偏紧' : ''}` })),
    v.why.map((w) => h('p', { class: 'li small', text: w }))))) : null;
  return col(
    h('div', { class: 'card' }, rows([['年龄', `${y.age} 岁`], ['大运', y.luck || '—'], ['整体', t[0]]])),
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
  const o = S.out, r = D.reliability(o), st = D.strength(o), w = o.method.west, d = o.western.data, bz = o.bazi.status === 'ok' ? o.bazi.bazi : null, mb = o.method.bazi, p = o.method.persona, stg = D.stage(o, S.nowY);
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
  const o = S.out, sn = D.seen(o, S.nowY), reasons = D.founderReasons(o, S.nodes, S.ans), stg = D.stage(o, S.nowY), p = o.method.persona, mb = o.method.bazi;
  const text = D.handoff(o, S.nodes, S.ans, { nowY: S.nowY, tool: TOOL });
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
    ['出生时间不确定怎么办？', '先看「出生时间可信度」：离时辰交界、上升换座与宫头都远，几分钟误差不改结论；临近边界或只知大概时间，建议校时，可申请创始人复核。'],
  ]],
  ['八字口径', [
    ['年、月以什么为界？', '立春换年，节气换月；23:00 换日线采用晚子时口径，与排盘引擎保持一致。'],
    ['身强身弱如何判定？', '排盘引擎（月令、通根、得势七档）、易奇旺衰分、新派（月令为主）三票多数决。强弱相反时记为硬分歧，不输出结论；有一路判到极档时提示复核从格。西盘主体力量仅作佐证。'],
    ['喜用与格局从哪里来？', '喜用神、格局与大运由排盘引擎给出；日主意象、格局花名与大运标题取自玄玑生辰页的同一套词库。'],
  ]],
  ['应期与验证', [
    ['过去节点如何选取？', '八字流年（v2.1）与西盘行运（v1）分别计分，取二者在同一年、同一领域同时亮起的年份；按信号强度排序，领域不重复、年份间隔三年以上，至多三条。'],
    ['「顺风」「逆风」指什么？', '流年档位，由排盘引擎在所属大运内逐年给出，共五档：顺风、偏顺、平稳、偏紧、逆风。'],
    ['同一张盘每次结果一致吗？', '一致。计算全程不使用随机数；需要多选一的文案按盘面指纹确定性选取。'],
  ]],
  ['使用边界', [
    ['这些结果该如何使用？', '盘面与推算由系统计算；明显、部分、不符合由你亲手标注。本工具只呈现结构，不做长篇解读，深度解读交由 Xuanji Skill 与创始人。'],
    ['出生信息保存在哪里？', '全部计算在本机完成，不联网；最近五张盘保存在本机的小工具存储中，可在首页删除。'],
  ]],
];
function method() {
  const prev = NAV[depth - 1] && NAV[depth - 1][0];
  setBar({ pill: prev === 'share' ? '‹ 回到分享' : prev === 'result' ? '‹ 回到结果' : '‹ 首页' });
  const o = S.out;
  return h('section', { class: 'v' },
    h('div', { class: 'eyebrow', text: 'METHOD · 方法与边界' }), h('h2', { class: 'h1', text: '方法与边界' }),
    h('p', { class: 'lead', text: '这里披露本工具采用的体系、计算口径，以及可能与其他软件产生差异的地方，帮助你判断结果的适用范围。' }), divd(),
    FAQ.map(([g, qs]) => [h('div', { class: 'eyebrow', text: g }), h('div', { class: 'accs' }, qs.map(([q, a]) => acc(q, null, () => h('p', { class: 'sub', text: a }))))]),
    h('div', { class: 'card spec' },
      h('div', { class: 'spec-r' }, h('b', { text: '这个版本' }), h('p', { text: '离线观测版 0.1：全部在本机计算。更完整的推算与长篇解读在 Xuanji Skill 与玄玑网站。' })),
      o ? h('div', { class: 'spec-r' }, h('b', { text: '引擎' }), h('p', { class: 'mono', text: `natal ${o.version.natal} · astro-mbti ${o.version.astro_mbti} · ${o.method.timing ? o.method.timing.schema : ''}` })) : null,
      h('div', { class: 'spec-r' }, h('b', { text: '开源' }), h('p', { text: '本工具以 AGPL-3.0 许可开源，源码与第三方许可见 GitHub 仓库 xuanji-astro-minitool。八字排盘基于 mingyu-core（AGPL-3.0），天文计算 Astronomy Engine（MIT），标题字体由思源宋体子集化（SIL OFL 1.1）。' })),
      h('div', { class: 'spec-r' }, h('b', { text: '使用边界' }), h('p', { text: '本工具依据既定计算规则生成结构化结果，用于文化研究、自我探索与信息整理；不构成医疗、法律、财务、关系、教育、职业等专业建议，也不替你做决定。重要决定请依据可验证的信息、适当的专业意见与自己的判断。' }))),
    h('div', { class: 'foot' }, h('div', { class: 'motto', text: '盘定战场，不定战役。' })));
}

const VIEWS = { home, form, busy, fail, result, share, method };
addEventListener('scroll', () => document.body.classList.toggle('scrolled', window.scrollY > 8), { passive: true });
hist('replaceState', 0);
show('home');
