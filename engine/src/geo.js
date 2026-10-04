// 城市 → 经纬度：用网站同一份 cities.js（省/市/区三级，GCJ-02，占星误差可忽略）
const { CITY_DATA } = require('./engines.js');

// 直辖市省、市同名（北京市北京市）→ 只留一个
const join = (...xs) => xs.filter((x, i) => x && x !== xs[i - 1]).join('');
const strip = (s) => s.replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔|自治州|地区|盟)$/g, '');

// 输入可以是「浙江省杭州市西湖区」「杭州市」「杭州」；取最具体的一级，市级取各区平均
function locate(city) {
  const q = String(city || '').trim();
  if (!q) return null;
  let best = null;
  for (const [prov, cities] of Object.entries(CITY_DATA)) {
    for (const [c, districts] of Object.entries(cities)) {
      for (const [d, ll] of Object.entries(districts)) {
        if (q.includes(d) && (q.includes(strip(c)) || q.includes(strip(prov)))) return { lat: ll[0], lon: ll[1], name: join(prov, c, d) };
      }
      const key = strip(c);
      if (key && q.includes(key) && (!best || key.length > best.k.length)) {
        const v = Object.values(districts);
        best = { k: key, lat: v.reduce((a, x) => a + x[0], 0) / v.length, lon: v.reduce((a, x) => a + x[1], 0) / v.length, name: join(prov, c) };
      }
    }
  }
  // 只写到省一级、城市表里又没有同名市的（重庆市＝重庆城区＋重庆郊县）：取这个省第一个市（城区）的平均
  if (!best) {
    for (const [prov, cities] of Object.entries(CITY_DATA)) {
      const pk = strip(prov);
      if (pk && q.includes(pk)) {
        const [c, districts] = Object.entries(cities)[0], v = Object.values(districts);
        best = { lat: v.reduce((a, x) => a + x[0], 0) / v.length, lon: v.reduce((a, x) => a + x[1], 0) / v.length, name: join(prov, c) };
        break;
      }
    }
  }
  return best && { lat: +best.lat.toFixed(4), lon: +best.lon.toFixed(4), name: best.name };
}
module.exports = { locate };
