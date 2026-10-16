# Wedding Derby — realtime 3D

Eight-player, server-authoritative wedding racing game. Bride is slot 8; slots 2, 5 and 8 have female riders. Practice mode includes seven deterministic CPU riders.

## Run

`npm install` then `npm start`. Default port: 10000. `npm run build` rebuilds the committed renderer bundle. `node check.cjs` checks deterministic race outcomes, input effects, stamina and inactive slots.

The renderer uses an actual skinned GLB horse with an authored gallop, 3D riders, dress and veil, physically lit turf, rails, grandstands and three camera views. Buttons change the server simulation; world positions and gait speed follow those same states. Replay uses recorded race states. The 1,200 m closed oval has two 200 m bends and two 400 m straights; the final 400 m is the home straight. Horses, rails, distance markers, camera direction and the live course map share one path function. Lane offsets are visual only: every horse retains the same authoritative progress and finish rules. `node check-course.mjs` verifies the lap geometry and its joins.

## Asset provenance

`public/assets/3d/racehorse.glb` derives from **Rigged Horse**, by Lyndon Daniels, rigging by ChadM, CC0. Source: https://opengameart.org/content/rigged-horse . Texture node conversion, binding of mane/tail/eyes, normalization and a new gallop clip added here. No purchase or paid generation was used.

To reproduce: download the linked `.blend` file and run Blender 4.2 with `HORSE_SOURCE=/absolute/path/riggedHorse.blend blender -b --python scripts/build-horse.py`. The GLB is exported to this repository. The script also writes temporary verification renders to `/tmp`.

Three.js is MIT licensed; see `public/three-LICENSE.txt`.

## Limits

This is realtime WebGL 3D, not photoreal motion capture. Riders are original procedural meshes; the horse has one authored gallop clip. Race speed is compressed for a short wedding event. Rendering is independent from server time and has no effect on outcomes. Rooms are in memory and expire on server restart. Mobile hardware must support WebGL2. Keep one PC connected as host.
