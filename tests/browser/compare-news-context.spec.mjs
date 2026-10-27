import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {openOverview} from './harness.mjs';

// D07 (remaining): Compare and News use the shared ResearchContext (position, venue, GW window, minimum minutes, owned/watchlist).
const fixture=name=>JSON.parse(readFileSync(new URL('./fixtures/'+name,import.meta.url),'utf8'));
const bootstrap=fixture('bootstrap-static.json'),fixtures=fixture('fixtures.json'),OWN=new Set(fixture('picks.json').picks.map(p=>p.element));
const el=id=>bootstrap.elements.find(e=>e.id===id);
const RAYA=1,ARRIZABALAGA=2,JACKSON=166;   // GK 720 min, GK 0 min, FWD 547 min

async function open(page,query,hash,{articles=null,watch=[]}={}){
  await openOverview(page,{width:1440});
  await page.addInitScript(list=>{try{localStorage.setItem('dugout-watch',JSON.stringify(list));}catch{}},watch);
  if(articles)await page.route('**/api/model/news',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({articles})}));
  await page.goto('/'+(query||'?fresh=1')+hash);
}
const art=(headline,players)=>({headline,date:'2026-10-25',url:'https://example.test/'+encodeURIComponent(headline),sentiment:0,injury_flag:false,players:players.map(id=>({element:id,web_name:el(id).web_name}))});
async function addToCompare(page,ids){
  for(const id of ids){await page.selectOption('#comparePlayerSelect',String(id));await page.click('#addComparePlayer');}
}
const fmt2=v=>v.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}); // same locale as the app's fmt()
const avgFdr=(teamId,from,to,venue)=>{
  const d=fixtures.filter(f=>f.event>=from&&f.event<=to&&(f.team_h===teamId||f.team_a===teamId)).filter(f=>venue==='home'?f.team_h===teamId:venue==='away'?f.team_a===teamId:true).map(f=>f.team_h===teamId?f.team_h_difficulty:f.team_a_difficulty);
  return d.length?d.reduce((a,b)=>a+b,0)/d.length:null;
};

test('preconditions: the fixture data has what the assertions rely on',()=>{
  expect(el(RAYA).element_type).toBe(1);expect(el(ARRIZABALAGA).minutes).toBe(0);expect(el(JACKSON).element_type).toBe(4);
  expect(avgFdr(el(JACKSON).team,9,10,'home')).not.toBeNull();
});

test('News: a position in the URL limits the official status cards to that position',async({page})=>{
  await open(page,'?position=1','#news');
  await page.waitForSelector('#newsPosition',{timeout:30000});
  await expect(page.locator('#newsPosition')).toHaveValue('1');
  const expected=bootstrap.elements.filter(e=>e.element_type===1&&(e.news||e.status!=='a')).length;
  expect(expected).toBeGreaterThan(0);
  await expect(page.locator('#view-news .adv-grid .adv-card[class*="adv-card"]').filter({hasText:/FPL API|Updated/})).toHaveCount(expected);
});

test('News: choosing a position in the control updates the URL and the list; "All" clears it',async({page})=>{
  await open(page,'','#news');
  await page.waitForSelector('#newsPosition',{timeout:30000});
  const all=await page.locator('#view-news .adv-card').filter({hasText:/FPL API|Updated/}).count();
  await page.selectOption('#newsPosition','4');
  await expect.poll(()=>page.evaluate(()=>location.search)).toContain('position=4');
  const fwd=await page.locator('#view-news .adv-card').filter({hasText:/FPL API|Updated/}).count();
  expect(fwd).toBeGreaterThan(0);expect(fwd).toBeLessThan(all);
  await page.selectOption('#newsPosition','');
  await expect.poll(()=>page.evaluate(()=>location.search)).not.toContain('position=');
});

test('News articles: position filter keeps articles naming a player of that position and discloses hidden ones without a named player',async({page})=>{
  const articles=[art('Raya returns to training',[RAYA]),art('Jackson doubtful',[JACKSON]),art('Club statement on the schedule',[])];
  await open(page,'?position=1','#news',{articles});
  await page.waitForSelector('#liveNews .adv-card',{timeout:30000});
  const live=page.locator('#liveNews');
  await expect(live).toContainText('Raya returns to training');
  await expect(live).not.toContainText('Jackson doubtful');
  await expect(live).not.toContainText('Club statement on the schedule');
  await expect(live).toContainText('1 article without a named player is hidden while a position is selected');
});

