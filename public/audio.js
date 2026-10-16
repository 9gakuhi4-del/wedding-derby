/* Original orchestral score; all playback follows the displayed race state. */
(()=>{'use strict';
class RaceAudio {
 constructor({enabled=true,onChange=()=>{},onError=()=>{}}={}) {
  Object.assign(this,{on:enabled,onChange,onError,ctx:null,buffer:null,loop:null,loading:null,key:'',nodes:new Set(),lastBeep:null,lastHoof:0});
 }
 init() {
  if(!this.ctx){
   const A=window.AudioContext||window.webkitAudioContext;
   if(!A){this.onError('このブラウザでは音声を再生できません');return;}
   this.ctx=new A();this.master=this.ctx.createGain();this.master.gain.value=this.on?.65:0;this.master.connect(this.ctx.destination);
   this.ctx.onstatechange=()=>this.onChange();
  }
  if(this.ctx.state==='suspended')this.ctx.resume().then(()=>this.onChange()).catch(()=>this.onChange());
  if(!this.buffer&&!this.loading){
   this.loading=fetch('/assets/audio/turf-sprint.mp3').then(r=>{if(!r.ok)throw Error('music');return r.arrayBuffer()})
    .then(data=>this.ctx.decodeAudioData(data)).then(buffer=>{this.buffer=buffer;this.prepareLoop();})
    .catch(()=>this.onError('BGMを読み込めませんでした。「音」を押して再試行できます'))
    .finally(()=>{this.loading=null;this.onChange()});
  }
 }
 setEnabled(value){
  this.on=value;
  if(value)this.init();
  if(this.ctx){this.master.gain.cancelScheduledValues(this.ctx.currentTime);this.master.gain.setTargetAtTime(value?.65:0,this.ctx.currentTime,.015)}
  if(!value)this.reset();
  this.onChange();
 }
 prepareLoop(){
  // 144 BPM: two-bar opening, then a bar-aligned loop with a one-bar crossfade.
  const rate=this.buffer.sampleRate,from=Math.round(10/3*rate),end=Math.min(Math.round(25*rate),this.buffer.length),fade=Math.round(5/3*rate);
  this.introEnd=(end-fade)/rate;const length=end-from-fade;
  this.loop=this.ctx.createBuffer(this.buffer.numberOfChannels,length,rate);
  for(let channel=0;channel<this.buffer.numberOfChannels;channel++){
   const src=this.buffer.getChannelData(channel),dst=this.loop.getChannelData(channel);
   for(let i=0;i<fade;i++){const blend=i/fade;dst[i]=src[end-fade+i]*(1-blend)+src[from+i]*blend}
   dst.set(src.subarray(from+fade,end-fade),fade);
  }
 }
 source(buffer,when,offset=0,{loop=false,duration,volume=.62,fade=.08}={}){
  const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=buffer;source.loop=loop;source.connect(gain);gain.connect(this.master);
  gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(volume,when+fade);
  const node={source,gain};this.nodes.add(node);source.onended=()=>{this.nodes.delete(node);source.disconnect();gain.disconnect()};
  if(duration==null)source.start(when,offset);else source.start(when,offset,duration);
  return node;
 }
 reset(fade=.08){
  if(this.ctx)for(const node of this.nodes){
   const now=this.ctx.currentTime;node.gain.gain.cancelScheduledValues(now);node.gain.gain.setTargetAtTime(0,now,Math.max(.005,fade/3));
   try{node.source.stop(now+fade)}catch{}
  }
  this.key='';this.lastBeep=null;
 }
 startRace(elapsed){
  const now=this.ctx.currentTime+.02;
  if(elapsed<this.introEnd){
   const remaining=this.introEnd-elapsed;
   this.source(this.buffer,now,elapsed,{duration:remaining});
   this.source(this.loop,now+remaining,0,{loop:true,fade:0});
  }else this.source(this.loop,now,(elapsed-this.introEnd)%this.loop.duration,{loop:true});
 }
 tone(freq,duration,volume=.06){
  if(!this.on||this.ctx?.state!=='running')return;
  const now=this.ctx.currentTime,source=this.ctx.createOscillator(),gain=this.ctx.createGain();
  source.type='sine';source.frequency.setValueAtTime(freq,now);source.frequency.exponentialRampToValueAtTime(Math.max(30,freq*.55),now+duration);
  gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);source.connect(gain);gain.connect(this.master);
  const node={source,gain};this.nodes.add(node);source.onended=()=>{this.nodes.delete(node);source.disconnect();gain.disconnect()};source.start(now);source.stop(now+duration);
 }
 tick(state,{replayKey='',offset=0}={}){
  if(!state||!this.on||this.ctx?.state!=='running'||!this.buffer)return;
  const phase=state.finishOrder.length||state.status==='finished'?'result':['running','countdown'].includes(state.status)?'race':'lobby';
  const key=state.code+':'+state.round+':'+replayKey+':'+phase;
  if(key!==this.key){
   const previous=this.key;this.reset(.22);this.key=key;
   if(phase==='race'){
    const elapsed=state.status==='countdown'?Math.max(0,3-(state.startAt-Date.now()-offset)/1000):state.elapsed+3;
    this.startRace(elapsed);
   }else if(phase==='result'&&previous.endsWith(':race')){
    this.source(this.buffer,this.ctx.currentTime+.04,25,{volume:.68,fade:.18});
   }
  }
  if(!replayKey&&state.status==='countdown'){
   const n=Math.ceil((state.startAt-Date.now()-offset)/1000);
   if(n!==this.lastBeep){this.lastBeep=n;this.tone(560,.12,.08)}
  }
  const now=performance.now();
  if(phase==='race'&&state.status==='running'&&now-this.lastHoof>180){this.lastHoof=now;this.tone(95,.05,.028)}
 }
}
window.RaceAudio=RaceAudio;
})();
