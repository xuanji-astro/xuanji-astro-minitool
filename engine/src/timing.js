// 应期层：八字流年（v0，待审）＋西盘行运（v1）按年合并，两套在同一年同一块人生都亮的标「映照」。
// 用在两处：对话里的验前事（过去的候选窗口）、报告里的节奏日历（往后五年）。
const { westYearlyV1, westWindows, lifeCycles } = require('./transits.js');
const { natal } = require('./engines.js');

const GAN = '甲乙丙丁戊己庚辛壬癸', ZHI = '子丑寅卯辰巳午未申酉戌亥';
const GEL = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
const MAINQI = { 子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬' };
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }, KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
function shishen(dm, g) {
  const a = GAN.indexOf(dm), b = GAN.indexOf(g), ea = GEL[a], eb = GEL[b], same = a % 2 === b % 2;
  if (ea === eb) return same ? '比肩' : '劫财';
  if (SHENG[ea] === eb) return same ? '食神' : '伤官';
  if (KE[ea] === eb) return same ? '偏财' : '正财';
  if (KE[eb] === ea) return same ? '七杀' : '正官';
  return same ? '偏印' : '正印';
}
const CHONG = (x, y) => Math.abs(ZHI.indexOf(x) - ZHI.indexOf(y)) === 6;
const HE6 = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const XING = [['寅', '巳'], ['巳', '申'], ['申', '寅'], ['丑', '戌'], ['戌', '未'], ['未', '丑'], ['子', '卯'], ['卯', '子']];
const isXing = (x, y) => XING.some(([a, b]) => a === x && b === y);
const GANKE = (x, y) => KE[GEL[GAN.indexOf(x)]] === GEL[GAN.indexOf(y)] || KE[GEL[GAN.indexOf(y)]] === GEL[GAN.indexOf(x)];
const MA = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' };
const TAOHUA = { 申: '酉', 子: '酉', 辰: '酉', 寅: '卯', 午: '卯', 戌: '卯', 巳: '午', 酉: '午', 丑: '午', 亥: '子', 卯: '子', 未: '子' };
const HONGLUAN = { 子: '卯', 丑: '寅', 寅: '丑', 卯: '子', 辰: '亥', 巳: '戌', 午: '酉', 未: '申', 申: '未', 酉: '午', 戌: '巳', 亥: '辰' };
const ganzhiOf = (y) => GAN[(y - 4) % 10] + ZHI[(y - 4) % 12];

// 报告里统一用的几块人生
const DOMAINS = ['感情', '迁移远方', '事业认可', '家庭', '工作', '钱', '自我', '官非', '全局'];

// ── 周岁（10-06 判：大运卡、时间线、学龄三处统一用周岁，共用这一段）──
// 周岁＝那天的年份减出生年，那年生日还没过再减一。虚岁不进任何用户看得到的地方。
// 时间线按年算，一年取年底那天（＝这一年过完生日的岁数，跟「核一次」workAge 的 y − 出生年同一口径）；大运卡传交运那天。
function zhouSui(birthDate, at) {
  const [by, bm, bd] = String(birthDate).slice(0, 10).split('-').map(Number);
  const d = typeof at === 'string' ? at.slice(0, 10).split('-').map(Number) : (() => { const l = new Date(at.getTime() + 8 * 36e5); return [l.getUTCFullYear(), l.getUTCMonth() + 1, l.getUTCDate()]; })();   // Date 按北京时间取日子
  return d[0] - by - (d[1] < bm || (d[1] === bm && d[2] < bd) ? 1 : 0);
}
const yearAge = (birthDate, y) => zhouSui(birthDate, `${y}-12-31`);
// ── 学龄（10-06 定）：22 岁及以下按学业说（context＝学业：工作那块说成学业、考试、升学）；
//    不满 18 岁：钱、官非、感情整类不出（不是降灰——小孩盘里冒感情危机既不准也不妥）；18～22 岁：钱、感情降灰，官非不出。
//    取代 v2.1 的「十四岁以下感情灯降灰」。八字、西盘两边一起收，所以同亮、验前事、往后的年份里也不会出现。
const STAGE = (age) => (age < 18 ? { context: '学业', hide: ['钱', '官非', '感情'], gray: [] } : age <= 22 ? { context: '学业', hide: ['官非'], gray: ['钱', '感情'] } : { context: '职场', hide: [], gray: [] });
// 不满 18 岁，钱折回家庭（10-06 定）：小孩没有自己的钱，钱上的事就是家里的事——钱的信号 1:1 改记家庭再一起计分（同年合并），
// 不是扔掉；文案走家庭口径（「家里的钱财有牵动」）。18～22 岁不折（钱照样降灰）。八字在信号这一层改，西盘在领域这一层合。
const MINOR_MONEY = '（不满 18 岁，钱算家里的）';
const minorSig = (sig, age) => (age < 18 ? sig.map((x) => (x.domain === '钱' ? { ...x, domain: '家庭', why: x.why + MINOR_MONEY } : x)) : sig);
function minorWest(wd, age) {
  if (age >= 18 || !wd['钱']) return wd;
  const o = { ...wd }, m = o['钱']; delete o['钱'];
  o['家庭'] = { w: ((o['家庭'] || {}).w || 0) + m.w, own: (o['家庭'] || {}).w || 0, why: [...((o['家庭'] || {}).why || []), ...m.why.map((x) => x + MINOR_MONEY)] };   // own＝原来家庭居所那份：迁移远方借西盘家庭时只认它，钱折进来的不算搬动
  return o;
}
function stageFilter(lit, age, extraGray) {   // lit：{领域: {w,…}}；返回收过的 lit，降灰的领域推进 extraGray（只记 w≥2 的，跟灰灯口径一致）
  const st = STAGE(age), out = {};
  for (const [k, v] of Object.entries(lit || {})) {
    if (st.hide.includes(k)) continue;
    if (st.gray.includes(k)) { if (extraGray && v.w >= 2 && !extraGray.includes(k)) extraGray.push(k); continue; }
    out[k] = v;
  }
  return out;
}
const WEST_TO = { 感情: '感情', 远方: '迁移远方', 家庭居所: '家庭', 事业认可: '事业认可', 工作: '工作', 钱: '钱', 自我: '自我', 全局: '全局' };
// 八字「迁移远方」也认西盘的「家庭居所」（搬家＝居所动）
const MIRROR_ALSO = { 迁移远方: ['家庭'] };
const alsoW = (wd, d) => (MIRROR_ALSO[d] || []).map((k) => (wd[k] ? (wd[k].own != null ? wd[k].own : wd[k].w) : 0));   // 借来的那块只认它本来的分（不满 18 岁钱折进家庭的不算）

