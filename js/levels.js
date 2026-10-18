/* Puzzle Garden levels. See README.md for how to add one. */
/* ---------- Level data ----------
   Each cell: "." grass, "R" rock, "F" flower, "T<n>" tap (n = direction water comes out),
   or a hex digit = pipe openings in the SOLVED position. Bits: N=1 E=2 S=4 W=8.
   mix = how many pipes start turned the wrong way (0 = all of them). */
const LEVELS=[
  {g:["T2 a F"],mix:1},
  {g:["T2 a a F"],mix:2},
  {g:["T2 c .",". 5 .",". 3 F"],mix:2},
  {g:["T2 a c .",". . 5 .","F a 9 ."],mix:3},
  {g:["T2 a e a F",". . 5 . .",". . F . ."],mix:4},
  {g:["T4 R . 6","3 a c .","a R 3 c",". 3 . F"],mix:0},
  {g:["T2 a a c 5","R 6 a d c","9 5 R 5 .",". F a 3 F"],mix:0},
  {g:[". 6 T4 . R","F a f a F","R . 5 3 6","c a 5 . 9","5 . F a ."],mix:0},
  // Level 9
  {g:["c . T4 R .",". . 3 e c",". R . 5 5",". . 9 F F",". . . 9 ."],mix:0},
  // Level 10
  {g:[". T4 9 c .","a 7 a a F",". 5 . . 3","F 9 . 9 R",". 6 . R ."],mix:0},
  // Level 11
  {g:["T4 R . . .","5 b . 9 .","5 R c . a","5 . a . 3","7 a a a c","F . 7 . F"],mix:0},
  // Level 12
  {g:["3 R T4 9 3","R . 5 . 5","F a d . .",". 7 5 . .",". 3 7 a c",". F 9 . F"],mix:0},
  // Level 13
  {g:["e c . . c T4",". F e a a d","9 R 5 a 3 5",". . 5 . R 5","a b 3 F 3 5","9 . . . . F"],mix:0},
  // Level 14
  {g:["R F 7 . R .",". 3 c . 6 d","3 . 7 a e F",". R 5 c F 5","T2 a 9 . . 3",". . . 9 6 9"],mix:0},
  // Level 15
  {g:["c d 9 T4 d .","b c 6 9 9 3","F e d . 7 a","R F 5 d 5 3","3 . F a a 3",". R . 9 . c"],mix:0},
  // Level 16
  {g:[". . . T4 . R",". 6 a b c .","F 9 e . 5 .","R 9 6 R 7 F","b 5 5 6 5 .","6 c a 6 F 9",". 9 . d 7 ."],mix:0},
  // Level 17
  {g:["9 5 F F R .",". 6 b b F a",". 5 5 . 3 .","T2 d 9 . . .",". 5 . . c e","R 3 a a F 7",". R b . 6 ."],mix:0},
  // Level 18
  {g:["d 3 . c . a","a a . . . F","c 7 R . F 5","e c 6 a 7 9","T2 a a e b F",". c d 5 6 .","d 3 . F R R"],mix:0},
  // Level 19
  {g:["3 c F F R 6","5 a 3 d b 9","3 6 a b F .","b 5 9 9 6 c","T2 d c . e c","d 3 a a F R",". 6 . d 7 5"],mix:0},
  // Level 20
  {g:["a . R e . F","c F e F R 5","c 3 a b e 9",". 6 3 . 5 3",". c 6 F 5 9","3 6 5 7 9 3","T2 a a 9 6 9"],mix:0}
];
