#!/bin/bash
# 把小工具要用的引擎从两个源仓原样拷过来（二进制拷贝，一字不改），记下来源提交和每个文件的 sha256。
# 源：xuanji-profile-api（应期、身强、边界、方法层、受控排盘副本）＋ xuanji-paipan（八字排盘，AGPL）＋ Xuanji Skill（定时辰打分 rectify.mjs，Apache-2.0）。
# 用法：scripts/sync_engine.sh [profile-api 目录] [paipan 目录] [Skill 目录（解开的 Skill 包里的 xuanji/）]
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
API="${1:-$HERE/../xuanji-profile-api}"; PP="${2:-$HERE/../xuanji-paipan}"; SK="${3:-$HERE/../_wt/skill_rc5/xuanji}"
E="$HERE/engine"; rm -rf "$E/src" "$E/vendor" "$E/config" "$E/paipan" "$E/skill"; mkdir -p "$E/src" "$E/vendor/site_words" "$E/vendor/yiqi_wangshuai" "$E/config" "$E/paipan" "$E/skill"
for f in core method words strength feel quotes boundary timing transits geo schoolvote schoolwords calib; do cp "$API/src/$f.js" "$E/src/"; done   # schoolvote／schoolwords：三派投票和各派说法（10-09 起）；calib：身强身弱校正（10-10 起）
for f in astronomy.js asteroid-ephem.js computeNatal_受控版.js engine_mbti_core.js cities.js tianji_personal.js ruler_v0.js kp_natal_deep.js; do cp "$API/vendor/$f" "$E/vendor/"; done   # kp_natal_deep：timing 的 love_years（rc.12 起）
cp "$API/config/age-marriage-window.json" "$E/config/"   # timing 的 age_layer（rc.12 起）
cp "$API"/vendor/site_words/*.js "$E/vendor/site_words/"
cp "$API"/vendor/yiqi_wangshuai/* "$E/vendor/yiqi_wangshuai/"
cp -R "$PP"/src/. "$E/paipan/"; rm -f "$E/paipan/server.js"
cp "$PP/LICENSE" "$E/paipan/LICENSE"
echo '{ "type": "module" }' > "$E/paipan/package.json"   # paipan 是 ES 模块
# 定时辰：Skill 的打分脚本原样拷来（同一套规则、同一份代码），浏览器里用不到的命令行和读写文件部分在打包时用 browser/ 垫片顶掉
cp "$SK/scripts/rectify.mjs" "$E/skill/rectify.mjs"; cp "$SK/LICENSE" "$E/skill/LICENSE"; cp "$SK/NOTICE" "$E/skill/NOTICE"
# 小工具源码公开：注释里的人名、原话、本机路径去掉（只动注释行，代码一字不改；同 Skill 公开时的做法）
find "$E/src" "$E/vendor" -name '*.js' -maxdepth 1 -print0 | xargs -0 perl -CSD -Mutf8 -i -pe 'if (m{^\s*(//|/?\*)} || m{\s//\s}) { s/（A[t]hena [0-9-]+：[^）]*）//g; s/照测[测]的问法/照网站校正页的问法/g; s/（[0-9]{2}-[0-9]{2} 她：「[^」]*」(「[^」]*」)*）//g; s/[0-9]{2}-[0-9]{2} 她：「[^」]*」(「[^」]*」)*。?//g; s{CC/线B-玄玑占星/_工具/_小行星星历/}{}g; }'
{
  echo "# 引擎来源（scripts/sync_engine.sh 生成，别手改）"
  echo "xuanji-profile-api $(git -C "$API" rev-parse --short HEAD)$(git -C "$API" diff --quiet || echo ' (有未提交改动)')"
  echo "xuanji-paipan      $(git -C "$PP" rev-parse --short HEAD)$(git -C "$PP" diff --quiet || echo ' (有未提交改动)')"
  echo "mingyu-core        $(node -p "require('$PP/node_modules/mingyu-core/package.json').version")"
  echo "xuanji-skill        $(node -p "require('$SK/package.json').version")（scripts/rectify.mjs$(git -C "$SK" rev-parse --short HEAD 2>/dev/null | sed 's/^/，提交 /')）"
  echo
  echo "扩展星历 ext/asteroid-ephem-ext.js：JPL Horizons 日心黄道 J2000 位置（scripts/fetch_jpl_ext.py 取，scripts/ephem_ext.py 生成）"
  echo
  cd "$E" && find src vendor config paipan skill ext -type f ! -name '.DS_Store' | LC_ALL=C sort | while read -r f; do shasum -a 256 "$f"; done
} > "$E/SOURCES.txt"
echo "synced → $E"; head -4 "$E/SOURCES.txt"
