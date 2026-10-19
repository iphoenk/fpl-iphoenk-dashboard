import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('Explore the Pool shows twenty rows and clamps the final page',()=>{
 const s=readFileSync(new URL('../advanced.js',import.meta.url),'utf8'),start=s.indexOf('function renderPredictionDashboard()'),fn=s.slice(start,s.indexOf('function legalXI(',start));
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:''});return nodes.get(id);};
 const players=Array.from({length:45},(_,i)=>({id:i+1,web_name:'Player '+(i+1),element_type:1,status:'a',form:1,now_cost:50,selected_by_percent:1}));
 const c=vm.createContext({ext:{predictions:{},dashPage:1},state:{next:{id:8}},$:get,allPlayers:()=>players,score:p=>100-p.id,modelPlayer:()=>null,modelPicker:()=>'',esc:String,fmt:String,playerLabel:p=>p.web_name,money:String,fixturePills:()=>'',watchButton:()=>'',sourceNote:()=>'',extraStatus:()=>''});
 vm.runInContext(fn,c);vm.runInContext('renderPredictionDashboard()',c);
 let html=get('dashboardPredictions').innerHTML;
 assert.equal((html.match(/<tr>/g)||[]).length,21);assert.match(html,/1 \/ 3/);
 c.ext.dashPage=99;vm.runInContext('renderPredictionDashboard()',c);html=get('dashboardPredictions').innerHTML;
 assert.equal((html.match(/<tr>/g)||[]).length,6);assert.equal(c.ext.dashPage,3);assert.match(html,/3 \/ 3/);assert.match(html,/Player 45/);
});
