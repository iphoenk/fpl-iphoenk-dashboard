import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handle,sourceFor} from '../server.mjs';
test('snapshot extracts only declared public JSON and removes embedded photos',async t=>{
 const html='<script type="application/json" class="scout-data" data-pos="DEF">{"pos":"DEF","rows":[{"id":1}]}</script><script type="application/json" class="scout-fixtures">[{"teamId":1}]</script><script type="application/json" id="player-data">{"players":[{"id":1,"name":"Player","photo":"data:image/jpeg;base64,unused","ep":{"total":5}}]}</script><script>throw new Error("never execute");</script>';
 t.mock.method(globalThis,'fetch',async url=>String(url).endsWith('html')?new Response(html):Response.json({gw:8,generated:'2026-10-18T03:00:00Z'}));
 const response=await handle(new Request('https://local/api/insights/snapshot'),{},null,'');
 assert.equal(response.status,200);const data=await response.json();
 assert.equal(data.gw,8);assert.equal(data.players[0].ep.total,5);assert.equal(data.players[0].photo,undefined);assert.equal(data.scouts.DEF.rows[0].id,1);assert.equal(data.fixtures[0].teamId,1);
});
test('model endpoint allowlist cannot read arbitrary repository files',()=>{
 assert.match(sourceFor('/api/model/accuracy'),/app\/public\/accuracy\.json$/);
 assert.match(sourceFor('/api/model/predictions-config_d'),/predictions_config_d\.json$/);
 assert.equal(sourceFor('/api/model/predictions-../../private'),null);
 assert.equal(sourceFor('/api/model/private'),null);
});
