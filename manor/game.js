/* =====================================================================
   MURDER AT MUDDLECOMBE MANOR — pass-and-play whodunnit
   data.js holds the suspects, weapons and rooms. This file runs the game.

   How a game flows (G.phase):
     pass        -> "pass the phone to X" cover screen
     turn        -> X rolls, moves, suggests, accuses, ends turn
     passRefute  -> cover screen: pass to whoever must show a card
     refute      -> they pick which card to show
     passBack    -> cover screen: pass back to X
     shown       -> X sees the card they were shown
     over        -> someone solved it (or everyone guessed wrong)
   The whole game is saved on the phone after every step, so closing the
   app mid-game is fine.
   ===================================================================== */
"use strict";

const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const SAVE = "manor.game";
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

/* ---------- 1. The board ---------- */
const key = (r, c) => r * 100 + c;
const roomAt = (r, c) => ROOMS.findIndex(R => r >= R.r && r < R.r + R.h && c >= R.c && c < R.c + R.w);
const isCorridor = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS && roomAt(r, c) < 0;
const DOOR = {};                       // corridor square -> which room's door it is
ROOMS.forEach((R, i) => R.doors.forEach(([r, c]) => DOOR[key(r, c)] = i));

/* ---------- 2. Cards ----------
   Every card has an id: s0-s5 suspects, w0-w5 weapons, r0-r8 rooms. */
const LISTS = { s: SUSPECTS, w: WEAPONS, r: ROOMS };
const card = id => LISTS[id[0]][+id.slice(1)];
const ALL_CARDS = [...SUSPECTS.map((_, i) => "s" + i), ...WEAPONS.map((_, i) => "w" + i), ...ROOMS.map((_, i) => "r" + i)];
function cardHtml(id, extra) {
  const c = card(id), t = id[0];
  const band = t === "s" ? c.col : t === "w" ? "#6b4a2b" : "#3f5a3a";
  return '<div class="card ' + (extra || "") + '" data-id="' + id + '"><i style="background:' + band + '"></i><span class="ic">' + c.icon + '</span><b>' + esc(c.name) + "</b></div>";
}

/* ---------- 3. Game state ---------- */
let G = store.get(SAVE, null);
let ui = { reach: null, count: 4, seats: [] };
const save = () => store.set(SAVE, G);
const me = () => G.players[G.turn];
const nameOf = p => G.players[p].name;
const charOf = p => SUSPECTS[G.players[p].ch];
const playerFor = s => G.players.findIndex(p => p.ch === s);   // which player is this suspect (-1 = nobody)
const posRoom = s => G.pos[s].room;                           // room number, or undefined in a corridor
const isBot = p => !!G.players[p].bot;
const humans = () => G.players.filter(p => !p.bot).length;
// Whose cards and notebook can be shown right now: the current player if they're
// human, or the only human at the table while the computer players take their turns
function viewer() {
  if (!me().bot) return G.turn;
  return humans() === 1 ? G.players.findIndex(p => !p.bot) : -1;
}

function newGame(seats) {
  const sol = { s: Math.floor(Math.random() * 6), w: Math.floor(Math.random() * 6), r: Math.floor(Math.random() * 9) };
  const rest = shuffle(ALL_CARDS.filter(id => id !== "s" + sol.s && id !== "w" + sol.w && id !== "r" + sol.r));
  const players = seats.map(s => ({ name: s.name, ch: s.ch, bot: s.bot || null, hand: [], out: false, notes: {}, seen: {}, summoned: false }));
  rest.forEach((id, i) => players[i % players.length].hand.push(id));      // deal round the table
  players.forEach(p => p.hand.forEach(id => p.notes[id] = "x"));           // your own cards are crossed off
  const rooms = shuffle(ROOMS.map((_, i) => i));
  G = {
    players, sol,
    pos: SUSPECTS.map(s => ({ r: s.start[0], c: s.start[1] })),
    weapons: WEAPONS.map((_, i) => rooms[i]),                             // which room each weapon is in
    turn: 0, phase: "pass", t: freshTurn(0, true), sugg: null, log: [], winner: null, accuse: null
  };
  G.log.push("The body has been found. Nobody leaves Muddlecombe Manor until it's solved.");
  G.players.forEach((p, i) => { if (p.bot) BOT.init(i); });              // computer players start their notebooks
  save(); render();
}

function freshTurn(p, first) {
  const room = G && !first ? posRoom(G.players[p].ch) : undefined;
  return { rolled: 0, moved: false, entered: false, suggested: false, accused: false, startRoom: room };
}

/* ---------- 4. Moving ----------
   After a roll, work out every corridor square and room you could reach.
   You can stop on any square up to your roll; going into a room ends your move.
   Other people's tokens block corridor squares. You can't go back into the
   room you started in this turn. */
