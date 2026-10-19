/* Bridge Builders levels.
   gap:     [left edge, right edge] of the river; banks are at height 0
   water:   height of the water
   view:    [left, right] of the world shown on screen
   anchors: fixed bolts you can build from (always include the two road ends)
   rocks:   pillars in the river {x, w (width), top (height of the top)}
   build:   [lowest, highest] height you can put new joints at
   pieces:  how many pieces you can use in total (including any already built)
   goal:    which car must get across (1 = buggy ... 5 = fire truck)
   pre:     pieces already built [x1,y1,x2,y2,"r" road / "s" stick] */
const BRIDGE_LEVELS=[
  // 1. Lay a road across
  {gap:[0,2],water:-2.5,view:[-3,5],anchors:[[0,0],[2,0]],build:[-1,2],pieces:1,goal:1},
  // 2. A long road sags: prop it up from the rock
  {gap:[0,4],water:-2.5,view:[-3,7],anchors:[[0,0],[4,0],[2,-2]],rocks:[{x:2,w:1,top:-2}],build:[-2,2],pieces:3,goal:3},
  // 3. Triangles from below
  {gap:[0,4],water:-2.5,view:[-3,7],anchors:[[0,0],[4,0],[0,-1],[4,-1]],build:[-2,2],pieces:4,goal:3},
  // 4. Squares wobble: add diagonals
  {gap:[0,4],water:-2.5,view:[-3,7],anchors:[[0,0],[4,0],[0,-1],[4,-1]],build:[-2,2],pieces:15,goal:3,
   pre:[[0,0,1,0,"r"],[1,0,2,0,"r"],[2,0,3,0,"r"],[3,0,4,0,"r"],
        [0,-1,1,-1,"s"],[1,-1,2,-1,"s"],[2,-1,3,-1,"s"],[3,-1,4,-1,"s"],
        [1,-1,1,0,"s"],[2,-1,2,0,"s"],[3,-1,3,0,"s"]]},
  // 5. Triangles above the road
  {gap:[0,4],water:-2,view:[-3,7],anchors:[[0,0],[4,0]],build:[0,3],pieces:5,goal:3},
  // 6. Low bolts: build down to them
  {gap:[0,6],water:-3,view:[-3,9],anchors:[[0,0],[6,0],[0,-2],[6,-2]],build:[-2,2],pieces:10,goal:4},
  // 7. Two spans with a rock in the middle
  {gap:[0,8],water:-2.5,view:[-3,11],anchors:[[0,0],[8,0],[0,-1],[8,-1],[4,-1]],rocks:[{x:4,w:1.2,top:-1}],build:[-2,2],pieces:10,goal:3},
  // 8. A tall triangle frame above for the bus
  {gap:[0,6],water:-2,view:[-3,9],anchors:[[0,0],[6,0]],build:[0,3],pieces:12,goal:4},
  // 9. Wide river, few pieces
  {gap:[0,8],water:-3,view:[-3,11],anchors:[[0,0],[8,0],[0,-1],[8,-1]],build:[-2,3],pieces:16,goal:4},
  // 10. The fire truck
  {gap:[0,10],water:-3,view:[-3,13],anchors:[[0,0],[10,0],[0,-1],[10,-1],[5,-2]],rocks:[{x:5,w:1.2,top:-2}],build:[-2,3],pieces:22,goal:5}
];
if(typeof module!=="undefined")module.exports=BRIDGE_LEVELS;
