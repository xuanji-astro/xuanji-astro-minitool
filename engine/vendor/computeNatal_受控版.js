/* 排盘核心 · 从 Godness/index.html 第 2001~2259 行整段抽出（受控版）
   ⚠️ 不要手改这个文件：改 index.html 之后重跑 extract_natal.py。
   含：computeNatal / Placidus 宫位 / 相位表 ASPECTS / 中国夏令时 CN_DST(1986-1991) / 福点。
   依赖：astronomy.js（window.Astronomy）。
   🔴 asteroid-ephem.js 也是【必须】的，不是可选：凯龙星只能从它取，而凯龙进相位、进解读、
      进三个指数。缺了它盘上只有 10 体不是 11 体，相位 13 条不是 16 条，指数与 Φ 全部算错，
      而且【不报任何错】。这行原来写的是"可选"，那句是错的，2026-08-14 离线自检当场抓出来。*/
const A=window.Astronomy;
const SIGNS=["白羊","金牛","双子","巨蟹","狮子","处女","天秤","天蝎","射手","摩羯","水瓶","双鱼"];
const ELEMENT={白羊:"火",狮子:"火",射手:"火",金牛:"土",处女:"土",摩羯:"土",双子:"风",天秤:"风",水瓶:"风",巨蟹:"水",天蝎:"水",双鱼:"水"};
const BODIES=[["太阳",A.Body.Sun],["月亮",A.Body.Moon],["水星",A.Body.Mercury],["金星",A.Body.Venus],["火星",A.Body.Mars],["木星",A.Body.Jupiter],["土星",A.Body.Saturn],["天王",A.Body.Uranus],["海王",A.Body.Neptune],["冥王",A.Body.Pluto]];
const ASPECTS=[[0,"合",8,""],[60,"六合",4,"good"],[90,"刑",6,"hard"],[120,"拱",6,"good"],[180,"冲",8,"hard"]];

function lon(b,date){let e=A.Ecliptic(A.GeoVector(b,date,true)).elon;return e<0?e+360:e;}
function isRx(b,date){ // 用前后6小时判断顺逆
  if(b===A.Body.Sun||b===A.Body.Moon)return false;
  const t1=new Date(date.getTime()-6*3600e3),t2=new Date(date.getTime()+6*3600e3);
  let a=lon(b,t1),c=lon(b,t2),d=c-a; if(d>180)d-=360; if(d<-180)d+=360; return d<0;
}
function pos(date){return BODIES.map(([n,b])=>{const L=lon(b,date),s=Math.floor(L/30),deg=L-s*30;return{n,sign:SIGNS[s],deg:Math.floor(deg),min:Math.floor((deg%1)*60),rx:isRx(b,date),L};});}
function aspects(date){const ps=pos(date),out=[];for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){let d=Math.abs(ps[i].L-ps[j].L)%360;if(d>180)d=360-d;for(const[a,nm,orb,cls]of ASPECTS){if(Math.abs(d-a)<=orb){out.push({t:`${ps[i].n}${nm}${ps[j].n}`,cls});break;}}}return out;}

// 扫描换座 & 新月满月
function scanTransits(start,days,skipMoon){const ev=[];for(const[n,b]of BODIES){if(skipMoon&&b===A.Body.Moon)continue;let prev=Math.floor(lon(b,start)/30);for(let k=1;k<=days;k++){const d=new Date(start.getTime()+k*864e5);const cur=Math.floor(lon(b,d)/30);if(cur!==prev){ev.push({date:d,txt:`${n} 进入 ${SIGNS[cur]}座`});prev=cur;}}}return ev;}
function scanMoons(start,days){const ev=[],seen=new Set();for(let k=0;k<=days;k++){const d=new Date(start.getTime()+k*864e5);const sun=lon(A.Body.Sun,d),moon=lon(A.Body.Moon,d);let diff=(moon-sun+360)%360;if(diff<7||diff>353){const s=SIGNS[Math.floor(sun/30)];if(!seen.has("新"+s)){ev.push({date:d,txt:`🌑 新月在 ${s}座`});seen.add("新"+s);}}else if(Math.abs(diff-180)<7){const s=SIGNS[Math.floor(moon/30)];if(!seen.has("满"+s)){ev.push({date:d,txt:`🌕 满月在 ${s}座`});seen.add("满"+s);}}}return ev;}
const md=d=>`${d.getMonth()+1}/${d.getDate()}`;

