// 本机档案：最近 5 张盘＋过去节点的回答，存在这台手机的小工具存储里（别的小工具和外部都读不到）。
// 存不进去（隐私模式、空间满）就当没存，不影响排盘。
const KEY = 'xj.archive.v1', MAX = 5;
export function list() {
  try { const xs = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(xs) ? xs : []; } catch (e) { return []; }
}
function write(xs) { try { localStorage.setItem(KEY, JSON.stringify(xs.slice(0, MAX))); } catch (e) { /* 存不了就算了 */ } }
export function put(rec) {
  const old = list().find((x) => x.id === rec.id);
  write([{ ...old, ...rec, answers: { ...(old && old.answers), ...rec.answers } }, ...list().filter((x) => x.id !== rec.id)]);
}
export function get(id) { return list().find((x) => x.id === id) || null; }
export function remove(id) { write(list().filter((x) => x.id !== id)); }
export function setAnswer(id, nodeId, a) {
  const xs = list(), r = xs.find((x) => x.id === id);
  if (!r) return;
  r.answers = { ...r.answers, [nodeId]: a };
  write(xs);
}
export { MAX };
