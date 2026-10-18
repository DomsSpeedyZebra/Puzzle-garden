# Puzzle Garden

A gentle pipe puzzle for little ones. Turn the pipes so water flows from the tap to the flowers.
No ads, no timers, no scores. Works offline once added to a home screen.

**Play:** https://domsspeedyzebra.github.io/Puzzle-garden/
On iPhone: open in Safari → Share → **Add to Home Screen**.

## Files

| File | What it does |
|---|---|
| `index.html` | The page: home screen, game screen, win screen |
| `css/style.css` | All the looks. Colours are variables at the top |
| `js/levels.js` | Level data only — edit this to add or change levels |
| `js/game.js` | Game logic: drawing tiles, turning pipes, following the water |
| `manifest.json` | Makes it installable (name, icon, full-screen) |
| `sw.js` | Saves files on the device so it works offline |
| `icons/` | Home-screen icons |

## Adding a level

Each level is a grid of cells separated by spaces, one string per row:

| Cell | Meaning |
|---|---|
| `.` | grass (empty) |
| `R` | rock |
| `F` | flower |
| `T2` | tap — number is the direction water comes out |
| hex digit | a pipe, written in its **solved** position |

Pipe openings add up: **N=1, E=2, S=4, W=8**.
So `a` (10) = E+W straight, `5` = N+S straight, `3` = N+E corner, `c` (12) = S+W corner, `e` (14) = E+S+W tee, `f` = cross.

`mix` = how many pipes start turned the wrong way (`0` = all of them).

```js
{g:["T2 a c .",
    ". . 5 .",
    "F a 9 ."], mix:3},
```

## Releasing an update

1. Edit the files.
2. In `sw.js`, bump `CACHE` (e.g. `puzzle-garden-v1` → `v2`) so phones fetch the new version.
3. Commit and push to `main`. GitHub Pages updates in a minute or two.
