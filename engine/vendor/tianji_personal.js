// ============================================================
// 玄玑 · 专属天机引擎 (本命盘×行运 · 日/周/月三档 · IIFE隔离)
//   吃档案 birth_meta → 轻量本命盘(行星黄经·纯 astronomy.js·无宫位数学)
//   宫位用整宫制(Whole Sign·上升星座偏移)——档案已存 asc_sign,真占星零额外计算
//   行运=当期星空对本命行星的相位(入相/出相)+过宫+新满月+逆行
//   全部硬数据客户端算死 → 喂 /api/tianji-me(prompt人设锁后端)
//   依赖: astronomy.js(window.Astronomy) + tianji_engine.js(window.TIANJI 搭档机器)
// ============================================================
(function(){
"use strict";
const A=window.Astronomy;
if(!A){window.TJME=null;return;}
const SIGNS=["白羊","金牛","双子","巨蟹","狮子","处女","天秤","天蝎","射手","摩羯","水瓶","双鱼"];
const ELEMENT={白羊:"火",狮子:"火",射手:"火",金牛:"土",处女:"土",摩羯:"土",双子:"风",天秤:"风",水瓶:"风",巨蟹:"水",天蝎:"水",双鱼:"水"};
const BODIES=[["太阳",A.Body.Sun],["月亮",A.Body.Moon],["水星",A.Body.Mercury],["金星",A.Body.Venus],["火星",A.Body.Mars],["木星",A.Body.Jupiter],["土星",A.Body.Saturn],["天王",A.Body.Uranus],["海王",A.Body.Neptune],["冥王",A.Body.Pluto]];
const ASPECTS=[[0,"合"],[60,"六合"],[90,"刑"],[120,"拱"],[180,"冲"]];
// 整宫制宫位含义(喂M3的人话锚·绝不进观众文案)
const HOUSE_MEAN=["自我与状态面貌","钱财与资源","沟通学习与近处奔走","家与内心根基","恋爱创造与玩乐","工作健康与日常节奏","伴侣与合作","深层绑定与他人资源","远方进修与信念","事业与声誉","朋友社群与愿景","独处休整与潜意识"];
// —— 三域分装(2026-07-14定:人类想看的=钱权性→财富/事业/爱情;周=动作层/月=课题层/日报不分域) ——
// 域的判定放引擎不放M3嘴上:域=被碰本命星【所守宫+所坐宫】映射(传统守护·整宫制宫头星座固定)
// → 同一个"金星冲土星"在你盘里是钱的事、在别人盘里是感情的事=真占星的专属分域,不是通用三栏式
const RULER={白羊:"火星",金牛:"金星",双子:"水星",巨蟹:"月亮",狮子:"太阳",处女:"水星",天秤:"金星",天蝎:"火星",射手:"木星",摩羯:"土星",水瓶:"土星",双鱼:"木星"};
const DOMAIN_HOUSES={fortune:[2,8],career:[10,6],love:[5,7]};   // 8宫(共财/深度绑定)归钱财;情缘=5恋爱+7伴侣
const DOMAIN_CN={fortune:"💰钱财",career:"⚡功业(事业与权)",love:"💞情缘(爱情关系)"};
const houseDom=h=>{for(const d in DOMAIN_HOUSES)if(DOMAIN_HOUSES[d].includes(h))return d;return null;};
// 无上升(时辰不明)退化:行星自然征象单域(诚实降级,不硬编宫位)
const NATURAL_DOM={木星:"fortune",金星:"love",太阳:"career",土星:"career",火星:"career",水星:null,月亮:null,天王:null,海王:null,冥王:null};
// 🔴每颗本命行星裁【一个主域】(2026-07-14定:多域=同一件事进三个抽屉刷屏,单域=盘的固有属性,
//   "你的木星是你的钱财星"本身就是专属内容)。
// 🔴裁决优先级(Placidus修正同日定):守域宫 > 坐域宫 > 行星本性。守护=所有权(2宫主管钱,人在哪都管),
//   坐=驻地。旧版"坐>守"在Placidus下会把金星(掌7坐10)抢进功业、裁空情缘域——守护优先才是占星正统。
function natalDomainMap(natal,cusps){
  const map={};
  BODIES.forEach(([n])=>map[n]=null);
  if(cusps){
    // ①坐宫打底
    natal.planets.forEach(p=>{
      const h=houseOfC(p.L,cusps), dom=houseDom(h);
      if(dom) map[p.n]={dom,why:"坐你第"+h+"宫("+HOUSE_MEAN[h-1]+")"};
    });
    // ②守护覆盖(守>坐;同星守多个域宫取宫号最小·先到先得)——宫头星座取Placidus宫头(与主站同源)
    const ruled={};
    for(let h=1;h<=12;h++){
      const dom=houseDom(h); if(!dom) continue;
      const ruler=RULER[SIGNS[Math.floor(((cusps[h-1]%360)+360)%360/30)]];
      if(ruled[ruler]) continue;
      ruled[ruler]=true;
      map[ruler]={dom,why:"掌你第"+h+"宫("+HOUSE_MEAN[h-1]+")"};
    }
    // ③行星本性兜底(守坐皆无域的·如土星守3/4坐4→按本性归功业)
    for(const n in NATURAL_DOM) if(!map[n]&&NATURAL_DOM[n]) map[n]={dom:NATURAL_DOM[n],why:"按其本性"};
  }else{
    for(const n in NATURAL_DOM) if(NATURAL_DOM[n]) map[n]={dom:NATURAL_DOM[n],why:"按其本性(时辰不明)"};
  }
  return map;
}
// 把成相/月相/换座事件按三域分装成喂M3的段落(域=代码算死·M3勿自行判域挪戏)
function domainSection(natal,cusps,exacts,moons,ingress){
  const dm=natalDomainMap(natal,cusps);
  const buckets={fortune:[],career:[],love:[]};
  (exacts||[]).forEach(a=>{
    const e=dm[a.nat];
    if(e) buckets[e.dom].push({date:a.date,line:"  · "+mdCn(a.date)+" "+a.t+"("+(a.hard?"课题相":"顺流相")+"·你的"+a.nat+e.why+")"});
  });
  (moons||[]).concat(ingress||[]).forEach(e=>{
    const dom=e.house?houseDom(e.house):null;
    if(dom) buckets[dom].push({date:e.date,line:"  · "+mdCn(e.date)+" "+e.txt});
  });
  let s="【三域分装(域=按TA这张盘的宫位守护算死·凭据已附·M3绝不许自行改域挪戏)】\n";
  for(const dom of ["fortune","career","love"]){
    const rows=buckets[dom].sort((a,b)=>a.date-b.date).map(x=>x.line);
    s+=DOMAIN_CN[dom]+":\n"+(rows.length?rows.join("\n"):"  · 本期此域星盘没排戏(平·如实写平,养着)")+"\n";
  }
  return s;
}

function lon(b,date){let e=A.Ecliptic(A.GeoVector(b,date,true)).elon;return e<0?e+360:e;}
function isRx(b,date){
  if(b===A.Body.Sun||b===A.Body.Moon)return false;
  const t1=new Date(date.getTime()-6*3600e3),t2=new Date(date.getTime()+6*3600e3);
  let a=lon(b,t1),c=lon(b,t2),d=c-a; if(d>180)d-=360; if(d<-180)d+=360; return d<0;
}
// 与 index.html computeNatal 同源的两个小助手(出生时刻→真实UTC)
function toUTC(y,mo,d,h,mi,tzOffset){return new Date(Date.UTC(y,mo-1,d,h,mi)-tzOffset*3600*1000);}
const CN_DST={1986:[[4,5],[14,9]],1987:[[12,4],[13,9]],1988:[[17,4],[11,9]],1989:[[16,4],[17,9]],1990:[[15,4],[16,9]],1991:[[14,4],[15,9]]};
function cnDstAdjust(y,mo,d,h){
  if(!CN_DST[y]) return 0;
  const [[sd,sm],[ed,em]]=CN_DST[y];
  const cur=mo*100+d, st=sm*100+sd, en=em*100+ed;
  if(cur>st && cur<en) return 1;
  if(cur===st) return (h===undefined||h>=2)?1:0;
  if(cur===en) return (h!==undefined&&h<2)?1:0;
  return 0;
}
/* 11-02 境外／港澳台：档案里 zone＝出生地 IANA 时区名，zll＝定这个时区时的经纬度（"纬,经" 四位小数）。
   经纬度对得上才认 zone（出生地被别的页面改过＝不算数，回北京口径）；认了就按出生那一刻从浏览器时区库算时差（含当地夏令时），不再扣中国 1986–91 夏令时。
   没 zone 的（国内、老档案）照旧：tz 按北京口径，夏令时按 CN_DST 扣。照见 index.html、星盘 dk/v2/engine/natal.js、mbti_full.html、tianji_personal.js 四份这一段逐字一样。 */
function zoneOf(inp){
  if(!inp||!inp.zone||!inp.zll||inp.lat==null||inp.lon==null) return "";
  const a=String(inp.zll).split(",");
  return (Math.abs(+a[0]-(+inp.lat))<5e-4&&Math.abs(+a[1]-(+inp.lon))<5e-4)?String(inp.zone):"";
}
function zoneTz(zone,y,mo,d,h,mi){
  const OLD={"Europe/Kyiv":"Europe/Kiev","Pacific/Kanton":"Pacific/Enderbury","America/Nuuk":"America/Godthab","Asia/Yangon":"Asia/Rangoon","Asia/Kolkata":"Asia/Calcutta","Asia/Ho_Chi_Minh":"Asia/Saigon","Asia/Kathmandu":"Asia/Katmandu","Atlantic/Faroe":"Atlantic/Faeroe","Pacific/Chuuk":"Pacific/Truk","Pacific/Pohnpei":"Pacific/Ponape","Asia/Thimphu":"Asia/Thimbu","Asia/Ulaanbaatar":"Asia/Ulan_Bator","Asia/Dhaka":"Asia/Dacca","Asia/Macau":"Asia/Macao","America/Atikokan":"America/Coral_Harbour"};   /* 老手机时区库认不出新名字就换老名字 */
  try{
    const fo={timeZone:zone,hourCycle:"h23",year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric"}; let f;
    try{ f=new Intl.DateTimeFormat("en-US",fo); }catch(e){ if(!OLD[zone]) throw e; fo.timeZone=OLD[zone]; f=new Intl.DateTimeFormat("en-US",fo); }
    const off=t=>{ const p={}; f.formatToParts(new Date(t)).forEach(x=>{ p[x.type]=x.value; }); return (Date.UTC(+p.year,+p.month-1,+p.day,+p.hour%24,+p.minute)-t)/6e4; };
    const g=Date.UTC(y,mo-1,d,(h==null?12:h),mi||0); let o=off(g); o=off(g-o*6e4);
    return (isFinite(o)&&Math.abs(o)<=14*60)?o/60:null;
  }catch(_){ return null; }
}

// —— Placidus 宫位(🔴2026-07-14修:与主站index.html同源同款——发现土星宫位对不上,
//    旧版整宫制与主站Placidus两个口径=照见说一套天机说一套,当众打脸。宫位必须一个口径。) ——
function obliquity(date){const T=(A.MakeTime(date).tt)/36525;return 23.439291-0.0130042*T;}
function calcAscMc(date,lat,lon_east){
  const gast=A.SiderealTime(date);
  let ramc=(gast*15+lon_east)%360; if(ramc<0)ramc+=360;
  const eps=obliquity(date);
  const rad=Math.PI/180, deg=180/Math.PI;
  const r=ramc*rad, e=eps*rad, phi=lat*rad;
  let mc=Math.atan2(Math.sin(r),Math.cos(r)*Math.cos(e))*deg; mc=(mc%360+360)%360;
  let asc=Math.atan2(Math.cos(r), -(Math.sin(r)*Math.cos(e)+Math.tan(phi)*Math.sin(e)))*deg;
  asc=(asc%360+360)%360;
  return {asc,mc,ramc,eps};
}
function placidusCusps(ramcDeg,eps,lat,asc,mc){
  const rad=Math.PI/180,deg=180/Math.PI,e=eps*rad,phi=lat*rad;
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
      const ad=Math.acos(Math.max(-1,Math.min(1,-Math.tan(phi)*Math.tan(decl))))*deg;
      const MD=hourAngleSign>0? F*ad : F*(180-ad);
      const targetRA=(ramcDeg+(hourAngleSign>0? MD : (180-MD)))%360;
      const diff=((RA-targetRA+540)%360)-180;
      if(Math.abs(diff)<1e-6) break;
      lam=((lam-diff*0.5)%360+360)%360;
    }
    return lam;
  }
  const c11=cusp(11),c12=cusp(12),c2=cusp(2),c3=cusp(3);
  return [asc,c2,c3,(mc+180)%360,(c11+180)%360,(c12+180)%360,(asc+180)%360,(c2+180)%360,(c3+180)%360,mc,c11,c12];
}
function cuspsFor(meta,utc){
  if(!meta||meta.lat===undefined||meta.lat===null||meta.lon===undefined||meta.lon===null) return null;
  try{
    const {asc,mc,ramc,eps}=calcAscMc(utc,meta.lat,meta.lon);
    return placidusCusps(ramc,eps,meta.lat,asc,mc);
  }catch(_){return null;}
}
// 黄经→落在本命第几宫(1-12)·Placidus宫头之间;无宫头数据→0=不报宫位
function houseOfC(L,cusps){
  if(!cusps) return 0;
  L=((L%360)+360)%360;
  for(let h=0;h<12;h++){
    const a=((cusps[h]%360)+360)%360, b=((cusps[(h+1)%12]%360)+360)%360;
    const span=(b-a+360)%360, off=(L-a+360)%360;
    if(off<span) return h+1;
  }
  return 12;
}

// —— 轻量本命盘:行星黄经+Placidus宫头(与主站同源) ——
function computeNatalLite(meta){
  const zn=zoneOf(meta), zt=zn?zoneTz(zn,meta.y,meta.mo,meta.d,meta.h,meta.mi||0):null;   /* 11-02 境外／港澳台：按出生那一刻从时区库算时差、不扣中国夏令时 */
  const dstH=zn?0:cnDstAdjust(meta.y,meta.mo,meta.d,meta.h);
  const utc=toUTC(meta.y,meta.mo,meta.d,meta.h-dstH,meta.mi||0,zt!=null?zt:(meta.tz===undefined?8:meta.tz));
  const planets=BODIES.map(([n,b])=>{
    const L=lon(b,utc),si=Math.floor(((L%360)+360)%360/30);
    return {n,sign:SIGNS[si],signIdx:si,deg:Math.floor(L-si*30),rx:isRx(b,utc),L};
  });
  return {planets,sunSign:planets[0].sign,moonSign:planets[1].sign,utc,cusps:cuspsFor(meta,utc)};
}

// —— 旧整宫制助手(仅留作兼容,引擎内部已全部改用houseOfC/Placidus) ——
function wholeHouse(L,ascIdx){
  if(ascIdx===null||ascIdx===undefined||ascIdx<0) return 0;
  const si=Math.floor(((L%360)+360)%360/30);
  return ((si-ascIdx)+12)%12+1;
}
function ascIdxOf(ascSign){const i=SIGNS.indexOf((ascSign||"").replace(/座$/,""));return i;}

// —— 行运对本命相位(带入相/出相判断:比较今天与明天的容许度收窄/放宽) ——
function orbOf(d,a){let x=Math.abs(d-a);return x;}
function transitAspects(natal,date,transNames,orbMax){
  const out=[];
  const tomorrow=new Date(date.getTime()+864e5);
  for(const [tn,tb] of BODIES){
    if(transNames&&!transNames.includes(tn)) continue;
    const tL=lon(tb,date), tL2=lon(tb,tomorrow);
    for(const np of natal.planets){
      let d1=Math.abs(tL-np.L)%360; if(d1>180)d1=360-d1;
      let d2=Math.abs(tL2-np.L)%360; if(d2>180)d2=360-d2;
      for(const [a,nm] of ASPECTS){
        const o1=orbOf(d1,a);
        if(o1<=orbMax){
          const applying=orbOf(d2,a)<o1;   // 明天更紧=入相(能量正在加强)
          out.push({t:"行运"+tn+nm+"本命"+np.n,trans:tn,nat:np.n,asp:nm,orb:Math.round(o1*10)/10,applying,
            hard:(nm==="刑"||nm==="冲"),rx:isRx(tb,date)});
          break;
        }
      }
    }
  }
  // 紧的在前(orb小=劲大)
  out.sort((x,y)=>x.orb-y.orb);
  return out;
}

// —— 周期键 ——
function pad(n){return String(n).padStart(2,"0");}
function dayKey(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function isoWeekKey(d){
  // ISO周:周四所在年=周所属年
  const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const dow=t.getUTCDay()||7;
  t.setUTCDate(t.getUTCDate()+4-dow);
  const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1));
  const wk=Math.ceil(((t-y0)/864e5+1)/7);
  return t.getUTCFullYear()+"-W"+pad(wk);
}
function monthKey(d){return d.getFullYear()+"-"+pad(d.getMonth()+1);}
function weekRange(d){
  // 周一为首
  const t=new Date(d); t.setHours(12,0,0,0);
  const dow=(t.getDay()+6)%7;           // 0=周一
  const mon=new Date(t.getTime()-dow*864e5);
  const sun=new Date(mon.getTime()+6*864e5);
  return {mon,sun};
}
const mdCn=d=>(d.getMonth()+1)+"月"+d.getDate()+"日";

