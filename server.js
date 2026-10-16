const express=require('express');
const http=require('http');
const crypto=require('crypto');
const {Server}=require('socket.io');
const {makeHorse,resetRace,stepRace}=require('./race-engine');
const app=express(),server=http.createServer(app),io=new Server(server,{transports:['websocket','polling'],maxHttpBufferSize:16384});
const rooms=new Map(),PORT=process.env.PORT||10000,VERSION='natural-look-1';
app.use(express.static(require('path').join(__dirname,'public'),{setHeaders(res,p){if(p.endsWith('.html')||p.endsWith('.js')||p.endsWith('.css'))res.setHeader('Cache-Control','no-cache')}}));
app.get('/health',(_,res)=>res.json({ok:true,version:VERSION,rooms:rooms.size}));
function roomCode(){let c;do{c=crypto.randomBytes(3).toString('hex').slice(0,5).toUpperCase()}while(rooms.has(c));return c}
const token=()=>crypto.randomBytes(24).toString('hex');
const name=(n,f)=>String(n||'').trim().slice(0,14)||f;
function state(r){return{code:r.code,round:r.round,count:8,status:r.status,startAt:r.startAt,elapsed:r.elapsed,tick:r.tick,serverNow:Date.now(),practice:r.practice,finishOrder:[...r.finishOrder],hostConnected:!!r.hostId,horses:r.horses.map(h=>({slot:h.slot,name:h.name,female:h.female,bride:h.bride,connected:!!h.socketId,claimed:!!h.token,ready:h.ready,active:h.active,progress:h.progress,stamina:h.stamina,speed:h.speed,effort:h.effort,acceptedTaps:h.acceptedTaps,lastInputTick:h.lastInputTick,finish:h.finish,conserve:h.conserve}))}}
function emit(r){io.to(r.code).emit('state',state(r));r.updatedAt=Date.now()}
function leave(socket){const d=socket.data||{},r=rooms.get(d.room);if(!r)return;socket.leave(r.code);if(d.role==='host'&&r.hostId===socket.id)r.hostId=null;if(d.role==='player'){const h=r.horses[d.slot];if(h?.socketId===socket.id)h.socketId=null}socket.data={};emit(r)}
function host(socket){const r=rooms.get(socket.data?.room);return r&&socket.data.role==='host'&&r.hostId===socket.id?r:null}
function input(h,r,count){if(!h||!h.active||h.finish!=null)return;const n=Math.min(3,Math.max(0,Math.floor(Number(count)||0)));h.tapQueue=Math.min(3,h.tapQueue+n);h.conserve=false;h.lastInputTick=r.tick}
io.on('connection',socket=>{
 socket.on('createRoom',({practice=false}={},cb=()=>{})=>{leave(socket);const r={code:roomCode(),round:1,practice:!!practice,hostId:socket.id,hostToken:token(),createdAt:Date.now(),updatedAt:Date.now(),horses:Array.from({length:8},(_,i)=>makeHorse(i))};resetRace(r);rooms.set(r.code,r);socket.join(r.code);socket.data={room:r.code,role:'host'};cb({ok:true,hostToken:r.hostToken,room:state(r)});emit(r)});
 socket.on('hostJoin',({code,hostToken}={},cb=()=>{})=>{const r=rooms.get(String(code||'').toUpperCase());if(!r)return cb({ok:false,error:'ROOM_NOT_FOUND'});if(hostToken!==r.hostToken)return cb({ok:false,error:'HOST_AUTH'});leave(socket);r.hostId=socket.id;socket.join(r.code);socket.data={room:r.code,role:'host'};cb({ok:true,room:state(r)});emit(r)});
 socket.on('screenJoin',({code}={},cb=()=>{})=>{const r=rooms.get(String(code||'').toUpperCase());if(!r)return cb({ok:false,error:'ROOM_NOT_FOUND'});leave(socket);socket.join(r.code);socket.data={room:r.code,role:'screen'};cb({ok:true,room:state(r)})});
 socket.on('joinRoom',({code,slot,name:n,token:t}={},cb=()=>{})=>{const r=rooms.get(String(code||'').toUpperCase());if(!r||r.practice)return cb({ok:false,error:'ROOM_NOT_FOUND'});let h=t?r.horses.find(h=>h.token===t):null;if(!h){if(r.status!=='lobby')return cb({ok:false,error:'RACE_STARTED'});const i=Number(slot);if(!Number.isInteger(i)||i<0||i>7)return cb({ok:false,error:'INVALID_SLOT'});h=r.horses[i];if(h.token)return cb({ok:false,error:'SLOT_TAKEN'});h.token=token()}leave(socket);h.socketId=socket.id;h.name=name(n,h.name);socket.join(r.code);socket.data={room:r.code,role:'player',slot:h.slot,token:h.token};cb({ok:true,slot:h.slot,token:h.token,room:state(r)});emit(r)});
 socket.on('ready',({ready=true}={})=>{const r=rooms.get(socket.data.room),h=r?.horses[socket.data.slot];if(socket.data.role==='player'&&h?.socketId===socket.id&&r.status==='lobby'){h.ready=!!ready;emit(r)}});
 socket.on('hostConfig',({names}={})=>{const r=host(socket);if(!r||r.status!=='lobby')return;if(Array.isArray(names))names.slice(0,8).forEach((n,i)=>r.horses[i].name=name(n,r.horses[i].name));emit(r)});
 socket.on('startRace',(_data={},cb=()=>{})=>{const r=host(socket);if(!r)return cb({ok:false,error:'HOST_AUTH'});if(r.status!=='lobby')return cb({ok:false,error:'INVALID_STATE'});const connected=r.horses.filter(h=>h.socketId);if(!r.practice&&(!connected.length||connected.some(h=>!h.ready)))return cb({ok:false,error:'NOT_READY'});resetRace(r);r.horses.forEach(h=>h.active=r.practice||!!h.socketId);r.status='countdown';r.startAt=Date.now()+3000;emit(r);cb({ok:true})});
 socket.on('resetRace',(_data={},cb=()=>{})=>{const r=host(socket);if(!r)return cb({ok:false,error:'HOST_AUTH'});if(r.status!=='finished'&&!r.practice)return cb({ok:false,error:'INVALID_STATE'});if(r.status!=='lobby')r.round++;resetRace(r);emit(r);cb({ok:true})});
 socket.on('releaseSlot',({slot}={},cb=()=>{})=>{const r=host(socket);if(!r)return cb({ok:false,error:'HOST_AUTH'});if(r.status!=='lobby')return cb({ok:false,error:'INVALID_STATE'});const h=Number.isInteger(slot)&&slot>=0&&slot<8?r.horses[slot]:null;if(!h)return cb({ok:false,error:'INVALID_SLOT'});if(h.socketId)return cb({ok:false,error:'SLOT_CONNECTED'});h.token=null;h.ready=false;emit(r);cb({ok:true})});
 socket.on('tapBatch',({count=1}={})=>{const r=rooms.get(socket.data.room);if(!r||r.status!=='running')return;const h=r.horses[socket.data.slot];if(socket.data.role==='player'&&h?.socketId===socket.id&&h.token===socket.data.token)input(h,r,count)});
 socket.on('hostTap',()=>{const r=host(socket);if(r?.practice&&r.status==='running')input(r.horses[7],r,1)});
 socket.on('conserve',({active=true}={})=>{const r=rooms.get(socket.data.room);if(!r||r.status!=='running')return;const h=socket.data.role==='host'&&r.practice&&r.hostId===socket.id?r.horses[7]:socket.data.role==='player'?r.horses[socket.data.slot]:null;if(h&&(h.socketId===socket.id||r.practice)){h.conserve=!!active;h.tapQueue=0;h.effort=0;emit(r)}});
 socket.on('disconnect',()=>leave(socket));
});
setInterval(()=>{for(const r of rooms.values()){if(r.status==='countdown'&&Date.now()>=r.startAt)r.status='running';if(r.status==='running'){stepRace(r,.05);emit(r)}}},50);
setInterval(()=>{for(const [c,r]of rooms)if(Date.now()-r.updatedAt>45*60*1000)rooms.delete(c)},60000).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`Wedding Derby ${VERSION} listening on ${PORT}`));
