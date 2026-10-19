/* Bridge Builders game: building, driving, drawing.
   Needs physics.js (BridgeSim) and levels.js (BRIDGE_LEVELS) loaded first. */
const Sim=BridgeSim, CARS=Sim.CARS, $=id=>document.getElementById(id);

/* ---------- Saved progress (per device) ---------- */
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},
             set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let crossed=store.get("br_crossed",{});        // level number -> list of car numbers that got across
let muted=store.get("pg_muted",false);         // shared with Puzzle Garden
const levelDone=n=>(crossed[n]||[]).some(c=>c>=BRIDGE_LEVELS[n-1].goal);

/* ---------- Sounds ---------- */
let ac;
function audio(){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)()}catch(e){}return ac}
function tone(f,len=.12,when=0,type="triangle",vol=.12,slide){
  if(muted||!audio())return;
  const t=ac.currentTime+when,o=ac.createOscillator(),g=ac.createGain();
  o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+len);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+len);
  o.connect(g).connect(ac.destination);o.start(t);o.stop(t+len+.02);
}
function noise(len=.25,vol=.25,freq=1800){
  if(muted||!audio())return;
  const n=Math.floor(ac.sampleRate*len),buf=ac.createBuffer(1,n,ac.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,3);
  const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();
  s.buffer=buf;f.type="bandpass";f.frequency.value=freq;g.gain.value=vol;
  s.connect(f).connect(g).connect(ac.destination);s.start();
}
const sndPlace=()=>tone(330,.09,0,"sine",.14,520);
const sndPop=()=>tone(600,.1,0,"sine",.12,200);
const sndSnap=()=>{noise(.18,.5,2400);tone(160,.15,0,"square",.05)};
const sndSplash=()=>{noise(.6,.35,700);tone(300,.4,0,"sine",.12,80)};
const sndCreak=()=>tone(110+Math.random()*40,.25,0,"sawtooth",.025,90);
const sndCheer=()=>[523,659,784,1047].forEach((n,i)=>tone(n,.3,i*.12,"sine",.13));
const sndHorn=()=>{tone(440,.18,0,"square",.05);tone(554,.25,.2,"square",.05)};

/* ---------- Icons ---------- */
const ICON={
  back:'<svg viewBox="0 0 24 24" width="28" height="28"><path d="M15 5l-7 7 7 7" stroke="var(--grass-deep)" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  undo:'<svg viewBox="0 0 24 24" width="28" height="28"><path d="M9 7H15a5 5 0 0 1 0 10H8" stroke="var(--water-edge)" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M11 3L7 7l4 4" stroke="var(--water-edge)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  clear:'<svg viewBox="0 0 24 24" width="28" height="28"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" stroke="var(--tap)" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play:'<svg viewBox="0 0 24 24"><path d="M8 5l12 7-12 7z" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>',
  stop:'<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="#fff"/></svg>',
  wrench:'<svg viewBox="0 0 24 24"><path d="M14.5 4a5 5 0 0 0-4.6 6.9L4 16.8 7.2 20l5.9-5.9A5 5 0 0 0 20 9.5l-3 3-2.8-.7-.7-2.8 3-3A5 5 0 0 0 14.5 4z" fill="#fff"/></svg>',
  road:'<svg viewBox="0 0 48 40"><line x1="6" y1="22" x2="42" y2="22" stroke="#7a5230" stroke-width="10" stroke-linecap="round"/><line x1="6" y1="19" x2="42" y2="19" stroke="#a77a4c" stroke-width="3" stroke-linecap="round"/><circle cx="6" cy="22" r="4" fill="#fff" stroke="#2c3a22" stroke-width="2"/><circle cx="42" cy="22" r="4" fill="#fff" stroke="#2c3a22" stroke-width="2"/></svg>',
  stick:'<svg viewBox="0 0 48 40"><line x1="8" y1="34" x2="40" y2="8" stroke="#a8763d" stroke-width="7" stroke-linecap="round"/><line x1="8" y1="34" x2="40" y2="8" stroke="#e0b072" stroke-width="4" stroke-linecap="round"/><circle cx="8" cy="34" r="4" fill="#fff" stroke="#2c3a22" stroke-width="2"/><circle cx="40" cy="8" r="4" fill="#fff" stroke="#2c3a22" stroke-width="2"/></svg>',
  flag:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#fff"/><path d="M8 19V5" stroke="#6b4f35" stroke-width="2" stroke-linecap="round"/><path d="M9 5h9l-2.5 3.5L18 12H9z" fill="#e5533d"/></svg>',
  tick:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#5fae4f"/><path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  on:'<svg viewBox="0 0 24 24" width="28" height="28"><path d="M4 9h4l5-4v14l-5-4H4z" fill="var(--ink)"/><path d="M16 8a5 5 0 0 1 0 8M18.5 5.5a8.5 8.5 0 0 1 0 13" stroke="var(--ink)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  off:'<svg viewBox="0 0 24 24" width="28" height="28"><path d="M4 9h4l5-4v14l-5-4H4z" fill="var(--ink)" opacity=".5"/><path d="M16 9l6 6M22 9l-6 6" stroke="var(--tap)" stroke-width="2.4" stroke-linecap="round"/></svg>'
};
$("homeLink").innerHTML=ICON.back;$("backBtn").innerHTML=ICON.back;$("winBack").innerHTML=ICON.back;
$("undoBtn").innerHTML=ICON.undo;$("clearBtn").innerHTML=ICON.clear;
$("toolRoad").innerHTML=ICON.road;$("toolStick").innerHTML=ICON.stick;$("playBtn").innerHTML=ICON.play;
const paintMute=()=>$("mute").innerHTML=muted?ICON.off:ICON.on;paintMute();
$("mute").onclick=()=>{muted=!muted;store.set("pg_muted",muted);paintMute();tone(660)};

