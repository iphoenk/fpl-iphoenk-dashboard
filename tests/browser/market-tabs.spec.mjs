import {test,expect} from '@playwright/test';
import {openOverview} from './harness.mjs';

// D07: Market is split into Prices / Transfers / Value tabs; filters are shared; prediction and actual price changes are separate.
async function openMarket(page,query='',width=1440){
  await openOverview(page,{width});
  await page.goto('/'+query+'#market');
  await page.waitForSelector('[role="tablist"][aria-label="Market sections"]',{timeout:30000});
}
const tab=(page,name)=>page.getByRole('tab',{name});

test('three tabs, Prices selected by default, only its panels rendered',async({page})=>{
  await openMarket(page);
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(tab(page,'Prices')).toHaveAttribute('aria-selected','true');
  await expect(tab(page,'Transfers')).toHaveAttribute('aria-selected','false');
  await expect(page.locator('#view-market').getByText('Price watch')).toBeVisible();
  await expect(page.locator('#view-market').getByText('Actual price changes')).toBeVisible();
  await expect(page.locator('#view-market').getByText('Transfer momentum')).toHaveCount(0);
  await expect(page.locator('#valueY')).toHaveCount(0);
});

test('prediction and actual changes are separated with provider, method and as-of labels',async({page})=>{
  await openMarket(page);
  const prediction=page.locator('#view-market [data-market-source="prediction"]');
  const actual=page.locator('#view-market [data-market-source="actual"]');
  await expect(prediction).toContainText('Provider');await expect(prediction).toContainText('Method');await expect(prediction).toContainText('As of');
  await expect(prediction).toContainText('not a probability');
  await expect(actual).toContainText('Official FPL API');
  const changes=await actual.locator('tbody tr td:last-child').allInnerTexts();
  expect(changes.length).toBeGreaterThan(0);
  expect(changes.every(t=>/^[+−]£\d+\.\d$/.test(t.trim()))).toBe(true);
});

test('switching tabs updates the URL; the URL selects a tab on load',async({page})=>{
  await openMarket(page);
  await tab(page,'Transfers').click();
  await expect.poll(()=>page.evaluate(()=>location.search)).toContain('market=transfers');
  await expect(page.locator('#view-market').getByText('Transfer momentum')).toBeVisible();
  await expect(page.locator('#view-market').getByText('Price watch')).toHaveCount(0);
  await openMarket(page,'?market=value');
  await expect(tab(page,'Value')).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#valueY')).toHaveCount(1);
  await openMarket(page,'?market=nonsense');
  await expect(tab(page,'Prices')).toHaveAttribute('aria-selected','true');
});

test('tabs follow the arrow-key pattern with roving tabindex',async({page})=>{
  await openMarket(page);
  await tab(page,'Prices').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page,'Transfers')).toHaveAttribute('aria-selected','true');
  await expect(tab(page,'Transfers')).toBeFocused();
  await expect(tab(page,'Prices')).toHaveAttribute('tabindex','-1');
  await page.keyboard.press('End');
  await expect(tab(page,'Value')).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('ArrowRight');
  await expect(tab(page,'Prices')).toHaveAttribute('aria-selected','true');
});

test('shared filters apply to every tab: owned-only limits Transfers to the squad, position narrows further',async({page})=>{
  await openMarket(page,'?market=transfers');
  const all=await page.locator('#view-market table tbody tr').count();
  expect(all).toBeGreaterThan(15);
  await openMarket(page,'?market=transfers&owned=1');
  const owned=await page.locator('#view-market table tbody tr').count();
  expect(owned).toBeGreaterThan(0);expect(owned).toBeLessThanOrEqual(15);
  await openMarket(page,'?market=transfers&owned=1&position=1');
  const keepers=await page.locator('#view-market table tbody tr').count();
  expect(keepers).toBeGreaterThan(0);expect(keepers).toBeLessThanOrEqual(2);
  await expect(page.locator('#valueMinMinutes')).toHaveValue('0');
});

test('mobile: tabs fit 393px without horizontal overflow and keep 44px targets',async({page})=>{
  await openMarket(page,'',393);
  for(const name of ['Prices','Transfers','Value']){
    const box=await tab(page,name).boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);
  }
  for(const name of ['Transfers','Value','Prices']){await tab(page,name).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(394);}
});
