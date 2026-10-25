// Per-feature readiness (D08). Pure function: no I/O, no clock, no scheduler.
// Each input is {http_status?, valid?, source_as_of?, checked_at?, coverage?:{loaded,total}, finished?, data_checked?}
// or null/undefined when the feature has no data at all. Unknown values stay null; they are never 0 or invented times.
export const READINESS={READY:'READY',PARTIAL:'PARTIAL',PENDING:'PENDING',UNAVAILABLE:'UNAVAILABLE',SHADOW:'SHADOW'};
const FEATURES=['facts','live','model','optimizer','league','news'];
const time=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?v:null;
const count=v=>Number.isInteger(v)&&v>=0?v:null;
function coverage(c){return c&&typeof c==='object'?{loaded:count(c.loaded),total:count(c.total)}:{loaded:null,total:null};}
function entry(status,reason,input){return {status,reason,source_as_of:time(input?.source_as_of),checked_at:time(input?.checked_at),coverage:coverage(input?.coverage)};}
function classify(name,input){
 if(input===null||input===undefined||typeof input!=='object')return entry(READINESS.UNAVAILABLE,name+' has no data',null);
 const http=input.http_status;
 if(http!==undefined&&http!==null&&!(http>=200&&http<300))return entry(READINESS.UNAVAILABLE,name+' source returned HTTP '+http,input);
 // A 200 response is transport success only; the payload must also validate.
 if(input.valid!==true)return entry(READINESS.UNAVAILABLE,name+' response did not pass validation',input);
 if(input.finished===true&&input.data_checked!==true)return entry(READINESS.PENDING,name+' evaluation pending: gameweek finished but not data_checked by official FPL',input);
 const c=coverage(input.coverage);
 if(c.loaded!==null&&c.total!==null&&c.loaded<c.total)return entry(READINESS.PARTIAL,name+' covers '+c.loaded+' of '+c.total+'; '+(c.total-c.loaded)+' missing',input);
 return entry(READINESS.READY,name+' ready',input);
}
export function featureReadiness({facts,live,projection,optimizer,league,news,mc}={}){
 const inputs={facts,live,model:projection,optimizer,league,news};
 const out={};
 for(const f of FEATURES)out[f]=classify(f,inputs[f]);
 // MC is offline shadow evidence: it is reported separately and never feeds the A/B/C features above.
 out.mc=mc&&typeof mc==='object'&&mc.valid===true?entry(READINESS.SHADOW,'MC shadow data available; offline evidence only, does not affect A/B/C',mc):entry(READINESS.UNAVAILABLE,'mc has no shadow data',mc);
 return out;
}
