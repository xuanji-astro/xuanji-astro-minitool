'use strict';

// Production KP natal deep timing engine. Astronomy calculations come only
// from the bundled MIT-licensed astronomy-engine build.
const A = require('./astronomy.js');

const DEG = Math.PI / 180;
const DAY_MS = 86400000;
const VIM_YEAR_DAYS = 365.25;
const NAK = 40 / 3;
const LORDS = ['ketu', 'venus', 'sun', 'moon', 'mars', 'rahu', 'jupiter', 'saturn', 'mercury'];
const YEARS = [7, 20, 6, 10, 7, 18, 16, 19, 17];
const SEVEN = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'];
const ALL = [...SEVEN, 'rahu', 'ketu'];
const SIGN_LORDS = ['mars', 'venus', 'mercury', 'moon', 'sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'saturn', 'jupiter'];
const BODY = {sun:'Sun', moon:'Moon', mars:'Mars', mercury:'Mercury', jupiter:'Jupiter', venus:'Venus', saturn:'Saturn'};
const GOOD = new Set([2, 7, 11]);
const BLOCK = new Set([1, 6, 10]);
const dailyJupiterCache = new Map();

const norm = x => ((x % 360) + 360) % 360;
const jd = date => date.getTime() / DAY_MS + 2440587.5;
const hasAny = (set, wanted) => wanted.some(x => set.has(x));
const isoDay = date => date.toISOString().slice(0, 10);
const dateFromJd = value => new Date((value-2440587.5)*DAY_MS);

function parseInputDate(isoTime) {
  if (typeof isoTime !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(isoTime) || !/(Z|[+-]\d\d:\d\d(?::\d\d)?)$/.test(isoTime)) {
    throw new RangeError('isoTime must be ISO 8601 and include Z or a UTC offset');
  }
  const secondsOffset=isoTime.match(/([+-])(\d\d):(\d\d):(\d\d)$/);
  let date;
  if(secondsOffset) {
    const wall=new Date(isoTime.slice(0,-9)+'Z');
    const seconds=(Number(secondsOffset[2])*3600+Number(secondsOffset[3])*60+Number(secondsOffset[4]))*(secondsOffset[1]==='+'?1:-1);
    date=new Date(wall.getTime()-seconds*1000);
  } else date=new Date(isoTime);
  if (!Number.isFinite(date.getTime())) throw new RangeError('invalid isoTime');
  return date;
}

function validateLocation(lat, lon) {
  if (!Number.isFinite(lat) || Math.abs(lat) >= 66 || !Number.isFinite(lon) || Math.abs(lon) > 180) {
    throw new RangeError('invalid lat/lon or latitude outside supported Placidus range (-66, 66)');
  }
}

// Same convention as kp_horary.js: KP mean precession plus nutation in
// longitude, so apparent tropical positions become apparent sidereal ones.
function ayanamsa(date) {
  const T = (jd(date) - 2451545) / 36525;
  const mean = 23.7603163604 + (5029.0966*T + 1.11113*T*T - 0.000006*T*T*T) / 3600;
  return mean + A.e_tilt(A.MakeTime(date)).dpsi / 3600;
}

function meanNodeTropical(date) {
  const T = (jd(date) - 2451545) / 36525;
  return norm(125.04455501 - 1934.1361849*T + 0.0020762*T*T + T*T*T/467410 - T*T*T*T/60616000 + A.e_tilt(A.MakeTime(date)).dpsi/3600);
}

function tropical(body, date) {
  if (body === 'moon') return norm(A.EclipticGeoMoon(date).lon);
  return norm(A.Ecliptic(A.GeoVector(A.Body[BODY[body]], date, true)).elon);
}

function siderealLongitude(body, date, ayan = ayanamsa(date)) {
  const x = body === 'rahu' ? meanNodeTropical(date) : body === 'ketu' ? meanNodeTropical(date) + 180 : tropical(body, date);
  return norm(x - ayan);
}

function obliquity(date) {
  const T = (jd(date) - 2451545) / 36525;
  return (23 + 26/60 + 21.448/3600) - (46.815*T + 0.00059*T*T - 0.001813*T*T*T) / 3600;
}

function raDec(lambda, eps) {
  const l=lambda*DEG, e=eps*DEG;
  return {ra:norm(Math.atan2(Math.sin(l)*Math.cos(e), Math.cos(l))/DEG), dec:Math.asin(Math.sin(l)*Math.sin(e))/DEG};
}

function semiArc(dec, lat) {
  const z = -Math.tan(lat*DEG) * Math.tan(dec*DEG);
  if (Math.abs(z) >= 1) throw new RangeError('Placidus undefined at this latitude/declination');
  return Math.acos(z) / DEG;
}

function eclipticMc(ramc, eps) {
  return norm(Math.atan2(Math.sin(ramc*DEG)/Math.cos(eps*DEG), Math.cos(ramc*DEG))/DEG);
}

function cuspFor(ramc, lat, eps, index) {
  const mc = eclipticMc(ramc, eps);
  const g = d => {
    const {ra, dec} = raDec(norm(mc+d), eps);
    const sd=semiArc(dec,lat), nd=180-sd;
    const target=index===11?sd/3:index===12?2*sd/3:index===1?sd:index===2?sd+nd/3:sd+2*nd/3;
    return norm(ra-ramc)-target;
  };
  let lo=0, hi=180;
  for (let i=0; i<65; i++) { const mid=(lo+hi)/2; if (g(mid)>0) hi=mid; else lo=mid; }
  return norm(mc+(lo+hi)/2);
}

function placidusCusps(date, lat, lon, ayan = ayanamsa(date)) {
  const eps=obliquity(date), ramc=norm(A.SiderealTime(date)*15 + lon);
  const tropicalCusps={};
  for (const h of [1,2,3,11,12]) tropicalCusps[h]=cuspFor(ramc,lat,eps,h);
  tropicalCusps[10]=eclipticMc(ramc,eps);
  for (let h=4;h<=9;h++) tropicalCusps[h]=norm(tropicalCusps[h<=6?h+6:h-6]+180);
  const cusps={}; for(let h=1;h<=12;h++) cusps[h]=norm(tropicalCusps[h]-ayan);
  return {ramc, tropicalCusps, cusps};
}

function nakLord(lon) { return LORDS[Math.floor(norm(lon)/NAK)%9]; }

function subLord(lon) {
  const x=norm(lon), star=Math.floor(x/NAK), start=star%9;
  let offset=x-star*NAK;
  for(let n=0;n<9;n++) { const i=(start+n)%9, span=NAK*YEARS[i]/120; if(offset<span-1e-12)return LORDS[i]; offset-=span; }
  return LORDS[(start+8)%9];
}

function pointInfo(lon) {
  const x=norm(lon), sign=Math.floor(x/30);
  return {longitude:x, sign:sign+1, signLord:SIGN_LORDS[sign], starLord:nakLord(x), subLord:subLord(x), nakshatra:Math.floor(x/NAK)+1};
}

function houseOf(lon, cusps) {
  for(let h=1;h<=12;h++) if(norm(lon-cusps[h]) < norm(cusps[h%12+1]-cusps[h])) return h;
  throw new Error('Placidus cusp sectors did not partition zodiac');
}

function vimshottariIntervals(birthJd, moon) {
  const ni=Math.floor(moon/NAK), li=ni%9;
  const first=birthJd-(moon%NAK)/NAK*YEARS[li]*VIM_YEAR_DAYS;
  const intervals=[];
  for(const cycle of [-2,-1,0,1,2]) {
    let majorStart=first+cycle*120*VIM_YEAR_DAYS, major=li;
    for(let mi=0;mi<9;mi++) {
      const majorEnd=majorStart+YEARS[major]*VIM_YEAR_DAYS;
      let minorStart=majorStart;
      for(let ai=0;ai<9;ai++) {
        const minor=(major+ai)%9, minorEnd=minorStart+YEARS[major]*YEARS[minor]/120*VIM_YEAR_DAYS;
        let thirdStart=minorStart;
        for(let pi=0;pi<9;pi++) {
          const third=(minor+pi)%9, thirdEnd=thirdStart+(minorEnd-minorStart)*YEARS[third]/120;
          intervals.push({startJd:thirdStart,endJd:thirdEnd,lords:[LORDS[major],LORDS[minor],LORDS[third]]});
          thirdStart=thirdEnd;
        }
        minorStart=minorEnd;
      }
      majorStart=majorEnd; major=(major+1)%9;
    }
  }
  intervals.sort((a,b)=>a.startJd-b.startJd);
  return intervals;
}

function periodAt(intervals, targetJd) {
  let lo=0, hi=intervals.length;
  while(lo<hi) { const mid=(lo+hi)>>1; if(intervals[mid].startJd<=targetJd)lo=mid+1;else hi=mid; }
  const row=intervals[lo-1];
  return row && targetJd<row.endJd ? row.lords : null;
}

function buildChart({isoTime, lat, lon}) {
  const date=parseInputDate(isoTime); validateLocation(lat,lon);
  const ayan=ayanamsa(date), houses=placidusCusps(date,lat,lon,ayan), longitudes={};
  for(const p of ALL) longitudes[p]=siderealLongitude(p,date,ayan);
  const occupied={}, stars={}, subs={}, planets={};
  for(const p of ALL) {
    occupied[p]=houseOf(longitudes[p],houses.cusps); stars[p]=nakLord(longitudes[p]); subs[p]=subLord(longitudes[p]);
    planets[p]={...pointInfo(longitudes[p]),house:occupied[p]};
  }
  const basic={}; for(const p of ALL) basic[p]={};
  for(let h=1;h<=12;h++) {
    const occupants=new Set(ALL.filter(p=>occupied[p]===h));
    const cuspLord=SIGN_LORDS[Math.floor(houses.cusps[h]/30)];
    for(const p of ALL) {
      let level=0;
      if(occupants.has(stars[p]))level=Math.max(level,4);
      if(occupants.has(p))level=Math.max(level,3);
      if(stars[p]===cuspLord)level=Math.max(level,2);
      if(p===cuspLord)level=Math.max(level,1);
      if(level)basic[p][h]=level;
    }
  }
  const strengths={}; for(const p of ALL)strengths[p]={...basic[p]};
  for(const node of ['rahu','ketu']) {
    const sign=Math.floor(longitudes[node]/30);
    const reps=new Set([SIGN_LORDS[sign],stars[node],...SEVEN.filter(p=>Math.floor(longitudes[p]/30)===sign)]);
    for(let h=1;h<=12;h++) {
      let inherited=0; for(const p of reps)inherited=Math.max(inherited,basic[p][h]||0);
      if(inherited)strengths[node][h]=Math.max(strengths[node][h]||0,inherited);
    }
  }
  const matter={}, gate={}, periodScore={};
  for(const p of ALL) {
    matter[p]=[...new Set([...Object.keys(strengths[p]),...Object.keys(strengths[stars[p]])].map(Number))].sort((a,b)=>a-b);
    const judged=new Set(Object.keys(strengths[stars[subs[p]]]).map(Number));
    const multiplier=hasAny(judged,[2,7,11])?1:hasAny(judged,[1,6,10])?0:0.5;
    gate[p]=multiplier===1?'放行':multiplier===0?'拦':'中性';
    const raw=Math.max(0,...[2,7,11].map(h=>strengths[p][h]||0));
    periodScore[p]=matter[p].some(h=>GOOD.has(h))?raw*multiplier:0;
  }
  const cuspInfo={};for(let h=1;h<=12;h++)cuspInfo[h]=pointInfo(houses.cusps[h]);
  return {birthJd:jd(date),ayanamsa:ayan,ramc:houses.ramc,cusps:cuspInfo,planets,longitudes,
    strengths,occupied,stars,subs,matter,gate,periodScore,
    vimshottari:vimshottariIntervals(jd(date),longitudes.moon),seventhSign:Math.floor(houses.cusps[7]/30)};
}

function scoreDay(chart, date, jupiterLongitude) {
  const targetJd=jd(date), periods=periodAt(chart.vimshottari,targetJd);
  if(!periods)return {date:isoDay(date),periods:null,parts:null,base:0,jupiterStarHit:false,jupiterSeventhHit:false,multiplier:1,score:0};
  const parts=periods.map((p,i)=>chart.periodScore[p]*(i+1));
  let jupiter=jupiterLongitude;
  if(jupiter===undefined) {
    const key=date.getTime();
    if(dailyJupiterCache.has(key))jupiter=dailyJupiterCache.get(key);
    else { jupiter=siderealLongitude('jupiter',date); dailyJupiterCache.set(key,jupiter); }
  }
  const jupiterStarHit=periods.includes(nakLord(jupiter));
  const jupiterSeventhHit=Math.floor(jupiter/30)===chart.seventhSign;
  const multiplier=jupiterStarHit||jupiterSeventhHit?1.25:1;
  return {date:isoDay(date),periods,parts,base:parts.reduce((a,b)=>a+b,0),jupiterStarHit,jupiterSeventhHit,multiplier,score:parts.reduce((a,b)=>a+b,0)*multiplier};
}

function annualScores(chart,startYear,endYear) {
  if(!Number.isInteger(startYear)||!Number.isInteger(endYear)||startYear>endYear||startYear<1||endYear>9999)throw new RangeError('invalid year range');
  const result={};
  for(let year=startYear;year<=endYear;year++) {
    let sum=0, days=0;
    for(let t=Date.UTC(year,0,1,12); new Date(t).getUTCFullYear()===year; t+=DAY_MS) { const date=new Date(t); sum+=scoreDay(chart,date).score; days++; }
    result[year]=sum/days;
  }
  return result;
}

function rankYears(scores,topCount=10) {
  const rows=Object.entries(scores).map(([year,score])=>({year:Number(year),score}));
  return rows.sort((a,b)=>b.score-a.score||a.year-b.year).map((row,i,all)=>{
    const above=all.filter(x=>x.score>row.score+1e-10).length, tied=all.filter(x=>Math.abs(x.score-row.score)<=1e-10).length;
    const position=above+(tied+1)/2;
    return {...row,position,rankScore:all.length===1?1:(all.length-position)/(all.length-1)};
  }).slice(0,topCount);
}

function kpNatalDeep({isoTime,lat,lon,startYear,endYear,topCount=10}) {
  const chart=buildChart({isoTime,lat,lon});
  const years=annualScores(chart,startYear,endYear);
  const rangeStart=Date.UTC(startYear,0,1),rangeEnd=Date.UTC(endYear+1,0,1);
  const vimshottari=chart.vimshottari.filter(x=>dateFromJd(x.endJd).getTime()>rangeStart&&dateFromJd(x.startJd).getTime()<rangeEnd)
    .map(x=>({start:dateFromJd(x.startJd).toISOString(),end:dateFromJd(x.endJd).toISOString(),lords:x.lords}));
  return {input:{isoTime,utcTime:parseInputDate(isoTime).toISOString(),lat,lon,startYear,endYear},ayanamsa:chart.ayanamsa,
    cusps:chart.cusps,planets:chart.planets,strengths:chart.strengths,
    focusStrengths:{love:Object.fromEntries(ALL.map(p=>[p,Object.fromEntries([2,7,11].map(h=>[h,chart.strengths[p][h]||0]))])),block:Object.fromEntries(ALL.map(p=>[p,Object.fromEntries([1,6,10].map(h=>[h,chart.strengths[p][h]||0]))]))},
    matter:chart.matter,gate:chart.gate,periodScore:chart.periodScore,
    vimshottari,annualScores:years,topYears:rankYears(years,topCount)};
}

module.exports={kpNatalDeep,buildChart,scoreDay,annualScores,rankYears,ayanamsa,placidusCusps,siderealLongitude,nakLord,subLord,pointInfo,periodAt};

if(require.main===module) {
  try {
    const [isoTime,lat,lon,startYear,endYear,topCount]=process.argv.slice(2);
    console.log(JSON.stringify(kpNatalDeep({isoTime,lat:Number(lat),lon:Number(lon),startYear:Number(startYear),endYear:Number(endYear),topCount:topCount===undefined?10:Number(topCount)}),null,2));
  } catch(error) { console.error(error.stack); process.exitCode=1; }
}
