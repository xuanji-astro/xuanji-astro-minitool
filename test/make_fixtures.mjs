// 回归基准：合成盘（种子写死，零真人数据）。服务端那一套（profile-api 的 core.js＋engines.js＋同一份 paipan）算出期望输出，
// 浏览器里的小工具引擎必须逐字一致。只有本机有 profile-api 时才能重生成；公开仓里直接用存好的 expected.json。
// 用法：node test/make_fixtures.mjs [profile-api 目录]
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = process.argv[2] || path.join(ROOT, '..', 'xuanji-profile-api');
const require = createRequire(import.meta.url);
const { parseInput, natalOf, autoSideOf, assemble } = require(path.join(API, 'src', 'core.js'));
const { paipan, InputError } = await import(path.join(API, '..', 'xuanji-paipan', 'src', 'paipan.js'))   // engine/paipan 是它的原样拷贝（SOURCES.txt 核 sha）;
const { VERSION } = require(path.join(API, 'src', 'profile.js'));

let s = 20261002; const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const CITIES = ['北京', '上海', '广州', '深圳', '成都', '重庆', '武汉', '西安', '杭州', '南京', '沈阳', '哈尔滨', '昆明', '乌鲁木齐', '拉萨', '福州', '长沙', '郑州', '济南', '兰州', '南宁', '海口', '浙江省宁波市鄞州区', '四川省绵阳市涪城区'];
const SRC = ['birth_certificate', 'family_clear', 'family_rough', 'unknown'], PRE = ['minute', 'within_15min', 'within_1h', 'unknown'];
const pad = (n) => String(n).padStart(2, '0');
const cases = [];
for (let i = 0; i < 24; i++) {
  const y = 1950 + Math.floor(rnd() * 60), mo = 1 + Math.floor(rnd() * 12), d = 1 + Math.floor(rnd() * 28);
  let time = `${pad(Math.floor(rnd() * 24))}:${pad(Math.floor(rnd() * 60))}`;
  if (i === 3 || i === 17) time = null;            // 时辰不详
  if (i === 5) time = '23:50';                     // 子时边上
  const date = i === 9 ? `1988-${pad(mo)}-${pad(d)}` : `${y}-${pad(mo)}-${pad(d)}`;   // 夏令时年份
  cases.push({ date, time, city: CITIES[i], gender: rnd() < 0.5 ? 'female' : 'male', time_source: SRC[i % 4], time_precision: PRE[(i * 3) % 4] });
}
const NOW = '2026-10-02T04:00:00.000Z';
const build = (body) => {
  const inp = parseInput(body), N = natalOf(inp);
  const hh = inp.h == null ? null : `${pad(inp.h)}:${pad(inp.mi)}`;
  const call = (city, strength) => { try { return { ok: true, body: JSON.parse(JSON.stringify(paipan({ date: inp.date, time: hh, city, gender: inp.gender, ...(strength ? { strength } : {}) }))) }; } catch (e) { if (e instanceof InputError) return { ok: false, body: { error: { code: e.code, message: e.message } } }; throw e; } };
  const one = (x) => { let r = call(inp.city, x); if (r.body?.error?.code === 'LOCATION_NOT_FOUND' && inp.place?.name && inp.place.name !== inp.city) r = call(inp.place.name, x); return r.ok ? { status: 'ok', ...r.body } : { status: 'error', http: 400, error: r.body.error }; };
  let bz = one(inp.strength);
  const auto = autoSideOf(inp, bz, N);   // 同 browser/entry.js：没核过、结论跟引擎档位不同，带结论再排一次
  if (auto) { const b2 = one(auto); if (b2.status === 'ok') bz = b2; }
  const o = assemble(inp, N, bz, { version: VERSION, now: new Date(NOW), auto });
  const j = JSON.stringify(o);
  return { input: body, sha: crypto.createHash('sha256').update(j).digest('hex'), out: o };
};
const out = cases.map(build);
// 定案跟引擎相反（用户核过、翻了过来）：取前两张能核的盘各加一份带 strength 的，喜忌和时间线按定案重算
for (const c of out.filter((c) => c.out.method.bazi?.strength?.vote?.feel && !c.out.bazi.bazi.pattern.isSpecial).slice(0, 2)) {
  const eng = /强|旺/.test(c.out.bazi.bazi.strength) ? '强' : /弱|衰/.test(c.out.bazi.bazi.strength) ? '弱' : '强';
  out.push(build({ ...c.input, strength: eng === '强' ? '弱' : '强' }));
}
fs.writeFileSync(path.join(ROOT, 'test', 'fixtures', 'expected.json'), JSON.stringify({ now: NOW, version: VERSION, cases: out }));
console.log('fixtures', out.length, 'bazi ok', out.filter((c) => c.out.bazi.status === 'ok').length, 'past_candidates', out.map((c) => (c.out.method.timing?.past_candidates || []).length).join(','));
