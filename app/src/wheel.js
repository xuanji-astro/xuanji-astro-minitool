// 星盘图：照搬 Skill 报告模板的 wheelPanel（xuanji-skill/xuanji/template/report.html 的「专业画法」），
// 只把字符串拼装改成 ES 模块、宋体换成小工具自带的子集；小工具版另画四小行星、南交／莉莉丝／宿命点／东方点、降／底，以及半刑、补八分、梅花三种小相位（只显示不计分）；小工具是红白黑基调，外圈色带和宫位线、轴线改成中性灰黑（星座和行星的四象颜色是数据编码，照旧）。改画法要两边一起改。
// 上升在左（9 点钟），黄道逆时针；外圈星座按四象上色并标守护星，宫位带＋宫号，相位圈里画冲刑拱六合，两轴贯穿。
const SIGNS = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const ZOD = ['羊', '牛', '双', '蟹', '狮', '处', '秤', '蝎', '射', '摩', '瓶', '鱼'];
const CHAR = { 太阳: '日', 月亮: '月', 水星: '水', 金星: '金', 火星: '火', 木星: '木', 土星: '土', 天王: '天', 海王: '海', 冥王: '冥', 凯龙: '凯', 北交点: '北', 南交点: '南', 谷神: '谷', 智神: '智', 婚神: '婚', 灶神: '灶', 莉莉丝: '莉', 福点: '福', 宿命点: '宿', 东方点: '东', 灵神星: '灵', 爱神星: '爱', 精神点: '精' };
// 小相位：引擎只算五种主要相位，这几种按通行容许度在画图时补上，只用于显示，不进任何计分
const MINOR = [[45, '半刑', 2], [135, '补八分', 2], [150, '梅花', 2]];
const ASPECTS = [[0, '合', 8, ''], [60, '六合', 4, 'good'], [90, '刑', 6, 'hard'], [120, '拱', 6, 'good'], [180, '冲', 8, 'hard']];
const lon = (b) => (typeof b.L === 'number' ? b.L : SIGNS.indexOf(b.sign) * 30 + b.deg + (b.min || 0) / 60);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const SERIF = 'XJSerif,Songti SC,STSong,serif';