// —— 新月/满月扫描(某区间内·带本命落宫) ——
function scanMoonEvents(start,days,cusps){
  const ev=[],seen=new Set();
  for(let k=0;k<=days;k++){
    const d=new Date(start.getTime()+k*864e5); d.setHours(12,0,0,0);
    const sL=lon(A.Body.Sun,d),mL=lon(A.Body.Moon,d);
    let diff=(mL-sL+360)%360;
    if(diff<7||diff>353){
      const si=Math.floor(sL/30), key="新"+si;
      if(!seen.has(key)){const h=houseOfC(sL,cusps);
        ev.push({date:d,txt:"🌑新月在"+SIGNS[si]+"座"+(h?"(落你第"+h+"宫="+HOUSE_MEAN[h-1]+")":""),kind:"new",house:h});seen.add(key);}
    }else if(Math.abs(diff-180)<7){
      const si=Math.floor(mL/30), key="满"+si;
      if(!seen.has(key)){const h=houseOfC(mL,cusps);
        ev.push({date:d,txt:"🌕满月在"+SIGNS[si]+"座"+(h?"(照你第"+h+"宫="+HOUSE_MEAN[h-1]+")":""),kind:"full",house:h});seen.add(key);}
    }
  }
  return ev;
}
// —— 行运换座(进本命新宫)扫描 ——
function scanIngress(start,days,cusps,names){
  const ev=[];
  for(const [n,b] of BODIES){
    if(names&&!names.includes(n)) continue;
    let prev=Math.floor(lon(b,start)/30);
    for(let k=1;k<=days;k++){
      const d=new Date(start.getTime()+k*864e5); d.setHours(12,0,0,0);
      const L=lon(b,d), cur=Math.floor(L/30);
      if(cur!==prev){
        const h=houseOfC(L,cusps);
        ev.push({date:d,txt:"行运"+n+"进入"+SIGNS[cur]+"座"+(h?"(踏进你第"+h+"宫="+HOUSE_MEAN[h-1]+")":""),house:h});
        prev=cur;
      }
    }
  }
  return ev;
}
// —— 区间内相位精确成相扫描(找 orb 最小那天=能量顶点) ——
function scanExactAspects(natal,start,days,transNames,orbMax){
  const hits={};   // key=行运星+相位+本命星 → {best}
  for(let k=0;k<=days;k++){
    const d=new Date(start.getTime()+k*864e5); d.setHours(12,0,0,0);
    for(const asp of transitAspects(natal,d,transNames,orbMax)){
      const key=asp.trans+asp.asp+asp.nat;
      if(!hits[key]||asp.orb<hits[key].orb) hits[key]={...asp,date:d};
    }
  }
  return Object.values(hits).sort((a,b)=>a.date-b.date);
}

