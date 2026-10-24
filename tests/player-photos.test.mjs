import {test} from 'node:test';
import assert from 'node:assert/strict';
import {officialPhotoSources} from '../domain.mjs';

test('photo resolver prefers FPL player photo/code, preserves official 110x140, legacy and placeholder',()=>{
 const sources=officialPhotoSources({code:465730,photo:'465730.jpg'});
 assert.equal(sources[0],'https://resources.premierleague.com/premierleague25/photos/players/110x140/465730.png');
 assert.match(sources[1],/\/p465730\.png$/);
 assert.match(sources[2],/250x250\/465730\.png$/);
 assert.match(sources[3],/40x40\/465730\.png$/);
 assert.match(sources[4],/500x500\/465730\.png$/);
 assert.match(sources[5],/placeholder\.png$/);
 assert.equal(officialPhotoSources({photo:'465730.jpg'})[0],sources[0]);
 assert.deepEqual(officialPhotoSources({code:465730,has_temporary_code:true}),sources);
 assert.deepEqual(officialPhotoSources({code:'https://untrusted.test/a'}),[sources[5]]);
 assert.deepEqual(officialPhotoSources({}),[sources[5]]);
});
test('Konsa 2026/27 id 31 uses named portrait with verified identity before CDNs',()=>{
 const sources=officialPhotoSources({id:31,code:199798,photo:'199798.jpg',has_temporary_code:true,web_name:'Konsa'});
 assert.match(sources[0],/static\.sky\.it.*199798\.png$/);
 assert.match(sources[1],/premierleague25\/photos\/players\/110x140\/199798\.png$/);
 assert.match(sources.at(-1),/placeholder\.png$/);
 assert.ok(sources.length>=7);
 assert.doesNotMatch(officialPhotoSources({id:42,code:199798})[0],/sky\.it/);
});
