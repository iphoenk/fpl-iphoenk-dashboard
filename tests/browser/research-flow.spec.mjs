import {test,expect} from '@playwright/test';
import {openOverview} from './harness.mjs';

// D07 regression: Compare keeps 2..6 distinct players, rejects a 7th and duplicates, and Reset clears.
async function openCompare(page,width,mock={}){
  await openOverview(page,{width,mock});
  await page.evaluate(()=>document.querySelector('[data-view="playercompare"]').click());
  await page.waitForSelector('#comparePlayerSelect',{timeout:15000});
}
const chips=page=>page.locator('#view-playercompare [data-remove-compare]');

for(const width of [393,768,1440])test('compare list rules at '+width+'px',async({page})=>{
  await openCompare(page,width);
  const values=await page.locator('#comparePlayerSelect option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));
  expect(values.length).toBeGreaterThan(10);
  const add=async value=>{await page.selectOption('#comparePlayerSelect',value);await page.click('#addComparePlayer');};
  await add(values[0]);
  await add(values[0]);                       // duplicate is ignored
  expect(await chips(page).count()).toBe(1);
  for(const value of values.slice(1,6))await add(value);
  expect(await chips(page).count()).toBe(6);
  await expect(page.locator('#addComparePlayer')).toBeDisabled();   // seventh cannot be added
  expect(await chips(page).count()).toBe(6);
  await chips(page).first().click();
  expect(await chips(page).count()).toBe(5);
  await page.click('#resetComparePlayers');
  expect(await chips(page).count()).toBe(0);
  // page never overflows horizontally, even with six players on the narrowest viewport
  for(const value of values.slice(0,6))await add(value);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
});

test('compare shows an em dash, not 0, for a missing stat',async({page})=>{
  // Null out two stats for the first player (by id) before the app loads.
  let targetId=null;
  await openCompare(page,1440,{bootstrapPatch:data=>{const p=data.elements.find(e=>e.element_type===3&&Number(e.minutes)>0);targetId=p.id;p.expected_goals_per_90=null;p.minutes=null;}});
  const id=await page.evaluate(()=>document.querySelector('#comparePlayerSelect option:nth-child(2)').value);
  // Choose the patched player explicitly: its id is known after the patch ran.
  await page.selectOption('#comparePlayerSelect',String(targetId));await page.click('#addComparePlayer');
  const text=await page.locator('#view-playercompare .panel').first().innerText();
  expect(id).toBeTruthy();
  expect(text).toMatch(/xg per 90\s*—/i);
  expect(text).not.toMatch(/xg per 90\s*0[.,]00/i);
  expect(text).toMatch(/minutes\s*—/i);
});