/* Number blocks in stacks of five (same as Puzzle Garden) */
function tower(n){let h="";for(let s=0;s<n;s+=5){h+='<div class="stack">';for(let i=s;i<Math.min(s+5,n);i++)h+=`<div class="cube${i===n-1?" face":""}"></div>`;h+="</div>"}return h}

/* ---------- Drawing a car (used on the road, in the picker and on the win screen) ----------
   ctx is already set up so 1 unit = 1 metre and y points up, with the axle centre at 0,0. */
function drawCarBody(ctx,c,spin){
  const L=c.len,H=c.h,r=c.r,base=r*0.55;
  const body=c.color,dark="rgba(0,0,0,.22)",glass="#cdeefc";
  ctx.lineJoin="round";
  const rr=(x,y,w,h,rad)=>{ctx.beginPath();ctx.moveTo(x+rad,y);ctx.lineTo(x+w-rad,y);ctx.quadraticCurveTo(x+w,y,x+w,y+rad);ctx.lineTo(x+w,y+h-rad);ctx.quadraticCurveTo(x+w,y+h,x+w-rad,y+h);ctx.lineTo(x+rad,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-rad);ctx.lineTo(x,y+rad);ctx.quadraticCurveTo(x,y,x+rad,y);ctx.closePath()};
  ctx.lineWidth=0.04;ctx.strokeStyle="rgba(0,0,0,.35)";
  if(c.blocks===1){                    // buggy: low tub with a roll bar
    ctx.fillStyle=body;rr(-L/2,base,L,H*0.45,0.12);ctx.fill();ctx.stroke();
    ctx.strokeStyle="#2c3a22";ctx.lineWidth=0.06;ctx.beginPath();ctx.moveTo(-L*0.15,base+H*0.45);ctx.lineTo(-L*0.05,base+H);ctx.lineTo(L*0.18,base+H);ctx.lineTo(L*0.25,base+H*0.45);ctx.stroke();
    ctx.fillStyle="#f5d2a8";ctx.beginPath();ctx.arc(L*0.05,base+H*0.62,0.11,0,7);ctx.fill();
  }else if(c.blocks===2){              // car: body + rounded cabin
    ctx.fillStyle=body;rr(-L/2,base,L,H*0.5,0.12);ctx.fill();ctx.stroke();
    rr(-L*0.28,base+H*0.45,L*0.52,H*0.5,0.16);ctx.fill();ctx.stroke();
    ctx.fillStyle=glass;rr(-L*0.22,base+H*0.55,L*0.18,H*0.3,0.06);ctx.fill();rr(L*0.0,base+H*0.55,L*0.18,H*0.3,0.06);ctx.fill();
  }else if(c.blocks===3){              // van: tall box
    ctx.fillStyle=body;rr(-L/2,base,L,H,0.14);ctx.fill();ctx.stroke();
    ctx.fillStyle=glass;rr(L*0.22,base+H*0.5,L*0.24,H*0.38,0.07);ctx.fill();
    ctx.fillStyle=dark;ctx.fillRect(-L*0.42,base+H*0.25,L*0.55,0.04);
  }else if(c.blocks===4){              // bus: long with a row of windows
    ctx.fillStyle=body;rr(-L/2,base,L,H,0.14);ctx.fill();ctx.stroke();
    ctx.fillStyle=glass;for(let i=0;i<5;i++)rr(-L*0.44+i*L*0.18,base+H*0.5,L*0.13,H*0.34,0.05),ctx.fill();
    ctx.fillStyle="#fff6c9";ctx.fillRect(-L/2,base+H*0.3,L,0.06);
  }else{                               // fire truck: cab + ladder
    ctx.fillStyle=body;rr(-L/2,base,L,H*0.6,0.12);ctx.fill();ctx.stroke();
    rr(L*0.12,base+H*0.5,L*0.36,H*0.5,0.14);ctx.fill();ctx.stroke();
    ctx.fillStyle=glass;rr(L*0.24,base+H*0.62,L*0.18,H*0.28,0.06);ctx.fill();
    ctx.strokeStyle="#d9dde0";ctx.lineWidth=0.05;ctx.beginPath();ctx.moveTo(-L*0.48,base+H*0.75);ctx.lineTo(L*0.08,base+H*0.75);ctx.moveTo(-L*0.48,base+H*0.9);ctx.lineTo(L*0.08,base+H*0.9);
    for(let x=-L*0.44;x<L*0.08;x+=0.16){ctx.moveTo(x,base+H*0.75);ctx.lineTo(x,base+H*0.9)}ctx.stroke();
    ctx.fillStyle="#3fa4ea";ctx.fillRect(L*0.24,base+H,0.12,0.07);
  }
  // number blocks on the side: one per block of weight
  const s=0.12,y0=base+0.06;
  for(let i=0;i<c.blocks;i++){ctx.fillStyle="#ffc93d";ctx.fillRect(-L*0.42+i*(s+0.03),y0,s,s);ctx.strokeStyle="#c98f10";ctx.lineWidth=0.02;ctx.strokeRect(-L*0.42+i*(s+0.03),y0,s,s)}
  // wheels
  [-c.wb/2,c.wb/2].forEach(x=>{
    ctx.fillStyle="#2c3a22";ctx.beginPath();ctx.arc(x,0,r,0,7);ctx.fill();
    ctx.fillStyle="#c3ccd2";ctx.beginPath();ctx.arc(x,0,r*0.45,0,7);ctx.fill();
    ctx.strokeStyle="#55616a";ctx.lineWidth=0.035;ctx.beginPath();
    for(let k=0;k<3;k++){const a=spin+k*2.094;ctx.moveTo(x,0);ctx.lineTo(x+Math.cos(a)*r*0.45,Math.sin(a)*r*0.45)}ctx.stroke();
  });
}
function carIcon(canvas,ci,scale){
  const ctx=canvas.getContext("2d"),dpr=window.devicePixelRatio||1,w=canvas.clientWidth||canvas.width,h=canvas.clientHeight||canvas.height;
  canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const c=CARS[ci],sc=scale||Math.min(w/(c.len+0.3),(h-4)/(c.h*1.15+c.r*1.6));
  ctx.save();ctx.translate(w/2,h-c.r*sc-2);ctx.scale(sc,-sc);drawCarBody(ctx,c,0);ctx.restore();
}