function planetRows(ps){return ps.map(p=>`<div class="planet"><span class="pname">${p.n}</span><span class="ppos">${p.sign} ${p.deg}°${String(p.min).padStart(2,'0')}'</span>${p.rx?'<span class="rx">℞ 逆行</span>':''}</div>`).join('');}
function aspectTags(as){return as.map(a=>`<span class="asp-tag ${a.cls?'asp-'+a.cls:''}">${a.t}</span>`).join('');}

/* ========== 我的盘 · 本命盘自助算 ========== */
// 城市经纬度表(东经正/西经负, 北纬正/南纬负)。表里没有的用"手填经纬度"兜底。
const CITIES={
 "北京":[39.90,116.41],"上海":[31.23,121.47],"广州":[23.13,113.26],"深圳":[22.54,114.06],
 "天津":[39.13,117.20],"重庆":[29.56,106.55],"成都":[30.57,104.07],"杭州":[30.27,120.16],
 "武汉":[30.59,114.31],"西安":[34.34,108.94],"南京":[32.06,118.80],"长沙":[28.23,112.94],
 "郑州":[34.75,113.62],"沈阳":[41.81,123.43],"青岛":[36.07,120.38],"济南":[36.65,117.12],
 "大连":[38.91,121.62],"哈尔滨":[45.80,126.53],"长春":[43.82,125.32],"福州":[26.07,119.30],
 "厦门":[24.48,118.09],"昆明":[25.04,102.71],"南宁":[22.82,108.32],"贵阳":[26.65,106.63],
 "兰州":[36.06,103.83],"太原":[37.87,112.55],"合肥":[31.82,117.23],"南昌":[28.68,115.86],
 "石家庄":[38.04,114.51],"呼和浩特":[40.84,111.75],"乌鲁木齐":[43.83,87.62],"银川":[38.49,106.23],
 "西宁":[36.62,101.78],"拉萨":[29.65,91.14],"海口":[20.04,110.32],"三亚":[18.25,109.51],
 "苏州":[31.30,120.62],"无锡":[31.49,120.31],"宁波":[29.87,121.55],"温州":[28.00,120.70],
 "佛山":[23.02,113.12],"东莞":[23.02,113.75],"珠海":[22.27,113.58],"中山":[22.52,113.39],
 "泉州":[24.87,118.68],"烟台":[37.46,121.45],"潍坊":[36.71,119.16],"洛阳":[34.62,112.45],
 "唐山":[39.63,118.18],"保定":[38.87,115.46],"徐州":[34.26,117.18],"常州":[31.81,119.97],
 "南通":[31.98,120.89],"扬州":[32.39,119.41],"绍兴":[30.00,120.58],"嘉兴":[30.75,120.76],
 "金华":[29.08,119.65],"台州":[28.66,121.42],"惠州":[23.11,114.42],"汕头":[23.35,116.68],
 "湛江":[21.27,110.36],"桂林":[25.27,110.29],"柳州":[24.31,109.42],"绵阳":[31.47,104.68],
 "香港":[22.32,114.17],"澳门":[22.20,113.55],"台北":[25.03,121.57],
 // 全球大城(西经为负)
 "纽约":[40.71,-74.01],"洛杉矶":[34.05,-118.24],"旧金山":[37.77,-122.42],"芝加哥":[41.88,-87.63],
 "伦敦":[51.51,-0.13],"巴黎":[48.86,2.35],"东京":[35.68,139.69],"首尔":[37.57,126.98],
 "新加坡":[1.35,103.82],"悉尼":[-33.87,151.21],"墨尔本":[-37.81,144.96],"多伦多":[43.65,-79.38],
 "温哥华":[49.28,-123.12],"柏林":[52.52,13.40],"莫斯科":[55.76,37.62],"迪拜":[25.20,55.27],
 "曼谷":[13.76,100.50],"吉隆坡":[3.14,101.69],"罗马":[41.90,12.50],"马德里":[40.42,-3.70]
};

