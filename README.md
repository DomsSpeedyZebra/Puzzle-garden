# Puzzle Garden

A gentle pipe puzzle for little ones. Turn the pipes so water flows from the tap to the flowers.
Press the tap to test: water flows, or splashes out of any gaps. No ads, no timers, no scores. Works offline once added to a home screen.

**Play:** https://domsspeedyzebra.github.io/Puzzle-garden/
On iPhone: open in Safari → Share → **Add to Home Screen**.

## Files

| File | What it does |
|---|---|
| `index.html` | The page: home screen, game screen, win screen |
| `css/style.css` | All the looks. Colours are variables at the top |
| `js/levels.js` | Worlds and level data — edit this to add or change levels |
| `js/game.js` | Game logic: drawing tiles, turning pipes, following the water |
| `manifest.json` | Makes it installable (name, icon, full-screen) |
| `sw.js` | Saves files on the device so it works offline |
| `icons/` | Home-screen icons |
| `bridge/` | **Bridge Builders**: `physics.js` (the truss simulation), `levels.js`, `game.js` |

## Adding a level

Each level is a grid of cells separated by spaces, one string per row:

| Cell | Meaning |
|---|---|
| `.` | grass (empty) |
| `R` | rock |
| `F` | flower |
| `T2` | tap — number is the direction water comes out |
| hex digit | a pipe, written in its **solved** position |
| `!` + hex | a **stuck** metal pipe that can't be turned (e.g. `!a`) |
| `?` + hex | an empty **slot**; that piece goes in the tray (e.g. `?3`) |
| `M` + hex | a slot covered by a **pebble** to drag away |
| `M` | a pebble on grass |
| `H` | a hedgehog that must stay dry |
| `X` / `?X` | a **bridge** (two pipes crossing), fixed or in the tray |
| `T2r`, `Fr` | red tap / red flower (Duck Pond) |
| `T2:3`, `F:5` | tap giving 3 blocks / flower needing 5 (Number Meadow) |

`extra:["3","a"]` adds spare decoy pieces to the tray.

Pipe openings add up: **N=1, E=2, S=4, W=8**.
So `a` (10) = E+W straight, `5` = N+S straight, `3` = N+E corner, `c` (12) = S+W corner, `e` (14) = E+S+W tee, `f` = cross.

`mix` = how many pipes start turned the wrong way (`0` = all of them).

```js
{g:["T2 a c .",
    ". . 5 .",
    "F a 9 ."], mix:3},
```

## Parent shortcut

Hold the **Puzzle Garden** title for 3 seconds to unlock every world (do it again to lock).

## Releasing an update

1. Edit the files.
2. In `sw.js`, bump `CACHE` (e.g. `puzzle-garden-v1` → `v2`) so phones fetch the new version.
3. Commit and push to `main`. GitHub Pages updates in a minute or two, and the game reloads itself on the next menu screen.

## Bridge Builders

A second game, linked from the home screen. Build with road (the car drives on it) and sticks (supports),
pick a car (1–5 blocks heavy) and press play. Every joint is a pin, so squares fold and triangles hold.
Pieces glow yellow → red as they take strain and snap past their limit.

Levels live in `bridge/levels.js` (comments explain each field). Strength and weight numbers are at the
top of `bridge/physics.js`. Each level has been checked so that a sensible answer gets the goal car
across within the piece limit, and a flat road on its own does not.
