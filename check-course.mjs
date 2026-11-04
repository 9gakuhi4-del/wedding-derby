import assert from 'node:assert/strict';
import {coursePose,COURSE_LENGTH,HOME_STRAIGHT,BEND_LENGTH,STRAIGHT_LENGTH,COURSE_SCALE,BEND_RADIUS,TRACK_HALF_WIDTH} from './src/course.mjs';

const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
for(const lane of [-15,-9.1,0,9.1,15]){
  const start=coursePose(0,lane),finish=coursePose(COURSE_LENGTH,lane);
  near(start.x,finish.x);near(start.z,finish.z);near(start.tx,finish.tx);near(start.tz,finish.tz);
  for(const join of [BEND_LENGTH,BEND_LENGTH+STRAIGHT_LENGTH,COURSE_LENGTH-HOME_STRAIGHT]){
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
  if(d>=COURSE_LENGTH-HOME_STRAIGHT){near(p.x,BEND_RADIUS);near(p.tx,0);near(p.tz,-1);}
  prev=p;
}
near(length,COURSE_LENGTH,.11);near(Math.abs(turn),2*Math.PI,1e-6);
// Progress is sampled without modulo at the finish; a completed horse never teleports forward.
near(coursePose(COURSE_LENGTH+1).z,coursePose(COURSE_LENGTH).z);
near(coursePose(-1).z,coursePose(0).z);
console.log('PASS: closed 1800m lap, continuous corners, full turn, lane width, horse headings, final 600m straight.');
