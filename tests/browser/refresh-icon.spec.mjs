import {test,expect} from '@playwright/test';
import {openOverview} from './harness.mjs';

// The header reload control is a thin, small outline icon in every layout and theme, still operable and labelled.
for(const [width,label] of [[1440,'desktop'],[768,'tablet'],[393,'mobile']])for(const theme of ['light','dark']){
  test(`${label} ${width}px ${theme}: reload icon is a thin 16px outline, 32px hit area, labelled and focus-visible`,async({page})=>{
    await openOverview(page,{width,theme});
    const b=page.locator('#refreshButton');
    await expect(b).toBeVisible();
    const m=await b.evaluate(el=>{
      const svg=el.querySelector('svg'),s=getComputedStyle(svg),r=el.getBoundingClientRect(),sr=svg.getBoundingClientRect();
      return {w:Math.round(r.width),h:Math.round(r.height),icon:Math.round(sr.width),stroke:parseFloat(s.strokeWidth),fill:getComputedStyle(svg).fill,label:el.getAttribute('aria-label'),overflow:document.documentElement.scrollWidth-innerWidth,hasPath:svg.querySelectorAll('path').length};
    });
    expect(m.icon,'icon size').toBe(16);
    expect(m.stroke,'stroke width').toBeLessThanOrEqual(1.5);
    expect(m.fill,'outline icon, not a filled glyph').toBe('none');
    expect(m.w).toBe(32);expect(m.h).toBe(32);   // WCAG 2.2 AA minimum is 24px
    expect(m.label).toBe('Reload team data');
    expect(m.overflow).toBeLessThanOrEqual(1);
    await b.focus();
    const outline=await b.evaluate(el=>{const s=getComputedStyle(el);return s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0;});
    expect(outline,'visible keyboard focus').toBe(true);
  });
}