// —— 里程碑回溯(编年史坐标·2026-07-14定:时间点=想留下来的参考标准) ——
// "上一次光这样找你,是2014年的夏天"——把这一期钉在TA人生的长线上=周报月报从天气预报变编年史。
// 🔴日期全算死喂M3,绝不让它编年份。只有慢星有资格(火2年/木12年/土29年);天海冥=一生一度。
const CYCLE_DAYS={火星:687,木星:4333,土星:10747};
const LIFE_ONCE={天王:"约84年一轮",海王:"约165年一轮",冥王:"约248年一轮"};
function lastMilestone(natal,a,birthYear){
  if(LIFE_ONCE[a.trans]) return {txt:a.t+"→"+LIFE_ONCE[a.trans]+"·一生一度,此生仅此一回"};
  const cyc=CYCLE_DAYS[a.trans]; if(!cyc) return null;
  const natP=natal.planets.find(p=>p.n===a.nat); if(!natP) return null;
  const aspDeg={合:0,六合:60,刑:90,拱:120,冲:180}[a.asp]; if(aspDeg===undefined) return null;
  const pair=BODIES.find(b=>b[0]===a.trans); if(!pair) return null;
  const tb=pair[1];
  const guess=new Date(a.date.getTime()-cyc*864e5);
  let best=null;
  const scan=(fromT,toT,step)=>{
    for(let t=fromT;t<=toT;t+=step*864e5){
      const d=new Date(t);
      let diff=Math.abs(lon(tb,d)-natP.L)%360; if(diff>180)diff=360-diff;
      const o=Math.abs(diff-aspDeg);
      if(!best||o<best.o) best={o,d};
    }
  };
  scan(guess.getTime()-420*864e5,guess.getTime()+420*864e5,15);
  if(!best) return null;
  const c=best.d.getTime(); best=null;
  scan(c-15*864e5,c+15*864e5,1);
  if(!best||best.o>1.5) return null;
  const y=best.d.getFullYear(),m=best.d.getMonth()+1;
  const season=(m>=3&&m<=5)?"春":(m>=6&&m<=8)?"夏":(m>=9&&m<=11)?"秋":"冬";
  const yrs=Math.max(1,Math.round((a.date-best.d)/(365.25*864e5)));
  if(birthYear&&y<birthYear+10) return {txt:a.t+"→你长大成人后第一次遇上它(上一轮它来时你还是个孩子)"};
  return {txt:a.t+"→上一次:"+y+"年的"+season+"天(约"+yrs+"年一轮)"};
}
// 从一批成相里挑最有资格做编年史坐标的1~2条(慢者为重:天海冥>土>木>火)
function milestoneLines(natal,exacts,birthYear,maxN){
  const RANK={冥王:6,海王:5,天王:4,土星:3,木星:2,火星:1};
  const cand=(exacts||[]).filter(a=>RANK[a.trans]).sort((x,y)=>RANK[y.trans]-RANK[x.trans]);
  const out=[];
  for(const a of cand){
    if(out.length>=(maxN||2)) break;
    const m=lastMilestone(natal,a,birthYear);
    if(m) out.push("  · "+m.txt);
  }
  return out;
}
// —— 档案身份行(人格底色·喂M3定调) ——
function identityLine(profile){
  const p=profile||{};
  let s="太阳"+(p.sunSign||"?")+" · 月亮"+(p.moonSign||"?")+(p.ascSign?" · 上升"+p.ascSign:" · 上升未知(时辰不明·不报宫位)");
  if(p.mbti) s+=" · 人格底色"+p.mbti;
  if(p.sex) s+=" · "+p.sex;
  return s;
}

