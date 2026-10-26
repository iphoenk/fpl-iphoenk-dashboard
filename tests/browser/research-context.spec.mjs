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

// D07: Fixtures honours the shared range, venue and owned-only filters.
async function openFixtures(page,query=''){
  await openOverview(page,{width:1440});
  await page.goto('/'+query+'#fixtures');
  await page.waitForSelector('table.adv-fixture-table',{timeout:30000});
}
const headers=page=>page.locator('table.adv-fixture-table thead th').allInnerTexts();

test('Fixtures: explicit GW range and home venue from the URL',async({page})=>{
  await openFixtures(page,'?gwFrom=9&gwTo=10&venue=home');
  expect((await headers(page)).filter(t=>/^GW\d+$/.test(t))).toEqual(['GW9','GW10']);
  await expect(page.locator('#fixtureGwFrom')).toHaveValue('9');
  await expect(page.locator('#fixtureVenue')).toHaveValue('home');
  const tags=await page.locator('table.adv-fixture-table tbody .heat small').allInnerTexts();
  expect(tags.length).toBeGreaterThan(5);
  expect(tags.every(t=>/· H$/.test(t))).toBe(true);
});

test('Fixtures: owned-only keeps only clubs with owned players; changing the range updates the URL',async({page})=>{
  await openFixtures(page,'?owned=1');
  const owned=await page.locator('table.adv-fixture-table tbody tr td:nth-child(2)').allInnerTexts();
  expect(owned.length).toBeGreaterThan(0);expect(owned.length).toBeLessThan(20);
  expect(owned.every(t=>Number(t)>0)).toBe(true);
  await page.fill('#fixtureGwFrom','11');await page.fill('#fixtureGwTo','12');
  await page.locator('#fixtureGwTo').dispatchEvent('change');
  await expect.poll(()=>page.evaluate(()=>location.search)).toContain('gwFrom=11');
  expect((await headers(page)).filter(t=>/^GW\d+$/.test(t))).toEqual(['GW11','GW12']);
});

test('Fixtures: default view unchanged (horizon from next GW, all venues)',async({page})=>{
  await openFixtures(page);
  const gws=(await headers(page)).filter(t=>/^GW\d+$/.test(t));
  expect(gws.length).toBe(6);
  await expect(page.locator('#fixtureVenue')).toHaveValue('all');
});
