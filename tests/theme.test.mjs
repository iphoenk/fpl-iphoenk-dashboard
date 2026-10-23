import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('theme toggle applies accessible state, persists preference, and respects saved choice on boot',()=>{
 const storage=new Map(),root={dataset:{theme:'light'}},button={setAttribute(k,v){this[k]=v;}},meta={setAttribute(k,v){this[k]=v;}};
 const c=vm.createContext({document:{documentElement:root,createElement:()=>button,body:{append(){}},querySelector:selector=>selector.startsWith('meta')?meta:null},window:{matchMedia:()=>({matches:false,addEventListener(){}})},safeWrite:(k,v)=>storage.set(k,JSON.stringify(v)),safeRead:k=>storage.has(k)?JSON.parse(storage.get(k)):null});
 vm.runInContext(readFileSync(new URL('../theme.js',import.meta.url),'utf8'),c);
 assert.equal(root.dataset.theme,'light');button.onclick();assert.equal(root.dataset.theme,'dark');assert.equal(button['aria-pressed'],'true');assert.equal(meta.content,'#0d1420');assert.equal(storage.get('fpl-iphoenk-theme'),'"dark"');button.onclick();assert.equal(root.dataset.theme,'light');assert.match(button['aria-label'],/dark mode/);
 const html=readFileSync(new URL('../ui.html',import.meta.url),'utf8'),boot=html.match(/<script>(try\{const saved=[\s\S]*?)<\/script>/)[1];
 storage.set('fpl-iphoenk-theme','"dark"');vm.runInNewContext(boot,{document:{documentElement:root},localStorage:{getItem:k=>storage.get(k)},matchMedia:()=>({matches:false})});assert.equal(root.dataset.theme,'dark');
});