// ============ 三档硬数据构建器 ============
// profile={sunSign,moonSign,ascSign,mbti,sex}  meta=birth_meta
function buildDay(meta,profile,date){
  const natal=computeNatalLite(meta);
  const cusps=natal.cusps;
  const d=new Date(date); d.setHours(12,0,0,0);
  // 情绪线:行运月亮
  const mL=lon(A.Body.Moon,d), mSi=Math.floor(mL/30), mH=houseOfC(mL,cusps);
  // 事件线:日水金火对本命(orb≤3)+月亮对本命(orb≤4)
  const evAsp=transitAspects(natal,d,["太阳","水星","金星","火星"],3);
  const moonAsp=transitAspects(natal,d,["月亮"],4);
  // 大背景:慢星紧相位(orb≤1.5才提·免得天天喊狼来了)
  const slowAsp=transitAspects(natal,d,["木星","土星","天王","海王","冥王"],1.5);
  // 今日逆行中的行运星
  const rxList=BODIES.filter(([n,b])=>isRx(b,d)).map(([n])=>n);
  // 纵深连线料:本月剧情锚=慢星月度精确成相最重的1-2条(连续剧的长线,日报把"今天"挂上去)
  const mFirst=new Date(d.getFullYear(),d.getMonth(),1,12,0,0);
  const mDays=new Date(d.getFullYear(),d.getMonth()+1,0).getDate()-1;
  const anchor=scanExactAspects(natal,mFirst,mDays,["木星","土星","天王","海王","冥王"],1.0).slice(0,2);
  // 留半口料:未来三天将至的月相/顶点日(钩明天必须用真数据)
  const soon=[];
  try{
    scanMoonEvents(new Date(d.getTime()+864e5),2,cusps).forEach(e=>soon.push(mdCn(e.date)+" "+e.txt));
    scanExactAspects(natal,new Date(d.getTime()+864e5),2,["太阳","水星","金星","火星","木星","土星"],1.2).forEach(a=>soon.push(mdCn(a.date)+" "+a.t+"("+(a.hard?"课题相":"顺流相")+")"));
  }catch(_){}
  soon.length=Math.min(soon.length,4);  // 留半口只要一钩,料给太多反而稀释
  const fmtA=a=>"  · "+a.t+"(差"+a.orb+"°·"+(a.applying?"入相=劲正在上来":"出相=劲正在退")+(a.rx?"·该行运星逆行中":"")+")";
  const data=
"【身份】"+identityLine(profile)+"\n"+
"【日期】"+dayKey(d)+"\n"+
"【情绪线·行运月亮】在"+SIGNS[mSi]+"座("+ELEMENT[SIGNS[mSi]]+"象)"+(mH?"·走你第"+mH+"宫("+HOUSE_MEAN[mH-1]+")":"")+"\n"+
"【月亮对本命(今天的心情为什么这样)】\n"+(moonAsp.length?moonAsp.map(fmtA).join("\n"):"  · 无紧相位(情绪平)")+"\n"+
"【事件线·日水金火对本命(今天的事从哪来)】\n"+(evAsp.length?evAsp.map(fmtA).join("\n"):"  · 无紧相位(平顺日)")+"\n"+
"【大背景·慢星正压/正推的点(仅差≤1.5°的·这是最近一阵的底层剧情)】\n"+(slowAsp.length?slowAsp.map(fmtA).join("\n"):"  · 无")+"\n"+
"【本月剧情锚(本月的底层大剧情·把今天挂到这条线上写)】\n"+(anchor.length?anchor.map(a=>"  · "+mdCn(a.date)+"顶点 "+a.t+"("+(a.hard?"课题相":"顺流相")+")").join("\n"):"  · 无(平稳月)")+"\n"+
"【将至·未来三天(留半口用·日期照抄绝不许编)】\n"+(soon.length?soon.map(x=>"  · "+x).join("\n"):"  · 无")+"\n"+
"【今日逆行中】"+(rxList.length?rxList.join("、"):"无");
  return {kind:"day",periodKey:dayKey(d),data,natal};
}

