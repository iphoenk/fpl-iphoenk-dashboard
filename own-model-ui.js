// Optional comparison only. No startup fetch and no Python computation in the browser.
let ownModelData=null,ownModelBusy=false,ownModelError=null,ownModelExpiry=null;
function currentOwnPrediction(p){
 if(!p||ownModelData?.model_id!=='fpl-iphoenk-python-v1'||ownModelData.target_gw!==state.next?.id||Date.parse(ownModelData.deadline_utc)!==Date.parse(state.next?.deadline_time)||Date.now()>=Date.parse(ownModelData.expires_at_utc))return null;
 const r=ownModelData.players?.[p.id];return r?.status==='ready'&&r.permanent_code===p.code&&r.name===p.web_name&&r.team_id===p.team&&r.position===p.element_type&&r.availability?.status===p.status&&(r.availability?.chance??null)===(p.chance_of_playing_next_round??null)&&typeof r.xp==='number'&&Number.isFinite(r.xp)?r:null;
}
async function loadOwnModel(){
 if(ownModelBusy)return;ownModelBusy=true;ownModelError=null;renderOwnModelComparisons();
 try{const data=await api('own-model'+(currentSquad().length?'?ids='+currentSquad().map(p=>p.id).sort((a,b)=>a-b).join(','):''));if(data.model_id!=='fpl-iphoenk-python-v1'||data.target_gw!==state.next?.id||Date.now()>=Date.parse(data.expires_at_utc))throw Error('Model needs refreshing.');ownModelData=data;clearTimeout(ownModelExpiry);ownModelExpiry=setTimeout(()=>{ownModelData=null;ownModelError='The experimental snapshot has expired. Official predictions remain available.';renderOwnModelComparisons();},Math.max(1,Date.parse(data.expires_at_utc)-Date.now()));}
 catch{ownModelData=null;ownModelError='The experimental model is unavailable or needs refreshing. Official predictions remain available.';}
 finally{ownModelBusy=false;renderOwnModelComparisons();}
}
function ownModelControls(){return '<div class="own-model-controls"><button class="btn small" data-load-own-model'+(ownModelBusy?' disabled':'')+'>'+(ownModelBusy?'Loading snapshot…':ownModelData?'Reload model':'Load Python model')+'</button>'+(ownModelData?'<button class="btn small ghost" data-close-own-model>Close comparison</button>':'')+'<small>Experimental comparison · primary predictions remain unchanged.</small></div>';}
function ownModelTable(compact=false){
 const squad=currentSquad(),players=(squad.length?squad:allPlayers()).filter(p=>currentOwnPrediction(p)).sort((a,b)=>currentOwnPrediction(b).xp-currentOwnPrediction(a).xp),list=compact?players.slice(0,3):squad.length?players:players.slice(0,10);
 if(!list.length)return '<p class="adv-note">No validated model predictions are available for these players.</p>';
 return '<p class="adv-note">'+(compact?'Summary':squad.length?'Your public squad':'Top 10 pool predictions')+' · GW'+state.next.id+' · xP sebelum pengali kapten.</p><div class="table-wrap"><table><thead><tr><th>Player</th><th>Position</th><th>Official FPL</th><th>'+esc(providerModelLabel())+'</th><th>FPL iphoenk Python</th></tr></thead><tbody>'+list.map(p=>'<tr><td><button data-player="'+p.id+'">'+esc(p.web_name)+'</button></td><td>'+esc(positions[p.element_type])+'</td><td>'+fmt(captainOfficialProjection(p),1)+'</td><td>'+fmt(xp(p),1)+'</td><td class="lime"><strong>'+fmt(currentOwnPrediction(p).xp,1)+'</strong></td></tr>').join('')+'</tbody></table></div>';
}
function ownModelPanel(compact=false){
 let body='<p class="adv-note">Optional comparison. Python runs offline; this button only loads precomputed JSON.</p>'+ownModelControls();
 if(ownModelData){body+='<p class="adv-note">Versi '+esc(ownModelData.model_version)+' · '+ownModelData.coverage.ready+'/'+ownModelData.coverage.universe+' players · data '+esc(deviceDateTime(ownModelData.inputs_as_of_utc))+' · valid until '+esc(deviceDateTime(ownModelData.expires_at_utc))+'.</p>'+ownModelTable(compact);}
 else if(ownModelError&&state.view==='modelinsights')body+='<p class="adv-note">'+esc(ownModelError)+'</p>';
 if(state.view==='modelinsights')body+='<details class="own-model-method"><summary>Method and limitations</summary><p>Baseline statistik per GK/DEF/MID/FWD, memakai riwayat Official FPL yang final dan diperiksa, menit, xG/xA, kontribusi bertahan, saves, bonus dan pengurangan poin sesuai posisi. Prior: 180 menit untuk laju kontribusi, 2 fixture untuk menit, 5 laga untuk konteks tim. Riwayat musim ini belum diberi bobot recency. Position historis tidak tersedia; prior statistik memakai pool semua posisi, tanpa menebak posisi masa lalu. Penyesuaian ketersediaan adalah heuristik dari status resmi, bukan probabilitas starter terkalibrasi.</p><p>Tanpa coach/team/formation fit, skor skill subjektif, simulasi taktik atau rentang hasil buatan. Refresh pipeline dilakukan manual; snapshot berlaku maksimal 6 jam. Data tidak lengkap tidak menjadi nol. Model ini belum terbukti lebih akurat daripada pembanding.</p></details>';
 return panel('FPL iphoenk Python · experimental',body);
}
function renderOwnModelComparisons(){
 if(!ownModelData)document.querySelectorAll('.own-model-player').forEach(node=>node.remove());
 let parent=null,id='';
 if(state.view==='modelinsights'){parent=$('view-modelinsights');id='ownModelInsights';}
 else if(state.view==='planning'){parent=$('view-planning');id='ownModelCaptainComparison';}
 else if(state.view==='dashboard'&&overviewMode==='next'&&typeof nextGwOverview!=='undefined'){parent=nextGwOverview;id='ownModelOverview';}
 if(!parent)return;let host=$(id);if(!host){host=document.createElement('section');host.id=id;host.className='own-model-section';parent.prepend(host);}host.innerHTML=ownModelPanel(state.view==='dashboard');
}
const ownAdvancedBefore=renderAdvanced;renderAdvanced=async function(view=state.view){await ownAdvancedBefore(view);if(state.view===view)renderOwnModelComparisons();};
const ownPlanningBefore=renderPlanning;renderPlanning=function(){ownPlanningBefore();renderOwnModelComparisons();};
const ownOverviewBefore=renderDashboardOverview;renderDashboardOverview=function(){ownOverviewBefore();renderOwnModelComparisons();};
const ownApplyBefore=applyOverviewMode;applyOverviewMode=function(){ownApplyBefore();renderOwnModelComparisons();};
const ownPlayerBefore=playerDetail;playerDetail=function(id){ownPlayerBefore(id);const p=state.players[id],row=currentOwnPrediction(p),root=$('playerDetail');if(!row||!root)return;const labels={appearance:'Menit/penampilan',goals:'Gol',assists:'Asis',clean_sheet:'Clean sheet',conceded:'Kebobolan',saves:'Saves',bonus:'Bonus',defcon:'Kontribusi bertahan',penalties_saved:'Penalti diselamatkan',penalties_missed:'Penalti gagal',cards:'Kartu',own_goals:'Gol bunuh diri'};const host=document.createElement('section');host.className='own-model-player';host.innerHTML='<h3>FPL iphoenk Python · experimental</h3><p><strong>'+fmt(row.xp,1)+' xP</strong> · '+row.evidence_count+' fixture final tercatat · sebelum pengali kapten.</p><div class="table-wrap"><table><tbody>'+Object.entries(row.components).map(([key,value])=>'<tr><td>'+esc(labels[key]||key)+'</td><td>'+fmt(value,2)+'</td></tr>').join('')+'</tbody></table></div><small>Data '+esc(deviceDateTime(ownModelData.inputs_as_of_utc))+'. Komponen estimasi model, bukan jaminan hasil.</small>';root.append(host);};
const ownAboutBefore=renderAbout;renderAbout=function(){ownAboutBefore();const root=$('view-about');if(root){const host=document.createElement('section');host.innerHTML=panel('Independent Python Engine','<p>FPL iphoenk Python v0.1.1 is an experimental baseline calculated by this project's code using Official FPL data. External comparisons retain their source labels. Processing runs offline, outside page loading, and does not copy externally trained models.</p>');root.append(host);}};
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-load-own-model'))loadOwnModel();if(button.hasAttribute('data-close-own-model')){clearTimeout(ownModelExpiry);ownModelData=null;ownModelError=null;renderOwnModelComparisons();}});