function reachable(s, steps) {
  const start = G.pos[s];
  const blocked = new Set();
  G.pos.forEach((p, i) => { if (i !== s && p.room === undefined) blocked.add(key(p.r, p.c)); });
  const dist = new Map(), rooms = new Set(), queue = [];
  const consider = (r, c, d) => {
    const k = key(r, c);
    if (!isCorridor(r, c) || blocked.has(k) || dist.has(k)) return;
    dist.set(k, d); queue.push([r, c, d]);
  };
  if (start.room !== undefined) ROOMS[start.room].doors.forEach(([r, c]) => consider(r, c, 1));
  else { dist.set(key(start.r, start.c), 0); queue.push([start.r, start.c, 0]); }
  while (queue.length) {
    const [r, c, d] = queue.shift();
    const dr = DOOR[key(r, c)];
    if (dr !== undefined && d < steps && dr !== start.room && dr !== G.t.startRoom) rooms.add(dr);
    if (d >= steps) continue;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => consider(r + a, c + b, d + 1));
  }
  const cells = new Set();
  dist.forEach((d, k) => { if (d > 0) cells.add(k); });
  return { cells, rooms };
}

function roll() {
  if (G.t.rolled || G.t.moved) return;
  G.t.rolled = 1 + Math.floor(Math.random() * 6);
  ui.reach = reachable(me().ch, G.t.rolled);
  if (!ui.reach.cells.size && !ui.reach.rooms.size) { G.t.moved = true; G.t.boxed = true; ui.reach = null; }   // nowhere to go
  save(); render();
}

function moveTo(target) {          // target = {r,c} or {room}
  const s = me().ch;
  G.pos[s] = target;
  G.t.moved = true; ui.reach = null;
  if (target.room !== undefined) {
    G.t.entered = true;
    G.log.push(nameOf(G.turn) + " went into the " + ROOMS[target.room].name + ".");
    save(); render();
    if (!me().bot) openSuggest();  // humans go straight into a suggestion
    return;
  }
  save(); render();
}

function usePassage() {
  const r = posRoom(me().ch);
  if (r === undefined || ROOMS[r].passage === undefined || G.t.moved || G.t.rolled) return;
  G.log.push(nameOf(G.turn) + " took the secret passage.");
  moveTo({ room: ROOMS[r].passage });
}

/* ---------- 5. Suggestions ---------- */
function canSuggest() {
  const r = posRoom(me().ch);
  if (r === undefined || G.t.suggested || G.t.accused) return false;
  return G.t.entered || (me().summoned && !G.t.moved);
}

function makeSuggestion(s, w) {
  const r = posRoom(me().ch);
  G.t.suggested = true; ui.reach = null;
  // The suspect and weapon are brought into the room
  G.pos[s] = { room: r };
  G.weapons[w] = r;
  const other = playerFor(s);
  if (other >= 0 && other !== G.turn) G.players[other].summoned = true;
  G.log.push(nameOf(G.turn) + " suggested " + SUSPECTS[s].name + " with the " + WEAPONS[w].name + " in the " + ROOMS[r].name + ".");
  // Go round the table from the next player; the first one holding any of the three must show one
  const want = ["s" + s, "w" + w, "r" + r];
  let ref = -1;
  const noHelp = [];
  for (let k = 1; k < G.players.length; k++) {
    const p = (G.turn + k) % G.players.length;
    if (G.players[p].hand.some(id => want.includes(id))) { ref = p; break; }
    noHelp.push(p);
    G.log.push("  " + nameOf(p) + " couldn't help.");
  }
  G.sugg = { by: G.turn, s, w, r, want, ref, noHelp, shown: null };
  if (ref < 0) { G.log.push("  Nobody could show a card!"); finishSuggestion(); return; }
  if (isBot(ref)) {                                    // a computer player picks its own card to show
    showCard(BOT.chooseRefute(ref, G.turn, G.players[ref].hand.filter(id => want.includes(id))));
    return;
  }
  G.phase = "passRefute";
  save(); render();
}

function showCard(id) {
  G.sugg.shown = id;
  G.log.push("  " + nameOf(G.sugg.ref) + " showed " + nameOf(G.sugg.by) + " a card.");
  const by = G.players[G.sugg.by];
  by.seen[id] = G.sugg.ref;                    // remembered for the notebook
  if (!by.notes[id]) by.notes[id] = "x";
  finishSuggestion();
}

// Tell the computer players what they saw, then decide where the phone goes next
function finishSuggestion() {
  const sg = G.sugg;
  G.players.forEach((p, i) => { if (p.bot) BOT.observe(i, { by: sg.by, want: sg.want, noHelp: sg.noHelp, ref: sg.ref, shown: sg.shown }); });
  if (isBot(sg.by)) {                          // a computer suggested: it carries on with its turn
    G.t.botMsg = nameOf(sg.by) + " suggested " + suggText(sg) + ". " + (sg.ref < 0 ? "Nobody could show a card!" : nameOf(sg.ref) + " showed them a card.");
    nextDelay = 2600;                          // give people time to read it
    G.sugg = null; G.phase = "turn";
  } else if (sg.ref >= 0 && !isBot(sg.ref)) G.phase = "passBack";   // a human showed a human
  else G.phase = "shown";
  save(); render();
}

