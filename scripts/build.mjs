// 打引擎包：engine/（原样拷来的服务端代码＋八字排盘）→ dist/xj_engine.js（一个 iife，不联网、无 eval、无 Worker）。
// 浏览器没有 fs/vm/path，用 browser/ 下的垫片顶；服务端 vm 沙盒加载的词库／尺子文件，打包时原样包进函数（xjwrap）。
import * as esbuild from 'esbuild';
import fs from 'fs'; import path from 'path'; import vm from 'vm'; import crypto from 'crypto';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E = path.join(ROOT, 'engine'), B = path.join(ROOT, 'browser');
// zip 里只能放网页类文件（没有 LICENSE.txt 的位置），许可声明放在两个脚本头上，方法页另有一行
const BANNER = '/*! 执天玄玑 xuanji-astro-minitool · AGPL-3.0-only · 源码见 GitHub 仓库 xuanji-astro-minitool · 第三方：mingyu-core AGPL-3.0，Astronomy Engine MIT，tyme4ts MIT，易奇旺衰分 MIT；定时辰打分 Xuanji Skill Apache-2.0 */';
const PKG = process.argv[2] || path.join(ROOT, 'dist', 'pkg');   // 小工具包根（index.html 在这一层）
const OUT = path.join(PKG, 'engine');
fs.rmSync(PKG, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });

// 包一个 vendor 文件：内容一字不改，放进 function(ctx){…}。顶层函数声明／var 在 vm 里会挂到 ctx 上，这里照样挂。
// 挂哪些名字＝在 Node vm 里实跑一遍、看 ctx 多出来的键（和服务端加载时的 ctx 同样的底子）。
function topNames(code, base) {
  const ctx = vm.createContext({ ...base }); const before = new Set(Object.keys(ctx));
  vm.runInContext(code, ctx);
  return Object.keys(ctx).filter((k) => !before.has(k));
}
const noop = () => {};
const fakeEl = () => ({ setAttribute: noop, appendChild: noop, addEventListener: noop, classList: { add: noop }, querySelector: () => null, querySelectorAll: () => [], style: {}, textContent: '', innerHTML: '' });
function wrap(rel) {
  const code = fs.readFileSync(path.join(E, rel), 'utf8');
  if (rel === 'vendor/ruler_v0.js') {
    const names = topNames(code, { module: { exports: {} }, Math, Object });
    return `module.exports = function (ctx) {\n(function (module) {\n${code}\n;${names.map((n) => `ctx[${JSON.stringify(n)}] = ${n};`).join(' ')}\n}).call(ctx, ctx.module);\n};\n`;
  }
  // 生辰页词库：都是 (function(g){…})(window) 的自执行块，服务端给的是 window＝ctx、document＝空壳
  const base = { document: { currentScript: null, createElement: fakeEl, head: { appendChild: noop } }, CustomEvent: function () {} }; base.window = base; base.self = base;
  const names = topNames(code, base).filter((n) => n !== 'XuanjiBazi');
  return `module.exports = function (ctx) {\n(function (window, self, document, CustomEvent) {\n${code}\n;${names.map((n) => `ctx[${JSON.stringify(n)}] = ${n};`).join(' ')}\n}).call(ctx, ctx.window, ctx.self, ctx.document, ctx.CustomEvent);\n};\n`;
}

const plugin = {
  name: 'xj-browser',
  setup(b) {
    b.onResolve({ filter: /^(fs|vm|path)$/ }, (a) => ({ path: path.join(B, `shim_${a.path}.js`) }));
    b.onResolve({ filter: /^\.\/engines\.js$/ }, (a) => (a.importer.startsWith(path.join(E, 'src')) ? { path: path.join(B, 'engines.browser.js') } : undefined));
    b.onResolve({ filter: /^\.\/astronomy\.js$/ }, (a) => (a.importer === path.join(E, 'vendor', 'kp_natal_deep.js') ? { path: path.join(B, 'shim_astronomy.js') } : undefined));   // love_years 用页面上那份 Astronomy
    b.onResolve({ filter: /^xjwrap:/ }, (a) => ({ path: a.path.slice(7), namespace: 'xjwrap' }));
    // Skill 的定时辰脚本：只用它的打分函数；命令行入口、读写本地文件、接口客户端在浏览器里用垫片顶（打分代码一字不改）
    const SK = path.join(E, 'skill');
    b.onResolve({ filter: /^node:(url|fs)$/ }, (a) => (a.importer.startsWith(SK) ? { path: path.join(B, `shim_skill_${a.path.slice(5)}.js`) } : undefined));
    b.onResolve({ filter: /^\.\/(private_files|client)\.mjs$/ }, (a) => (a.importer.startsWith(SK) ? { path: path.join(B, `shim_skill_${a.path.slice(2, -4)}.js`) } : undefined));
    b.onLoad({ filter: /.*/, namespace: 'xjwrap' }, (a) => ({ contents: wrap(a.path), loader: 'js', resolveDir: E }));
    // 调候派（10-09 起）：服务端用顶层 await 按文件取 mingyu-core 没导出的调候表和匹配函数；浏览器包里换成静态引用同两份文件（引擎文件本身一字不改）
    b.onLoad({ filter: /engine[\/\\]paipan[\/\\]schools[\/\\]tiaohou\.js$/ }, (a) => {
      const MY = nm.map((p) => path.join(p, 'mingyu-core', 'dist', 'bazi')).find((p) => fs.existsSync(path.join(p, 'baziTherapeuticRules.js')));
      const code = fs.readFileSync(a.path, 'utf8'), from = code.indexOf('let BAZI;'), to = code.indexOf('const { matchFirstRule } = await import(');
      if (!MY || from < 0 || to < 0) throw new Error('tiaohou.js 的调候表加载方式变了，构建脚本这一段要跟着改');
      const head = `import { CLIMATE_RULES } from ${JSON.stringify(path.join(MY, 'baziTherapeuticRules.js'))};\nimport { matchFirstRule } from ${JSON.stringify(path.join(MY, 'baziRuleMatcher', 'index.js'))};\n`;
      return { contents: code.slice(0, from) + head + code.slice(code.indexOf('\n', to) + 1), loader: 'js', resolveDir: path.dirname(a.path) };
    });
  },
};

