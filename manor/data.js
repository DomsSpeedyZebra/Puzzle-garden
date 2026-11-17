/* =====================================================================
   MURDER AT MUDDLECOMBE MANOR — the cast, the weapons and the house
   Change names, colours or icons here; the rest of the game follows.
   ===================================================================== */

// The six suspects. col = token colour, ink = text colour on it.
// start = the corridor square they begin on [row, column].
const SUSPECTS = [
  { name: "Colonel Custard", short: "Custard", col: "#e3b622", ink: "#3a2c00", icon: "🍮", start: [0, 5] },
  { name: "Miss Starlet",    short: "Starlet", col: "#d23c3c", ink: "#ffffff", icon: "🌟", start: [0, 12] },
  { name: "Reverend Spleen", short: "Spleen",  col: "#2f8f46", ink: "#ffffff", icon: "⛪", start: [19, 6] },
  { name: "Mrs Peacoat",     short: "Peacoat", col: "#2f62c0", ink: "#ffffff", icon: "🧥", start: [19, 11] },
  { name: "Professor Glum",  short: "Glum",    col: "#7a46b0", ink: "#ffffff", icon: "🎓", start: [6, 0] },
  { name: "Mrs Fright",      short: "Fright",  col: "#ececec", ink: "#222222", icon: "👻", start: [13, 17] }
];

const WEAPONS = [
  { name: "Scandalstick",         icon: "🕯️" },
  { name: "Dodgy Dagger",         icon: "🗡️" },
  { name: "Poisoned Vol-au-vent", icon: "🥧" },
  { name: "Skipping Rope",        icon: "🪢" },
  { name: "Spanner in the Works", icon: "🔧" },
  { name: "Rubber Chicken",       icon: "🐔" }
];

/* The board is 18 columns x 20 rows. Every square that isn't inside a room
   is corridor. Each room is a rectangle: top row r, left column c, height h,
   width w. doors = the corridor squares you step from to get in.
   passage = the room a secret passage leads to (by its position in this list). */
const ROWS = 20, COLS = 18;
const ROOMS = [
  { name: "Kitchen",      icon: "🍳",  r: 0,  c: 0,  h: 5, w: 5, floor: "#cdb98f", passage: 8, doors: [[2, 5], [5, 2]] },
  { name: "Ballroom",     icon: "💃",  r: 0,  c: 7,  h: 5, w: 4, floor: "#c09474", doors: [[5, 8], [5, 9], [2, 6], [2, 11]] },
  { name: "Greenhouse",   icon: "🌿",  r: 0,  c: 13, h: 5, w: 5, floor: "#97b682", passage: 6, doors: [[3, 12], [5, 15]] },
  { name: "Dining Room",  icon: "🍽️", r: 7,  c: 0,  h: 6, w: 5, floor: "#b88272", doors: [[6, 2], [9, 5], [13, 3]] },
  { name: "Snooker Room", icon: "🎱",  r: 7,  c: 7,  h: 6, w: 4, floor: "#4d8a62", doors: [[6, 8], [10, 6], [9, 11], [13, 9]] },
  { name: "Library",      icon: "📚",  r: 7,  c: 13, h: 6, w: 5, floor: "#a3845d", doors: [[8, 12], [13, 15], [6, 16]] },
  { name: "Drawing Room", icon: "🖼️", r: 15, c: 0,  h: 5, w: 5, floor: "#ad98bd", passage: 2, doors: [[14, 2], [17, 5]] },
  { name: "Hall",         icon: "🚪",  r: 15, c: 7,  h: 5, w: 4, floor: "#c8ad82", doors: [[14, 8], [14, 9], [17, 6], [17, 11]] },
  { name: "Study",        icon: "🖋️", r: 15, c: 13, h: 5, w: 5, floor: "#93735f", passage: 0, doors: [[14, 14], [16, 12]] }
];