/* ---------- 6. Accusations ---------- */
function accuse(s, w, r) {
  G.t.accused = true;
  const ok = s === G.sol.s && w === G.sol.w && r === G.sol.r;
  G.accuse = { by: G.turn, s, w, r, ok };
  G.log.push(nameOf(G.turn) + " accused " + SUSPECTS[s].name + " with the " + WEAPONS[w].name + " in the " + ROOMS[r].name + (ok ? " ... and was RIGHT!" : " ... and was wrong. They're out."));
  if (ok) { G.winner = G.turn; G.phase = "over"; }
  else me().out = true;
  if (me().bot) G.t.botMsg = nameOf(G.turn) + " accused " + SUSPECTS[s].name + " with the " + WEAPONS[w].name + " in the " + ROOMS[r].name + (ok ? "... and was right!" : "... and was wrong! They're out.");
  save(); render();
  if (!ok && !me().bot) showModal(wrongHtml(), [["I'll keep quiet", () => { closeModal(); endTurn(); }]], true);
}

/* ---------- 7. Turns ---------- */
function endTurn() {
  me().summoned = false;
  ui.reach = null;
  const n = G.players.length;
  let next = -1;
  for (let k = 1; k <= n; k++) { const p = (G.turn + k) % n; if (!G.players[p].out) { next = p; break; } }
  if (next < 0) { G.phase = "over"; G.winner = null; save(); render(); return; }   // everyone guessed wrong
  G.turn = next;
  G.t = freshTurn(next);
  G.phase = "pass";
  save(); render();
}


/* ---------- 8. Computer players' turns ----------
   A bot does one step at a time (roll, move, suggest, accuse, end turn) with a
   pause between each, so everyone can watch. bots.js does the thinking. */
let botTimer = null, nextDelay = 0;
const BOT_DELAY = 950;
function scheduleBot() {
  if (botTimer || !G || G.phase !== "turn" || !me().bot || !$("modal").hidden || $("game").hidden) return;
  botTimer = setTimeout(botStep, nextDelay || BOT_DELAY);
  nextDelay = 0;
}
function say(msg) { G.t.botMsg = msg; save(); render(); }
function botStep() {
  botTimer = null;
  if (!G || G.phase !== "turn" || !me().bot || $("game").hidden) return;
  const b = G.turn, p = me(), t = G.t;
  if (t.accused) { endTurn(); return; }
  const fresh = !t.rolled && !t.moved && !t.suggested;
  // Sure of the answer (or feeling lucky)? Accuse at the start of the turn or after a suggestion
  if (fresh || t.suggested) {
    const a = BOT.decideAccuse(b);
    if (a) { G.t.botMsg = p.name + " makes an accusation!"; nextDelay = 1800; accuse(a.s, a.w, a.r); return; }
  }
  if (fresh) {
    const room = posRoom(p.ch);
    if (canSuggest() && BOT.wantsToStay(b, room)) { botSuggest(); return; }
    if (room !== undefined && ROOMS[room].passage !== undefined && BOT.preferPassage(b, ROOMS[room].passage)) {
      G.t.botMsg = p.name + " slips through the secret passage to the " + ROOMS[ROOMS[room].passage].name + ".";
      usePassage(); return;
    }
    roll();
    say(p.name + " rolled " + G.t.rolled + ".");
    return;
  }
  if (t.rolled && !t.moved) {
    const dest = BOT.chooseMove(b, ui.reach || reachable(p.ch, t.rolled));
    if (!dest) { t.moved = true; say(p.name + " is boxed in."); return; }
    G.t.botMsg = dest.room !== undefined ? p.name + " goes into the " + ROOMS[dest.room].name + "." : p.name + " moves along the corridor.";
    moveTo(dest); return;
  }
  if (canSuggest()) { botSuggest(); return; }
  endTurn();
}
function botSuggest() {
  const c = BOT.chooseSuggestion(G.turn);
  makeSuggestion(c.s, c.w);
}

/* =====================================================================
   SCREENS
   ===================================================================== */
function showScreen(id) { ["title", "setup", "cover", "game"].forEach(s => $(s).hidden = s !== id); }

function render() {
  if (!G) { showScreen("title"); $("continueBtn").hidden = true; return; }
  // No need to hide the screen for computer players, or when there's only one human
  if (G.phase === "pass" && (me().bot || humans() <= 1)) G.phase = "turn";
  if (G.phase === "passRefute" && humans() <= 1) G.phase = "refute";
  if (G.phase === "passBack" && humans() <= 1) G.phase = "shown";
  switch (G.phase) {
    case "pass": cover(G.turn, "It's your turn."); break;
    case "passRefute": cover(G.sugg.ref, esc(nameOf(G.sugg.by)) + " needs to see one of your cards."); break;
    case "passBack": cover(G.sugg.by, "Back to you to see what " + esc(nameOf(G.sugg.ref)) + " showed you."); break;
    case "refute": showScreen("game"); drawGame(); refuteModal(); break;
    case "shown": showScreen("game"); drawGame(); shownModal(); break;
    case "over": showScreen("game"); drawGame(); overModal(); break;
    default: showScreen("game"); drawGame();
  }
  scheduleBot();
}

