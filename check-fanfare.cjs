'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const audioCode=fs.readFileSync('public/audio.js','utf8'),gameCode=fs.readFileSync('public/game.js','utf8'),html=fs.readFileSync('public/index.html','utf8');
const flush=()=>new Promise(r=>setImmediate(r));
function harness({fail=false,delayed=false,blocked=false}={}){
 const sources=[],errors=[],requests=[];let release;
 const wait=delayed?new Promise(r=>release=r):Promise.resolve();
 const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}});
 const buffer=(seconds)=>({duration:seconds,sampleRate:300,length:seconds*300,numberOfChannels:2,getChannelData:()=>new Float32Array(seconds*300)});
 class AC{
  constructor(){this.state='suspended';this.currentTime=0;this.destination={}}
  resume(){if(blocked)return Promise.reject(Error('blocked'));this.state='running';return Promise.resolve()}
  createGain(){return{gain:param(),connect(){},disconnect(){}}}
  createBufferSource(){const s={connect(){},disconnect(){},start(...args){this.started=args},stop(...args){this.stopped=args},end(){this.ended=true;this.onended?.()}};sources.push(s);return s}
  createOscillator(){const s=this.createBufferSource();s.frequency=param();return s}
  createBuffer(ch,n,rate){return{duration:n/rate,numberOfChannels:ch,sampleRate:rate,length:n,getChannelData:()=>new Float32Array(n)}}
  decodeAudioData(data){return Promise.resolve(buffer(data==='fanfare'?21.6:28.6))}
 }
 const context={window:{AudioContext:AC,RACE_CONFIG:require('./race-config.cjs')},AbortController,setTimeout,clearTimeout,performance:{now:()=>0},Date,console,fetch:async url=>{
  requests.push(url);if(url.includes('fanfare')){await wait;if(fail)throw Error('network');return{ok:true,arrayBuffer:async()=> 'fanfare'}}
  return{ok:true,arrayBuffer:async()=> 'score'};
 }};
 vm.createContext(context);vm.runInContext(audioCode,context);
 const audio=new context.window.RaceAudio({onError:e=>errors.push(e)});
 return{audio,context,sources,errors,requests,release};
}
const lobby={code:'TEST1',round:1,status:'lobby',finishOrder:[],elapsed:0,startAt:Date.now()+3000};
const running={...lobby,status:'running',elapsed:2};
(async()=>{
 let h=harness();await h.audio.loadFanfare();assert.equal(h.sources.length,0,'preloading must be silent');
 assert.equal(h.requests.filter(u=>u.includes('fanfare')).length,1);
 const first=h.audio.playFanfare();assert.equal(h.audio.fanfareState,'loading');assert.equal(await h.audio.playFanfare(),false);await first;
 assert.equal(h.audio.fanfareState,'playing');assert.equal(h.sources.filter(s=>s.buffer?.duration===21.6).length,1);
 for(let i=0;i<20;i++)h.audio.tick(lobby);assert.equal(h.sources.length,1,'lobby ticks must not stop or layer the cue');
 const node=h.audio.fanfareNode;assert.equal(node.source.loop,false);assert.equal(node.source.stopped,undefined);
 node.source.end();assert.equal(h.audio.fanfareState,'idle');assert.equal(h.audio.nodes.size,0);
 h.audio.tick(lobby);assert.equal(h.sources.length,1,'end must not start a race or music');
 h.audio.tick(running);assert(h.sources.some(s=>s.loop),'normal race loop still starts');
 await h.audio.playFanfare();assert(h.sources.filter(s=>s!==h.audio.fanfareNode.source).every(s=>s.stopped||s.ended),'manual cue stops other scheduled audio');
 h.audio.setEnabled(false);assert.equal(h.audio.fanfareState,'idle');assert.equal(h.audio.on,false);
 await h.audio.playFanfare();assert.equal(h.audio.on,true);const old=h.audio.fanfareNode.source;h.audio.stopFanfare();await h.audio.playFanfare();old.end();assert.equal(h.audio.fanfareState,'playing','late old onended must not clear a new cue');
 h.audio.tick(running);assert.equal(h.audio.fanfareState,'idle','race transition interrupts cue');
 h=harness({delayed:true});const pending=h.audio.playFanfare();h.audio.stopFanfare();h.release();assert.equal(await pending,false);assert.equal(h.sources.length,0,'cancelled download must not play later');
 h=harness({delayed:true});const muted=h.audio.playFanfare();h.audio.setEnabled(false);h.release();await muted;assert.equal(h.sources.length,0,'muting must cancel delayed playback');
 h=harness({fail:true});assert.equal(await h.audio.playFanfare(),false);assert.equal(h.audio.fanfareState,'idle');assert.equal(h.errors.length,1);assert.equal(h.audio.fanfareLoading,null);
 h=harness({blocked:true});assert.equal(await h.audio.playFanfare(),false);assert.equal(h.audio.fanfareState,'idle');assert.equal(h.sources.length,0);
 h=harness();await h.audio.playFanfare();h.audio.tick(lobby,{replayKey:'replay'});assert.equal(h.audio.fanfareState,'idle');
 // Execute the actual controller module with only DOM/renderer/network dependencies stubbed.
 h=harness();const elements=new Map(),handlers={},calls=[];
 for(const match of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){
  const classes=new Set((match[0].match(/class="([^"]*)"/)?.[1]||'').split(/\s+/)),attrs={};
  elements.set(match[1],{disabled:false,textContent:'',style:{},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){if(on??!classes.has(c))classes.add(c);else classes.delete(c)}},setAttribute(k,v){attrs[k]=v},getAttribute:k=>attrs[k],querySelectorAll:()=>[],appendChild(){}});
 }
 const get=id=>{assert(elements.has(id),'Missing element '+id);return elements.get(id)};
 const socket={connected:true,on:(e,fn)=>handlers[e]=fn,timeout(){return this},emit(e,data,cb){calls.push(e);cb?.(null,{ok:true})}};
 Object.assign(h.context,{RaceAudio:h.context.window.RaceAudio,RacePresentation:class{update(){}},io:()=>socket,URLSearchParams,location:{search:'',origin:'http://localhost'},localStorage:{getItem:()=>null,setItem(){}},document:{getElementById:get,body:{classList:{toggle(){}},appendChild(){}},addEventListener(){},activeElement:null},requestAnimationFrame(){}});
 h.context.window.addEventListener=(e,fn)=>handlers[e]=fn;
 h.context.window.RACE_COLORS=['#2774d8','#df7fb5','#d43f3e','#e9cf59','#8462b4','#29977c','#e99b3b','#f4f0e6'];h.context.window.RACE_INK=['#fff','#201d27','#fff','#23271b','#fff','#fff','#221c13','#28251d'];
 const expose="window.test={audio,set(o){if(o.code!==undefined)code=o.code;if(o.slot!==undefined)mySlot=o.slot;if(o.mode!==undefined)mode=o.mode;if(o.room!==undefined)room=o.room;if(o.ready!==undefined)assetsReady=o.ready;if(o.replay!==undefined)replay=o.replay;},accept,render,renderSlots,renderHostControls,toggleFanfare,startRace};";
 vm.runInContext(gameCode.replace(/\}\)\(\);\s*$/,expose+'})();'),h.context);
 const t=h.context.window.test,room={...lobby,horses:Array.from({length:8},(_,slot)=>({slot,connected:true,ready:true,active:true,name:'Test',progress:0})),practice:false};
 t.set({mode:'host',room,ready:true});t.renderHostControls();assert.equal(get('startBtn').disabled,false);assert.equal(get('stageStartBtn').disabled,false);assert.equal(get('stageFanfareBtn').disabled,false);
 // UI gating is tested without invoking the heavyweight presentation render callback.
 t.audio.onFanfareChange=t.renderHostControls;t.toggleFanfare();assert.equal(get('startBtn').disabled,true);assert.equal(get('stageStartBtn').disabled,true);await flush();assert.equal(t.audio.fanfareState,'playing');
 assert.equal(get('stageFanfareBtn').getAttribute('aria-pressed'),'true');await t.startRace();assert(!calls.includes('startRace'));
 t.toggleFanfare();assert.equal(t.audio.fanfareState,'idle');assert.equal(get('startBtn').disabled,false);await t.startRace();assert.equal(calls.filter(e=>e==='startRace').length,1);
 for(const mode of ['player','screen','landing']){t.set({mode});t.renderHostControls();assert(get('stageFanfareBtn').classList.contains('hidden'));assert(get('fanfareBtn').disabled);t.toggleFanfare();assert.equal(t.audio.fanfareState,'idle')}
 t.set({mode:'host'});socket.connected=false;t.renderHostControls();assert(get('fanfareBtn').disabled);socket.connected=true;
 for(const status of ['countdown','running','finished']){t.set({room:{...room,status}});t.renderHostControls();assert(get('fanfareBtn').classList.contains('hidden'))}
 t.set({room,mode:'practice'});t.renderHostControls();assert.equal(get('practiceFanfareBtn').disabled,false);
 t.set({mode:'host',ready:false});t.renderHostControls();assert(get('startBtn').disabled);assert.equal(get('fanfareBtn').disabled,false,'sound check does not require WebGL');
 t.toggleFanfare();await flush();handlers.disconnect();assert.equal(t.audio.fanfareState,'idle');
 const stage=html.indexOf('id="stage"'),cue=html.indexOf('id="stageFanfareBtn"'),afterStage=html.indexOf('id="replayBar"');assert(stage<cue&&cue<afterStage,'fullscreen cue must be inside stage');
 assert.match(fs.readFileSync('public/game.css','utf8'),/\.stage:fullscreen \.stageHostControls\{display:grid\}/);
 assert.equal(calls.filter(e=>e==='startRace').length,1,'fanfare never automatically starts a race');
 // The actual player HUD reads the same authoritative reserve used by the engine.
 h.context.window.RaceCourseSection=d=>d>=900?'最後の直線':'向正面';socket.connected=true;
 const playerRoom={...room,status:'running',horses:room.horses.map(x=>({...x,progress:70,stamina:65,reserve:54,spurt:true,effort:1,speed:3,finish:null,acceptedTaps:100,conserve:false}))};
 t.set({mode:'player',room:playerRoom,slot:7});t.render();assert.equal(get('reserveValue').textContent,'54%');assert.equal(get('reserveFill').style.width,'54%');assert.equal(get('reserveStatus').textContent,'発動中');assert(get('controller').classList.contains('spurting'));assert.equal(get('playerDistance').textContent,'980 / 1400m');assert.equal(get('distance').innerHTML,'420 <small>m</small>');assert.match(get('paceAdvice').textContent,/末脚発動/);assert.equal(get('yourStyle').textContent,'差し型');assert.match(get('broadcastText').textContent,/最後の直線/);
 playerRoom.horses[7].spurt=false;playerRoom.horses[7].reserve=0;t.render();assert.equal(get('reserveStatus').textContent,'末脚なし');assert(!get('controller').classList.contains('spurting'));
 t.set({slot:0});t.render();assert.equal(get('yourStyle').textContent,'先行型');t.set({slot:1});t.render();assert.equal(get('yourStyle').textContent,'先行型');t.set({slot:2});t.render();assert.equal(get('yourStyle').textContent,'差し型');assert.match(get('ranking').innerHTML,/先行/);assert.match(get('ranking').innerHTML,/差し/);
 t.set({mode:'join',room,slot:null});t.renderSlots();assert.equal((get('slotGrid').innerHTML.match(/styleTag front/g)||[]).length,2);assert.equal((get('slotGrid').innerHTML.match(/styleTag closer/g)||[]).length,6);
 t.set({mode:'host'});t.render();assert.equal((get('roster').innerHTML.match(/styleTag front/g)||[]).length,2);assert.equal((get('roster').innerHTML.match(/styleTag closer/g)||[]).length,6);
 // Start transitions must not request fullscreen, focus, scroll or modify the viewport.
 let fullscreenCalls=0;get('stage').requestFullscreen=async()=>{fullscreenCalls++};
 h.context.window.matchMedia=()=>({matches:true});
 t.set({mode:'player',slot:7,code:room.code,room});
 for(const status of ['lobby','countdown','running','running','finished'])t.accept({...playerRoom,status,serverNow:Date.now(),tick:status==='running'?20:0});
 assert.equal(fullscreenCalls,0,'race state must not request fullscreen');
 h.context.navigator={vibrate(){}};t.set({room:playerRoom,replay:null});get('tapBtn').onpointerdown({preventDefault(){}});get('conserveBtn').onpointerdown({preventDefault(){}});assert(calls.includes('tapBatch')&&calls.includes('conserve'),'both controls still send real input events');
 await get('fullscreenBtn').onclick();assert.equal(fullscreenCalls,0,'mobile player cannot hide controls in stage-only fullscreen');
 t.set({mode:'practice'});await get('fullscreenBtn').onclick();assert.equal(fullscreenCalls,0);
 t.set({mode:'host'});await get('fullscreenBtn').onclick();assert.equal(fullscreenCalls,1,'host explicit fullscreen retained');
 h.context.window.matchMedia=()=>({matches:false});t.set({mode:'player'});await get('fullscreenBtn').onclick();assert.equal(fullscreenCalls,2,'desktop explicit fullscreen retained');
 // Run the shipped presentation too, not only the controller with a presentation stub.
 for(const el of elements.values()){el.addEventListener=()=>{};el.replaceChildren=()=>{};}
 h.context.matchMedia=()=>({matches:false});h.context.TextDecoder=TextDecoder;
 vm.runInContext(fs.readFileSync('public/renderer3d.js','utf8'),h.context);
 const presentation=new h.context.window.RacePresentation();
 for(const status of ['lobby','countdown','running']){
  presentation.update({...playerRoom,status},7,'player',false,false);
  assert(!get('howTo').classList.contains('hidden'));assert(!get('howTo').classList.contains('inRace'),'no automatic start reflow');
 }
 get('howTo').classList.add('hidden');presentation.update(playerRoom,7,'player',false,false);assert(get('howTo').classList.contains('hidden'),'manual help choice preserved');
 const css=fs.readFileSync('public/game.css','utf8');
 assert.match(css,/\.stage>#track\{position:absolute;inset:0;/);
 assert.match(css,/body\.playing #controller\{position:fixed;left:8px;right:8px;bottom:0;/);
 assert.match(css,/grid-template-areas:"horse stamina" "ready ready" "controls controls" "meta meta"/);
 assert.match(css,/input,select,textarea,\.rosterRow input\{font-size:16px\}/);
 assert(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(html),'user pinch zoom remains accessible');
 assert(!/\.howTo\.inRace\{display:none\}/.test(css));
 assert(!/scrollIntoView\(|scrollTo\(|\.focus\(/.test(gameCode),'no unsolicited viewport navigation');
 console.log('PASS: stable mobile inputs, guarded fullscreen, unchanged manual host fullscreen, no automatic start reflow; 1400m roles, player HUD and reserve; silent preload; one-shot cue; no duplicate audio; cancellation during load/play; mute; natural end; BGM/replay transition; download/autoplay failures; host/practice roles; fullscreen containment; start lock; disconnect; unchanged manual start.');
})().catch(e=>{console.error(e);process.exitCode=1});