function baziYear(bz, sex, y) {
  const P = bz.bazi.pillars, dm = bz.bazi.dayMaster.gan, yz = P.year.zhi, mz = P.month.zhi, dz = P.day ? P.day.zhi : null;
  const gz = ganzhiOf(y), g = gz[0], z = gz[1], sig = [];
  const add = (domain, w, why) => sig.push({ domain, w, why });
  const sg = shishen(dm, g), sz = shishen(dm, MAINQI[z]);
  if (dz) {
    if (CHONG(z, dz)) { add('感情', 2, '流年冲日支（婚姻宫）'); add('迁移远方', 1, '流年冲日支（住处动）'); }
    if (HE6[z] === dz) add('感情', 1, '流年合日支');
    if (isXing(z, dz)) add('感情', 1, '流年刑日支');
    if (gz === P.day.ganZhi) add('感情', 1.5, '伏吟日柱');
    if (CHONG(z, dz) && GANKE(g, P.day.gan)) add('感情', 2, '反吟日柱（天克地冲）');
    if (z === TAOHUA[dz]) add('感情', 1, '桃花年');
    if (z === MA[dz]) add('迁移远方', 1.5, '流年为驿马');
    else if (CHONG(z, MA[dz])) add('迁移远方', 1.5, '流年冲驿马位');
  }
  const love = sex === 'female' ? ['正官', '七杀'] : ['正财', '偏财'];
  if (love.includes(sg) || love.includes(sz)) add('感情', 1, (sex === 'female' ? '官杀' : '财星') + '年（配偶星）');
  if (z === TAOHUA[yz] && !(dz && z === TAOHUA[dz])) add('感情', 1, '桃花年');
  if (z === HONGLUAN[yz]) add('感情', 1, '红鸾年');
  if (CHONG(z, HONGLUAN[yz])) add('感情', 1, '天喜年');
  if (!(dz && (z === MA[dz] || CHONG(z, MA[dz])))) { if (z === MA[yz]) add('迁移远方', 1.5, '流年为驿马'); else if (CHONG(z, MA[yz])) add('迁移远方', 1.5, '流年冲驿马位'); }
  if (CHONG(z, yz)) { add('迁移远方', 1, '流年冲年支（离祖）'); add('家庭', 1, '流年冲年支（长辈）'); }
  if (sg === '正官' || sz === '正官') add('事业认可', 1, '正官年（名分、职位）');
  if (sg === '正印' || sz === '正印') add('事业认可', 1, '正印年（文书、录取）');
  if (((sg === '正官' || sg === '七杀') && sz.includes('印')) || ((sz === '正官' || sz === '七杀') && sg.includes('印'))) add('事业认可', 1, '官印相生之年');
  if (CHONG(z, mz)) { add('家庭', 2, '流年冲月支（家庭、工作环境）'); add('工作', 2, '流年冲月支'); }
  if (gz === P.month.ganZhi) add('家庭', 1.5, '伏吟月柱');
  const cy = bz.bazi.luck.cycles.find((c) => y >= c.startYear && y <= c.endYear);
  if (cy && gz === cy.ganZhi) add('全局', 2, '岁运并临');
  if (cy && y === cy.startYear) add('全局', 1.5, '换大运（' + cy.ganZhi + '）');
  const yr = cy && cy.years.find((v) => v.year === y);
  return { gz, shishen: [sg, sz], tier: yr ? yr.tier : null, score: yr ? yr.score : null, luck: cy ? cy.ganZhi : null, sig };
}

// ── 八字应期 v1（2026-10-01 审回）：流年不造事，只引动原局 ──
// 领域由「被引动的原局字」定（所在柱＋它的十神）；十神年只是主题标签、气氛组只加成，二者不许单独凑过线；
// 一块人生成立必须含至少一条扳机级或联动级信号；大运冲日支/月支的十年，对应领域的流年信号 ×1.5；
// 负向信号（配偶星被合走冲走、冲克父母星、冲财根）标 neg，性质（吉凶）另由喜忌判，这里不改「动」的分。
const GAN_HE = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };
const HAI = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
const ZIXING = ['辰', '午', '酉', '亥'];
const SANHE = [['申', '子', '辰', '水'], ['亥', '卯', '未', '木'], ['寅', '午', '戌', '火'], ['巳', '酉', '丑', '金']];
const SANHUI = [['寅', '卯', '辰', '木'], ['巳', '午', '未', '火'], ['申', '酉', '戌', '金'], ['亥', '子', '丑', '水']];
const KU = { 辰: '水', 戌: '火', 丑: '金', 未: '木' };   // 墓库：辰水库、戌火库、丑金库、未木库
const TIANYI = { 甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'], 乙: ['子', '申'], 己: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'], 辛: ['寅', '午'], 壬: ['卯', '巳'], 癸: ['卯', '巳'] };
const isGuan = (t) => t === '正官' || t === '七杀', isCai = (t) => t === '正财' || t === '偏财', isYin = (t) => t === '正印' || t === '偏印', isBi = (t) => t === '比肩' || t === '劫财';
const ELEM_OF_GAN = (g) => GEL[GAN.indexOf(g)];