function tokenHtml(s, cls) {
  const S = SUSPECTS[s];
  return '<span class="token ' + (cls || "") + '" style="background:' + S.col + ';color:' + S.ink + '">' + S.icon + "</span>";
}

function cover(p, msg) {
  closeModal();
  showScreen("cover");
  $("coverToken").outerHTML = '<div class="token big" id="coverToken" style="background:' + charOf(p).col + '">' + charOf(p).icon + "</div>";
  $("coverName").textContent = nameOf(p);
  $("coverName2").textContent = nameOf(p);
  $("coverChar").textContent = charOf(p).name;
  $("coverMsg").innerHTML = msg;
}
$("cover").addEventListener("click", () => {
  if (G.phase === "pass") G.phase = "turn";
  else if (G.phase === "passRefute") G.phase = "refute";
  else if (G.phase === "passBack") G.phase = "shown";
  save(); render();
});

/* ---------- The game screen ---------- */
function drawGame() {
  const p = me();
  $("turnInfo").innerHTML = tokenHtml(p.ch, "sm") + "<span>" + esc(p.name) + (p.bot ? " 🤖" : "") + "</span>";
  const botTurn = !!p.bot && G.phase !== "over";
  $("panel").classList.toggle("bot", botTurn);
  $("cardsBtn").disabled = $("notesBtn").disabled = viewer() < 0;
  const room = posRoom(p.ch);
  // If the app was closed after rolling but before moving, work the moves out again
  if (G.phase === "turn" && G.t.rolled && !G.t.moved && !G.t.suggested && !ui.reach) ui.reach = reachable(p.ch, G.t.rolled);
  let msg;
  if (G.phase === "over") msg = "Game over.";
  else if (ui.reach) msg = "You rolled " + G.t.rolled + ". Tap a glowing square or room to move there.";
  else if (!G.t.rolled && !G.t.moved && !G.t.suggested) msg = room !== undefined ? "You're in the " + ROOMS[room].name + ". Roll to move" + (canSuggest() ? ", or make a suggestion here." : ".") : "Roll the dice.";
  else if (canSuggest()) msg = "You're in the " + ROOMS[room].name + ". Make a suggestion?";
  else if (G.t.rolled && G.t.moved && !G.t.entered && room === undefined && G.t.rolled && !G.t.suggested && !G.t.accused && G.t.boxed) msg = "You're boxed in! End your turn.";
  else msg = "Accuse if you're sure, or end your turn.";
  if (botTurn) msg = G.t.botMsg || p.name + " is thinking...";
  $("status").textContent = msg;

  const die = $("die");
  die.hidden = !G.t.rolled;
  if (G.t.rolled) die.innerHTML = dieFace(G.t.rolled);
  $("rollBtn").hidden = !!G.t.rolled;
  $("rollBtn").disabled = G.t.moved || G.t.accused || G.t.suggested;
  const pas = room !== undefined && ROOMS[room].passage !== undefined && !G.t.moved && !G.t.rolled;
  $("passageBtn").hidden = !pas;
  if (pas) $("passageBtn").textContent = "Passage to " + ROOMS[ROOMS[room].passage].name;
  $("suggestBtn").disabled = !canSuggest();
  $("accuseBtn").disabled = G.t.accused || G.phase === "over";
  drawBoard();
}

function dieFace(n) {
  const spots = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }[n];
  let h = "";
  for (let i = 1; i <= 9; i++) h += "<i" + (spots.includes(i) ? ' class="on"' : "") + "></i>";
  return h;
}

/* ---------- Drawing the board ---------- */
const canvas = $("board"), ctx = canvas.getContext("2d");
let cell = 20;
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

