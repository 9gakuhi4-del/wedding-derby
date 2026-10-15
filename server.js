const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { transports: ['websocket','polling'] });
const PORT = process.env.PORT || 10000;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true, rooms: rooms.size }));

const rooms = new Map();
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function code() {
  let c;
  do { c = Array.from({length:5},()=>ALPH[Math.floor(Math.random()*ALPH.length)]).join(''); }
  while (rooms.has(c));
  return c;
}
function makeHorse(i) {
  const number=i+1;
  const female=[2,5,8].includes(number);
  const bride=number===8;
  return { slot:i, name:bride?'新婦':`ゲスト${number}`, female, bride, token:null, socketId:null, ready:false, progress:0, stamina:100, finish:null, tapQueue:0, lastTapAt:0, speed:0, effort:0, taps:0 };
}
function publicRoom(r) {
  return {
    code:r.code, count:r.count, status:r.status, startAt:r.startAt, elapsed:r.elapsed,
    finishOrder:r.finishOrder.slice(), hostConnected:!!r.hostId,
    horses:r.horses.map(h=>({
      slot:h.slot,name:h.name,ready:h.ready,connected:!!h.socketId,
      progress:+h.progress.toFixed(3),stamina:+h.stamina.toFixed(1),speed:+h.speed.toFixed(2),taps:h.taps,finish:h.finish,female:!!h.female,bride:!!h.bride
    }))
  };
}
function emitRoom(r) { io.to(r.code).emit('state', publicRoom(r)); r.updatedAt=Date.now(); }
function normalizeName(name, fallback) {
  const x=String(name||'').trim().slice(0,14);
  return x || fallback;
}
function resetRace(r) {
  r.status='lobby'; r.startAt=null; r.elapsed=0; r.finishOrder=[];
  for (const h of r.horses) { h.progress=0; h.stamina=100; h.finish=null; h.tapQueue=0; h.speed=0; h.effort=0; h.taps=0; h.lastTapAt=0; }
}
function setCount(r,n) {
  n=[6,8,9].includes(+n)?+n:8;
  if (r.status==='running') return;
  const old=r.horses;
  r.count=n;
  r.horses=Array.from({length:n},(_,i)=>old[i]||makeHorse(i));
  resetRace(r);
}
io.on('connection', socket => {
  socket.on('createRoom', ({count=8,names=[]}={}, cb=()=>{}) => {
    const c=code();
    const r={code:c,count:8,status:'lobby',startAt:null,elapsed:0,finishOrder:[],hostId:socket.id,createdAt:Date.now(),updatedAt:Date.now(),horses:[]};
    r.horses=Array.from({length:8},(_,i)=>makeHorse(i));
    setCount(r,count);
    names.forEach((n,i)=>{ if(r.horses[i]) r.horses[i].name=normalizeName(n,`ゲスト${i+1}`); });
    rooms.set(c,r); socket.join(c); socket.data={room:c,role:'host'};
    cb({ok:true,room:publicRoom(r)}); emitRoom(r);
  });

  socket.on('hostJoin', ({code:c}={},cb=()=>{}) => {
    c=String(c||'').toUpperCase(); const r=rooms.get(c);
    if(!r) return cb({ok:false,error:'ROOM_NOT_FOUND'});
    r.hostId=socket.id; socket.join(c); socket.data={room:c,role:'host'};
    cb({ok:true,room:publicRoom(r)}); emitRoom(r);
  });

  socket.on('joinRoom', ({code:c,name,token}={},cb=()=>{}) => {
    c=String(c||'').toUpperCase(); const r=rooms.get(c);
    if(!r) return cb({ok:false,error:'ROOM_NOT_FOUND'});
    let h = token ? r.horses.find(x=>x.token===token) : null;
    if(!h) h=r.horses.find(x=>!x.token);
    if(!h) return cb({ok:false,error:'ROOM_FULL'});
    if(!h.token) h.token = Math.random().toString(36).slice(2)+Date.now().toString(36);
    h.socketId=socket.id; h.name=normalizeName(name,h.name);
    socket.join(c); socket.data={room:c,role:'player',slot:h.slot,token:h.token};
    cb({ok:true,slot:h.slot,token:h.token,room:publicRoom(r)}); emitRoom(r);
  });

  socket.on('screenJoin', ({code:c}={},cb=()=>{}) => {
    c=String(c||'').toUpperCase(); const r=rooms.get(c);
    if(!r) return cb({ok:false,error:'ROOM_NOT_FOUND'});
    socket.join(c); socket.data={room:c,role:'screen'}; cb({ok:true,room:publicRoom(r)});
  });

  socket.on('ready', ({ready=true}={}) => {
    const d=socket.data||{}, r=rooms.get(d.room); if(!r||d.role!=='player') return;
    const h=r.horses[d.slot]; if(!h||h.token!==d.token) return; h.ready=!!ready; emitRoom(r);
  });

  socket.on('renameSelf', ({name}={}) => {
    const d=socket.data||{}, r=rooms.get(d.room); if(!r||d.role!=='player'||r.status==='running') return;
    const h=r.horses[d.slot]; if(!h||h.token!==d.token) return; h.name=normalizeName(name,h.name); emitRoom(r);
  });

  socket.on('hostConfig', ({count,names}={}) => {
    const d=socket.data||{}, r=rooms.get(d.room); if(!r||d.role!=='host'||r.hostId!==socket.id||r.status==='running') return;
    if(count) setCount(r,count);
    if(Array.isArray(names)) names.forEach((n,i)=>{ if(r.horses[i]) r.horses[i].name=normalizeName(n,r.horses[i].name); });
    emitRoom(r);
  });

  socket.on('startRace', () => {
    const d=socket.data||{}, r=rooms.get(d.room); if(!r||d.role!=='host'||r.hostId!==socket.id||r.status==='running') return;
    resetRace(r); r.status='countdown'; r.startAt=Date.now()+3500; emitRoom(r);
    setTimeout(()=>{ const rr=rooms.get(r.code); if(rr&&rr.status==='countdown'){rr.status='running';emitRoom(rr);} },3500);
  });

  socket.on('resetRace', () => {
    const d=socket.data||{}, r=rooms.get(d.room); if(!r||d.role!=='host'||r.hostId!==socket.id) return;
    resetRace(r); emitRoom(r);
  });

  socket.on('tapBatch', ({count=1}={}) => {
    const d=socket.data||{}, r=rooms.get(d.room); if(!r||d.role!=='player'||r.status!=='running') return;
    const h=r.horses[d.slot]; if(!h||h.token!==d.token||h.finish!=null) return;
    const now=Date.now(); const safe=Math.max(0,Math.min(12,Math.floor(+count||0)));
    if(now-h.lastTapAt<35 && safe>4) return;
    h.lastTapAt=now; h.tapQueue=Math.min(12,h.tapQueue+safe);
  });

  socket.on('disconnect', () => {
    const d=socket.data||{}, r=rooms.get(d.room); if(!r) return;
    if(d.role==='host' && r.hostId===socket.id) r.hostId=null;
    if(d.role==='player') { const h=r.horses[d.slot]; if(h&&h.socketId===socket.id) h.socketId=null; }
    emitRoom(r);
  });
});