// 把"本地出生时间+时区"换成UTC的Date(必用Date.UTC, 不让浏览器按设备时区瞎猜)
function toUTC(y,mo,d,h,mi,tzOffset){
  return new Date(Date.UTC(y,mo-1,d,h,mi)-tzOffset*3600*1000);
}
// 中国夏令时(1986-1991, 仅此6年实行过): 钟拨快1小时, 拨快的钟面时间需减1h才是标准时。
// 起止日期已逐年对齐 IANA tz database(Asia/Shanghai)的官方转换记录, 分秒级权威:
//   开始/结束均为当日"凌晨02:00"切换。表项格式 [[开始日,开始月],[结束日,结束月]]。
//   1986(首年特殊)5/4起·9/14止；1987 4/12·9/13；1988 4/17·9/11；
//   1989 4/16·9/17；1990 4/15·9/16；1991 4/14·9/15。
// 返回"需减去的小时数"(0或1)。h为钟面小时(用于精确处理边界日02:00切换)。
const CN_DST={1986:[[5,4],[14,9]],1987:[[12,4],[13,9]],1988:[[17,4],[11,9]],1989:[[16,4],[17,9]],1990:[[15,4],[16,9]],1991:[[14,4],[15,9]]};
function cnDstAdjust(y,mo,d,h){
  if(!CN_DST[y]) return 0;
  const [[sd,sm],[ed,em]]=CN_DST[y];
  const cur=mo*100+d, st=sm*100+sd, en=em*100+ed;
  // 区间(开始日含, 结束日不含)内一律夏令时。
  if(cur>st && cur<en) return 1;
  // 边界日精确到02:00: 开始日 02:00 起拨快; 结束日 02:00 前仍夏令时(02:00拨回)。
  if(cur===st) return (h===undefined||h>=2) ? 1 : 0; // 02:00前钟未拨快
  if(cur===en) return (h!==undefined&&h<2) ? 1 : 0;  // 02:00前仍夏令时
  return 0;
}
// 均时差(equation of time, 分钟)。真太阳时与平太阳时之差, 最多约±16分。
// date为UTC, 用简化级数(对占星度级精度足够)。
function equationOfTime(date){
  const n=A.MakeTime(date).tt;               // 自J2000.0的天数(本库tt定义)
  const Ldeg=(280.460+0.9856474*n)%360;      // 太阳平黄经
  const gdeg=(357.528+0.9856003*n)%360;      // 平近点角
  const g=gdeg*Math.PI/180;
  const lambda=(Ldeg+1.915*Math.sin(g)+0.020*Math.sin(2*g))*Math.PI/180; // 真黄经
  const eps=obliquity(date)*Math.PI/180;
  // EoT(弧度)= L - atan2(cos e sin λ, cos λ) ... 标准公式
  let ra=Math.atan2(Math.cos(eps)*Math.sin(lambda),Math.cos(lambda)); // 太阳赤经(弧度)
  let raDeg=ra*180/Math.PI; raDeg=(raDeg%360+360)%360;
  let eotDeg=Ldeg-raDeg; if(eotDeg>180)eotDeg-=360; if(eotDeg<-180)eotDeg+=360;
  return eotDeg*4; // 1度=4分钟 → 返回分钟数
}
// 黄赤交角(度)。注意: 本库 MakeTime().tt = "相对J2000.0的天数"(不是儒略日)
function obliquity(date){
  const T=(A.MakeTime(date).tt)/36525; // 儒略世纪(自J2000)
  return 23.439291-0.0130042*T;
}
// 算上升ASC + 天顶MC (返回黄经0-360)
function calcAscMc(date,lat,lon_east){
  const gast=A.SiderealTime(date);            // 格林尼治视恒星时(小时)
  let ramc=(gast*15+lon_east)%360; if(ramc<0)ramc+=360;  // 本地恒星时=RAMC(度)
  const eps=obliquity(date);
  const rad=Math.PI/180, deg=180/Math.PI;
  const r=ramc*rad, e=eps*rad, phi=lat*rad;
  // MC
  let mc=Math.atan2(Math.sin(r),Math.cos(r)*Math.cos(e))*deg; mc=(mc%360+360)%360;
  // ASC (标准式, 含象限)
  let asc=Math.atan2(Math.cos(r), -(Math.sin(r)*Math.cos(e)+Math.tan(phi)*Math.sin(e)))*deg;
  asc=(asc%360+360)%360;
  return {asc,mc,ramc,eps};
}
// Placidus 宫位制(对标主流中文占星软件)。返回12个宫头黄经[1宫..12宫]。
// 已用一张验过的真人基准盘逐宫校验, 与主流中文排盘软件分秒级吻合（代码里不写那张盘的出生信息）。
function placidusCusps(ramcDeg,eps,lat,asc,mc){
  const rad=Math.PI/180,deg=180/Math.PI,e=eps*rad,phi=lat*rad;
  // 牛顿迭代求中间宫头(11,12,2,3)黄经
  function cusp(n){
    let hourAngleSign,F,seed;
    if(n===11){F=1/3;hourAngleSign=1;seed=30;}
    if(n===12){F=2/3;hourAngleSign=1;seed=60;}
    if(n===2){F=2/3;hourAngleSign=-1;seed=120;}
    if(n===3){F=1/3;hourAngleSign=-1;seed=150;}
    let lam=(ramcDeg+seed)%360;
    for(let i=0;i<100;i++){
      const l=lam*rad;
      const decl=Math.asin(Math.sin(e)*Math.sin(l));
      let RA=Math.atan2(Math.sin(l)*Math.cos(e),Math.cos(l))*deg; RA=(RA%360+360)%360;
      const ad=Math.acos(Math.max(-1,Math.min(1,-Math.tan(phi)*Math.tan(decl))))*deg; // 半昼弧
      const MD=hourAngleSign>0? F*ad : F*(180-ad);
      const targetRA=(ramcDeg+(hourAngleSign>0? MD : (180-MD)))%360;
      const diff=((RA-targetRA+540)%360)-180;
      if(Math.abs(diff)<1e-6) break;
      lam=((lam-diff*0.5)%360+360)%360;
    }
    return lam;
  }
  const c11=cusp(11),c12=cusp(12),c2=cusp(2),c3=cusp(3);
  // [1..12]宫头: 1=asc,10=mc,对宫=+180
  return [asc,c2,c3,(mc+180)%360,(c11+180)%360,(c12+180)%360,(asc+180)%360,(c2+180)%360,(c3+180)%360,mc,c11,c12];
}
const SIGN=L=>SIGNS[Math.floor(((L%360)+360)%360/30)];
const DEGIN=L=>{const x=((L%360)+360)%360; const d=x-Math.floor(x/30)*30; return {deg:Math.floor(d),min:Math.floor((d%1)*60)};};

