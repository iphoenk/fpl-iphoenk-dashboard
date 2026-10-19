import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/index.js';
test('Vercel canonical URLs without trailing slashes still reach FPL',async t=>{
 let upstream;
 t.mock.method(globalThis,'fetch',async url=>{upstream=url;return Response.json({elements:[]});});
 const response=await handler.fetch(new Request('https://dugout.vercel.app/api/bootstrap-static'));
 assert.equal(response.status,200);
 assert.equal(upstream,'https://fantasy.premierleague.com/api/bootstrap-static/');
});
test('Vercel proxy preserves the requested league and pagination',async t=>{
 let upstream;
 t.mock.method(globalThis,'fetch',async url=>{upstream=url;return Response.json({league:{id:123},standings:{results:[],page:2}});});
 const response=await handler.fetch(new Request('https://dugout.vercel.app/api/leagues-classic/123/standings/?page_standings=2'));
 assert.equal(upstream,'https://fantasy.premierleague.com/api/leagues-classic/123/standings/?page_standings=2');
 assert.equal(response.status,200);
 assert.equal((await response.json()).league.id,123);
 assert.equal(response.headers.get('Vercel-CDN-Cache-Control'),'public, s-maxage=180');
});
test('Vercel proxy never caches upstream failures as success',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('Unavailable',{status:503}));
 const response=await handler.fetch(new Request('https://dugout.vercel.app/api/bootstrap-static/'));
 assert.equal(response.status,502);
 assert.equal(response.headers.get('Vercel-CDN-Cache-Control'),null);
 assert.match((await response.json()).error,/tidak tersedia/);
});
