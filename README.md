# Wedding Derby — realtime 3D

Nine-player, server-authoritative wedding racing game. Bride is slot 8; slots 2, 5 and 8 have female riders. Practice mode includes eight deterministic CPU riders.

## Run

`npm install` then `npm start`. Default port: 10000. `npm run build` rebuilds the committed renderer bundle. `node check-live.cjs` runs a local nine-player round, reconnection, readiness and reset integration check. `node check.cjs` checks deterministic race outcomes, input effects, stamina and inactive slots.

The renderer uses an actual skinned GLB horse with an authored gallop, 3D riders, dress and veil, physically lit turf, rails, grandstands and three camera views. Buttons change the server simulation; world positions and gait speed follow those same states. Replay uses recorded race states. The 1,400 m closed oval has two 200 m bends and two 500 m straights; the final 500 m is the home straight. Horses, rails, distance markers, camera direction and the live course map share one path function. Lane offsets are visual only: every horse retains the same authoritative progress and finish rules. `node check-course.mjs` verifies the lap geometry and its joins.

## Fixed running styles and closing strategy (1,400 m)

Numbers 1–2 are **先行 / front-runners**; numbers 3–9 are **差し / closers**. The two front-runners share identical stats, as do all seven closers (including the bride). Front-runners receive an effort-dependent pace boost before the home straight; closers bank finishing reserve faster and have a stronger finishing burst. Overall tuning favors a well-timed closer, but front-runners can beat poorly paced or late-launching closers. Styles are fixed on the server by slot, are shown before joining and in the player HUD/rankings, and survive reconnection/reset. There are no random speed rolls, rank-based catch-up, forced leaders or finish overrides. Early positioning matters: press **追う**, then use **控える** in the middle of the race to recover stamina and bank a finite **末脚** reserve. Pressing **追う** during the final 500 m spends that reserve for a closing burst. Idle horses do not bank reserve; the home straight cannot generate new reserve; waiting too long wastes the chance to use it. The player HUD shows running style, reserve and its activation. Practice opponents follow deterministic input plans suited to their styles, using the same physics and accepted-input limit as human players.

`race-config.cjs` is shared by the server, course, renderer and HUD. `node check-balance.cjs` checks a visible final-straight comeback, deterministic outcomes, equal stats within each style, finite reserve, late-launch penalties, and the possibility of a managed front-runner beating excessive waiting. It also compares a sweep of save/launch timings, validates the early pace advantage and later reversal, and verifies identical results within each style. `node check-renderer.cjs` exercises the actual built world geometry, map and camera/number calculations without GPU rendering; it does not replace a real-device WebGL rehearsal.

## Wedding-day flow

1. On the venue PC, open the private organizer link supplied with the fixed-QR release. Create a room, then press **本番QRの受付開始**. Distribute the fixed guest QR from `/invite.html` before the event; all nine riders use the same QR and never enter a room code. Keep the organizer link private.
2. Each rider chooses a number and name, waits for the 3D assets, then presses **準備OK**. The host can start once connected riders are ready. In **全画面**, the host-only panel shows readiness and **発走**; after the race it shows **次のレース**. Both views share the same server readiness checks.
3. **自動** switches broadcast shots; **自動／中継** tracks the leading horse when the field stretches beyond 42 m and returns to the pack once it closes below 28 m; **追走** follows your horse; **全景** shows the complete oval. The venue PC / practice screen unlocks sound on its first button press. **音 ON／OFF** controls both music and effects and remembers the choice. A directly opened spectator screen uses **音を開始** once. Avoid enabling sound on every rider phone at the venue.
4. Official results appear after the visible finish. Save the results as an image, replay the whole race, or watch the approach to the finish at 0.5× speed.
5. **次のレース** keeps riders and names but resets readiness and increments the round. Disconnected seats can be released from the lobby for replacement riders.

Horse-number badges keep stable collision placements, ease movement between positions and use level anchors independent of the gait. Camera cuts and screen resizing reset badge smoothing.

## Fixed guest QR

`/entry.html` is the permanent guest entrance; `/guest-qr.png` and `/guest-qr.svg` encode exactly `https://wedding-derby-live.onrender.com/entry.html`. `/invite.html` offers a print-ready invitation and PNG download. The QR contains no room code or organizer credential. The lightweight entrance polls `/api/entry` every three seconds, shows a waiting/full/racing/reconnection state and forwards to the selected room when intake is open. Returning riders use their existing browser token. The fixed-entry marker survives the game URL update; a deleted room sends an unregistered guest back to the entrance.

