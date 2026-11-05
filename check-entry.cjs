'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm'),{spawn}=require('node:child_process'),{io}=require('socket.io-client');
const {createFixedEntry,TTL}=require('./fixed-entry.cjs'),key='a'.repeat(48),hash=crypto.createHash('sha256').update(key).digest('hex');
const flush=()=>new Promise(r=>setImmediate(r)),wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(predicate,timeout=5000){const start=Date.now();while(!predicate()){if(Date.now()-start>timeout)throw Error('Timed out');await wait(20);}}
const fakeRoom=(code,extra={})=>({code,hostId:'host',status:'lobby',practice:false,updatedAt:0,horses:Array.from({length:9},()=>({token:null,socketId:null})),...extra});
async function unit(){
 const rooms=new Map(),a=fakeRoom('AAAAA'),b=fakeRoom('BBBBB'),p=fakeRoom('CCCCC',{practice:true});for(const r of[a,b,p])rooms.set(r.code,r);const e=createFixedEntry(rooms,hash);
 assert.equal(e.status().status,'waiting');assert.equal(e.publish(null,{key}).error,'HOST_AUTH');assert.equal(e.publish(a,{key:'bad'}).error,'ENTRY_AUTH');assert.equal(e.publish(p,{key}).error,'ENTRY_PRACTICE');
 assert(e.publish(a,{key}).ok);assert.equal(e.status().code,a.code);assert.equal(e.publish(b,{key}).error,'ENTRY_CONFLICT');assert.equal(e.publish(b,{key,replaceCode:'stale'}).error,'ENTRY_CONFLICT');
 a.status='running';assert.equal(e.publish(b,{key,replaceCode:a.code}).error,'ENTRY_RACING');a.status='finished';assert(e.publish(b,{key,replaceCode:a.code}).ok);
 assert.equal(e.publish(a,{key,enabled:false}).error,'ENTRY_NOT_YOURS');assert(e.publish(b,{key,enabled:false}).ok);assert.equal(e.status().code,null);
 b.status='lobby';assert(e.publish(b,{key}).ok);b.updatedAt=0;e.prune(TTL+1);assert(rooms.has(b.code),'connected host must survive long lobby');b.hostId=null;b.horses[8].socketId='player';e.prune(TTL+1);assert(rooms.has(b.code),'connected players must survive');b.horses[8].socketId=null;e.prune(TTL+1);assert(!rooms.has(b.code));assert.equal(e.status().code,null);
 // Guest entry executes the real shipped script; no renderer/audio/fullscreen dependency.
 let state={code:null,status:'waiting',available:0,hostConnected:false},fail=false,token=false,requests=0;const redirects=[],elements=new Map(['entryTitle','entryDetail','retryEntry'].map(id=>[id,{textContent:'',disabled:false}])),handlers={};
 const context={document:{getElementById:id=>elements.get(id),hidden:false,addEventListener:(e,fn)=>handlers[e]=fn},window:{addEventListener:(e,fn)=>handlers[e]=fn},location:{replace:u=>redirects.push(u)},localStorage:{getItem:()=>token?'test-token':null},fetch:async()=>{requests++;if(fail)throw Error('offline');return{ok:true,json:async()=>state};},AbortController,setTimeout:()=>1,clearTimeout(){},console};vm.createContext(context);vm.runInContext(fs.readFileSync('public/entry.js','utf8'),context);await flush();assert.match(elements.get('entryTitle').textContent,/受付開始/);assert.equal(redirects.length,0);
 state={code:'ABCDE',status:'lobby',available:9,hostConnected:false};await elements.get('retryEntry').onclick();assert.match(elements.get('entryTitle').textContent,/接続を待/);
 state.hostConnected=true;state.available=0;await elements.get('retryEntry').onclick();assert.match(elements.get('entryTitle').textContent,/9人/);assert.equal(redirects.length,0);
 state.status='running';await elements.get('retryEntry').onclick();assert.match(elements.get('entryTitle').textContent,/レース中/);
 fail=true;await elements.get('retryEntry').onclick();assert.match(elements.get('entryTitle').textContent,/接続を確認/);assert.equal(elements.get('retryEntry').disabled,false);fail=false;
 handlers.pagehide();const prior=requests;await elements.get('retryEntry').onclick();assert.equal(requests,prior);handlers.pageshow();await flush();
 token=true;await elements.get('retryEntry').onclick();assert.deepEqual(redirects,['/?mode=player&room=ABCDE&entry=fixed']);
 assert(!fs.readFileSync('public/entry.js','utf8').includes('requestFullscreen'));
 // Organizer capability is consumed from the URL fragment, never shared in guest links.
 const nodes=new Map(['organizerNotice','entryPublish','entryClose','fixedEntryPanel','entryHostStatus'].map(id=>[id,{classList:{toggle(){}},disabled:false,textContent:''}])),saved=[],history=[],calls=[],notices=[];let response={ok:true},confirmation=true;
 const h={window:{confirm:()=>confirmation},document:{getElementById:id=>nodes.get(id)},URLSearchParams,location:{hash:'#organizer='+key,pathname:'/',search:''},localStorage:{getItem:()=>null,setItem:(...x)=>saved.push(x)},history:{replaceState:(...x)=>history.push(x)}};vm.createContext(h);vm.runInContext(fs.readFileSync('public/entry-host.js','utf8'),h);const host=new h.window.FixedEntryHost({request:async(e,d)=>{calls.push([e,d]);return response;},notify:m=>notices.push(m)});assert.equal(saved[0][1],key);assert.equal(history[0][2],'/');
 host.update('practice',a,true);await host.set(true);assert.equal(calls.length,0);a.status='lobby';host.update('host',a,true);await host.set(true);assert.equal(calls.length,1);assert.equal(calls[0][1].key,key);assert.match(notices.at(-1),/開始/);
 response={ok:false,error:'ENTRY_CONFLICT',currentCode:'OTHER'};confirmation=false;await host.set(true);assert.equal(calls.length,2);confirmation=true;await host.set(true);assert.equal(calls.length,4);assert.equal(calls[3][1].replaceCode,'OTHER');
 const qr=require('./entry-qr.cjs');assert.equal(qr.GUEST_URL,'https://wedding-derby-live.onrender.com/entry.html');assert.equal(qr.png.readUInt32BE(16),qr.size);assert(qr.size>=900);assert(qr.svg.includes('<svg'));assert(!qr.svg.includes(key));
 console.log('PASS entry unit/UI: authorization; explicit replacement; running-race protection; connected-room retention; waiting/full/racing/reconnect states; returning players; private organizer link; QR bytes.');
}
async function integration(){
 const port=10124,sockets=[];let child,output='';
 const call=(s,event,data={})=>new Promise((resolve,reject)=>s.timeout(3000).emit(event,data,(e,r)=>e?reject(e):resolve(r)));
 const status=async()=>{const r=await fetch('http://127.0.0.1:'+port+'/api/entry');assert.equal(r.headers.get('cache-control'),'no-store');return r.json();};
 async function start(){output='';child=spawn(process.execPath,['-e',`require('./entry-config.cjs');require.cache[require.resolve('./entry-config.cjs')].exports={adminHash:'${hash}'};require('./server.js');`],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);await until(()=>output.includes('listening'));}
 async function stop(){const c=child;if(c){await new Promise(r=>{c.once('exit',r);c.kill();});child=null;}}
 async function connect(){const s=io('http://127.0.0.1:'+port,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(s);s.on('state',v=>s.latest=v);await until(()=>s.connected);return s;}
 try{
  await start();assert.equal((await status()).code,null);const host=await connect(),guest=await connect(),other=await connect(),practice=await connect();
  const first=await call(host,'createRoom'),second=await call(other,'createRoom');await call(practice,'createRoom',{practice:true});
  assert.equal((await status()).code,null,'creating rooms must never publish automatically');assert.equal((await call(guest,'publishEntry',{key})).error,'HOST_AUTH');assert.equal((await call(other,'publishEntry',{key:'x'})).error,'ENTRY_AUTH');assert.equal((await call(practice,'publishEntry',{key})).error,'ENTRY_PRACTICE');
  assert((await call(host,'publishEntry',{key})).ok);assert.equal((await status()).code,first.room.code);assert.equal(host.latest.fixedEntry,true);assert.equal((await status()).available,9);
  const joined=await call(guest,'joinRoom',{code:first.room.code,slot:8,name:'固定QRゲスト'});assert(joined.ok);assert.equal((await status()).available,8);assert(!JSON.stringify(await status()).includes(key));assert(!JSON.stringify(host.latest).includes(key));
  host.disconnect();await until(()=>!guest.latest.hostConnected);assert.equal((await status()).hostConnected,false);const restored=await connect();assert((await call(restored,'hostJoin',{code:first.room.code,hostToken:first.hostToken})).ok);assert.equal((await status()).hostConnected,true);
  guest.emit('ready',{ready:true});await until(()=>restored.latest.horses[8].ready);assert((await call(restored,'startRace')).ok);assert.equal((await call(other,'publishEntry',{key,replaceCode:first.room.code})).error,'ENTRY_RACING');
  assert((await call(restored,'publishEntry',{key,enabled:false})).ok);assert.equal((await status()).code,null);assert(['countdown','running'].includes(restored.latest.status),'closing intake must not stop race');assert((await call(other,'publishEntry',{key})).ok);assert.equal((await status()).code,second.room.code);
  const pngResponse=await fetch('http://127.0.0.1:'+port+'/guest-qr.png');assert.equal(pngResponse.headers.get('content-type'),'image/png');assert(Buffer.from(await pngResponse.arrayBuffer()).equals(require('./entry-qr.cjs').png));
  for(const s of sockets)s.disconnect();await stop();await start();assert.equal((await status()).code,null,'restart safely returns same QR to waiting, not a stale room');const newHost=await connect(),newRoom=await call(newHost,'createRoom');assert((await call(newHost,'publishEntry',{key})).ok);assert.equal((await status()).code,newRoom.room.code);assert.equal((await fetch('http://127.0.0.1:'+port+'/entry.html')).status,200);
  console.log('PASS entry live: real HTTP + sockets; nine seats; no accidental practice activation; host-only authenticated publication; host reconnect; close without disrupting race; restart and republish using unchanged guest URL/QR.');
 }catch(e){console.error(output);throw e;}finally{for(const s of sockets)s.disconnect();await stop();}
}
(async()=>{await unit();await integration();})().catch(e=>{console.error(e);process.exitCode=1;});
