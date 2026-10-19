import {test} from 'node:test';
import assert from 'node:assert/strict';
import {officialPhotoSources} from '../domain.mjs';
test('player portraits use current official FPL photos with legacy and placeholder fallbacks',()=>{
 const sources=officialPhotoSources({code:465730,photo:'465730.jpg'});
 assert.equal(sources[0],'https://resources.premierleague.com/premierleague25/photos/players/110x140/465730.png');
 assert.match(sources[1],/\/p465730\.png$/);assert.match(sources[2],/placeholder\.png$/);
 assert.equal(officialPhotoSources({photo:'465730.jpg'})[0],sources[0]);
 assert.deepEqual(officialPhotoSources({code:465730,has_temporary_code:true}),[sources[2]]);
 assert.deepEqual(officialPhotoSources({code:'https://untrusted.test/a'}),[sources[2]]);
 assert.deepEqual(officialPhotoSources({}),[sources[2]]);
});
