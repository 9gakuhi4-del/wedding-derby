# Wedding Derby — realtime 3D

Eight-player, server-authoritative wedding racing game. Bride is slot 8; slots 2, 5 and 8 have female riders. Practice mode includes seven deterministic CPU riders.

## Run

`npm install` then `npm start`. Default port: 10000. `npm run build` rebuilds the committed renderer bundle. `node check-live.cjs` runs a local eight-player round, reconnection, readiness and reset integration check. `node check.cjs` checks deterministic race outcomes, input effects, stamina and inactive slots.

The renderer uses an actual skinned GLB horse with an authored gallop, 3D riders, dress and veil, physically lit turf, rails, grandstands and three camera views. Buttons change the server simulation; world positions and gait speed follow those same states. Replay uses recorded race states. The 1,800 m closed oval has two 300 m bends and two 600 m straights; the final 600 m is the home straight. Horses, rails, distance markers, camera direction and the live course map share one path function. Lane offsets are visual only: every horse retains the same authoritative progress and finish rules. `node check-course.mjs` verifies the lap geometry and its joins.

## Closing strategy (1,800 m)

All eight horses have identical stats, including the bride. There are no random speed rolls, slot bonuses or rank-based catch-up. Early positioning matters: press **追う**, then use **控える** in the middle of the race to recover stamina and bank a finite **末脚** reserve. Pressing **追う** during the final 600 m spends that reserve for a closing burst. Idle horses do not bank reserve; the home straight cannot generate new reserve; waiting too long wastes the chance to use it. The player HUD shows reserve and its activation. Practice opponents follow varied deterministic input plans, not special abilities.

`race-config.cjs` is shared by the server, course, renderer and HUD. `node check-balance.cjs` checks a visible final-straight comeback, deterministic outcomes, identical slot stats, finite reserve, late-launch penalties, and the possibility of a managed front-runner beating excessive waiting. `node check-renderer.cjs` exercises the actual built world geometry, map and camera/number calculations without GPU rendering; it does not replace a real-device WebGL rehearsal.

## Wedding-day flow

1. Open the game on the venue PC and create a room. Use **参加QR** to let the eight riders join on their own phones.
2. Each rider chooses a number and name, waits for the 3D assets, then presses **準備OK**. The host can start once connected riders are ready. In **全画面**, the host-only panel shows readiness and **発走**; after the race it shows **次のレース**. Both views share the same server readiness checks.
3. **自動** switches broadcast shots; **自動／中継** tracks the leading horse when the field stretches beyond 42 m and returns to the pack once it closes below 28 m; **追走** follows your horse; **全景** shows the complete oval. The venue PC / practice screen unlocks sound on its first button press. **音 ON／OFF** controls both music and effects and remembers the choice. A directly opened spectator screen uses **音を開始** once. Avoid enabling sound on every rider phone at the venue.
4. Official results appear after the visible finish. Save the results as an image, replay the whole race, or watch the approach to the finish at 0.5× speed.
5. **次のレース** keeps riders and names but resets readiness and increments the round. Disconnected seats can be released from the lobby for replacement riders.

Horse-number badges keep stable collision placements, ease movement between positions and use level anchors independent of the gait. Camera cuts and screen resizing reset badge smoothing.

Final positions remain server-authoritative. Run-out animation and ceremony effects never change the winner. There is no finish-order override.

## Manual fanfare

The host's **♪ ファンファーレ** button (also inside **全画面**) plays the supplied 21.6-second cue on that device only. A practice-mode button allows a sound check. Audio is prefetched for the host/practice screen, never auto-played, and is not downloaded by riders just for joining. The same button cancels loading or stops playback; repeated clicks cannot layer sounds. **発走** remains separate and is disabled during loading/playback. Ending the cue never starts a race. Muting, disconnecting, leaving the page or entering a race cancels the cue, including a late asynchronous load. A failed load leaves racing available and can be retried. Run `node check-fanfare.cjs` for the audio and control regression checks.

`public/assets/audio/fanfare.mp3` was supplied by the user on 2026-11-05. The original 27.17-second decoded recording is trimmed to 2.30–23.90 seconds, leaving approximately 0.10 seconds before the first note and 0.27 seconds after the tail. No musical content is replaced. This supplied cue is distinct from the original generated race score below; no CC0 or original-composition claim is made for the supplied recording.

## Optional natural finish

**質感：標準／自然** switches only presentation. Standard remains the default and restores the previously accepted lighting, surface maps, horse roughness and mowing colours. Natural adds a softly graduated sky, slightly less ambient fill, material-specific coat/eye/mane roughness, fine turf bump and eight soft contact shadows. The choice is stored per device. Models, animation, input, server simulation, cameras and number layout are shared. No external assets or post-processing pass are required.

## Asset provenance

`public/assets/3d/racehorse.glb` derives from **Rigged Horse**, by Lyndon Daniels, rigging by ChadM, CC0. Source: https://opengameart.org/content/rigged-horse . Texture node conversion, binding of mane/tail/eyes, normalization and a new gallop clip added here. No purchase or paid generation was used.

To reproduce: download the linked `.blend` file and run Blender 4.2 with `HORSE_SOURCE=/absolute/path/riggedHorse.blend blender -b --python scripts/build-horse.py`. The GLB is exported to this repository. The script also writes temporary verification renders to `/tmp`.

Three.js is MIT licensed; see `public/three-LICENSE.txt`.

`public/assets/audio/turf-sprint.mp3`: original instrumental “Wedding Derby — Turf Sprint”, generated for this game with Runway on 2026-10-16. Brass, strings, snare and timpani, 144 BPM. Opening fanfare, crossfaded race loop and finish cadence follow the displayed race state, including replay. No existing race fanfare was supplied or sampled.

## Limits

This is realtime WebGL 3D, not photoreal motion capture. Riders are original procedural meshes; the horse has one authored gallop clip. Race speed is compressed for a short wedding event. Rendering is independent from server time and has no effect on outcomes. Rooms are in memory and expire on server restart. Mobile hardware must support WebGL2. Keep one PC connected as host.
