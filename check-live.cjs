'use strict';
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{io}=require('socket.io-client');
const port=10123,server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']}),sockets=[];
let output='';server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
async function until(predicate,timeout=5000){const start=Date.now();while(!predicate()){if(Date.now()-start>timeout)throw Error('Timed out waiting for state');await wait(25)}}
async function connect(){const socket=io(`http://127.0.0.1:${port}`,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(socket);socket.on('state',s=>socket.latest=s);await until(()=>socket.connected);return socket}
const call=(s,event,data={})=>new Promise((resolve,reject)=>s.timeout(3000).emit(event,data,(e,r)=>e?reject(e):resolve(r)));
(async()=>{try{
 await until(()=>output.includes('listening'));const host=await connect(),spectator=await connect(),players=[];
 const created=await call(host,'createRoom',{practice:false}),code=created.room.code;assert(created.ok);assert.equal(created.room.round,1);assert(!(JSON.stringify(created.room).includes(created.hostToken)));
 await call(spectator,'screenJoin',{code});assert.equal((await call(spectator,'startRace')).error,'HOST_AUTH');
 for(let i=0;i<8;i++){const socket=await connect(),joined=await call(socket,'joinRoom',{code,slot:i,name:`試験${i+1}`});assert(joined.ok);players.push({socket,token:joined.token});}
 assert.equal((await call(host,'startRace')).error,'NOT_READY');
 players.forEach(p=>p.socket.emit('ready',{ready:true}));await until(()=>host.latest.horses.every(h=>h.ready));assert((await call(host,'startRace')).ok);assert.equal((await call(host,'startRace')).error,'INVALID_STATE');
 await until(()=>host.latest.status==='running');assert.equal((await call(host,'resetRace')).error,'INVALID_STATE');
 let strategy=true;host.on('state',s=>{if(!strategy||s.status!=='running')return;const h=s.horses[7];if(h.finish!=null)return;if(h.stamina<28&&h.progress<67&&!h.conserve)players[7].socket.emit('conserve',{active:true});if((!h.conserve||h.stamina>42||h.progress>=67)&&s.tick%4===0)players[7].socket.emit('tapBatch',{count:1});});
 await until(()=>host.latest.horses[7].acceptedTaps>=8);const before=host.latest.horses[7].acceptedTaps;assert(host.latest.horses[7].progress>host.latest.horses[0].progress);assert(host.latest.horses[7].stamina<100);
 players[2].socket.disconnect();await until(()=>!host.latest.horses[2].connected);const rejoined=await connect();assert((await call(rejoined,'joinRoom',{code,token:players[2].token})).ok);players[2].socket=rejoined;
 spectator.emit('tapBatch',{count:3});assert((await call(spectator,'resetRace')).error==='HOST_AUTH');
 await until(()=>host.latest.status==='finished',65000);strategy=false;await until(()=>spectator.latest.status==='finished');const final=host.latest;assert.equal(final.finishOrder.length,8);assert.equal(final.finishOrder[0],7);assert(final.horses[7].acceptedTaps>before);assert.deepEqual(spectator.latest.finishOrder,final.finishOrder);assert.deepEqual(spectator.latest.horses.map(h=>h.finish),final.horses.map(h=>h.finish));assert(final.horses.every(h=>h.progress===100&&h.stamina>=0));
 assert((await call(host,'resetRace')).ok);assert.equal(host.latest.round,2);assert(host.latest.horses.every(h=>!h.ready&&h.progress===0&&h.finish==null));assert.equal((await call(host,'startRace')).error,'NOT_READY');
 assert.equal((await call(host,'releaseSlot',{slot:0})).error,'SLOT_CONNECTED');players[0].socket.disconnect();await until(()=>!host.latest.horses[0].connected);assert((await call(host,'releaseSlot',{slot:0})).ok);assert(!host.latest.horses[0].claimed);const replacement=await connect();const joined=await call(replacement,'joinRoom',{code,slot:0,name:'交代ゲスト'});assert(joined.ok);assert.notEqual(joined.token,players[0].token);players[0].socket=replacement;
 players.forEach(p=>p.socket.emit('ready',{ready:true}));await until(()=>host.latest.horses.every(h=>h.ready));assert((await call(host,'startRace')).ok);assert.equal(host.latest.status,'countdown');assert.equal(host.latest.round,2);
 console.log('PASS: 8 players + spectator; readiness gate; real inputs affect winner; reconnect; matching final times; protected reset; round 2; released seat replacement.');
 }finally{sockets.forEach(s=>s.disconnect());server.kill();}
})().catch(e=>{console.error(e);console.error(output);process.exitCode=1});
