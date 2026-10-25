import {test,expect} from '@playwright/test';
import {openOverview,measure} from './harness.mjs';

const WIDTHS=[393,767,768,820,900,960,961,1024,1099,1100,1440];
const THEMES=['light','dark'];
const box=el=>el.evaluate(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,display:getComputedStyle(n).display}});
const intersects=(a,b)=>a.x<b.x+b.w-0.5&&b.x<a.x+a.w-0.5&&a.y<b.y+b.h-0.5&&b.y<a.y+a.h-0.5;

for(const width of WIDTHS)for(const theme of THEMES){
  test('overview pitch usable at '+width+'px '+theme,async({page})=>{
    await openOverview(page,{width,theme});
    expect(await page.evaluate(()=>window.innerWidth)).toBe(width);

    // Pitch keeps a usable width (single-column tablet/phone) and shows all 15 players.
    const pitch=await box(page.locator('.decision-pitch').first());
    expect(pitch.w,'pitch wrapper width').toBeGreaterThan(250);
    const surface=await box(page.locator('.decision-pitch .pitch').first());
    expect(surface.w,'pitch surface width').toBeGreaterThan(250);
    expect(await page.locator('.decision-pitch .pitch-row .player').count()).toBe(11);
    expect(await page.locator('.decision-bench .player').count()).toBe(4);

    // Panels never overlap (all rectangles sampled in the same frame).
    const names=['.decision-team','.decision-league','.decision-fixtures','.decision-plan'];
    const m=await measure(page,names);
    const rects=names.filter(n=>m[n]).map(n=>[n,{...m[n],y:m[n].y}]);
    for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
      expect(intersects(rects[i][1],rects[j][1]),rects[i][0]+' overlaps '+rects[j][0]).toBe(false);
    }

    // Stacked tablet layout (768-960): panels fill the column; no dead strip beside Fixtures.
    if(width>=768&&width<=960&&m['.decision-fixtures']&&m['.decision-team']){
      expect(Math.abs(m['.decision-fixtures'].w-m['.decision-team'].w),'fixtures width equals team width').toBeLessThanOrEqual(2);
    }

    // No page-level horizontal overflow; captain, vice-captain and every bench player reachable.
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
    for(const sel of ['.decision-pitch .cap:not(.cap-vice)','.decision-pitch .cap-vice']){
      const loc=page.locator(sel).first();await loc.scrollIntoViewIfNeeded();
      const b=await box(loc);
      expect(b.w,sel+' visible').toBeGreaterThan(0);
      expect(b.x,sel+' inside viewport').toBeGreaterThanOrEqual(0);
      expect(b.x+b.w,sel+' inside viewport').toBeLessThanOrEqual(width+1);
    }
    const bench=page.locator('.decision-bench .player');
    for(let i=0;i<4;i++){
      await bench.nth(i).scrollIntoViewIfNeeded();
      const b=await box(bench.nth(i));
      expect(b.w,'bench '+i+' width').toBeGreaterThan(20);
      expect(b.x+b.w,'bench '+i+' inside viewport').toBeLessThanOrEqual(width+1);
    }
  });
}

test('collapsed sidebar does not break the 768px pitch',async({page})=>{
  await openOverview(page,{width:768,sidebarCollapsed:true});
  expect((await box(page.locator('.decision-pitch').first())).w).toBeGreaterThan(250);
});
