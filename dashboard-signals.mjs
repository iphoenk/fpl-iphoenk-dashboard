export function newsNameKey(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
export function buildNewsContext(players,ownIds,watchIds,suggestions=[]){
 const own=new Set(ownIds),watch=new Set(watchIds),candidates=new Map();
 for(const s of suggestions){if(!own.has(s.incoming.id)&&!candidates.has(s.incoming.id))candidates.set(s.incoming.id,{out:s.out.web_name,outId:s.out.id,gain:s.gain});if(candidates.size===10)break;}
 const trending=new Map();
 const add=(p,reason)=>{if(!trending.has(p.id))trending.set(p.id,[]);trending.get(p.id).push(reason);};
 [...players].filter(p=>Number(p.transfers_in_event)>0).sort((a,b)=>Number(b.transfers_in_event)-Number(a.transfers_in_event)).slice(0,20).forEach(p=>add(p,{type:'transfers',value:Number(p.transfers_in_event)}));
 [...players].filter(p=>Number(p.event_points)>=8).sort((a,b)=>Number(b.event_points)-Number(a.event_points)).slice(0,12).forEach(p=>add(p,{type:'performance',value:Number(p.event_points)}));
 return {own,watch,candidates,trending};
}
export function newsCategories(id,context){return [context.own.has(id)?'Squad':null,context.watch.has(id)?'Watchlist':null,context.candidates.has(id)?'Targets':null,context.trending.has(id)?'Trending':null].filter(Boolean);}
export function articleMentionsPlayer(article,player,players){
 const text=' '+newsNameKey((article.headline||'')+' '+(article.snippet||''))+' ',name=newsNameKey(player.web_name);
 if(name.length<3||!text.includes(' '+name+' '))return false;
 const ambiguous=players.filter(p=>newsNameKey(p.web_name)===name).length>1;
 if(!ambiguous)return true;
 const first=newsNameKey(player.first_name).split(' ')[0];return first.length>=3&&new RegExp('(?:^| )'+first+'(?: [a-z0-9]+){0,2} '+name+'(?: |$)').test(text);
}
export function attachMentionedPlayers(articles,players,teams){
 return (articles||[]).map(article=>{const refs=players.filter(p=>articleMentionsPlayer(article,p,players)).slice(0,6).map(p=>({element:p.id,web_name:p.web_name,team_name:teams[p.team]?.short_name}));return refs.length?{...article,players:refs}:null;}).filter(Boolean);
}
export function selectPersonalNews({players,teams,articles,context,filter='For You',now=Date.now()}){
 const byId=new Map(players.map(p=>[p.id,p])),week=7*86400000;
 const matches=id=>{const categories=newsCategories(id,context);return filter==='For You'?categories.length>0:categories.includes(filter);};
 const items=[];
 for(const article of articles||[]){
  const time=Date.parse(article.date||'');if(!Number.isFinite(time)||time>now+86400000||now-time>week)continue;
  const mentioned=(article.players||[]).map(ref=>{const p=byId.get(ref.element);return p&&p.web_name===ref.web_name&&(!ref.team_name||teams[p.team]?.short_name===ref.team_name)&&matches(p.id)&&articleMentionsPlayer(article,p,players)?p:null;}).filter(Boolean);
  if(!mentioned.length)continue;
  const unique=[...new Map(mentioned.map(p=>[p.id,p])).values()];
  items.push({kind:'article',key:newsNameKey(article.headline),time,players:unique,categories:[...new Set(unique.flatMap(p=>newsCategories(p.id,context)))],article,urgent:false});
 }
 for(const p of players){
  if(!p.news||!matches(p.id))continue;
  const time=Date.parse(p.news_added||''),recent=Number.isFinite(time)&&now-time<=week&&time<=now+86400000,ongoing=p.status!=='a';
  if(!recent&&!ongoing)continue;
  items.push({kind:'fitness',key:'fitness-'+p.id,time:Number.isFinite(time)?time:0,players:[p],categories:newsCategories(p.id,context),urgent:context.own.has(p.id)&&ongoing,ongoing:!recent,news:p.news});
 }
 const relevance=item=>Math.max(0,...item.players.map(p=>(context.own.has(p.id)?3:0)+(context.watch.has(p.id)?1:0)+(context.candidates.has(p.id)?2:0)+Math.max(0,...(context.trending.get(p.id)||[]).filter(r=>r.type==='performance').map(r=>r.value))));
 const seen=new Set();return items.sort((a,b)=>b.time-a.time||relevance(b)-relevance(a)||Number(b.urgent)-Number(a.urgent)).filter(item=>{if(seen.has(item.key))return false;seen.add(item.key);return true;});
}
export function deadlineBrief(next,now=Date.now()){
 const time=Date.parse(next?.deadline_time||'');
 if(!Number.isFinite(time))return null;
 if(time<=now)return {time,passed:true,remainingSeconds:0,short:'Deadline lewat',urgent:false};
 // Ceil seconds so the clock never claims the deadline has passed early.
 const remainingSeconds=Math.ceil((time-now)/1000),days=Math.floor(remainingSeconds/86400);
 const hours=Math.floor((remainingSeconds%86400)/3600);
 const minutes=Math.floor((remainingSeconds%3600)/60);
 const seconds=remainingSeconds%60;
 const urgent=remainingSeconds<86400;
 return {
  time,passed:false,remainingSeconds,urgent,
  short:urgent
   ?hours+' jam '+minutes+' menit '+seconds+' detik'
   :days+' hari '+hours+' jam '+minutes+' menit'
 };
}
