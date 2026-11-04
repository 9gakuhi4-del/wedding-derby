import CONFIG from '../race-config.cjs';
// One closed 1,400 m lap: 200 m bend, 500 m straight, repeated.
export const COURSE_LENGTH=CONFIG.distance;
export const HOME_STRAIGHT=CONFIG.homeStraight;
export const BEND_LENGTH=CONFIG.bendLength;
export const STRAIGHT_LENGTH=CONFIG.straightLength;
export const BEND_RADIUS=BEND_LENGTH/Math.PI;
export const TRACK_HALF_WIDTH=15;
export const METRES_PER_PERCENT=COURSE_LENGTH/100;
export const COURSE_SCALE=COURSE_LENGTH/1200;

export function coursePose(distance,lane=0){
 const d=Math.max(0,Math.min(COURSE_LENGTH,distance));
 const opposite=BEND_LENGTH+STRAIGHT_LENGTH,home=opposite+BEND_LENGTH;
 let x,z,tx,tz;
 const bend=d<BEND_LENGTH||(d>=opposite&&d<home);
 if(bend){
  const upper=d<BEND_LENGTH;
  const angle=upper?-d/BEND_RADIUS:-Math.PI-(d-opposite)/BEND_RADIUS;
  x=BEND_RADIUS*Math.cos(angle);
  z=(upper?-STRAIGHT_LENGTH/2:STRAIGHT_LENGTH/2)+BEND_RADIUS*Math.sin(angle);
  tx=Math.sin(angle);tz=-Math.cos(angle);
 }else{
  const back=d<opposite;
  x=back?-BEND_RADIUS:BEND_RADIUS;
  z=back?d-BEND_LENGTH-STRAIGHT_LENGTH/2:COURSE_LENGTH-STRAIGHT_LENGTH/2-d;
  tx=0;tz=back?1:-1;
 }
 const nx=-tz,nz=tx;
 return{x:x+nx*lane,z:z+nz*lane,tx,tz,nx,nz,yaw:Math.atan2(-tx,-tz),bend};
}
export function courseSection(distance){
 return distance<BEND_LENGTH?'第1・第2コーナー':distance<BEND_LENGTH+STRAIGHT_LENGTH?'向正面':distance<COURSE_LENGTH-HOME_STRAIGHT?'最終コーナー':'最後の直線';
}
