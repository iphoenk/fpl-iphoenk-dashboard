import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dir=path.join(path.dirname(fileURLToPath(import.meta.url)),'fixtures');
const read=name=>readFileSync(path.join(dir,name),'utf8');
export const ENTRY_ID=3462711;
export const LEAGUE_ID=16;
/** Frozen public FPL API responses (captured 2026-10-25, GW8). The browser tests never reach the live service. */
export async function mockApi(page,{failLeaguePage2=false,bootstrapPatch=null}={}){
  const json=body=>({status:200,contentType:'application/json',body});
  const routes={
    'bootstrap-static':'bootstrap-static.json','fixtures':'fixtures.json',
    ['entry/'+ENTRY_ID]:'entry.json',['entry/'+ENTRY_ID+'/event/8/picks']:'picks.json',
    'event/8/live':'live.json',['leagues-classic/'+LEAGUE_ID+'/standings']:'league-p1.json',
    'decision':'decision.json'
  };
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url());
    const key=url.pathname.replace(/^\/api\//,'').replace(/\/$/,'');
    // Full ICON+ league (anonymised, 58 members, 2 standings pages), picks for GW8 and rank history per member.
    const standings=key.match(/^leagues-classic\/9477\/standings$/);
    if(standings){
      const pageNumber=Number(url.searchParams.get('page_standings')||1);
      if(failLeaguePage2&&pageNumber===2)return route.fulfill({status:502,contentType:'application/json',body:'{"error":"upstream"}'});
      const league=JSON.parse(read('league-9477.json'));
      return route.fulfill(json(JSON.stringify(league.pages[pageNumber-1]||{error:'no page'})));
    }
    const memberPicks=key.match(/^entry\/(\d+)\/event\/8\/picks$/),memberHistory=key.match(/^entry\/(\d+)\/history$/);
    if(memberPicks&&Number(memberPicks[1])!==ENTRY_ID){
      const all=JSON.parse(read('league-9477-picks.json'));
      if(all[memberPicks[1]])return route.fulfill(json(JSON.stringify(all[memberPicks[1]])));
    }
    if(memberHistory){
      const all=JSON.parse(read('league-9477-history.json'));
      if(all[memberHistory[1]])return route.fulfill(json(JSON.stringify(all[memberHistory[1]])));
    }
    if(key==='bootstrap-static'&&bootstrapPatch){const data=JSON.parse(read('bootstrap-static.json'));bootstrapPatch(data);return route.fulfill(json(JSON.stringify(data)));}
    const file=routes[key];
    if(!file)return route.fulfill({status:404,contentType:'application/json',body:'{"error":"not mocked"}'});
    return route.fulfill(json(read(file)));
  });
}
/** Open the dashboard with a connected team, theme and sidebar state, and wait until the pitch has real players (not the loading state). */
export async function openOverview(page,{width,height=1024,theme='light',sidebarCollapsed=false,mock={}}){
  await page.setViewportSize({width,height});
  await page.emulateMedia({colorScheme:theme});
  await mockApi(page,mock);
  await page.addInitScript(({id,theme,sidebarCollapsed})=>{
    try{localStorage.setItem('dugout-entry',JSON.stringify(id));localStorage.setItem('fpl-iphoenk-theme',JSON.stringify(theme));localStorage.setItem('fpl-sidebar-collapsed',JSON.stringify(sidebarCollapsed));}catch{}
  },{id:ENTRY_ID,theme,sidebarCollapsed});
  // Upstream images/fonts may never complete; app readiness is the populated
  // pitch and stable geometry below, not an unrelated remote load event.
  await page.goto('/#dashboard',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('.decision-pitch .pitch-row .player').length>=11&&document.querySelectorAll('.decision-bench .player').length>=4,null,{timeout:30000});
  await waitForStableLayout(page);
}
/** Layout keeps settling after the first render (portraits, fixture rows). Wait until the Overview geometry is unchanged for three consecutive samples. */
export async function waitForStableLayout(page,{interval=250,stableSamples=3,timeout=15000}={}){
  await page.waitForFunction(({interval,stableSamples})=>new Promise(resolve=>{
    const sig=()=>['.decision-team','.decision-league','.decision-fixtures','.decision-plan'].map(s=>{const n=document.querySelector(s);if(!n)return 'x';const r=n.getBoundingClientRect();return [r.x,r.y+scrollY,r.width,r.height].map(Math.round).join(',')}).join('|')+'|'+document.documentElement.scrollHeight;
    let last=sig(),count=0;
    const t=setInterval(()=>{const now=sig();if(now===last)count++;else{count=0;last=now;}if(count>=stableSamples){clearInterval(t);resolve(true);}},interval);
  }),{interval,stableSamples},{timeout});
}
/** Measure several elements in one evaluate() so the rectangles come from the same frame. */
export function measure(page,selectors){
  return page.evaluate(sels=>Object.fromEntries(sels.map(s=>{const n=document.querySelector(s);if(!n)return [s,null];const r=n.getBoundingClientRect();return [s,{x:r.x,y:r.y,w:r.width,h:r.height,display:getComputedStyle(n).display}];})),selectors);
}
