# Pacific Run

A browser-playable coastal driving and walking vertical slice inspired by open-world games. The boulevard has a licensed concept car, textured modular façades, imported detailed building models, street props, scanned road surfaces, palms, four civilian character models, walking pedestrians, a modeled sedan traffic fleet, and a five-checkpoint driving run. It is a prototype, **not** GTA V or a photorealistic AAA game.

## Play

```sh
npm install
npm run dev
```

Open the address Vite prints, then click **Take the wheel** to begin and enable sound. A WebGL-capable browser and a reasonably capable GPU are recommended. The loading screen waits for the environment, textures, cars and characters before revealing the game. If an asset fails, it offers retry or a clearly labelled fallback mode.

- **W/S** or **↑/↓**: drive or reverse; **A/D** or **←/→**: steer. On foot, **WASD** or the arrows move relative to the camera; drag the scene to look around.
- **E**: get out of a stopped car, or get back in when standing near it. The on-screen button does the same. On foot, hold **Shift** to move faster.
- **Space**: brake in the car. **R**: reset to the start.
- **Start run**: return to the car and start the checkpoint challenge. The note button mutes engine and footstep sounds.
- On narrow screens, hold the on-screen direction buttons. The game uses procedural foot and engine sounds, not recorded audio.

## Map and asset workflow

The base district is procedural Three.js geometry batched by material. Frontages combine imported Poly Haven modular GLBs and textured Midcity buildings, with imported Downtown models for the skyline. These are instanced in distance-limited chunks; imported lamps, hydrants, bins, palms and repeating scanned textures dress the street. The rigged Rocketbox people use a simple procedural in-place gait, not motion-captured animation. Full credits are in [docs/RESEARCH.md](docs/RESEARCH.md) and accessible in-game via **Credits**. The Microsoft Rocketbox MIT license is bundled beside the models.

`tools/build_map.py` contains an optional Blender-authored base district generator. With Blender installed, run from the repository root:

```sh
blender --background --python tools/build_map.py
```

This writes `public/models/coast.blend` and `public/models/coast.glb`. The game loads the GLB when present, otherwise its procedural base; the imported façade and prop layer is added in both cases. The optional Blender generator was not run in this sandbox because its required system graphics libraries were unavailable. It has not been updated to reflect the new frontage layout and may overlap the imported buildings; use the default procedural base for this version.

## Tests

`npm test` checks the bundled GLBs, the module names and biped joints used by the runtime, the textures, the character license and camera-relative movement math. `npm run build` creates a production build.

## Limitations

This is a deliberately small prototype: a single straight district with simple driving, collision, traffic and pedestrian motion. There are no interiors, combat, missions beyond the checkpoint run, advanced physics, recorded soundscape, production character animation, or multiplayer. The assets improve the visual quality, but the scene is not photorealistic or AAA; such a game requires a much larger art, animation, engineering and QA effort.

### Mobile controls
On touch devices, hold the left/right arrows to steer or sidestep and GO/BACK to move. Hold BRAKE to slow the car or SPRINT on foot. Use EXIT/ENTER CAR and RESET as needed. Drag the open scene to look around on foot. Steering and pedals can be held at the same time.
