// 中国夏令时表逐小时对系统时区库：engine/vendor 两份 CN_DST，1986–1991 每个整点都要跟 Intl 的 Asia/Shanghai 一致；
// 构建产物 dist/pkg/engine/ 里也只能是改过的那张表。10-28 查出 1986 年起始日写成 [5,4]（表的格式是 [日,月]，读成 4 月 5 日），实际是 5 月 4 日。
// 用法：node test/cn_dst.mjs
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', timeZoneName: 'longOffset' });
const wall = (t) => { const o = {}; for (const p of fmt.formatToParts(new Date(t))) o[p.type] = p.value; return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour, dst: o.timeZoneName === 'GMT+09:00' ? 1 : 0 }; };
let fail = 0;
for (const file of ['computeNatal_受控版.js', 'tianji_personal.js']) {
  const src = fs.readFileSync(path.join(ROOT, 'engine', 'vendor', file), 'utf8');
  const m = src.match(/const CN_DST *= *\{[^;]+;\s*function cnDstAdjust[\s\S]*?\n\s*\}/);
  if (!m) { console.log(`✗ ${file}：找不到 CN_DST／cnDstAdjust`); fail++; continue; }
  const f = new Function(m[0] + '\nreturn cnDstAdjust;')(); let n = 0; const bad = [];
  for (let t = Date.UTC(1985, 11, 31, 16); t < Date.UTC(1991, 11, 31, 16); t += 3600e3) {
    const w = wall(t);
    if (!w.dst && w.h === 1 && f(w.y, w.mo, w.d, 2) === 0 && f(w.y, w.mo, w.d, 1) === 1) continue;   // 结束那天 1 点到 2 点走两遍，按夏令时那遍排
    n++; if (f(w.y, w.mo, w.d, w.h) !== w.dst) bad.push(`${w.y}-${w.mo}-${w.d} ${w.h}点`);
  }
  console.log(`${bad.length ? '✗' : '✓'} ${file}：逐小时 ${n}，不一致 ${bad.length}${bad.length ? '（' + bad.slice(0, 3).join('、') + '…）' : ''}`); fail += bad.length ? 1 : 0;
}
for (const file of ['natal.js', 'tianji_personal.js']) {
  const p = path.join(ROOT, 'dist', 'pkg', 'engine', file); if (!fs.existsSync(p)) { console.log(`· dist/pkg/engine/${file} 还没构建，跳过`); continue; }
  const s = fs.readFileSync(p, 'utf8'); const ok = !s.includes('1986:[[5,4]') && s.includes('1986:[[4,5]'); console.log(`${ok ? '✓' : '✗'} dist/pkg/engine/${file}：只有改过的那张表`); fail += ok ? 0 : 1;
}
process.exit(fail ? 1 : 0);