function buildWeek(meta,profile,date){
  const natal=computeNatalLite(meta);
  const cusps=natal.cusps;
  const {mon,sun}=weekRange(date);
  // 本周内精确成相(日水金火木土·orb≤1.2=真成相·带顶点日)
  const exact=scanExactAspects(natal,mon,6,["太阳","水星","金星","火星","木星","土星"],1.2);
  const moons=scanMoonEvents(mon,6,cusps);
  const ingress=scanIngress(mon,6,cusps,["太阳","水星","金星","火星"]);
  const rxList=BODIES.filter(([n,b])=>isRx(b,new Date(mon.getTime()+3*864e5))).map(([n])=>n);
  // 纵深连线料:本月剧情锚(同日报·周报承接月剧情)
  const mid=new Date(mon.getTime()+3*864e5);
  const mFirst=new Date(mid.getFullYear(),mid.getMonth(),1,12,0,0);
  const mDays=new Date(mid.getFullYear(),mid.getMonth()+1,0).getDate()-1;
  const anchor=scanExactAspects(natal,mFirst,mDays,["木星","土星","天王","海王","冥王"],1.0).slice(0,2);
  const fmtE=a=>"  · "+mdCn(a.date)+" "+a.t+"(顶点日·"+(a.hard?"课题相":"顺流相")+")";
  const data=
"【身份】"+identityLine(profile)+"\n"+
"【本月剧情锚(本月的底层大剧情·本周是它的一章)】\n"+(anchor.length?anchor.map(a=>"  · "+mdCn(a.date)+"顶点 "+a.t+"("+(a.hard?"课题相":"顺流相")+")").join("\n"):"  · 无(平稳月)")+"\n"+
"【周期】"+isoWeekKey(date)+"("+mdCn(mon)+"—"+mdCn(sun)+")\n"+
"【本周成相·能量顶点日(已按日期排好·硬数据勿改)】\n"+(exact.length?exact.map(fmtE).join("\n"):"  · 本周无精确成相(平流周)")+"\n"+
(function(){const ms=milestoneLines(natal,exact,meta&&meta.y,1);return ms.length?"【编年史坐标·上一次同款天象(已算死·年份绝不许编·没给的绝不许自己回溯)】\n"+ms.join("\n")+"\n":"";})()+
domainSection(natal,cusps,exact,moons,ingress)+
"【本周月相】"+(moons.length?moons.map(e=>mdCn(e.date)+" "+e.txt).join(" / "):"无新满月")+"\n"+
"【本周换座过宫】"+(ingress.length?ingress.map(e=>mdCn(e.date)+" "+e.txt).join(" / "):"无")+"\n"+
"【本周逆行中】"+(rxList.length?rxList.join("、"):"无");
  return {kind:"week",periodKey:isoWeekKey(date),data,natal,range:{mon,sun}};
}

