// WebKit mobile/tablet/desktop smoke test. This is not a physical Safari device.
import {chromium,webkit} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';

const base=process.env.FPL_PREVIEW_URL?.replace(/\/+$/,'');
const entry=process.env.FPL_ACCEPTANCE_ENTRY||'3462711';
if(!base||!(/^https:\/\/[a-z0-9.-]+\.vercel\.app$/i.test(base)||/^http:\/\/(?:127\.0\.0\.1|localhost):4173$/i.test(base)))throw Error('Expected HTTPS Vercel preview or local acceptance server');
const output={preview_url:base,created_at:new Date().toISOString(),kind:'EMULATED_BROWSER_ENGINE_NOT_PHYSICAL_DEVICE',
 checks:[],errors:[],status:'INCOMPLETE'};
mkdirSync('artifacts',{recursive:true});
const devices=[
 {name:'webkit-mobile-393',engine:'webkit',width:393,height:852,mobile:true,touch:true},
 {name:'webkit-large-mobile-430',engine:'webkit',width:430,height:932,mobile:true,touch:true},
 {name:'webkit-tablet-768',engine:'webkit',width:768,height:1024,mobile:false,touch:true},
 {name:'chromium-desktop-1440',engine:'chromium',width:1440,height:900,mobile:false,touch:false}
];
let browserW=null,browserC=null;
try{
 browserW=await webkit.launch({headless:true});browserC=await chromium.launch({headless:true});
 for(const d of devices){
  const browser=d.engine==='webkit'?browserW:browserC;
  const context=await browser.newContext({viewport:{width:d.width,height:d.height},
   isMobile:d.mobile,hasTouch:d.touch,deviceScaleFactor:d.mobile?2:1});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push('JS: '+String(e.message).slice(0,300)));
  try{
   const res=await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
   if(!res||res.status()!==200)throw Error('Initial page HTTP '+res?.status());
   await page.locator('#entryInput').fill(entry);
   await page.locator('#entryForm button[type=submit]').click();
   await page.locator('#decisionFirst').waitFor({state:'visible',timeout:45000});
   await page.locator('.decision-optimizer').first().waitFor({state:'attached',timeout:30000});
   // Expanding native details must not require another API fetch.
   await page.locator('.decision-optimizer').first().evaluate(el=>el.open=true);
   await page.locator('.decision-optimizer-week').first().evaluate(el=>el.open=true);
   const evidence=await page.locator('.decision-optimizer-week').first()
    .locator('tr[data-formation-row]').count();
   if(evidence!==8)errors.push('Rendered formation rows = '+evidence+' expected 8');
   const details=await page.evaluate(()=>{
    const w=document.documentElement.scrollWidth,h=document.documentElement.clientWidth;
    const header=document.querySelector('.mobile-bottom-nav');
    const dock=header?getComputedStyle(header):null;
    const rect=header?.getBoundingClientRect();
    return {document_width:w,viewport_width:h,overflow_px:w-h,
      dock_display:dock?.display||null,dock_position:dock?.position||null,
      dock_bounds:rect?{top:rect.top,bottom:rect.bottom,width:rect.width}:null,
      rendered_players:document.querySelectorAll('#pitch .player,#pitch .pitch-player,#bench .player').length,
      horizon:document.querySelector('#decisionHorizonSelect')?.value||null};
   });
   if(details.overflow_px>2)errors.push('Horizontal document overflow '+details.overflow_px+'px');
   if(d.mobile){
    if(details.dock_display==='none'||details.dock_position!=='fixed')errors.push('Mobile floating dock not fixed/visible');
    if(details.dock_bounds?.bottom>d.height+3)errors.push('Dock outside viewport');
   }
   await page.screenshot({path:'artifacts/'+d.name+'.png',fullPage:true,timeout:20000});
   output.checks.push({device:d.name,engine:d.engine,http:res.status(),
    formation_rows:evidence,details,errors});
  }catch(error){errors.push(String(error?.message||error));output.checks.push({device:d.name,errors});}
  if(errors.length)output.errors.push({device:d.name,errors});
  await context.close();
  console.log(d.name,errors.length?'FAIL '+errors.join('; '):'PASS');
 }
 output.status=output.errors.length?'FAIL':'PASS';
}catch(error){output.errors.push({harness:String(error?.message||error)});output.status='INCOMPLETE';}
finally{
 await browserW?.close();await browserC?.close();
 writeFileSync('artifacts/webkit-browser-acceptance.json',JSON.stringify(output,null,2)+'\n');
 console.log('WEBKIT_ACCEPTANCE_RESULT',JSON.stringify({status:output.status,checks:output.checks.length,
  errors:output.errors.slice(0,3)}));
 if(output.status!=='PASS')process.exitCode=1;
}
