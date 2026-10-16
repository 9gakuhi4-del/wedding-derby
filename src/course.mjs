// A complete 1,200 m lap: 200 m bend, 400 m back straight,
// 200 m bend, then the 400 m home straight. Local forward is -Z.
export const COURSE_LENGTH = 1200;
export const BEND_RADIUS = 200 / Math.PI;
export const TRACK_HALF_WIDTH = 15;

export function coursePose(distance, lane = 0) {
  const d = Math.max(0, Math.min(COURSE_LENGTH, distance));
  let x, z, tx, tz;
  if (d < 200 || (d >= 600 && d < 800)) {
    const upper = d < 200;
    const angle = upper ? -d / BEND_RADIUS : -Math.PI - (d - 600) / BEND_RADIUS;
    x = BEND_RADIUS * Math.cos(angle);
    z = (upper ? -200 : 200) + BEND_RADIUS * Math.sin(angle);
    tx = Math.sin(angle);
    tz = -Math.cos(angle);
  } else {
    const back = d < 600;
    x = back ? -BEND_RADIUS : BEND_RADIUS;
    z = back ? d - 400 : 1000 - d;
    tx = 0;
    tz = back ? 1 : -1;
  }
  const nx = -tz, nz = tx;
  return {x: x + nx * lane, z: z + nz * lane, tx, tz, nx, nz,
    yaw: Math.atan2(-tx, -tz), bend: d < 200 || (d >= 600 && d < 800)};
}

export function courseSection(distance) {
  return distance < 200 ? '第1・第2コーナー' : distance < 600 ? '向正面' : distance < 800 ? '最終コーナー' : '最後の直線';
}
