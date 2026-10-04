// 冷启动计时：一张盘、空缓存（可选先装星历表），量 compute 用时
(function () {
  const q = new URLSearchParams(location.search);
  const go = () => { try {
    const t0 = performance.now(); if (window.XJ_EPHEM) XJ.loadEphem(window.XJ_EPHEM); const t1 = performance.now();
    XJ.compute({ date: q.get('d'), time: '10:30', city: '杭州', gender: 'female' }, { now: new Date('2026-10-02T04:00:00Z') });
    window.__COLD = { load: Math.round(t1 - t0), compute: Math.round(performance.now() - t1) };
  } catch (e) { window.__COLD = { err: String(e && e.stack || e).slice(0, 300) }; } };
  if (q.get('eph')) { const s = document.createElement('script'); s.src = '../dist/pkg/engine/xj_ephem.js'; s.onload = go; document.body.appendChild(s); } else go();
})();
