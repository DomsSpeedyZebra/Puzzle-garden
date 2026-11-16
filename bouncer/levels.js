/* =====================================================================
   BOUNCER — level layouts
   Each level is a name plus a grid: one string per row, 12 characters wide.

   .  empty
   r o y g c b p w   coloured bricks (red, orange, yellow, green, cyan,
                     blue, purple, white) — one hit each
   S  steel   — two hits
   T  titanium — three hits
   G  gold    — can't be broken (the ball just bounces off)
   X  explosive — blows up itself and every brick touching it

   A level is finished when every brick except gold is gone, so always
   leave a gap for the ball to reach bricks hidden behind gold.
   To add a level, copy one of these blocks and change the letters.
   ===================================================================== */
const LEVELS = [
  {name: "Warm Up", map: [
    "............",
    "rrrrrrrrrrrr",
    "oooooooooooo",
    "yyyyyyyyyyyy",
    "gggggggggggg",
    "cccccccccccc",
    "bbbbbbbbbbbb"]},

  {name: "Pyramid", map: [
    "............",
    ".....ww.....",
    "....wppw....",
    "...wpbbpw...",
    "..wpbccbpw..",
    ".wpbcggcbpw.",
    "wpbcgyygcbpw"]},

  {name: "Checkers", map: [
    "r.r.r.r.r.r.",
    ".o.o.o.o.o.o",
    "y.y.y.y.y.y.",
    ".g.g.g.g.g.g",
    "c.c.c.c.c.c.",
    ".b.b.b.b.b.b",
    "p.p.p.p.p.p."]},

  {name: "Steel Belt", map: [
    "bbbbbbbbbbbb",
    "cccccccccccc",
    "SSSSSSSSSSSS",
    "gggggggggggg",
    "yyyyyyyyyyyy",
    "............",
    "ooo..oo..ooo"]},

  {name: "Diamond", map: [
    ".....rr.....",
    "....roor....",
    "...royyor...",
    "..royXXyor..",
    ".roygXXgyor.",
    "..royXXyor..",
    "...royyor...",
    "....roor....",
    ".....rr....."]},

  {name: "Gold Gates", map: [
    "pppppppppppp",
    "bbbbbbbbbbbb",
    "GG..GGGG..GG",
    "cccccccccccc",
    "gggggggggggg",
    "GGG......GGG",
    "yyyyyyyyyyyy"]},

  {name: "Smiley", map: [
    "...yyyyyy...",
    "..yyyyyyyy..",
    ".yybyyyybyy.",
    ".yybyyyybyy.",
    ".yyyyyyyyyy.",
    ".yryyyyyyry.",
    "..yrrrrrry..",
    "...yyyyyy..."]},

  {name: "Powder Keg", map: [
    "wwwwwwwwwwww",
    "oXooooooooXo",
    "oooooXXooooo",
    "cccccccccccc",
    "cXccccccccXc",
    "SSSSSSSSSSSS"]},

  {name: "Fortress", map: [
    "G.GG.GG.GG.G",
    "GrrrrrrrrrrG",
    "GrSSSSSSSSrG",
    "GrSyyyyyySrG",
    "GrSyXXXXySrG",
    "GrSyyyyyySrG",
    "GrSSSSSSSSrG",
    "GrrrrrrrrrrG",
    "GGGG....GGGG"]},

  {name: "Columns", map: [
    "r..o..y..g..",
    "r..o..y..g..",
    "rS.oS.yS.gS.",
    "r..o..y..g..",
    "rS.oS.yS.gS.",
    "r..o..y..g..",
    "rr.oo.yy.gg."]},

  {name: "Arrow", map: [
    "cccccccccccc",
    "............",
    ".....pp.....",
    "....pppp....",
    "...pppppp...",
    "..pppppppp..",
    ".....bb.....",
    ".....bb.....",
    ".....bb.....",
    "....XbbX...."]},

  {name: "Heart", map: [
    "..rr....rr..",
    ".rrrr..rrrr.",
    "rrrrrrrrrrrr",
    "rrrrrXXrrrrr",
    ".rrrrrrrrrr.",
    "..rrrrrrrr..",
    "...rrrrrr...",
    "....rrrr....",
    ".....rr....."]},

  {name: "Titan", map: [
    "TTTTTTTTTTTT",
    "SSSSSSSSSSSS",
    "bbbbbbbbbbbb",
    "............",
    "gg..gg..gg..",
    "..gg..gg..gg"]},

  {name: "Waves", map: [
    "cc....cc....",
    "..cc....cc..",
    "....cc....cc",
    "bb....bb....",
    "..bb....bb..",
    "....bb....bb",
    "pp....pp....",
    "..pp....pp..",
    "....pp....pp"]},

  {name: "Chain Reaction", map: [
    "XXXXXXXXXXXX",
    "yyyyyyyyyyyy",
    "XyXyXyXyXyXy",
    "oooooooooooo",
    "GGGGG..GGGGG",
    "rrrrrrrrrrrr"]},

  {name: "The Vault", map: [
    "wwwwwwwwwwww",
    "wGGGGGGGGGGw",
    "wGccccccccGw",
    "wGcXXXXXXcGw",
    "wGccccccccGw",
    "wGGGG..GGGGw",
    "wwwwwwwwwwww"]},

  {name: "Iron Bars", map: [
    "SSSSSSSSSSSS",
    "rrrrrrrrrrrr",
    "SSSSSSSSSSSS",
    "gggggggggggg",
    "SSSSSSSSSSSS",
    "bbbbbbbbbbbb"]},

  {name: "Crossroads", map: [
    "....yyyy....",
    "....yXXy....",
    "....yyyy....",
    "rrrryyyyrrrr",
    "rXXrySSyrXXr",
    "rrrryyyyrrrr",
    "....yyyy....",
    "....yXXy....",
    "....yyyy...."]},

  {name: "Steel Checkers", map: [
    "S.S.S.S.S.S.",
    ".T.T.T.T.T.T",
    "S.S.S.S.S.S.",
    ".c.c.c.c.c.c",
    "b.b.b.b.b.b.",
    ".p.p.p.p.p.p"]},

  {name: "Grand Finale", map: [
    "GTTTTTTTTTTG",
    "GXSSSSSSSSXG",
    "GrrrrrrrrrrG",
    "GooooXXooooG",
    "GyyyyyyyyyyG",
    "GggggXXggggG",
    "GccccccccccG",
    "GbbbbbbbbbbG",
    "G...GGGG...G"]}
];