function drawBoard() {
  const wrap = $("boardWrap");
  cell = Math.floor(Math.min(wrap.clientWidth / COLS, wrap.clientHeight / ROWS));
  if (cell < 4) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.style.width = COLS * cell + "px"; canvas.style.height = ROWS * cell + "px";
  canvas.width = COLS * cell * dpr; canvas.height = ROWS * cell * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#2a1b12"; ctx.fillRect(0, 0, COLS * cell, ROWS * cell);

  // Corridor squares
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (!isCorridor(r, c)) continue;
    ctx.fillStyle = (r + c) % 2 ? "#e4d4ae" : "#dccb9f";
    ctx.fillRect(c * cell, r * cell, cell, cell);
    if (ui.reach && ui.reach.cells.has(key(r, c))) {
      ctx.fillStyle = "rgba(255,214,64,.85)"; ctx.fillRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
    }
    ctx.strokeStyle = "rgba(90,60,30,.25)"; ctx.lineWidth = 1; ctx.strokeRect(c * cell + 0.5, r * cell + 0.5, cell - 1, cell - 1);
  }
  // Starting squares
  SUSPECTS.forEach(s => {
    ctx.strokeStyle = s.col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc((s.start[1] + 0.5) * cell, (s.start[0] + 0.5) * cell, cell * 0.36, 0, 7); ctx.stroke();
  });

  // Rooms
  ROOMS.forEach((R, i) => {
    const x = R.c * cell, y = R.r * cell, w = R.w * cell, h = R.h * cell;
    ctx.fillStyle = R.floor; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(0,0,0,.07)";                       // floorboard lines
    for (let yy = y + cell / 2; yy < y + h; yy += cell / 2) ctx.fillRect(x, yy, w, 1);
    ctx.strokeStyle = "#3b2416"; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    if (ui.reach && ui.reach.rooms.has(i)) {
      ctx.strokeStyle = "#ffd640"; ctx.lineWidth = 4; ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      ctx.fillStyle = "rgba(255,214,64,.22)"; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    }
    ctx.fillStyle = "#2a170c"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.font = "bold " + Math.max(8, Math.round(cell * 0.5)) + "px 'Special Elite', Georgia, serif";
    ctx.fillText(R.name.toUpperCase(), x + w / 2, y + cell * 0.25, w - 6);
    if (R.passage !== undefined) {                          // secret passage, bottom outer corner
      const px = R.c === 0 ? x + 4 : x + w - cell - 4, py = y + h - cell - 4;
      ctx.fillStyle = "#3b2416"; ctx.fillRect(px, py, cell, cell);
      ctx.strokeStyle = "#e4d4ae"; ctx.lineWidth = 1;
      for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(px + 2, py + k * cell / 4); ctx.lineTo(px + cell - 2, py + k * cell / 4); ctx.stroke(); }
    }
  });
  // Doors: a gap in the room wall where it meets the door square
  ctx.fillStyle = "#e4d4ae";
  ROOMS.forEach(R => R.doors.forEach(([r, c]) => {
    if (r < R.r) ctx.fillRect(c * cell + 3, R.r * cell, cell - 6, 4);
    else if (r >= R.r + R.h) ctx.fillRect(c * cell + 3, (R.r + R.h) * cell - 4, cell - 6, 4);
    else if (c < R.c) ctx.fillRect(R.c * cell, r * cell + 3, 4, cell - 6);
    else ctx.fillRect((R.c + R.w) * cell - 4, r * cell + 3, 4, cell - 6);
  }));

  // Weapons sit along the bottom of their room
  ctx.textBaseline = "middle";
  ROOMS.forEach((R, i) => {
    const here = G.weapons.map((rm, w) => rm === i ? w : -1).filter(w => w >= 0);
    ctx.font = Math.round(cell * 0.75) + "px " + EMOJI;
    const fromRight = R.passage !== undefined && R.c === 0;  // keep clear of the passage corner
    here.forEach((w, k) => {
      const col = k % (R.w - 1), row = Math.floor(k / (R.w - 1));
      const cx = fromRight ? R.c + R.w - 0.6 - col * 0.95 : R.c + 0.6 + col * 0.95;
      ctx.fillText(WEAPONS[w].icon, cx * cell, (R.r + R.h - 0.6 - row * 0.9) * cell);
    });
  });

  // Suspects: in a corridor square, or lined up inside their room
  const inRoom = {};
  SUSPECTS.forEach((S, s) => {
    const p = G.pos[s];
    let cx, cy;
    if (p.room === undefined) { cx = (p.c + 0.5) * cell; cy = (p.r + 0.5) * cell; }
    else {
      const R = ROOMS[p.room], n = inRoom[p.room] = (inRoom[p.room] || 0) + 1;
      const perRow = Math.max(2, R.w - 1), k = n - 1;
      cx = (R.c + 0.9 + (k % perRow) * 1.05) * cell; cy = (R.r + 1.7 + Math.floor(k / perRow) * 1.1) * cell;
    }
    const isMe = G.phase !== "over" && s === me().ch;
    if (isMe) { ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.beginPath(); ctx.arc(cx, cy, cell * 0.5, 0, 7); ctx.fill(); }
    ctx.fillStyle = S.col; ctx.strokeStyle = "#1b0f08"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, cell * 0.4, 0, 7); ctx.fill(); ctx.stroke();
    ctx.font = Math.round(cell * 0.48) + "px " + EMOJI; ctx.textAlign = "center";   // their icon on the token
    ctx.fillText(S.icon, cx, cy + 1);
  });
}

// Tapping the board
canvas.addEventListener("click", e => {
  if (G.phase !== "turn" || !ui.reach) return;
  const b = canvas.getBoundingClientRect();
  const c = Math.floor((e.clientX - b.left) / cell), r = Math.floor((e.clientY - b.top) / cell);
  if (ui.reach.cells.has(key(r, c))) { moveTo({ r, c }); return; }
  const rm = roomAt(r, c);
  if (rm >= 0 && ui.reach.rooms.has(rm)) moveTo({ room: rm });
});

