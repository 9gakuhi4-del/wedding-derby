'use strict';
const CONFIG=require('./race-config.cjs');
const FINAL_START=(CONFIG.distance-CONFIG.homeStraight)/CONFIG.distance*100;
const runningStyle=slot=>slot<CONFIG.frontSlots?'front':'closer';
const PROFILES=Object.freeze({front:Object.freeze({earlyPace:.3,reserveRate:2.8,burst:.65}),closer:Object.freeze({earlyPace:0,reserveRate:4.2,burst:2.3})});
function makeHorse(slot){return{slot,style:runningStyle(slot),name:slot===7?'新婦':`ゲスト${slot+1}`,female:[1,4,7].includes(slot),bride:slot===7,token:null,socketId:null,ready:false,active:true,progress:0,stamina:100,reserve:0,spurt:false,speed:0,effort:0,tapQueue:0,acceptedTaps:0,lastInputTick:-1000,finish:null,conserve:false,lastAcceptedTick:-1000}}
function resetRace(r){r.status='lobby';r.startAt=null;r.elapsed=0;r.tick=0;r.finishOrder=[];for(const h of r.horses)Object.assign(h,{style:runningStyle(h.slot),ready:false,active:true,progress:0,stamina:100,reserve:0,spurt:false,speed:0,effort:0,tapQueue:0,acceptedTaps:0,lastInputTick:-1000,finish:null,conserve:false,lastAcceptedTick:-1000})}
function practiceInput(h,tick){
 // CPU uses the same style, stamina and accepted-input rules as human players.
 if(h.style==='front'){
  const recoverAt=h.slot===0?32:38;
  if(h.stamina<recoverAt){h.conserve=true;h.tapQueue=0;h.effort=0;}
  else{h.conserve=false;if(tick%4===0)h.tapQueue=1;}
  return;
 }
 const chargeAt=[0,0,39,34,44,37,31,0,41][h.slot],launchAt=FINAL_START+[0,0,2,-1,4,1,0,0,3][h.slot];
 if(h.progress>=chargeAt&&h.progress<launchAt){h.conserve=true;h.tapQueue=0;h.effort=0;}
 else{h.conserve=false;if(tick%4===0)h.tapQueue=1;}
}
function stepRace(r,dt){
 r.tick++;r.elapsed=r.tick*dt;const finishers=[];
 for(const h of r.horses){
  if(!h.active||h.finish!=null)continue;
  if(r.practice&&h.slot!==7)practiceInput(h,r.tick);
  let accepted=0;
  if(h.tapQueue>0&&r.tick-h.lastAcceptedTick>=3){accepted=1;h.tapQueue--;h.lastAcceptedTick=r.tick;h.acceptedTaps++;h.lastInputTick=r.tick;}
  h.effort=Math.max(0,h.effort-dt*(h.conserve?5:1.8));if(accepted)h.effort=Math.min(1,h.effort+.4);
  const final=h.progress>=FINAL_START,profile=PROFILES[runningStyle(h.slot)];
  // Explicitly easing off before the straight banks a finite finishing reserve.
  if(!final)h.reserve=Math.max(0,Math.min(100,h.reserve+dt*(h.conserve?profile.reserveRate:-.65*h.effort)));
  const boost=final&&!h.conserve&&h.effort>.25?profile.burst*Math.min(1,h.reserve/22)*Math.min(1,h.stamina/28)*h.effort:0;
  h.spurt=boost>.15;
  if(boost>0)h.reserve=Math.max(0,h.reserve-dt*8*h.effort);
  const drain=h.conserve?-5.2:h.effort>.25?6.2*h.effort+boost*1.5:-2;
  h.stamina=Math.max(0,Math.min(100,h.stamina-dt*drain));
  const strength=.50+.50*Math.min(1,h.stamina/24);
  const early=!final?profile.earlyPace*h.effort:0;
  const target=((h.conserve?2.35:2.45+1.4*h.effort+early)*strength+boost)*CONFIG.speedScale;
  h.speed+=(target-h.speed)*Math.min(1,dt*4.5);
  const old=h.progress;h.progress=Math.min(100,old+h.speed*dt);
  if(h.progress>=100){h.finish=r.elapsed-dt+(100-old)/h.speed;h.spurt=false;finishers.push(h);}
 }
 finishers.sort((a,b)=>a.finish-b.finish||a.slot-b.slot);r.finishOrder.push(...finishers.map(h=>h.slot));
 if(r.horses.every(h=>!h.active||h.finish!=null))r.status='finished';
}
module.exports={makeHorse,resetRace,stepRace,FINAL_START,runningStyle};
