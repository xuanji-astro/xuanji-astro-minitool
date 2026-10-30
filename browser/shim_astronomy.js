// 浏览器版 vendor/astronomy.js：kp_natal_deep.js（timing 的 love_years）require('./astronomy.js')，页面已经用 <script> 加载过同一份 astronomy.js，这里直接接 window 上那份，不再打包第二遍
/* global window */
module.exports = window.Astronomy;
