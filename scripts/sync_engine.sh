#!/bin/bash
# 把小工具要用的引擎从两个源仓原样拷过来（二进制拷贝，一字不改），记下来源提交和每个文件的 sha256。
# 源：xuanji-profile-api（应期、身强、边界、方法层、受控排盘副本）＋ xuanji-paipan（八字排盘，AGPL）。
# 用法：scripts/sync_engine.sh [profile-api 目录] [paipan 目录]
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
API="${1:-$HERE/../xuanji-profile-api}"; PP="${2:-$HERE/../xuanji-paipan}"
E="$HERE/engine"; rm -rf "$E/src" "$E/vendor" "$E/paipan"; mkdir -p "$E/src" "$E/vendor/site_words" "$E/vendor/yiqi_wangshuai" "$E/paipan"
for f in core method words strength quotes boundary timing transits geo; do cp "$API/src/$f.js" "$E/src/"; done
for f in astronomy.js asteroid-ephem.js computeNatal_受控版.js engine_mbti_core.js cities.js tianji_personal.js ruler_v0.js; do cp "$API/vendor/$f" "$E/vendor/"; done
cp "$API"/vendor/site_words/*.js "$E/vendor/site_words/"
cp "$API"/vendor/yiqi_wangshuai/* "$E/vendor/yiqi_wangshuai/"
cp -R "$PP"/src/. "$E/paipan/"; rm -f "$E/paipan/server.js"
cp "$PP/LICENSE" "$E/paipan/LICENSE"
echo '{ "type": "module" }' > "$E/paipan/package.json"   # paipan 是 ES 模块
{
  echo "# 引擎来源（scripts/sync_engine.sh 生成，别手改）"
  echo "xuanji-profile-api $(git -C "$API" rev-parse --short HEAD)$(git -C "$API" diff --quiet || echo ' (有未提交改动)')"
  echo "xuanji-paipan      $(git -C "$PP" rev-parse --short HEAD)$(git -C "$PP" diff --quiet || echo ' (有未提交改动)')"
  echo "mingyu-core        $(node -p "require('$PP/node_modules/mingyu-core/package.json').version")"
  echo
  echo "扩展星历 ext/asteroid-ephem-ext.js：JPL Horizons 日心黄道 J2000 位置（scripts/fetch_jpl_ext.py 取，scripts/ephem_ext.py 生成）"
  echo
  cd "$E" && find src vendor paipan ext -type f ! -name '.DS_Store' | LC_ALL=C sort | while read -r f; do shasum -a 256 "$f"; done
} > "$E/SOURCES.txt"
echo "synced → $E"; head -4 "$E/SOURCES.txt"
