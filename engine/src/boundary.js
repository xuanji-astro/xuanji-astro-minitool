// 出生时间边界（2026-10-02）：时辰离交界多远、上升／天顶离换星座多远、哪颗星压在宫头。校时先看这里，Skill 不自己算。
const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const lon = (x) => SIGNS.indexOf(x.sign) * 30 + x.deg + (x.min || 0) / 60;
function boundary(bz, N) {
  const out = { hour: null, asc: null, mc: null, cusp_planets: [], near_any: false };
  const ts = bz && bz.status === 'ok' && bz.input && bz.input.trueSolarTime;
  const m = ts && String(ts).match(/(\d{1,2}):(\d{2})$/);
  if (m) {
    const t = +m[1] * 60 + +m[2], start = (t + 60) % 1440, k = Math.floor(start / 120);   // 子时 23:00 起：从 23:00 量起
    const into = start - k * 120, prev = ZHI[(k + 11) % 12], cur = ZHI[k], next = ZHI[(k + 1) % 12];
    out.hour = { branch: cur, minutes_from_prev: into, minutes_to_next: 120 - into, prev_branch: prev, next_branch: next, near: into < 15 || 120 - into < 15 };
  }
  if (N && N.angles) {
    for (const k of ['asc', 'mc']) {
      const a = N.angles[k], d = a.deg + (a.min || 0) / 60;
      out[k] = { sign: a.sign, deg_in_sign: Math.round(d * 10) / 10, near: d < 2 || d > 28 };
    }
    const cusps = N.houses.map((h) => ({ num: h.num, L: lon(h) }));
    for (const p of N.planets) {
      const L = lon(p);
      for (const c of cusps) { let dd = L - c.L; dd = ((dd + 540) % 360) - 180; if (Math.abs(dd) < 1.5) out.cusp_planets.push({ n: p.n, house: p.house, cusp: c.num, deg_from_cusp: Math.round(dd * 10) / 10 }); }
    }
  }
  out.near_any = !!((out.hour && out.hour.near) || (out.asc && out.asc.near) || (out.mc && out.mc.near) || out.cusp_planets.length);
  return out;
}
module.exports = { boundary };
