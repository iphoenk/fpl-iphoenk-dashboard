import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const js=readFileSync(new URL('../decision-first.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../decision-first.css',import.meta.url),'utf8');
const start=js.indexOf('const V6_LABELS'),end=js.indexOf('  function planCard(){');
assert.ok(start>0&&end>start,'v6Chip block located');

// Evaluate only the v6Chip block with the same escaping contract the real module uses.
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function chipFn(){
 const ctx=vm.createContext({safeName:esc,deviceDateTime:v=>Number.isFinite(new Date(v).getTime())?'25 Okt 2026 05.13 · WIB':'Tanggal belum tersedia'});
 return vm.runInContext('(function(){'+js.slice(start,end)+';return v6Chip;})()',ctx);
}
const chip=chipFn();
const report=v6=>({source:{provider:'Official FPL',v6}});

test('each backend V6 status renders its own label and data attribute',()=>{
 for(const [status,label] of [['VERIFIED','Verified'],['STALE','Stale'],['UNVERIFIED','Unverified'],['UNAVAILABLE','Unavailable']]){
  const html=chip(report({status,mode:'PROVENANCE_ONLY',observed_at:'2026-10-25T05:13:00.858Z'}));
  assert.match(html,new RegExp('data-v6-status="'+status+'"'),status);
  assert.match(html,new RegExp('<b>'+label+'</b>'),status);
 }
});

test('observed time is shown only when valid and only for a known status',()=>{
 assert.match(chip(report({status:'VERIFIED',observed_at:'2026-10-25T05:13:00Z'})),/25 Okt 2026/);
 assert.doesNotMatch(chip(report({status:'VERIFIED',observed_at:'not-a-date'})),/Tanggal belum|Okt/);
 assert.doesNotMatch(chip(report({status:'UNAVAILABLE'})),/Okt/);
});

test('missing or unknown status is "Not reported", never presented as verified',()=>{
 for(const v6 of [undefined,null,{},{status:'OK'},{status:'verified'},{status:'__proto__'},{status:'toString'},{status:'constructor'}]){
  const html=chip(report(v6));
  assert.match(html,/data-v6-status="NOT_REPORTED"/,JSON.stringify(v6));
  assert.match(html,/<b>Not reported<\/b>/);
  assert.doesNotMatch(html,/Verified/);
 }
});

test('no chip when the backend sent no source (unavailable or loading report)',()=>{
 assert.equal(chip(null),'');
 assert.equal(chip({status:'unavailable',error:'x'}),'');
 assert.equal(chip({source:'text'}),'');
});

test('server strings are never echoed into markup',()=>{
 const html=chip(report({status:'<img src=x onerror=alert(1)>',observed_at:'2026-10-25T05:13:00Z'}));
 assert.doesNotMatch(html,/<img|onerror/);
 assert.match(html,/NOT_REPORTED/);
});

test('copy keeps V6 separate from V12 readiness and is wired into the plan card with CSS',()=>{
 assert.match(js,/It is not Canonical V12 readiness/);
 assert.match(js,/'<\/span>'\+v6Chip\(report\)\+'<\/div>'/);
 assert.match(css,/\.decision-v6\[data-v6-status=VERIFIED\]/);
 const visible=chip(report({status:'VERIFIED'})).replace(/ title="[^"]*"/,'').replace(/<[^>]+>/g,'');
 assert.doesNotMatch(visible,/V12/,'visible chip text must not imply V12 readiness');
 assert.match(visible,/^V6 data feed: Verified/);
});
