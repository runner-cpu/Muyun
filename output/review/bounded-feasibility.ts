import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assessRun } from '../../client/src/sim/assessment';
import { createRun, applyAction, endWeek, weekEvent, resolveEvent } from '../../client/src/sim/run';
import { createWinterChallenge } from '../../client/src/sim/scenarios';
import { ensureTracking } from '../../client/src/sim/history';
import { actionStatus, eventChoiceStatus, pastureUse } from '../../client/src/sim/rules';
import { feedRequirementKg } from '../../client/src/sim/nutrition';
import { graze, sheepUnitEquivalent } from '../../client/src/sim/pasture';
import { animalPrice, hayPricePerKg, weeklyCosts } from '../../client/src/sim/economy';
import { exportRun, replayRun } from '../../client/src/sim/replay';
import type { Action, RunState } from '../../client/src/sim/types';
const started=performance.now();
const seeds=[20261001,20261015,20261030];
const out=fileURLToPath(new URL('.',import.meta.url));
const rows:any[]=[];const best:any={};let timeout=false;
const units=(s:RunState)=>s.animals.reduce((sum,a)=>sum+(a.alive?sheepUnitEquivalent(a):0),0);
interface Params{retained:number;sellWeek:number;order:string;cap:number;reserve:number;vaccine:boolean}
function play(seed:number,scenario:string,p:Params){
 let state=scenario==='year'?createRun(seed):(()=>{const {tracking:_,...preset}=createWinterChallenge();return ensureTracking({...preset,seed},'new-run')})();
 const initialUnits=units(state);let sold=false;let failure:string|null=null;
 function attempt(action:Action){if(actionStatus(state,action).reason)return false;const next=applyAction(state,action);if(next===state)return false;state=next;return true;}
 for(let w=0;w<13&&!state.ended;w++){
  if(!sold&&state.week>=p.sellWeek){const herd=state.animals.filter(a=>a.alive).sort((a,b)=>p.order==='sheep-first'?Number(a.species==='yak')-Number(b.species==='yak')||a.bcs-b.bcs||b.ageWeeks-a.ageWeeks:Number(a.species==='sheep')-Number(b.species==='sheep')||a.bcs-b.bcs||b.ageWeeks-a.ageWeeks);let keep=units(state);const ids:string[]=[];for(const a of herd){const u=sheepUnitEquivalent(a);if(keep-u>=initialUnits*p.retained){ids.push(a.id);keep-=u;}}if(ids.length)attempt({kind:'sell',animalIds:ids});sold=true;}
  attempt({kind:'vet'});
  if(p.vaccine&&!state.tech.vaccinated&&state.week===(scenario==='year'?1:10))attempt({kind:'tech',tech:'vaccine'});
  for(let a=0;a<5&&state.actionsLeft>0;a++){
   const need=feedRequirementKg(state.animals.filter(a=>a.alive));let gap=need*(1+p.reserve)-state.grazedKg-state.hayKg;
   if(gap<=0)break;
   const cell=state.pasture.filter(c=>pastureUse(state,c)==='resting').map(c=>({c,r:graze(c,state.animals.filter(a=>a.alive))})).filter(({r})=>r.cell.degradation<=p.cap&&r.consumedKg>0).sort((a,b)=>b.r.consumedKg-a.r.consumedKg||b.c.restedWeeks-a.c.restedWeeks||a.c.id.localeCompare(b.c.id))[0];
   if(cell&&attempt({kind:'graze',cellId:cell.c.id}))continue;
   const price=hayPricePerKg(state.season,state.weather==='blizzard');const maint=weeklyCosts(state.labor,{...state.tech,collared:state.animals.filter(a=>a.alive&&a.collar).length});
   const amount=Math.ceil(gap);if(Math.round(amount*price)+maint+1<=state.money&&attempt({kind:'buy-hay',kg:amount}))continue;
   const herd=state.animals.filter(a=>a.alive).sort((a,b)=>a.bcs-b.bcs||animalPrice(b,state.season)-animalPrice(a,state.season));const sell=herd.find(a=>units(state)-sheepUnitEquivalent(a)>=initialUnits*p.retained);
   if(sell&&attempt({kind:'sell',animalIds:[sell.id]}))continue;
   const affordable=Math.max(0,Math.floor((state.money-maint-1)/price));if(affordable>0&&attempt({kind:'buy-hay',kg:Math.min(amount,affordable)}))continue;
   break;
  }
  if(state.actionsLeft>0&&state.week<=3)attempt({kind:'breed'});
  state=endWeek(state);
  if(!state.ended){const card=weekEvent(state);if(card){const choice=card.choices.find(c=>eventChoiceStatus(state,card.id,c.id).reason===null);if(!choice){failure='event unresolved';break;}const next=resolveEvent(state,card.id,choice.id);if(next===state){failure='event rejected';break;}state=next;}}
 }
 const a=assessRun(state);return{state,a,failure};
}
for(const retained of [.5,.55,.65,.8,1])for(const sellWeek of [1,4,7,10])for(const order of ['sheep-first','yak-first'])for(const cap of [.4,.65,1])for(const reserve of [0,.2])for(const vaccine of [false,true]){
 if(performance.now()-started>120000){timeout=true;break;}
 const p={retained,sellWeek,order,cap,reserve,vaccine};
 for(const scenario of ['year','winter-challenge-v1'])for(const seed of seeds){const r=play(seed,scenario,p);const key=`${scenario}:${seed}`;const a=r.a;const row={scenario,seed,p,ended:r.state.ended,ending:r.state.ending,eligible:a.eligible,failure:r.failure,economy:a.economy,ecology:a.ecology,health:a.health,overall:a.overall,retainedShare:a.retainedShare,money:r.state.money,hayKg:r.state.hayKg,netAssets:a.metrics.netAssets};rows.push(row);const score=Number(a.eligible)*1000+Math.min(a.economy/40,a.ecology/60,a.health/70,a.retainedShare/.5)*100+a.overall/100;if(!best[key]||score>best[key].score){best[key]={score,row,state:r.state};}}
}
mkdirSync(out,{recursive:true});
const summary=Object.entries(best).map(([key,b]:any)=>({key,...b.row}));
for(const[key,b]of Object.entries(best)as any){if(b.row.eligible){const serialized=exportRun(b.state);const replayed=replayRun(serialized);if(!assessRun(replayed).eligible)throw Error('eligible replay mismatch');writeFileSync(`${out}/feasible-${key.replace(':','-')}.json`,serialized);}}
writeFileSync(`${out}/bounded-feasibility-results.json`,JSON.stringify({schema:'muyun-bounded-feasibility-v1',seeds,elapsedMs:performance.now()-started,timeout,params:'5 retained × 4 sale week × 2 sale order × 3 degradation caps × 2 reserve × 2 vaccine',method:'Current-state deterministic rules. No future random inspection; same first-affordable event selector. Diagnostic parameter search, not a validated formal baseline. All failures preserved.',summary,rows},null,2));
console.log(JSON.stringify({runs:rows.length,elapsedMs:performance.now()-started,timeout,eligibleCount:rows.filter(r=>r.eligible).length,summary},null,2));