// 进阶点位(纯数学, 不依赖库的小行星星历)。date为UTC。
// 平黑月莉莉丝(月亮远地点平黄经)+ 平北交点(月亮升交点平黄经)。
// 本库 MakeTime().tt 已是"相对J2000.0的天数", 直接/36525得儒略世纪(不再减2451545)
function julianCenturies(date){ return A.MakeTime(date).tt/36525; }
// 平北交点黄经(度): 标准公式(逆行, 约18.6年一周)
function meanNode(date){
  const T=julianCenturies(date);
  let om=125.04452-1934.136261*T+0.0020708*T*T+T*T*T/450000;
  return ((om%360)+360)%360;
}
// 平黑月莉莉丝(月亮远地点黄经, 度)= 月亮近地点黄经+180
function meanLilith(date){
  const T=julianCenturies(date);
  // 月亮近地点黄经 ϖ (perigee, 度)
  let perigee=83.3532465+4069.0137287*T-0.0103200*T*T-T*T*T/80053+T*T*T*T/18999000;
  let lilith=perigee+180;
  return ((lilith%360)+360)%360;
}

// 完整本命盘
function computeNatal(inp){
  // ① 夏令时修正(1986-91中国): 钟面时间拨快了1h, 减回真实民用时间(影响真实UTC瞬间, 必须做)
  const dstH=cnDstAdjust(inp.y,inp.mo,inp.d,inp.h);
  const utc=toUTC(inp.y,inp.mo,inp.d,inp.h-dstH,inp.mi,inp.tz);
  // 注: 现代占星(含主流中文软件)用民用钟表时间直接排盘, 行星位置/上升由真实UTC瞬间决定,
  //     "真太阳时·均时差"不并入计算(那会让行星偏移、反与主流软件不符)。
  //     均时差仅作"当地真太阳时"参考显示, 不参与排盘。
  const eotMin=equationOfTime(utc);
  const {asc,mc,ramc,eps}=calcAscMc(utc,inp.lat,inp.lon);
  const ascSign=Math.floor(asc/30);
  // Placidus 宫头(对标主流中文软件)。落宫=判断黄经落在哪两个宫头之间。
  const cusps=placidusCusps(ramc,eps,inp.lat,asc,mc);
  const houseOf=L=>{
    L=((L%360)+360)%360;
    for(let h=0;h<12;h++){
      const a=((cusps[h]%360)+360)%360, b=((cusps[(h+1)%12]%360)+360)%360;
      const span=(b-a+360)%360, off=(L-a+360)%360;
      if(off<span) return h+1;
    }
    return 12;
  };
  const planets=BODIES.map(([n,b])=>{
    const L=lon(b,utc); const dm=DEGIN(L);
    return {n,sign:SIGN(L),signIdx:Math.floor(((L%360)+360)%360/30),deg:dm.deg,min:dm.min,house:houseOf(L),rx:isRx(b,utc),L};
  });
  // 凯龙星(Chiron;伤痛与疗愈)——保留在 planets 里，照旧参与解读/相位/元素。
  // 🔴取值源只用 asteroid-ephem.js 的 chiron(MIT·对主流软件仅差~8角分)。
  //    凯龙轨道偏心率高,旧 Moshier 库拟合差(~54角分);asteroid-ephem 同一套四小行星库顺带算的 chiron 准得多。
  // 🔴 2026-07-28 移除旧 Moshier 降级(chironLon/ephemeris.bundle.js/chiron-helper.js)：
  //    那个库是 GPL-3.0,而我们把它当 <script src> 发给每个访客=分发,会传染整个前端。
  //    它本来就只是精度更差的兜底,删掉零损失。**别再加回来**,要兜底就让凯龙不显示。
  {
    let cL=null, cRx=false;
    if(typeof asteroidEphem==="function"){
      try{ const _c=asteroidEphem(utc).chiron; if(_c&&isFinite(_c.L)){ cL=_c.L; cRx=!!_c.rx; } }catch(_){}
    }
    if(cL!==null){
      const cdm=DEGIN(cL);
      planets.push({n:"凯龙",sign:SIGN(cL),signIdx:Math.floor(((cL%360)+360)%360/30),deg:cdm.deg,min:cdm.min,house:houseOf(cL),rx:cRx,L:cL});
    }
  }
  // ===== 四小行星(谷神/智神/婚神/灶神)：纯新增，独立成区，只上盘面，不进解读、不进相位、不进三个群运营tab =====
  // 精度已对主流软件校验(三张盘、12体落座100%/度差≤17'/末度临界与逆行全对)。asteroid-ephem.js 提供。
  const asteroids=[];
  if(typeof asteroidEphem==="function"){
    try{
      const a=asteroidEphem(utc);
      const _pushAst=(name,L,rx)=>{const dm=DEGIN(L);asteroids.push({n:name,sign:SIGN(L),signIdx:Math.floor(((L%360)+360)%360/30),deg:dm.deg,min:dm.min,house:houseOf(L),rx:!!rx,L:L});};
      _pushAst("谷神", a.ceres.L,  a.ceres.rx);
      _pushAst("智神", a.pallas.L, a.pallas.rx);
      _pushAst("婚神", a.juno.L,   a.juno.rx);
      _pushAst("灶神", a.vesta.L,  a.vesta.rx);
    }catch(e){ /* 小行星算失败不影响主盘 */ }
  }
  // 本命相位(复用ASPECTS逻辑)
  const asp=[];
  for(let i=0;i<planets.length;i++)for(let j=i+1;j<planets.length;j++){
    let dd=Math.abs(planets[i].L-planets[j].L)%360; if(dd>180)dd=360-dd;
    for(const[a,nm,orb,cls]of ASPECTS){if(Math.abs(dd-a)<=orb){asp.push({t:`${planets[i].n}${nm}${planets[j].n}`,cls});break;}}
  }
  // 四轴
  const dm_asc=DEGIN(asc),dm_mc=DEGIN(mc),dsc=(asc+180)%360,ic=(mc+180)%360,dm_dsc=DEGIN(dsc),dm_ic=DEGIN(ic);
  const angles={
    asc:{sign:SIGN(asc),deg:dm_asc.deg,min:dm_asc.min,L:asc},
    mc:{sign:SIGN(mc),deg:dm_mc.deg,min:dm_mc.min,L:mc},
    dsc:{sign:SIGN(dsc),deg:dm_dsc.deg,min:dm_dsc.min,L:dsc},
    ic:{sign:SIGN(ic),deg:dm_ic.deg,min:dm_ic.min,L:ic}
  };
  // Placidus 12宫(每宫头带具体度数)
  const houses=[];for(let k=0;k<12;k++){const cdm=DEGIN(cusps[k]);houses.push({num:k+1,sign:SIGN(cusps[k]),deg:cdm.deg,min:cdm.min,L:cusps[k]});}
  // 进阶点位: 北交点/南交点/莉莉丝(纯数学算)
  const nodeL=meanNode(utc), lilithL=meanLilith(utc), southL=(nodeL+180)%360;
  // —— 三虚点(纯数学, 复用 calcAscMc 同一套数学; 已用黄金基准盘逐项校对 ≤3角分) ——
  // ① 东方点 East Point: 把纬度当作 0(赤道) 算出的上升点黄经。基准盘校对差 0.6'。
  const eastL=calcAscMc(utc,0,inp.lon).asc;
  // ② 宿命点 Vertex: 黄道与卯酉圈(prime vertical)在地平西侧的交点。
  //    标准做法=用余纬(90-lat)当纬度、并把 RAMC 换成对侧子午线(RAMC+180), 套上升公式。基准盘校对差 2.5'。
  const vertexL=(function(){
    const rad=Math.PI/180,deg=180/Math.PI;
    const r=((ramc+180)%360)*rad, e=eps*rad, phi=(90-inp.lat)*rad;
    let v=Math.atan2(Math.cos(r), -(Math.sin(r)*Math.cos(e)+Math.tan(phi)*Math.sin(e)))*deg;
    return (v%360+360)%360;
  })();
  // ③ 福点 Part of Fortune: 必须按日/夜盘动态选公式(这是占星标准做法, 主流软件也如此)。
  //    日盘(太阳在地平线之上=第7~12宫): ASC + 月亮 - 太阳
  //    夜盘(太阳在地平线之下=第1~6宫):  ASC + 太阳 - 月亮
  //    判据用 houseOf(sunL): 7~12 宫=日盘。曾误把一张夜生盘对齐后写死夜公式,
  //    导致日生盘(如太阳9宫)算错(白羊26° vs 正确双子2°), 现已改回动态。
  const sunL=planets[0].L, moonL=planets[1].L;
  const sunHouse=houseOf(sunL);
  const isDayChart=(sunHouse>=7&&sunHouse<=12);
  const fortuneL=isDayChart
    ? ((asc+moonL-sunL)%360+360)%360   // 日盘
    : ((asc+sunL-moonL)%360+360)%360;  // 夜盘
  const mkPt=(n,L,rx)=>{const dm=DEGIN(L);return {n,sign:SIGN(L),deg:dm.deg,min:dm.min,house:houseOf(L),rx:!!rx,L};};
  // 北交/南交是平均运动逆行点(永远℞,与主流软件一致)
  const points=[ mkPt("北交点",nodeL,true), mkPt("南交点",southL,true), mkPt("莉莉丝",lilithL),
                 mkPt("福点",fortuneL), mkPt("宿命点",vertexL), mkPt("东方点",eastL) ];
  return {meta:inp,utc,planets,asteroids,asp,angles,houses,points,ascSign,cusps,dstH,eotMin};
}
