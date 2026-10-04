// 慢星星历预算表：土木天海冥五颗星，每天 UTC 零点的黄经（和服务端缓存同一个 TJME.lon、同一批取样点，Float64 原值）。
// 小工具启动时先填进 transits.js 的缓存，应期扫描就不用在手机上现算（冷启动电脑上要 10 秒）。
// 用法：node scripts/ephem_table.mjs FROM TO OUT（默认 1950 2045 dist/xj_ephem.js）
import fs from 'fs'; import path from 'path'; import vm from 'vm'; import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [FROM = 1950, TO = 2045] = process.argv.slice(2, 4).map(Number);
const OUT = process.argv[4] || path.join(ROOT, 'dist', 'xj_ephem.js');
const V = path.join(ROOT, 'engine', 'vendor');
const ctx = { console, Math, Date, JSON, Object, Array, Number, String, Error, isFinite, parseFloat, parseInt }; ctx.window = ctx; ctx.global = ctx; ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['astronomy.js', 'asteroid-ephem.js', 'computeNatal_受控版.js', 'engine_mbti_core.js', 'cities.js', 'tianji_personal.js']) vm.runInContext(fs.readFileSync(path.join(V, f), 'utf8'), ctx, { filename: f });
const MOVERS = ['土星', '天王', '海王', '冥王', '木星'];   // 同 profile-api ephem_warm.js
const day0 = Date.UTC(FROM, 0, 1) / 864e5, n = Date.UTC(TO + 1, 0, 1) / 864e5 - day0;
const movers = {};
for (const m of MOVERS) {
  const b = ctx.TJME.BODIES.find((x) => x[0] === m)[1], arr = new Float64Array(n);
  for (let k = 0; k < n; k++) arr[k] = ctx.TJME.lon(b, new Date((day0 + k) * 864e5));
  // 字节平面重排：第 j 个字节平面放所有数的第 j 个字节（数值一位不变；高位字节几乎不变，压缩小三成）
  const u = Buffer.from(arr.buffer), t = Buffer.alloc(u.length);
  for (let i = 0; i < n; i++) for (let j = 0; j < 8; j++) t[j * n + i] = u[i * 8 + j];
  movers[m] = t.toString('base64');
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `// 慢星星历预算表 ${FROM}–${TO}（scripts/ephem_table.mjs 生成，别手改）\nwindow.XJ_EPHEM=${JSON.stringify({ day0, from: FROM, to: TO, enc: 'planes8', movers })};\n`);
console.log(path.basename(OUT), FROM + '–' + TO, n + ' 天', (fs.statSync(OUT).size / 1024).toFixed(0) + 'KB');