/* ---------- Screens ---------- */
let N=1, lv=null;
function showLevels(){
  stopLoop();$("game").hidden=true;$("win").hidden=true;$("levels").hidden=false;
  const next=BRIDGE_LEVELS.findIndex((_,i)=>!levelDone(i+1));
  $("plots").innerHTML=BRIDGE_LEVELS.map((l,i)=>`<button class="plot${i===next?" next":""}" data-n="${i+1}" aria-label="Level ${i+1}">
    <canvas class="goalcar" data-c="${l.goal-1}"></canvas>
    ${levelDone(i+1)?`<span class="badge">${ICON.flag}</span>`:""}<div class="tower">${tower(i+1)}</div></button>`).join("");
  $("plots").querySelectorAll("canvas").forEach(cv=>carIcon(cv,+cv.dataset.c));
  $("plots").querySelectorAll(".plot").forEach(b=>b.onclick=()=>{tone(520);startLevel(+b.dataset.n)});
}

/* ---------- The player's design ----------
   joints: [[x,y],...]   the level's anchors come first and can't be removed
   beams:  [[a,b,"road"|"stick"],...] */
let design, history=[], tool="road", car=0, mode="build", sim=null, playT=0;

function emptyDesign(){
  const joints=lv.anchors.map(a=>a.slice()),beams=[];
  (lv.pre||[]).forEach(([x1,y1,x2,y2,t])=>{beams.push([jointAt(joints,x1,y1,true),jointAt(joints,x2,y2,true),t==="r"?"road":"stick"])});
  return{joints,beams};
}
function jointAt(joints,x,y,create){
  let i=joints.findIndex(j=>j[0]===x&&j[1]===y);
  if(i<0&&create){joints.push([x,y]);i=joints.length-1}
  return i;
}
const clone=d=>JSON.parse(JSON.stringify(d));
const piecesLeft=()=>lv.pieces-design.beams.length;
function save(){store.set("br_design_"+N,design)}
function remember(){history.push(clone(design));if(history.length>60)history.shift()}

