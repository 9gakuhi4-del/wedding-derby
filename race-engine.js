'use strict';
function makeHorse(slot){return{slot,name:slot===7?'新婦':`ゲスト${slot+1}`,female:[1,4,7].includes(slot),bride:slot===7,token:null,socketId:null,ready:false,active:true,progress:0,stamina:100,speed:0,effort:0,tapQueue:0,acceptedTaps:0,lastInputTick:-1000,finish:null,conserve:false,lastAcceptedTick:-1000}}
function resetRace(r){r.status='lobby';r.startAt=null;r.elapsed=0;r.tick=0;r.finishOrder=[];for(const h of r.horses)Object.assign(h,{active:true,progress:0,stamina:100,speed:0,effort:0,tapQueue:0,acceptedTaps:0,lastInputTick:-1000,finish:null,conserve:false,lastAcceptedTick:-1000})}
function stepRace(r,dt){r.tick++;r.elapsed=r.tick*dt;const finishers=[];for(const h of r.horses){if(!h.active||h.finish!=null)continue;
 if(r.practice&&h.slot!==7){const strategy=[20,25,32,36,28,24,38][h.slot];h.conserve=h.stamina<strategy&&h.progress<75;if(!h.conserve&&r.tick%(5+h.slot%3)===0)h.tapQueue=1;}
 let accepted=0;if(h.tapQueue>0&&r.tick-h.lastAcceptedTick>=3){accepted=1;h.tapQueue--;h.lastAcceptedTick=r.tick;h.acceptedTaps++;h.lastInputTick=r.tick;}
 h.effort=Math.max(0,h.effort-dt*(h.conserve?5:1.8));if(accepted)h.effort=Math.min(1,h.effort+.4);
 const drain=h.effort>.25?6.8*h.effort:-5.2;h.stamina=Math.max(0,Math.min(100,h.stamina-dt*drain));
 const strength=.50+.50*Math.min(1,h.stamina/24),target=(h.conserve?1.48:1.9+2.35*h.effort)*strength;
 h.speed+=(target-h.speed)*Math.min(1,dt*4.5);const old=h.progress;h.progress=Math.min(100,old+h.speed*dt);
 if(h.progress>=100){h.finish=r.elapsed-dt+(100-old)/h.speed;finishers.push(h)}
 }finishers.sort((a,b)=>a.finish-b.finish||a.slot-b.slot);r.finishOrder.push(...finishers.map(h=>h.slot));if(r.horses.every(h=>!h.active||h.finish!=null))r.status='finished';}
module.exports={makeHorse,resetRace,stepRace};