function buildMonth(meta,profile,date){
  const natal=computeNatalLite(meta);
  const cusps=natal.cusps;
  const first=new Date(date.getFullYear(),date.getMonth(),1,12,0,0);
  const days=new Date(date.getFullYear(),date.getMonth()+1,0).getDate()-1;
  // 本月主线:火木土天海冥对本命精确成相(orb≤1.0)
  const exact=scanExactAspects(natal,first,days,["火星","木星","土星","天王","海王","冥王"],1.0);
  // 日水金也扫但只留 hard 相(本月坑位提醒)
  const fastHard=scanExactAspects(natal,first,days,["太阳","水星","金星"],0.8).filter(a=>a.hard);
  const moons=scanMoonEvents(first,days,cusps);
  const ingress=scanIngress(first,days,cusps,["金星","火星","木星","土星"]);
  // 水星顺逆转折(本月内有没有停滞转向日)
  const mercFlips=[];
  let prevRx=isRx(A.Body.Mercury,first);
  for(let k=1;k<=days;k++){
    const d=new Date(first.getTime()+k*864e5);
    const r=isRx(A.Body.Mercury,d);
    if(r!==prevRx){mercFlips.push({date:d,txt:r?"水星开始逆行":"水星恢复顺行"});prevRx=r;}
  }
  const fmtE=a=>"  · "+mdCn(a.date)+" "+a.t+"(顶点日·"+(a.hard?"课题相":"顺流相")+")";
  const data=
"【身份】"+identityLine(profile)+"\n"+
"【周期】"+monthKey(date)+"月运\n"+
"【本月主线·慢星+火星对本命精确成相(月度大事窗口·已按日期排好)】\n"+(exact.length?exact.map(fmtE).join("\n"):"  · 本月无慢星精确成相(承接上月余波·平稳月)")+"\n"+
"【本月坑位提醒·快星课题相】\n"+(fastHard.length?fastHard.map(fmtE).join("\n"):"  · 无")+"\n"+
(function(){const ms=milestoneLines(natal,exact,meta&&meta.y,3);return ms.length?"【编年史坐标·上一次同款天象(已算死·年份绝不许编·没给的绝不许自己回溯)】\n"+ms.join("\n")+"\n":"";})()+
domainSection(natal,cusps,exact.concat(fastHard),moons,ingress)+
"【本月月相节点】"+(moons.length?moons.map(e=>mdCn(e.date)+" "+e.txt).join(" / "):"无")+"\n"+
"【本月换座过宫】"+(ingress.length?ingress.map(e=>mdCn(e.date)+" "+e.txt).join(" / "):"无")+"\n"+
"【水星顺逆转折】"+(mercFlips.length?mercFlips.map(e=>mdCn(e.date)+" "+e.txt).join(" / "):"本月无转折");
  return {kind:"month",periodKey:monthKey(date),data,natal};
}

