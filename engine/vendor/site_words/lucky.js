/* 玄玑 · 八字 · 幸运三项（颜色／方位／数字）
   口径＝《幸运三项对照表 v1》09-30 定稿：按引擎喜用五行的顺序最多取三个；
   数字个位＝该行河图尾数之一，十位按生辰固定（同一个人每次一样，不随机），十位不用 4。
   用法：XuanjiBazi.lucky(['木','火','水'], '1990-01-01 12:00 北京市 female') */
(function (g) {
  const TABLE = {
    木: { color: '青绿', swatch: ['#9ce8cc', '#1f9b78'], dir: '正东', tails: [3, 8] },
    火: { color: '赤红', swatch: ['#ffc2b0', '#e5574a'], dir: '正南', tails: [2, 7] },
    土: { color: '土黄', swatch: ['#f6e0ae', '#b8894a'], dir: '家乡', tails: [5, 0] },
    金: { color: '白金', swatch: ['#fffdf6', '#dcb970'], dir: '正西', tails: [4, 9] },
    水: { color: '深蓝', swatch: ['#8fc0ee', '#1d4f8a'], dir: '正北', tails: [1, 6] },
  };
  const TENS = [1, 2, 3, 5, 6, 7, 8, 9];

  function hash(str) {   // FNV-1a 32 位
    let h = 0x811c9dc5;
    for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return h;
  }

  function lucky(favorable, seed) {
    const els = (favorable || []).filter((el) => TABLE[el]).slice(0, 3);
    const used = new Set();
    const numbers = els.map((el, i) => {
      const h = hash(seed + '|' + i);
      let t = (h >>> 3) % TENS.length;
      const ones = TABLE[el].tails[h % 2];
      let n = TENS[t] * 10 + ones;
      while (used.has(n)) { t = (t + 1) % TENS.length; n = TENS[t] * 10 + ones; }
      used.add(n);
      return n;
    });
    return {
      elements: els,
      colors: els.map((el) => ({ element: el, name: TABLE[el].color, swatch: TABLE[el].swatch })),
      directions: [...new Set(els.map((el) => TABLE[el].dir))],
      numbers,
    };
  }

  g.XuanjiBazi = Object.assign(g.XuanjiBazi || {}, { lucky });
})(window);
