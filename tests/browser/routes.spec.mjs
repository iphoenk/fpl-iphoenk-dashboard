import {test,expect} from '@playwright/test';
import {openOverview} from './harness.mjs';

// All 17 routes of the app (data-view values in the navigation).
// Scope: degraded-API acceptance. Only official FPL data and the decision endpoint are mocked; model, news,
// insights, accuracy and forecast-archive endpoints answer 404, so these routes must show a safe empty or error state.
// This does NOT prove those routes render correctly with real model data.
const VIEWS=['dashboard','tim','optimal','watchlist','planning','transfers','chips','labs','playercompare','fixtures','market','news','liga','banding','accuracy','modelinsights','about'];
const WIDTHS=[393,768,1440];

async function visit(page,view){
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e&&e.message||e)));
  await page.evaluate(v=>document.querySelector('[data-view="'+v+'"]').click(),view);
  await page.waitForFunction(v=>document.body.dataset.view===v||location.hash==='#'+v,view);
  await page.waitForTimeout(1200);
  return errors;
}

for(const width of WIDTHS){
  for(const view of VIEWS){
    test(`route ${view} at ${width}px stays usable when model/news APIs are unavailable (no script errors, broken values or overflow)`,async({page})=>{
      await openOverview(page,{width});
      const errors=await visit(page,view);
      expect(errors,'uncaught script errors').toEqual([]);
      const m=await page.evaluate(()=>({
        overflow:document.documentElement.scrollWidth-window.innerWidth,
        text:document.body.innerText,
        main:(document.querySelector('main')||document.body).innerText.trim().length
      }));
      expect(m.overflow,'horizontal overflow in px').toBeLessThanOrEqual(1);
      expect(m.main,'main shows content or an explicit error state').toBeGreaterThanOrEqual(10);
      expect(m.text).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b(?! ?\()/);
    });
  }
}

test('dark theme at 393px keeps every route free of script errors with unavailable APIs',async({page})=>{
  await openOverview(page,{width:393,theme:'dark'});
  for(const view of VIEWS){
    const errors=await visit(page,view);
    expect(errors,view).toEqual([]);
  }
});
