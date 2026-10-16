# Wedding Derby — realtime 3D

Eight-player, server-authoritative wedding racing game. Bride is slot 8; slots 2, 5 and 8 have female riders. Practice mode includes seven deterministic CPU riders.

## Run

`npm install` then `npm start`. Default port: 10000. `npm run build` rebuilds the committed renderer bundle. `node check-live.cjs` runs a local eight-player round, reconnection, readiness and reset integration check. `node check.cjs` checks deterministic race outcomes, input effects, stamina and inactive slots.

The renderer uses an actual skinned GLB horse with an authored gallop, 3D riders, dress and veil, physically lit turf, rails, grandstands and three camera views. Buttons change the server simulation; world positions and gait speed follow those same states. Replay uses recorded race states. The 1,200 m closed oval has two 200 m bends and two 400 m straights; the final 400 m is the home straight. Horses, rails, distance markers, camera direction and the live course map share one path function. Lane offsets are visual only: every horse retains the same authoritative progress and finish rules. `node check-course.mjs` verifies the lap geometry and its joins.

## Wedding-day flow

1. Open the game on the venue PC and create a room. Use **参加QR** to let the eight riders join on their own phones.
2. Each rider chooses a number and name, waits for the 3D assets, then presses **準備OK**. The host can start once connected riders are ready. In **全画面**, the host-only panel shows readiness and **発走**; after the race it shows **次のレース**. Both views share the same server readiness checks.
3. **自動** switches broadcast shots; **自動／中継** tracks the leading horse when the field stretches beyond 42 m and returns to the pack once it closes below 28 m; **追走** follows your horse; **全景** shows the complete oval. The venue PC / practice screen unlocks sound on its first button press. **音 ON／OFF** controls both music and effects and remembers the choice. A directly opened spectator screen uses **音を開始** once. Avoid enabling sound on every rider phone at the venue.
4. Official results appear after the visible finish. Save the results as an image, replay the whole race, or watch the approach to the finish at 0.5× speed.
5. **次のレース** keeps riders and names but resets readiness and increments the round. Disconnected seats can be released from the lobby for replacement riders.

Horse-number badges keep stable collision placements, ease movement between positions and use level anchors independent of the gait. Camera cuts and screen resizing reset badge smoothing.

Final positions remain server-authoritative. Run-out animation and ceremony effects never change the winner. There is no finish-order override.

## Asset provenance

`public/assets/3d/racehorse.glb` derives from **Rigged Horse**, by Lyndon Daniels, rigging by ChadM, CC0. Source: https://opengameart.org/content/rigged-horse . Texture node conversion, binding of mane/tail/eyes, normalization and a new gallop clip added here. No purchase or paid generation was used.

To reproduce: download the linked `.blend` file and run Blender 4.2 with `HORSE_SOURCE=/absolute/path/riggedHorse.blend blender -b --python scripts/build-horse.py`. The GLB is exported to this repository. The script also writes temporary verification renders to `/tmp`.

Three.js is MIT licensed; see `public/three-LICENSE.txt`.

`public/assets/audio/turf-sprint.mp3`: original instrumental “Wedding Derby — Turf Sprint”, generated for this game with Runway on 2026-10-16. Brass, strings, snare and timpani, 144 BPM. Opening fanfare, crossfaded race loop and finish cadence follow the displayed race state, including replay. No existing race fanfare was supplied or sampled.

## Limits

This is realtime WebGL 3D, not photoreal motion capture. Riders are original procedural meshes; the horse has one authored gallop clip. Race speed is compressed for a short wedding event. Rendering is independent from server time and has no effect on outcomes. Rooms are in memory and expire on server restart. Mobile hardware must support WebGL2. Keep one PC connected as host.