function baziYearV1(bz, sex, y) {
  const P = bz.bazi.pillars, dm = bz.bazi.dayMaster.gan, dmEl = ELEM_OF_GAN(dm);
  const pos = [['year', '年柱'], ['month', '月柱'], ['day', '日柱'], ['hour', '时柱']].filter(([k]) => P[k]);
  const gz = ganzhiOf(y), g = gz[0], z = gz[1], sig = [];
  const add = (domains, w, cls, why, neg, hit) => { for (const d of [].concat(domains)) sig.push({ domain: d, w, cls, why, neg: !!neg, hit: hit || null }); };   // hit＝被引动的原局字（流月找二次引动用）
  const tg = (stem) => shishen(dm, stem), tgz = (zhi) => shishen(dm, MAINQI[zhi]);
  const spouse = (t) => (sex === 'female' ? isGuan(t) : isCai(t));
  const spouseEl = sex === 'female' ? Object.keys(KE).find((e) => KE[e] === dmEl) : KE[dmEl];   // 女命克我者为夫，男命我克者为妻
  const guanEl = Object.keys(KE).find((e) => KE[e] === dmEl), caiEl = KE[dmEl];
  // 一个原局字被引动，领域＝所在柱的宫位意义＋它的十神
  const domOf = (k, t) => {
    const d = new Set();
    if (k === 'year') { d.add('家庭'); d.add('迁移远方'); }
    if (k === 'month') { d.add('工作'); d.add('家庭'); }
    if (k === 'day') { d.add('感情'); d.add('自我'); }
    if (spouse(t)) d.add('感情');
    if (isCai(t)) d.add('钱');
    if (isGuan(t)) d.add('事业认可');
    if (isYin(t)) d.add('事业认可');
    if (t === '偏财' || t === '正印') d.add('家庭');
    return [...d];
  };
  const dz = P.day.zhi;
  // ── 扳机级 ──
  if (CHONG(z, dz) && GANKE(g, P.day.gan)) add(['感情', '自我'], 2.5, 'trigger', '反吟日柱（天克地冲）', false, { zhi: dz });
  if (GAN_HE[g] === dm) { const t = tg(g); add(spouse(t) ? ['感情'].concat(isGuan(t) ? ['事业认可'] : ['钱']) : isGuan(t) ? ['事业认可'] : isCai(t) ? ['钱'] : ['自我'], 2, 'trigger', `流年天干合日主（${t}来合我）`, false, { gan: dm }); }
  for (const [k, nm] of pos) if (k !== 'day' && GAN_HE[g] === P[k].gan && spouse(tg(P[k].gan))) add('感情', 2, 'trigger', `流年合走${nm}的配偶星（有人争合）`, true, { gan: P[k].gan });
  const cy = bz.bazi.luck.cycles.find((c) => y >= c.startYear && y <= c.endYear);
  if (cy && gz === cy.ganZhi) add('全局', 2, 'trigger', '岁运并临');
  if (CHONG(z, dz)) add(['感情', '自我', '迁移远方'], 2, 'trigger', '流年冲日支（婚姻宫、自身、住处动）', false, { zhi: dz });   // 审定：搬家前三条之二＝冲日支住处动
  // ── 联动级 ──
  const near = bz.bazi.luck.cycles.find((c) => Math.abs(y - c.startYear) <= 1 && c.seq > 1);
  if (near) add(['全局', '工作'], 1.5, 'link', `交脱大运（${near.ganZhi}）${y === near.startYear ? '当年' : '前后一年'}`);
  if (gz === P.day.ganZhi) add('自我', 1.5, 'link', '伏吟日柱（自身大事、原地折腾）');
  const maSet = new Set([MA[dz], MA[P.year.zhi]]);
  for (const [k, nm] of pos) if (maSet.has(P[k].zhi) && CHONG(z, P[k].zhi)) add('迁移远方', 1.5, 'link', `驿马逢冲（${nm}${P[k].zhi}为驿马，被流年冲）`, false, { zhi: P[k].zhi });
  if (z === MA[dz]) add('迁移远方', 1, 'link', '流年为驿马（日支起）');
  else if (z === MA[P.year.zhi]) add('迁移远方', 0.7, 'link', '流年为驿马（年支起）');
  if (CHONG(z, P.month.zhi)) add(['工作', '家庭'], 1.5, 'link', '流年冲月支（月令：工作、家庭）', false, { zhi: P.month.zhi });
  if (CHONG(z, P.year.zhi)) add(['家庭', '迁移远方'], 1.5, 'link', '流年冲年支（根、祖籍、长辈）', false, { zhi: P.year.zhi });
  const luckZ = cy ? cy.ganZhi[1] : null, natalZ = pos.map(([k]) => P[k].zhi);
  for (const [a, b, c, el] of [...SANHE, ...SANHUI]) {
    const set = [a, b, c];
    if (!set.includes(z)) continue;
    const have = new Set([z, luckZ, ...natalZ].filter(Boolean));
    if (set.every((x) => have.has(x)) && !set.every((x) => natalZ.includes(x))) {
      if (el === spouseEl) add('感情', 1.5, 'link', `流年参与${a}${b}${c}成局，化出配偶星（${el}）`);
      if (el === guanEl) add('事业认可', 1.5, 'link', `流年参与${a}${b}${c}成局，化出官杀（${el}）`);
      if (el === caiEl) add('钱', 1.5, 'link', `流年参与${a}${b}${c}成局，化出财星（${el}）`);
    }
  }
  const kw = (P.day.kongWang || []);
  for (const [k, nm] of pos) if (kw.includes(P[k].zhi) && z === P[k].zhi) add(domOf(k, tgz(P[k].zhi)), 1.5, 'link', `空亡填实（${nm}${P[k].zhi}落空，流年填出）`, false, { zhi: P[k].zhi });
  for (const [k, nm] of pos) {
    const zk = P[k].zhi;
    if (KU[zk] && CHONG(z, zk) && (KU[zk] === caiEl || KU[zk] === spouseEl)) add(KU[zk] === spouseEl ? ['感情'].concat(KU[zk] === caiEl ? ['钱'] : []) : ['钱'], 1.5, 'link', `墓库逢冲（${nm}${zk}是${KU[zk] === caiEl ? '财库' : '配偶星库'}，被冲开）`, false, { zhi: zk });
  }
  for (const [k, nm] of pos) {
    const t = tgz(P[k].zhi);
    if (!CHONG(z, P[k].zhi)) continue;
    if (spouse(t) && k !== 'day') add('感情', 1.5, 'link', `流年冲走${nm}配偶星的根`, true, { zhi: P[k].zhi });
    if (t === '偏财' || t === '正印') add('家庭', 1.5, 'link', `流年冲${nm}${t}（${t === '偏财' ? '父' : '母'}）`, true, { zhi: P[k].zhi });
    if (isCai(t)) add('钱', 1.5, 'link', `流年冲${nm}财星本气（财根被拔）`, true, { zhi: P[k].zhi });
    if (isGuan(t)) add(['工作', '事业认可'], 1.5, 'link', `流年冲${nm}官杀星（工作被动）`, false, { zhi: P[k].zhi });
  }
  for (const [k, nm] of pos) if (k !== 'day' && HE6[z] === P[k].zhi && isGuan(tgz(P[k].zhi))) add(['工作', '事业认可'], 1.5, 'link', `流年合${nm}官杀星（调动、新机会）`, false, { zhi: P[k].zhi });
  for (const [k, nm] of pos) if (GANKE(g, P[k].gan) && KE[ELEM_OF_GAN(g)] === ELEM_OF_GAN(P[k].gan) && (tg(P[k].gan) === '偏财' || tg(P[k].gan) === '正印') && k !== 'day') add('家庭', 1.5, 'link', `流年天干克${nm}透出的${tg(P[k].gan)}`, true, { gan: P[k].gan });
  // ── 弱信号 ──
  if (HE6[z] === dz) add('感情', 1, 'weak', '流年合日支', false, { zhi: dz });
  if (isXing(z, dz)) add('感情', 1, 'weak', '流年刑日支', false, { zhi: dz });
  if (HAI[z] === dz) add('感情', 0.5, 'weak', '流年害日支（关系里暗耗）', true, { zhi: dz });
  for (const [k, nm] of pos) if (ZIXING.includes(z) && z === P[k].zhi) add(domOf(k, tgz(z)), 0.5, 'weak', `自刑（${nm}${z}）`, false, { zhi: z });
  // ── 主题标签（不可独立成应期）──
  const sg = tg(g), sz = tgz(z);
  if (isGuan(sg) || isGuan(sz)) add(sex === 'female' ? ['感情', '事业认可'] : ['事业认可'], 0.75, 'theme', '官杀年（主题）');
  if (isCai(sg) || isCai(sz)) add(sex === 'male' ? ['感情', '钱'] : ['钱'], 0.75, 'theme', '财星年（主题）');
  if (isYin(sg) || isYin(sz)) add('事业认可', 0.75, 'theme', '印年（主题：文书、录取）');
  if ((isGuan(sg) && isYin(sz)) || (isYin(sg) && isGuan(sz))) add('事业认可', 1, 'theme', '官印相生之年');
  if ((isBi(sg) || isBi(sz)) && pos.some(([k]) => k !== 'day' && isCai(tg(P[k].gan)))) add('钱', 1, 'theme', '比劫年遇原局财星透干（群劫争财）', true);
  // ── 气氛组（只加成）──
  if (z === TAOHUA[dz]) add('感情', 0.5, 'aura', '桃花（日支起）'); else if (z === TAOHUA[P.year.zhi]) add('感情', 0.35, 'aura', '桃花（年支起）');
  if (z === HONGLUAN[P.year.zhi]) add('感情', 0.5, 'aura', '红鸾');
  if (CHONG(z, HONGLUAN[P.year.zhi])) add('感情', 0.5, 'aura', '天喜');
  if ((TIANYI[dm] || []).includes(z) || (TIANYI[P.year.gan] || []).includes(z)) add('事业认可', 0.5, 'aura', '天乙贵人年');
  // ── 大运背景板：大运冲日支/月支的十年，对应领域 ×1.5 ──
  if (cy) {
    const boost = new Set();
    if (CHONG(luckZ, dz)) ['感情', '自我'].forEach((d) => boost.add(d));
    if (CHONG(luckZ, P.month.zhi)) ['工作', '家庭'].forEach((d) => boost.add(d));
    for (const s of sig) if (boost.has(s.domain) && (s.cls === 'trigger' || s.cls === 'link')) { s.w *= 1.5; s.why += '（大运冲动该宫，×1.5）'; }
  }
  const yr = cy && cy.years.find((v) => v.year === y);
  return { gz, shishen: [sg, sz], tier: yr ? yr.tier : null, score: yr ? yr.score : null, luck: cy ? cy.ganZhi : null, sig };
}

