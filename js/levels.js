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
  {g:[". 6 T4 . R","F a f a F","R . 5 3 6","c a 5 . 9","5 . F a ."],mix:0}
];
