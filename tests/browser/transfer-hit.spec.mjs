import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {mockApi,waitForStableLayout,ENTRY_ID} from './harness.mjs';

const fixture=name=>JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'fixtures',name),'utf8'));
/** The shared harness has no model snapshot, so no player has a projection. Build a minimal one from the frozen bootstrap. */
function snapshotFromBootstrap(){
  const b=fixture('bootstrap-static.json'),short=Object.fromEntries(b.teams.map(t=>[t.id,t.short_name]));
  const next=b.events.find(e=>e.is_next)?.id;
  const players=b.elements.map(e=>({id:e.id,name:e.web_name,team:short[e.team],projected:Math.round((Number(e.total_points)/8+Number(e.form||0)/2)*100)/100}));
  return {gw:next,generated:new Date().toISOString(),scouts:{},projections:{},players};
}
async function openOverview(page,{width}){
  await page.setViewportSize({width,height:1024});
  await page.emulateMedia({colorScheme:'light'});
  await mockApi(page);
  const snapshot=snapshotFromBootstrap();
  await page.route('**/api/insights/snapshot**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(snapshot)}));
  await page.addInitScript(id=>{try{localStorage.setItem('dugout-entry',JSON.stringify(id));}catch{}},ENTRY_ID);
  await page.goto('/#dashboard');
  await page.waitForFunction(()=>document.querySelectorAll('.decision-pitch .pitch-row .player').length>=11,null,{timeout:30000});
  await waitForStableLayout(page);
}

// GAP-01 (frozen fixtures, not live production evidence): the Transfers page must not hard-code a -4 hit,
// must label where the free-transfer count comes from, and must not treat a missing or invalid bank as zero.
async function openTransfers(page,width=393){
  await openOverview(page,{width});
  await page.evaluate(()=>document.querySelector('[data-view="transfers"]').click());
  await page.waitForSelector('#suggestionFt');
  await expect(page.locator('#transferSuggestions .transfer-net').first()).toHaveAttribute('data-ft-status','public-inferred',{timeout:15000});
}
const pairs=page=>page.locator('#transferSuggestions .adv-card.green');

test('free transfers come from public history, are labelled as inferred and no -4 is hard-coded',async({page})=>{
  await openTransfers(page);
  await expect(page.locator('#view-transfers')).not.toContainText('After −4');
  const first=page.locator('#transferSuggestions .transfer-net').first();
  await expect(first).toHaveAttribute('data-ft-status','public-inferred');
  await expect(first).toContainText('inferred from public history, not an authenticated account value');
  await expect(first).toContainText('Gross');
  await expect(first).toContainText('Net');
  await expect(page.locator('#transferSuggestions')).toContainText('BEFORE HITS');
  await expect(page.locator('#transferSuggestions')).toContainText('Affordability is indicative');
});

test('user-provided FT drives the hit: FT 0, 1, 2, 3 for a two-transfer pair',async({page})=>{
  await openTransfers(page);
  const expected={0:'Hit −8',1:'Hit −4',2:'Hit 0',3:'Hit 0'};
  for(const [ft,text] of Object.entries(expected)){
    await page.selectOption('#suggestionFt',ft);
    const note=pairs(page).first().locator('.transfer-net');
    await expect(note).toContainText(text);
    await expect(note).toHaveAttribute('data-ft-status','user');
    await expect(note).toContainText('user-provided');
  }
  await page.selectOption('#suggestionFt','');
  await expect(pairs(page).first().locator('.transfer-net')).toHaveAttribute('data-ft-status','public-inferred');
});

test('unknown FT shows conditional scenarios and no single net number',async({page})=>{
  await openTransfers(page);
  await page.route('**/api/decision**',route=>route.fulfill({status:429,contentType:'application/json',body:'{"error":"rate limited"}'}));
  await page.fill('#suggestionBank','1.4');
  await page.click('#recomputeTransfers');
  const note=pairs(page).first().locator('.transfer-net');
  await expect(note).toHaveAttribute('data-ft-status','unknown');
  await expect(note).toContainText('FT UNVERIFIED');
  await expect(note).toContainText('FT 0: net');
  await expect(note).toContainText('FT 2+: net');
  await expect(note.locator('strong')).toHaveCount(0);
});

test('missing, empty or negative bank is not treated as zero and offers nothing as affordable',async({page})=>{
  await openTransfers(page);
  for(const value of ['','-1']){
    await page.fill('#suggestionBank',value);
    await page.click('#recomputeTransfers');
    await expect(page.locator('#transferSuggestions [data-bank-status="invalid"]')).toBeVisible();
    await expect(page.locator('#transferSuggestions .adv-transfer')).toHaveCount(0);
    await expect(pairs(page)).toHaveCount(0);
  }
  await page.fill('#suggestionBank','1.4');
  await page.click('#recomputeTransfers');
  await expect(page.locator('#transferSuggestions [data-bank-status="invalid"]')).toHaveCount(0);
});

test('no horizontal overflow on the Transfers page at 393 and 1440',async({page})=>{
  for(const width of [393,1440]){
    await openTransfers(page,width);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'width '+width).toBeLessThanOrEqual(0);
  }
});