Only a current room host with the private organizer capability can publish/close this app's fixed entrance. The capability arrives in a URL fragment, is saved locally on that PC, and is immediately removed from the address bar. Only its SHA-256 verifier is in `entry-config.cjs`; never commit the capability or put it in the guest QR. Changing to a different room requires an explicit confirmation and an exact prior-room match; a countdown/running room cannot be replaced. Creating another room or running practice never changes the published entrance. Closing intake does not disconnect riders or stop the race. The existing room-code and direct-room links still work.

Rooms with a connected host or player no longer expire during a long lobby wait. Fully disconnected rooms expire after 45 minutes of inactivity. Rooms and the current destination remain in memory: after a server restart, guests safely see the same waiting page, and the organizer must create a new room and press **本番QRの受付開始** again. There is no automatic race restoration and no persistent database. The printed QR itself does not need replacement. Do not deploy/restart during the event. A free hosting cold start may delay the first connection; open the venue PC ahead of guests.

`node check-entry.cjs` verifies authorization, explicit room replacement, race protection, connected-room expiry, guest and organizer scripts, HTTP/Socket.IO entry, reconnect, QR PNG, and a complete server restart/republish. `node check-live.cjs` independently verifies the nine-player race. These are virtual-client tests, not a substitute for rehearsal on the actual phones and venue network.

Final positions remain server-authoritative. Run-out animation and ceremony effects never change the winner. There is no finish-order override.

## Stable mobile controls

On player/practice screens up to 900px wide, the controller is anchored to the viewport bottom (including the safe area) and the two input buttons remain reachable. The ready row sits above those buttons, so countdown does not push them down. The renderer canvas is absolutely positioned inside a size-constrained stage; changes to its high-DPI drawing buffer cannot enlarge the page. Instructions are no longer auto-hidden at race start. Mobile fields use 16px text to prevent focus zoom; repeated game inputs do not trigger double-tap zoom. User-controlled pinch zoom remains available. Stage-only fullscreen is hidden and guarded on mobile player/practice screens; the host's explicit fullscreen button remains unchanged. Race distance, style balance and authoritative input logic are unchanged.

## Manual fanfare

The host's **♪ ファンファーレ** button (also inside **全画面**) plays the supplied 21.6-second cue on that device only. A practice-mode button allows a sound check. Audio is prefetched for the host/practice screen, never auto-played, and is not downloaded by riders just for joining. The same button cancels loading or stops playback; repeated clicks cannot layer sounds. **発走** remains separate and is disabled during loading/playback. Ending the cue never starts a race. Muting, disconnecting, leaving the page or entering a race cancels the cue, including a late asynchronous load. A failed load leaves racing available and can be retried. Run `node check-fanfare.cjs` for the audio and control regression checks.

`public/assets/audio/fanfare.mp3` was supplied by the user on 2026-11-05. The original 27.17-second decoded recording is trimmed to 2.30–23.90 seconds, leaving approximately 0.10 seconds before the first note and 0.27 seconds after the tail. No musical content is replaced. This supplied cue is distinct from the original generated race score below; no CC0 or original-composition claim is made for the supplied recording.

## Optional natural finish

**質感：標準／自然** switches only presentation. Standard remains the default and restores the previously accepted lighting, surface maps, horse roughness and mowing colours. Natural adds a softly graduated sky, slightly less ambient fill, material-specific coat/eye/mane roughness, fine turf bump and nine soft contact shadows. The choice is stored per device. Models, animation, input, server simulation, cameras and number layout are shared. No external assets or post-processing pass are required.

## Asset provenance

`public/assets/3d/racehorse.glb` derives from **Rigged Horse**, by Lyndon Daniels, rigging by ChadM, CC0. Source: https://opengameart.org/content/rigged-horse . Texture node conversion, binding of mane/tail/eyes, normalization and a new gallop clip added here. No purchase or paid generation was used.

To reproduce: download the linked `.blend` file and run Blender 4.2 with `HORSE_SOURCE=/absolute/path/riggedHorse.blend blender -b --python scripts/build-horse.py`. The GLB is exported to this repository. The script also writes temporary verification renders to `/tmp`.

Three.js is MIT licensed; see `public/three-LICENSE.txt`.

`public/assets/audio/turf-sprint.mp3`: original instrumental “Wedding Derby — Turf Sprint”, generated for this game with Runway on 2026-10-16. Brass, strings, snare and timpani, 144 BPM. Opening fanfare, crossfaded race loop and finish cadence follow the displayed race state, including replay. No existing race fanfare was supplied or sampled.

## Limits

This is realtime WebGL 3D, not photoreal motion capture. Riders are original procedural meshes; the horse has one authored gallop clip. Race speed is compressed for a short wedding event. Rendering is independent from server time and has no effect on outcomes. Rooms are in memory and expire on server restart. Mobile hardware must support WebGL2. Keep one PC connected as host.