// v1 分组：领域里没有扳机级或联动级信号的，不成立（主题、气氛不许单独凑分）
function groupV1(sig) {
  const o = {};
  for (const s of sig) { (o[s.domain] = o[s.domain] || { w: 0, why: [], gate: false, neg: false }); o[s.domain].w += s.w; o[s.domain].why.push(s.why); if (s.cls === 'trigger' || s.cls === 'link') o[s.domain].gate = true; if (s.neg) o[s.domain].neg = true; }
  for (const k of Object.keys(o)) if (!o[k].gate) delete o[k];
  return o;
}

// ── 八字应期 v2（2026-10-01 轨迹归因＋修改清单）──
// ①主从记账：一个信号只给主领域全分；旁领域（目前是感情）要有另一类感情专指信号佐证才记（配偶星动／婚姻宫刑冲合害／红鸾天喜，三类互证）
//   反吟、伏吟日柱→主自我、全局；冲日支→主自我、兼迁移，感情要佐证；合日主按十神归主领域，女命官杀保留双记（官星本性），男命财来合我感情要佐证；合走配偶星要佐证
// ②成局双向记账＋十神全覆盖：化出什么都记；被合化走的原局字按原十神记负向；化出忌神局（比劫、官杀、食伤）记负向并进官非
// ③刑害看全四柱：日支 1、月时 0.75、年 0.5（候选值）；刑按两两对称
// ④新领域「官非」：伤官见官、三刑填齐、羊刃逢冲、身弱七杀无制再透财（天罗地网、官符只加成）；事业开局：日主逢禄、食伤生财、运年双喜；名分：天乙叠官、禄带官印、身旺食伤吐秀
// ⑤迁移补强：冲年支＋驿马同年合成联动 2.5；大运冲日支、冲年支的十年，迁移也吃 ×1.5
// ⑥十四岁以下的感情灯降成灰灯（不对用户说）
const LU = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
const REN = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };   // 阳刃（阳干）
const XING_SYM = (x, y) => XING.some(([a, b]) => (a === x && b === y) || (a === y && b === x));
const SAN_XING = [['寅', '巳', '申'], ['丑', '戌', '未']];
function baziYearV2(bz, sex, y, opt = {}) {   // v2.1（10-01 定版）：天乙叠官、食伤生财收紧，运年双喜按审定写法，官非两条升 2.5，无制含印化；opt.loose＝回到 v2 照规格版做对照
  const P = bz.bazi.pillars, dm = bz.bazi.dayMaster.gan, dmEl = ELEM_OF_GAN(dm);
  const pos = [['year', '年柱'], ['month', '月柱'], ['day', '日柱'], ['hour', '时柱']].filter(([k]) => P[k]);
  const gz = ganzhiOf(y), g = gz[0], z = gz[1], sig = [];
  const birthY = +bz.input.date.slice(0, 4), young = y - birthY < 14;
  const strong = /强|旺/.test(bz.bazi.strength || ''), weak = /弱|衰/.test(bz.bazi.strength || '');
  const fav = new Set(bz.bazi.usefulGods.favorableWuxing || []), unfav = new Set(bz.bazi.usefulGods.unfavorableWuxing || []);
  // opt：side＝旁领域要佐证；spec＝感情专指（kind：宫／星／鸾）
  const add = (domains, w, cls, why, neg, hit, opt = {}) => { for (const d of [].concat(domains)) sig.push({ domain: d, w, cls, why, neg: !!neg, hit: hit || null, side: !!opt.side, spec: opt.spec || null }); };
  const tg = (stem) => shishen(dm, stem), tgz = (zhi) => shishen(dm, MAINQI[zhi]);
  const spouse = (t) => (sex === 'female' ? isGuan(t) : isCai(t));
  const spouseEl = sex === 'female' ? Object.keys(KE).find((e) => KE[e] === dmEl) : KE[dmEl];
  const guanEl = Object.keys(KE).find((e) => KE[e] === dmEl), caiEl = KE[dmEl], yinEl = Object.keys(SHENG).find((e) => SHENG[e] === dmEl), shiEl = SHENG[dmEl];
  const catOf = (el) => (el === dmEl ? '比劫' : el === yinEl ? '印' : el === shiEl ? '食伤' : el === caiEl ? '财' : '官杀');
  const domOf = (k, t) => {
    const d = new Set();
    if (k === 'year') { d.add('家庭'); d.add('迁移远方'); }
    if (k === 'month') { d.add('工作'); d.add('家庭'); }
    if (k === 'day') { d.add('自我'); }
    if (spouse(t)) d.add('感情');
    if (isCai(t)) d.add('钱');
    if (isGuan(t) || isYin(t)) d.add('事业认可');
    if (t === '偏财' || t === '正印') d.add('家庭');
    return [...d];
  };
  const dz = P.day.zhi, cy = bz.bazi.luck.cycles.find((c) => y >= c.startYear && y <= c.endYear), luckG = cy ? cy.ganZhi[0] : null, luckZ = cy ? cy.ganZhi[1] : null;
  const natalZ = pos.map(([k]) => P[k].zhi), natalTen = [...pos.filter(([k]) => k !== 'day').map(([k]) => tg(P[k].gan)), ...natalZ.map(tgz)];
  const sg = tg(g), sz = tgz(z);
  // ── 日柱 ──
  if (CHONG(z, dz) && GANKE(g, P.day.gan)) { add(['自我', '全局'], 2.5, 'trigger', '反吟日柱（天克地冲）', false, { zhi: dz }); add('感情', 2.5, 'trigger', '反吟日柱冲动婚姻宫', false, { zhi: dz }, { side: true, spec: '宫' }); }
  else if (CHONG(z, dz)) { add(['自我', '迁移远方'], 2, 'trigger', '流年冲日支（自身、住处动）', false, { zhi: dz }); add('感情', 2, 'trigger', '流年冲日支（婚姻宫动）', false, { zhi: dz }, { side: true, spec: '宫' }); }
  if (gz === P.day.ganZhi) add(['自我', '全局'], 1.5, 'link', '伏吟日柱（自身大事、原地折腾）');
  if (GAN_HE[g] === dm) {
    const t = tg(g);
    if (sex === 'female' && isGuan(t)) add(['事业认可', '感情'], 2, 'trigger', `流年天干合日主（${t}来合我，女命官星名分感情双记）`, false, { gan: dm }, { spec: '星' });
    else if (sex === 'male' && isCai(t)) { add('钱', 2, 'trigger', `流年天干合日主（${t}来合我）`, false, { gan: dm }); add('感情', 2, 'trigger', `流年天干合日主（男命${t}来合）`, false, { gan: dm }, { side: true, spec: '星' }); }
    else add(isGuan(t) ? '事业认可' : isCai(t) ? '钱' : '自我', 2, 'trigger', `流年天干合日主（${t}来合我）`, false, { gan: dm });
  }
  // 偏财落点（10-06 定，通用）：宫位定主场、十神定主题，合＝被牵走、有人来争，克＝直接受损；一条信号只记主场。
  //   年柱、月柱的偏财 → 家庭（父）；时柱的偏财 → 钱（时柱不主父母，偏财也不是正配）。合入日支才落感情（见合日支）。
  const pianCaiDom = (k) => (k === 'hour' ? '钱' : '家庭');
  for (const [k, nm] of pos) {
    if (k === 'day' || GAN_HE[g] !== P[k].gan) continue;
    const t = tg(P[k].gan);
    if (t === '偏财') add(pianCaiDom(k), 2, 'trigger', k === 'hour' ? `流年合走${nm}偏财（钱被牵走、有人来争）` : `流年合走${nm}偏财（父）`, true, { gan: P[k].gan });
    else if (spouse(t)) add('感情', 2, 'trigger', `流年合走${nm}的配偶星（有人争合）`, true, { gan: P[k].gan }, { side: true, spec: '星' });
  }
  if (cy && gz === cy.ganZhi) add('全局', 2, 'trigger', '岁运并临');
  // ── 大运交接、运年双喜 ──
  const near = bz.bazi.luck.cycles.find((c) => Math.abs(y - c.startYear) <= 1 && c.seq > 1);
  const elG = (x) => ELEM_OF_GAN(x), elZ = (x) => ELEM_OF_GAN(MAINQI[x]);
  const shuangxi = cy && cy.seq > 1 && y - cy.startYear >= 0 && y - cy.startYear <= 1 && (fav.has(elG(luckG)) || fav.has(elZ(luckZ))) && (opt.loose ? fav.has(elG(g)) || fav.has(elZ(z)) : fav.has(elG(g)));   // v2.1：大运干或支任一喜用＋当年流年（天干）十神为喜用
  if (near) add(shuangxi ? ['全局'] : ['全局', '工作'], 1.5, 'link', `交脱大运（${near.ganZhi}）${y === near.startYear ? '当年' : '前后一年'}`);
  if (shuangxi) add('工作', 1.5, 'link', `运年双喜（换入喜用大运${cy.ganZhi}后第${y - cy.startYear + 1}年，流年再扶喜用）`);
  // ── 迁移：冲年支＋驿马同年合成 ──
  const maSet = new Set([MA[dz], MA[P.year.zhi]]);
  const maChong = pos.filter(([k]) => maSet.has(P[k].zhi) && CHONG(z, P[k].zhi));
  const maYear = z === MA[dz] ? 1 : z === MA[P.year.zhi] ? 0.7 : 0;
  const yearChong = CHONG(z, P.year.zhi);
  if (yearChong && (maChong.length || maYear)) add('迁移远方', 2.5, 'link', '冲年支＋驿马同年（根动、动象齐备）', false, { zhi: P.year.zhi });
  else {
    for (const [k, nm] of maChong) add('迁移远方', 1.5, 'link', `驿马逢冲（${nm}${P[k].zhi}为驿马，被流年冲）`, false, { zhi: P[k].zhi });
    if (maYear) add('迁移远方', maYear, 'link', `流年为驿马（${maYear === 1 ? '日支' : '年支'}起）`);
    if (yearChong) add('迁移远方', 1.5, 'link', '流年冲年支（根动）', false, { zhi: P.year.zhi });
  }
  if (yearChong) add('家庭', 1.5, 'link', '流年冲年支（祖籍、长辈）', false, { zhi: P.year.zhi });
  if (CHONG(z, P.month.zhi)) add(['工作', '家庭'], 1.5, 'link', '流年冲月支（月令：工作、家庭）', false, { zhi: P.month.zhi });
  // ── 成局：双向记账、十神全覆盖 ──
  for (const [a, b, c, el] of [...SANHE, ...SANHUI]) {
    const set = [a, b, c];
    if (!set.includes(z)) continue;
    const have = new Set([z, luckZ, ...natalZ].filter(Boolean));
    if (!set.every((x) => have.has(x)) || set.every((x) => natalZ.includes(x))) continue;
    const cat = catOf(el), name = `${a}${b}${c}${SANHE.some((r) => r[3] === el && r[0] === a) ? '三合' : '三会'}${el}局`;
    const jiJu = unfav.has(el) && ['比劫', '官杀', '食伤'].includes(cat);
    if (el === spouseEl) add('感情', 1.5, 'link', `流年成${name}，化出配偶星`, false, null, { spec: '星' });
    const dom = cat === '比劫' ? '钱' : cat === '印' ? '事业认可' : cat === '食伤' ? '工作' : cat === '财' ? '钱' : '事业认可';
    if (!(el === spouseEl && dom === '感情')) add(dom, 1.5, 'link', `流年成${name}，化出${cat}${jiJu ? '（忌神局）' : ''}`, jiJu || cat === '比劫');
    if (jiJu) add('官非', 1.5, 'link', `化出忌神${cat}局（${name}）`, true);
    for (const [k, nm] of pos) if (set.includes(P[k].zhi) && elZ(P[k].zhi) !== el) add(domOf(k, tgz(P[k].zhi)), 1.5, 'link', `${nm}${P[k].zhi}（${tgz(P[k].zhi)}）被${name}合化走`, true, { zhi: P[k].zhi });
  }
  // ── 空亡填实、墓库逢冲、冲克原局 ──
  let dayPianCai = false;   // 日支本气偏财被冲（钱作辅要用）
  const kw = (P.day.kongWang || []);
  for (const [k, nm] of pos) if (kw.includes(P[k].zhi) && z === P[k].zhi) add(domOf(k, tgz(P[k].zhi)), 1.5, 'link', `空亡填实（${nm}${P[k].zhi}落空，流年填出）`, false, { zhi: P[k].zhi });
  for (const [k, nm] of pos) {
    const zk = P[k].zhi;
    if (KU[zk] && CHONG(z, zk) && (KU[zk] === caiEl || KU[zk] === spouseEl)) {
      if (KU[zk] === spouseEl) add('感情', 1.5, 'link', `墓库逢冲（${nm}${zk}是配偶星库，被冲开）`, false, { zhi: zk }, { spec: '星' });
      if (KU[zk] === caiEl) add('钱', 1.5, 'link', `墓库逢冲（${nm}${zk}是财库，被冲开）`, false, { zhi: zk });
    }
  }
  for (const [k, nm] of pos) {
    const t = tgz(P[k].zhi);
    if (!CHONG(z, P[k].zhi)) continue;
    if (t === '偏财') {   // 偏财落点：年、月柱→家庭（父），时柱→钱，日柱→感情（夫妻宫动，10-06 判）；只记主场
      if (k === 'hour') add('钱', 1.5, 'link', `流年冲${nm}偏财本气（财根被拔）`, true, { zhi: P[k].zhi });
      else if (k === 'day') { add('感情', 1.5, 'link', '流年冲日支偏财（夫妻宫动）', true, { zhi: P[k].zhi }, { spec: '宫' }); dayPianCai = true; }
      else add('家庭', 1.5, 'link', `流年冲${nm}偏财（父）`, true, { zhi: P[k].zhi });
    } else {
      if (spouse(t) && k !== 'day') add('感情', 1.5, 'link', `流年冲走${nm}配偶星的根`, true, { zhi: P[k].zhi }, { spec: '星' });
      if (t === '偏财' || t === '正印') add('家庭', 1.5, 'link', `流年冲${nm}${t}（${t === '偏财' ? '父' : '母'}）`, true, { zhi: P[k].zhi });
      if (isCai(t)) add('钱', 1.5, 'link', `流年冲${nm}财星本气（财根被拔）`, true, { zhi: P[k].zhi });
    }
    if (isGuan(t)) add(['工作', '事业认可'], 1.5, 'link', `流年冲${nm}官杀星（工作被动）`, false, { zhi: P[k].zhi });
  }
  for (const [k, nm] of pos) if (k !== 'day' && HE6[z] === P[k].zhi && isGuan(tgz(P[k].zhi))) add(['工作', '事业认可'], 1.5, 'link', `流年合${nm}官杀星（调动、新机会）`, false, { zhi: P[k].zhi });
  for (const [k, nm] of pos) if (GANKE(g, P[k].gan) && KE[elG(g)] === elG(P[k].gan) && (tg(P[k].gan) === '偏财' || tg(P[k].gan) === '正印') && k !== 'day') {
    if (tg(P[k].gan) === '偏财' && k === 'hour') add('钱', 1.5, 'link', `流年天干克${nm}透出的偏财（破财、花销）`, true, { gan: P[k].gan });   // 偏财落点：时柱→钱
    else add('家庭', 1.5, 'link', `流年天干克${nm}透出的${tg(P[k].gan)}${tg(P[k].gan) === '偏财' ? '（父）' : ''}`, true, { gan: P[k].gan });
  }
  // ── 官非 ──
  const hasZG = natalTen.includes('正官'), hasSG = natalTen.includes('伤官');
  if ((hasZG && sg === '伤官') || (hasSG && sg === '正官')) add('官非', 2.5, 'trigger', sg === '伤官' ? '伤官见官（原局正官，流年透伤官）' : '伤官见官（原局伤官，流年正官来填）', true);
  else if ((hasZG && sz === '伤官') || (hasSG && sz === '正官')) add('官非', 1.25, 'trigger', sz === '伤官' ? '伤官见官（原局正官，流年地支本气伤官，减半）' : '伤官见官（原局伤官，流年地支本气正官，减半）', true);
  for (const tri of SAN_XING) if (tri.includes(z) && tri.filter((x) => x !== z).every((x) => natalZ.includes(x))) { add('官非', 2.5, 'trigger', `三刑填齐（${tri.join('')}）`, true); if (tri[0] === '丑') add('钱', 1.5, 'link', '丑戌未三刑填齐（因财起祸）', true); }
  if (REN[dm] && CHONG(z, REN[dm]) && natalZ.includes(REN[dm])) add('官非', P.month.zhi === REN[dm] ? 2 : 1.5, P.month.zhi === REN[dm] ? 'trigger' : 'link', `羊刃逢冲（${REN[dm]}刃被流年冲）`, true, { zhi: REN[dm] });
  if (weak && natalTen.includes('七杀') && !natalTen.some((t) => t === '食神' || t === '伤官' || isYin(t)) && isCai(sg)) add('官非', 1.5, 'link', '身弱七杀无制（无食伤制、无印化），流年透财生杀', true);
  if ((natalZ.includes('辰') && z === '巳') || (natalZ.includes('巳') && z === '辰') || (natalZ.includes('戌') && z === '亥') || (natalZ.includes('亥') && z === '戌')) add('官非', 0.5, 'aura', '天罗地网');
  if (z === ZHI[(ZHI.indexOf(P.year.zhi) + 4) % 12]) add('官非', 0.5, 'aura', '官符年');
  // ── 事业开局、名分 ──
  if (z === LU[dm]) add('工作', strong ? 2 : 1, strong ? 'trigger' : 'link', strong ? '日主逢禄（身旺立门户）' : '日主逢禄');
  const natalGanTen = pos.filter(([k]) => k !== 'day').map(([k]) => tg(P[k].gan));
  const natalCai = (opt.loose ? natalTen : natalGanTen).some(isCai), natalShi = (opt.loose ? natalTen : natalGanTen).some((t) => t === '食神' || t === '伤官');
  if (((sg === '食神' || sg === '伤官') && natalCai) || (natalShi && (isCai(sg) || (opt.loose && isCai(sz))))) add('工作', 1.5, 'link', '食伤生财（产出变现）');
  if (strong && (sg === '食神' || sg === '伤官')) add('事业认可', 1.5, 'link', '身旺食伤吐秀（才华被看见）');
  const tianyi = (TIANYI[dm] || []).includes(z) || (TIANYI[P.year.gan] || []).includes(z);
  if (opt.loose ? tianyi && (isGuan(sg) || isGuan(sz)) : (TIANYI[dm] || []).includes(z) && isGuan(sg)) add('事业认可', 1.5, 'link', '天乙贵人叠官星（贵人引荐、官方认可）');
  if (z === LU[dm] && luckG && ((isGuan(sg) && isYin(tg(luckG))) || (isYin(sg) && isGuan(tg(luckG))))) add('事业认可', 1.5, 'link', '禄带官印（名至实归）');
  // 日支偏财被冲，钱作辅不堆：这一年另有钱的扳机级／联动级信号，才带 0.5（弱信号，自己开不了闸）
  if (dayPianCai && sig.some((x) => x.domain === '钱' && (x.cls === 'trigger' || x.cls === 'link'))) add('钱', 0.5, 'weak', '流年冲日支偏财（钱作辅）', true, { zhi: dz });
  // ── 弱信号：刑害全四柱 ──
  const FAC = { day: 1, month: 0.75, hour: 0.75, year: 0.5 };
  if (HE6[z] === dz) add('感情', 0.5, 'weak', '流年合日支', false, { zhi: dz }, { spec: '宫' });   // 10-06：宫动只说明关系有牵动，单独不亮（弱信号开不了闸），记 0.5 等佐证
  for (const [k, nm] of pos) {
    const zk = P[k].zhi, dom = k === 'day' ? ['感情'] : domOf(k, tgz(zk)), opt = k === 'day' ? { spec: '宫' } : {};
    if (XING_SYM(z, zk)) add(dom, 1 * FAC[k], 'weak', `流年刑${nm}${zk}`, false, { zhi: zk }, opt);
    if (HAI[z] === zk) add(dom, 0.5 * FAC[k], 'weak', `流年害${nm}${zk}`, true, { zhi: zk }, opt);
    if (ZIXING.includes(z) && z === zk) add(domOf(k, tgz(z)), 0.5, 'weak', `自刑（${nm}${z}）`, false, { zhi: z });
  }
  // ── 主题标签、气氛组 ──
  if (isGuan(sg) || isGuan(sz)) add(sex === 'female' ? ['感情', '事业认可'] : ['事业认可'], 0.75, 'theme', '官杀年（主题）');
  if (isCai(sg) || isCai(sz)) add(sex === 'male' ? ['感情', '钱'] : ['钱'], 0.75, 'theme', '财星年（主题）');
  if (isYin(sg) || isYin(sz)) add('事业认可', 0.75, 'theme', '印年（主题：文书、录取）');
  if ((isGuan(sg) && isYin(sz)) || (isYin(sg) && isGuan(sz))) add('事业认可', 1, 'theme', '官印相生之年');
  if ((isBi(sg) || isBi(sz)) && pos.some(([k]) => k !== 'day' && isCai(tg(P[k].gan)))) add('钱', 1, 'theme', '比劫年遇原局财星透干（群劫争财）', true);
  if (z === TAOHUA[dz]) add('感情', 0.5, 'aura', '桃花（日支起）'); else if (z === TAOHUA[P.year.zhi]) add('感情', 0.35, 'aura', '桃花（年支起）');
  if (z === HONGLUAN[P.year.zhi]) add('感情', 0.5, 'aura', '红鸾', false, null, { spec: '鸾' });
  if (CHONG(z, HONGLUAN[P.year.zhi])) add('感情', 0.5, 'aura', '天喜', false, null, { spec: '鸾' });
  if (tianyi) add('事业认可', 0.5, 'aura', '天乙贵人年');
  // ── 大运背景板 ──
  if (cy) {
    const boost = new Set();
    if (CHONG(luckZ, dz)) ['感情', '自我', '迁移远方'].forEach((d) => boost.add(d));
    if (CHONG(luckZ, P.month.zhi)) ['工作', '家庭'].forEach((d) => boost.add(d));
    if (CHONG(luckZ, P.year.zhi)) ['迁移远方', '家庭'].forEach((d) => boost.add(d));
    for (const x of sig) if (boost.has(x.domain) && (x.cls === 'trigger' || x.cls === 'link')) { x.w *= 1.5; x.why += '（大运冲动该宫，×1.5）'; }
  }
  // ── 主从：旁领域要另一类专指信号佐证 ──
  const dropped = [];
  const kept = sig.filter((x) => {
    if (!x.side) return true;
    const ok = sig.some((o) => o !== x && o.domain === x.domain && o.spec && o.spec !== x.spec);
    if (!ok) dropped.push(x.why + '（感情要佐证，没有）');
    return ok;
  });
  const yr = cy && cy.years.find((v) => v.year === y);
  return { gz, shishen: [sg, sz], tier: yr ? yr.tier : null, score: yr ? yr.score : null, luck: cy ? cy.ganZhi : null, sig: kept, dropped, young };
}
// v2 分组：同 v1 铁闸（十四岁以下感情降灰已由学龄规则取代，见 stageFilter）
function groupV2(r, opt = {}) {
  const o = groupV1(r.sig);
  // 实验门槛（v2.1 A/B）：≥2.5 且含扳机级，或 ≥3 且含联动级；不满足的从明灯降掉（分数留着，进灰灯判断）
  if (opt.strictGate) for (const [d, v] of Object.entries(o)) {
    const cls = r.sig.filter((x) => x.domain === d).map((x) => x.cls);
    if (!((v.w >= 2.5 && cls.includes('trigger')) || (v.w >= 3 && cls.includes('link')))) v.w = Math.min(v.w, 2.49);
  }
  return { lit: o, gray: [] };
}