/* =====================================================================
   POP-UP SHEETS
   ===================================================================== */
let modalLocked = false;
function showModal(html, buttons, locked) {
  modalLocked = !!locked;
  $("sheet").innerHTML = html + '<div class="sheetBtns">' + (buttons || []).map((b, i) => '<button class="btn ' + (b[2] || (i === 0 ? "gold" : "dim")) + '" data-b="' + i + '">' + b[0] + "</button>").join("") + "</div>";
  (buttons || []).forEach((b, i) => $("sheet").querySelector('[data-b="' + i + '"]').onclick = b[1]);
  $("modal").hidden = false;
  $("sheet").scrollTop = 0;
}
function closeModal() { $("modal").hidden = true; modalLocked = false; if (G) scheduleBot(); }
$("modal").addEventListener("click", e => { if (e.target.id === "modal" && !modalLocked) closeModal(); });

// Card picker used for suggestions and accusations
function picker(title, note, groups, okText, okClass, onOk) {
  const pick = {};
  let html = "<h3>" + title + "</h3>" + (note ? '<p class="note">' + note + "</p>" : "");
  groups.forEach(g => {
    html += "<h4>" + g.label + "</h4>";
    if (g.fixed !== undefined) html += '<div class="cards one">' + cardHtml(g.t + g.fixed, "sel") + "</div>";
    else html += '<div class="cards" data-g="' + g.t + '">' + g.list.map((_, i) => cardHtml(g.t + i)).join("") + "</div>";
    if (g.fixed !== undefined) pick[g.t] = g.fixed;
  });
  showModal(html, [[okText, () => {
    if (groups.some(g => pick[g.t] === undefined)) return;
    closeModal(); onOk(pick);
  }, okClass], ["Cancel", closeModal, "dim"]]);
  const okBtn = $("sheet").querySelector('[data-b="0"]');
  const refresh = () => okBtn.disabled = groups.some(g => pick[g.t] === undefined);
  $("sheet").querySelectorAll(".cards[data-g]").forEach(box => box.addEventListener("click", e => {
    const el = e.target.closest(".card"); if (!el) return;
    box.querySelectorAll(".card").forEach(c => c.classList.remove("sel"));
    el.classList.add("sel");
    pick[box.dataset.g] = +el.dataset.id.slice(1);
    refresh();
  }));
  refresh();
}

function openSuggest() {
  if (!canSuggest()) return;
  const r = posRoom(me().ch);
  picker("Make a suggestion", "Who did it, and with what? Whoever is named gets dragged into the " + ROOMS[r].name + ".",
    [{ label: "Suspect", t: "s", list: SUSPECTS }, { label: "Weapon", t: "w", list: WEAPONS }, { label: "Room", t: "r", fixed: r }],
    "Suggest", "gold", p => makeSuggestion(p.s, p.w));
}

function openAccuse() {
  if (G.t.accused) return;
  picker("Make an accusation", "<b>Only if you're sure.</b> Get it wrong and you're out of the game (you still show cards when asked).",
    [{ label: "Suspect", t: "s", list: SUSPECTS }, { label: "Weapon", t: "w", list: WEAPONS }, { label: "Room", t: "r", list: ROOMS }],
    "Accuse!", "red", p => accuse(p.s, p.w, p.r));
}

function suggText(sg) {
  return SUSPECTS[sg.s].name + " with the " + WEAPONS[sg.w].name + " in the " + ROOMS[sg.r].name;
}

function refuteModal() {
  const sg = G.sugg, mine = G.players[sg.ref].hand.filter(id => sg.want.includes(id));
  showModal("<h3>Show a card</h3><p class='note'>" + esc(nameOf(sg.by)) + " suggested <b>" + esc(suggText(sg)) + "</b>.</p>" +
    "<p class='note'>You have " + (mine.length > 1 ? "these. Tap the one to show:" : "this one, so you must show it:") + "</p>" +
    '<div class="cards" id="refCards">' + mine.map(id => cardHtml(id)).join("") + "</div>", [], true);
  $("refCards").addEventListener("click", e => { const el = e.target.closest(".card"); if (el) { closeModal(); showCard(el.dataset.id); } });
}

function shownModal() {
  const sg = G.sugg;
  const body = sg.shown
    ? "<h3>" + esc(nameOf(sg.ref)) + " showed you</h3><div class='cards one'>" + cardHtml(sg.shown, "sel") + "</div><p class='note'>So that one's not the answer. It's been crossed off in your notebook.</p>"
    : "<h3>Nobody could show a card!</h3><p class='note'>No one else has " + esc(suggText(sg)) + ". Unless you're holding any of them yourself, that could be the answer...</p>";
  showModal(body, [["Got it", () => { closeModal(); G.sugg = null; G.phase = "turn"; save(); render(); }]], true);
}

