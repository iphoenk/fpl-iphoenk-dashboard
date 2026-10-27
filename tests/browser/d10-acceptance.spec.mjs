import {test,expect} from '@playwright/test';
import {openOverview} from './harness.mjs';

// D10 (PARTIAL acceptance): 17 routes x 3 widths x 2 themes on frozen anonymised fixtures, plus keyboard focus visibility
// and touch-target size at the 393px phone width.
// NOT covered: real model/news data, screen readers, real devices, colour-contrast ratios, 200% zoom / text spacing,
// reduced-motion, hover states, DGW/BGW weeks. Passing this file is not a WCAG conformance claim.
// Target sizes are a RATCHET: the counts below are the measured gaps on 2026-10-27. The test fails if a route gets worse;
// improving a route means lowering its number here. 24px follows WCAG 2.2 SC 2.5.8 (AA); 44px is the stricter project goal.
const VIEWS=['dashboard','tim','optimal','watchlist','planning','transfers','chips','labs','playercompare','fixtures','market','news','liga','banding','accuracy','modelinsights','about'];
const WIDTHS=[393,768,1440];
const THEMES=['light','dark'];
const MIN24={dashboard:19,tim:0,optimal:0,watchlist:0,planning:4,transfers:0,chips:0,labs:0,playercompare:0,fixtures:0,market:10,news:0,liga:0,banding:0,accuracy:0,modelinsights:1,about:31};
const MIN44={dashboard:72,tim:25,optimal:6,watchlist:19,planning:15,transfers:12,chips:6,labs:10,playercompare:8,fixtures:9,market:29,news:18,liga:31,banding:6,accuracy:6,modelinsights:8,about:38};

async function go(page,view){
  await page.evaluate(v=>document.querySelector('[data-view="'+v+'"]').click(),view);
  await page.waitForFunction(v=>document.body.dataset.view===v||location.hash==='#'+v,view);
  await page.waitForTimeout(900);
}
const luminance=()=>{
  const m=getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g).map(Number);
  const [r,g,b]=m.slice(0,3).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});
  return 0.2126*r+0.7152*g+0.0722*b;
};

for(const width of WIDTHS)for(const theme of THEMES){
  test(`matrix: all 17 routes at ${width}px ${theme} have no script errors, overflow or broken values`,async({page})=>{
    test.setTimeout(240000);
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e&&e.message||e)));
    await openOverview(page,{width,theme});
    const lum=await page.evaluate(luminance);
    if(theme==='dark')expect(lum,'dark theme must have a dark page background').toBeLessThan(0.2);else expect(lum,'light theme must have a light page background').toBeGreaterThan(0.6);
    for(const view of VIEWS){
      await go(page,view);
      const m=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,text:document.body.innerText,main:(document.querySelector('main')||document.body).innerText.trim().length}));
      expect(m.overflow,view+' horizontal overflow px').toBeLessThanOrEqual(1);
      expect(m.main,view+' content').toBeGreaterThanOrEqual(10);
      expect(m.text,view).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b(?! ?\()/);
    }
    expect(errors,'uncaught script errors').toEqual([]);
  });
}

for(const [width,theme] of [[393,'dark'],[1440,'light']]){
  test(`keyboard: the first 14 Tab presses on every route reach at least 3 controls and show a visible focus indicator at ${width}px ${theme}`,async({page})=>{
    test.setTimeout(240000);
    await openOverview(page,{width,theme});
    const problems=[];
    for(const view of VIEWS){
      await go(page,view);
      await page.evaluate(()=>{document.activeElement&&document.activeElement.blur();window.scrollTo(0,0);});
      const seen=new Set();
      for(let i=0;i<14;i++){
        await page.keyboard.press('Tab');
        const f=await page.evaluate(()=>{
          const e=document.activeElement;if(!e||e===document.body)return null;
          const s=getComputedStyle(e),r=e.getBoundingClientRect();
          const outline=s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0;
          const shadow=s.boxShadow&&s.boxShadow!=='none';
          return {id:e.tagName+'.'+(e.className||'').toString().slice(0,24)+'#'+(e.id||e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,20),visible:outline||shadow,box:r.width>0&&r.height>0};
        });
        if(!f)continue; // Tab wrapped past the end of a short page (focus on body/browser chrome): not a defect, the next Tab restarts the order
        if(!f.box)problems.push(view+': focused element has no box '+f.id);
        else if(!f.visible)problems.push(view+': no visible focus indicator on '+f.id);
        seen.add(f.id);
      }
      if(seen.size<3)problems.push(view+': keyboard reached only '+seen.size+' distinct elements');
    }
    expect(problems).toEqual([]);
  });
}

test('touch targets at 393px: non-inline controls under 24px and under 44px do not exceed the recorded baseline per route',async({page})=>{
  test.setTimeout(240000);
  await openOverview(page,{width:393});
  const report={};
  for(const view of VIEWS){
    await go(page,view);
    report[view]=await page.evaluate(()=>{
      const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
      const box=e=>{ // a checkbox or radio is operated through its label: measure the larger of the two
        const r=e.getBoundingClientRect();
        if(e.tagName==='INPUT'&&/checkbox|radio/.test(e.type)){const l=e.closest('label')||(e.id&&document.querySelector('label[for="'+e.id+'"]'));if(l){const lr=l.getBoundingClientRect();return {w:Math.max(r.width,lr.width),h:Math.max(r.height,lr.height)};}}
        return {w:r.width,h:r.height};
      };
      const els=[...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=tab],[role=button],summary,[tabindex]:not([tabindex="-1"])')].filter(vis)
        .filter(e=>!(e.tagName==='A'&&getComputedStyle(e).display==='inline'));
      const under=n=>els.filter(e=>{const b=box(e);return b.w<n||b.h<n});
      return {u24:under(24).length,u44:under(44).length};
    });
  }
  console.log('D10_TARGETS '+JSON.stringify(report));
  const over=[];
  for(const v of VIEWS){if(report[v].u24>MIN24[v])over.push(v+' <24px: '+report[v].u24+' > '+MIN24[v]);if(report[v].u44>MIN44[v])over.push(v+' <44px: '+report[v].u44+' > '+MIN44[v]);}
  expect(over).toEqual([]);
});