// —— 周期搭档(复用天机引擎的灵魂关系机器) ——
// 🔴日档=群运营同源:直接取 buildDaily16Types 该型那一行(与星象.html发群的16型卷同一条代码路径,永不打脸)。
// 周/月=站内独有:月先挑(15号代表日)、周避开月已用的关系词(三档不满屏一个人);带seed轮庄,同期同结果可缓存。
function buddyFor(type,sunSign,date,kind){
  const T=window.TIANJI;
  if(!T||!window.MBTI||!type||!sunSign) return null;
  const elem=ELEMENT[(sunSign||"").replace(/座$/,"")];
  if(kind==="day"){
    try{
      const m16=T.buildDaily16Types(new Date(date));
      const row=(m16.segs[elem]||[]).find(s=>s.type===type);
      return (row&&row.buddy)?{mate:row.buddy,word:row.buddyWord}:null;
    }catch(_){return null;}
  }
  try{
    const pickAt=(rep,seed,used)=>{
      rep=new Date(rep); rep.setHours(12,0,0,0);
      const {score}=T.funcDailyScore(rep);
      const segScore=T.withSunElem(score,elem);
      const ALL16=Object.keys(window.MBTI.STACKS||{});
      const scoreMap={};
      ALL16.forEach(t=>{const s=T.typeDailyState(t,segScore);if(s)scoreMap[s.type]=s.score;});
      return T.pickBuddy(type,scoreMap,used,seed);
    };
    const used=new Set();
    const bm=pickAt(new Date(date.getFullYear(),date.getMonth(),15), type+monthKey(date)+"M", used);
    if(kind==="month") return bm?{mate:bm.mate,word:bm.word}:null;
    const {mon}=weekRange(date);
    const bw=pickAt(new Date(mon.getTime()+2*864e5), type+isoWeekKey(date)+"W", used);
    return bw?{mate:bw.mate,word:bw.word}:null;
  }catch(_){return null;}
}

