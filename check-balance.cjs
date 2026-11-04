'use strict';
const assert=require('node:assert/strict');
const CONFIG=require('./race-config.cjs');
const {makeHorse,resetRace,stepRace,FINAL_START}=require('./race-engine');
const tap=(h,t,interval=4)=>{h.conserve=false;if(t%interval===0)h.tapQueue=1;};
const hold=h=>{h.conserve=true;h.effort=0;h.tapQueue=0;};
const closer=(save=35,launch=FINAL_START)=>(h,t)=>h.progress>=save&&h.progress<launch?hold(h):tap(h,t);
const front=(h,t)=>h.stamina<30?hold(h):tap(h,t);
function run(policies){
 const r={practice:false,horses:policies.map((_,i)=>makeHorse(i))};resetRace(r);r.status='running';
 const checkpoints=policies.map(()=>({})),spurt=policies.map(()=>false);let crossing=null;
 for(let t=0;t<3000&&r.status==='running';t++){
  const previous=r.horses.map(h=>({...h}));r.horses.forEach((h,i)=>{if(h.finish==null)policies[i](h,t)});stepRace(r,.05);
  r.horses.forEach((h,i)=>{
   assert(h.stamina>=0&&h.stamina<=100);assert(h.reserve>=0&&h.reserve<=100);assert(h.progress>=previous[i].progress&&h.progress<=100);
   assert(h.progress-previous[i].progress<.2,'no catch-up teleport');assert(h.speed<=CONFIG.maxPace*CONFIG.speedScale);
   if(previous[i].progress>=FINAL_START)assert(h.reserve<=previous[i].reserve,'no reserve generation in the home straight');
   if(h.spurt){assert(previous[i].progress>=FINAL_START);assert(!h.conserve);spurt[i]=true;}
   for(const pct of [50,FINAL_START,90])if(!checkpoints[i][pct]&&h.progress>=pct)checkpoints[i][pct]={time:r.elapsed,reserve:h.reserve,stamina:h.stamina};
  });
  if(policies.length>1&&r.horses[0].progress>=FINAL_START&&r.horses[0].progress>r.horses[1].progress&&crossing==null)crossing=r.horses[0].progress*CONFIG.distance/100;
 }
 assert.equal(r.status,'finished');return{r,checkpoints,spurt,crossing};
}
const mixed=run([closer(),front,(h,t)=>tap(h,t,3),()=>{},hold,closer(35,85),(h,t)=>tap(h,t,6),closer(0)]);
assert(mixed.checkpoints[0][FINAL_START].time>mixed.checkpoints[1][FINAL_START].time,'closer must enter the straight behind a managed front-runner');
assert(mixed.r.horses[0].finish+2<mixed.r.horses[1].finish,'saved reserve should favor a well-timed closer');
assert(mixed.crossing>CONFIG.distance-CONFIG.homeStraight&&mixed.crossing<CONFIG.distance,'comeback must occur visibly on the home straight');
assert.equal(mixed.r.finishOrder[0],0);assert(mixed.spurt[0]);assert(!mixed.spurt[3]&&!mixed.spurt[4]);
assert.equal(mixed.r.horses[3].reserve,0,'idle must not earn reserve');assert(mixed.r.horses[4].reserve>90,'unused reserve must not automatically accelerate');
assert(mixed.r.horses[5].finish>mixed.r.horses[0].finish+3,'launching too late must have a cost');
assert(mixed.r.horses[1].finish<mixed.r.horses[7].finish,'a managed front-runner can beat excessive waiting');
assert.deepEqual(run([closer(),front]).r,run([closer(),front]).r,'same inputs must reproduce the same result');
const equal=run(Array.from({length:8},()=>closer())).r;assert(equal.horses.every(h=>h.finish===equal.horses[0].finish),'all eight slots, including bride, must have equal stats');
const swapped=run([front,closer()]).r;assert.equal(swapped.horses[1].finish,mixed.r.horses[0].finish);assert.equal(swapped.horses[0].finish,mixed.r.horses[1].finish);
resetRace(mixed.r);assert(mixed.r.horses.every(h=>h.reserve===0&&!h.spurt&&h.stamina===100));
console.log('PASS: 1800m; visible final-straight comeback; finite late reserve; no idle bonus; too-late launch penalty; front-runner still viable; slot equality; deterministic replay; reset.');
console.log('Balanced closer:',equal.horses[0].finish.toFixed(2)+'s','Managed front:',swapped.horses[0].finish.toFixed(2)+'s','Pass at:',Math.round(mixed.crossing)+'m');