function startLevel(n){
  N=n;lv=BRIDGE_LEVELS[n-1];
  design=store.get("br_design_"+n,null)||emptyDesign();
  if(design.joints.length<lv.anchors.length)design=emptyDesign();
  history=[];mode="build";sim=null;
  const done=crossed[n]||[];
  car=done.length?Math.min(4,Math.max(...done)):lv.goal-1;
  if(!done.length)car=lv.goal-1;
  $("levels").hidden=true;$("win").hidden=true;$("game").hidden=false;
  $("lvlTower").innerHTML=tower(n);
  buildCars();setTool(tool);refreshPanel();resize();startLoop();
}

function buildCars(){
  const done=crossed[N]||[];
  $("cars").innerHTML=CARS.map((c,i)=>`<button class="car${i===car?" sel":""}" data-c="${i}" aria-label="${c.name}, weighs ${c.blocks}">
    <canvas></canvas><div class="blocks">${'<i></i>'.repeat(c.blocks)}</div>
    ${i===lv.goal-1?`<span class="goal">${ICON.flag}</span>`:""}${done.includes(i+1)?`<span class="tick">${ICON.tick}</span>`:""}</button>`).join("");
  $("cars").querySelectorAll(".car").forEach(b=>{
    carIcon(b.querySelector("canvas"),+b.dataset.c);
    b.onclick=()=>{if(mode!=="build")return;car=+b.dataset.c;tone(400+car*60,.1);sndHorn();
      $("cars").querySelectorAll(".car").forEach(x=>x.classList.toggle("sel",x===b))};
  });
}
function setTool(t){tool=t;$("toolRoad").classList.toggle("sel",t==="road");$("toolStick").classList.toggle("sel",t==="stick")}
$("toolRoad").onclick=()=>{setTool("road");tone(500,.08)};
$("toolStick").onclick=()=>{setTool("stick");tone(560,.08)};
function refreshPanel(){
  $("leftTower").innerHTML=tower(Math.max(0,piecesLeft()));
  $("undoBtn").classList.toggle("disabled",!history.length||mode!=="build");
  $("clearBtn").classList.toggle("disabled",mode!=="build");
  $("playBtn").innerHTML=mode==="build"?ICON.play:mode==="result"?ICON.wrench:ICON.stop;
  $("playBtn").classList.toggle("stop",mode!=="build");
  $("playBtn").setAttribute("aria-label",mode==="build"?"Drive!":"Back to building");
  [$("toolRoad"),$("toolStick")].forEach(b=>b.classList.toggle("disabled",mode!=="build"));
}
$("undoBtn").onclick=()=>{if(!history.length||mode!=="build")return;design=history.pop();save();sndPop();refreshPanel()};
$("clearBtn").onclick=()=>{if(mode!=="build")return;remember();design=emptyDesign();save();sndPop();refreshPanel()};
$("backBtn").onclick=$("winBack").onclick=()=>{tone(440);showLevels()};
$("nextBtn").onclick=()=>{tone(620);N<BRIDGE_LEVELS.length?startLevel(N+1):showLevels()};

/* ---------- Screen <-> world ---------- */
const cv=$("view"),ctx=cv.getContext("2d");
let W=0,H=0,sc=1,ox=0,oy=0,vy1=0,dpr=1;
function resize(){
  if(!lv)return;
  const r=$("stage").getBoundingClientRect();dpr=window.devicePixelRatio||1;
  W=r.width;H=r.height;cv.width=W*dpr;cv.height=H*dpr;
  const x0=lv.view[0],x1=lv.view[1],y0=lv.water-0.9,y1=Math.max(lv.build[1]+0.9,2.4);
  sc=Math.min(W/(x1-x0),H/(y1-y0));
  ox=(W-(x1-x0)*sc)/2-x0*sc; vy1=y1; oy=H-(y1-y0)*sc;          // sit the river at the bottom; spare room is sky
}
window.addEventListener("resize",()=>{resize();if(lv)buildCars()});
const SX=x=>ox+x*sc, SY=y=>oy+(vy1-y)*sc;
const WX=px=>(px-ox)/sc, WY=py=>vy1-(py-oy)/sc;

