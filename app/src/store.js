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
// 用你的经历核一次：只记「年份＋日主＋选了哪种读法」；skip＝选了先不核
export function setFeel(id, feel, skip) {
  const xs = list(), r = xs.find((x) => x.id === id);
  if (!r) return;
  if (feel) r.feel = feel;
  if (skip !== undefined) r.feelSkip = skip;
  write(xs);
}
// 身强身弱改判记录：每次定案换了一边记一条（时间、日主、定在哪边、从哪边改过来），只在这台手机，不展示
export function setFeelLog(id, log) {
  const xs = list(), r = xs.find((x) => x.id === id);
  if (!r) return;
  r.feelLog = log;
  write(xs);
}
// 定时辰：只记交界另一侧的时间、你说的大事（年份＋方面）、孩子的出生年月、问过的题和回答、结果；不记细节
export function setRect(id, rect) {
  const xs = list(), r = xs.find((x) => x.id === id);
  if (!r) return;
  r.rect = rect;
  write(xs);
}
// 同一天出生、换了时辰的另一张盘：回答照样拿来对照（日主变了的计分时自己会扔掉）
export function feelOfDate(date, except) {
  const r = list().find((x) => x.id !== except && x.input && x.input.date === date && Array.isArray(x.feel) && x.feel.length);
  return r ? r.feel : null;
}
export { MAX };
