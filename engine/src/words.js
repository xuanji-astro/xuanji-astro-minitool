// 在 vm 沙盒里加载网站生辰页的词库（vendor/site_words/，原样复制自 Godness/bazi，见 scripts/sync_site_words.sh）
// 只取数据和取词函数；页面渲染函数要用的 document 用空壳顶住，不影响取词结果。
const fs = require('fs'), vm = require('vm'), path = require('path');
const V = path.join(__dirname, '..', 'vendor', 'site_words');

const noop = () => {};
const fakeEl = () => ({ setAttribute: noop, appendChild: noop, addEventListener: noop, classList: { add: noop }, querySelector: () => null, querySelectorAll: () => [], style: {}, textContent: '', innerHTML: '' });
const ctx = { console, Math, Date, JSON, Object, Array, Number, String, Set, Map, Error, isFinite, parseInt, parseFloat,
  document: { currentScript: null, createElement: fakeEl, head: { appendChild: noop } }, CustomEvent: function () {} };
ctx.window = ctx; ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['identity.js', 'luck-words.js', 'shensha-words.js', 'shensha-origins.js', 'advice-cards.js', 'lucky.js'])
  vm.runInContext(fs.readFileSync(path.join(V, f), 'utf8'), ctx, { filename: f });
const B = ctx.XuanjiBazi;

// 适合行业／契合伴侣：生辰页只给了渲染函数，按它渲染出来的那两行原文取（同一份表、同一套取法）
function fit(favorable, dayMaster, gender) {
  const el = fakeEl();
  B.fitCard(el, { favorable, dayMaster, gender });
  const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  const ps = [...el.innerHTML.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => strip(m[1]));
  const jobs = (ps[0] || '').replace(/相关的职业$/, '');
  const sp = (ps[1] || '').match(/^配偶星属(.*?)（(.*)）$/);
  return { jobs: jobs ? jobs.split('、') : [], spouse_element: sp ? sp[1] : null, spouse_why: sp ? sp[2] : null };
}

module.exports = {
  DAY_GAN: B.DAY_GAN,
  huamingOf: B.huamingOf,
  huamingSoft: B.HUAMING_SOFT || {},
  patternLabel: B.patternLabel,
  luckWords: B.luckWords,
  shenshaWords: B.shenshaWords,
  shenshaOrigins: B.shenshaOrigins,
  lucky: B.lucky,
  fit,
};
