// 各派自己的话（10-09 命理组定共用边界：探测共用、名词各用各的、喜忌不共用）
// 交战、破格、破从这类原局结构信号三派共用，大运都挂、流年引动都点燃；落到文字，同一信号各派用自己的行话讲：
//   格局派说「财印交战」「破格」「从格」；扶抑派只说身被夹在中间、哪股力量当头、原局的平衡；调候派落在「和」字上：气场失和、被搅（不凹寒暖燥湿，10-09 命理组定）。
//   扶抑、调候的说法里不出现「交战」「破格」「从格」这类格局派名词。只说结构为什么让这一年转紧，不说吉凶喜忌（喜忌各派自己判）。
// 点燃注记（排盘服务给的）：{ kind: '点燃', why, run: 大运干支, src: [{ kind, why, god? }], trig: [{ how: 冲|刑|破, zhi, to, at: 运|原局 }] }

const WHAT = {
  格局: { 财印交战: () => '财印交战', 破格: (s) => `破格的${s.god || '那个字'}出头`, 破从: (s) => `来了${s.god || '印比'}，从格的气势被冲开`, 破从强: (s) => `${s.god || '财官'}得了根，从强的气势被冲开` },
  扶抑: { 财印交战: () => '财星和印星相冲，两头拉扯，身被夹在中间', 破格: (s) => `${s.god || '一股力量'}当头，原局的平衡被搅动`, 破从: (s) => `来了帮身的${s.god || '印比'}，原局一边倒的气势被打乱` },
  调候: { 财印交战: () => '财星和印星相冲，局里气场失和', 破格: (s) => `${s.god || '一股力量'}当头，气场被搅`, 破从: (s) => `来了${s.god || '印比'}，一边倒的气场被打乱` },
};
// 大运上挂的注记，三派说法里各用各的名词（只给说法、不给喜忌）
const RUN = {
  扶抑: { 财印交战: '财印相冲', 破格: (n) => `${n.god || '一股力量'}当头`, 破从: '一边倒的气势被打乱' },
  调候: { 财印交战: '财印相冲', 破格: (n) => `${n.god || '一股力量'}当头`, 破从: '一边倒的气势被打乱' },
};
const TIER_NAME = ['顺风', '偏顺', '平稳', '偏紧', '逆风'];
const trigText = (t) => (t.at === '运' ? `${t.zhi}跟大运的${t.to}相${t.how}` : `${t.zhi}冲到原局的${t.to}`);

// 被点燃那一年为什么转紧，按 school（扶抑／调候／格局）自己的话说；不是点燃的年返回 null
function turnText(school, notes, tier) {
  const W = WHAT[school], n = (notes || []).find((x) => x && x.kind === '点燃');
  if (!W || !n || !n.run || !n.src || !n.trig) return null;
  const what = n.src.map((s) => (W[s.kind] ? W[s.kind](s) : null)).filter(Boolean);
  if (!what.length) return null;
  const trig = [...new Set(n.trig.map(trigText))];
  return `${n.run}运里${what.join('，又')}；这一年${trig.join('、')}，把它点着了，所以${TIER_NAME[tier] || '偏紧'}。`;
}

// 大运注记的叫法：格局派照原名，扶抑、调候换成自己的话
function runNoteWord(school, n) {
  const m = RUN[school] && RUN[school][n.kind];
  return !m ? n.kind : typeof m === 'function' ? m(n) : m;
}

module.exports = { turnText, runNoteWord, TIER_NAME };
