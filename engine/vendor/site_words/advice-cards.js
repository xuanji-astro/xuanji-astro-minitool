/* 玄玑 · 八字 · 生辰页第二屏：适合行业／契合伴侣卡＋AI 个性化问答卡（照效果图 01-02）
   适合行业＝《幸运三项对照表》行业列，按喜用顺序取前两行；
   契合伴侣＝配偶星五行：男命看妻财（日主所克），女命看夫星官杀（克日主）；
   AI 问答卡：标题＝问玥神题库按盘型挑的问题，正文先按盘面拼一段（以后换 AI 个性化生成），底部「智能人生发展顾问 去问问」。
   用法：XuanjiBazi.fitCard(el, { favorable, dayMaster, gender })
         XuanjiBazi.aiCard(el, { question, summary, bullets, onAsk, onClose })
   类名 xba- 前缀。 */
(function (g) {
  const BASE = (document.currentScript && document.currentScript.src.replace(/[^/]*(\?.*)?$/, '')) || './';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const JOB = {
    木: '文教、出版、培训、设计、园艺、医药健康',
    火: '传媒、演艺、内容创作、能源、餐饮、美妆',
    土: '地产、建筑、农业、中介、顾问、项目管理',
    金: '金融、财务、投资、机械、司法、管理执行',
    水: '贸易、物流、旅游、数据、网络、咨询策划',
  };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };          // X 克 KE[X]
  const KE_BY = Object.fromEntries(Object.entries(KE).map(([a, b]) => [b, a])); // 谁克 X
  const todo = (el, what) => el.dispatchEvent(new CustomEvent('xbw:todo', { bubbles: true, detail: what }));

  let styled = false;
  function injectStyle() {
    if (styled) return; styled = true;
    const css = `
.xba{container-type:inline-size;width:100%}
.xba-card{position:relative;box-sizing:border-box;padding:4.6cqw 4.6cqw;color:#5b3a1e;border:1px solid rgba(220,190,140,.95);border-radius:4.6cqw;
  background:linear-gradient(180deg,rgba(255,253,249,.95),rgba(255,251,246,.93));box-shadow:0 .6cqw 3cqw rgba(160,120,70,.10),inset 0 1px 0 rgba(255,255,255,.75)}
.xba-fit{display:grid;grid-template-columns:9cqw 1fr;column-gap:3cqw;align-items:start}
.xba-fit img{width:9cqw;height:9cqw;grid-row:span 2}
.xba-fit b{font-family:"XbwSerif","Songti SC",serif;font-weight:700;font-size:4.6cqw;color:#3f2412;line-height:1.3}
.xba-fit p{margin:1.4cqw 0 0;font-size:3.7cqw;line-height:1.5;color:#5e4330}
.xba-hr{height:1px;margin:3.6cqw 0 3.6cqw 12cqw;background:linear-gradient(90deg,rgba(214,180,130,.55),rgba(214,180,130,.15))}
.xba-q{display:flex;align-items:center;gap:2cqw;padding-right:8cqw}
.xba-q h3{margin:0;font-family:"XbwSerif","Songti SC",serif;font-weight:700;font-size:4.9cqw;line-height:1.3;color:#3f2412}
.xba-tag{flex:none;padding:.6cqw 1.8cqw;border-radius:1.6cqw;background:linear-gradient(90deg,#7c8cff,#b678ff);color:#fff;font-size:3cqw;line-height:1.2}
.xba-x{position:absolute;right:4.4cqw;top:4.4cqw;appearance:none;border:0;background:none;padding:0;width:6cqw;height:6cqw;color:#b9a08a;cursor:pointer}
.xba-x svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round}
.xba-sum{margin:3cqw 0 0;font-size:3.75cqw;line-height:1.75;color:#5e4330}
.xba-more{position:relative;margin-top:3.6cqw;min-height:30cqw}
.xba-more h4{margin:0 0 2cqw;font-family:"XbwSerif","Songti SC",serif;font-weight:700;font-size:4cqw;color:#8a4e1c}
.xba-more ul{list-style:none;margin:0;padding:0;position:relative;z-index:1}
.xba-more li{position:relative;padding-left:4cqw;font-size:3.75cqw;line-height:2;color:#4a3524}
.xba-more li::before{content:"";position:absolute;left:.6cqw;top:50%;width:1.6cqw;height:1.6cqw;margin-top:-.8cqw;border-radius:50%;background:#e2a24a}
.xba-more img{position:absolute;right:-2cqw;bottom:-3cqw;width:42cqw;height:auto;opacity:.95;pointer-events:none}
.xba-bar{position:relative;z-index:1;display:flex;align-items:center;gap:3cqw;margin-top:3cqw;padding:3.2cqw 3.4cqw;border-radius:3.4cqw;
  background:linear-gradient(100deg,rgba(255,255,255,.92) 0%,rgba(253,244,234,.85) 55%,rgba(250,234,216,.75) 100%)}   /* 左白右淡杏渐变、无边框，有空气感 */
.xba-bar i{flex:none;width:10cqw;height:10cqw}
.xba-bar i svg{width:100%;height:100%}
.xba-bar div{flex:1;min-width:0}
.xba-bar b{display:block;font-family:"XbwSerif","Songti SC",serif;font-weight:700;font-size:4.3cqw;color:#3f2412}
.xba-bar span{display:block;margin-top:1cqw;font-size:3.3cqw;color:#c39a74}
.xba-go{flex:none;appearance:none;padding:2.2cqw 4.6cqw;border:0;border-radius:999px;background:#fff;color:#5b3a1e;box-shadow:0 .4cqw 1.6cqw rgba(200,160,120,.12);
  font-family:"XbwSerif","Songti SC",serif;font-weight:500;font-size:3.9cqw;cursor:pointer;display:inline-flex;align-items:center;gap:1cqw}
.xba-go svg{width:3.2cqw;height:3.2cqw;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

.xba-tk{display:flex;align-items:center;gap:3cqw;margin-top:3.6cqw;padding:0 3cqw 0 3.4cqw;height:12cqw;border-radius:3cqw;cursor:pointer;
  background:linear-gradient(100deg,rgba(255,255,255,.92) 0%,rgba(253,244,234,.85) 55%,rgba(250,234,216,.75) 100%)}
.xba-tk i{flex:none;width:8cqw;height:8cqw}
.xba-tk i svg{width:100%;height:100%}
.xba-tk-win{flex:1;min-width:0;height:100%;overflow:hidden;position:relative}
.xba-tk-list{position:absolute;left:0;right:0;top:0;transition:transform .55s cubic-bezier(.4,0,.2,1)}
.xba-tk-list b{display:flex;align-items:center;height:12cqw;font-family:"XbwSerif","Songti SC",serif;font-weight:700;font-size:4cqw;color:#8a4e1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.xba-tk>svg{flex:none;width:3.6cqw;height:3.6cqw;fill:none;stroke:#b08a66;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
`;
    const st = document.createElement('style'); st.setAttribute('data-xba', ''); st.textContent = css; document.head.appendChild(st);
  }

  function fitCard(el, { favorable = [], dayMaster = {}, gender = 'female' } = {}) {
    injectStyle();
    const jobs = [...new Set(favorable.slice(0, 2).flatMap((e) => (JOB[e] || '').split('、')).filter(Boolean))].slice(0, 6);
    const dm = dayMaster.element, spouse = gender === 'male' ? KE[dm] : KE_BY[dm];
    const why = gender === 'male' ? `男命以财为妻，日主${dm}所克为${spouse}` : `女命以官杀为夫，克日主${dm}者为${spouse}`;
    el.classList.add('xba');
    el.innerHTML = `<div class="xba-card">
      <div class="xba-fit"><img src="${BASE}img/ic-job.webp?v=20260930a" alt=""><b>适合行业</b><p>${esc(jobs.join('、'))}相关的职业</p></div>
      <div class="xba-hr"></div>
      <div class="xba-fit"><img src="${BASE}img/ic-love.webp?v=20260930a" alt=""><b>契合伴侣</b><p>配偶星属${esc(spouse || '')}（${esc(why)}）</p></div></div>`;
    return el;
  }

  const AI = '<svg viewBox="0 0 48 48"><defs><linearGradient id="xbaAi" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6E7BFF"/><stop offset="1" stop-color="#B66BFF"/></linearGradient></defs><text x="22" y="35" text-anchor="middle" font-size="26" font-style="italic" font-weight="800" fill="url(#xbaAi)" font-family="Helvetica Neue,Arial,sans-serif">Ai</text><path fill="url(#xbaAi)" d="M37 9l1.3 3L41 13.3l-2.7 1.2L37 17.5l-1.3-3L33 13.3l2.7-1.3z"/></svg>';
  function aiCard(el, { question = '', summary = '', bullets = [], onAsk, onClose } = {}) {
    injectStyle();
    el.classList.add('xba');
    el.innerHTML = `<div class="xba-card"><button class="xba-x" type="button" aria-label="关闭"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="xba-q"><h3>${esc(question)}</h3><span class="xba-tag">个性化</span></div>
      <p class="xba-sum">${esc(summary)}</p>
      <div class="xba-more"><h4>完整解读将为你展开：</h4><ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul><img src="${BASE}img/scroll.webp?v=20260930a" alt=""></div>
      <div class="xba-bar"><i>${AI}</i><div><b>智能人生发展顾问</b><span>结合命盘探索未来发展方向</span></div><button class="xba-go" type="button">去问问</button></div></div>`;
    el.querySelector('.xba-go').addEventListener('click', () => (onAsk ? onAsk() : todo(el, '问玥神')));
    el.querySelector('.xba-x').addEventListener('click', () => (onClose ? onClose() : (el.hidden = true)));
    return el;
  }


  // 09-30：AI 卡点 × 不是真没了——缩成一条「Ai＋问题」，问题一两秒往上滚一个，点它再展开
  function aiTicker(el, { questions = [], onOpen, interval = 1800 } = {}) {
    injectStyle();
    const qs = questions.filter(Boolean); if (!qs.length) return el;
    const bar = document.createElement('div'); bar.className = 'xba-tk'; bar.setAttribute('role', 'button');
    bar.innerHTML = `<i>${AI}</i><div class="xba-tk-win"><div class="xba-tk-list">${qs.concat(qs[0]).map((q) => `<b>${esc(q)}</b>`).join('')}</div></div><svg viewBox="0 0 16 16"><path d="M6 3.5l4.5 4.5L6 12.5"/></svg>`;
    el.appendChild(bar);
    const list = bar.querySelector('.xba-tk-list'); let i = 0;
    const step = () => {
      if (!bar.isConnected) return clearInterval(t);
      const h = bar.querySelector('.xba-tk-win').clientHeight; i++;
      list.style.transition = ''; list.style.transform = `translateY(${-i * h}px)`;
      if (i === qs.length) setTimeout(() => { list.style.transition = 'none'; list.style.transform = 'translateY(0)'; i = 0; }, 600);   // 滚到复制的第一条后无缝跳回
    };
    const t = setInterval(step, interval);
    bar.addEventListener('click', () => { clearInterval(t); bar.remove(); if (onOpen) onOpen(); });
    return bar;
  }

  // 正文先按盘面拼（以后由 AI 按盘面个性化生成）；完整解读三条按问题类别给
  const BULLETS = {
    情感: ['藏在深处的恋爱人格', '契合伴侣的性格和样貌特征', '容易出现的情感模式与相处建议'],
    事业: ['你的天赋落在哪类工作', '贵人与机会出现的时机', '这几年事业该怎么用劲'],
    财运: ['你赚钱的方式和节奏', '财来财去的关口在哪', '守财和生财的具体建议'],
    自我: ['你性格的底色与反差', '让你内耗的那根刺', '最适合你的成长方式'],
  };
  function aiCopy({ question, category, dayMaster = {}, gender, pattern = {}, label = '', favorable = [] }) {
    const g2 = gender === 'male' ? '男' : '女';
    const summary = `${dayMaster.gan || ''}${dayMaster.element || ''}${g2}${(pattern.name || '').replace(/^杂气/, '')}${label ? '，' + label : ''}；喜${favorable.slice(0, 3).join('')}，顺着喜用的方向使劲最省力。`;
    return { question, summary, bullets: BULLETS[category] || BULLETS.自我 };
  }

  g.XuanjiBazi = Object.assign(g.XuanjiBazi || {}, { fitCard, aiCard, aiCopy, aiTicker });
})(window);
