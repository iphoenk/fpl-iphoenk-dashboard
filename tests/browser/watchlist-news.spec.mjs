import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {openOverview} from './harness.mjs';

// D07: watchlist-only filter across Scout/Market/Fixtures and squad-first, filterable News.
const fixture=name=>JSON.parse(readFileSync(new URL('./fixtures/'+name,import.meta.url),'utf8'));
const OWN=new Set(fixture('picks.json').picks.map(p=>p.element));
const bootstrap=fixture('bootstrap-static.json');
const byId=id=>bootstrap.elements.find(e=>e.id===id);
const GK_WATCH=1;                  // Raya: goalkeeper, not in the frozen squad
const WATCH=[GK_WATCH,166];        // Raya and N.Jackson (neither owned)
const OWNED_ARTICLE=[...OWN][0];

async function open(page,query,hash,{watch=WATCH,articles=null}={}){
  await openOverview(page,{width:1440});
  await page.addInitScript(list=>{try{localStorage.setItem('dugout-watch',JSON.stringify(list));}catch{}},watch);
  if(articles)await page.route('**/api/model/news',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({articles})}));
  // A hash-only change would not reload the page, so the watchlist init script would not run.
  await page.goto('/'+(query||'?fresh=1')+hash);
}
const art=(headline,element,web_name)=>({headline,date:'2026-10-25',url:'https://example.test/'+encodeURIComponent(headline),sentiment:0,injury_flag:false,players:[{element,web_name}]});

test('preconditions: the watched players are not in the frozen squad',()=>{
  for(const id of WATCH)expect(OWN.has(id)).toBe(false);
  expect(byId(GK_WATCH).element_type).toBe(1);
});

test('Scout GK pool with watchlist-only shows only the watched goalkeeper',async({page})=>{
  await open(page,'?watchlist=1&position=1','#labs');
  await page.waitForSelector('#labMinMinutes',{timeout:30000});
  await expect(page.locator('#labWatch')).toBeChecked();
  const rows=page.locator('#view-labs table.bubble-table tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(byId(GK_WATCH).web_name);
});

test('Market Transfers: watchlist-only lists exactly the watched players; with owned-only it is the union',async({page})=>{
  await open(page,'?market=transfers&watchlist=1','#market');
  await page.waitForSelector('#valueWatch',{timeout:30000});
  await expect(page.locator('#view-market table tbody tr')).toHaveCount(WATCH.length);
  await open(page,'?market=transfers&watchlist=1&owned=1','#market');
  await page.waitForSelector('#valueWatch',{timeout:30000});
  await expect(page.locator('#view-market table tbody tr')).toHaveCount(15+WATCH.length);
});

test('Fixtures: watchlist-only keeps only clubs of watched players',async({page})=>{
  await open(page,'?watchlist=1','#fixtures');
  await page.waitForSelector('table.adv-fixture-table',{timeout:30000});
  const teams=new Set(WATCH.map(id=>byId(id).team));
  await expect(page.locator('table.adv-fixture-table tbody tr')).toHaveCount(teams.size);
  await expect(page.locator('#fixtureWatch')).toBeChecked();
});

test('News: articles are squad first, then watchlist, with badges; filters narrow them',async({page})=>{
  const articles=[art('Unrelated story',999,'Nobody'),art('Watch story',166,'N.Jackson'),art('Squad story',OWNED_ARTICLE,byId(OWNED_ARTICLE).web_name)];
  await open(page,'','#news',{articles});
  await page.waitForSelector('#liveNews .adv-card h3',{timeout:30000});
  const heads=()=>page.locator('#liveNews .adv-card h3').allInnerTexts();
  expect((await heads()).map(t=>t.replace(/\s*↗$/,''))).toEqual(['Squad story','Watch story','Unrelated story']);
  await expect(page.locator('#liveNews .adv-card').first()).toContainText('Squad');
  await expect(page.locator('#liveNews .adv-card').nth(1)).toContainText('Watchlist');
  await open(page,'?owned=1','#news',{articles});
  await page.waitForSelector('#liveNews .adv-card h3',{timeout:30000});
  expect((await heads()).map(t=>t.replace(/\s*↗$/,''))).toEqual(['Squad story']);
  await open(page,'?watchlist=1','#news',{articles});
  await page.waitForSelector('#liveNews .adv-card h3',{timeout:30000});
  expect((await heads()).map(t=>t.replace(/\s*↗$/,''))).toEqual(['Watch story']);
});

test('News fitness cards follow the same filters',async({page})=>{
  await open(page,'?owned=1','#news');
  await page.waitForSelector('#view-news .adv-grid .adv-card',{timeout:30000});
  const cards=page.locator('#view-news .adv-grid .adv-card');
  const n=await cards.count();
  expect(n).toBeGreaterThan(0);
  for(let i=0;i<n;i++)await expect(cards.nth(i)).toContainText('In your squad');
});