/* Can a new joint go at this grid point? Not inside the ground, rocks or water, and inside the build area. */
function freeSpot(x,y){
  const [g0,g1]=lv.gap;
  if(y<lv.build[0]||y>lv.build[1])return false;
  if(x<lv.view[0]+0.5||x>lv.view[1]-0.5)return false;
  if(y<lv.water+0.4)return false;
  if((x<=g0||x>=g1)&&y<0)return false;
  if((lv.rocks||[]).some(r=>Math.abs(x-r.x)<=r.w/2+0.01&&y<=r.top))return false;
  return true;
}
/* The best grid point to finish a piece: within reach of the start, nearest the finger. */
function bestEnd(si,wx,wy){
  const [sx,sy]=design.joints[si];let best=null,bd=1e9;
  const R=Math.ceil(Sim.MAXLEN);
  for(let x=sx-R;x<=sx+R;x++)for(let y=sy-R;y<=sy+R;y++){
    if(x===sx&&y===sy)continue;
    if(Math.hypot(x-sx,y-sy)>Sim.MAXLEN+1e-6)continue;
    const existing=jointAt(design.joints,x,y,false);
    if(existing<0&&!freeSpot(x,y))continue;
    const d=Math.hypot(x-wx,y-wy);if(d<bd){bd=d;best=[x,y]}
  }
  return best;
}
function nearestJoint(px,py){
  let best=-1,bd=Math.max(24,0.5*sc);
  design.joints.forEach(([x,y],i)=>{
    if(i>=lv.anchors.length&&!design.beams.some(b=>b[0]===i||b[1]===i))return;
    const d=Math.hypot(SX(x)-px,SY(y)-py);if(d<bd){bd=d;best=i}
  });
  return best;
}
function nearestBeam(px,py){
  let best=-1,bd=16;
  design.beams.forEach(([a,b],i)=>{
    const A=design.joints[a],B=design.joints[b],ax=SX(A[0]),ay=SY(A[1]),bx=SX(B[0]),by=SY(B[1]);
    const ex=bx-ax,ey=by-ay,t=Math.max(0,Math.min(1,((px-ax)*ex+(py-ay)*ey)/(ex*ex+ey*ey||1)));
    const d=Math.hypot(px-(ax+ex*t),py-(ay+ey*t));if(d<bd){bd=d;best=i}
  });
  return best;
}

/* ---------- Building by touch ---------- */
let drag=null;
cv.addEventListener("pointerdown",e=>{
  if(mode!=="build")return;
  e.preventDefault();
  const r=cv.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
  const j=nearestJoint(px,py);
  if(j>=0){drag={from:j,end:null,px,py,moved:false};tone(620,.05);return}
  const b=nearestBeam(px,py);
  if(b>=0){drag={beam:b,px,py,moved:false}}
});
cv.addEventListener("pointermove",e=>{
  if(!drag||drag.beam!==undefined)return;
  const r=cv.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
  if(Math.hypot(px-drag.px,py-drag.py)>6)drag.moved=true;
  drag.end=drag.moved?bestEnd(drag.from,WX(px),WY(py)):null;
  drag.fx=px;drag.fy=py;
});
function finishDrag(){
  if(!drag)return;const d=drag;drag=null;
  if(d.beam!==undefined){                    // tap a piece to take it away
    remember();design.beams.splice(d.beam,1);tidy();save();sndPop();refreshPanel();return;
  }
  if(!d.end)return;
  if(piecesLeft()<=0){const el=document.querySelector(".left");el.classList.remove("empty");void el.offsetWidth;el.classList.add("empty");tone(200,.15);return}
  const [x,y]=d.end;
  const bi=jointAt(design.joints,x,y,false);
  if(bi>=0&&design.beams.some(b=>(b[0]===d.from&&b[1]===bi)||(b[1]===d.from&&b[0]===bi)))return;   // already joined
  remember();
  const to=jointAt(design.joints,x,y,true);
  design.beams.push([d.from,to,tool]);save();sndPlace();
  try{navigator.vibrate&&navigator.vibrate(10)}catch(e){}
  refreshPanel();
}
cv.addEventListener("pointerup",finishDrag);
cv.addEventListener("pointercancel",()=>drag=null);
/* Remove joints nothing is attached to any more (anchors always stay) */
function tidy(){
  const used=new Set();design.beams.forEach(b=>{used.add(b[0]);used.add(b[1])});
  const map=[],joints=[];
  design.joints.forEach((j,i)=>{if(i<lv.anchors.length||used.has(i)){map[i]=joints.length;joints.push(j)}});
  design.beams=design.beams.map(([a,b,t])=>[map[a],map[b],t]);design.joints=joints;
}

/* ---------- Driving ---------- */
let debris=[], drops=[], lastBroken=0, resultTimer=null, creakAt=0, finishAt=0;
$("playBtn").onclick=()=>{
  if(mode==="build"){
    if(!design.beams.length){$("playBtn").classList.add("wiggle");setTimeout(()=>$("playBtn").classList.remove("wiggle"),1200);return}
    audio();sim=Sim.create(lv,design,car);mode="drive";playT=0;debris=[];drops=[];lastBroken=0;finishAt=0;
    sndHorn();refreshPanel();
  }else backToBuild();
};
function backToBuild(){clearTimeout(resultTimer);mode="build";sim=null;debris=[];drops=[];$("playBtn").classList.remove("wiggle");refreshPanel()}

