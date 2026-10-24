/* Resolve the official FPL free-transfer balance.
   Prefer the manager field when the upstream API exposes extra_free_transfers.
   Otherwise reconstruct it from published history and the chip ledger. */

const MAX_FREE_TRANSFERS=5;
const FREE_TRANSFER_CHIPS=new Set(['wildcard','freehit']);

const integer=(value)=>{
 const n=Number(value);
 return Number.isInteger(n)&&n>=0?n:null;
};

export function freeTransfersFromHistory(history,targetGameweek){
 const rows=Array.isArray(history?.current)?history.current
  .filter(row=>Number.isInteger(Number(row?.event))&&Number(row.event)>=1)
  .sort((a,b)=>Number(a.event)-Number(b.event)):null;
 if(!rows?.length||!Number.isInteger(Number(targetGameweek))||Number(targetGameweek)<1)return null;
 const published=rows.filter(row=>Number(row.event)<Number(targetGameweek));
 if(!published.length)return 1;
 const expectedEvents=Number(targetGameweek)-1;
 const publishedEvents=new Set(published.map(row=>Number(row.event)));
 for(let event=1;event<=expectedEvents;event++)if(!publishedEvents.has(event))return null;

 const chips=new Map((Array.isArray(history.chips)?history.chips:[])
  .map(chip=>[Number(chip?.event),String(chip?.name||'').toLowerCase()]));
 let available=1;
 for(const row of published){
  const transfers=integer(row.event_transfers);
  if(transfers===null)return null;
  const chip=chips.get(Number(row.event));
  const protectedByChip=FREE_TRANSFER_CHIPS.has(chip);
  const after=protectedByChip?available:Math.max(0,available-transfers);
  available=Math.min(MAX_FREE_TRANSFERS,after+1);
 }
 return available;
}

export function freeTransferEvidence(history,targetGameweek,entry=null){
 const extra=integer(entry?.extra_free_transfers);
 if(extra!==null){
  return {
   value:Math.min(MAX_FREE_TRANSFERS,1+extra),
   as_of_gameweek:Number(targetGameweek)-1,
   next_gameweek:Number(targetGameweek),
   source:'Official FPL entry',
   method:'Official extra_free_transfers field plus one standard FT',
   max_bank:MAX_FREE_TRANSFERS,
   verified:true
  };
 }
 const value=freeTransfersFromHistory(history,targetGameweek);
 if(value===null)return null;
 return {
  value,
  as_of_gameweek:Number(targetGameweek)-1,
  next_gameweek:Number(targetGameweek),
  source:'Official FPL entry history',
  method:'Deterministic reconstruction from event_transfers and chip ledger',
  max_bank:MAX_FREE_TRANSFERS,
  verified:true
 };
}
