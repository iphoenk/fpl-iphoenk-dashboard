import {test,expect} from '@playwright/test';
import {openOverview} from './harness.mjs';

// D07: on mobile Compare shows two players at a time with an accessible rail; desktop keeps every column.
async function openCompare(page,width){
  await openOverview(page,{width});
  await page.evaluate(()=>document.querySelector('[data-view="playercompare"]').click());
  await page.waitForSelector('#comparePlayerSelect',{timeout:15000});
}
async function addPlayers(page,count){
  const values=await page.locator('#comparePlayerSelect option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));
  for(const value of values.slice(0,count)){await page.selectOption('#comparePlayerSelect',value);await page.click('#addComparePlayer');}
}
const visibleHeads=page=>page.locator('#view-playercompare table thead th:not(:first-child)').evaluateAll(n=>n.filter(e=>e.getBoundingClientRect().width>0).map(e=>e.textContent));
const allHeads=page=>page.locator('#view-playercompare table thead th:not(:first-child)').evaluateAll(n=>n.map(e=>e.textContent));

test('mobile: two players visible by default, rail pages through the rest',async({page})=>{
  await openCompare(page,393);
  await addPlayers(page,5);
  const all=await allHeads(page);expect(all.length).toBe(5);
  expect(await visibleHeads(page)).toEqual(all.slice(0,2));
  const status=page.locator('#compareRailStatus');
  await expect(status).toHaveText(/Showing 1.2 of 5/);
  await expect(page.locator('#compareRailPrev')).toBeDisabled();
  await page.click('#compareRailNext');
  expect(await visibleHeads(page)).toEqual(all.slice(1,3));
  await page.click('#compareRailNext');await page.click('#compareRailNext');
  expect(await visibleHeads(page)).toEqual(all.slice(3,5));
  await expect(page.locator('#compareRailNext')).toBeDisabled();
  await expect(status).toHaveText(/Showing 4.5 of 5/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(394);
});

test('mobile rail is keyboard operable, announced politely and has 44px targets',async({page})=>{
  await openCompare(page,393);
  await addPlayers(page,3);
  await expect(page.locator('#compareRailStatus')).toHaveAttribute('aria-live','polite');
  for(const id of ['#compareRailPrev','#compareRailNext']){
    const box=await page.locator(id).boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);expect(box.width).toBeGreaterThanOrEqual(44);
  }
  await page.focus('#compareRailNext');await page.keyboard.press('Enter');
  await expect(page.locator('#compareRailStatus')).toHaveText(/Showing 2.3 of 3/);
});

test('removing and resetting keep the rail window valid',async({page})=>{
  await openCompare(page,393);
  await addPlayers(page,4);
  await page.click('#compareRailNext');await page.click('#compareRailNext');
  await expect(page.locator('#compareRailStatus')).toHaveText(/Showing 3.4 of 4/);
  await page.locator('#view-playercompare [data-remove-compare]').nth(3).evaluate(b=>b.click());
  await expect(page.locator('#compareRailStatus')).toHaveText(/Showing 2.3 of 3/);
  await page.click('#resetComparePlayers');
  await expect(page.locator('#compareRail')).toHaveCount(0);
});

test('desktop keeps every column and hides the rail; two players need no rail on mobile',async({page})=>{
  await openCompare(page,1440);
  await addPlayers(page,4);
  expect((await visibleHeads(page)).length).toBe(4);
  await expect(page.locator('#compareRail')).toBeHidden();
  await openCompare(page,393);
  await page.click('#resetComparePlayers');
  await addPlayers(page,2);
  expect((await visibleHeads(page)).length).toBe(2);
  await expect(page.locator('#compareRail')).toHaveCount(0);
});
