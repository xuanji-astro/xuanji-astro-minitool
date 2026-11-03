// 境外城市三份数据（1102jw，11-02）：七万城表 world-cities.json.gz（GeoNames，跟主站 yinzhan/ 同一份）、时区表 cities-world-tz.json、州省国家英文名 world-admin-en.json。
// 单独一个文件：服务端照常读；小工具浏览器包里换成 browser/shim_world.js（回 null），境外城市由页面搜好后带 zone＋ll 进来。
const zlib = require('node:zlib'), fs = require('node:fs'), path = require('node:path');
const V = path.join(__dirname, '..', 'vendor');
module.exports = () => ({
  cities: JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(V, 'world-cities.json.gz'))).toString('utf8')),
  tz: JSON.parse(fs.readFileSync(path.join(V, 'cities-world-tz.json'), 'utf8')),
  admin: JSON.parse(fs.readFileSync(path.join(V, 'world-admin-en.json'), 'utf8')),
});
