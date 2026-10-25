// FPL_SCORE_CONTEXT_V1: one place that decides which gameweek score is shown and on which basis.
// Pure and dependency-free so the same source runs in node tests and in the bundled browser script.
// Unknown values are null, never 0. A zero bench multiplier stays 0. Published multipliers are used as-is
// (never re-applied), and the hit is subtracted exactly once.

function finiteOrNull(value){
 if(value===null||value===undefined||value==='')return null;
 const number=Number(value);
 return Number.isFinite(number)?number:null;
}
function sha256Hex(text){
 const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const bytes=[];
 for(const char of unescape(encodeURIComponent(text)))bytes.push(char.charCodeAt(0));
 const bitLength=bytes.length*8;
 bytes.push(0x80);
 while(bytes.length%64!==56)bytes.push(0);
 const high=Math.floor(bitLength/0x100000000),low=bitLength>>>0;
 for(const word of [high,low])for(let shift=24;shift>=0;shift-=8)bytes.push((word>>>shift)&255);
 const H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
 const rotr=(value,amount)=>(value>>>amount)|(value<<(32-amount));
 for(let offset=0;offset<bytes.length;offset+=64){
  const w=new Array(64);
  for(let i=0;i<16;i++)w[i]=(bytes[offset+4*i]<<24)|(bytes[offset+4*i+1]<<16)|(bytes[offset+4*i+2]<<8)|bytes[offset+4*i+3];
  for(let i=16;i<64;i++){
   const s0=rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3),s1=rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);
   w[i]=(w[i-16]+s0+w[i-7]+s1)|0;
  }
  let [a,b,c,d,e,f,g,h]=H;
  for(let i=0;i<64;i++){
   const S1=rotr(e,6)^rotr(e,11)^rotr(e,25),ch=(e&f)^(~e&g),t1=(h+S1+ch+K[i]+w[i])|0;
   const S0=rotr(a,2)^rotr(a,13)^rotr(a,22),maj=(a&b)^(a&c)^(b&c),t2=(S0+maj)|0;
   h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
  }
  H[0]=(H[0]+a)|0;H[1]=(H[1]+b)|0;H[2]=(H[2]+c)|0;H[3]=(H[3]+d)|0;H[4]=(H[4]+e)|0;H[5]=(H[5]+f)|0;H[6]=(H[6]+g)|0;H[7]=(H[7]+h)|0;
 }
 return H.map(value=>(value>>>0).toString(16).padStart(8,'0')).join('');
}
function canonicalJson(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value===undefined?null:value);
 if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
 return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalJson(value[key])).join(',')+'}';
}
export function scoreInputDigest(input){return sha256Hex(canonicalJson(input));}

export const SCORE_BASIS={OFFICIAL_PUBLISHED:'OFFICIAL_PUBLISHED',LIVE_PUBLISHED_MULTIPLIERS:'LIVE_PUBLISHED_MULTIPLIERS',LIVE_ESTIMATED_AUTOSUB:'LIVE_ESTIMATED_AUTOSUB'};