const sha12 = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(E, 'vendor', f))).digest('hex').slice(0, 12);
const VERSION = { schema: 'xuanji.handoff/0.1', natal: sha12('computeNatal_受控版.js'), astro_mbti: sha12('engine_mbti_core.js'), asteroids: sha12('asteroid-ephem.js') };   // 同 profile.js VERSION（印度占星、紫微小工具里没有，不带那两项）
const nm = [path.join(ROOT, 'node_modules'), path.join(ROOT, '..', 'xuanji-paipan', 'node_modules')].filter((p) => fs.existsSync(p));

const r = await esbuild.build({
  entryPoints: [path.join(B, 'entry.js')], bundle: true, format: 'iife', platform: 'browser', target: ['es2020'],
  minify: true, legalComments: 'eof', banner: { js: BANNER }, charset: 'utf8', nodePaths: nm, plugins: [plugin], metafile: true,
  // 服务端用 __dirname 拼 vendor 路径；浏览器里只要文件名对得上 shim_vm
  // process.argv、import.meta.url：rectify.mjs 末尾的命令行入口判断，浏览器里恒为假
  define: { XJ_VERSION: JSON.stringify(VERSION), __dirname: '"engine/src"', 'process.argv': '[]', 'import.meta.url': '""' }, outfile: path.join(OUT, 'xj_engine.js'), logLevel: 'warning',
});
const out = fs.readFileSync(path.join(OUT, 'xj_engine.js'), 'utf8');
const banned = ['fetch(', 'XMLHttpRequest', 'new Function', 'eval(', 'WebAssembly', 'new Worker', 'importScripts', 'navigator.clipboard', 'window.open('].filter((s) => out.includes(s));
if (banned.length) { console.error('引擎包里出现被禁用的调用：', banned); process.exit(1); }
console.log('xj_engine.js', (out.length / 1024).toFixed(0) + 'KB', 'version', JSON.stringify(VERSION));

// 网站引擎原样拷进包（二进制拷贝；computeNatal_受控版.js 换成 ASCII 文件名 natal.js，内容不变）
const VENDOR = { 'astronomy.js': 'astronomy.js', 'asteroid-ephem.js': 'asteroid-ephem.js', 'computeNatal_受控版.js': 'natal.js', 'engine_mbti_core.js': 'engine_mbti_core.js', 'cities.js': 'cities.js', 'tianji_personal.js': 'tianji_personal.js' };
for (const [from, to] of Object.entries(VENDOR)) fs.copyFileSync(path.join(E, 'vendor', from), path.join(OUT, to));
// 扩展星历（灵神星、爱神星；JPL Horizons 数据，scripts/ephem_ext.py 生成）
fs.copyFileSync(path.join(E, 'ext', 'asteroid-ephem-ext.js'), path.join(OUT, 'asteroid-ephem-ext.js'));
// 星历预算表：生成一次要一分钟，有缓存就用缓存（引擎版本变了要删 .cache 重生）
const EPH = path.join(ROOT, '.cache', 'xj_ephem_1950_2045.js');
if (!fs.existsSync(EPH)) { const { execFileSync } = await import('child_process'); execFileSync('node', [path.join(ROOT, 'scripts', 'ephem_table.mjs'), '1950', '2045', EPH], { stdio: 'inherit' }); }
fs.copyFileSync(EPH, path.join(OUT, 'xj_ephem.js'));

// 界面：app/src → app.js；index.html、style.css 原样
await esbuild.build({ entryPoints: [path.join(ROOT, 'app', 'src', 'main.js')], bundle: true, format: 'iife', platform: 'browser', target: ['es2020'], minify: true, charset: 'utf8', banner: { js: BANNER }, outfile: path.join(PKG, 'app.js'), logLevel: 'warning' });
for (const f of ['index.html', 'style.css']) fs.copyFileSync(path.join(ROOT, 'app', f), path.join(PKG, f));
fs.mkdirSync(path.join(PKG, 'fonts'), { recursive: true }); fs.mkdirSync(path.join(PKG, 'img'), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'app', 'img'))) if (/\.(png|jpg|webp|svg)$/.test(f)) fs.copyFileSync(path.join(ROOT, 'app', 'img', f), path.join(PKG, 'img', f));
for (const f of fs.existsSync(path.join(ROOT, 'app', 'fonts')) ? fs.readdirSync(path.join(ROOT, 'app', 'fonts')) : []) if (f.endsWith('.woff2')) fs.copyFileSync(path.join(ROOT, 'app', 'fonts', f), path.join(PKG, 'fonts', f));
const app = fs.readFileSync(path.join(PKG, 'app.js'), 'utf8');
const bannedApp = ['fetch(', 'XMLHttpRequest', 'new Function', 'eval(', 'Math.random', 'navigator.clipboard', 'window.open(', 'execCommand'].filter((x) => app.includes(x));
if (bannedApp.length) { console.error('界面代码里出现禁用调用：', bannedApp); process.exit(1); }
console.log('app.js', (app.length / 1024).toFixed(0) + 'KB →', PKG);
