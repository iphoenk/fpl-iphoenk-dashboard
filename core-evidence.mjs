// Independent CSV adapter. Source data reused under the permission in FPL Core README.
export function parseCoreCSV(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if(c==='\n'&&!quoted){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}else field+=c;}
 if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}if(quoted)throw new Error('CSV tidak valid');const headers=rows.shift()||[];return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
}
export function coreEvidence(bootstrap,identities,matches,stats){
 const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,''),num=v=>v==null||String(v).trim()===''||!Number.isFinite(Number(v))?null:Number(v);
 const codes=new Map(bootstrap.elements.map(p=>[String(p.code),p])),mapped=new Map();
 for(const r of identities){const p=codes.get(r.player_code);if(p&&norm(p.first_name+' '+p.second_name)===norm(r.first_name+' '+r.second_name))mapped.set(r.player_id,p.id);}
 const final=new Map(matches.filter(m=>/^true$/i.test(m.finished)).map(m=>[m.match_id,m])),players={},seen=new Set();
 for(const r of stats){const id=mapped.get(r.player_id),m=final.get(r.match_id),key=id+':'+r.match_id;if(!id||!m||seen.has(key))continue;seen.add(key);const p=players[id]||(players[id]={minutes:0,matches:0,cbit:0,chances:0,boxTouches:0,competitions:[],latestDate:null,partial:[]});p.matches++;
 for(const [key,raw] of [['minutes',r.minutes_played],['chances',r.chances_created],['boxTouches',r.touches_opposition_box]]){const v=num(raw);if(v===null)p.partial.push(key);else p[key]+=v;}
 const cbit=['clearances','blocks','interceptions','tackles'].map(k=>num(r[k]));if(cbit.some(v=>v===null))p.partial.push('cbit');else p.cbit+=cbit.reduce((a,b)=>a+b,0);
 if(m.tournament&&!p.competitions.includes(m.tournament))p.competitions.push(m.tournament);const date=String(m.kickoff_time||'').slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&(!p.latestDate||date>p.latestDate))p.latestDate=date;
 }
 for(const p of Object.values(players))for(const k of p.partial)p[k]=null;
 return {matched:mapped.size,total:bootstrap.elements.length,players};
}
let coreCache=null,corePending=null;
export async function fetchCoreEvidence(fetcher=fetch){
 if(coreCache&&Date.now()-coreCache.at<900000)return coreCache.data;if(corePending)return corePending;
 corePending=(async()=>{const response=await fetcher('https://fantasy.premierleague.com/api/bootstrap-static/',{signal:AbortSignal.timeout(22000)});if(!response.ok)throw new Error('Official FPL unavailable');const bs=await response.json(),gw=bs.events.find(e=>e.is_current)?.id||bs.events.find(e=>e.is_previous)?.id,year=new Date(bs.events[0].deadline_time).getUTCFullYear();if(!gw)throw new Error('GW unavailable');const base='https://raw.githubusercontent.com/olbauday/FPL-Core-Insights/main/data/'+year+'-'+(year+1)+'/',folder=base+'By%20Gameweek/GW'+gw+'/';
 const fetched=await Promise.all([base+'players.csv',folder+'matches.csv',folder+'playermatchstats.csv'].map(async url=>{const r=await fetcher(url,{signal:AbortSignal.timeout(22000)});if(!r.ok||Number(r.headers.get('content-length')||0)>4000000)throw new Error('Core source unavailable');const body=await r.text();if(body.length>4000000)throw new Error('Core data too large');return {rows:parseCoreCSV(body),modified:r.headers.get('last-modified')};}));
 const data={...coreEvidence(bs,...fetched.map(r=>r.rows)),gw,season:year+'-'+(year+1),checked_at:new Date().toISOString(),source_modified_at:fetched.map(r=>r.modified).filter(Boolean),source:'FPL Core Insights',url:'https://github.com/olbauday/FPL-Core-Insights',scope:'Pertandingan selesai dalam snapshot GW sumber, lintas kompetisi; bukan jaminan cakupan lengkap.'};coreCache={at:Date.now(),data};return data;})();try{return await corePending;}finally{corePending=null;}
}
