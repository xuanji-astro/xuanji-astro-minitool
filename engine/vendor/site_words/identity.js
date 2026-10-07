/* 玄玑 · 八字 · 页头（日主身份）＋格局卡（内容归主站，不进开源排盘服务）
   数据：排盘服务 components.dayMasterCard（日柱、日干、五行、阴阳）＋ bazi.pattern（格局名、成破状态）
   文案：日干喻物＝《日主身份卡》09-22；格局花名＝《格局花名 v6》09-30＋引擎格局名对照（09-30 定）
   用法：XuanjiBazi.dayMasterHead(el, { dayMaster, who: '自己', onCalendar })
         XuanjiBazi.patternCard(el, { pattern })
   类名 xbi- 前缀。 */
(function (g) {
  const BASE = (document.currentScript && document.currentScript.src.replace(/[^/]*(\?.*)?$/, '')) || './';
  const V = '20260930q';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const DAY_GAN = {
    甲: ['参天大树', '立得直、站得稳，生来是顶梁柱的料'],
    乙: ['花草藤萝', '看着柔软，顺着缝也能长到天上去'],
    丙: ['太阳', '天生发光体，到哪都自带热度'],
    丁: ['烛灯', '不刺眼的光，暖人于无声'],
    戊: ['高山大地', '稳是你的底色，靠得住是你的名声'],
    己: ['田园沃土', '不争不抢，养什么都活'],
    庚: ['矿石钢铁', '粗糙里藏着硬气，越炼越成器'],
    辛: ['珠宝玉石', '生来秀气，越打磨越见光'],
    壬: ['江河大海', '胸里有波澜，奔流不回头'],
    癸: ['云雨露泽', '润万物的细水，柔里藏着韧'],
  };

  // 25 格花名（正格 10＋成格吉 10＋破格 5）
  const HUAMING = {
    正财格: '癸财长流水，源源库能存', 偏财格: '辛透人慷慨，财来似潮涌', 正官格: '丁火锻成器，显贵入公门',
    七杀格: '壬可驱炎燥，显威居权要', 正印格: '甲现好灌溉，慧质成大才', 食神格: '己为命主寿，心宽好口福',
    伤官格: '辛白水愈清，才华盖世歌', 建禄格: '有庚才华溢，立业建大功', 偏印格: '脑子专走冷门道，一走就是专家',
    阳刃格: '天生一股狠劲，全使在事业上',
    杀印相生: '癸须甲或戊，七杀化权柄', 官印相生: '壬现合官贵，有甲富贵临', 食神生财: '庚生壬抑丙，财富满仓筐',
    伤官生财: '戊遇甲或金，以智成巨富', 金白水清: '辛癸两相见，金白水清格', 木火通明: '丙能去阴柔，木火通明格',
    食伤泄秀: '庚金可泄秀，豁达重信诚', 食神制杀: '杀旺身轻，制杀为美', 伤官配印: '伤官配印，方成龙凤',
    财官印俱备: '财官印三全，老天爷赏饭',
    枭印夺食: '戊硬不生身，才华受拘禁', 贪财坏印: '有丙恋财色，壮志被削磨', 群劫争财: '钱自己挣的，才攥得住',
    官杀混杂: '两座大山选一座，爬到顶就是路', 伤官见官: '才华挑对舞台亮，比处处亮值钱',
  };
  // 格局说明 25 段＝《生辰页缺件文案》09-30（两句、问句开头；破格只讲建设）。外格先只显示名字。
  const DESC = {
    正财格: '钱是一分一分攒出来的，还是一阵一阵撞进来的？你的财像长流水，不急不猛，库底越垫越厚。',
    偏财格: '有没有发现你的机会总是一波一波来？潮头赶上一次就够吃一阵，别在退潮的时候硬下水。',
    正官格: '规矩对你是束缚还是台阶？更像台阶——把该担的担起来，位置自然会给你留好。',
    七杀格: '压力到你这儿是山还是鞭子？你属于越压越能跑的那种人，硬仗打漂亮了，权柄自会落到手里。',
    正印格: '学东西对你是不是像浇水？你的脑子是浇就长的地，读过的书、遇过的贵人，最后都长成你的才。',
    食神格: '日子过的是滋味还是奔头？你偏巧两样都有——心宽、会吃、会玩，福气是慢慢煨出来的。',
    伤官格: '你的表达欲是毛病还是本事？用对地方它就是本事——那点藏不住的锋芒，正好当你的招牌。',
    建禄格: '靠别人搭台，还是自己打地基？你是后者——手里有本事、脚下有根基，功业自己一砖一瓦砌。',
    偏印格: '大家都挤的那条路，你是不是总提不起劲？你的脑子天生走冷门，走着走着，冷门就成了你的专业。',
    阳刃格: '你那股不服输的狠劲，打算用在哪儿？使在事业上它就是开山的斧，别在小事上空耗了锋口。',
    杀印相生: '难题砸过来的时候你慌不慌？你的盘里难题会变身——扛过去，就化成你的权柄和底气。',
    官印相生: '位置和口碑能不能都要？你能——规矩里长出名望，名望又反哺位置，这是贵气的正循环。',
    食神生财: '会生活会不会耽误赚钱？在你这儿反过来——把日子过香的本事，正好是把钱赚稳的本事。',
    伤官生财: '点子多到底值不值钱？看落不落得了地——你的才华不是烟花，是能一单单换成钱的手艺。',
    金白水清: '聪明和干净能不能写在同一张脸上？你这张盘写得下——脑子清、气象净，靠质感赢的人。',
    木火通明: '心里有光的人藏得住吗？藏不住——你的明白和热忱自己往外冒，写作、表达都是主场。',
    食伤泄秀: '本事憋在身上难不难受？你的盘讲究"泄"——把才华倒出来给人看，越给越有，人也敞亮。',
    食神制杀: '对手比你壮，这仗还打不打？打，但不硬拼——你的赢法是用巧劲管住蛮力，以柔克刚。',
    伤官配印: '有才华没耐心，是不是你的老毛病？你的盘里配了解药——锋芒加沉淀，才叫龙凤之才。',
    财官印俱备: '钱、位置、名声只能挑一样，你挑哪个？你不用挑——三样凑齐的盘少见，别辜负这碗赏饭。',
    枭印夺食: '想得多和做得少，是不是经常打架？给才华开个出口——先完成再完美，做出来，锁就开了。',
    贪财坏印: '眼前的实惠和长远的壮志，先顾哪头？偶尔让利给梦想——你现在喂它一口，它以后还一桌。',
    群劫争财: '钱到手里为什么总留不住？少搭伙、多自立——自己挣的自己攥，比合伙分的踏实。',
    官杀混杂: '选择太多是不是比没得选还累？两座山挑一座爬——爬到顶那天，回头看都是路。',
    伤官见官: '浑身是刺和浑身是光，差在哪儿？差个舞台——挑对场子再亮锋芒，比处处亮值钱得多。',
  };
  // 不带强弱断语的版本（10-06 用户反馈后定强弱向的说法只在强弱实锤时出；阴干没有羊刃）。
  // 劫财格＝阴干日主月令劫财（引擎叫劫财格，阴干不借阳刃格那套）；阳刃格、食神制杀＝强弱还没核实时换这一版。10-06 定字
  const HUAMING_SOFT = {
    劫财格: { line: '同辈里长本事，好胜也讲义气', desc: '身边的人对你是助力还是对手？两样都有——你在同辈里长本事，合作时讲义气，较劲时不服输，分寸拿捏好了就是长处。' },
    阳刃格: { line: '不服输的那股劲，用在正事上', desc: '你那股不服输的劲，打算用在哪儿？用在正事上，越难越扛得住；别在小事上较劲耗掉了。' },
    食神制杀: { line: '压力来了，用巧劲化开', desc: '压力大的时候，硬扛还是巧解？你的赢法是用巧劲管住蛮力，以柔克刚。' },
  };
  // 引擎格局名 → 花名表里的格（09-30）：去「杂气」；月刃、劫财→阳刃；比肩→建禄；从势格没有花名（外格走引擎释义）
  function huamingKey(name) {
    if (!name) return null;
    let k = name.replace(/^杂气/, '');
    if (k === '月刃格' || k === '劫财格') k = '阳刃格';
    if (k === '比肩格') k = '建禄格';
    return HUAMING[k] ? k : null;
  }
  // 成破细分名（杀印相生、群劫争财…）在引擎的判断理由里；排盘服务现在只给格局名和状态，理由接上后优先用细分名
  function huamingOf(pattern) {
    const reasons = (pattern && pattern.reasons) || [];
    const text = Array.isArray(reasons) ? reasons.join('；') : String(reasons);
    for (const k of Object.keys(HUAMING)) if (!/格$/.test(k) && text.includes(k)) return { key: k, line: HUAMING[k], desc: DESC[k] };
    const k = huamingKey(pattern && pattern.name);
    return k ? { key: k, line: HUAMING[k], desc: DESC[k] } : null;
  }

  let styled = false;
  function injectStyle() {
    if (styled) return; styled = true;
    const css = `
@font-face{font-family:"XbwSerif";src:url(${BASE}fonts/serif-b.woff2?v=20261004b) format("woff2");font-weight:700;font-display:swap}
@font-face{font-family:"XbwSerif";src:url(${BASE}fonts/serif-m.woff2?v=20261004b) format("woff2");font-weight:500;font-display:swap}
.xbi-head{position:relative;text-align:center}
.xbi-head::before{content:"";position:absolute;left:50%;top:calc(50% + 18px);width:96%;height:118px;transform:translate(-50%,-50%);z-index:-1;pointer-events:none;
  background:radial-gradient(ellipse 50% 50% at 50% 50%,rgba(255,255,255,.9),rgba(255,254,250,.78) 38%,rgba(255,252,246,.4) 64%,rgba(255,250,242,0) 86%)}   /* 她 09-30：白光收小，只托住两行字 */   /* 她 09-30：标题后面要像效果图那样白一大片 */
.xbi-title{margin:0;font-family:"XbwSerif","Songti SC",serif;font-weight:700;font-size:20px;line-height:1.2;letter-spacing:.1em;color:#3f2412;
  text-shadow:0 0 10px rgba(255,250,240,.95),0 0 22px rgba(255,248,236,.85)}
.xbi-sub{display:inline-flex;align-items:center;gap:2px;margin:9px 0 0;padding:0;border:0;background:none;font-family:"XbwSerif","Songti SC",serif;font-weight:500;font-size:13px;
  letter-spacing:.06em;color:#4a2c14;text-shadow:0 0 8px rgba(255,250,240,.95),0 0 18px rgba(255,248,236,.85);cursor:pointer;-webkit-tap-highlight-color:transparent}
.xbi-sub b{font-weight:700;color:#e08a14;font-size:1.22em;margin:0 1px}
.xbi-sub svg{width:13px;height:13px;margin-left:3px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.xbi-cal{position:absolute;right:0;top:0;display:inline-flex;align-items:center;gap:2px;padding:5px 8px 5px 11px;border:0;border-radius:999px;background:rgba(112,92,78,.62);color:#fff;
  font-family:-apple-system,"PingFang SC",sans-serif;font-size:11.5px;letter-spacing:.04em;cursor:pointer;-webkit-tap-highlight-color:transparent}
.xbi-cal svg{width:10px;height:10px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.xbi{container-type:inline-size;width:100%}
.xbi-card{box-sizing:border-box;padding:4.6cqw 4.6cqw 4.8cqw;color:#5b3a1e;border:1px solid rgba(220,190,140,.95);border-radius:4.6cqw;background:linear-gradient(180deg,rgba(255,253,249,.95),rgba(255,251,246,.93));box-shadow:0 .6cqw 3cqw rgba(160,120,70,.10),inset 0 1px 0 rgba(255,255,255,.75)}
.xbi-r1{display:flex;align-items:center;justify-content:space-between;gap:2cqw}
.xbi-hm{margin:0 0 0 -1.4cqw;font-family:"XbwSerif","Songti SC",serif;font-weight:700;font-size:4.59cqw;line-height:1.3;color:#3f2412;min-width:0}
.xbi-ai{flex:none;appearance:none;border:0;background:none;padding:0;display:inline-flex;align-items:center;gap:.6cqw;color:#d0975a;cursor:pointer;font-family:"XbwSerif","Songti SC",serif;font-size:3.28cqw;font-weight:500}
.xbi-ai b{font:italic 800 3.61cqw/1 -apple-system,"Helvetica Neue",sans-serif;color:#d0975a;letter-spacing:-.02em}
.xbi-ai svg,.xbi-ai i{width:3.4cqw;height:3.4cqw}
.xbi-ai svg{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.xbi-gj{display:flex;align-items:center;flex-wrap:wrap;margin:2.4cqw 0 0;font-family:"XbwSerif","Songti SC",serif;font-weight:700;font-size:3.53cqw;color:#4a2c14}
.xbi-q{appearance:none;display:inline-flex;align-items:center;justify-content:center;width:4.2cqw;height:4.2cqw;padding:0;margin-left:1.4cqw;border:1.2px solid #d29a5c;border-radius:50%;
  background:none;color:#d29a5c;font:600 2.79cqw/1 Georgia,"Times New Roman",serif;cursor:pointer}
.xbi-desc{margin:2.4cqw 0 0;font-size:3.07cqw;line-height:1.65;color:#5e4330}
.xbi-wg{display:flex;align-items:center;gap:1.6cqw;margin:3.4cqw 0 0;font-family:"XbwSerif","Songti SC",serif;font-weight:700;font-size:3.53cqw;color:#4a2c14}
.xbi-wg span{display:inline-block;padding:1.6cqw 3.6cqw;border:1px solid #e4b58a;border-radius:1.6cqw;background:rgba(255,253,248,.7);font-weight:500;font-size:3.36cqw;color:#b8661f}
`;
    const st = document.createElement('style'); st.setAttribute('data-xbi', ''); st.textContent = css; document.head.appendChild(st);
  }
  // 她 10-01：日主天干按五行上色（木绿 火红 土 金 水蓝），色值跟五行环一致
  const GAN_C = { 木: '#22916c', 火: '#dc3d4c', 土: '#8a6647', 金: '#dd8414', 水: '#2d7bd2' };
  const chev = '<svg viewBox="0 0 16 16"><path d="M6 3.5l4.5 4.5L6 12.5"/></svg>';
  const todo = (el, what) => el.dispatchEvent(new CustomEvent('xbw:todo', { bubbles: true, detail: what }));

  function dayMasterHead(el, { dayMaster, who = '自己', onCalendar, onDayMaster } = {}) {
    injectStyle();
    const d = dayMaster || {}, y = DAY_GAN[d.gan] || ['', ''];
    el.innerHTML = `<div class="xbi-head"><button class="xbi-cal" type="button">查看生辰历${chev}</button>
      <h1 class="xbi-title">${esc(d.dayGanZhi || '')}日出生的${esc(who)}</h1>
      <button class="xbi-sub" type="button">日主为<b style="color:${GAN_C[d.element] || '#e08a14'}">${esc(d.gan || '')}</b>，属${esc((d.yinYang || '') + (d.element || ''))}，如${esc(y[0])}${chev}</button></div>`;
    el.querySelector('.xbi-cal').addEventListener('click', () => (onCalendar ? onCalendar() : todo(el, '生辰历')));
    el.querySelector('.xbi-sub').addEventListener('click', () => (onDayMaster ? onDayMaster() : todo(el, '日主说明')));
    return el;
  }

  // 格局小结「财旺身衰」（09-30 定案）：X＝格局主神（七杀→杀、正官→官、财格→财、印格→印、食神伤官→食伤）；
  // 建禄、阳刃（主神是日主自己）取占比最高的非比劫组，满盘比劫只写「身旺」；身Y：强→身旺、弱→身衰、中和不写
  const GROUP = [['比劫', ['比肩', '劫财']], ['食伤', ['食神', '伤官']], ['财', ['正财', '偏财']], ['杀', ['七杀']], ['官', ['正官']], ['印', ['正印', '偏印']]];
  const MAIN = { 七杀格: '杀', 正官格: '官', 正财格: '财', 偏财格: '财', 正印格: '印', 偏印格: '印', 食神格: '食伤', 伤官格: '食伤' };
  function patternLabel(tenGod, strength, pattern) {
    const body = /强/.test(strength || '') ? '身旺' : /弱/.test(strength || '') ? '身衰' : '';
    const nm = String((pattern && pattern.name) || '').replace(/^杂气/, '');
    let x = MAIN[nm];
    if (!x && tenGod && tenGod.rows) {
      const by = Object.fromEntries(tenGod.rows.map((r) => [r.tenGod, r.percent]));
      const best = GROUP.filter(([n]) => n !== '比劫').map(([n, ms]) => [n, ms.reduce((a, m) => a + (by[m] || 0), 0)]).sort((a, b) => b[1] - a[1])[0];
      x = best && best[1] > 0 ? best[0] : '';
    }
    return x ? x + '旺' + body : body;
  }

  function patternCard(el, { pattern, label, desc, outer, onAi, onHelp } = {}) {
    injectStyle();
    const p = pattern || {}, hm = huamingOf(p);
    if (desc === undefined) desc = hm && hm.desc;
    el.classList.add('xbi');
    el.innerHTML = `<div class="xbi-card"><div class="xbi-r1"><div class="xbi-hm">${hm ? `【${esc(hm.line)}】` : ''}</div>
        <button class="xbi-ai" type="button"><b>Ai</b>解读${chev}</button></div>
      <div class="xbi-gj">格局：${esc(p.name || '')}${label ? '·' + esc(label) : ''}<button class="xbi-q" type="button" aria-label="说明">?</button></div>
      ${desc ? `<p class="xbi-desc">${esc(desc)}</p>` : ''}
      ${outer ? `<div class="xbi-wg">外格：<span>${esc(outer)}</span></div>` : ''}</div>`;
    el.querySelector('.xbi-ai').addEventListener('click', () => (onAi ? onAi() : todo(el, 'Ai解读')));
    el.querySelector('.xbi-q').addEventListener('click', () => (onHelp ? onHelp() : todo(el, '格局说明')));
    const wg = el.querySelector('.xbi-wg span'); if (wg) { wg.style.cursor = 'pointer'; wg.addEventListener('click', () => todo(el, '外格·' + outer)); }
    return el;
  }

  g.XuanjiBazi = Object.assign(g.XuanjiBazi || {}, { dayMasterHead, patternCard, patternLabel, huamingOf, HUAMING_SOFT, DAY_GAN });
})(window);