export function wheel(W, X) {   // X＝盘面扩展（extras.js：灵神星、爱神星、精神点、恒星），可省
  const asc = W.angles.asc.L, mc = W.angles.mc.L; let s = '';
  const R0 = 190, R1 = 163, R2 = 145, RL = 124, RA = 98;
  const ELC = ['#d8432f', '#a8841c', '#3d8f4f', '#2f5fc4'];   // 火 土 风 水
  const RULE = [['火'], ['金'], ['水'], ['月'], ['日'], ['水'], ['金'], ['火', '冥'], ['木'], ['土'], ['土', '天'], ['木', '海']];
  const PC = { 太阳: '#d8432f', 月亮: '#2f5fc4', 水星: '#3d8f4f', 金星: '#a8841c', 火星: '#d8432f', 木星: '#d8432f', 土星: '#a8841c', 天王: '#3d8f4f', 海王: '#2f5fc4', 冥王: '#23366e', 凯龙: '#7a5fc4', 北交点: '#2a9d9d', 南交点: '#2a9d9d', 福点: '#2a9d9d', 宿命点: '#2a9d9d', 东方点: '#2a9d9d', 莉莉丝: '#b0479a', 谷神: '#b0479a', 智神: '#b0479a', 婚神: '#b0479a', 灶神: '#b0479a', 灵神星: '#b0479a', 爱神星: '#b0479a', 精神点: '#2a9d9d', 升: '#d8432f', 中: '#3d8f4f', 降: '#2f5fc4', 底: '#a8841c' };
  const pol = (L, r) => { const t = ((180 + (L - asc)) * Math.PI) / 180; return [(200 + r * Math.cos(t)).toFixed(1), (200 - r * Math.sin(t)).toFixed(1)]; };
  const ang = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  const line = (p1, p2, st) => '<line x1="' + p1[0] + '" y1="' + p1[1] + '" x2="' + p2[0] + '" y2="' + p2[1] + '" ' + st + '/>';
  const txt = (p, t, st, dy) => '<text x="' + p[0] + '" y="' + (+p[1] + (dy || 0)).toFixed(1) + '" text-anchor="middle" dominant-baseline="central" ' + st + '>' + t + '</text>';
  // 星座带：四象上色，旁边标守护星
  s += '<circle cx="200" cy="200" r="' + R0 + '" fill="#f4f2ef" stroke="#b9b4ae" stroke-width="1.2"/>';
  s += '<circle cx="200" cy="200" r="' + R1 + '" fill="#fbfbfa" stroke="#b9b4ae" stroke-width="1"/>';
  for (let i = 0; i < 12; i++) {
    s += line(pol(i * 30, R1), pol(i * 30, R0), 'stroke="#b9b4ae" stroke-width="1"');
    const c = ELC[i % 4], rl = RULE[i];
    s += txt(pol(i * 30 + 15 + (rl.length > 1 ? 0 : -3), (R0 + R1) / 2), ZOD[i], 'font-size="15" font-weight="700" fill="' + c + '" font-family="' + SERIF + '"');
    if (rl.length > 1) {
      s += txt(pol(i * 30 + 5, (R0 + R1) / 2 - 2), rl[0], 'font-size="8.5" fill="' + c + '" opacity=".8"');
      s += txt(pol(i * 30 + 25, (R0 + R1) / 2 - 2), rl[1], 'font-size="8.5" fill="' + c + '" opacity=".8"');
    } else {
      s += txt(pol(i * 30 + 24, (R0 + R1) / 2 + 3), rl[0], 'font-size="8.5" fill="' + c + '" opacity=".8"');
    }
  }
  // 宫位带＋宫号；宫头线到相位圈是实线，圈里是虚线通到圆心
  s += '<circle cx="200" cy="200" r="' + R2 + '" fill="#ffffff" stroke="#bdb8b2" stroke-width="1"/>';
  const cusps = W.houses.map(lon);
  for (let k = 0; k < 12; k++) {
    const cu = cusps[k], axis = k === 0 || k === 3 || k === 6 || k === 9;
    if (!axis) {
      s += line(pol(cu, RA), pol(cu, R1), 'stroke="#c9c5c0" stroke-width="1"');
      s += line(pol(cu, 0), pol(cu, RA), 'stroke="#c9c5c0" stroke-width=".9" stroke-dasharray="2 3"');
    }
    const span = (((cusps[(k + 1) % 12] - cu) % 360) + 360) % 360;
    s += txt(pol(cu + span / 2, (R1 + R2) / 2), k + 1, 'font-size="10.5" font-weight="600" fill="#6b6763"');
  }
  // 相位圈
  s += '<circle cx="200" cy="200" r="' + RA + '" fill="none" stroke="#bdb8b2" stroke-width="1"/>';
  const P = W.planets.map((p) => ({ n: p.n, L: lon(p) })).concat([{ n: '升', L: asc }, { n: '中', L: mc }]);
  for (let a1 = 0; a1 < P.length; a1++) for (let b1 = a1 + 1; b1 < P.length; b1++) {
    const dd = ang(P[a1].L, P[b1].L), mh = MINOR.find((z) => Math.abs(dd - z[0]) <= z[2]);
    if (mh) s += line(pol(P[a1].L, RA), pol(P[b1].L, RA), mh[0] === 150 ? 'stroke="#8a5fc4" stroke-width=".7" stroke-dasharray="1 2.2" opacity=".75"' : 'stroke="#d8432f" stroke-width=".7" stroke-dasharray="1 2.2" opacity=".6"');
  }
  for (let a1 = 0; a1 < P.length; a1++) for (let b1 = a1 + 1; b1 < P.length; b1++) {
    if (P[a1].n === '升' && P[b1].n === '中') continue;
    const dd = ang(P[a1].L, P[b1].L); let hit = null;
    for (const z of ASPECTS) if (Math.abs(dd - z[0]) <= z[2]) { hit = z; break; }
    if (!hit || hit[0] === 0) continue;
    const st = hit[0] === 180 ? 'stroke="#d8432f" stroke-width="1.1" opacity=".75"'
      : hit[0] === 90 ? 'stroke="#d8432f" stroke-width="1.1" stroke-dasharray="4 3" opacity=".75"'
      : hit[0] === 120 ? 'stroke="#2a9d8f" stroke-width="1.1" opacity=".8"'
      : 'stroke="#2a9d8f" stroke-width="1" stroke-dasharray="4 3" opacity=".75"';
    s += line(pol(P[a1].L, RA), pol(P[b1].L, RA), st);
  }
  // 恒星：星座带内沿上的小四芒星，浅色不抢主相位；和行星或四轴合相（1° 内）的加深
  if (X) for (const st of X.stars) {
    const [cx, cy] = pol(st.L, R1), q = (v) => (+v).toFixed(1), r = 3.6, r2 = 1.1, pts = [];
    for (let k = 0; k < 8; k++) { const a = (k * 45 * Math.PI) / 180, rr = k % 2 ? r2 : r; pts.push(q(+cx + rr * Math.cos(a)) + ',' + q(+cy - rr * Math.sin(a))); }
    s += '<polygon points="' + pts.join(' ') + '" fill="' + (st.conj.length ? '#6b6763' : '#b9b4ae') + '"/>';
  }
  // 两轴：上升—下降、天顶—天底，实线贯穿全盘
  s += line(pol(asc, R0 + 8), pol(asc + 180, R0 + 8), 'stroke="#111111" stroke-width="1.4"');
  s += line(pol(mc, R0 + 8), pol(mc + 180, R0 + 8), 'stroke="#111111" stroke-width="1.4"');
  // 天体：相位圈上的真实位置点＋点线＋彩色汉字，挤在一起的往两边推开
  const bodies = W.planets.map((p) => ({ k: p.n, ch: CHAR[p.n], L: lon(p), rx: p.rx }))
    .concat((W.asteroids || []).filter((p) => CHAR[p.n]).map((p) => ({ k: p.n, ch: CHAR[p.n], L: lon(p), rx: p.rx, small: true })))
    .concat((W.points || []).filter((p) => CHAR[p.n]).map((p) => ({ k: p.n, ch: CHAR[p.n], L: lon(p), small: true })))
    .concat(X ? [...X.asteroids, ...X.points].map((p) => ({ k: p.n, ch: CHAR[p.n], L: p.L, rx: p.rx, small: true })) : [])
    .concat([{ k: '升', ch: '升', L: asc }, { k: '中', ch: '中', L: mc }, { k: '降', ch: '降', L: (asc + 180) % 360 }, { k: '底', ch: '底', L: (mc + 180) % 360 }]);
  const lab = bodies.map((x) => ({ k: x.k, L: x.L, A: x.L })).sort((p, q) => p.L - q.L);
  for (let it = 0; it < 200; it++) {
    let moved = false;
    for (let j = 0; j < lab.length; j++) {
      const nb = lab[(j + 1) % lab.length], gap = j + 1 < lab.length ? nb.A - lab[j].A : nb.A + 360 - lab[j].A;
      if (gap < 7.6) { const push = (7.6 - gap) / 2 + 0.05; lab[j].A -= push; nb.A += push; moved = true; }
    }
    if (!moved) break;
  }
  const LBL = {}; lab.forEach((x) => { LBL[x.k] = x.A; });
  bodies.forEach((x) => {
    const col = PC[x.k] || '#6a6a8a', A = LBL[x.k], dot = pol(x.L, RA), lp = pol(A, RL);
    s += line(pol(x.L, RA + 2), pol(A, RL - 9), 'stroke="' + col + '" stroke-width=".8" stroke-dasharray="1.5 2" opacity=".8"');
    s += '<circle cx="' + dot[0] + '" cy="' + dot[1] + '" r="2.3" fill="' + col + '"/>';
    s += txt(lp, esc(x.ch) + (x.rx ? '<tspan font-size="7" dy="-5">R</tspan>' : ''), 'font-size="' + (x.small ? 11.5 : 14) + '" font-weight="600" fill="' + col + '" font-family="' + SERIF + '"');
  });
  const d = document.createElement('div');
  d.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 424 424" class="wheel" role="img" aria-label="星盘图">' + s + '</svg>';
  return d.firstChild;
}
export { SIGNS, CHAR, lon };

