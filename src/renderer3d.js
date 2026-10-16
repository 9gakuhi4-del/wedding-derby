import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
const COLORS=['#2774d8','#df7fb5','#d43f3e','#e9cf59','#8462b4','#29977c','#e99b3b','#f4f0e6'];
const INK=['#fff','#201d27','#fff','#23271b','#fff','#fff','#221c13','#28251d'];
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const mat=(color,roughness=.65)=>new THREE.MeshStandardMaterial({color,roughness,metalness:0});
function mesh(parent,g,m,x=0,y=0,z=0,sx=1,sy=1,sz=1){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
const sphere=new THREE.SphereGeometry(1,20,14),box=new THREE.BoxGeometry(1,1,1);
function ell(parent,m,x,y,z,sx,sy,sz){return mesh(parent,sphere,m,x,y,z,sx,sy,sz)}
function segment(parent,a,b,r1,r2,m){const dir=b.clone().sub(a);const o=mesh(parent,new THREE.CylinderGeometry(r2,r1,dir.length(),12),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(V(0,1,0),dir.normalize());return o}
function curve(parent,points,r,m){return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>V(...p))),24,r,6,false),m)}
function texCanvas(w,h,fn){const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function seeded(seed){return()=>{seed=(Math.imul(1664525,seed)+1013904223)|0;return(seed>>>0)/4294967296}}
function cloth(parent,w,h,material){const g=new THREE.PlaneGeometry(w,h,12,16),m=mesh(parent,g,material);m.userData.rest=new Float32Array(g.attributes.position.array);return m}
function makeRider(slot){
 const group=new THREE.Group(),body=new THREE.Group();group.add(body);
 const female=[1,4,7].includes(slot),bride=slot===7;
 const silk=mat(COLORS[slot],.38),white=mat('#eee9df',.75),skin=mat('#cfa480',.7),boot=mat('#171c20',.3),hair=mat('#241915'),goggle=mat('#243a40',.18),leather=mat('#25201b',.5),metal=mat('#c5b8a1',.25);
 // A forward crouch, flexed knees and arms. Every component is a 3D mesh.
 ell(body,bride?white:silk,0,.34,-.13,female?.175:.20,.27,.15).rotation.x=-.77;
 ell(body,bride?white:white,0,.12,.10,.19,.14,.18);
 const head=ell(body,skin,0,.60,-.37,.112,.143,.112);head.rotation.x=.12;
 ell(body,skin,0,.58,-.475,.032,.045,.033);
 ell(body,goggle,0,.63,-.463,.102,.034,.027);
 if(bride){ell(body,hair,0,.68,-.345,.118,.09,.12);ell(body,hair,0,.67,-.23,.083,.08,.085);const tiara=curve(body,[[-.1,.70,-.41],[0,.75,-.45],[.1,.70,-.41]],.012,metal);}
 else {ell(body,silk,0,.73,-.37,.137,.075,.138);ell(body,silk,0,.687,-.49,.14,.015,.08);}
 if(female&&!bride){ell(body,hair,0,.56,-.21,.045,.12,.045).rotation.x=-.5;}
 for(const side of [-1,1]){
  const hip=V(side*.14,.12,.12),knee=V(side*.32,-.13,-.23),ankle=V(side*.34,-.40,.03);
  segment(body,hip,knee,.09,.07,white);ell(body,white,...knee.toArray(),.074,.075,.075);
  segment(body,knee,ankle,.069,.049,boot);ell(body,boot,side*.34,-.43,-.04,.058,.055,.14);
  const sh=V(side*.15,.46,-.22),elbow=V(side*.24,.28,-.40),hand=V(side*.14,.25,-.66);
  segment(body,sh,elbow,.069,.046,bride?skin:silk);ell(body,bride?skin:silk,...elbow.toArray(),.049,.049,.049);segment(body,elbow,hand,.043,.029,bride?skin:silk);ell(body,skin,...hand.toArray(),.034,.039,.043);
  curve(body,[[side*.35,-.39,-.02],[side*.39,-.49,-.03],[side*.29,-.49,-.03],[side*.35,-.39,-.02]],.009,metal);
  curve(body,[[side*.16,.24,-.64],[side*.19,.10,-.9],[side*.17,-.03,-1.10]],.008,leather);
 }
 let veil=null,skirt=null;
 if(bride){const chiffon=new THREE.MeshStandardMaterial({color:'#fff9ef',roughness:.9,side:THREE.DoubleSide,transparent:true,opacity:.67,depthWrite:false});veil=cloth(body,.60,1.0,chiffon);veil.rotation.x=-1.2;veil.position.set(0,.51,.20);skirt=mesh(body,new THREE.ConeGeometry(.42,.75,32,6,true),new THREE.MeshStandardMaterial({color:'#f8f0e0',roughness:.85,side:THREE.DoubleSide}),0,-.04,.16);skirt.rotation.x=-.5;}
 return{group,body,veil,skirt};
}
class RaceRenderer{
 constructor(canvas){this.canvas=canvas;this.camera='wide';this.selected=7;this.state=null;this.visual=[];this.time=0;this.previous=0;this.horses=[];this.disposed=false;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 this.webgl=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});this.webgl.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.webgl.shadowMap.enabled=true;this.webgl.shadowMap.type=THREE.PCFSoftShadowMap;this.webgl.outputColorSpace=THREE.SRGBColorSpace;this.webgl.toneMapping=THREE.ACESFilmicToneMapping;this.webgl.toneMappingExposure=1.05;
 this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#c4d8df');this.scene.fog=new THREE.FogExp2('#c4d8df',.0035);this.cam=new THREE.PerspectiveCamera(46,1,.1,1800);this.cam.position.set(17,8,-26);this.look=V(0,1,-2);this.scene.add(new THREE.HemisphereLight('#dcecff','#51623a',2.1));this.sun=new THREE.DirectionalLight('#fff2dc',3.1);this.sun.position.set(-25,45,-20);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-35,right:35,top:35,bottom:-35,near:1,far:150});this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.025;this.scene.add(this.sun,this.sun.target);this.buildWorld();
 this.onContextLost=e=>{e.preventDefault();document.getElementById('loadingDetail').textContent='3D描画が停止しました。再読み込みしてください。';document.getElementById('loading').classList.remove('hidden');document.getElementById('retryAssets').classList.remove('hidden');};canvas.addEventListener('webglcontextlost',this.onContextLost);
 }
 async init(onProgress=()=>{}){onProgress('馬の3Dモデルを読み込み中');const gltf=await new GLTFLoader().loadAsync('/assets/3d/racehorse.glb');
 this.assetInfo={animations:gltf.animations.map(a=>a.name)};
 for(let i=0;i<8;i++){
  const root=new THREE.Group(),model=cloneSkeleton(gltf.scene);root.add(model);this.scene.add(root);
  model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const mm=Array.isArray(o.material)?o.material:[o.material];o.material=mm.map(m=>{m=m.clone();if(/coat|body|horse/i.test(m.name)){m.color.multiply(new THREE.Color(['#a18773','#bc8a60','#59514c','#d18b55','#807063','#a78b6c','#d7d4ce','#b28d6c'][i]));}m.roughness=.65;return m});if(o.material.length===1)o.material=o.material[0]}});
  const mixer=new THREE.AnimationMixer(model);const clip=gltf.animations.find(a=>/gallop/i.test(a.name))||gltf.animations[0];const action=clip?mixer.clipAction(clip).play():null;
  const rider=makeRider(i);rider.group.position.set(0,1.55,.05);root.add(rider.group);
  const saddle=mat('#201b18',.5),pad=mat(COLORS[i]);ell(root,saddle,0,1.51,.02,.34,.10,.48);mesh(root,box,pad,0,1.40,.03,.70,.07,.82);
  const badgeTexture=texCanvas(128,128,(c,w,h)=>{c.fillStyle=COLORS[i];c.fillRect(0,0,w,h);c.strokeStyle='#fff8';c.lineWidth=7;c.strokeRect(4,4,w-8,h-8);c.fillStyle=INK[i];c.font='bold 88px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(i+1,64,66)});
  for(const side of [-1,1]){const num=mesh(root,new THREE.PlaneGeometry(.38,.38),new THREE.MeshBasicMaterial({map:badgeTexture,side:THREE.DoubleSide}),side*.36,1.25,.08);num.rotation.y=side*Math.PI/2;}
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:badgeTexture,depthTest:false}));label.position.set(0,2.65,0);label.scale.set(.45,.45,1);root.add(label);
  this.horses.push({root,model,mixer,action,rider,label,phase:i*.19});
 }
 onProgress('3D競馬場の準備完了');this.webgl.compile(this.scene,this.cam);
 }
 buildWorld(){
 const grassTex=texCanvas(512,512,(c,w,h)=>{c.fillStyle='#587740';c.fillRect(0,0,w,h);const random=seeded(199);for(let i=0;i<65000;i++){const v=30+random()*55;c.fillStyle=`rgba(${v+25},${v+60},${v},${.12+random()*.2})`;c.fillRect(random()*w,random()*h,1+random()*2,2+random()*6)}});grassTex.wrapS=grassTex.wrapT=THREE.RepeatWrapping;grassTex.repeat.set(75,220);grassTex.anisotropy=Math.min(8,this.webgl.capabilities.getMaxAnisotropy());
 const turf=new THREE.MeshStandardMaterial({map:grassTex,roughness:1});const ground=mesh(this.scene,new THREE.PlaneGeometry(900,2200),turf,0,-.02,-600);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
 // alternating mowing bands, in world coordinates: the surface actually moves under the horses.
 const strips=new THREE.InstancedMesh(new THREE.PlaneGeometry(29,12),new THREE.MeshStandardMaterial({color:'#a4b37c',transparent:true,opacity:.12,roughness:1}),61);const dummy=new THREE.Object3D();for(let i=0;i<61;i++){dummy.position.set(0,.002,-i*24);dummy.rotation.x=-Math.PI/2;dummy.updateMatrix();strips.setMatrixAt(i,dummy.matrix)}strips.receiveShadow=true;this.scene.add(strips);
 const railMat=mat('#e8e9df',.55),postMat=mat('#a8b9a4');const posts=new THREE.InstancedMesh(new THREE.CylinderGeometry(.055,.07,1.15,8),postMat,620);for(let i=0;i<310;i++)for(let side=0;side<2;side++){dummy.position.set(side?15:-15,.58,40-i*4.3);dummy.rotation.set(0,0,0);dummy.updateMatrix();posts.setMatrixAt(i*2+side,dummy.matrix)}posts.castShadow=true;this.scene.add(posts);
 for(const x of [-15,15])for(const y of [.65,1.15]){const r=mesh(this.scene,new THREE.CylinderGeometry(.055,.055,1380,8),railMat,x,y,-620);r.rotation.x=Math.PI/2;}
 for(let m=0;m<=1200;m+=200){for(const x of [-16,16]){const t=texCanvas(256,128,c=>{c.fillStyle=m===1200?'#153f30':'#fcf7e9';c.fillRect(0,0,256,128);c.fillStyle=m===1200?'#f7d991':'#164c37';c.font='bold 72px sans-serif';c.textAlign='center';c.fillText(m===1200?'GOAL':1200-m,128,89)});const sign=mesh(this.scene,new THREE.PlaneGeometry(2.4,1.2),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}),x,2,-m);sign.rotation.y=x<0?Math.PI/4:-Math.PI/4;segment(this.scene,V(x,0,-m),V(x,1.6,-m),.07,.07,railMat)}}
 const finish=mesh(this.scene,new THREE.PlaneGeometry(30,.22),new THREE.MeshBasicMaterial({color:'#fffbea'}),0,.012,-1200);finish.rotation.x=-Math.PI/2;
 const gateMat=mat('#205c4b');this.gates=new THREE.Group();this.scene.add(this.gates);for(let i=0;i<9;i++){const x=(i-4)*2.6;mesh(this.gates,box,gateMat,x,1.5,3,.12,3,2.8)}mesh(this.gates,box,gateMat,0,3.1,3,21.1,.32,3);
 const treeMat=mat('#324f31',1),trunkMat=mat('#584535',1);const trees=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),treeMat,260),trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.20,.32,3.8,6),trunkMat,130),rand=seeded(51);for(let i=0;i<130;i++){const x=-35-rand()*35,z=30-i*11,scale=2+rand()*3;dummy.position.set(x,2,z);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);for(let j=0;j<2;j++){dummy.position.set(x+j*1.1,4.2+j,z);dummy.scale.set(scale,scale*1.25,scale);dummy.updateMatrix();trees.setMatrixAt(i*2+j,dummy.matrix)}}this.scene.add(trees,trunks);
 const structure=mat('#bec7c4'),dark=mat('#485953'),roof=mat('#d4d6d0');for(let section=0;section<12;section++){const z=20-section*105;mesh(this.scene,box,structure,35,2.8,z,20,5.6,92);for(let row=0;row<6;row++)mesh(this.scene,box,row%2?dark:structure,27+row*2,3+row*.75,z,2.5,.4,92);mesh(this.scene,box,roof,35,10,z,25,.4,95);for(let p=-1;p<=1;p++)mesh(this.scene,box,dark,44,7,z+p*35,.35,6,.35)}
 const crowd=new THREE.InstancedMesh(new THREE.SphereGeometry(1,5,4),mat('#b0af9b'),2304);const color=new THREE.Color();let n=0;for(let sec=0;sec<12;sec++)for(let row=0;row<6;row++)for(let j=0;j<32;j++){dummy.position.set(27+row*2,3.6+row*.75,sec*-105+62-j*2.7);dummy.scale.set(.3,.49,.3);dummy.rotation.set(0,0,0);dummy.updateMatrix();crowd.setMatrixAt(n,dummy.matrix);color.setHSL(rand(),.15+rand()*.4,.25+rand()*.4);crowd.setColorAt(n++,color)}this.scene.add(crowd);
 }
 setState(s){if(!s)return;if(!this.state||s.code!==this.state.code||s.tick<this.state.tick){this.visual=[];this.snap=true}this.state=s}
 setCamera(c){this.camera=c;this.snap=false}
 render(dt=.016){if(this.disposed)return;const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;if(this.width!==w||this.height!==h){this.width=w;this.height=h;this.webgl.setSize(w,h,false);this.cam.aspect=w/h;this.cam.updateProjectionMatrix()}
 dt=Math.min(.07,dt);this.time+=dt;const s=this.state;if(!s||!this.horses.length)return;const running=s.status==='running';let lead=0,tail=100;
 for(const horse of s.horses){const i=horse.slot;if(this.visual[i]==null||s.status==='lobby')this.visual[i]=horse.progress;this.visual[i]+=(horse.progress-this.visual[i])*(1-Math.exp(-dt*14));if(horse.active){lead=Math.max(lead,this.visual[i]);tail=Math.min(tail,this.visual[i])}const a=this.horses[i];a.root.visible=horse.active||s.status==='lobby';a.root.position.set((i-3.5)*2.6,0,-this.visual[i]*12);
 const moving=running&&horse.active&&horse.finish==null;const hz=moving?(1.25+horse.speed*.36):0;
 // Drive skeleton and rider with the same cadence, derived from authoritative speed.
 if(a.action){a.action.timeScale=hz;a.mixer.update(dt)}a.phase+=dt*hz;const phase=a.phase*Math.PI*2;
 a.rider.group.position.y=1.55+(moving?Math.sin(phase)*.045:Math.sin(this.time*1.5+i)*.008);a.rider.body.rotation.x=moving?Math.sin(phase+.3)*.055:0;
 if(a.rider.veil){const g=a.rider.veil.geometry,p=g.attributes.position,rest=a.rider.veil.userData.rest;for(let j=0;j<p.count;j++){const x=rest[j*3],y=rest[j*3+1];p.setZ(j,Math.sin(y*8+this.time*(moving?9:2)+x*4)*.04*(.6-y))}p.needsUpdate=true;g.computeVertexNormals()}
 a.label.material.opacity=i===this.selected?1:.86;
 }
 const middle=(lead+tail)*.5*12,leaderZ=-lead*12,span=(lead-tail)*12;
 let cameraPos,target;
 if(this.camera==='focus'){const me=this.horses[this.selected]||this.horses[7];cameraPos=me.root.position.clone().add(V(2.9,3.9,7.4));target=me.root.position.clone().add(V(0,1.65,-6));this.cam.fov=52}
 else if(this.camera==='front'){cameraPos=V(0,3.5,leaderZ-Math.max(19,12/(Math.tan(16*Math.PI/180)*w/h)));target=V(0,1.2,leaderZ+2);this.cam.fov=32}
 else{const mobile=w/h<1.3,dist=Math.max(mobile?39:27,Math.min(95,span*.55+24));cameraPos=V(dist,dist*.37,-middle-dist*.65);target=V(0,1,-middle);this.cam.fov=46;}
 const blend=this.snap?1:1-Math.exp(-dt*5);this.cam.position.lerp(cameraPos,blend);this.look.lerp(target,blend);this.snap=false;this.cam.lookAt(this.look);this.cam.updateProjectionMatrix();this.sun.position.set(-25,45,-middle-20);this.sun.target.position.set(0,0,-middle);this.webgl.render(this.scene,this.cam);
 }
 start(){const loop=now=>{if(this.disposed)return;const dt=this.previous?(now-this.previous)/1000:0;this.previous=now;this.render(dt);this.animation=requestAnimationFrame(loop)};this.animation=requestAnimationFrame(loop)}
 dispose(){this.disposed=true;cancelAnimationFrame(this.animation);this.canvas.removeEventListener('webglcontextlost',this.onContextLost);this.scene.traverse(o=>{o.geometry?.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{m?.map?.dispose();m?.dispose()})});this.webgl.dispose()}
}
window.RaceRenderer=RaceRenderer;window.RACE_COLORS=COLORS;window.RACE_INK=INK;
