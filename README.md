# THE MIDNIGHT FISHING – អាថ៌កំបាំងវាលស្រែខ្មែរ  (Version 2)

## Run (VS Code + Live Server)
1. Keep all files in one folder: index.html, style.css, script.js, core.js, audio.js, environment.js, house.js, fishing.js, ghost.js, events.js, player.js, ui.js
2. Open the folder in VS Code, install the "Live Server" extension.
3. Right-click index.html -> "Open with Live Server" (ES modules do not work from file://).
4. Internet is needed once (Three.js from the unpkg CDN, Google Fonts).
5. Phone: open http://<PC-IP>:5500 on the same Wi-Fi. Touch controls appear automatically. Use Settings -> Graphics: Low on weak phones (reload after changing).

## Controls
WASD move · Mouse look · Shift run · Space jump · E interact / place trap / pull trap · F flashlight · Left click place trap · Esc pause
Phone: left stick move, drag right side to look, buttons RUN / jump / E / flashlight / trap.

## Goal
Take the flashlight + traps from the table, place 5 traps in the paddy water, collect 3 fish, return to the house alive.
Press E at a placed trap to pull it out of the water: a caught fish goes to your inventory and you get the trap back.

## What's new in V2
- Denser rice (6-blade clumps, varied heights, grain heads, colour variation, wind + gusts), brown muddy water, thicker fog, fake AO under trees, closer village, frogs hopping on the dikes.
- Real បង្កៃ: bent bamboo pole (ដងបង្កៃ) planted in the mud, thin line (ខ្សែបង្កៃ) and bait (នុយ) at the water; the fish hangs on the line; carried shape has the line pulled taut and tied to the pole; pull-out animation with fish visible inside; visible hands (place / pull animations), flashlight in hand with beam cone.
- Better fish models; fish flee when you splash, hide in the rice, and bite the bait (trap tugs).
- Ghost: taller, torn dress, sunken eyes, teeth, more hair. Encounters: stare, watch (vanishes when you look away, may reappear closer), creep (moves only when unseen), hiding in rice, behind you, on the path, behind trees, hunts.
- New events with cooldowns: shadow across the fields, canal gurgling, fish leaping, a trap that moves by itself, plus the existing cries, steps, rice gusts, flicker.
- Audio: positional frog ribbits/hops, canal sounds, stingers, mud splash steps.
- Graphics: colour grading, AA on Medium/High, Low/Medium/High presets.

## 👻 Rigged 3D ghost (ghost.glb)
The ghost is now the Mixamo-rigged model `assets/ghost.glb` (loaded by `ghostrig.js`). The old procedural ghost remains as an automatic fallback if the file fails to load.
Existing GhostAI behaviour (appear / follow / rush / hide / jumpscare) now drives bones via actions: `idle, stare, creep, walk, run, crouch, reach, scream, jumpscare`.
Coder API (`ghostrig.js`): `rig.play('run')`, `rig.gesture('headSnap'|'tilt'|'point'|'reach'|'shudder'|'lunge')`, `rig.hold('Head',[x,y,z])`, `rig.bones.Head`. Add new poses in the `ACTIONS` table.
Note: GLB is 11.6 MB, so first load takes a moment. Run with Live Server (needs http, not file://).

## ❤️ Health & escape
The ghost no longer kills instantly. You have 100 HP (HEALTH bar): each hit costs 34 HP and shoves her back; she recoils ~1 s. After a hit, if she fails to touch you for 5 seconds she dissolves and the hunt ends. A third hit is the jumpscare/game over. HP regenerates slowly when no hunt is active.

## Fullscreen
Pressing START (and Resume) switches the browser to full screen automatically (and locks landscape on phones where allowed).

## 3D arms
Both first-person arms use assets/hand_left.glb and assets/hand_right.glb (loaded in player.js; falls back to simple arms). Size: HAND_SCALE in player.js (0.34). If left/right look swapped, swap the two file names there.

Hand tuning (player.js): HAND_SCALE (size), HAND_Z (distance), ROLL_L / ROLL_R (roll of each forearm in radians; try 0.8 or -0.8 if the palm faces the wrong way).

## Loading screen
The loading screen is the FIRST screen (the world and 3D models build as soon as the page opens, then the menu appears). index.html #loading uses assets/loading.jpg with a running red line + percentage. The bar follows real progress (world build, then the ghost.glb download and arm models); the game starts after they are ready (max 40 s wait, then falls back).

## Fake-fish ambush
Sometimes (38% of eligible pulls, 150 s cooldown, never for the first fish) the thing thrashing in a trap is the ghost. When you pull it she rises from the water, slaps you to the ground (-50 HP, min 5), laughs, then dissolves; the trap is left empty. Tune in script.js: startAmbush / ambushUpdate (timeline constants T_*), trigger chance in interact('pull').

Laugh sound: assets/laugh.mp3 (falls back to the synthesized laugh if it fails to load); the closing shriek stays procedural.

## The weeping woman event
assets/girl.glb (her living form, same Mixamo rig). Rarely (cooldown ~260 s, after 70 s outside, not during a hunt) she sits crying on a dike. Walk within ~4 m (you stay free to move): an on-screen line asks "យប់ជ្រៅហើយ តើអ្នកមកយំធ្វើអ្វីនៅកន្លែងនេះ?", she stands, turns to face you, wipes her tears, turns into the ghost, cracks her neck and hunts you (same HP/escape rules). Code: GhostAI.startWeeper + GameManager.startWeep/weepUpdate; poses sitcry/stand/wipe/gaze/neckcrack in ghostrig.js. Test from the console: game.ghost.startWeeper().

Crying sound: assets/cry.mp3 loops (positional) while the weeping woman sits, fades when she stands; falls back to a synthesized sob.


### កែកាយវិការស្ត្រីយំ
អង្គុយយំ៖ ដៃទាំងពីរបិទមុខ ក្បាលឱន តូចៗញ័រ។ ក្រោកឈរ៖ ដៃឆ្វេងដាក់លើពោះ ដៃស្តាំទម្លាក់។ ជូតទឹកភ្នែក៖ ខ្នងដៃស្តាំជូតពីភ្នែកមកថ្ពាល់។ (គណនាដោយ IK លើ skeleton ពិត)

- ស្ត្រីយំ (កែលើកទី២)៖ អង្គុយគូទដល់ដី ជង្គង់លើក បាតដៃបិទមុខដោយមិនលិច (ត្រួតពិនិត្យជាមួយ mesh ពិត គម្លាត ≥ 2 សង់ទីម៉ែត្រ)។ ជូតទឹកភ្នែក៖ ដៃស្តាំអូសពីភ្នែកទៅថ្ពាល់ ដោយមិនប៉ះមុខ។ ពេលប្រែជាខ្មោច៖ ឈរក្នុងកាយវិការចុងក្រោយ ១វិនាទី រួចទើបកាច់កឆ្វេង-ស្តាំ (គ្មានលោតរាងកាយ គ្មានលើកដៃ)។
- ប្រែកាយ៖ ផ្សែងខ្មៅហុយឡើងព័ទ្ធជុំវិញនាងចាប់ពីវិនាទីទី ៨.៩ បិទបាំងពេលប្តូរជារូបខ្មោច រួចរសាត់បាត់ (FX.smokeOn ក្នុង environment.js)។
- កែសម្លេងប្រឡាយទឹកត្រង់ដែនកំណត់ (មិនឲ្យឮដូចភ្លៀងខ្លាំង): សម្លេងស្ងាត់ជាង ចង្អៀតជាង ស្រទន់ជាង។
- ប៊ូតុងផ្អាក៖ កែឲ្យចុចបាន (ជាប់ក្រោម look zone) និងរូប ❚❚ នៅចំកណ្តាលរង្វង់។
- ដកប៊ូតុងដាក់បង្កៃ (🪤) លើទូរសព្ទ ដាក់បង្កៃដោយប៊ូតុង E ជំនួស ហើយសារលើអេក្រង់បង្ហាញ 'E · Place trap'។
- អក្សរសារសួរ (dialog) តូចជាងមុន និងទាបជាងមុន កុំឲ្យបាំងស្ត្រី។
- ទំព័ររបៀបលេង៖ ពន្យល់ជាខ្មែរមុនទាំងអស់ រួចអង់គ្លេសនៅខាងក្រោម។
- សម្លេងថ្មីរបស់អ្នក៖ assets/flash.mp3 (បិទបើកពិល), door_open.mp3 (បើកទ្វារ), door_close.mp3 (បិទទ្វារ); បើផ្ទុកមិនបាន ប្រើសម្លេងសំយោគជំនួស។
- កែកំហុសគាំងពេលចុចលេងម្តងទៀតក្រោយឈ្នះ (បង្កៃដែលមានត្រីនៅក្នុងទឹកធ្វើឲ្យ dispose ជាប់កំហុស) ហើយបន្ថែមការការពារកុំឲ្យគាំងពេលចាប់ផ្តើមឡើងវិញ។
- assets/splash.mp3 = សម្លេងទឹកខ្ទាត (ប្រើគ្រប់កន្លែងទឹកខ្ទាត; fallback សំយោគ)។
- ដកសម្លេងចុចប៊ូតុងម៉ឺនុយចេញ។
- ដើមចេក ២ ប្រភេទ (banana_a/b) និងដើមស្វាយ ២ ប្រភេទ (mango_a/b) ជាម៉ូដែល 3D ពិត៖ បង្រួមពី ១៧ MB ទៅ ៣.៥ MB (texture ១០២៤ ឯកសារតែមួយ) ហើយប្រើតែដើមជិតអ្នកលេង (≤ ៣០-៤៥ ម៉ែត្រ) ឯដើមឆ្ងាយនៅជាដើមដែលបង្កើតដោយកូដ ដើម្បីកុំឲ្យយឺត។ បើម៉ូដែលផ្ទុកមិនបាន ដើមកូដនៅដដែល។
- ដើមដូង ២ ប្រភេទ (palm_a/b) ជាម៉ូដែលពិត ដូចចេក និងស្វាយ (ប្រើតែដើមជិតអ្នកលេង)។ ចំនួនអតិបរមាក្នុងមួយប្រភេទ ៥ (ទូរសព្ទ) ឬ ១០ (កុំព្យូទ័រ)។
- ដើមឈើយោលតាមខ្យល់ (GPU shader): ស្លឹក/ក្បាលដើមយោលជាងគល់ ហើយកាន់តែខ្លាំងពេលមានខ្យល់បក់ (gust); ជាមួយទាំងដើមម៉ូដែលពិត និងដើមកូដ។ ស្រមោលមិនយោលតាមទេ។
- សម្លេងថ្មីរបស់អ្នក៖ water_step (ដើរលើទឹក), heartbeat (បេះដូង កាត់យកតែ ១ ចង្វាក់ លឿនតាមកម្រិតខ្លាច), owl (ទីទុយ), slap (ទះ)។ មាន fallback សំយោគ។
