'use strict';
// Exercise the shipped renderer math and world construction, not a fake WebGL frame.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),THREE=require('three');
const {makeHorse}=require('./race-engine');
const mapPoints=[],texts=[];
const ctx=new Proxy({},{get:(_,k)=>k==='measureText'?()=>({width:30}):(...a)=>{if(k==='lineTo'||k==='moveTo')mapPoints.push(a);if(k==='fillText')texts.push(a[0])},set:()=>true});
const window={},document={createElement:()=>({width:0,height:0,getContext:()=>ctx}),getElementById:()=>({getContext:()=>ctx})};
vm.runInNewContext(fs.readFileSync('public/renderer3d.js','utf8'),{window,document,console,AbortController,TextDecoder});
assert.equal(window.RACE_CONFIG.horseCount,9);assert.equal(window.RACE_COLORS.length,9);assert.equal(window.RACE_INK.length,9);assert.equal(window.RACE_CONFIG.distance,1400);assert.equal(window.RaceCourseSection(899),'最終コーナー');assert.equal(window.RaceCourseSection(900),'最後の直線');
const r=Object.create(window.RaceRenderer.prototype);
Object.assign(r,{scene:new THREE.Scene(),webgl:{capabilities:{getMaxAnisotropy:()=>1},setSize(){},render(){}},canvas:{clientWidth:1920,clientHeight:1080},cam:new THREE.PerspectiveCamera(46,16/9,.1,1800),look:new THREE.Vector3(),sun:{position:new THREE.Vector3(),target:{position:new THREE.Vector3()}},time:0,previous:0,selected:7,visual:[],horses:[]});
r.scene.fog=new THREE.FogExp2('#c4d8df',.0035);r.buildWorld();
r.scene.traverse(o=>{if(o.geometry){for(const n of o.geometry.attributes.position.array)assert(Number.isFinite(n));}});
assert.equal(r.turf.track.geometry.attributes.position.count,1202,'track geometry budget unchanged');
assert.equal(r.gateDoors.length,18,'nine two-door starting stalls');
const horseModel=new THREE.Group();horseModel.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({name:'coat'})));
r.buildField({scene:horseModel,animations:[]});assert.equal(r.horses.length,9);assert(texts.includes(9));assert(r.horses[7].rider.veil&&!r.horses[8].rider.veil);r.selected=8;
let round=0;
for(const aspect of [[1920,1080],[1366,600],[390,293]])for(const camera of ['auto','wide','front','focus','overview'])for(const progress of [0,14.28,14.3,49.99,50,64.28,64.3,90,99,100]){
 r.canvas.clientWidth=aspect[0];r.canvas.clientHeight=aspect[1];r.camera=camera;
 const state={code:'MATH',round:++round,tick:1,status:progress===100?'finished':progress===0?'lobby':'running',elapsed:40,horses:Array.from({length:9},(_,i)=>({...makeHorse(i),progress:Math.max(0,progress-i*.5),speed:2.5,finish:progress===100?40:null})),finishOrder:progress===100?[0,1,2,3,4,5,6,7,8]:[]};
 r.setState(state);mapPoints.length=0;r.render(.016);if(progress===0){const xs=r.horses.map(a=>a.root.position.x);assert.equal(new Set(xs).size,9);assert(Math.abs(Math.abs(xs[8]-xs[0])-20.8)<.001);}
 for(const n of [...r.cam.position.toArray(),...r.look.toArray(),...r.cam.projectionMatrix.elements])assert(Number.isFinite(n));
 for(const a of r.horses){assert(a.root.position.toArray().every(Number.isFinite));if(a.label.visible){assert(a.label.position.toArray().every(Number.isFinite));assert(a.label.scale.x>0&&a.label.scale.y>0);}}
 assert(mapPoints.every(([x,y])=>x>5&&x<355&&y>40&&y<175),'1400m minimap fits its canvas');
 if(progress>17&&progress<98&&['auto','wide'].includes(camera))assert.equal(r.shot==='leader'||camera==='wide'&&r.leaderFollow,true,'spread field still follows leader');
}
assert(texts.includes('芝 1,400m · 1周'));
console.log('PASS: shipped 1400m configuration; finite world geometry; unchanged track vertex budget; all camera modes and badge math at corners/finish; leader tracking; minimap fits desktop/mobile. GPU pixels not tested.');
