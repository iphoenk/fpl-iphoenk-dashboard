import {test,expect} from '@playwright/test';
import {openOverview} from './harness.mjs';

const chip=page=>page.locator('.decision-plan .decision-v6');

test('Overview shows the V6 status from source.v6.status (frozen fixture is VERIFIED)',async({page})=>{
  await openOverview(page,{width:1100});
  await expect(chip(page)).toHaveCount(1);
  await expect(chip(page)).toHaveAttribute('data-v6-status','VERIFIED');
  await expect(chip(page)).toContainText('V6 data feed: Verified');
  await expect(chip(page)).not.toContainText('V12');
});

for(const status of ['STALE','UNVERIFIED','UNAVAILABLE']){
  test('Overview shows V6 '+status+' without implying readiness',async({page})=>{
    await openOverview(page,{width:1100,mock:{decisionPatch:d=>{d.source.v6={...d.source.v6,status};}}});
    await expect(chip(page)).toHaveAttribute('data-v6-status',status);
    await expect(chip(page)).toContainText(status[0]+status.slice(1).toLowerCase());
  });
}

test('a backend that omits v6 shows "Not reported", not Verified',async({page})=>{
  await openOverview(page,{width:1100,mock:{decisionPatch:d=>{delete d.source.v6;}}});
  await expect(chip(page)).toHaveAttribute('data-v6-status','NOT_REPORTED');
  await expect(chip(page)).toContainText('Not reported');
  await expect(chip(page)).not.toContainText('Verified');
});

for(const theme of ['light','dark'])for(const width of [393,768,1440]){
  test('V6 chip fits without horizontal overflow at '+width+'px '+theme,async({page})=>{
    await openOverview(page,{width,theme});
    const m=await page.evaluate(()=>{
      const row=document.querySelector('.decision-plan .decision-horizon'),c=document.querySelector('.decision-plan .decision-v6');
      const r=row.getBoundingClientRect(),k=c.getBoundingClientRect();
      return {rowRight:r.right,chipRight:k.right,chipLeft:k.left,docOverflow:document.documentElement.scrollWidth-window.innerWidth};
    });
    expect(m.chipRight).toBeLessThanOrEqual(m.rowRight+1);
    expect(m.chipLeft).toBeGreaterThanOrEqual(0);
    expect(m.docOverflow).toBeLessThanOrEqual(0);
  });
}