// 封面徽章「星芒」（10-02 从三种草稿里定稿）：八芒针星——四根长芒的长短看这张盘火土风水各有几颗行星，四根短芒固定；
// 外圈刻度环，十颗行星加凯龙按黄经落在外圈（上升在左，同星盘图）。同一张盘永远同一枚，不同的盘长短和落点不同；零随机数。
const ELEMS = [['火', ['白羊', '狮子', '射手']], ['土', ['金牛', '处女', '摩羯']], ['风', ['双子', '天秤', '水瓶']], ['水', ['巨蟹', '天蝎', '双鱼']]];
export function starBadge(W) {
  const c = 150, asc = W.angles.asc.L, f = (x) => x.toFixed(2);
  const pol = (deg, r) => { const t = (deg * Math.PI) / 180; return [c + r * Math.cos(t), c - r * Math.sin(t)]; };
  const ten = W.planets.filter((p) => p.n !== '凯龙');
  const cnt = ELEMS.map(([, signs]) => ten.filter((p) => signs.includes(p.sign)).length);
  let s = '<defs><radialGradient id="sbGlow"><stop offset="0" stop-color="#ebe8e4" stop-opacity=".9"/><stop offset="1" stop-color="#ebe8e4" stop-opacity="0"/></radialGradient></defs>';
  s += `<circle cx="${c}" cy="${c}" r="72" fill="url(#sbGlow)"/>`;
  s += `<circle cx="${c}" cy="${c}" r="118" fill="none" stroke="#111111" stroke-width=".9"/><circle cx="${c}" cy="${c}" r="106" fill="none" stroke="#8a8580" stroke-width=".5"/>`;
  for (let k = 0; k < 72; k++) { const L = k % 6 === 0 ? 8 : 3, [x0, y0] = pol(k * 5, 106), [x1, y1] = pol(k * 5, 106 + L); s += `<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="#8a8580" stroke-width=".6"/>`; }
  for (const p of W.planets) { const [x, y] = pol(180 + (lon(p) - asc), 112); s += `<circle cx="${f(x)}" cy="${f(y)}" r="2.4" fill="#111111"/>`; }
  const pts = [];
  for (let k = 0; k < 8; k++) { const deg = 90 + k * 45, R = k % 2 === 0 ? 44 + cnt[k / 2] * 9 : 30; pts.push(pol(deg, R), pol(deg + 22.5, 4.2)); }
  s += `<polygon points="${pts.map((p) => p.map(f).join(' ')).join(' ')}" fill="#111111"/><circle cx="${c}" cy="${c}" r="7" fill="#c40018"/><circle cx="${c}" cy="${c}" r="2.6" fill="#ffffff"/>`;
  const d = document.createElement('div');
  d.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" class="sigil" role="img" aria-label="星芒徽章">' + s + '</svg>';
  return { el: d.firstChild, counts: Object.fromEntries(ELEMS.map(([k], i) => [k, cnt[i]])) };
}