// Fixed 50ms authoritative simulation; every display uses these positions.
// No random outcomes, slot bonuses or late-race automatic acceleration.
function stepRace(r,dt) {
  r.elapsed+=dt;
  const finishers=[];
  for(const h of r.horses) {
    if(h.finish!=null) continue;
    const taps=Math.min(h.tapQueue,1); h.tapQueue-=taps; h.taps+=taps;
    h.effort=Math.max(0,h.effort-dt*1.8);
    if(taps) h.effort=Math.min(1,h.effort+.32);
    h.stamina=Math.max(0,Math.min(100,h.stamina+dt*(h.effort>.35?-8*h.effort:5)));
    const strength=.38+.62*Math.min(1,h.stamina/30);
    const target=(2.3+2.6*h.effort)*strength;
    h.speed+=(target-h.speed)*Math.min(1,dt*3);
    const old=h.progress; h.progress=Math.min(100,old+h.speed*dt);
    if(h.progress>=100){h.finish=r.elapsed-dt+(100-old)/h.speed;finishers.push(h);}
  }
  finishers.sort((a,b)=>a.finish-b.finish||a.slot-b.slot);
  for(const h of finishers)r.finishOrder.push(h.slot);
  if(r.horses.every(h=>h.finish!=null))r.status='finished';
}


setInterval(()=>{
  for(const r of rooms.values()) {
    if(r.status!=='running') continue;
    stepRace(r, .05);
    emitRoom(r);
  }
},50);

setInterval(()=>{
  const cut=Date.now()-1000*60*45;
  for(const [c,r] of rooms) if(r.updatedAt<cut) rooms.delete(c);
},60000);

server.listen(PORT,'0.0.0.0',()=>console.log(`Wedding Derby listening on ${PORT}`));
