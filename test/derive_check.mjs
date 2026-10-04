import fs from 'fs';
import * as D from '../app/src/derive.js';
const fx = JSON.parse(fs.readFileSync(new URL('./fixtures/expected.json', import.meta.url)));
for (const [i, c] of fx.cases.entries()) {
  const o = c.out, r = D.reliability(o), s = D.strength(o), n = D.pickNodes(o), sn = D.seen(o, 2026), st = D.stage(o, 2026);
  console.log(String(i).padStart(2), r.level.padEnd(9), r.risks.map((x) => x.k).join('+').padEnd(14), (s ? s.verdict + '/' + s.agree : '-').padEnd(16), n.map((x) => x.year + x.domain).join(' ').padEnd(34), (st && st.now ? st.now.text : '-'));
}
const o = fx.cases[1].out; const nodes = D.pickNodes(o); const ans = Object.fromEntries(nodes.map((x, i) => [x.id, ['obvious', 'partial', 'miss'][i % 3]]));
const h = D.handoff(o, nodes, ans, { nowY: 2026, tool: 'xuanji-astro-minitool 0.1.0' });
console.log('handoff chars', h.length); console.log(D.seen(o, 2026).items.map((x) => x.k + '｜' + x.text + '｜' + x.sub + '｜' + x.src).join('\n'));
console.log('founder', D.founderReasons(o, nodes, ans));
