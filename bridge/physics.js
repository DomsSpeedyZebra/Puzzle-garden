/* Bridge Builders physics.
   Every joint is a pin, like a real truss: pieces only push and pull along their length.
   So a square with no diagonal can fold, a triangle can't, and a long flat road sags.

   Solver: XPBD "small steps" (many tiny substeps, one constraint pass each).
   The constraint correction gives the real force in each piece, which we compare
   with the material's strength to decide when it snaps.

   Units: 1 grid square = 1 metre, kilograms, newtons, seconds. y points UP. */
(function(root){
  const G=9.8, SUB=40, MAXLEN=2.3;

  // Materials: K = stiffness (N per unit strain), S = breaking force (N), rho = kg per metre
  const MATERIALS={
    road :{K:6e4,S:620,rho:1.2,drive:true},
    stick:{K:6e4,S:620,rho:0.6,drive:false}
  };
  // Cars: blocks = weight shown to the player; mass = blocks * 10kg
  const CARS=[
    {name:"Buggy",     blocks:1,wb:0.7,r:0.26,len:1.1,h:0.45,color:"#ffc93d",speed:2.2},
    {name:"Car",       blocks:2,wb:0.9,r:0.28,len:1.4,h:0.55,color:"#e5533d",speed:2.0},
    {name:"Van",       blocks:3,wb:1.1,r:0.30,len:1.7,h:0.75,color:"#3fa4ea",speed:1.9},
    {name:"Bus",       blocks:4,wb:1.4,r:0.32,len:2.1,h:0.85,color:"#5fae4f",speed:1.8},
    {name:"Fire truck",blocks:5,wb:1.5,r:0.34,len:2.2,h:0.85,color:"#d8322b",speed:1.7}
  ];

  /* Terrain: the banks and any rock pillars, as solid segments the wheels roll on. */
  function terrainSegments(lv){
    const [x0,x1]=lv.gap, wy=lv.water, L=lv.view[0]-6, R=lv.view[1]+6, segs=[];
    segs.push([L,0,x0,0],[x0,0,x0,wy-2]);          // left bank top + cliff
    segs.push([x1,wy-2,x1,0],[x1,0,R,0]);           // right cliff + bank top
    (lv.rocks||[]).forEach(r=>{                      // pillar: top + sides
      segs.push([r.x-r.w/2,wy-2,r.x-r.w/2,r.top],[r.x-r.w/2,r.top,r.x+r.w/2,r.top],[r.x+r.w/2,r.top,r.x+r.w/2,wy-2]);
    });
    return segs;
  }

  /* Build a simulation from a level and the player's design.
     design = {joints:[[x,y],...], beams:[[jointIndexA, jointIndexB, "road"|"stick"],...]}
     The first joints are always the level's fixed anchors. */
  function create(lv,design,carIndex){
    const nodes=design.joints.map(([x,y],i)=>({x,y,px:x,py:y,vx:0,vy:0,m:0.4,anchor:i<lv.anchors.length}));
    const beams=design.beams.map(([a,b,type])=>{
      const A=nodes[a],B=nodes[b],L=Math.hypot(B.x-A.x,B.y-A.y),mat=MATERIALS[type];
      A.m+=mat.rho*L/2;B.m+=mat.rho*L/2;
      return{a,b,type,L,alpha:L/mat.K,S:mat.S,f:0,fs:0,peak:0,broken:false,drive:mat.drive};
    });
    nodes.forEach(n=>n.w=n.anchor?0:1/n.m);
    const c=CARS[carIndex], mass=c.blocks*10;
    const startX=lv.gap[0]-Math.max(2.2,c.len*0.6+1.2);
    const wheels=[
      {x:startX-c.wb/2,y:c.r+0.07,px:startX-c.wb/2,py:c.r+0.07,vx:0,vy:0,w:2/mass,contact:null},
      {x:startX+c.wb/2,y:c.r+0.07,px:startX+c.wb/2,py:c.r+0.07,vx:0,vy:0,w:2/mass,contact:null}
    ];
    return{lv,nodes,beams,wheels,car:c,carIndex,terrain:terrainSegments(lv),t:0,state:"driving",broken:[],
      finishX:lv.gap[1]+1.6};
  }

  /* One distance constraint, XPBD style. Returns the force (N, + = stretched/tension). */
  function solveDist(A,B,L,alphaT){
    const dx=B.x-A.x,dy=B.y-A.y,d=Math.hypot(dx,dy)||1e-9;
    const wsum=A.w+B.w+alphaT;if(wsum<=0)return 0;
    const C=d-L, dl=-C/wsum, nx=dx/d, ny=dy/d;
    A.x-=A.w*dl*nx;A.y-=A.w*dl*ny;
    B.x+=B.w*dl*nx;B.y+=B.w*dl*ny;
    return dl;
  }

  /* Keep a wheel on top of a segment (road piece or ground). Moves both the wheel and the piece's joints. */
  function collide(wh,r,ax,ay,bx,by,A,B){
    const ex=bx-ax,ey=by-ay,len2=ex*ex+ey*ey||1e-9;
    let t=((wh.x-ax)*ex+(wh.y-ay)*ey)/len2;t=Math.max(0,Math.min(1,t));
    const cx=ax+ex*t,cy=ay+ey*t;let dx=wh.x-cx,dy=wh.y-cy;const d=Math.hypot(dx,dy);
    const R=r+0.07;                                   // half the plank thickness
    if(d>=R||d<1e-9)return false;
    const nx=dx/d,ny=dy/d,wa=A?A.w:0,wb=B?B.w:0;
    const W=wh.w+(1-t)*(1-t)*wa+t*t*wb;if(W<=0)return false;
    const dl=(R-d)/W;
    wh.x+=wh.w*dl*nx;wh.y+=wh.w*dl*ny;
    if(A){A.x-=wa*dl*(1-t)*nx;A.y-=wa*dl*(1-t)*ny}
    if(B){B.x-=wb*dl*t*nx;B.y-=wb*dl*t*ny}
    wh.contact={nx,ny};
    return true;
  }

  /* Advance the simulation by dt seconds (one animation frame). */
  function step(s,dt){
    if(s.state!=="driving"&&s.state!=="crossed")return s;
    const h=dt/SUB, h2=h*h, c=s.car, carW=c.wb;
    const all=[...s.nodes.filter(n=>!n.anchor),...s.wheels];
    for(let k=0;k<SUB;k++){
      // 1. move everything with gravity
      all.forEach(p=>{p.vy-=G*h;p.px=p.x;p.py=p.y;p.x+=p.vx*h;p.y+=p.vy*h});
      s.wheels.forEach(w=>w.contact=null);
      // 2. pieces pull their joints back to the right length; measure the force
      s.beams.forEach(b=>{
        if(b.broken)return;
        const dl=solveDist(s.nodes[b.a],s.nodes[b.b],b.L,b.alpha/h2);
        b.f=-dl/h2;
      });
      // 3. the car's two wheels stay the same distance apart
      solveDist(s.wheels[0],s.wheels[1],carW,0);
      // 4. wheels sit on road pieces and ground (sticks don't hold the car)
      s.wheels.forEach(wh=>{
        s.beams.forEach(b=>{if(b.broken||!b.drive)return;const A=s.nodes[b.a],B=s.nodes[b.b];collide(wh,c.r,A.x,A.y,B.x,B.y,A,B)});
        s.terrain.forEach(t=>collide(wh,c.r,t[0],t[1],t[2],t[3],null,null));
      });
      // 5. work out velocities, add a little damping, drive the wheels forward
      all.forEach(p=>{p.vx=(p.x-p.px)/h*0.9995;p.vy=(p.y-p.py)/h*0.9995});
      s.wheels.forEach(wh=>{
        if(!wh.contact||s.state!=="driving")return;
        const tx=wh.contact.ny,ty=-wh.contact.nx;     // along the surface, pointing right
        const vt=wh.vx*tx+wh.vy*ty, dv=(c.speed-vt)*Math.min(1,12*h);
        wh.vx+=tx*dv;wh.vy+=ty*dv;
      });
      // 6. anything pushed or pulled too hard snaps
      s.beams.forEach(b=>{
        if(b.broken)return;
        b.fs+=(b.f-b.fs)*0.15;
        b.peak=Math.max(b.peak,Math.abs(b.fs)/b.S);
        if(Math.abs(b.fs)>b.S){b.broken=true;s.broken.push({beam:b,t:s.t})}
      });
    }
    s.t+=dt;
    const cx=(s.wheels[0].x+s.wheels[1].x)/2, low=Math.min(s.wheels[0].y,s.wheels[1].y);
    if(s.state==="driving"){
      if(cx>s.finishX)s.state="crossed";
      else if(low<s.lv.water+0.1)s.state="splash";
      else if(s.t>40)s.state="stuck";
    }
    return s;
  }

  /* Run a whole crossing without drawing (used by the level checker). */
  function run(lv,design,carIndex,maxT=40){
    const s=create(lv,design,carIndex);
    while(s.state==="driving"&&s.t<maxT)step(s,1/60);
    return{state:s.state,t:s.t,maxY:s.maxY,broke:s.broken.length,peak:Math.max(0,...s.beams.map(b=>b.peak))};
  }

  const api={G,SUB,MAXLEN,MATERIALS,CARS,create,step,run,terrainSegments};
  root.BridgeSim=api;
  if(typeof module!=="undefined")module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