function group(sig) { const o = {}; for (const s of sig) { (o[s.domain] = o[s.domain] || { w: 0, why: [] }); o[s.domain].w += s.w; o[s.domain].why.push(s.why); } return o; }

// ── 流月 v1（2026-10-01）：流月不独立断事，只给流年已亮灯的领域找「这一年哪几个月最可能应」 ──
// 高发月＝流月地支与流年地支同字或相冲（3）／流月冲或合「被引动的那个原局字」（2，二次引爆）／流月天干透出该领域关键十神（1，辅助，不单独成立）；每年每领域取 2～3 个。
// 节气月：立春起寅月，换月按太阳黄经到 315°＋30°×k 的那天（北京时间），月干五虎遁。
const { TJME } = require('./engines.js');
const SUN = TJME.BODIES.find((b) => b[0] === '太阳')[1];
const YIN_GAN = { 甲: '丙', 己: '丙', 乙: '戊', 庚: '戊', 丙: '庚', 辛: '庚', 丁: '壬', 壬: '壬', 戊: '甲', 癸: '甲' };
const MONTH_ZHI = '寅卯辰巳午未申酉戌亥子丑';
const bjDate = (d) => new Date(d.getTime() + 8 * 36e5).toISOString().slice(0, 10);
function jieMonths(y) {
  const out = [], start = Date.UTC(y, 0, 25, 4), gz = ganzhiOf(y);
  let prev = TJME.lon(SUN, new Date(start)), k = 0, t0 = null;
  const target = (i) => (315 + 30 * i) % 360;
  const crossed = (a, b, T) => { const da = ((T - a) % 360 + 360) % 360, db = ((T - b) % 360 + 360) % 360; return da < 180 && db >= 180; };
  for (let t = start + 864e5; t <= Date.UTC(y + 1, 1, 10, 4) && k <= 12; t += 864e5) {
    const L = TJME.lon(SUN, new Date(t));
    if (crossed(prev, L, target(k % 12))) {
      let a = t - 864e5, b = t;   // 二分到分钟：交节那一刻
      while (b - a > 6e4) { const c = (a + b) / 2; if (crossed(TJME.lon(SUN, new Date(a)), TJME.lon(SUN, new Date(c)), target(k % 12))) b = c; else a = c; }
      if (k > 0) out[k - 1].to = bjDate(new Date(b - 6e4));
      if (k < 12) out.push({ gz: GAN[(GAN.indexOf(YIN_GAN[gz[0]]) + k) % 10] + MONTH_ZHI[k], from: bjDate(new Date(b)) });
      k++;
    }
    prev = L;
  }
  return out.filter((m) => m.to);
}
const KEY_TEN = { 感情: (t, sex) => (sex === 'female' ? isGuan(t) : isCai(t)), 钱: (t) => isCai(t), 事业认可: (t) => isGuan(t) || isYin(t), 工作: (t) => isGuan(t) || t === '食神' || t === '伤官', 家庭: (t) => isYin(t) || t === '偏财', 自我: (t) => isBi(t) };
function liuyue(bz, sex, y, lit, sig) {
  const dm = bz.bazi.dayMaster.gan, z = ganzhiOf(y)[1], months = jieMonths(y), out = [];
  for (const dom of lit) {
    const hits = sig.filter((x) => x.domain === dom && x.hit).map((x) => x.hit);
    const scored = months.map((m) => {
      const mg = m.gz[0], mz = m.gz[1], why = [];
      let sc = 0;
      if (mz === z) { sc += 3; why.push(`临月（${mz}和流年同字）`); } else if (CHONG(mz, z)) { sc += 3; why.push(`${mz}冲流年${z}`); }
      const h2 = hits.find((h) => (h.zhi && (CHONG(mz, h.zhi) || HE6[mz] === h.zhi)) || (h.gan && (GAN_HE[mg] === h.gan || GANKE(mg, h.gan))));
      if (h2) { sc += 2; why.push(`二次引动原局${h2.zhi || h2.gan}`); }
      if (sc && KEY_TEN[dom] && KEY_TEN[dom](shishen(dm, mg), sex)) { sc += 1; why.push(`月干透${shishen(dm, mg)}`); }
      return { ...m, score: sc, why };
    }).filter((m) => m.score >= 2).sort((a, b) => b.score - a.score || a.from.localeCompare(b.from)).slice(0, 3).sort((a, b) => a.from.localeCompare(b.from));
    if (scored.length) out.push({ domain: dom, months: scored });
  }
  return out;
}

