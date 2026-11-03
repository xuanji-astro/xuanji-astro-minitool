// 盘面扩展（10-02 审定）：灵神星、爱神星、精神点、六颗恒星。全部只上盘面和点位表，
// 不进计分、应期、身强，也不写进交接数据。没有出生时间时不出（宫位、上升都没有）。
// 出生时刻用排盘核心自己的 toUTC／cnDstAdjust（含 1986–1991 中国夏令时；境外、港澳台按出生地时区 zoneTz），和行星是同一个瞬间。
import { SIGNS } from './wheel.js';

// 恒星：J2000.0 回归黄经取自网站「恒星星官表」（rebirth.html STARS）；岁差按 50.29″／年线性推到出生时刻；只标合相，容许度 1°
const STARS = [['轩辕十四', '狮子座α', 149.833], ['角宿一', '室女座α', 203.833], ['心宿二', '天蝎座α', 249.767], ['毕宿五', '金牛座α', 69.783], ['北落师门', '南鱼座α', 333.867], ['大陵五', '英仙座β', 56.167]];
const PREC = 50.29 / 3600, STAR_ORB = 1;
const TEN = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王', '海王', '冥王'];
const norm = (x) => ((x % 360) + 360) % 360;
const dist = (a, b) => { const d = Math.abs(norm(a) - norm(b)) % 360; return d > 180 ? 360 - d : d; };
const lonOf = (p) => (typeof p.L === 'number' ? p.L : SIGNS.indexOf(p.sign) * 30 + p.deg + (p.min || 0) / 60);
export const pos = (L) => { const l = norm(L), s = Math.floor(l / 30), d = l - s * 30; let deg = Math.floor(d), min = Math.round((d - deg) * 60); if (min === 60) { deg += 1; min = 0; } return { sign: SIGNS[s], deg, min, L: l }; };
function houseOf(L, houses) {
  const cs = houses.map(lonOf);
  for (let k = 0; k < 12; k++) { const a = cs[k], b = cs[(k + 1) % 12], span = norm(b - a); if (norm(L - a) < span) return k + 1; }
  return null;
}

export function extras(out) {
  const d = out.western && out.western.data, b = out.birth;
  if (!d || !b.time || typeof window.toUTC !== 'function') return null;
  const [y, mo, dd] = b.date.split('-').map(Number), [hh, mi] = b.time.split(':').map(Number);
  /* 境外／港澳台（1102jw）：带出生地时区名的按出生那一刻从时区库算时差、不扣大陆夏令时（跟排盘核心 computeNatal 同一个判法） */
  const zt = b.zone && typeof window.zoneTz === 'function' ? window.zoneTz(b.zone, y, mo, dd, hh, mi) : null;
  const dst = zt != null ? 0 : typeof window.cnDstAdjust === 'function' ? window.cnDstAdjust(y, mo, dd, hh) : 0;
  const utc = window.toUTC(y, mo, dd, hh - dst, mi, zt != null ? zt : (b.tz || 8));
  const P = Object.fromEntries(d.planets.map((p) => [p.n, lonOf(p)]));
  const asc = d.angles.asc.L, mc = d.angles.mc.L;
  // 精神点：昼夜标志同福点（太阳在 7–12 宫＝昼盘）；昼盘 上升＋太阳－月亮，夜盘反过来
  const sun = d.planets.find((p) => p.n === '太阳'), isDay = sun && sun.house >= 7 && sun.house <= 12;
  const spiritL = norm(isDay ? asc + P['太阳'] - P['月亮'] : asc + P['月亮'] - P['太阳']);
  const points = [{ n: '精神点', ...pos(spiritL), house: houseOf(spiritL, d.houses) }];
  // 灵神星、爱神星：扩展星历（engine/ext/asteroid-ephem-ext.js，JPL Horizons 数据）
  const asteroids = [];
  if (typeof window.asteroidEphemExt === 'function') {
    const e = window.asteroidEphemExt(utc);
    for (const [k, n] of [['psyche', '灵神星'], ['eros', '爱神星']]) if (e[k] && isFinite(e[k].L)) asteroids.push({ n, ...pos(e[k].L), house: houseOf(e[k].L, d.houses), rx: !!e[k].rx });
  }
  // 恒星：只标与十大行星、四轴的合相
  const years = (utc.getTime() - Date.UTC(2000, 0, 1, 12)) / (365.25 * 864e5);
  const targets = TEN.filter((n) => P[n] != null).map((n) => [n, P[n]]).concat([['上升', asc], ['天顶', mc], ['下降', norm(asc + 180)], ['天底', norm(mc + 180)]]);
  const stars = STARS.map(([n, west, L0]) => {
    const L = norm(L0 + PREC * years);
    const conj = targets.map(([t, l]) => ({ n: t, orb: dist(L, l) })).filter((x) => x.orb <= STAR_ORB).sort((a, c) => a.orb - c.orb);
    return { n, west, ...pos(L), house: houseOf(L, d.houses), conj };
  });
  return { asteroids, points, stars };
}
