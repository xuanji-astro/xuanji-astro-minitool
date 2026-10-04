# 玄玑 xuanji-astro · 小红书小工具

输入出生信息，在手机上离线排盘，按这个顺序给结果：

1. **出生时间可信度**：真太阳时、时辰交界、上升／天顶换座、星压宫头，判断这张盘能不能放心用、值不值得校时。
2. **身强身弱**：排盘引擎、易奇旺衰分、新派三路判法多数决；西盘主体力量只作佐证。说法相反时不硬判。
3. **过去节点验证**：只挑八字流年和星盘行运在同一年、同一块人生同时亮的年份，用户回答「明显／部分／不符合」。
4. **玄玑看见的你**、**你现在在哪里**。
5. **我的玄玑底图**：出生时间、西盘、八字、星盘人格、已验证节点五张结构卡。
6. **保存、分享与继续**：分享卡、给 AI 读的结构数据（接 Xuanji Skill）、继续的路。

全程不联网：出生信息不离开手机，最近 5 张盘只存在这台手机的小工具存储里。同一张盘永远得到同一个结论，代码里没有随机数。

## 目录

| 目录 | 内容 |
|---|---|
| `engine/` | 引擎，从上游原样拷来，一字不改。`SOURCES.txt` 记着来源提交和每个文件的 sha256 |
| `engine/src/` | 单人盘拼装、应期（八字 v2.1＋西盘行运 v1）、身强投票、出生时间边界、方法层 |
| `engine/vendor/` | 网站同一套排盘与人格引擎、生辰页词库、易奇旺衰分（MIT） |
| `engine/paipan/` | 八字排盘（基于 mingyu-core，AGPL-3.0） |
| `browser/` | 浏览器垫片：服务端用 vm 沙盒加载的文件，打包时原样包进函数 |
| `app/` | 界面（`src/derive.js` 只做挑和排，`src/main.js` 是六屏） |
| `scripts/` | `build.mjs` 打包、`ephem_table.mjs` 生成慢星星历表、`font_subset.py` 切宋体子集、`pack.py` 自检并出 zip |
| `test/` | 合成盘回归基准与浏览器对照、冒烟、截图 |

## 构建

```bash
npm ci                      # mingyu-core、esbuild
XJ_SERIF_OTF=<思源宋体 CN-SemiBold.otf> python3 scripts/font_subset.py   # 只在改了界面文字时重切
node scripts/build.mjs      # → dist/pkg（index.html 在根）
python3 scripts/pack.py     # 按小红书小工具规范逐条自检，全过才出 dist/xuanji-astro.zip
```

慢星星历表（土木天海冥 1950–2045 年每天 UTC 零点黄经，Float64 原值，字节平面重排后 base64）第一次生成约一分钟，缓存在 `.cache/`。手机上先把它填进缓存，应期扫描就不用现算；数值和现算的逐位相同。

## 测试

```bash
python3 test/run_browsers.py   # 24 张合成盘：浏览器里算的 vs 服务端同一套代码算的（test/fixtures/expected.json）
python3 test/smoke.py          # 24 张合成盘逐张走完六屏：页面报错、CSP、宋体缺字
python3 test/shots.py OUTDIR   # 手机尺寸逐页截图
```

回归基准只用合成盘（种子写死），不含任何真人出生数据。Chromium 里逐字一致；WebKit（iPhone）的数学函数末位舍入和 V8 不同，经纬度在 1e-13 度上有差别，取整到 1e-6 后逐字一致，结论（落座、宫位、相位、应期年份、身强身弱）完全相同。

## 许可

本仓库以 **AGPL-3.0-only** 发布（见 `LICENSE`），因为八字排盘基于 [mingyu-core](https://github.com/Brhiza/mingyu)（AGPL-3.0）。其余第三方：Astronomy Engine（MIT）、tyme4ts（MIT）、易奇旺衰分（MIT，见 `engine/vendor/yiqi_wangshuai/LICENSE`）、思源宋体子集（SIL OFL 1.1）。

- **字体**：`app/fonts/serif-b.woff2` 由 Adobe 思源宋体 CN SemiBold 子集化而来，按 OFL 保留字体名的要求改名为 XJ Serif，版权与许可字段原样保留；完整字体许可证见 `OFL.txt`，重切见 `scripts/font_subset.py`。
- **星历数据**：灵神星、爱神星取自 NASA/JPL Horizons（`scripts/fetch_jpl_ext.py` 拉取、`scripts/ephem_ext.py` 生成）。
- **标志**：`app/img/icon.png`、`app/img/mark.png` 是玄玑的商标，不在 AGPL 授权范围内；分发改版时请换成自己的标志。
