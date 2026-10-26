/* Shared research filters and claim definitions for Scout, Market, News, Compare and Fixtures.
   Pure functions only: no I/O, no DOM. Unknown stays null, never 0. */
export const DEFAULT_RESEARCH_CONTEXT=Object.freeze({season:null,gwFrom:null,gwTo:null,position:null,minMinutes:0,metricMode:'points',totalOrPer90:'total',venue:'all',ownedOnly:false,watchlistOnly:false});
const RC_METRICS={
 xg:['expected_goals','expected_goals_per_90'],
 xa:['expected_assists','expected_assists_per_90'],
 xgi:['expected_goal_involvements','expected_goal_involvements_per_90'],
 defcon:['defensive_contribution','defensive_contribution_per_90'],
 points:['total_points',null]
};
const RC_VENUES=['all','home','away'],RC_MODES=['total','per90'];
const rcNum=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const rcInt=(v,lo,hi)=>{const n=rcNum(v);return n!==null&&Number.isInteger(n)&&n>=lo&&n<=hi?n:null;};
export function normalizeResearchContext(input={}){
 const d=DEFAULT_RESEARCH_CONTEXT,i=input||{};
 const from=rcInt(i.gwFrom,1,38),to=rcInt(i.gwTo,1,38),pair=from!==null&&to!==null&&from<=to;
 const min=rcNum(i.minMinutes);
 return {
  season:typeof i.season==='string'&&/^20\d{2}-\d{2}$/.test(i.season)?i.season:d.season,
  gwFrom:pair?from:null,gwTo:pair?to:null,
  position:rcInt(i.position,1,4)??d.position,
  minMinutes:min!==null&&min>=0&&min<=4000?Math.floor(min):d.minMinutes,
  metricMode:Object.hasOwn(RC_METRICS,i.metricMode)?i.metricMode:d.metricMode,
  totalOrPer90:RC_MODES.includes(i.totalOrPer90)?i.totalOrPer90:d.totalOrPer90,
  venue:RC_VENUES.includes(i.venue)?i.venue:d.venue,
  ownedOnly:i.ownedOnly===true,watchlistOnly:i.watchlistOnly===true
 };
}
/* Only non-default values are written, so the default context serializes to an empty query. */
export function serializeResearchContext(context){
 const c=normalizeResearchContext(context),d=DEFAULT_RESEARCH_CONTEXT,q=new URLSearchParams();
 if(c.season)q.set('season',c.season);
 if(c.gwFrom!==null){q.set('gwFrom',String(c.gwFrom));q.set('gwTo',String(c.gwTo));}
 if(c.position!==d.position)q.set('position',String(c.position));
 if(c.minMinutes!==d.minMinutes)q.set('minMinutes',String(c.minMinutes));
 if(c.metricMode!==d.metricMode)q.set('metric',c.metricMode);
 if(c.totalOrPer90!==d.totalOrPer90)q.set('mode',c.totalOrPer90);
 if(c.venue!==d.venue)q.set('venue',c.venue);
 if(c.ownedOnly)q.set('owned','1');
 if(c.watchlistOnly)q.set('watchlist','1');
 return q;
}
export function parseResearchContext(params){
 const q=params instanceof URLSearchParams?params:new URLSearchParams(params||'');
 return normalizeResearchContext({season:q.get('season'),gwFrom:q.get('gwFrom'),gwTo:q.get('gwTo'),position:q.get('position'),
  minMinutes:q.get('minMinutes'),metricMode:q.get('metric')??undefined,totalOrPer90:q.get('mode')??undefined,venue:q.get('venue')??undefined,
  ownedOnly:q.get('owned')==='1',watchlistOnly:q.get('watchlist')==='1'});
}
/* total: Official cumulative field. per90: Official per-90 field, only when minutes > 0. */
export function metricValue(player,metric,mode='total'){
 const fields=RC_METRICS[metric];if(!fields||!player)return null;
 if(mode==='total')return rcNum(player[fields[0]]);
 const minutes=rcNum(player.minutes);if(minutes===null||minutes<=0)return null;
 if(fields[1])return rcNum(player[fields[1]]);
 const total=rcNum(player[fields[0]]);return total===null?null:Math.round(total/minutes*9000)/100;
}
const RC_RUMOUR=/\b(could|may|might|doubt|doubtful|fears?|fear|rumou?rs?|reportedly|reports?|set to miss|likely to miss|expected to miss)\b/i;
/* confirmed: Official FPL status/news for the same player id. mention: article keyword only.
   rumour: hedged headline. none: no flag or the article does not name this exact player id/club. */
export function classifyInjuryClaim(article,player){
 const none={level:'none',source:null};
 if(!article?.injury_flag||!player)return none;
 const named=(article.players||[]).some(p=>p&&Number(p.element)===Number(player.id)&&(p.team==null||Number(p.team)===Number(player.team)));
 if(!named)return none;
 if(player.status&&player.status!=='a'&&String(player.news||'').trim())return {level:'confirmed',source:'Official FPL status'};
 return RC_RUMOUR.test(String(article.headline||''))?{level:'rumour',source:article.source||'Article'}:{level:'mention',source:article.source||'Article'};
}
