// 扩展小行星精度闸门：每月一个时刻（1980–2030，UT 0 时），我们的管线算地心黄经，对照 JPL Horizons 地心视黄经（of date）。
// --with-ceres 时额外输出谷神星，给 test/ext_gate_swiss.py 对照瑞士星历（验证管线本身）。
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { console, Math, Date, JSON, Object, Array, Number, String, Error, isFinite, parseFloat, parseInt, atob: (s) => Buffer.from(s, 'base64').toString('binary'), Uint8Array, Float32Array }; ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine', 'vendor', 'astronomy.js'), 'utf8'), ctx);
const extFile = process.argv.includes('--with-ceres') ? path.join(ROOT, '.cache', 'asteroid-ephem-ext_with_ceres.js') : path.join(ROOT, 'engine', 'ext', 'asteroid-ephem-ext.js');
vm.runInContext(fs.readFileSync(extFile, 'utf8'), ctx);
const J = JSON.parse(fs.readFileSync(path.join(ROOT, '.cache', 'jpl_ext.json'), 'utf8'));
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const res = {};
for (const nm of Object.keys(J)) {
  if (nm === 'ceres' && !process.argv.includes('--with-ceres')) continue;
  const errs = [], ours = [];
  for (const [ds, lonJ] of J[nm].obs) {
    const m = ds.match(/(\d{4})-(\w{3})-(\d{2}) (\d{2}):(\d{2})/), d = new Date(Date.UTC(+m[1], MON[m[2]], +m[3], +m[4], +m[5]));
    const L = ctx.asteroidEphemExt(d)[nm].L; ours.push([d.toISOString(), L]);
    errs.push(Math.abs(((L - lonJ + 540) % 360) - 180));
  }
  const rms = Math.sqrt(errs.reduce((a, x) => a + x * x, 0) / errs.length), mx = Math.max(...errs);
  res[nm] = { n: errs.length, max_deg: +mx.toFixed(5), rms_deg: +rms.toFixed(5), max_arcmin: +(mx * 60).toFixed(2), ours };
  console.log(`${nm}: 对照 JPL Horizons ${errs.length} 点 · 最大误差 ${(mx * 60).toFixed(2)}′（${mx.toFixed(4)}°）· 均方根 ${(rms * 60).toFixed(2)}′`);
}
fs.writeFileSync(path.join(ROOT, '.cache', 'ext_gate_ours.json'), JSON.stringify(res));
