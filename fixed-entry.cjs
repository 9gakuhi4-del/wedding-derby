'use strict';
const crypto=require('node:crypto');
const TTL=45*60*1000;
// Only the verifier is committed. The organizer capability stays on the host PC.
function createFixedEntry(rooms,adminHash){
 let activeCode=null;
 function authorized(key){return typeof key==='string'&&/^[a-f0-9]{48}$/.test(key)&&crypto.timingSafeEqual(crypto.createHash('sha256').update(key).digest(),Buffer.from(adminHash,'hex'));}
 function current(){return activeCode?rooms.get(activeCode):null;}
 function status(){const r=current();return !r?{code:null,status:'waiting',hostConnected:false,available:0}:{code:r.code,status:r.status,hostConnected:!!r.hostId,available:r.horses.filter(h=>!h.token).length};}
 function publish(r,data){
  if(!r)return{ok:false,error:'HOST_AUTH'};
  if(!authorized(data.key))return{ok:false,error:'ENTRY_AUTH'};
  if(r.practice)return{ok:false,error:'ENTRY_PRACTICE'};
  const existing=current();
  if(data.enabled===false){if(activeCode!==r.code)return{ok:false,error:'ENTRY_NOT_YOURS'};activeCode=null;return{ok:true,entry:status()};}
  if(r.status!=='lobby')return{ok:false,error:'INVALID_STATE'};
  if(existing&&existing.code!==r.code){
   if(['countdown','running'].includes(existing.status))return{ok:false,error:'ENTRY_RACING'};
   // Compare-and-swap: a stale confirmation cannot replace a newer room.
   if(data.replaceCode!==existing.code)return{ok:false,error:'ENTRY_CONFLICT',currentCode:existing.code};
  }
  activeCode=r.code;r.updatedAt=Date.now();return{ok:true,entry:status()};
 }
 function prune(now=Date.now()){
  for(const [code,r]of rooms)if(!r.hostId&&!r.horses.some(h=>h.socketId)&&now-r.updatedAt>TTL){rooms.delete(code);if(activeCode===code)activeCode=null;}
 }
 return{status,publish,prune};
}
module.exports={createFixedEntry,TTL};
