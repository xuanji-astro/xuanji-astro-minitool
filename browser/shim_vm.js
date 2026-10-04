// 浏览器里没有 vm：服务端用 vm 沙盒加载的几个词库／尺子文件，打包时原样包进函数（见 scripts/build.mjs 的 xjwrap），
// 这里按文件名调用，效果同 vm.runInContext：在同一个 ctx 里跑，顶层函数声明挂到 ctx 上。
const REG = {
  'ruler_v0.js': require('xjwrap:vendor/ruler_v0.js'),
  'identity.js': require('xjwrap:vendor/site_words/identity.js'),
  'luck-words.js': require('xjwrap:vendor/site_words/luck-words.js'),
  'shensha-words.js': require('xjwrap:vendor/site_words/shensha-words.js'),
  'shensha-origins.js': require('xjwrap:vendor/site_words/shensha-origins.js'),
  'advice-cards.js': require('xjwrap:vendor/site_words/advice-cards.js'),
  'lucky.js': require('xjwrap:vendor/site_words/lucky.js'),
};
module.exports = {
  createContext: (ctx) => ctx,
  runInContext(code, ctx, opt) {
    const f = String((opt && opt.filename) || code).split('/').pop();
    if (!REG[f]) throw new Error('shim_vm: 没打包这个文件 ' + f);
    REG[f](ctx);
  },
};