function wrongHtml() {
  const a = G.accuse;
  return "<h3>Wrong!</h3><p class='note'>It wasn't " + esc(SUSPECTS[a.s].name + " with the " + WEAPONS[a.w].name + " in the " + ROOMS[a.r].name) + ".</p>" +
    "<p class='note'>Here's the real answer. Keep it to yourself:</p><div class='cards'>" + cardHtml("s" + G.sol.s) + cardHtml("w" + G.sol.w) + cardHtml("r" + G.sol.r) + "</div>" +
    "<p class='note'>You're out, but you still show cards when someone suggests.</p>";
}

function overModal() {
  const head = G.winner === null ? "<h3>Nobody solved it!</h3><p class='note'>Everyone guessed wrong. The killer walks free...</p>"
    : "<h3>" + esc(nameOf(G.winner)) + " solved it!</h3>";
  showModal(head + "<p class='note'>It was:</p><div class='cards'>" + cardHtml("s" + G.sol.s) + cardHtml("w" + G.sol.w) + cardHtml("r" + G.sol.r) + "</div>",
    [["New game", () => { closeModal(); store.del(SAVE); G = null; openSetup(); }], ["Title screen", () => { closeModal(); store.del(SAVE); G = null; render(); }]], true);
}

function cardsModal() {
  if (viewer() < 0) return;
  const p = G.players[viewer()];
  showModal("<h3>Your cards</h3><p class='note'>None of these can be the answer.</p><div class='cards'>" + p.hand.map(id => cardHtml(id)).join("") + "</div>", [["Close", closeModal]]);
}

// Notebook: tap a row to cycle blank -> ✗ (not it) -> ? (maybe) -> ✓ (it!)
const MARKS = { "": "", x: "✗", q: "?", y: "✓" }, NEXT = { "": "x", x: "q", q: "y", y: "" };
function notesModal() {
  if (viewer() < 0) return;
  const p = G.players[viewer()];
  const row = id => {
    const c = card(id), mark = p.notes[id] || "";
    const tag = p.hand.includes(id) ? "your card" : p.seen[id] !== undefined ? "shown by " + esc(nameOf(p.seen[id])) : "";
    return '<div class="nrow m' + mark + '" data-id="' + id + '"><span class="ic">' + c.icon + "</span><span class='nm'>" + esc(c.name) + (tag ? "<small>" + tag + "</small>" : "") + '</span><span class="mk">' + MARKS[mark] + "</span></div>";
  };
  const group = (label, t, list) => "<h4>" + label + "</h4>" + list.map((_, i) => row(t + i)).join("");
  showModal("<h3>" + esc(p.name) + "'s notebook</h3><p class='note'>Tap to mark: ✗ not it, ? maybe, ✓ it!</p>" +
    '<div id="nb">' + group("Suspects", "s", SUSPECTS) + group("Weapons", "w", WEAPONS) + group("Rooms", "r", ROOMS) + "</div>", [["Close", closeModal]]);
  $("nb").addEventListener("click", e => {
    const el = e.target.closest(".nrow"); if (!el) return;
    const id = el.dataset.id, m = NEXT[p.notes[id] || ""];
    p.notes[id] = m; save();
    el.className = "nrow m" + m; el.querySelector(".mk").textContent = MARKS[m];
  });
}

function logModal() {
  showModal("<h3>What's happened</h3><div class='log'>" + G.log.slice().reverse().map(l => "<p>" + esc(l) + "</p>").join("") + "</div>", [["Close", closeModal]]);
}

const RULES = "<h3>How to play</h3>" +
  "<p class='note'>Someone has been murdered at Muddlecombe Manor. One suspect, one weapon and one room are hidden in the envelope. Be the first to work out all three.</p>" +
  "<h4>Your turn</h4><p class='note'>Roll and move up to that many squares, or into a room. Corner rooms have secret passages: take one instead of rolling.</p>" +
  "<h4>Suggest</h4><p class='note'>When you go into a room, suggest who did it and with what, in that room. Going round the table, the first player holding one of those cards shows you one, in secret. If you're named in someone's suggestion you get dragged into their room, and on your next turn you can suggest there without moving.</p>" +
  "<h4>Accuse</h4><p class='note'>When you're sure, accuse (any time on your turn). Right and you win. Wrong and you're out, but you still show cards.</p>" +
  "<h4>Computer players</h4><p class='note'>Any seat can be a computer. Easy ones only learn from what they're shown. Sharp ones watch everything and only accuse when they're certain.</p>" +
  "<h4>Passing the phone</h4><p class='note'>Your cards and notebook only show on your turn. When the screen says pass the phone, do it, and only tap once the right person is holding it.</p>";

/* =====================================================================
   SETUP
   ===================================================================== */