function timing(bz, N, sex, now = new Date(), opt = {}) {   // opt.lite：合盘只要逐年，不算月历和一生周期
  if (!bz || bz.status !== 'ok') return null;
  const birthD = bz.input.date, birthY = +birthD.slice(0, 4), nowY = now.getFullYear(), from = birthY + 12, to = nowY + 9;   // 往后十年（10-02 定）
  const W = N ? westYearlyV1(N, birthY, from, to, 2).years : {};
  const years = [];
  for (let y = from; y <= to; y++) {
    const age = yearAge(birthD, y), stageGray = [];
    const b0 = baziYearV2(bz, sex, y), b = { ...b0, sig: minorSig(b0.sig, age) }, bd = stageFilter(groupV2(b).lit, age, stageGray), wd0 = {};   // v2.1（10-01 定版，v1 退役）；学龄两边一起收，不满 18 岁钱折回家庭
    for (const [k, v] of Object.entries(W[y] || {})) { const dom = WEST_TO[k] || k; (wd0[dom] = wd0[dom] || { w: 0, why: [] }); wd0[dom].w += v.w; wd0[dom].why.push(...v.why); }
    const wd = stageFilter(minorWest(wd0, age), age, stageGray);
    const mirror = [];
    for (const dom of DOMAINS) {
      const bw = (bd[dom] || {}).w || 0, ww = Math.max((wd[dom] || {}).w || 0, ...alsoW(wd, dom));
      if (bw >= 2 && ww >= 2) mirror.push(dom);
    }
    const gray = [...new Set([...Object.entries(bd).filter(([, v]) => v.w >= 2 && v.w < 2.5).map(([k]) => k), ...stageGray])];   // 灰灯只进内部分析和回溯；18～22 岁的钱、感情也进灰灯
    // 换挡年（10-06 改定）：交脱大运当年和前后一年里的「弱同亮」——八字和西盘在同一块都 ≥1.5，单列提示「大运交替，诸事换挡，易有变动」，不混进同亮。
    // （原先「任一边 ≥1.5」等于交脱三年全标，占全部年份近三成。）交脱那条信号本身不算；全局不算；同亮了的那块不重复列。非交脱年门槛不动。
    const near = bz.bazi.luck.cycles.find((c) => Math.abs(y - c.startYear) <= 1 && c.seq > 1);
    let shift = null;
    if (near) {
      const bx = stageFilter(groupV1(b.sig.filter((x) => !/^交脱大运/.test(x.why))), age);
      const doms = DOMAINS.filter((d) => d !== '全局' && !mirror.includes(d) && ((bx[d] || {}).w || 0) >= 1.5 && Math.max((wd[d] || {}).w || 0, ...alsoW(wd, d)) >= 1.5);
      if (doms.length) shift = { luck: near.ganZhi, when: y === near.startYear ? '当年' : y < near.startYear ? '前一年' : '后一年', domains: doms, note: '大运交替，诸事换挡，易有变动' };
    }
    const ctx = STAGE(age).context;
    // 学业年份的原因句按学业说（a2 10-06：学生盘上还写「月令：工作、家庭」「工作被动」）：只改句子，领域名「工作」不动（界面对照表认它）
    const asStudy = (lit) => (ctx === '学业' ? Object.fromEntries(Object.entries(lit).map(([k, v]) => [k, { ...v, why: v.why.map((x) => x.replace(/工作/g, '学业')) }])) : lit);
    years.push({ year: y, age, context: ctx, gan_zhi: b.gz, luck: b.luck, tier: b.tier, score: b.score, bazi: asStudy(bd), west: asStudy(wd), mirror, gray, shift });
  }
  const round = (x) => Math.round(x * 10) / 10;
  const cand = [];
  for (const r of years) for (const dom of DOMAINS) {
    const bw = (r.bazi[dom] || {}).w || 0, ww = (r.west[dom] || {}).w || 0, m = r.mirror.includes(dom);
    if (m || bw >= 2.5 || ww >= 2.5) cand.push({ year: r.year, age: r.age, domain: dom, mirror: m, score: round(bw + ww), bazi: (r.bazi[dom] || {}).why || [], west: (r.west[dom] || {}).why || [] });
  }
  const byStrength = (a, b) => (b.mirror - a.mirror) || (b.score - a.score);
  // 近三年月历（西盘，到月）＋一生大周期；八字流月按审定规则，暂只到年
  // 八字流月：近三年里流年已亮灯（明灯）的领域
  const monthsBazi = [];
  for (let y = nowY; y <= nowY + 2 && !opt.lite; y++) {
    const ag = yearAge(birthD, y), b0 = baziYearV2(bz, sex, y), b = { ...b0, sig: minorSig(b0.sig, ag) }, bd = stageFilter(groupV2(b).lit, ag), lit = Object.keys(bd).filter((k) => bd[k].w >= 2.5 && k !== '全局');
    const ly = lit.length ? liuyue(bz, sex, y, lit, b.sig) : [];
    if (ly.length) monthsBazi.push({ year: y, gan_zhi: b.gz, domains: ly });
  }
  let months = [], life = [];
  if (N && !opt.lite) {
    const cm = now.toISOString().slice(0, 7), ms = new Date(Date.UTC(nowY, now.getUTCMonth() - 3, 1)), me = new Date(Date.UTC(nowY + 3, now.getUTCMonth(), 0));   // 早扫三个月，免得正在进行的过境把精准日记成起点
    months = westWindows(N, ms, me).filter((w) => w.end >= cm).map((w) => ({ ...w, start: w.start < cm ? cm : w.start, exacts_before: w.exacts.filter((e) => e.slice(0, 7) < cm), exacts: w.exacts.filter((e) => e.slice(0, 7) >= cm), domain: WEST_TO[w.domain] || w.domain }));
    const [y, mo, d] = bz.input.date.split('-').map(Number), [hh, mm] = String(bz.input.time || '12:00').split(':').map(Number);
    const natalAt = (dt) => { const l = new Date(dt.getTime() + 8 * 36e5); return natal({ y: l.getUTCFullYear(), mo: l.getUTCMonth() + 1, d: l.getUTCDate(), h: l.getUTCHours(), mi: l.getUTCMinutes(), tz: 8, lat: 35, lon: 116, sex: '女' }); };   // 只取凯龙、交点黄经，和地点无关
    life = lifeCycles(N, new Date(Date.UTC(y, mo - 1, d, hh - 8, mm)), natalAt, 90);
  }
  return {
    schema: 'xuanji.timing/0.4',
    note: '八字应期 v2.1（10-01 定版：主从记账、成局双向、刑害全四柱、官非／事业开局／名分新规则、迁移合成）＋10-06 粉丝反馈修正（学龄：22 岁及以下 context＝学业，不满 18 岁钱折回家庭（1:1 同年合并）、官非／感情不出，18～22 岁钱／感情降灰、官非不出；换挡年 shift＝交脱窗口内的弱同亮（同一块两边都 ≥1.5）；合日支 0.5 单独不亮；偏财落点：年月柱→家庭（父）、时柱→钱、日柱被冲→感情）＋西盘行运 v1；age＝周岁（那年过完生日）；past_candidates 只给两套同亮的年份（验前事只说双轨同亮）；mirror＝两套同一年同一块人生都亮；years 到今年＋9；months＝近三年西盘月历（只列窗口不打分）；months_bazi＝近三年八字流月高发月（流月 v1，只细化已亮灯的流年）；life_cycles＝一生西盘大周期',
    months, months_bazi: monthsBazi, life_cycles: life,
    years: years.map((r) => ({ ...r, bazi: Object.fromEntries(Object.entries(r.bazi).map(([k, v]) => [k, { w: round(v.w), why: v.why, neg: !!v.neg }])), west: Object.fromEntries(Object.entries(r.west).map(([k, v]) => [k, { w: round(v.w), why: v.why }])) })),
    past_candidates: cand.filter((c) => c.year < nowY && c.mirror).sort(byStrength).slice(0, 8),
    future: cand.filter((c) => c.year >= nowY).sort((a, b) => a.year - b.year || byStrength(a, b)),
    shift_years: years.filter((r) => r.shift).map((r) => ({ year: r.year, age: r.age, context: r.context, ...r.shift })),   // 换挡年：单列，不进同亮
  };
}

// 只要几年的八字亮灯（出题用）：跟 timing().years[].bazi 同一算法、同样取一位小数
function baziLights(bz, sex, from, to) {   // 学龄照样收：小孩的年份不拿钱、官非、感情出题
  const round = (x) => Math.round(x * 10) / 10, out = [], bd0 = bz.input && bz.input.date;
  for (let y = from; y <= to; y++) {
    const ag = bd0 ? yearAge(bd0, y) : 99, b0 = baziYearV2(bz, sex, y), lit = groupV2({ ...b0, sig: minorSig(b0.sig, ag) }).lit;
    out.push({ year: y, bazi: Object.fromEntries(Object.entries(bd0 ? stageFilter(lit, ag) : lit).map(([k, v]) => [k, { w: round(v.w), why: v.why, neg: !!v.neg }])) });
  }
  return out;
}

module.exports = { timing, baziLights, baziYear, baziYearV1, baziYearV2, group, groupV1, groupV2, shishen, zhouSui, yearAge, STAGE };
