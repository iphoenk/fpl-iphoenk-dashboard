import {test,expect} from '@playwright/test';
import {openOverview,measure} from './harness.mjs';
const routes=['dashboard','tim','liga','planning','transfers','chips','optimal','watchlist','labs','playercompare','fixtures','market','news','banding','accuracy','modelinsights','about'];
for(const width of [393,768,1440])for(const theme of ['light','dark'])test('all pages remain readable and contained at '+width+' '+theme,async({page})=>{
 test.setTimeout(180000);
 await openOverview(page,{width,theme});
 for(const route of routes){
  await page.goto('/#'+route);
  const root=page.locator('#view-'+route);await expect(root).toBeVisible();
  const failures=await root.evaluate(root=>{
   const errors=[];
   for(const n of root.querySelectorAll('p,.strategy-note,.help,.notice,th,td')){
    const r=n.getBoundingClientRect();if(!r.width||!r.height||!n.checkVisibility()||!n.textContent.trim())continue;
    if(parseFloat(getComputedStyle(n).fontSize)<13)errors.push(n.tagName+': '+n.textContent.trim().slice(0,45));
   }
   return errors.slice(0,8);
  });
  expect(failures,route+' text below 13px').toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth),route+' page overflow').toBeLessThanOrEqual(width+1);
 }
 await page.goto('/#dashboard');
 const m=await measure(page,['.decision-team','.decision-league','.decision-fixtures','.decision-plan']);
 const rs=Object.entries(m).filter(([,r])=>r);
 for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++){
  const a=rs[i][1],b=rs[j][1];expect(a.x<b.x+b.w-1&&b.x<a.x+a.w-1&&a.y<b.y+b.h-1&&b.y<a.y+a.h-1,rs[i][0]+' overlaps '+rs[j][0]).toBe(false);
 }
 const names=page.locator('.decision-pitch .player-name');
 for(let i=0;i<await names.count();i++)expect(await names.nth(i).evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBeGreaterThanOrEqual(12);
});
