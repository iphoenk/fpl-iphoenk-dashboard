import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('generated Worker imports successfully and routes advisory health without Official requests',()=>{
 const built=spawnSync(process.execPath,['scripts/build.mjs'],{encoding:'utf8'});
 assert.equal(built.status,0,built.stderr);
 const run=spawnSync(process.execPath,['--input-type=module','-e',"const {default:w}=await import('./worker/index.js');const r=await w.fetch(new Request('https://example.test/api/decision/health'),{},{});if(r.status!==200||(await r.json()).status!=='READY')process.exit(1);"],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
});
test('Worker forwards a canonical no-slash league URL with its actual standings page',()=>{
 const run=spawnSync(process.execPath,['--input-type=module','-e',"const {default:w}=await import('./worker/index.js');let seen;globalThis.fetch=async url=>{seen=String(url);return Response.json({standings:{page:2,results:[]}})};await w.fetch(new Request('https://example.test/api/leagues-classic/9477/standings?page_standings=2'),{},{});if(!seen.endsWith('/standings/?page_standings=2'))throw Error('Lost page: '+seen);"],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
});