function stepSim(dt){
  if(!sim)return;
  acc+=dt;
  while(acc>=1/60){acc-=1/60;Sim.step(sim,1/60)}
  // new breaks: throw the pieces
  while(lastBroken<sim.broken.length){
    const b=sim.broken[lastBroken++].beam,A=sim.nodes[b.a],B=sim.nodes[b.b];
    const mx=(A.x+B.x)/2,my=(A.y+B.y)/2;
    [[A.x,A.y,mx,my],[mx,my,B.x,B.y]].forEach(([x1,y1,x2,y2],k)=>debris.push({x1,y1,x2,y2,cx:(x1+x2)/2,cy:(y1+y2)/2,vx:(k?1:-1)*(0.6+Math.random()),vy:1+Math.random(),va:(Math.random()-.5)*6,a:0,type:b.type}));
    sndSnap();try{navigator.vibrate&&navigator.vibrate(30)}catch(e){}
  }
  // creak when something is close to its limit
  const worst=Math.max(0,...sim.beams.filter(b=>!b.broken).map(b=>Math.abs(b.fs)/b.S));
  if(worst>0.8&&playT>creakAt){sndCreak();creakAt=playT+0.35}
  if(sim.state==="splash"&&mode==="drive"){
    mode="result";sndSplash();
    const cx=(sim.wheels[0].x+sim.wheels[1].x)/2;
    for(let i=0;i<26;i++)drops.push({x:cx,y:lv.water,vx:(Math.random()-.5)*4,vy:2+Math.random()*4,t:0});
    resultTimer=setTimeout(()=>{$("playBtn").classList.add("wiggle")},1200);refreshPanel();
  }
  if(sim.state==="stuck"&&mode==="drive"){mode="result";refreshPanel();$("playBtn").classList.add("wiggle")}
  if(sim.state==="crossed"&&mode==="drive"){mode="result";finishAt=playT;refreshPanel();won()}
}
let acc=0;
function won(){
  const list=crossed[N]||[];if(!list.includes(car+1))list.push(car+1);crossed[N]=list;store.set("br_crossed",crossed);
  sndCheer();buildCars();
  if(car+1>=lv.goal){
    resultTimer=setTimeout(()=>{
      $("win").hidden=false;carIcon($("winCar"),car);
      for(let i=0;i<28;i++){const p=document.createElement("span");p.className="fall";
        p.style.left=Math.random()*100+"vw";p.style.animationDuration=(2.2+Math.random()*1.8)+"s";p.style.animationDelay=Math.random()*.6+"s";
        document.body.appendChild(p);setTimeout(()=>p.remove(),4800)}
    },1400);
  }else{
    // a lighter car made it: show which car is the real goal
    resultTimer=setTimeout(()=>{backToBuild();const g=$("cars").querySelector(`.car[data-c="${lv.goal-1}"]`);if(g){g.classList.remove("pulse");void g.offsetWidth;g.classList.add("pulse")}},2200);
  }
}

/* ---------- Drawing ---------- */
function stressColour(r,base){
  if(r<0.35)return base;
  const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
  const yellow=[255,210,63],orange=[255,154,61],red=[229,51,43];
  let c;if(r<0.6)c=mix(hex(base),yellow,(r-0.35)/0.25);else if(r<0.85)c=mix(yellow,orange,(r-0.6)/0.25);else c=mix(orange,red,Math.min(1,(r-0.85)/0.15));
  return `rgb(${c})`;
}
function hex(h){h=h.replace("#","");return[0,2,4].map(i=>parseInt(h.substr(i,2),16))}

function drawBeam(x1,y1,x2,y2,type,colour,alpha=1){
  ctx.globalAlpha=alpha;ctx.lineCap="round";
  if(type==="road"){
    ctx.strokeStyle="#4a3019";ctx.lineWidth=0.3*sc;line(x1,y1,x2,y2);
    ctx.strokeStyle=colour||"#7a5230";ctx.lineWidth=0.22*sc;line(x1,y1,x2,y2);
    ctx.strokeStyle="rgba(255,255,255,.25)";ctx.lineWidth=0.05*sc;line(x1,y1+0.06,x2,y2+0.06);
  }else{
    ctx.strokeStyle="#a8763d";ctx.lineWidth=0.17*sc;line(x1,y1,x2,y2);
    ctx.strokeStyle=colour||"#e0b072";ctx.lineWidth=0.11*sc;line(x1,y1,x2,y2);
  }
  ctx.globalAlpha=1;
}
function line(x1,y1,x2,y2){ctx.beginPath();ctx.moveTo(SX(x1),SY(y1));ctx.lineTo(SX(x2),SY(y2));ctx.stroke()}

