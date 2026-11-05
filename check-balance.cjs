'use strict';
const assert=require('node:assert/strict');
const CONFIG=require('./race-config.cjs');
const {makeHorse,resetRace,stepRace,FINAL_START}=require('./race-engine');
const tap=(h,t,interval=4)=>{h.conserve=false;if(t%interval===0)h.tapQueue=1;};
const hold=h=>{h.conserve=true;h.effort=0;h.tapQueue=0;};
const saveAndLaunch=(save=35,launch=FINAL_START)=>(h,t)=>h.progress>=save&&h.progress<launch?hold(h):tap(h,t);
const paceFront=(h,t)=>h.stamina<30?hold(h):tap(h,t);
function run(plans,{practice=false,validate=true}={}){
 const r={practice,horses:plans.map(p=>makeHorse(p.slot))};resetRace(r);r.status='running';
 const checkpoints=plans.map(()=>({})),spurts=plans.map(()=>false);let crossing=null;
 for(let t=0;t<3000&&r.status==='running';t++){
  const previous=r.horses.map(h=>({...h}));
  r.horses.forEach((h,i)=>{if(h.finish==null&&(!practice||h.slot===7))plans[i].policy(h,t)});
  stepRace(r,.05);
  if(validate)r.horses.forEach((h,i)=>{
   assert(h.stamina>=0&&h.stamina<=100);assert(h.reserve>=0&&h.reserve<=100);assert(h.progress>=previous[i].progress&&h.progress<=100);
   assert(h.progress-previous[i].progress<=CONFIG.maxPace*CONFIG.speedScale*.05+1e-9,'no catch-up teleport');assert(h.speed<=CONFIG.maxPace*CONFIG.speedScale);
   if(previous[i].progress>=FINAL_START)assert(h.reserve<=previous[i].reserve,'no reserve generation on home straight');
   if(h.spurt){assert(previous[i].progress>=FINAL_START);assert(!h.conserve);spurts[i]=true;}
   for(const pct of [25,50,FINAL_START,90])if(!checkpoints[i][pct]&&h.progress>=pct)checkpoints[i][pct]={time:r.elapsed,reserve:h.reserve,stamina:h.stamina};
  });
  const closer=r.horses.find(h=>h.slot===2),front=r.horses.find(h=>h.slot===0);
  if(closer&&front&&closer.progress>=FINAL_START&&closer.progress>front.progress&&crossing==null)crossing=closer.progress*CONFIG.distance/100;
 }
 assert.equal(r.status,'finished');return{r,checkpoints,spurts,crossing};
}
assert.equal(CONFIG.distance,1400);assert.equal(CONFIG.homeStraight,500);
const styleList=Array.from({length:9},(_,i)=>makeHorse(i).style);
assert.deepEqual(styleList,['front','front','closer','closer','closer','closer','closer','closer','closer']);
const plans=[saveAndLaunch(48),paceFront,saveAndLaunch(),(h,t)=>tap(h,t,3),()=>{},hold,saveAndLaunch(35,85),saveAndLaunch(),saveAndLaunch()].map((policy,slot)=>({slot,policy}));
const mixed=run(plans),h=mixed.r.horses;
assert(mixed.checkpoints[0][25].time<mixed.checkpoints[2][25].time,'same early inputs: front-runner must lead');
assert(mixed.checkpoints[2][FINAL_START].time>mixed.checkpoints[0][FINAL_START].time,'closer enters the straight behind');
assert(h[2].finish+.25<h[0].finish,'well-timed closer beats a strong front-runner');
assert.equal(mixed.r.finishOrder[0],2);assert(mixed.crossing>900&&mixed.crossing<1400,'visible final-straight comeback');
assert(mixed.spurts[2]);assert.equal(h[4].reserve,0);assert(!mixed.spurts[4]&&!mixed.spurts[5]);assert(h[5].reserve>90);
assert(h[6].finish>h[2].finish+3,'late launch costs time');assert(h[0].finish<h[6].finish,'front-runner can beat poorly timed closer');
assert.deepEqual(run(plans).r,mixed.r,'same inputs reproduce result');
assert.equal(h[2].finish,h[7].finish,'bride gets the same closer stats');
const equal=run(Array.from({length:9},(_,slot)=>({slot,policy:saveAndLaunch()}))).r.horses;
assert.equal(equal[0].finish,equal[1].finish);assert(equal.slice(2).every(x=>x.finish===equal[2].finish),'equal stats within each style');
assert(equal[2].finish<equal[0].finish,'identical save/launch favors closer');
for(const slot of [0,1,2,3,4,5,6,7,8]){
 const alone=run([{slot,policy:saveAndLaunch()}]).r.horses[0];
 assert.equal(alone.finish,equal[slot].finish,'no rank-dependent boost or rubber-banding');
}
const gridBest=slot=>{
 let best=Infinity;
 for(let save=0;save<=60;save+=2)for(let launch=55;launch<=85;launch+=2){
  const time=run([{slot,policy:saveAndLaunch(save,launch)}],{validate:false}).r.horses[0].finish;
  best=Math.min(best,time);
 }
 return best;
};
const bestFront=gridBest(0),bestCloser=gridBest(2);assert(bestCloser+.5<bestFront,'timing sweep should favor closers, not one cherry-picked input');
const practice=run(plans,{practice:true}).r;assert.deepEqual(run(plans,{practice:true}).r,practice);assert.equal(practice.finishOrder.length,9);assert(practice.horses[8].acceptedTaps>0&&practice.horses[8].finish>0);
resetRace(mixed.r);assert(mixed.r.horses.every(x=>x.reserve===0&&!x.spurt&&x.stamina===100));assert.deepEqual(mixed.r.horses.map(x=>x.style),styleList);
console.log('PASS: 1400m; 1–2 front / 3–9 closer; early front lead and late reversal; finite reserve; late-launch penalty; front can win; within-style fairness; no rank boost; deterministic practice/replay; reset.');
console.log('Best timing sweep: front '+bestFront.toFixed(2)+'s / closer '+bestCloser.toFixed(2)+'s. Mixed-race pass at '+Math.round(mixed.crossing)+'m.');