export function buildScoreContext({entry=null,picks=null,live=null,event=null,standing=null,season=null,gameweek=null,sourceMeta={}}={}){
 const warnings=[];
 const history=picks?.entry_history||null;
 const requestedGw=finiteOrNull(gameweek);
 const historyEvent=finiteOrNull(history?.event);
 if(requestedGw!==null&&historyEvent!==null&&historyEvent!==requestedGw)warnings.push('PICKS_GW_MISMATCH');

 // Official, published by FPL for this entry and GW. Zero is a legitimate value; absent is null.
 const officialGw=finiteOrNull(history?.points);
 const officialTotal=finiteOrNull(history?.total_points)??finiteOrNull(entry?.summary_overall_points);
 const hit=finiteOrNull(history?.event_transfers_cost);
 if(hit===null&&history)warnings.push('HIT_UNKNOWN');

 // Standing row is a separate snapshot (league table). Keep it distinct; never merge it into official/live.
 const standingGw=finiteOrNull(standing?.event_total);
 const standingTotal=finiteOrNull(standing?.total);
 if(standingGw!==null&&officialGw!==null&&standingGw!==officialGw)warnings.push('STANDING_GW_DIFFERS_FROM_PICKS');
 if(standingTotal!==null&&officialTotal!==null&&standingTotal!==officialTotal)warnings.push('STANDING_TOTAL_DIFFERS_FROM_PICKS');

 // Live gross from the multipliers FPL published on the picks. Not re-applied, not re-derived.
 let liveGross=null,captainPoints=null,benchRaw=null,basis=SCORE_BASIS.OFFICIAL_PUBLISHED;
 const liveById=new Map((live?.elements||[]).map(p=>[Number(p.id),p]));
 if(picks&&Array.isArray(picks.picks)&&liveById.size){
  let gross=0,bench=0,valid=true,captain=null;
  for(const pick of picks.picks){
   const points=finiteOrNull(liveById.get(Number(pick.element))?.stats?.total_points);
   const multiplier=finiteOrNull(pick.multiplier);
   const position=finiteOrNull(pick.position);
   if(position===null||multiplier===null){valid=false;warnings.push('PICK_MULTIPLIER_UNKNOWN');break;}
   if(points===null){
    if(position<=11||multiplier>0){valid=false;warnings.push('LIVE_POINTS_MISSING');break;}
    bench=null;continue;
   }
   gross+=points*multiplier;
   if(position>11&&bench!==null)bench+=points;
   if(pick.is_captain)captain=points*multiplier;
  }
  if(valid){liveGross=gross;benchRaw=bench;captainPoints=captain;basis=SCORE_BASIS.LIVE_PUBLISHED_MULTIPLIERS;}
 }else if(picks&&Array.isArray(picks.picks)){warnings.push('LIVE_UNAVAILABLE');}
 const liveNet=liveGross!==null&&hit!==null?liveGross-hit:null;
 if(liveNet!==null&&officialGw!==null&&liveNet!==officialGw)warnings.push('LIVE_DIFFERS_FROM_OFFICIAL');
 if(liveGross!==null&&hit===null)warnings.push('LIVE_NET_UNAVAILABLE_HIT_UNKNOWN');

 // Finality comes from FPL's own data_checked flag, not from an HTTP 200.
 let finality='UNAVAILABLE';
 if(officialGw!==null||liveGross!==null)finality=event?.data_checked===true?'CHECKED':'PROVISIONAL';
 if(event&&event.finished===true&&event.data_checked!==true)warnings.push('FINISHED_NOT_DATA_CHECKED');

 const inputs={season:season??null,entry_id:finiteOrNull(entry?.id),gameweek:requestedGw,history,picks:picks?.picks?.map(p=>[p.element,p.position,p.multiplier,p.is_captain?1:0,p.is_vice_captain?1:0])??null,live:[...liveById.values()].map(p=>[p.id,p.stats?.total_points??null]).sort((a,b)=>a[0]-b[0]),standing:standing?{event_total:standingGw,total:standingTotal}:null,data_checked:event?.data_checked??null};
 return {
  version:'FPL_SCORE_CONTEXT_V1',season:season??null,entry_id:finiteOrNull(entry?.id),gameweek:requestedGw,
  basis,official_gw_points:officialGw,official_season_total:officialTotal,
  standing_gw_points:standingGw,standing_total:standingTotal,
  live_gross:liveGross,hit_points:hit,live_net:liveNet,captain_points:captainPoints,bench_raw_points:benchRaw,
  finality,source_as_of:sourceMeta.source_as_of??null,fetched_at:sourceMeta.fetched_at??null,
  input_digest:scoreInputDigest(inputs),warnings:[...new Set(warnings)]
 };
}

export function describeScoreBasis(context){
 if(!context||context.official_gw_points===null&&context.live_gross===null)return 'GW points unavailable';
 const finality=context.finality==='CHECKED'?'final':context.finality==='PROVISIONAL'?'provisional':'unavailable';
 const parts=[];
 if(context.official_gw_points!==null)parts.push('Official '+context.official_gw_points);
 if(context.live_net!==null&&context.live_net!==context.official_gw_points)parts.push('live net '+context.live_net);
 return parts.join(' · ')+' · '+finality;
}
