/* =====================================================================
   MURDER AT MUDDLECOMBE MANOR — computer players
   Each bot keeps its own private "detective notebook" in p.k:
     has[q][card] =  1  player q definitely holds this card
                  = -1  player q definitely doesn't
                  (missing) not known yet
     The envelope (the answer) is treated as one extra "player", number n.
     cons  = things like "Hannah holds at least one of these three cards"
     shown = which cards this bot has already shown to each player
   Easy bots only learn from their own hand and the cards shown to them.
   Sharp bots also learn from everything that happens at the table and
   chain clues together (see propagate).
   ===================================================================== */
const BOT = (() => {
  const n = () => G.players.length;          // envelope's "player number"
  const kOf = b => G.players[b].k;
  const sharp = b => G.players[b].bot === "sharp";
  const cat = id => id[0];

  function set(k, q, id, v) {
    const cur = k.has[q][id];
    if (cur === v) return false;
    if (cur !== undefined) return false;     // never overwrite a known fact (a clash would be a bug elsewhere)
    k.has[q][id] = v; return true;
  }

  // Start of game: the bot knows its own hand exactly
  function init(b) {
    const k = { has: [], cons: [], shown: {} };
    for (let q = 0; q <= n(); q++) k.has.push({});
    G.players[b].k = k;
    ALL_CARDS.forEach(id => set(k, b, id, G.players[b].hand.includes(id) ? 1 : -1));
    propagate(b);
  }

  // Something happened at a suggestion. ev = {by, want, noHelp, ref, shown}
  function observe(b, ev) {
    const k = kOf(b);
    if (ev.ref >= 0 && b === ev.by) set(k, ev.ref, ev.shown, 1);     // I was shown this card
    if (b === ev.by && !sharp(b)) ev.noHelp.forEach(q => ev.want.forEach(id => set(k, q, id, -1)));   // even Easy notes who couldn't help it
    if (sharp(b)) {
      ev.noHelp.forEach(q => ev.want.forEach(id => set(k, q, id, -1)));  // they couldn't help: none of the three
      if (ev.ref >= 0 && b !== ev.by && b !== ev.ref) k.cons.push({ q: ev.ref, cards: ev.want.slice() });
    }
    propagate(b);
  }

  // Chain the clues together until nothing new can be worked out
  function propagate(b) {
    const k = kOf(b), N = n(), E = N;
    for (let loop = 0; loop < 60; loop++) {
      let changed = false;
      ALL_CARDS.forEach(id => {
        // Every card has exactly one owner (a player or the envelope)
        let owner = -1;
        for (let q = 0; q <= N; q++) if (k.has[q][id] === 1) owner = q;
        if (owner >= 0) { for (let q = 0; q <= N; q++) if (q !== owner) changed = set(k, q, id, -1) || changed; return; }
        const maybe = [];
        for (let q = 0; q <= N; q++) if (k.has[q][id] !== -1) maybe.push(q);
        if (maybe.length === 1) changed = set(k, maybe[0], id, 1) || changed;
      });
      // The envelope holds exactly one card of each kind
      ["s", "w", "r"].forEach(t => {
        const ids = ALL_CARDS.filter(id => cat(id) === t);
        const yes = ids.filter(id => k.has[E][id] === 1);
        if (yes.length) ids.forEach(id => { if (id !== yes[0]) changed = set(k, E, id, -1) || changed; });
        const maybe = ids.filter(id => k.has[E][id] !== -1);
        if (maybe.length === 1) changed = set(k, E, maybe[0], 1) || changed;
      });
      if (sharp(b)) {
        // "Holds at least one of these": if two are ruled out, it's the third
        k.cons = k.cons.filter(c => {
          if (c.cards.some(id => k.has[c.q][id] === 1)) return false;
          const left = c.cards.filter(id => k.has[c.q][id] !== -1);
          if (left.length === 1) { changed = set(k, c.q, left[0], 1) || changed; return false; }
          return true;
        });
        // Hand sizes are public: if we know all of someone's cards, they hold nothing else (and vice versa)
        for (let q = 0; q < N; q++) {
          const size = G.players[q].hand.length;
          const yes = ALL_CARDS.filter(id => k.has[q][id] === 1).length;
          const unknown = ALL_CARDS.filter(id => k.has[q][id] === undefined);
          if (!unknown.length) continue;
          if (yes === size) unknown.forEach(id => changed = set(k, q, id, -1) || changed);
          else if (yes + unknown.length === size) unknown.forEach(id => changed = set(k, q, id, 1) || changed);
        }
      }
      if (!changed) break;
    }
  }

  // What could still be in the envelope, as far as this bot knows
  function options(b) {
    const k = kOf(b), E = n();
    const o = { s: [], w: [], r: [] };
    ALL_CARDS.forEach(id => { if (k.has[E][id] !== -1) o[cat(id)].push(+id.slice(1)); });
    return o;
  }

  // Ready to accuse? Sharp bots only when certain; Easy bots sometimes chance it
  function decideAccuse(b) {
    const o = options(b);
    if (o.s.length === 1 && o.w.length === 1 && o.r.length === 1) return { s: o.s[0], w: o.w[0], r: o.r[0] };
    if (!sharp(b) && o.s.length * o.w.length * o.r.length <= 2 && Math.random() < 0.35)
      return { s: pick(o.s), w: pick(o.w), r: pick(o.r) };
    return null;
  }

  const pick = a => a[Math.floor(Math.random() * a.length)];

  // Which suspect and weapon to name in a suggestion
  function chooseSuggestion(b) {
    const o = options(b);
    return { s: pick(o.s), w: pick(o.w) };
  }

  // Which card to show when this bot must refute (prefer one that player has already seen)
  function chooseRefute(b, by, cards) {
    const k = kOf(b);
    const seen = (k.shown[by] || []).filter(id => cards.includes(id));
    const id = seen.length ? seen[0] : pick(cards);
    k.shown[by] = [...new Set([...(k.shown[by] || []), id])];
    return id;
  }

  // ---- Moving ----
  // Steps from every corridor square into each room (ignoring other tokens)
  const ROOM_DIST = ROOMS.map((R, ri) => {
    const d = new Map(), q = [];
    R.doors.forEach(([r, c]) => { d.set(key(r, c), 1); q.push([r, c]); });
    while (q.length) {
      const [r, c] = q.shift(), cur = d.get(key(r, c));
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b2]) => {
        const rr = r + a, cc = c + b2, kk = key(rr, cc);
        if (isCorridor(rr, cc) && !d.has(kk)) { d.set(kk, cur + 1); q.push([rr, cc]); }
      });
    }
    return d;
  });
  function distTo(pos, ri) {
    if (pos.room === ri) return 0;
    if (pos.room !== undefined) {
      if (ROOMS[pos.room].passage === ri) return 1;
      return Math.min(...ROOMS[pos.room].doors.map(([r, c]) => 1 + (ROOM_DIST[ri].get(key(r, c)) || 99)));
    }
    return ROOM_DIST[ri].get(key(pos.r, pos.c)) || 99;
  }
  const stillLearning = b => { const o = options(b); return o.s.length > 1 || o.w.length > 1; };

  // Where it's heading: the nearest room that could still be the answer
  function targetRoom(b) {
    const o = options(b), pos = G.pos[G.players[b].ch];
    let rooms = o.r.filter(r => r !== pos.room && r !== G.t.startRoom);
    if (!rooms.length) rooms = ROOMS.map((_, i) => i).filter(r => r !== pos.room && r !== G.t.startRoom);
    rooms.sort((a, c) => distTo(pos, a) - distTo(pos, c) || Math.random() - 0.5);
    return rooms[0];
  }

  function chooseMove(b, reach) {
    const o = options(b);
    const rooms = [...reach.rooms];
    const good = rooms.filter(r => o.r.includes(r));
    if (good.length) return { room: pick(good) };
    // A room whose card it holds itself is still worth a visit: nobody can show that card,
    // so whatever gets shown is about the suspect or weapon
    const own = rooms.filter(r => G.players[b].hand.includes("r" + r));
    if (own.length && stillLearning(b)) return { room: pick(own) };
    const t = targetRoom(b);
    let best = null, bd = 1e9;
    reach.cells.forEach(kk => {
      const d = (ROOM_DIST[t].get(kk) || 99) + Math.random() * 0.1;
      if (d < bd) { bd = d; best = kk; }
    });
    if (best === null) return rooms.length ? { room: rooms[0] } : null;
    return { r: Math.floor(best / 100), c: best % 100 };
  }

  function preferPassage(b, to) { return options(b).r.includes(to); }
  function wantsToStay(b, room) { return options(b).r.includes(room) || (stillLearning(b) && Math.random() < 0.5); }

  return { init, observe, decideAccuse, chooseSuggestion, chooseRefute, chooseMove, preferPassage, wantsToStay, options };
})();
