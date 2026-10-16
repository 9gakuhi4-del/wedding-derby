import * as THREE from 'three';
import './presentation.js';
import {coursePose,courseSection,COURSE_LENGTH,BEND_RADIUS,TRACK_HALF_WIDTH} from './course.mjs';
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
 constructor(canvas){this.canvas=canvas;this.camera='auto';this.selected=7;this.state=null;this.visual=[];this.time=0;this.previous=0;this.horses=[];this.disposed=false;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
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
 const grassTex=texCanvas(512,512,(c,w,h)=>{c.fillStyle='#587740';c.fillRect(0,0,w,h);const random=seeded(199);for(let i=0;i<65000;i++){const v=30+random()*55;c.fillStyle=`rgba(${v+25},${v+60},${v},${.12+random()*.2})`;c.fillRect(random()*w,random()*h,1+random()*2,2+random()*6)}});
 grassTex.wrapS=grassTex.wrapT=THREE.RepeatWrapping;grassTex.anisotropy=Math.min(8,this.webgl.capabilities.getMaxAnisotropy());
 const groundTex=grassTex.clone();groundTex.repeat.set(65,90);const ground=mesh(this.scene,new THREE.PlaneGeometry(650,900),new THREE.MeshStandardMaterial({map:groundTex,color:'#a4b29a',roughness:1}),0,-.025,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
 // Track, mowing stripes and rails share the exact path used by the horses.
 const positions=[],uvs=[],colors=[],indices=[],steps=600;
 for(let i=0;i<=steps;i++){const d=i/steps*COURSE_LENGTH,c=new THREE.Color(Math.floor(Math.min(d,1199.99)/12)%2?'#9ba887':'#b2bb9d');for(const side of [-1,1]){const p=coursePose(d,side*TRACK_HALF_WIDTH);positions.push(p.x,0,p.z);uvs.push((side+1)*1.5,d/8);colors.push(c.r,c.g,c.b)}if(i<steps){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2)}}
 const trackGeo=new THREE.BufferGeometry();trackGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));trackGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));trackGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));trackGeo.setIndex(indices);trackGeo.computeVertexNormals();const track=mesh(this.scene,trackGeo,new THREE.MeshStandardMaterial({map:grassTex,vertexColors:true,roughness:1,side:THREE.DoubleSide}));track.castShadow=false;
 const railMat=mat('#e8e9df',.55),postMat=mat('#a8b9a4'),dummy=new THREE.Object3D(),postCount=280;
 const posts=new THREE.InstancedMesh(new THREE.CylinderGeometry(.055,.07,1.15,8),postMat,postCount*2);
 for(let i=0;i<postCount;i++)for(let side=0;side<2;side++){const p=coursePose(i/postCount*COURSE_LENGTH,side?15:-15);dummy.position.set(p.x,.58,p.z);dummy.updateMatrix();posts.setMatrixAt(i*2+side,dummy.matrix)}posts.castShadow=true;this.scene.add(posts);
 for(const lane of [-15,15])for(const height of [.65,1.15]){const points=[];for(let i=0;i<300;i++){const p=coursePose(i/300*COURSE_LENGTH,lane);points.push(V(p.x,height,p.z))}mesh(this.scene,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),600,.055,6,true),railMat)}
 for(let d=200;d<=1200;d+=200)for(const side of [-1,1]){const p=coursePose(d,side*16.5),t=texCanvas(256,128,c=>{c.fillStyle=d===1200?'#153f30':'#fcf7e9';c.fillRect(0,0,256,128);c.fillStyle=d===1200?'#f7d991':'#164c37';c.font='bold 72px sans-serif';c.textAlign='center';c.fillText(d===1200?'GOAL':1200-d,128,89)});const sign=mesh(this.scene,new THREE.PlaneGeometry(2.4,1.2),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}),p.x,2,p.z);sign.rotation.y=p.yaw-side*Math.PI/4;segment(this.scene,V(p.x,0,p.z),V(p.x,1.6,p.z),.07,.07,railMat)}
 const finishPose=coursePose(1200),finish=mesh(this.scene,new THREE.PlaneGeometry(30,.35),new THREE.MeshBasicMaterial({color:'#fffbea'}),finishPose.x,.012,finishPose.z);finish.rotation.set(-Math.PI/2,0,0);
 const gateMat=mat('#205c4b');this.gates=new THREE.Group();this.gates.position.set(finishPose.x,0,finishPose.z);this.scene.add(this.gates);for(let i=0;i<9;i++)mesh(this.gates,box,gateMat,(i-4)*2.6,1.5,3,.12,3,2.8);mesh(this.gates,box,gateMat,0,3.1,3,21.1,.32,3);this.gateDoors=[];for(let i=0;i<8;i++)for(const side of [-1,1]){const hinge=new THREE.Group();hinge.position.set((i-3.5)*2.6+side*1.24,1.1,-1.75);this.gates.add(hinge);mesh(hinge,box,gateMat,-side*.6,0,0,1.2,1.4,.06);for(const y of [-.4,0,.4])mesh(hinge,box,mat('#d7dccb'),-side*.6,y,-.04,1.18,.06,.03);this.gateDoors.push({hinge,side})}
 const goal=new THREE.Group();goal.position.set(finishPose.x,0,finishPose.z);this.scene.add(goal);const gold=mat('#c8ae70',.4);for(const side of [-1,1]){mesh(goal,box,gateMat,side*16,3,0,.32,6,.32);mesh(goal,box,gold,side*16,6,0,.8,.2,.8)}mesh(goal,box,gateMat,0,6.4,0,32.5,1.1,.35);const goalTex=texCanvas(1024,96,(c,w,h)=>{c.fillStyle='#174633';c.fillRect(0,0,w,h);c.fillStyle='#f1d59b';c.font='bold 55px sans-serif';c.textAlign='center';c.fillText('WEDDING DERBY  /  FINISH',w/2,67)});mesh(goal,new THREE.PlaneGeometry(30,1),new THREE.MeshBasicMaterial({map:goalTex,side:THREE.DoubleSide}),0,6.4,.19);
 const treeMat=mat('#324f31',1),trunkMat=mat('#584535',1),treeCount=130,rand=seeded(51);
 const trees=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),treeMat,treeCount*2),trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.20,.32,3.8,6),trunkMat,treeCount);
 for(let i=0;i<treeCount;i++){const p=coursePose(i/treeCount*1200,45+rand()*35);if(p.x>BEND_RADIUS+25&&Math.abs(p.z)<210)p.x+=65;const x=p.x,z=p.z,scale=2+rand()*3;dummy.position.set(x,2,z);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);for(let j=0;j<2;j++){dummy.position.set(x+j*1.1,4.2+j,z);dummy.scale.set(scale,scale*1.25,scale);dummy.updateMatrix();trees.setMatrixAt(i*2+j,dummy.matrix)}}this.scene.add(trees,trunks);
 // The same grandstand reappears when the field completes its lap.
 const structure=mat('#bec7c4'),dark=mat('#485953'),roof=mat('#d4d6d0'),standX=BEND_RADIUS+44,sections=4;
 for(let section=0;section<sections;section++){const z=-150+section*100;mesh(this.scene,box,structure,standX,2.8,z,20,5.6,92);for(let row=0;row<6;row++)mesh(this.scene,box,row%2?dark:structure,standX-8+row*2,3+row*.75,z,2.5,.4,92);mesh(this.scene,box,roof,standX,10,z,25,.4,95);for(let j=-1;j<=1;j++)mesh(this.scene,box,dark,standX+9,7,z+j*35,.35,6,.35)}
 const crowd=new THREE.InstancedMesh(new THREE.SphereGeometry(1,5,4),mat('#b0af9b'),sections*6*32),color=new THREE.Color();let n=0;
 for(let sec=0;sec<sections;sec++)for(let row=0;row<6;row++)for(let j=0;j<32;j++){dummy.position.set(standX-8+row*2,3.6+row*.75,-108+sec*100-j*2.7);dummy.scale.set(.3,.49,.3);dummy.rotation.set(0,0,0);dummy.updateMatrix();crowd.setMatrixAt(n,dummy.matrix);color.setHSL(rand(),.15+rand()*.4,.25+rand()*.4);crowd.setColorAt(n++,color)}this.scene.add(crowd);
 this.mapCanvas=document.getElementById('courseMap');this.mapCtx=this.mapCanvas?.getContext('2d');
 }
 drawMap(){
 const c=this.mapCtx;if(!c)return;c.clearRect(0,0,360,180);c.fillStyle='#0a2119d9';c.fillRect(0,0,360,180);c.font='20px sans-serif';c.fillStyle='#e6c482';c.fillText('芝 1,200m · 1周',23,32);
 const point=p=>[180+p.z*.58,109+p.x*.58];c.beginPath();for(let i=0;i<=240;i++){const [x,y]=point(coursePose(i*5));i?c.lineTo(x,y):c.moveTo(x,y)}c.strokeStyle='#c4d3b65c';c.lineWidth=12;c.stroke();
 const [gx,gy]=point(coursePose(1200));c.strokeStyle='#f9dfab';c.lineWidth=2;c.beginPath();c.moveTo(gx,gy-11);c.lineTo(gx,gy+11);c.stroke();
 for(const h of this.state.horses){if(!h.active&&this.state.status!=='lobby')continue;const [x,y]=point(coursePose((this.visual[h.slot]||0)*12,(h.slot-3.5)*2.6));c.beginPath();c.arc(x,y,h.slot===this.selected?6:4,0,Math.PI*2);c.fillStyle=COLORS[h.slot];c.fill();if(h.slot===this.selected){c.strokeStyle='#fff';c.lineWidth=2;c.stroke()}}
 }

 setState(s){if(!s)return;if(!this.state||s.code!==this.state.code||s.tick<this.state.tick){this.visual=[];this.snap=true}this.state=s;this.stateAt=this.time}
 setCamera(c){this.camera=c;this.snap=!this.previous}
 render(dt=.016){if(this.disposed)return;const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;if(this.width!==w||this.height!==h){this.width=w;this.height=h;this.webgl.setSize(w,h,false);this.cam.aspect=w/h;this.cam.updateProjectionMatrix()}
 dt=Math.min(.07,dt);this.time+=dt;const s=this.state;if(!s||!this.horses.length)return;const running=s.status==='running';let lead=0,tail=100;
 for(const horse of s.horses){const i=horse.slot;if(this.visual[i]==null||s.status==='lobby')this.visual[i]=horse.progress;const finishAge=horse.finish==null?0:Math.max(0,s.elapsed+(this.time-this.stateAt)*(this.playbackRate||1)-horse.finish),coast=horse.finish==null?0:horse.speed*.6*(1-Math.exp(-finishAge/.6));this.visual[i]+=(horse.progress+coast-this.visual[i])*(1-Math.exp(-dt*14));if(horse.active){lead=Math.max(lead,Math.min(100,this.visual[i]));tail=Math.min(tail,Math.min(100,this.visual[i]))}const a=this.horses[i];a.root.visible=horse.active||s.status==='lobby';const travel=this.visual[i]*12;const pose=coursePose(travel>1200?travel-1200:travel,(i-3.5)*2.6);a.pose=pose;a.root.position.set(pose.x,0,pose.z);a.root.rotation.y=pose.yaw;
 const rollingSpeed=horse.finish==null?horse.speed:horse.speed*Math.exp(-finishAge/.6);const moving=horse.active&&((running&&horse.finish==null)||(horse.finish!=null&&(this.visual[i]<100||rollingSpeed>.16)));const hz=moving?(1.25+rollingSpeed*.36):0;a.root.rotation.z+=((moving&&pose.bend ? .025 : 0)-a.root.rotation.z)*(1-Math.exp(-dt*5));
 // Drive skeleton and rider with the same cadence, derived from authoritative speed.
 if(a.action){a.action.timeScale=hz;a.action.weight+=((moving?1:0)-a.action.weight)*(1-Math.exp(-dt*5));a.mixer.update(dt*(this.playbackRate||1))}a.phase+=dt*hz*(this.playbackRate||1);const phase=a.phase*Math.PI*2;
 a.rider.group.position.y=1.55+(moving?Math.sin(phase)*.045:Math.sin(this.time*1.5+i)*.008);a.rider.body.rotation.x=moving?Math.sin(phase+.3)*.055:0;
 if(a.rider.veil){const g=a.rider.veil.geometry,p=g.attributes.position,rest=a.rider.veil.userData.rest;for(let j=0;j<p.count;j++){const x=rest[j*3],y=rest[j*3+1];p.setZ(j,Math.sin(y*8+this.time*(moving?9:2)+x*4)*.04*(.6-y))}p.needsUpdate=true;g.computeVertexNormals()}
 a.label.material.opacity=i===this.selected?1:.86;
 }
 if(tail>lead)tail=lead;this.gates.visible=s.status==='lobby'||s.status==='countdown'||(running&&lead<2);
 for(const {hinge,side}of this.gateDoors)hinge.rotation.y=-side*Math.min(1,s.elapsed/.45)*Math.PI*.55;
 const middle=(lead+tail)*.5*12,span=(lead-tail)*12,center=coursePose(middle),leader=coursePose(lead*12);
 let cameraPos,target;let shot=this.camera;if(shot==='auto')shot=s.status==='finished'||lead>=98?'finish':s.status==='lobby'?'wide':lead<17||lead>=50&&lead<67?'wide':Math.floor(s.elapsed/7)%2?'front':'wide';if(shot!==this.shot&&this.camera==='auto'){this.snap=true;this.shot=shot}
 if(shot==='overview'){cameraPos=V(340,420,80);target=V(0,0,0);this.cam.fov=64;this.scene.fog.density=.0008}
 else if(shot==='finish'){const p=coursePose(1200);cameraPos=V(p.x+37,8.5,p.z-10);target=V(p.x,1.6,p.z+6);this.cam.fov=50}
 else if(shot==='focus'){const selected=s.horses[this.selected]?.active?this.selected:[...s.horses].filter(h=>h.active).sort((a,b)=>b.progress-a.progress)[0]?.slot??7;const me=this.horses[selected],p=me.pose;cameraPos=V(p.x+p.nx*2.9-p.tx*7.4,3.9,p.z+p.nz*2.9-p.tz*7.4);target=V(p.x+p.tx*6,1.65,p.z+p.tz*6);this.cam.fov=52}
 else if(shot==='front'){const dist=Math.max(19,12/(Math.tan(16*Math.PI/180)*w/h));cameraPos=V(leader.x+leader.tx*dist,3.5,leader.z+leader.tz*dist);target=V(leader.x-leader.tx*2,1.2,leader.z-leader.tz*2);this.cam.fov=32}
 else{const mobile=w/h<1.3,dist=Math.max(mobile?39:27,Math.min(140,span*.60+24));cameraPos=V(center.x+center.nx*dist+center.tx*dist*.65,Math.max(14,dist*.55),center.z+center.nz*dist+center.tz*dist*.65);target=V(center.x,1,center.z);this.cam.fov=46;}
 if(shot!=='overview')this.scene.fog.density=.0035;const blend=this.snap?1:1-Math.exp(-dt*5);this.cam.position.lerp(cameraPos,blend);this.look.lerp(target,blend);this.snap=false;this.cam.lookAt(this.look);this.cam.updateProjectionMatrix();this.sun.position.set(center.x-25,45,center.z-20);this.sun.target.position.set(center.x,0,center.z);this.drawMap();this.webgl.render(this.scene,this.cam);
 }
 start(){const loop=now=>{if(this.disposed)return;const dt=this.previous?(now-this.previous)/1000:0;this.previous=now;this.render(dt);this.animation=requestAnimationFrame(loop)};this.animation=requestAnimationFrame(loop)}
 dispose(){this.disposed=true;cancelAnimationFrame(this.animation);this.canvas.removeEventListener('webglcontextlost',this.onContextLost);this.scene.traverse(o=>{o.geometry?.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{m?.map?.dispose();m?.dispose()})});this.webgl.dispose()}
}
window.RaceCourseSection=courseSection;window.RaceRenderer=RaceRenderer;window.RACE_COLORS=COLORS;window.RACE_INK=INK;