// —— 搭档解析料(周/月喂M3化用·全是定稿文案不是公式) ——
// 关系剧本一句:提炼自灵魂关系16型配对矩阵§一(定稿的关系词体系)
const REL_SCRIPT={
  "官配":"天生互补的一对——TA强的正是你弱的,越处越省力,互相照亮对方的盲区",
  "电子布洛芬":"一拍即合的来电款——靠近就有火花,跟TA待着就解压",
  "意难平CP":"像天作之合又差一口气——默契都在,就一个点需要磨合",
  "影子人格":"你的灵魂镜像——和你处处相反,却最懂你,也最敢戳你",
  "疗愈搭子":"温柔乡——在TA面前卸得下盔甲,谈心一流,合伙办事一般",
  "嘴上同党":"三观合拍的同道中人——想的一致,做法各异,格外聊得来",
  "电子邻居":"一见如故的舒适区——相处不累,但深了就是两路人",
  "引路人":"你会不自觉向TA看齐——TA身上有你正想长出来的东西",
  "端水搭子":"相敬有礼的君子之交——客气周到,合作可靠,难交心",
  "嘴替":"同类——你没说出口的,TA替你说了"
};
function buddyBrief(mate,word){
  const L=(window.MBTI&&window.MBTI.SOUL_LINES)?window.MBTI.SOUL_LINES[mate]:null;
  const mateLine=(L&&L[1])||(L&&L[0])||"";   // 取封神句(B句),稳定不随机
  const rel=REL_SCRIPT[word]||"";
  if(!mateLine&&!rel) return "";
  return "【搭档解析料(化用成人话·勿原样照抄)】TA是这样的人:"+mateLine+(rel?" ／ 你们的关系:"+rel:"");
}

// —— 本月开运日(2026-08-10 定:月报第四样) ——
// 为什么只给月报:开运日放日报没意义(就是今天)、放周报太短(七天里挑一天挑不出花),
// 只有"一个月"这个尺度上,"哪几天最旺"才是一句值得截图收着的话。
// 🔴 规矩一:只认【顺流相】的精确顶点日。课题相是硬功课,不是加持,一概不算。
// 🔴 规矩二:不能只用慢星(木土天海冥)——很多月份一条精确相都没有(引擎里管这叫"平稳月"),
//    月月开天窗。所以纳入金星与木星:传统吉星,且一个月内必有成相,保证每月都有话说。
// 🔴 规矩三:日期全部由星历算死,绝不让 M3 编年月日(它编起来一点犹豫都没有)。
// 挑法:先按 orb 取最贴合的两天(最准=最有资格叫开运日),再按先后排好读起来顺。
function luckyDaysText(meta,d){
  try{
    if(!meta) return "";
    const natal=computeNatalLite(meta);
    const mFirst=new Date(d.getFullYear(),d.getMonth(),1,12,0,0);
    const mDays=new Date(d.getFullYear(),d.getMonth()+1,0).getDate()-1;
    // 先用紧口径(orb≤1.2)挑最准的;实测三个盘×六个月有 11% 的月份一条都挑不出来
    // (金星逆行月尤其容易空)。月报是花功德解锁的,不该开天窗 ⇒ 空了就放宽到 2.0 再挑一次。
    // 🔴 只放宽口径,不放宽性质:课题相永远不算开运日,这条不让步。
    const pick=orb=>scanExactAspects(natal,mFirst,mDays,["金星","木星"],orb)
      .filter(a=>!a.hard)
      .sort((a,b)=>a.orb-b.orb).slice(0,2)
      .sort((a,b)=>a.date-b.date);
    const hits=(()=>{const t=pick(1.2);return t.length?t:pick(2.0);})();
    return hits.length?hits.map(a=>mdCn(a.date)).join(" · "):"";
  }catch(_){return "";}
}

window.TJME={computeNatalLite,buildDay,buildWeek,buildMonth,buddyFor,buddyBrief,
  luckyDaysText,
  /* 09-10 技师端出片工具要按「太阳星座盘」扫天象：把扫描件导出来，算法一个字不动 */
  transitAspects,scanExactAspects,scanMoonEvents,scanIngress,houseOfC,isRx,lon,BODIES,
  dayKey,isoWeekKey,monthKey,weekRange,wholeHouse,ascIdxOf,HOUSE_MEAN,SIGNS};
})();
