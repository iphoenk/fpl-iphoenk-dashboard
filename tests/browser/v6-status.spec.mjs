import {test,expect} from '@playwright/test';
import {openOverview} from './harness.mjs';

const chip=page=>page.locator('.decision-plan .decision-foot .decision-v6');

test('Overview shows V6 VERIFIED from source.v6.status with observed time (frozen fixture)',async({page})=>{
  await openOverview(page,{width:1100});
  await expect(chip(page)).toHaveCount(1);
  await expect(chip(page)).toHaveAttribute('data-v6-status','VERIFIED');
  await expect(chip(page)).toContainText('Verified');
  await expect(chip(page)).toContainText('2026');
  await expect(chip(page)).not.toContainText('V12');
});

for(const status of ['STALE','UNVERIFIED','UNAVAILABLE']){
  test('Overview shows V6 '+status+' without implying readiness',async({page})=>{
    await openOverview(page,{width:1100,mock:{decisionPatch:d=>{d.source.v6={...d.source.v6,status};}}});
    await expect(chip(page)).toHaveAttribute('data-v6-status',status);
    await expect(chip(page)).toContainText(status[0]+status.slice(1).toLowerCase());
  });
}

test('a backend that omits v6 shows "Not reported" explicitly, never Verified and never a timestamp',async({page})=>{
  await openOverview(page,{width:1100,mock:{decisionPatch:d=>{delete d.source.v6;}}});
  await expect(chip(page)).toHaveAttribute('data-v6-status','NOT_REPORTED');
  await expect(chip(page)).toContainText('Not reported');
  await expect(chip(page)).not.toContainText('Verified');
  await expect(chip(page)).not.toContainText('2026');
});

test('every V6 state differs by glyph and border style, not by colour alone',async({browser})=>{
  const seen={};
  for(const status of ['VERIFIED','STALE','UNVERIFIED','UNAVAILABLE',null]){
    const context=await browser.newContext(),page=await context.newPage();
    await openOverview(page,{width:1100,mock:{decisionPatch:d=>{if(status===null)delete d.source.v6;else d.source.v6={...d.source.v6,status};}}});
    seen[status]=await chip(page).evaluate(el=>({glyph:el.querySelector('i').textContent,style:getComputedStyle(el).borderTopStyle+getComputedStyle(el).borderTopWidth}));
    await context.close();
  }
  expect(new Set(Object.values(seen).map(v=>v.glyph)).size).toBe(5);
  expect(new Set(Object.values(seen).map(v=>v.style)).size).toBeGreaterThanOrEqual(4);
});

for(const theme of ['light','dark'])for(const width of [393,768,1440])for(const status of ['VERIFIED','UNAVAILABLE',null]){
  test('V6 chip fits without horizontal overflow at '+width+'px '+theme+' ('+(status||'not reported')+')',async({page})=>{
    await openOverview(page,{width,theme,mock:{decisionPatch:d=>{if(status===null)delete d.source.v6;else d.source.v6={...d.source.v6,status};}}});
    const m=await page.evaluate(()=>{
      const foot=document.querySelector('.decision-plan .decision-foot'),c=foot.querySelector('.decision-v6');
      const r=foot.getBoundingClientRect(),k=c.getBoundingClientRect();
      return {footRight:r.right,chipRight:k.right,chipLeft:k.left,docOverflow:document.documentElement.scrollWidth-window.innerWidth};
    });
    expect(m.chipRight).toBeLessThanOrEqual(m.footRight+1);
    expect(m.chipLeft).toBeGreaterThanOrEqual(0);
    expect(m.docOverflow).toBeLessThanOrEqual(0);
  });
}

for(const theme of ['light','dark'])for(const width of [320,393]){
  test('V6 chip text meets WCAG AA contrast (4.5:1) at '+width+'px '+theme,async({page})=>{
    await openOverview(page,{width,theme});
    const ratio=await chip(page).evaluate(el=>{
      const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
      const lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4});return 0.2126*r+0.7152*g+0.0722*b};
      let bg=el;while(bg){const c=getComputedStyle(bg).backgroundColor,p=(c.match(/[\d.]+/g)||[]).map(Number);if(p.length&&(p.length<4||p[3]>0.5)){bg=p.slice(0,3);break}bg=bg.parentElement}
      if(!Array.isArray(bg))bg=[255,255,255];
      const x=lum(rgb(getComputedStyle(el).color)),y=lum(bg);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
}
