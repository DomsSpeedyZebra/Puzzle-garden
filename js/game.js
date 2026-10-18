/* Puzzle Garden game logic. Needs levels.js loaded first. */
const BITS=[1,2,4,8], DX={1:0,2:1,4:0,8:-1}, DY={1:-1,2:0,4:1,8:0};
const rot1=m=>((m<<1)|(m>>3))&15;           // turn openings 90° clockwise
const rotN=(m,n)=>{for(let i=0;i<n;i++)m=rot1(m);return m};
const opp=d=>d<4?d<<2:d>>2;                  // N<->S, E<->W
const $=id=>document.getElementById(id);

/* ---------- Saved progress (per device) ---------- */
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},
             set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let done=new Set(store.get("pg_done",[]));
let muted=store.get("pg_muted",false);

/* ---------- Gentle sounds ---------- */
let ac;
function tone(f,len=.12,when=0,type="triangle",vol=.12){
  if(muted)return;
  try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();
    const t=ac.currentTime+when,o=ac.createOscillator(),g=ac.createGain();
    o.type=type;o.frequency.value=f;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+len);
    o.connect(g).connect(ac.destination);o.start(t);o.stop(t+len+.02);}catch(e){}
}

/* ---------- Icons ---------- */
const ICON={
  home:'<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="var(--grass-deep)"/></svg>',
  reset:'<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2" stroke="var(--water-edge)" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M3 3v5h5" stroke="var(--water-edge)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  on:'<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="var(--ink)"/><path d="M16 8a5 5 0 0 1 0 8M18.5 5.5a8.5 8.5 0 0 1 0 13" stroke="var(--ink)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  off:'<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="var(--ink)" opacity=".5"/><path d="M16 9l6 6M22 9l-6 6" stroke="var(--tap)" stroke-width="2.4" stroke-linecap="round"/></svg>',
  bloom:'<svg viewBox="0 0 100 100"><g fill="var(--petal)"><circle cx="50" cy="24" r="18"/><circle cx="76" cy="44" r="18"/><circle cx="66" cy="74" r="18"/><circle cx="34" cy="74" r="18"/><circle cx="24" cy="44" r="18"/></g><circle cx="50" cy="52" r="15" fill="var(--centre)"/></svg>'
};
$("homeBtn").innerHTML=ICON.home;$("winHome").innerHTML=ICON.home;$("resetBtn").innerHTML=ICON.reset;
function paintMute(){$("mute").innerHTML=muted?ICON.off:ICON.on}
paintMute();
$("mute").onclick=()=>{muted=!muted;store.set("pg_muted",muted);paintMute();tone(660)};

/* Draw n as stacks of up to 5 blocks side by side (e.g. 12 = 5 + 5 + 2). The top block gets a face. */
function tower(n){
  let h="";
  for(let start=0;start<n;start+=5){
    h+='<div class="stack">';
    for(let i=start;i<Math.min(start+5,n);i++)h+=`<div class="cube${i===n-1?" face":""}"></div>`;
    h+="</div>";
  }
  return h;
}

/* ---------- Home screen ---------- */
function showHome(){
  $("game").hidden=true;$("win").hidden=true;$("home").hidden=false;
  const next=LEVELS.findIndex((_,i)=>!done.has(i));
  $("plots").innerHTML=LEVELS.map((_,i)=>
    `<button class="plot${i===next?" next":""}" data-i="${i}" aria-label="Level ${i+1}${done.has(i)?", watered":""}">
      ${done.has(i)?`<span class="badge">${ICON.bloom}</span>`:""}
      <div class="tower">${tower(i+1)}</div></button>`).join("");
  $("plots").querySelectorAll(".plot").forEach(b=>b.onclick=()=>{tone(520);startLevel(+b.dataset.i)});
}

