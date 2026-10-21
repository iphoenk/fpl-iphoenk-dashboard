import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const pagination=read('compact-pagination.js');
const league=read('advanced-league.js');
const css=read('decision-first.css');

test('Who owns whom renders all 15 highest-owned players in a single rail',()=>{
 assert.match(league,/list\.slice\(0,15\)\.map\(p=>/);
 assert.match(league,/'<div class="ownership-scroll">'\+details\+'<\/div>'/);
 assert.match(league,/15 pemain teratas ditampilkan sekaligus/);
 assert.match(league,/Geser horizontal untuk melihat semuanya/);
});

test('generic compact paginator explicitly does not paginate ownership rail',()=>{
 const targets=pagination.match(/const selector='([^']+)'/)?.[1];
 assert.ok(targets,'Paginator targets must remain explicit');
 assert.equal(targets.includes('.ownership-scroll'),false);
 assert.ok(targets.includes('table > tbody'));
 assert.ok(targets.includes('.adv-grid'));
 assert.match(pagination,/items\.forEach\(\(item,i\)=>\{item\.hidden=/);
});

test('ownership uses an independently scrollable touch rail without cropping the last five cards',()=>{
 assert.match(css,/#view-liga \.ownership-scroll\{[\s\S]*?overflow-x:auto;/);
 assert.match(css,/#view-liga \.ownership-scroll>\.ownership-card\{\s*flex:0 0/);
 assert.match(css,/scroll-snap-type:x proximity/);
 assert.match(css,/scroll-snap-type:x mandatory/);
 assert.match(css,/-webkit-overflow-scrolling:touch/);
 assert.match(css,/border:1px solid var\(--line\)/);
});

test('league ownership denominator is still the verified complete classic-league total',()=>{
 assert.match(league,/if\(!coverage\?\.complete\)return panel\('Who owns whom'/);
 assert.match(league,/n=coverage\.total/);
 assert.match(league,/\+counts\[p\.id\]\+'\/'\+n/);
});