function openSetup() {
  closeModal();
  showScreen("setup");
  const saved = store.get("manor.names", []);
  const types = store.get("manor.types", []);
  ui.seats = ui.seats.length ? ui.seats : [0, 1, 2, 3, 4, 5].map(i => ({ name: saved[i] || "Player " + (i + 1), ch: i, type: types[i] || "human" }));
  renderSetup();
}
function renderSetup() {
  $("counts").innerHTML = [2, 3, 4, 5, 6].map(n => '<button class="' + (n === ui.count ? "on" : "") + '" data-n="' + n + '">' + n + "</button>").join("");
  const TYPE = { human: "👤 Human", easy: "🤖 Easy", sharp: "🤖 Sharp" };
  $("seats").innerHTML = ui.seats.slice(0, ui.count).map((s, i) =>
    '<div class="seat ' + (s.type !== "human" ? "isbot" : "") + '"><button class="tokBtn" data-i="' + i + '">' + tokenHtml(s.ch) + '</button><div class="who">' +
    (s.type === "human" ? '<input data-i="' + i + '" value="' + esc(s.name) + '" maxlength="14" autocomplete="off">' : '<span class="botname">' + SUSPECTS[s.ch].short + "</span>") +
    "<small>" + SUSPECTS[s.ch].name + '</small></div><button class="typeBtn ' + s.type + '" data-t="' + i + '">' + TYPE[s.type] + "</button></div>").join("");
  const anyHuman = ui.seats.slice(0, ui.count).some(s => s.type === "human");
  $("startBtn").disabled = !anyHuman;
  $("startBtn").textContent = anyHuman ? "Deal the cards" : "Need at least one human";
}
$("counts").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { ui.count = +b.dataset.n; renderSetup(); } });
$("seats").addEventListener("input", e => { if (e.target.dataset.i !== undefined) ui.seats[+e.target.dataset.i].name = e.target.value; });
$("seats").addEventListener("click", e => {
  const tb = e.target.closest(".typeBtn");
  if (tb) {
    const s = ui.seats[+tb.dataset.t];
    s.type = { human: "easy", easy: "sharp", sharp: "human" }[s.type];
    renderSetup(); return;
  }
  const b = e.target.closest(".tokBtn"); if (!b) return;
  const i = +b.dataset.i, used = ui.seats.slice(0, ui.count).map(s => s.ch);
  let ch = ui.seats[i].ch;
  do { ch = (ch + 1) % 6; } while (used.includes(ch) && ch !== ui.seats[i].ch);
  ui.seats[i].ch = ch; renderSetup();
});
$("startBtn").onclick = () => {
  const seats = ui.seats.slice(0, ui.count).map((s, i) => s.type === "human"
    ? { name: (s.name || "").trim() || "Player " + (i + 1), ch: s.ch }
    : { name: SUSPECTS[s.ch].short, ch: s.ch, bot: s.type });
  store.set("manor.names", ui.seats.map(s => s.name));
  store.set("manor.types", ui.seats.map(s => s.type));
  newGame(seats);
};
$("setupBack").onclick = () => { G = store.get(SAVE, null); showTitle(); };

/* =====================================================================
   BUTTONS
   ===================================================================== */
function showTitle() {
  closeModal(); showScreen("title");
  $("continueBtn").hidden = !store.get(SAVE, null);
}
$("continueBtn").onclick = () => { G = store.get(SAVE, null); if (G) render(); };
$("newBtn").onclick = () => {
  if (store.get(SAVE, null)) {
    showModal("<h3>Start a new game?</h3><p class='note'>The game in progress will be lost.</p>",
      [["New game", () => { store.del(SAVE); G = null; openSetup(); }, "red"], ["Cancel", closeModal]]);
  } else openSetup();
};
$("rulesBtn").onclick = () => showModal(RULES, [["Close", closeModal]]);
$("rollBtn").onclick = roll;
$("passageBtn").onclick = usePassage;
$("suggestBtn").onclick = openSuggest;
$("accuseBtn").onclick = openAccuse;
$("cardsBtn").onclick = cardsModal;
$("notesBtn").onclick = notesModal;
$("logBtn").onclick = logModal;
$("endBtn").onclick = () => {
  if (!G.t.rolled && !G.t.moved && !G.t.accused && !G.t.suggested) {
    showModal("<h3>End your turn?</h3><p class='note'>You haven't moved yet.</p>", [["End turn", () => { closeModal(); endTurn(); }], ["Keep going", closeModal]]);
  } else endTurn();
};
$("menuBtn").onclick = () => showModal("<h3>Menu</h3><p class='note'>The game is saved automatically.</p>",
  [["How to play", () => showModal(RULES, [["Close", closeModal]])], ["Quit to title", () => { G = null; showTitle(); }, "dim"], ["Close", closeModal, "dim"]]);

window.addEventListener("resize", () => { if (G && !$("game").hidden) drawBoard(); });

// Stop the page zooming while tapping
["gesturestart", "gesturechange", "gestureend"].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));

/* ---------- Start up ---------- */
if (G) { G = null; }      // always open on the title screen; "Continue game" brings it back
showTitle();

/* ---------- Offline + automatic updates (same as the other games) ---------- */
if ("serviceWorker" in navigator) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (had && !$("title").hidden) location.reload(); });
  window.addEventListener("load", () => navigator.serviceWorker.register("../sw.js").then(reg => {
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }).catch(() => {}));
}
