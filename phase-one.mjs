export function sourceQuality({receivedAt,maxAge=900000,matched,total,invalid=false}={},now=Date.now()){
 const time=typeof receivedAt==='number'?receivedAt:Date.parse(receivedAt||'');
 if(!Number.isFinite(time))return {status:'unavailable',age:null};
 const age=now-time;if(invalid||age< -60000)return {status:'invalid',age};
 if(age>maxAge)return {status:'stale',age};
 if(Number.isFinite(total)&&(!total||matched<total))return {status:'partial',age,matched,total};
 return {status:'fresh',age,matched,total};
}
export function makeForecast(bootstrap,manifest,model,now=Date.now()){
 const next=bootstrap?.events?.find(e=>e.is_next),deadline=Date.parse(next?.deadline_time||'');
 if(!next||!Number.isFinite(deadline)||now>=deadline)throw new Error('Official deadline closed or unavailable');
 const season=String(new Date(bootstrap.events[0].deadline_time).getUTCFullYear()),base={schema:1,season,gw:next.id,deadline:next.deadline_time,captured_at:new Date(now).toISOString(),universe:bootstrap.elements.length};
 const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 const row=(p,predicted)=>({id:p.id,name:p.web_name,team:p.team,position:p.element_type,predicted:Number(predicted)});
 const official={...base,source:'official-fpl',model:'ep_next',source_published_at:null,players:bootstrap.elements.filter(p=>valid(p.ep_next)).map(p=>row(p,p.ep_next))};
 const generated=Date.parse(manifest?.generated_at||''),start=Date.parse(bootstrap.events[0].deadline_time)-30*86400000;
 let forecast=null;
 if(manifest?.gameweek===next.id&&Date.parse(manifest.deadline)===deadline&&Number.isFinite(generated)&&generated>=start&&generated<=now&&generated<deadline){
  const teams=new Map(bootstrap.teams.map(t=>[t.id,t.short_name]));forecast={...base,source:'fplens',model:manifest.default_model||'config_d',source_published_at:manifest.generated_at,players:bootstrap.elements.filter(p=>{const r=model?.[p.id];return r&&r.web_name===p.web_name&&r.team_name===teams.get(p.team)&&valid(r.predicted_points);}).map(p=>row(p,model[p.id].predicted_points))};
 }
 return {official,model:forecast};
}
export function evaluateForecast(snapshot,live,final){
 if(!final)return {status:'pending',rows:[],mae:null,count:0};
 const actual=new Map((live?.elements||[]).map(p=>[p.id,p.stats])),rows=snapshot.players.map(p=>{const s=actual.get(p.id),v=s?.total_points;return {...p,actual:v!=null&&Number.isFinite(Number(v))?Number(v):null,minutes:s?.minutes??null};});
 const scored=rows.filter(r=>r.actual!==null),by_position={};for(const position of [1,2,3,4]){const cohort=rows.filter(r=>r.position===position),matched=cohort.filter(r=>r.actual!==null);by_position[position]={coverage:cohort.length,count:matched.length,mae:matched.length?matched.reduce((n,r)=>n+Math.abs(r.predicted-r.actual),0)/matched.length:null};}return {by_position,status:scored.length===rows.length?'final':'partial',rows,count:scored.length,mae:scored.length?scored.reduce((n,r)=>n+Math.abs(r.predicted-r.actual),0)/scored.length:null};
}
