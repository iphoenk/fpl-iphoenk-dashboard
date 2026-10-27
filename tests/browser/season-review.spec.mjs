import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {openOverview,ENTRY_ID} from './harness.mjs';

// Season review (My Team). Frozen data: official history of the demo entry (GW1-8), picks and live points for GW1-8
// captured 2026-10-27. GW8 is NOT finished in the frozen bootstrap, so the review covers GW1-7 only.
// Expected numbers below were computed independently of the app code (Python, from the same fixture files).
const read=name=>JSON.parse(readFileSync(new URL('./fixtures/'+name,import.meta.url),'utf8'));
const capture=read('season-review-capture.json'),bootstrap=read('bootstrap-static.json');
const name=id=>bootstrap.elements.find(e=>e.id===id).web_name;
const MOST=411,SECOND=165;   // captained 4x (69 pts) and 2x (42 pts) through GW7

async function openReview(page,{width=1440,theme='light',failLive=[],failPicks=[],failHistory=false}={}){
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(String(e&&e.message||e)));
  page.on('request',r=>{const m=new URL(r.url()).pathname.match(/\/api\/(.*)$/);if(m)requests.push(m[1].replace(/\/$/,''));});
  await openOverview(page,{width,theme});
  await page.route('**/api/**',route=>{
    const key=new URL(route.request().url()).pathname.replace(/^\/api\//,'').replace(/\/$/,'');
    let m=key.match(/^entry\/(\d+)\/event\/(\d)\/picks$/);
    if(m&&Number(m[1])===ENTRY_ID&&Number(m[2])<=7){
      if(failPicks.includes(Number(m[2])))return route.fulfill({status:502,contentType:'application/json',body:'{"error":"upstream"}'});
      const [chip,picks]=capture.c[m[2]];
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({active_chip:chip,picks:picks.map(([element,position,multiplier,c,v])=>({element,position,multiplier,is_captain:!!c,is_vice_captain:!!v}))})});
    }
    m=key.match(/^event\/(\d)\/live$/);
    if(m&&Number(m[1])<=7){
      if(failLive.includes(Number(m[1])))return route.fulfill({status:502,contentType:'application/json',body:'{"error":"upstream"}'});
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements:capture.l[m[1]].map(([id,minutes,total_points])=>({id,stats:{minutes,total_points}}))})});
    }
    if(failHistory&&key===`entry/${ENTRY_ID}/history`)return route.fulfill({status:502,contentType:'application/json',body:'{"error":"upstream"}'});
    return route.fallback();
  });
  // The review lives in My Team; the harness opens the Overview first.
  await page.evaluate(()=>document.querySelector('[data-view="tim"]').click());
  await page.waitForSelector('#seasonReviewLoad',{state:'visible',timeout:30000});
  return {errors,requests};
}
const load=async page=>{await page.locator('#seasonReviewLoad').scrollIntoViewIfNeeded();await page.click('#seasonReviewLoad');await page.waitForSelector('#seasonReviewPanel .srui-grid',{timeout:30000});};
const review=page=>page.locator('#seasonReview');

test('before loading: only the load button, and no season requests are made',async({page})=>{
  const {requests}=await openReview(page);
  await expect(page.locator('#seasonReviewLoad')).toBeVisible();
  await expect(review(page)).toContainText('Provisional gameweeks are never counted');
  expect(requests.filter(r=>/event\/[1-7]\/(picks|live)$/.test(r)),'nothing is fetched before the user asks').toEqual([]);
});

test('loaded review shows independently computed numbers for finished gameweeks only',async({page})=>{
  const {errors,requests}=await openReview(page);
  await load(page);
  const r=review(page);
  await expect(r).toContainText('Through GW1–GW7.');
  await expect(r).toContainText('GW8 in progress: not counted.');
  // overview
  await expect(r).toContainText('1.1M');                               // current rank 1,149,078
  await expect(r).toContainText('Peak rank: 431.5K (GW4)');
  await expect(r).toContainText('477');                                // 497 gross - 20 transfer cost
  await expect(r).toContainText('Net of 20 transfer cost');
  await expect(r).toContainText('71.0 per GW gross');   // 497 / 7, one section-wide number format
  await expect(r).toContainText('2 up · 4 down');
  await expect(r).toContainText('6 above · 1 below');
  await expect(r).toContainText('Since peaking in GW4, your rank has dropped despite mostly above-average scoring.');
  // captain
  await expect(r).toContainText('113');                                // captain points
  await expect(r).toContainText('43%');                                // 3 of 7
  await expect(r).toContainText('3 / 7 gameweeks the best option');
  await expect(r).toContainText('77');                                 // missed, hindsight
  await expect(r).toContainText('190');                                // best-case, hindsight
  await expect(r.locator('.srui-gw').filter({hasText:'GW 3'})).toContainText('9 × 3 = 27');
  await expect(r.locator('.srui-gw').filter({hasText:'GW 3'})).toContainText('Triple Captain');
  await expect(r.locator('.srui-gw').filter({hasText:'GW 4'})).toContainText('Best option');
  await expect(r.locator('.srui-list li').first()).toContainText(name(MOST));
  await expect(r.locator('.srui-list li').first()).toContainText('69 pts');
  await expect(r.locator('.srui-list li').nth(1)).toContainText(name(SECOND));
  await expect(r.locator('.srui-list li').nth(1)).toContainText('42 pts');
  // value
  await expect(r).toContainText('£103.2m');
  await expect(r).toContainText('+£3.2m');
  await expect(r).toContainText('£1.4m');
  await expect(r).toContainText('Squad £101.8m');
  expect(errors).toEqual([]);
  // fetches: 7 finished gameweeks only, never GW8 picks/live beyond what the Overview itself requested
  expect(requests.filter(r=>/event\/[1-7]\/picks$/.test(r)).length).toBe(7);
});

