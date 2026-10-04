// 浏览器版 engines.js：引擎文件由 index.html 用 <script> 按网站同样的顺序直接加载（文件一字不改），
// 这里只把它们挂在 window 上的名字接出来。Node 版（服务端）是 profile-api 的 engines.js，用 vm 沙盒加载同一批文件。
/* global window */
const natal = window.computeNatal;
// 同 engines.js：computeNatal 返回 asp:[{t}]，引擎要 aspects:["字符串"]
const mbtiChart = (N) => ({ planets: N.planets, points: N.points, angles: N.angles, aspects: (N.asp || []).map((x) => x.t || x) });
module.exports = { natal, mbtiChart, MBTI: window.MBTI, CITY_DATA: window.CITY_DATA, TJME: window.TJME };
