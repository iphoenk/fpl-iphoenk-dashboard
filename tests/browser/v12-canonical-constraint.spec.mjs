import {test,expect} from '@playwright/test';
import {openOverview} from './harness.mjs';

// N5: what the dashboard shows if the backend ever returns the canonical V12 contract.
// Expected today: fail closed, no scenario numbers, no crash. The wording is a known gap (see docs/N5_V12_CONTRACT_COMPATIBILITY.md).
const canonical=d=>{
  d.contract='FPL_V12_CANONICAL_DECISION_V1';d.canonical_v12=true;d.model='canonical-v12';
  d.source={...d.source,provider:'Canonical V12 Decision Service',authority:'CANONICAL_V12',model_mode:'CANONICAL_V12_SERVICE'};
};

test('canonical_v12:true response: Overview fails closed (no plan, no crash) and the rest of Overview still renders',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openOverview(page,{width:1100,mock:{decisionPatch:canonical}});
  const card=page.locator('.decision-plan');
  await expect(card).toContainText('Failed to fetch data');
  await expect(card.locator('.decision-scenarios')).not.toContainText(/\d+[.,]\d+\s*xP/);
  await expect(card).not.toContainText(/→/);
  await expect(card).not.toContainText(/canonical v12 (ready|verified)/i);
  await expect(page.locator('.decision-pitch .pitch-row .player').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('canonical_v12:true response: Planning shows unavailable, never scenario numbers',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openOverview(page,{width:1100,mock:{decisionPatch:canonical}});
  await page.goto('/#planning');
  const root=page.locator('#view-planning');
  await expect(root).toContainText('Decision service unavailable');
  await expect(root.locator('.planning-kpis')).not.toContainText(/\d+\.\d+ xP/);
  expect(errors).toEqual([]);
});

test('public contract (control): the same fixture without the patch renders scenarios',async({page})=>{
  await openOverview(page,{width:1100});
  await expect(page.locator('.decision-plan .decision-scenario').first()).toBeVisible();
});