test('hindsight is labelled and the best captain is never presented as advice',async({page})=>{
  await openReview(page);await load(page);
  const r=review(page);
  await expect(r).toContainText('Hindsight review');
  await expect(r).toContainText('not a recommendation');
  await expect(r).toContainText('Missed points · hindsight');
});

test('a gameweek whose live data fails makes the review partial and is not counted as zero',async({page})=>{
  await openReview(page,{failLive:[3]});
  await load(page);
  const r=review(page);
  await expect(r).toContainText('Partial: captain data is missing for GW3');
  await expect(r).toContainText('not counted as zero');
  await expect(r.locator('.srui-gw').filter({hasText:'GW 3'})).toHaveCount(0);
  await expect(r).toContainText('86');            // 113 - 27 (the Triple Captain gameweek is left out)
  await expect(r).toContainText('3 / 6 gameweeks the best option');   // GW4, GW5, GW7; the removed GW3 was a miss
  await expect(r).toContainText('74');            // missed: best-case 160 - 86
});

test('a failing history request shows an error with a retry, not an empty or zero review',async({page})=>{
  await openReview(page,{failHistory:true});
  await page.click('#seasonReviewLoad');
  await expect(review(page).locator('[role="alert"]')).toContainText('could not be loaded');
  await expect(page.locator('#seasonReviewLoad')).toHaveText('Try again');
});

for(const [width,height,label] of [[1440,900,'desktop'],[768,1024,'tablet'],[393,852,'mobile']])for(const theme of ['light','dark']){
  test(`${label} ${width}px ${theme}: review is readable, nothing overflows, charts are labelled, controls are 44px`,async({page})=>{
    const {errors}=await openReview(page,{width,theme});
    await load(page);
    const m=await page.evaluate(()=>{
      const root=document.getElementById('seasonReview');
      const clipped=[...root.querySelectorAll('.srui-card')].filter(c=>c.scrollWidth>c.clientWidth+1).length;
      const svgs=[...root.querySelectorAll('svg.srui-svg')];
      const small=[...root.querySelectorAll('button,summary,[tabindex="0"],a[href]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<44;}).map(e=>e.tagName+':'+Math.round(e.getBoundingClientRect().height));
      const bars=document.querySelector('.srui-scroll');
      return {pageOverflow:document.documentElement.scrollWidth-innerWidth,rootOverflow:root.scrollWidth-root.clientWidth,clipped,svgCount:svgs.length,unlabelled:svgs.filter(s=>!s.getAttribute('aria-label')).length,small,text:root.innerText,barsScrollable:bars?bars.scrollWidth>bars.clientWidth:null,cards:root.querySelectorAll('.srui-card').length,history:root.querySelectorAll('.srui-gw').length};
    });
    expect(m.pageOverflow,'page horizontal overflow').toBeLessThanOrEqual(1);
    expect(m.rootOverflow,'review overflow').toBeLessThanOrEqual(1);
    expect(m.clipped,'clipped stat cards').toBe(0);
    expect(m.svgCount).toBe(3);expect(m.unlabelled).toBe(0);
    expect(m.small,'controls under 44px').toEqual([]);
    expect(m.cards).toBe(12);expect(m.history).toBe(7);
    expect(m.text).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b(?! ?\()/);
    expect(errors).toEqual([]);
    // the data table is the accessible equivalent of the charts and opens by keyboard
    await page.locator('.srui-details summary').focus();await page.keyboard.press('Enter');
    await expect(page.locator('.srui-details table')).toBeVisible();
    await expect(page.locator('.srui-details tbody tr')).toHaveCount(7);
  });
}

test('keyboard: the load button is reachable with Tab and starts the review with Enter',async({page})=>{
  await openReview(page,{width:393});
  await page.locator('#seasonReviewLoad').focus();
  const focus=await page.evaluate(()=>{const s=getComputedStyle(document.activeElement);return {id:document.activeElement.id,visible:(s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0)||s.boxShadow!=='none'};});
  expect(focus).toEqual({id:'seasonReviewLoad',visible:true});
  await page.keyboard.press('Enter');
  await page.waitForSelector('#seasonReviewPanel .srui-grid',{timeout:30000});
});