test('News articles: without a position nothing is hidden and no notice is shown',async({page})=>{
  const articles=[art('Raya returns to training',[RAYA]),art('Jackson doubtful',[JACKSON]),art('Club statement on the schedule',[])];
  await open(page,'','#news',{articles});
  await page.waitForSelector('#liveNews .adv-card',{timeout:30000});
  await expect(page.locator('#liveNews .adv-card')).toHaveCount(3);
  await expect(page.locator('#liveNews')).not.toContainText('without a named player');
});

test('Compare: the add-player list follows the shared position',async({page})=>{
  await open(page,'?position=1','#playercompare');
  await page.waitForSelector('#comparePlayerSelect',{timeout:30000});
  const values=await page.locator('#comparePlayerSelect option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean).map(Number));
  expect(values.length).toBeGreaterThan(10);
  expect(values.every(id=>bootstrap.elements.find(e=>e.id===id).element_type===1)).toBe(true);
});

test('Compare: watchlist-only limits the add-player list to watched players',async({page})=>{
  await open(page,'?watchlist=1','#playercompare',{watch:[RAYA,JACKSON]});
  await page.waitForSelector('#comparePlayerSelect',{timeout:30000});
  const values=await page.locator('#comparePlayerSelect option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean).map(Number));
  expect(values.sort((a,b)=>a-b)).toEqual([RAYA,JACKSON]);
});

test('Compare: average fixture difficulty uses the shared GW window and venue',async({page})=>{
  await open(page,'?gwFrom=9&gwTo=10&venue=home','#playercompare');
  await page.waitForSelector('#comparePlayerSelect',{timeout:30000});
  await addToCompare(page,[RAYA,JACKSON]);
  await expect(page.locator('#compareContext')).toContainText('GW 9–10');
  await expect(page.locator('#compareContext')).toContainText('home only');
  const cells=await page.locator('#view-playercompare tr:has(th:text-is("Avg FDR")) td').allInnerTexts();
  const expected=[RAYA,JACKSON].map(id=>{const v=avgFdr(el(id).team,9,10,'home');return v===null?'—':fmt2(v);});
  expect(cells.map(s=>s.trim())).toEqual(expected);
});

test('Compare: a window with no fixture for the chosen venue shows a dash, never 0',async({page})=>{
  // Find a goalkeeper whose club has no HOME fixture in GW9 (away or blank), so the average is unknown.
  const gk=bootstrap.elements.find(e=>e.element_type===1&&e.minutes>0&&avgFdr(e.team,9,9,'home')===null);
  expect(gk,'fixture data must contain a club without a home game in GW9').toBeTruthy();
  await open(page,'?gwFrom=9&gwTo=9&venue=home','#playercompare');
  await page.waitForSelector('#comparePlayerSelect',{timeout:30000});
  await addToCompare(page,[gk.id]);
  const cell=(await page.locator('#view-playercompare tr:has(th:text-is("Avg FDR")) td').first().innerText()).trim();
  expect(cell).toBe('—');
});

test('Compare: players under the shared minimum minutes are flagged, not removed',async({page})=>{
  await open(page,'?minMinutes=500','#playercompare');
  await page.waitForSelector('#comparePlayerSelect',{timeout:30000});
  await addToCompare(page,[RAYA,ARRIZABALAGA]);
  await expect(page.locator('#view-playercompare .compare-player-head')).toHaveCount(2);
  const heads=page.locator('#view-playercompare .compare-player-head');
  await expect(heads.nth(0)).not.toContainText('Below minimum minutes');
  await expect(heads.nth(1)).toContainText('Below minimum minutes (500)');
});

test('Compare: changing venue in the page updates the shared URL and the table',async({page})=>{
  await open(page,'?gwFrom=9&gwTo=10','#playercompare');
  await page.waitForSelector('#comparePlayerSelect',{timeout:30000});
  await addToCompare(page,[JACKSON]);
  await page.selectOption('#compareVenue','away');
  await expect.poll(()=>page.evaluate(()=>location.search)).toContain('venue=away');
  const cell=(await page.locator('#view-playercompare tr:has(th:text-is("Avg FDR")) td').first().innerText()).trim();
  const v=avgFdr(el(JACKSON).team,9,10,'away');
  expect(cell).toBe(v===null?'—':fmt2(v));
});