/* ---------- Tile drawings (100x100 box) ---------- */
const ARM={1:[50,-2],2:[102,50],4:[50,102],8:[-2,50]};
function arms(mask){let s="";BITS.forEach(b=>{if(mask&b){const[x,y]=ARM[b];s+=`<line x1="50" y1="50" x2="${x}" y2="${y}"/>`}});return s}
const PATCH='<rect class="patch" x="3" y="3" width="94" height="94" rx="16"/>';
function pipeSVG(base,deg){
  const a=arms(base);
  return `<svg viewBox="0 0 100 100">${PATCH}<g class="pipe" style="transform:rotate(${deg}deg)">
    <g class="edge">${a}<circle cx="50" cy="50" r="17"/></g><g class="inner">${a}<circle cx="50" cy="50" r="11"/></g></g></svg>`;
}
function tapSVG(dir){
  return `<svg viewBox="0 0 100 100" class="always">${PATCH}
    <g class="edge">${arms(dir)}</g><g class="inner">${arms(dir)}</g>
    <rect x="28" y="28" width="44" height="44" rx="12" fill="var(--tap)"/><rect x="28" y="58" width="44" height="14" rx="7" fill="var(--tap-dark)"/>
    <circle cx="50" cy="44" r="12" fill="#fff"/><path d="M50 36v16M42 44h16" stroke="var(--tap)" stroke-width="4" stroke-linecap="round"/></svg>`;
}
function flowerSVG(){
  let p="";for(let i=0;i<6;i++)p+=`<ellipse cx="50" cy="25" rx="9" ry="14" transform="rotate(${i*60} 50 40)"/>`;
  return `<svg viewBox="0 0 100 100">${PATCH}<g class="flowerwrap">
    <path d="M50 90V48" stroke="var(--grass-deep)" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="38" cy="70" rx="11" ry="6" fill="var(--grass-deep)" transform="rotate(-30 38 70)"/>
    <ellipse cx="62" cy="64" rx="11" ry="6" fill="var(--grass-deep)" transform="rotate(30 62 64)"/>
    <g class="petals" fill="var(--petal)">${p}</g><circle class="centre" cx="50" cy="40" r="10"/></g></svg>`;
}
const ROCK='<svg viewBox="0 0 100 100"><ellipse cx="44" cy="60" rx="30" ry="22" fill="var(--rock-dark)"/><ellipse cx="44" cy="55" rx="28" ry="20" fill="var(--rock)"/><ellipse cx="72" cy="72" rx="14" ry="10" fill="var(--rock-dark)"/><ellipse cx="34" cy="48" rx="8" ry="4" fill="#fff" opacity=".35"/></svg>';
function grassSVG(seed){
  const x=20+(seed*37)%50, y=30+(seed*53)%40;
  return `<svg viewBox="0 0 100 100"><path d="M${x} ${y+12}l-6-14M${x} ${y+12}l0-16M${x} ${y+12}l6-14" stroke="var(--grass-tuft)" stroke-width="4" stroke-linecap="round"/></svg>`;
}

/* ---------- Game state ---------- */
let L, cells, cols, rows, solvedLock=false, idleTimer;

function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

function startLevel(i,fresh=0){
  L=i;solvedLock=false;$("win").hidden=true;
  const g=LEVELS[i].g.map(r=>r.trim().split(/\s+/));
  rows=g.length;cols=g[0].length;
  cells=[];
  g.forEach((r,y)=>r.forEach((c,x)=>{
    const cell={x,y,kind:"grass"};
    if(c==="R")cell.kind="rock";
    else if(c==="F")cell.kind="flower";
    else if(c[0]==="T"){cell.kind="tap";cell.mask=+c.slice(1)}
    else if(c!=="."){cell.kind="pipe";cell.base=parseInt(c,16);cell.r=0;cell.deg=0}
    cells.push(cell);
  }));
  scramble(i,fresh);
  $("home").hidden=true;$("game").hidden=false;
  $("lvlTower").innerHTML=tower(i+1);
  buildBoard();update(false);armIdle();
}

const at=(x,y)=>x<0||y<0||x>=cols||y>=rows?null:cells[y*cols+x];
const maskOf=c=>c.kind==="pipe"?rotN(c.base,c.r):c.kind==="tap"?c.mask:0;

/* Turn some pipes the wrong way. Pipes on the real path are picked first so the puzzle is never pre-solved. */
function scramble(i,fresh){
  const rand=rng(i*977+13+fresh*31);
  const flowSolved=flow();                     // everything starts in the solved position
  const pipes=cells.filter(c=>c.kind==="pipe"&&c.base!==15);
  const path=pipes.filter(c=>flowSolved.dist.has(c)).sort(()=>rand()-.5);
  const extra=pipes.filter(c=>!flowSolved.dist.has(c));
  const mix=LEVELS[i].mix||pipes.length;
  const pick=[...path,...extra].slice(0,mix);
  pick.forEach(c=>{
    const opts=[1,2,3].filter(n=>rotN(c.base,n)!==c.base);
    c.r=opts[Math.floor(rand()*opts.length)];c.deg=c.r*90;
  });
  let guard=0;
  while(allWatered(flow())&&guard++<20){const c=path[guard%path.length];c.r=(c.r+1)%4;c.deg+=90}
}

/* Follow the water from the tap. Returns how far each tile is from the tap (for the ripple effect). */
function flow(){
  const tap=cells.find(c=>c.kind==="tap"),dist=new Map([[tap,0]]),q=[tap],flowers=new Set();
  while(q.length){
    const c=q.shift(),m=maskOf(c);
    BITS.forEach(d=>{
      if(!(m&d))return;
      const n=at(c.x+DX[d],c.y+DY[d]);
      if(!n||dist.has(n))return;
      if(n.kind==="flower"){dist.set(n,dist.get(c)+1);flowers.add(n);return}
      if(n.kind==="pipe"&&(maskOf(n)&opp(d))){dist.set(n,dist.get(c)+1);q.push(n)}
    });
  }
  return{dist,flowers};
}
const allWatered=f=>cells.filter(c=>c.kind==="flower").every(c=>f.flowers.has(c));

