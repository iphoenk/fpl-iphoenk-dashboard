const FPL='https://fantasy.premierleague.com/api/';
const RAW='https://raw.githubusercontent.com/abdelmalek-maskri/fplens/main/app/public/data/';
export function sourceFor(path){
 if(path==='/api/model/news')return 'https://fplens.onrender.com/api/news';
 const files={'best-squad':'best_squad.json','multi-gw':'multi_gw.json','insights':'model_insights.json','accuracy':'../accuracy.json','accuracy-history':'../accuracy_history.json'};
 const key=path.replace('/api/model/','');if(files[key])return new URL(files[key],RAW).href;
 if(/^\/api\/model\/predictions-(config_[abcd]|baseline|baseline_tweedie|position_specific|stacked_ensemble|twohead)$/.test(path))return RAW+path.split('/').pop().replace('predictions-','predictions_')+'.json';
 if(path==='/api/model/manifest')return RAW+'manifest.json';
 if(path==='/api/model/players')return RAW+'players.json';
 const p=path.replace(/^\/api\//,'').replace(/\/?$/,'/');
 if(path.startsWith('/api/')&&/^(bootstrap-static\/|fixtures\/|event\/[1-9]\d?\/live\/|entry\/[1-9]\d{0,9}\/|entry\/[1-9]\d{0,9}\/history\/|entry\/[1-9]\d{0,9}\/event\/[1-9]\d?\/picks\/|leagues-classic\/[1-9]\d{0,9}\/standings\/)$/.test(p))return FPL+p;
 return null;
}
export async function handle(request,env,ctx,html){
 const url=new URL(request.url);
 if(!['GET','HEAD'].includes(request.method))return Response.json({error:'Metode tidak didukung.'},{status:405});
 if(/^\/api\/news\/headlines\/?$/.test(url.pathname))return Response.json(await publicNewsHeadlines());
 if(url.pathname==='/api/insights/snapshot'){
  try{
   const base='https://raw.githubusercontent.com/JonnoMillar/fpl-insights/main/';
   const [page,meta]=await Promise.all([fetch(base+'dashboard-artifact.html',{signal:AbortSignal.timeout(22000)}),fetch(base+'projections.json',{signal:AbortSignal.timeout(22000)})]);
   if(!page.ok||!meta.ok)throw new Error('Snapshot unavailable');
   const html=await page.text(),projections=await meta.json(),scouts={};let players=[],fixtures=[];
   for(const match of html.matchAll(/<script([^>]*type="application\/json"[^>]*)>([\s\S]*?)<\/script>/g)){
    const attrs=match[1];if(!/scout-data|scout-fixtures|id="player-data"/.test(attrs))continue;
    const data=JSON.parse(match[2]);
    if(attrs.includes('scout-data'))scouts[data.pos]=data;
    if(attrs.includes('scout-fixtures'))fixtures=data;
    if(attrs.includes('id="player-data"'))players=data.players.map(({photo,...p})=>p);
   }
   return Response.json({gw:projections.gw,generated:projections.generated,projections:projections.xp,players,scouts,fixtures},{headers:{'Cache-Control':'public, max-age=180','X-Data-Fetched-At':new Date().toISOString()}});
  }catch{return Response.json({error:'Snapshot FPL Insights belum dapat diambil. Coba lagi.'},{status:502});}
 }
 if(!url.pathname.startsWith('/api/')){
  if(url.pathname!=='/'&&url.pathname!=='/index.html')return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:html,{headers:{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
 }
 let source=sourceFor(url.pathname);
 if(!source)return Response.json({error:'Endpoint tidak tersedia.'},{status:404});
 if(url.pathname.includes('/standings/')){
  const page=url.searchParams.get('page_standings')||'1';
  if(!/^[1-9]\d{0,3}$/.test(page))return Response.json({error:'Halaman tidak valid.'},{status:400});
  source+='?page_standings='+page;
 }
 const cache=globalThis.caches?.default;
 const key=new Request(url.origin+url.pathname+(url.pathname.includes('/standings/')?'?page_standings='+(url.searchParams.get('page_standings')||'1'):''));
 const cached=cache&&await cache.match(key);if(cached)return cached;
 try{
  const response=await fetch(source,{headers:{Accept:'application/json','User-Agent':'FPL-Dugout/1.0'},signal:AbortSignal.timeout(url.pathname==='/api/model/news'?150000:22000)});
  if(!response.ok)return Response.json({error:response.status===404?'Data tidak ditemukan. Periksa ID atau gameweek.':'Sumber data FPL sedang tidak tersedia. Coba lagi sebentar.',upstream_status:response.status},{status:response.status===404?404:502});
  const data=await response.json();
  const result=Response.json(data,{headers:{'Cache-Control':'public, max-age=180','X-Data-Fetched-At':new Date().toISOString(),'X-Content-Type-Options':'nosniff'}});
  if(cache&&ctx)ctx.waitUntil(cache.put(key,result.clone()));return result;
 }catch{return Response.json({error:'Koneksi ke sumber data terputus atau terlalu lama. Silakan coba lagi.'},{status:502});}
}
const NEWS_CLUB_DOMAINS=['arsenal.com','avfc.co.uk','afcb.co.uk','brentfordfc.com','brightonandhovealbion.com','chelseafc.com','cpfc.co.uk','evertonfc.com','fulhamfc.com','itfc.co.uk','leedsunited.com','liverpoolfc.com','mancity.com','manutd.com','newcastleunited.com','nottinghamforest.co.uk','safc.com','tottenhamhotspur.com','whufc.com','wolves.co.uk','wearehullcity.co.uk','ccfc.co.uk','burnleyfootballclub.com','southamptonfc.com','lcfc.com'];
const googleNewsFeed=query=>'https://news.google.com/rss/search?q='+encodeURIComponent(query)+'&hl=en-GB&gl=GB&ceid=GB:en';
export const PUBLIC_NEWS_FEEDS=[
 {id:'official-fpl',name:'Official FPL / Premier League',type:'official',url:googleNewsFeed('site:premierleague.com (FPL OR fantasy OR injury OR team news) when:7d')},
 {id:'official-clubs',name:'Official club news',type:'club',url:googleNewsFeed('('+NEWS_CLUB_DOMAINS.map(d=>'site:'+d).join(' OR ')+') (injury OR team news OR press conference OR fitness) when:7d')},
 {id:'media',name:'Football media',type:'media',url:googleNewsFeed('("Fantasy Premier League" OR "Premier League team news") when:7d')},
 {id:'video',name:'YouTube',type:'video',url:googleNewsFeed('site:youtube.com (FPL OR "Premier League" "press conference") when:7d')},
 {id:'social',name:'Social / X',type:'social',url:googleNewsFeed('site:x.com (FPL OR "team news") when:7d')},
 {id:'forum',name:'r/FantasyPL',type:'forum',url:'https://www.reddit.com/r/FantasyPL/new/.rss?limit=25'}
];
export function decodeNewsText(text){return String(text||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const cp=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return cp>0&&cp<=0x10ffff?String.fromCodePoint(cp):'';}).replace(/&(?:amp|quot|apos|lt|gt|nbsp);/g,v=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '}[v])).replace(/\s+/g,' ').trim();}
export function parsePublicNewsFeed(xml,feed){
 if(typeof xml!=='string'||xml.length>2000000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Invalid feed');
 const parts=[...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].slice(0,40),articles=[];
 for(const [,kind,part] of parts){
  const title=decodeNewsText(part.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i)?.[1]);
  const rawDate=part.match(/<(?:pubDate|published|updated)>([\s\S]*?)<\/(?:pubDate|published|updated)>/i)?.[1],time=Date.parse(rawDate||'');
  const url=decodeNewsText(kind.toLowerCase()==='entry'?part.match(/<link\b[^>]*\bhref=["']([^"']+)["']/i)?.[1]:part.match(/<link>([\s\S]*?)<\/link>/i)?.[1]);
  const sourceMatch=part.match(/<source\b([^>]*)>([\s\S]*?)<\/source>/i),sourceUrl=decodeNewsText(sourceMatch?.[1]?.match(/url=["']([^"']+)["']/i)?.[1]);
  let host='';try{host=new URL(sourceUrl).hostname.replace(/^www\./,'');}catch{}
  if(!title||!Number.isFinite(time)||!/^https:\/\//i.test(url))continue;
  if(feed.type==='official'&&host!=='premierleague.com'&&host!=='fantasy.premierleague.com')continue;
  if(feed.type==='club'&&!NEWS_CLUB_DOMAINS.includes(host))continue;
  if(feed.type==='video'&&!['youtube.com','youtu.be','m.youtube.com'].includes(host))continue;
  if(feed.type==='social'&&!['x.com','twitter.com','mobile.twitter.com'].includes(host))continue;
  if(feed.type==='forum'&&!/^https:\/\/(?:www\.)?reddit\.com\//i.test(url))continue;
  const source=decodeNewsText(sourceMatch?.[2])||feed.name,headline=title.endsWith(' - '+source)?title.slice(0,-source.length-3):title;
  articles.push({headline,url,source,source_url:sourceUrl||null,source_type:feed.type,verification:['official','club'].includes(feed.type)?'official':feed.type==='media'?'reporting':'community',date:new Date(time).toISOString(),infer_players:true});
 }
 return articles;
}
let publicNewsCache=null;
export async function publicNewsHeadlines(fetcher=fetch,now=Date.now()){
 if(fetcher===fetch&&publicNewsCache&&now-publicNewsCache.checked_at<300000)return publicNewsCache;
 const sources=await Promise.all(PUBLIC_NEWS_FEEDS.map(async feed=>{try{const response=await fetcher(feed.url,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'FPL-iphoenk-dashboard/1.0 (public news feeds)'}});if(!response.ok)throw new Error('HTTP '+response.status);const articles=parsePublicNewsFeed(await response.text(),feed);return {id:feed.id,name:feed.name,type:feed.type,status:articles.length?'ok':'empty',articles,checked_at:now};}catch(error){return {id:feed.id,name:feed.name,type:feed.type,status:'unavailable',articles:[],checked_at:now,error:error.message.startsWith('HTTP ')?error.message:'Source unavailable'};}}));
 const result={checked_at:now,articles:sources.flatMap(s=>s.articles),sources:sources.map(({articles,...source})=>({...source,count:articles.length}))};
 if(fetcher===fetch&&sources.some(s=>s.status==='ok'))publicNewsCache=result;
 return result;
}
