// 浏览器里跑小工具引擎，对 fixtures/expected.json（服务端同一套代码算的合成盘）逐字比对。
(async () => {
  const fx = await (await fetch('fixtures/expected.json')).json();
  // 和小工具一样先装星历表（?eph=0 不装，量现算）
  const eph = new URLSearchParams(location.search).get('eph') !== '0' && window.XJ_EPHEM ? XJ.loadEphem(window.XJ_EPHEM) : 0;
  const firstDiff = (a, b, p = '') => {
    if (JSON.stringify(a) === JSON.stringify(b)) return null;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = firstDiff(a[k], b[k], p + '.' + k); if (d) return d; }
    }
    return { path: p, got: JSON.stringify(a)?.slice(0, 80), want: JSON.stringify(b)?.slice(0, 80) };
  };
  // 只差浮点末位（iPhone 的数学函数和 V8 舍入不同，1e-13 度级）不算结论不同：数字按 1e-6 取整后再比
  const norm = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e6) / 1e6 : v)));
  const res = { same: 0, sameRounded: 0, diff: [], ms: [] };
  for (const [i, c] of fx.cases.entries()) {
    const t0 = performance.now();
    let out; try { out = XJ.compute(c.input, { now: new Date(fx.now) }); } catch (e) { res.diff.push({ i, err: String(e && e.stack || e).slice(0, 300) }); continue; }
    res.ms.push(Math.round(performance.now() - t0));
    if (JSON.stringify(out) === JSON.stringify(c.out)) { res.same++; res.sameRounded++; continue; }
    const a = norm(out), b = norm(c.out);
    if (JSON.stringify(a) === JSON.stringify(b)) res.sameRounded++; else res.diff.push({ i, ...firstDiff(a, b) });
  }
  res.version = XJ.version; res.ephDays = eph;
  window.__RESULT = res; document.getElementById('o').textContent = JSON.stringify(res, null, 1);
})();
