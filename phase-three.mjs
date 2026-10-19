export function strategyNumber(v){return v==null||String(v).trim()===''||!Number.isFinite(Number(v))?null:Number(v);}
export function evaluateTransferPath(hold,buy,hit){
 if(!Array.isArray(hold)||hold.length!==buy?.length||!hold.length||!Number.isInteger(hit)||hit<0)throw new Error('Skenario tidak valid');
 let cumulative=-hit,complete=true,breakEven=null;
 const rows=hold.map((v,i)=>{const a=strategyNumber(v),b=strategyNumber(buy[i]),delta=a===null||b===null?null:b-a;if(delta===null)complete=false;if(complete)cumulative+=delta;if(complete&&cumulative>=0&&breakEven===null)breakEven=i+1;return {week:i+1,hold:a,buy:b,delta,cumulative:complete?cumulative:null};});
 const sum=a=>a.every(v=>strategyNumber(v)!==null)?a.reduce((n,v)=>n+Number(v),0):null;
 return {rows,hold:sum(hold),buy:sum(buy),net:complete?cumulative:null,breakEven};
}
export function checkStrategyTransfer(squad,outId,incoming,selling,bank){
 const out=squad.find(p=>p.id===outId);if(!out||!incoming)return 'Pilih pemain keluar dan masuk.';
 if(out.element_type!==incoming.element_type)return 'Posisi pemain harus sama.';
 if(squad.some(p=>p.id===incoming.id))return 'Pemain masuk sudah dimiliki.';
 if(squad.filter(p=>p.id!==outId&&p.team===incoming.team).length>=3)return 'Maksimal 3 pemain per klub.';
 if(!Number.isInteger(selling)||selling<0||!Number.isInteger(bank)||bank<0||!Number.isInteger(incoming.now_cost))return 'Harga jual dan bank harus valid dalam £0,1m.';
 if(selling+bank<incoming.now_cost)return 'Anggaran tidak cukup dengan harga jual yang diisi.';
 return null;
}
export function rivalExposure(own,rival,projections){
 const counts=list=>{const m=new Map();for(const p of list){const v=strategyNumber(p.multiplier);if(v===null||v<0)throw new Error('Eksposur tidak valid');m.set(p.id,(m.get(p.id)||0)+v);}return m;};
 const a=counts(own),b=counts(rival),rows=[];let edge=0,complete=true;
 for(const id of new Set([...a.keys(),...b.keys()])){const coefficient=(a.get(id)||0)-(b.get(id)||0);if(!coefficient)continue;const xp=strategyNumber(projections[id]),contribution=xp===null?null:coefficient*xp;if(contribution===null)complete=false;else edge+=contribution;rows.push({id,own:a.get(id)||0,rival:b.get(id)||0,coefficient,xp,contribution});}
 return {rows,edge:complete?edge:null};
}
export function selectLeagueAward(entries,{direction='max',positive=false,separate=false}={}){
 const valid=entries.filter(e=>strategyNumber(e.value)!==null&&(!positive||Number(e.value)>0));if(!valid.length)return [];
 if(separate&&(valid.length<2||new Set(valid.map(e=>Number(e.value))).size<2))return [];
 const value=(direction==='min'?Math.min:Math.max)(...valid.map(e=>Number(e.value)));return valid.filter(e=>Number(e.value)===value);
}
export function effectiveCaptainPoints(picks,live){const p=picks.find(p=>Number(p.multiplier)>1)||picks.find(p=>p.is_captain);const points=strategyNumber(live[p?.element]?.stats?.total_points),multiplier=strategyNumber(p?.multiplier);return points===null||multiplier===null?null:points*multiplier;}