function drawWorld(t){
  ctx.setTransform(dpr,0,0,dpr,0,0);
  // sky and far hills
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#bfe4f2");g.addColorStop(1,"#e4f4df");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#cfe9c4";ctx.beginPath();ctx.moveTo(0,SY(1.2));
  for(let x=0;x<=W;x+=20)ctx.lineTo(x,SY(1.2+Math.sin(x/90)*0.5+Math.sin(x/37)*0.2));ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fill();
  // grid dots where joints can go
  if(mode==="build"){
    ctx.fillStyle="rgba(44,58,34,.18)";
    for(let x=Math.ceil(lv.view[0]);x<=lv.view[1];x++)for(let y=lv.build[0];y<=lv.build[1];y++)if(freeSpot(x,y)){ctx.beginPath();ctx.arc(SX(x),SY(y),Math.max(2,0.05*sc),0,7);ctx.fill()}
  }
  // banks
  const [g0,g1]=lv.gap,bottom=lv.water-5;
  const bank=(xa,xb)=>{
    ctx.fillStyle="#b9824c";ctx.fillRect(SX(xa),SY(0),SX(xb)-SX(xa),SY(bottom)-SY(0));
    ctx.fillStyle="#a8723f";for(let y=-0.6;y>bottom;y-=0.8)ctx.fillRect(SX(xa),SY(y),SX(xb)-SX(xa),0.06*sc);
    ctx.fillStyle="#7fc46b";ctx.fillRect(SX(xa),SY(0)-0.04*sc,SX(xb)-SX(xa),0.22*sc);
    ctx.fillStyle="#4f9a45";ctx.fillRect(SX(xa),SY(0)+0.14*sc,SX(xb)-SX(xa),0.05*sc);
  };
  bank(WX(-10),g0);bank(g1,WX(W+10));
  // rocks
  (lv.rocks||[]).forEach(r=>{
    ctx.fillStyle="#8d969b";ctx.fillRect(SX(r.x-r.w/2),SY(r.top),r.w*sc,SY(bottom)-SY(r.top));
    ctx.fillStyle="#a2abb0";ctx.fillRect(SX(r.x-r.w/2),SY(r.top),r.w*sc*0.35,SY(bottom)-SY(r.top));
  });
  // finish flag
  const fx=lv.gap[1]+1.6;ctx.strokeStyle="#6b4f35";ctx.lineWidth=0.07*sc;line(fx,0,fx,1.3);
  ctx.fillStyle="#e5533d";ctx.beginPath();ctx.moveTo(SX(fx),SY(1.3));ctx.lineTo(SX(fx+0.7),SY(1.12));ctx.lineTo(SX(fx),SY(0.92));ctx.fill();

  const s=sim;
  // the bridge: from the design while building, from the simulation while driving
  if(s){
    s.beams.forEach(b=>{if(b.broken)return;const A=s.nodes[b.a],B=s.nodes[b.b];
      drawBeam(A.x,A.y,B.x,B.y,b.type,stressColour(Math.abs(b.fs)/b.S,b.type==="road"?"#7a5230":"#e0b072"))});
    debris.forEach(d=>{const c=Math.cos(d.a),sn=Math.sin(d.a),hx=(d.x2-d.x1)/2,hy=(d.y2-d.y1)/2;
      drawBeam(d.cx-(hx*c-hy*sn),d.cy-(hx*sn+hy*c),d.cx+(hx*c-hy*sn),d.cy+(hx*sn+hy*c),d.type,"#e5332b")});
    s.nodes.forEach((n,i)=>drawJoint(n.x,n.y,n.anchor));
  }else{
    design.beams.forEach(([a,b,type])=>{const A=design.joints[a],B=design.joints[b];drawBeam(A[0],A[1],B[0],B[1],type)});
    design.joints.forEach(([x,y],i)=>{if(i<lv.anchors.length||design.beams.some(b=>b[0]===i||b[1]===i))drawJoint(x,y,i<lv.anchors.length)});
    if(drag&&drag.end){const A=design.joints[drag.from];drawBeam(A[0],A[1],drag.end[0],drag.end[1],tool,null,0.6);drawJoint(drag.end[0],drag.end[1],false,0.7)}
    // level 1: show a finger drawing the first road
    if(N===1&&!design.beams.length&&!drag){
      const p=(t%2.2)/1.6,k=Math.min(1,p),A=lv.anchors[0],B=lv.anchors[1];
      ctx.setLineDash([0.15*sc,0.15*sc]);drawBeam(A[0],A[1],A[0]+(B[0]-A[0])*k,A[1],"road",null,0.45);ctx.setLineDash([]);
      ctx.fillStyle="rgba(255,255,255,.9)";ctx.strokeStyle="#2c3a22";ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(SX(A[0]+(B[0]-A[0])*k),SY(A[1])+0.45*sc,0.22*sc,0,7);ctx.fill();ctx.stroke();
    }
  }
  // the car
  const c=CARS[car];
  if(s){
    const w0=s.wheels[0],w1=s.wheels[1],cx=(w0.x+w1.x)/2,cy=(w0.y+w1.y)/2,ang=Math.atan2(w1.y-w0.y,w1.x-w0.x);
    s.spin=(s.spin||0)-((w0.vx+w1.vx)/2)/60/c.r;
    ctx.save();ctx.translate(SX(cx),SY(cy));ctx.rotate(-ang);ctx.scale(sc,-sc);drawCarBody(ctx,c,s.spin);ctx.restore();
  }else{
    const cx=lv.gap[0]-Math.max(2.2,c.len*0.6+1.2);
    ctx.save();ctx.translate(SX(cx),SY(c.r));ctx.scale(sc,-sc);drawCarBody(ctx,c,0);ctx.restore();
  }
  // water in front, with gentle waves
  ctx.fillStyle="rgba(63,164,234,.82)";ctx.beginPath();ctx.moveTo(SX(g0-0.01),SY(lv.water));
  for(let x=g0;x<=g1+0.01;x+=0.25)ctx.lineTo(SX(x),SY(lv.water+Math.sin(x*2.2+t*2)*0.05));
  ctx.lineTo(SX(g1),H);ctx.lineTo(SX(g0),H);ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.35)";for(let x=g0+0.4;x<g1;x+=1.3)ctx.fillRect(SX(x+Math.sin(t+x)*0.2),SY(lv.water-0.35),0.4*sc,0.04*sc);
  // splash drops
  drops.forEach(d=>{ctx.fillStyle="rgba(63,164,234,.9)";ctx.beginPath();ctx.arc(SX(d.x),SY(d.y),0.08*sc,0,7);ctx.fill()});
}
function drawJoint(x,y,anchor,alpha=1){
  ctx.globalAlpha=alpha;
  if(anchor){ctx.fillStyle="#e5533d";ctx.strokeStyle="#a8321f";ctx.lineWidth=0.04*sc;ctx.beginPath();ctx.arc(SX(x),SY(y),0.17*sc,0,7);ctx.fill();ctx.stroke();
    ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(SX(x),SY(y),0.07*sc,0,7);ctx.fill()}
  else{ctx.fillStyle="#fff";ctx.strokeStyle="#2c3a22";ctx.lineWidth=Math.max(1.5,0.035*sc);ctx.beginPath();ctx.arc(SX(x),SY(y),0.1*sc,0,7);ctx.fill();ctx.stroke()}
  ctx.globalAlpha=1;
}