function buildBoard(){
  const b=$("board"),gap=20;
  const size=Math.max(44,Math.min(110,Math.floor((Math.min(window.innerWidth,560)-32-gap)/cols),Math.floor((window.innerHeight-190)/rows)));
  b.style.gridTemplateColumns=`repeat(${cols},${size}px)`;b.style.gridAutoRows=`${size}px`;
  b.innerHTML="";
  cells.forEach((c,i)=>{
    const el=document.createElement(c.kind==="pipe"?"button":"div");
    el.className="tile";c.el=el;
    if(c.kind==="pipe"){el.innerHTML=pipeSVG(c.base,c.deg);el.setAttribute("aria-label","Pipe, tap to turn");el.onclick=()=>turn(c)}
    else if(c.kind==="tap")el.innerHTML=tapSVG(c.mask);
    else if(c.kind==="flower")el.innerHTML=flowerSVG();
    else if(c.kind==="rock"){el.innerHTML=ROCK;el.onclick=()=>{el.classList.remove("bump");void el.offsetWidth;el.classList.add("bump")}}
    else el.innerHTML=grassSVG(i+L*7);
    b.appendChild(el);
  });
}

function turn(c){
  if(solvedLock)return;
  c.r=(c.r+1)%4;c.deg+=90;
  c.el.querySelector(".pipe").style.transform=`rotate(${c.deg}deg)`;
  tone(480+Math.random()*80,.08);
  try{navigator.vibrate&&navigator.vibrate(8)}catch(e){}
  update(true);armIdle();
}

/* Paint water along the connected path, then check for a win. */
let wetBefore=new Set();
function update(withSound){
  const f=flow(),wetNow=new Set();let maxD=0;
  cells.forEach(c=>{
    if(c.kind!=="pipe"&&c.kind!=="flower")return;
    const d=f.dist.get(c),wet=d!=null&&(c.kind==="pipe"||f.flowers.has(c));
    c.el.style.transitionDelay="0s";
    c.el.querySelectorAll(".inner line,.inner circle,.petals,.centre").forEach(n=>n.style.transitionDelay=wet?(d*0.09)+"s":"0s");
    c.el.classList.toggle("wet",wet);
    if(wet){wetNow.add(c);maxD=Math.max(maxD,d)}
  });
  if(withSound)f.flowers.forEach(fl=>{if(!wetBefore.has(fl))tone(784,.25,f.dist.get(fl)*.09,"sine",.14)});
  wetBefore=wetNow;
  if(allWatered(f)){solvedLock=true;clearTimeout(idleTimer);setTimeout(celebrate,maxD*90+650)}
}

/* If nothing is tapped for a while, gently wiggle one pipe that needs turning. */
function armIdle(){
  clearTimeout(idleTimer);
  idleTimer=setTimeout(()=>{
    const f=flow();
    const wrong=cells.find(c=>c.kind==="pipe"&&c.base!==15&&rotN(c.base,c.r)!==c.base&&
      BITS.some(d=>{const n=at(c.x+DX[d],c.y+DY[d]);return n&&f.dist.has(n)&&(c.base&d)}));
    const target=wrong||cells.find(c=>c.kind==="pipe"&&rotN(c.base,c.r)!==c.base);
    if(target){target.el.classList.remove("nudge");void target.el.offsetWidth;target.el.classList.add("nudge")}
    armIdle();
  },7000);
}

function celebrate(){
  done.add(L);store.set("pg_done",[...done]);
  [523,659,784,1047].forEach((n,i)=>tone(n,.3,i*.12,"sine",.13));
  $("win").hidden=false;
  for(let i=0;i<28;i++){
    const p=document.createElement("span");p.className="fall";
    p.style.left=Math.random()*100+"vw";p.style.animationDuration=(2.2+Math.random()*1.8)+"s";p.style.animationDelay=Math.random()*.6+"s";
    document.body.appendChild(p);setTimeout(()=>p.remove(),4800);
  }
}

$("nextBtn").onclick=()=>{tone(620);L+1<LEVELS.length?startLevel(L+1):showHome()};
$("winHome").onclick=$("homeBtn").onclick=()=>{tone(440);clearTimeout(idleTimer);showHome()};
$("resetBtn").onclick=()=>{tone(400);startLevel(L,Date.now()%1000)};
window.addEventListener("resize",()=>{if(!$("game").hidden){buildBoard();update(false)}});

showHome();

/* Register the service worker so the game works offline once installed */
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}))}
