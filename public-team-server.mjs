/* Public multi-user gateway: Official FPL facts, V6 provenance and bounded sharing.
   NEVER uses account login, manager-private V12 routes, Monte Carlo or invented advice. */
const OFFICIAL='https://fantasy.premierleague.com/api/';
const V6='https://raw.githubusercontent.com/iphoenk/FPL-iphoenk-engine/runtime-data-v6/data/v6/';
const jsonHeaders={'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const response=(body,status=200,cache=false)=>Response.json(body,{status,headers:{...jsonHeaders,'Cache-Control':cache?'public, max-age=30, stale-while-revalidate=60':'no-store',...(cache?{'Vercel-CDN-Cache-Control':'public, s-maxage=90, stale-while-revalidate=60'}:{})}});
const positive=(id,max=9999999999)=>/^[1-9]\d*$/.test(String(id||''))&&Number.isSafeInteger(Number(id))&&Number(id)<=max;
const publicGw=(bootstrap,now)=>Array.isArray(bootstrap?.events)?bootstrap.events.filter(e=>positive(e.id,38)&&Date.parse(e.deadline_time)<=now).sort((a,b)=>b.id-a.id)[0]?.id:null;
const numeric=value=>value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
export function createPublicTeamBackend({fetcher=fetch,clock=Date.now,maxActive=6,maxPending=120,maxCacheEntries=512,timeoutMs=9000}={}){
  if(!Number.isInteger(maxActive)||maxActive<1||!Number.isInteger(maxPending)||maxPending<0)throw Error('Invalid bounded concurrency config');
  const cache=new Map(),pending=new Map(),queue=[];
  let active=0,peak=0,accepted=0,upstreamCalls=0;
  function enqueue(work){
    if(active>=maxActive&&queue.length>=maxPending)return Promise.reject(Error('BACKPRESSURE'));
    accepted++;
    return new Promise((resolve,reject)=>{
      const go=()=>{
        active++;peak=Math.max(peak,active);
        Promise.resolve().then(work).then(resolve,reject).finally(()=>{
          active--;
          if(queue.length)queue.shift()();
        });
      };
      if(active<maxActive)go();else queue.push(go);
    });
  }
  function put(key,doc,ttl){
    cache.delete(key);
    cache.set(key,{doc,expires:clock()+ttl});
    while(cache.size>maxCacheEntries)cache.delete(cache.keys().next().value);
  }
  async function read(key,url,ttl,bytes=3500000){
    const saved=cache.get(key);
    if(saved&&clock()<saved.expires){cache.delete(key);cache.set(key,saved);return saved.doc;}
    if(pending.has(key))return pending.get(key);
    const promise=enqueue(async()=>{
      upstreamCalls++;
      const r=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(timeoutMs)});
      if(!r.ok)throw Error('UPSTREAM_'+r.status);
      const length=Number(r.headers.get('content-length'));
      if(length>bytes)throw Error('UPSTREAM_SIZE');
      const raw=await r.text();
      if(raw.length>bytes)throw Error('UPSTREAM_SIZE');
      const data=JSON.parse(raw);
      put(key,data,ttl);
      return data;
    });
    pending.set(key,promise);
    try{return await promise;}finally{if(pending.get(key)===promise)pending.delete(key);}
  }
  async function official(path,ttl,bytes){return read('official:'+path,OFFICIAL+path,ttl,bytes);}
  async function v6Evidence(now){
    // Public factual source metadata only; never inspect authenticated or private artifacts.
    const [index,integrity]=await Promise.allSettled([
      read('v6:index',V6+'evidence/latest_index.json',300000,250000),
      read('v6:integrity',V6+'health/publish_integrity.json',300000,100000)
    ]);
    if(index.status!=='fulfilled'||integrity.status!=='fulfilled')return {status:'UNAVAILABLE',authority:'OFFICIAL_FPL',role:'FACTUAL_PROVENANCE_ONLY'};
    const x=index.value,y=integrity.value,observed=Date.parse(y?.observed_at||x?.generated_at);
    if(y?.status!=='PASS'||!Number.isFinite(observed)||observed>now+60000)
      return {status:'UNVERIFIED',authority:'OFFICIAL_FPL',role:'FACTUAL_PROVENANCE_ONLY'};
    const source=(x.sources||[]).find(v=>v.source_id==='official_fpl');
    return {
      status:now-observed>6*3600000?'STALE':'VERIFIED',
      authority:'OFFICIAL_FPL',role:'FACTUAL_PROVENANCE_ONLY',
      observed_at:new Date(observed).toISOString(),
      source_status:source?.health||'UNAVAILABLE',
      source_state:source?.effective_state||'UNAVAILABLE'
    };
  }
  async function team(req){
    if(!['GET','HEAD'].includes(req.method))return response({status:'error',error:'READ_ONLY'},405);
    const u=new URL(req.url);
    if([...u.searchParams.keys()].some(k=>!['entry_id','league_id'].includes(k))||u.searchParams.getAll('entry_id').length!==1||u.searchParams.getAll('league_id').length>1)
      return response({status:'error',error:'INVALID_QUERY'},400);
    const entryId=u.searchParams.get('entry_id'),leagueId=u.searchParams.get('league_id');
    if(!positive(entryId)||leagueId!==null&&!positive(leagueId))return response({status:'error',error:'INVALID_ID'},400);
    const at=clock();
    try{
      const [bootstrap,entry,v6]=await Promise.all([
        official('bootstrap-static/',180000,6500000),
        official('entry/'+entryId+'/',90000,1000000),
        v6Evidence(at)
      ]);
      if(Number(entry?.id)!==Number(entryId)||!Array.isArray(bootstrap?.elements)||!Array.isArray(bootstrap?.events))
        return response({status:'unavailable',error:'OFFICIAL_CONTEXT_MISMATCH'},503);
      const gw=publicGw(bootstrap,at);
      const picks=gw?await official('entry/'+entryId+'/event/'+gw+'/picks/',120000,1000000).catch(()=>null):null;
      const playerMap=new Map(bootstrap.elements.map(p=>[Number(p.id),p]));
      const rows=Array.isArray(picks?.picks)?picks.picks.map(p=>{
        const player=playerMap.get(Number(p.element));
        return player?{element:Number(player.id),name:player.web_name,club_id:player.team,position:p.position,captain:!!p.is_captain,vice:!!p.is_vice_captain,status:player.status}:null;
      }).filter(Boolean):[];
      const classic=Array.isArray(entry.leagues?.classic)?entry.leagues.classic:[];
      let league=null;
      if(leagueId!==null){
        const member=classic.find(l=>Number(l.id)===Number(leagueId));
        if(!member)return response({status:'error',error:'NOT_A_PUBLIC_LEAGUE_MEMBER'},404);
        const claimed=numeric(member.entry_rank),start=claimed&&claimed>0?Math.floor((claimed-1)/10)*10+1:1,page=Math.floor((start-1)/50)+1;
        if(page>9999)return response({status:'unavailable',error:'LEAGUE_RANK_OUT_OF_RANGE'},422);
        const [first,ownPage]=await Promise.all([
          official('leagues-classic/'+leagueId+'/standings/?page_standings=1',120000,2000000),
          page===1?official('leagues-classic/'+leagueId+'/standings/?page_standings=1',120000,2000000):
            official('leagues-classic/'+leagueId+'/standings/?page_standings='+page,120000,2000000)
        ]);
        const all=Array.isArray(ownPage.standings?.results)?ownPage.standings.results:[];
        const mine=all.find(r=>Number(r.entry)===Number(entryId))||null;
        const effectiveRank=numeric(mine?.rank)??claimed;
        // If source membership rank changed, do not claim that a different block contains the member.
        const rankMatch=effectiveRank===null||Math.floor((effectiveRank-1)/10)*10+1===start;
        const block=rankMatch?all.slice((start-1)%50,(start-1)%50+10):[];
        const leader=first?.standings?.results?.[0];
        const leaderPoints=Number(leader?.rank)===1?numeric(leader?.total):null;
        const ownPoints=numeric(mine?.total);
        league={
          id:Number(leagueId),name:member.name,rank:effectiveRank,
          block_start:start,block_end:start+Math.max(0,block.length-1),
          total_members:numeric(first?.league?.league_type==='x'?null:first?.standings?.results?.length)?null:null,
          rows:block.map(r=>({rank:numeric(r.rank),entry:Number(r.entry),name:r.entry_name,gw_points:numeric(r.event_total),total:numeric(r.total),last_rank:numeric(r.last_rank)})),
          leader_points:leaderPoints,gap_to_leader:leaderPoints!==null&&ownPoints!==null?Math.max(0,leaderPoints-ownPoints):null,
          coverage:rankMatch&&mine?'VERIFIED':'PARTIAL',pagination:{page,has_next:!!ownPage.standings?.has_next}
        };
      }
      return response({
        schema:'fpl_public_team_v1',status:rows.length===15?'READY':'PARTIAL',entry_id:Number(entryId),
        generated_at:new Date(at).toISOString(),current_public_gw:gw,
        team:{name:entry.name,manager:[entry.player_first_name,entry.player_last_name].filter(Boolean).join(' '),
          total_points:numeric(entry.summary_overall_points),overall_rank:numeric(entry.summary_overall_rank),
          squad:rows,bank:picks?numeric(picks.entry_history?.bank):null,
          squad_status:rows.length===15?'PUBLISHED':'UNAVAILABLE'},
        leagues:classic.map(l=>({id:Number(l.id),name:l.name,rank:numeric(l.entry_rank)})),
        selected_league:league,sources:{official:'OFFICIAL_FPL_PUBLIC',v6},
        optimizer:{v12:'NOT_CONNECTED_MULTI_USER',monte_carlo:'DISABLED',decision:'UNAVAILABLE',advice:null,
          reason:'Canonical V12 multi-user deterministic producer not connected; no fabricated A/B/C.'}
      },200,true);
    }catch(e){
      const busy=String(e.message)==='BACKPRESSURE';
      return response({status:'unavailable',error:busy?'BUSY_RETRY':'UPSTREAM_UNAVAILABLE',source:'OFFICIAL_FPL'},503);
    }
  }
  function metrics(){return {active,queued:queue.length,cache_entries:cache.size,inflight:pending.size,peak_active:peak,accepted_jobs:accepted,upstream_calls:upstreamCalls,max_active:maxActive};}
  async function handle(request){
    const path=new URL(request.url).pathname.replace(/\/$/,'');
    if(path==='/api/public-team/health')return request.method==='GET'?response({status:'READY',service:'public-multiuser',metrics:metrics()},200):response({error:'READ_ONLY'},405);
    if(path!=='/api/public-team')return null;
    return team(request);
  }
  return {handle,metrics};
}
const singleton=createPublicTeamBackend();
export const publicTeamResponse=request=>singleton.handle(request);
