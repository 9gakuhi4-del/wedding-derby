import assert from 'node:assert/strict';
import {coursePose,COURSE_LENGTH,BEND_RADIUS,TRACK_HALF_WIDTH} from './src/course.mjs';

const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
for(const lane of [-15,-9.1,0,9.1,15]){
  const start=coursePose(0,lane),finish=coursePose(1200,lane);
  near(start.x,finish.x);near(start.z,finish.z);near(start.tx,finish.tx);near(start.tz,finish.tz);
  for(const join of [200,600,800]){
    const a=coursePose(join-1e-5,lane),b=coursePose(join+1e-5,lane);
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<3e-5,'Disconnected track join');
    assert.ok(Math.hypot(a.tx-b.tx,a.tz-b.tz)<1e-6,'Discontinuous heading');
  }
}
let length=0,prev=coursePose(0),turn=0;
for(let d=.1;d<=COURSE_LENGTH;d+=.1){
  const p=coursePose(d);length+=Math.hypot(p.x-prev.x,p.z-prev.z);
  turn+=Math.atan2(prev.tx*p.tz-prev.tz*p.tx,prev.tx*p.tx+prev.tz*p.tz);
  near(Math.hypot(p.tx,p.tz),1);near(p.tx*p.nx+p.tz*p.nz,0);
  near(-Math.sin(p.yaw),p.tx);near(-Math.cos(p.yaw),p.tz);
  const inside=coursePose(d,-TRACK_HALF_WIDTH),outside=coursePose(d,TRACK_HALF_WIDTH);
  near(Math.hypot(outside.x-inside.x,outside.z-inside.z),30);
  if(d>=800){near(p.x,BEND_RADIUS);near(p.tx,0);near(p.tz,-1);}
  prev=p;
}
near(length,1200,.11);near(Math.abs(turn),2*Math.PI,1e-6);
// Progress is sampled without modulo at the finish; a completed horse never teleports forward.
near(coursePose(1201).z,coursePose(1200).z);
near(coursePose(-1).z,coursePose(0).z);
console.log('PASS: closed 1200m lap, continuous corners, full turn, lane width, horse headings, final 400m straight.');