/* ---------- Main loop ---------- */
let raf=0,last=0,clock=0;
function frame(now){
  const dt=Math.min(0.05,(now-(last||now))/1000);last=now;clock+=dt;
  if(mode==="drive"||mode==="result"){playT+=dt;if(sim&&(sim.state==="driving"||(sim.state==="crossed"&&playT-finishAt<1.5)||sim.state==="splash"))stepSim(dt)}
  debris.forEach(d=>{d.vy-=9.8*dt;d.cx+=d.vx*dt;d.cy+=d.vy*dt;d.a+=d.va*dt});
  debris=debris.filter(d=>d.cy>lv.water-3);
  drops.forEach(d=>{d.vy-=9.8*dt;d.x+=d.vx*dt;d.y+=d.vy*dt});drops=drops.filter(d=>d.y>lv.water-0.5);
  drawWorld(clock);
  raf=requestAnimationFrame(frame);
}
function startLoop(){cancelAnimationFrame(raf);last=0;raf=requestAnimationFrame(frame)}
function stopLoop(){cancelAnimationFrame(raf)}

/* ---------- Stop iPhone zooming (same as Puzzle Garden) ---------- */
["gesturestart","gesturechange","gestureend"].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
let lastTouchEnd=0;
document.addEventListener("touchend",e=>{const now=Date.now();if(now-lastTouchEnd<400)e.preventDefault();lastTouchEnd=now},{passive:false});
document.addEventListener("touchmove",e=>{if(drag||e.touches.length>1)e.preventDefault()},{passive:false});

/* ---------- Offline + automatic updates ---------- */
if("serviceWorker" in navigator){
  const had=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(had&&mode!=="drive"&&$("game").hidden)location.reload()});
  window.addEventListener("load",()=>navigator.serviceWorker.register("../sw.js").then(reg=>{
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")reg.update().catch(()=>{})});
  }).catch(()=>{}));
}

showLevels();
