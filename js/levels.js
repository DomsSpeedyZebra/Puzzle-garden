/* Puzzle Garden worlds and levels. See README.md for how to add one.
   Cells: . grass, R rock, F flower, T<n> tap, hex digit = pipe in its SOLVED position,
   !<hex> = stuck metal pipe (cannot turn). Pipe bits: N=1 E=2 S=4 W=8.
   mix = how many pipes start turned the wrong way (0 = all of them). */
const WORLDS=[
  {id:"garden",name:"The Garden",levels:[
    // Learn: turn the pipe, then press the tap
    /* 1 */ {g:["T2 a F"],mix:1},
    /* 2 */ {g:["T2 a a F"],mix:2},
    /* 3 */ {g:["T2 c .",". 5 .",". 3 F"],mix:2},
    // Ramp up
    /* 4 */ {g:["T2 a c .",". . 5 .","F a 9 ."],mix:3},
    /* 5 */ {g:["T2 a e a F",". . 5 . .",". . F . ."],mix:4},
    /* 6 */ {g:["T4 R . 6","3 a c .","a R 3 c",". 3 . F"],mix:0},
    /* 7 */ {g:["T2 a a c 5","R 6 a d c","9 5 R 5 .",". F a 3 F"],mix:0},
    /* 8 */ {g:[". 6 T4 . R","F a f a F","R . 5 3 6","c a 5 . 9","5 . F a ."],mix:0},
    /* 9 */ {g:["c . T4 R .",". . 3 e c",". R . 5 5",". . 9 F F",". . . 9 ."],mix:0},
    // Twist: grey metal pipes are stuck and cannot turn
    /* 10 */ {g:["T2 !a c .",". . 5 .","F a !9 ."],mix:0},
    /* 11 */ {g:[". . . R","T2 !c . b",". !3 a F",". . . ."],mix:0},
    /* 12 */ {g:[". 3 R T4 !c","6 6 !a d .","F 9 3 !5 c",". . . F ."],mix:0},
    /* 13 */ {g:["R 9 !d F .","a . . !5 R","9 !6 a b c","T2 9 . . !5",". 7 . e F"],mix:0},
    /* 14 */ {g:["3 . . . .",". . F e .","R R !5 !9 .","T2 a !b a !c","!c d . . F"],mix:0},
    /* 15 */ {g:["F c . !6 F","R !3 e b F",". R 5 7 !3","c . 5 !6 .","T2 !a 9 . .","6 . . . 9"],mix:0},
    /* 16 */ {g:["d T4 6 7 R d","9 3 !c . . .","b . 3 !e F F","7 . !5 7 !a 9",". !9 . !5 . .","9 c 6 F 9 R"],mix:0},
    /* 17 */ {g:[". . T4 !c 3 .","R . 7 !c 9 .","6 a 9 5 a !6","F e . !5 !a .","c 7 . 7 !a !c","9 . R 3 F F"],mix:0},
    /* 18 */ {g:["T4 . . b . e","5 . 5 c e R","!7 !a a F . .","!5 R . 5 c .","!7 F 6 . !b R","!3 F . !b !c 6","e d . 3 9 9"],mix:0},
    /* 19 */ {g:["F a a !a !e F",". . 6 R 5 R",". d b F !7 F",". . 3 7 !9 a","e . 5 5 !a .","6 c !9 !5 b .","T2 a a 9 !a 9"],mix:0},
    /* 20 */ {g:["9 c c !6 . T4","!3 . R 6 !6 !9",". 6 F a d .","c 3 3 . !5 3","6 3 9 F !d .","R . 3 3 7 !c","e . !7 F !9 F"],mix:0}
  ]},
  {id:"shed",name:"Potting Shed",soon:true},
  {id:"hill",name:"Hedgehog Hill",soon:true},
  {id:"pond",name:"Duck Pond",soon:true},
  {id:"meadow",name:"Number Meadow",soon:true}
];
