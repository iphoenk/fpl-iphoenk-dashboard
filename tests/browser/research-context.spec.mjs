import {test,expect} from '@playwright/test';
import {openOverview} from './harness.mjs';

// D07: Scout and Market share one ResearchContext (minutes, owned only, position), persisted in the URL query.
async function open(page,query=''){
  await openOverview(page,{width:1440});
  await page.goto('/'+query+'#labs');
  await page.waitForSelector('#labMaxPrice',{timeout:30000});
}
const goMarket=page=>page.evaluate(()=>document.querySelector('[data-view="market"]').click());
const poolRows=page=>page.locator('#view-labs table.bubble-table tbody tr').count();

test('URL query seeds shared Scout and Market filters',async({page})=>{
  await open(page,'?minMinutes=450&owned=1&position=3');
  await expect(page.locator('#labMinMinutes')).toHaveValue('450');
  await expect(page.locator('#labOwned')).toBeChecked();
  await expect(page.locator('[data-lab-pos="MID"]')).toHaveClass(/active/);
  await goMarket(page);
  await page.waitForSelector('#valueMinMinutes',{timeout:15000});
  await expect(page.locator('#valueMinMinutes')).toHaveValue('450');
  await expect(page.locator('#valueOwned')).toBeChecked();
  await expect(page.locator('#valuePosition')).toHaveValue('3');
});

test('changing a filter in Market updates the URL and Scout reads the same value',async({page})=>{
  await open(page);
  await expect(page.locator('#labMinMinutes')).toHaveValue('0');
  await goMarket(page);
  await page.waitForSelector('#valueMinMinutes');
  await page.fill('#valueMinMinutes','300');await page.locator('#valueMinMinutes').dispatchEvent('change');
  await expect.poll(()=>page.evaluate(()=>location.search)).toContain('minMinutes=300');
  await page.evaluate(()=>document.querySelector('[data-view="labs"]').click());
  await page.waitForSelector('#labMinMinutes');
  await expect(page.locator('#labMinMinutes')).toHaveValue('300');
});

test('an unreachable minutes threshold empties the Scout pool; invalid query values fall back safely',async({page})=>{
  await open(page,'?position=1');   // GK pool is built from the frozen bootstrap (no snapshot API in the harness)
  const before=await poolRows(page);
  expect(before).toBeGreaterThan(0);
  await page.fill('#labMinMinutes','3000');await page.locator('#labMinMinutes').dispatchEvent('change');
  await expect.poll(()=>poolRows(page)).toBe(0);
  await open(page,'?minMinutes=-5&position=1&venue=moon&owned=yes');
  await expect(page.locator('#labMinMinutes')).toHaveValue('0');
  await expect(page.locator('#labOwned')).not.toBeChecked();
  expect(await poolRows(page)).toBeGreaterThan(0);
});
