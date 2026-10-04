// 西盘「主体力量」尺子 v0（2026-10-01，规则在跑验证盘之前锁定）
// 自我星＝太阳＋命主星（上升星座古典守护）。单星＝本质力量 μ × 落宫 × (1＋扶克相位合计)；S＝两星平均。
// 半尺（时辰或出生地不详）：只用太阳，且不乘落宫（宫位算不出）。
const RULER={白羊:'火星',金牛:'金星',双子:'水星',巨蟹:'月亮',狮子:'太阳',处女:'水星',天秤:'金星',天蝎:'火星',射手:'木星',摩羯:'土星',水瓶:'土星',双鱼:'木星'};
// 正典 dignity_table.md：庙1.5 旺1.3 平1.0 弱0.7 陷0.5；同座既庙又旺取高
const DIG={
  太阳:{庙:['狮子'],旺:['白羊'],陷:['水瓶'],弱:['天秤']},
  月亮:{庙:['巨蟹'],旺:['金牛'],陷:['摩羯'],弱:['天蝎']},
  水星:{庙:['双子','处女'],旺:['处女'],陷:['射手','双鱼'],弱:['双鱼']},
  金星:{庙:['金牛','天秤'],旺:['双鱼'],陷:['天蝎','白羊'],弱:['处女']},
  火星:{庙:['白羊','天蝎'],旺:['摩羯'],陷:['天秤','金牛'],弱:['巨蟹']},
  木星:{庙:['射手','双鱼'],旺:['巨蟹'],陷:['双子','处女'],弱:['摩羯']},
  土星:{庙:['摩羯','水瓶'],旺:['天秤'],陷:['巨蟹','狮子'],弱:['白羊']},
};
function mu(p,sign){const d=DIG[p];if(d.庙.includes(sign))return 1.5;if(d.旺.includes(sign))return 1.3;if(d.陷.includes(sign))return 0.5;if(d.弱.includes(sign))return 0.7;return 1.0;}
const HOUSE=h=>[1,4,7,10].includes(h)?1.2:[3,6,9,12].includes(h)?0.8:1.0;
const ASP={合:[0,8],冲:[180,8],刑:[90,7],拱:[120,7],六合:[60,5]};   // 引擎 ASP_DEF 容许度
function aspect(a,b){const x=Math.abs(a-b)%360,ang=Math.min(x,360-x);for(const k in ASP){const[t,o]=ASP[k];if(Math.abs(ang-t)<=o)return k;}return null;}
function starStrength(N,name,useHouse){
  const P=Object.fromEntries(N.planets.map(p=>[p.n,p]));const s=P[name];
  let adj=0;
  for(const o of N.planets){ if(o.n===name)continue;
    const k=aspect(s.L,o.L); if(!k)continue;
    if((o.n==='金星'||o.n==='木星')&&['合','拱','六合'].includes(k)) adj+=0.15;
    if(['土星','火星','冥王'].includes(o.n)&&['刑','冲'].includes(k)) adj-=0.15;
    if(['土星','火星'].includes(o.n)&&k==='合') adj-=0.15;
  }
  let v=mu(name,s.sign)*(useHouse?HOUSE(s.house):1)*(1+adj);
  if(s.rx&&name!=='太阳') v*=0.7;
  return v;
}
function S(N,half){
  if(half) return starStrength(N,'太阳',false);
  const r=RULER[N.angles.asc.sign];
  return (starStrength(N,'太阳',true)+starStrength(N,r,true))/2;
}
module.exports={S,RULER};
