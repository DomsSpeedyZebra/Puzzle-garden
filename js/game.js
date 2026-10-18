/* Puzzle Garden game logic. Needs levels.js (WORLDS) loaded first.
   Screens: worlds map -> level picker -> game. Water only flows when the tap is pressed. */

const BITS=[1,2,4,8], DX={1:0,2:1,4:0,8:-1}, DY={1:-1,2:0,4:1,8:0};
const rot1=m=>((m<<1)|(m>>3))&15;           // turn openings 90° clockwise
const rotN=(m,n)=>{for(let i=0;i<n;i++)m=rot1(m);return m};
const opp=d=>d<4?d<<2:d>>2;                  // N<->S, E<->W
const $=id=>document.getElementById(id);
const STEP=90;                               // ms for water to move one tile

/* ---------- Saved progress (per device) ---------- */
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},
             set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let done=new Set(store.get("pg_done_v2",[]));        // entries like "0:4" = world 0, level 4
let muted=store.get("pg_muted",false);
let hasTested=store.get("pg_tested",false);           // has he ever pressed the tap?
const isDone=(w,l)=>done.has(w+":"+l);
const doneCount=w=>WORLDS[w].levels?WORLDS[w].levels.filter((_,l)=>isDone(w,l)).length:0;
const UNLOCK_AFTER=10;
const worldOpen=w=>!WORLDS[w].soon&&(w===0||doneCount(w-1)>=UNLOCK_AFTER);

/* ---------- Gentle sounds ---------- */
let ac;
function tone(f,len=.12,when=0,type="triangle",vol=.12,slide){
  if(muted)return;
  try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();
    const t=ac.currentTime+when,o=ac.createOscillator(),g=ac.createGain();
    o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+len);
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+len);
    o.connect(g).connect(ac.destination);o.start(t);o.stop(t+len+.02);}catch(e){}
}
const sndGurgle=()=>{for(let i=0;i<4;i++)tone(220+i*40,.12,i*.09,"sine",.1,300+i*40)};
const sndSplosh=(when=0)=>tone(420,.35,when,"sine",.16,90);

/* ---------- Icons and world art ---------- */
const ICON={
  home:'<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="var(--grass-deep)"/></svg>',
  back:'<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" stroke="var(--grass-deep)" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reset:'<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2" stroke="var(--water-edge)" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M3 3v5h5" stroke="var(--water-edge)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  on:'<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="var(--ink)"/><path d="M16 8a5 5 0 0 1 0 8M18.5 5.5a8.5 8.5 0 0 1 0 13" stroke="var(--ink)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  off:'<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="var(--ink)" opacity=".5"/><path d="M16 9l6 6M22 9l-6 6" stroke="var(--tap)" stroke-width="2.4" stroke-linecap="round"/></svg>',
  bloom:'<svg viewBox="0 0 100 100"><g fill="var(--petal)"><circle cx="50" cy="24" r="18"/><circle cx="76" cy="44" r="18"/><circle cx="66" cy="74" r="18"/><circle cx="34" cy="74" r="18"/><circle cx="24" cy="44" r="18"/></g><circle cx="50" cy="52" r="15" fill="var(--centre)"/></svg>',
  lock:'<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="3" fill="var(--ink)" opacity=".55"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="var(--ink)" stroke-width="2.4" fill="none" opacity=".55"/></svg>'
};
const WORLD_ART=[
  // Garden: a flower
  '<svg viewBox="0 0 100 80"><path d="M50 78V40" stroke="var(--grass-deep)" stroke-width="6"/><ellipse cx="38" cy="60" rx="12" ry="6" fill="var(--grass-deep)" transform="rotate(-30 38 60)"/><g fill="var(--petal)"><circle cx="50" cy="16" r="11"/><circle cx="64" cy="27" r="11"/><circle cx="59" cy="43" r="11"/><circle cx="41" cy="43" r="11"/><circle cx="36" cy="27" r="11"/></g><circle cx="50" cy="31" r="9" fill="var(--centre)"/></svg>',
  // Potting shed: a plant pot with a seedling
  '<svg viewBox="0 0 100 80"><path d="M50 40V22" stroke="var(--grass-deep)" stroke-width="5"/><ellipse cx="41" cy="22" rx="10" ry="6" fill="var(--grass)"/><ellipse cx="59" cy="18" rx="10" ry="6" fill="var(--grass)"/><path d="M28 40h44l-6 36H34z" fill="var(--soil-deep)"/><rect x="24" y="36" width="52" height="10" rx="4" fill="var(--soil)"/></svg>',
  // Hedgehog hill
  '<svg viewBox="0 0 100 80"><path d="M14 66c4-26 22-40 42-40s32 16 32 40z" fill="#8a6a4a"/><path d="M22 50l-8-8M32 38l-6-10M46 30l-2-12M60 30l4-12M74 38l8-8" stroke="#6b4f35" stroke-width="5" stroke-linecap="round"/><ellipse cx="84" cy="60" rx="12" ry="9" fill="#e8c9a0"/><circle cx="88" cy="56" r="2.5" fill="var(--ink)"/><circle cx="96" cy="61" r="3" fill="var(--ink)"/></svg>',
  // Duck pond
  '<svg viewBox="0 0 100 80"><ellipse cx="50" cy="66" rx="44" ry="12" fill="var(--water)"/><ellipse cx="48" cy="54" rx="24" ry="14" fill="var(--centre)"/><circle cx="66" cy="36" r="11" fill="var(--centre)"/><path d="M76 36l10 3-10 4z" fill="var(--hose-edge)"/><circle cx="68" cy="33" r="2.4" fill="var(--ink)"/></svg>',
  // Number meadow: a stack of blocks with a face
  '<svg viewBox="0 0 100 80"><g fill="var(--cube)" stroke="var(--cube-edge)" stroke-width="2"><rect x="38" y="58" width="24" height="18" rx="3"/><rect x="38" y="38" width="24" height="18" rx="3"/><rect x="38" y="18" width="24" height="18" rx="3"/></g><circle cx="45" cy="26" r="2.4" fill="var(--ink)"/><circle cx="55" cy="26" r="2.4" fill="var(--ink)"/><path d="M45 31q5 4 10 0" stroke="var(--ink)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'
];
$("winHome").innerHTML=ICON.back;$("homeBtn").innerHTML=ICON.back;$("levelsBack").innerHTML=ICON.back;$("resetBtn").innerHTML=ICON.reset;
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

/* ---------- Screens ---------- */
let W=0, L=0;
function show(id){["home","levels","game"].forEach(s=>$(s).hidden=s!==id);$("win").hidden=true;clearTimeout(idleTimer)}

function showWorlds(){
  show("home");
  $("worlds").innerHTML=WORLDS.map((w,i)=>{
    const open=worldOpen(i), n=w.levels?w.levels.length:20, c=doneCount(i);
    const dots=w.levels?`<div class="dots">${Array.from({length:n},(_,l)=>`<i class="${isDone(i,l)?"on":""}"></i>`).join("")}</div>`:"";
    const note=w.soon?'<span class="soon">Coming soon</span>':!open?`<span class="soon">Finish ${UNLOCK_AFTER} in ${WORLDS[i-1].name}</span>`:"";
    return `<button class="world${open?"":" locked"}" data-w="${i}" ${open?"":'aria-disabled="true"'} aria-label="${w.name}${open?"":", locked"}">
      <div class="art">${WORLD_ART[i]}</div>
      <div class="winfo"><strong>${w.name}</strong>${dots}${note}</div>
      ${open?"":`<span class="lock">${ICON.lock}</span>`}
    </button>`;
  }).join("");
  $("worlds").querySelectorAll(".world").forEach(b=>b.onclick=()=>{
    const w=+b.dataset.w;
    if(!worldOpen(w)){b.classList.remove("bump");void b.offsetWidth;b.classList.add("bump");tone(200,.15);return}
    tone(520);showLevels(w);
  });
}

function showLevels(w){
  W=w;show("levels");
  $("worldName").textContent=WORLDS[w].name;
  const lv=WORLDS[w].levels, next=lv.findIndex((_,i)=>!isDone(w,i));
  $("plots").innerHTML=lv.map((_,i)=>
    `<button class="plot${i===next?" next":""}" data-i="${i}" aria-label="Level ${i+1}${isDone(w,i)?", watered":""}">
      ${isDone(w,i)?`<span class="badge">${ICON.bloom}</span>`:""}
      <div class="tower">${tower(i+1)}</div></button>`).join("");
  $("plots").querySelectorAll(".plot").forEach(b=>b.onclick=()=>{tone(520);startLevel(W,+b.dataset.i)});
}

/* ---------- Tile drawings (100x100 box) ---------- */
const ARM={1:[50,-2],2:[102,50],4:[50,102],8:[-2,50]};
function arms(mask){let s="";BITS.forEach(b=>{if(mask&b){const[x,y]=ARM[b];s+=`<line x1="50" y1="50" x2="${x}" y2="${y}"/>`}});return s}
const PATCH='<rect class="patch" x="3" y="3" width="94" height="94" rx="16"/>';
function pipeSVG(base,deg,fixed){
  const a=arms(base);
  const bolts=fixed?'<circle class="bolt" cx="41" cy="41" r="3"/><circle class="bolt" cx="59" cy="41" r="3"/><circle class="bolt" cx="41" cy="59" r="3"/><circle class="bolt" cx="59" cy="59" r="3"/>':"";
  return `<svg viewBox="0 0 100 100">${PATCH}<g class="pipe" style="transform:rotate(${deg}deg)">
    <g class="edge">${a}<circle cx="50" cy="50" r="17"/></g><g class="inner">${a}<circle cx="50" cy="50" r="11"/></g>${bolts}</g></svg>`;
}
function tapSVG(dir){
  return `<svg viewBox="0 0 100 100">${PATCH}
    <g class="edge">${arms(dir)}</g><g class="inner">${arms(dir)}</g>
    <g class="tapbody"><rect x="28" y="28" width="44" height="44" rx="12" fill="var(--tap)"/><rect x="28" y="58" width="44" height="14" rx="7" fill="var(--tap-dark)"/>
    <g class="wheel"><circle cx="50" cy="44" r="12" fill="#fff"/><path d="M50 36v16M42 44h16" stroke="var(--tap)" stroke-width="4" stroke-linecap="round"/></g></g></svg>`;
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
let cells, cols, rows, size, testing=false, solved=false, idleTimer, timers=[];

function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

function parseLevel(def){
  const g=def.g.map(r=>r.trim().split(/\s+/));
  rows=g.length;cols=g[0].length;cells=[];
  g.forEach((r,y)=>r.forEach((c,x)=>{
    const cell={x,y,kind:"grass"};
    if(c==="R")cell.kind="rock";
    else if(c==="F")cell.kind="flower";
    else if(c[0]==="T"){cell.kind="tap";cell.mask=+c.slice(1)}
    else if(c!=="."){cell.kind="pipe";cell.fixed=c[0]==="!";cell.base=parseInt(c.replace("!",""),16);cell.r=0;cell.deg=0}
    cells.push(cell);
  }));
}

function startLevel(w,l,fresh=0){
  W=w;L=l;testing=false;solved=false;
  timers.forEach(clearTimeout);timers=[];
  parseLevel(WORLDS[w].levels[l]);
  scramble(w*100+l,fresh);
  show("game");
  $("lvlTower").innerHTML=tower(l+1);
  buildBoard();armIdle();
}

const at=(x,y)=>x<0||y<0||x>=cols||y>=rows?null:cells[y*cols+x];
const maskOf=c=>c.kind==="pipe"?rotN(c.base,c.r):c.kind==="tap"?c.mask:0;

/* Turn some pipes the wrong way. Pipes on the real path go first so the puzzle never starts solved.
   Stuck (fixed) pipes are never turned. */
function scramble(seed,fresh){
  const rand=rng(seed*977+13+fresh*31);
  const solvedFlow=flow();                       // everything starts in the solved position
  const pipes=cells.filter(c=>c.kind==="pipe"&&!c.fixed&&c.base!==15);
  const path=pipes.filter(c=>solvedFlow.dist.has(c)).sort(()=>rand()-.5);
  const extra=pipes.filter(c=>!solvedFlow.dist.has(c));
  const def=WORLDS[W].levels[L];
  const pick=[...path,...extra].slice(0,def.mix||pipes.length);
  pick.forEach(c=>{
    const opts=[1,2,3].filter(n=>rotN(c.base,n)!==c.base);
    c.r=opts[Math.floor(rand()*opts.length)];c.deg=c.r*90;
  });
  let guard=0;
  while(allWatered(flow())&&path.length&&guard++<20){const c=path[guard%path.length];c.r=(c.r+1)%4;c.deg+=90}
}

/* Follow the water from the tap. dist = how many steps each tile is from the tap.
   leaks = open pipe ends where water spills out. */
function flow(){
  const tap=cells.find(c=>c.kind==="tap"),dist=new Map([[tap,0]]),q=[tap],flowers=new Set(),leaks=[];
  while(q.length){
    const c=q.shift(),m=maskOf(c);
    BITS.forEach(d=>{
      if(!(m&d))return;
      const n=at(c.x+DX[d],c.y+DY[d]);
      if(n&&n.kind==="flower"){if(!dist.has(n))dist.set(n,dist.get(c)+1);flowers.add(n);return}
      if(n&&n.kind==="pipe"&&(maskOf(n)&opp(d))){if(!dist.has(n)){dist.set(n,dist.get(c)+1);q.push(n)}return}
      leaks.push({c,d,t:dist.get(c)});
    });
  }
  return{dist,flowers,leaks};
}
const allWatered=f=>cells.filter(c=>c.kind==="flower").every(c=>f.flowers.has(c));

function buildBoard(){
  const b=$("board"),gap=20;
  size=Math.max(44,Math.min(110,Math.floor((Math.min(window.innerWidth,560)-32-gap)/cols),Math.floor((window.innerHeight-200)/rows)));
  b.style.gridTemplateColumns=`repeat(${cols},${size}px)`;b.style.gridAutoRows=`${size}px`;
  b.innerHTML="";
  cells.forEach((c,i)=>{
    const clickable=c.kind==="pipe"||c.kind==="tap"||c.kind==="rock";
    const el=document.createElement(clickable?"button":"div");
    el.className="tile";c.el=el;
    if(c.kind==="pipe"){
      el.innerHTML=pipeSVG(c.base,c.deg,c.fixed);
      if(c.fixed){el.classList.add("fixed");el.setAttribute("aria-label","Stuck pipe");el.onclick=()=>{bump(el);tone(180,.12,0,"square",.05)}}
      else{el.setAttribute("aria-label","Pipe, tap to turn");el.onclick=()=>turn(c)}
    }
    else if(c.kind==="tap"){el.innerHTML=tapSVG(c.mask);el.classList.add("tap");el.setAttribute("aria-label","Tap, press to send the water");el.onclick=test;
      if(!hasTested&&L<2)el.classList.add("pulse")}
    else if(c.kind==="flower")el.innerHTML=flowerSVG();
    else if(c.kind==="rock"){el.innerHTML=ROCK;el.setAttribute("aria-label","Rock");el.onclick=()=>bump(el)}
    else el.innerHTML=grassSVG(i+L*7);
    b.appendChild(el);
  });
}
function bump(el){el.classList.remove("bump");void el.offsetWidth;el.classList.add("bump")}

function turn(c){
  if(testing||solved)return;
  c.r=(c.r+1)%4;c.deg+=90;
  c.el.querySelector(".pipe").style.transform=`rotate(${c.deg}deg)`;
  tone(480+Math.random()*80,.08);
  try{navigator.vibrate&&navigator.vibrate(8)}catch(e){}
  armIdle();
}

/* Press the tap: water runs along whatever is connected. All flowers watered = win.
   Otherwise it splashes out of the open ends, then drains away so he can try again. */
function test(){
  if(testing||solved)return;
  testing=true;clearTimeout(idleTimer);
  if(!hasTested){hasTested=true;store.set("pg_tested",true)}
  cells.find(c=>c.kind==="tap").el.classList.remove("pulse");
  cells.find(c=>c.kind==="tap").el.classList.add("on");
  sndGurgle();
  const f=flow();let maxD=0;
  cells.forEach(c=>{
    if(c.kind!=="pipe"&&c.kind!=="flower")return;
    const d=f.dist.get(c),wet=d!=null&&(c.kind==="pipe"||f.flowers.has(c));
    c.el.querySelectorAll(".inner line,.inner circle,.petals,.centre").forEach(n=>n.style.transitionDelay=wet?(d*STEP/1000)+"s":"0s");
    c.el.classList.toggle("wet",wet);
    if(wet)maxD=Math.max(maxD,d);
  });
  f.flowers.forEach(fl=>tone(784,.25,f.dist.get(fl)*STEP/1000+.1,"sine",.14));

  if(allWatered(f)){
    solved=true;
    timers.push(setTimeout(celebrate,maxD*STEP+700));
    return;
  }
  // splash at every leak, timed to when the water reaches it
  let lastLeak=0;
  f.leaks.forEach(({c,d,t})=>{
    const when=(t+1)*STEP;lastLeak=Math.max(lastLeak,when);
    timers.push(setTimeout(()=>splash(c,d),when));
  });
  if(f.leaks.length)sndSplosh(f.leaks[0].t*STEP/1000+.1);
  // drain after a moment
  timers.push(setTimeout(()=>{
    cells.forEach(c=>{if(c.el){c.el.classList.remove("wet");c.el.querySelectorAll(".inner line,.inner circle,.petals,.centre").forEach(n=>n.style.transitionDelay="0s")}});
    cells.find(c=>c.kind==="tap").el.classList.remove("on");
    document.querySelectorAll(".splash").forEach(s=>s.remove());
    testing=false;armIdle();
  },Math.max(lastLeak,maxD*STEP)+1500));
}

function splash(c,d){
  const s=document.createElement("div");s.className="splash";
  const x=(c.x+.5+DX[d]*.5)*size, y=(c.y+.5+DY[d]*.5)*size;
  s.style.left=x+"px";s.style.top=y+"px";
  for(let i=0;i<7;i++){const drop=document.createElement("i");
    const a=Math.random()*Math.PI*2, r=size*(.25+Math.random()*.35);
    drop.style.setProperty("--dx",Math.cos(a)*r+"px");drop.style.setProperty("--dy",Math.sin(a)*r+"px");
    drop.style.animationDelay=Math.random()*.15+"s";s.appendChild(drop)}
  $("board").appendChild(s);
}

/* If nothing happens for a while: wiggle a pipe that needs turning,
   or, if everything is right, make the tap pulse. */
function armIdle(){
  clearTimeout(idleTimer);
  idleTimer=setTimeout(()=>{
    if(testing||solved)return;
    const f=flow();
    if(allWatered(f)){cells.find(c=>c.kind==="tap").el.classList.add("pulse");return}
    const turnable=c=>c.kind==="pipe"&&!c.fixed&&rotN(c.base,c.r)!==c.base;
    const near=cells.find(c=>turnable(c)&&BITS.some(d=>{const n=at(c.x+DX[d],c.y+DY[d]);return n&&f.dist.has(n)&&(c.base&d)}));
    const target=near||cells.find(turnable);
    if(target){target.el.classList.remove("nudge");void target.el.offsetWidth;target.el.classList.add("nudge")}
    armIdle();
  },8000);
}

function celebrate(){
  done.add(W+":"+L);store.set("pg_done_v2",[...done]);
  [523,659,784,1047].forEach((n,i)=>tone(n,.3,i*.12,"sine",.13));
  $("win").hidden=false;
  for(let i=0;i<28;i++){
    const p=document.createElement("span");p.className="fall";
    p.style.left=Math.random()*100+"vw";p.style.animationDuration=(2.2+Math.random()*1.8)+"s";p.style.animationDelay=Math.random()*.6+"s";
    document.body.appendChild(p);setTimeout(()=>p.remove(),4800);
  }
}

$("nextBtn").onclick=()=>{tone(620);L+1<WORLDS[W].levels.length?startLevel(W,L+1):showWorlds()};
$("winHome").onclick=$("homeBtn").onclick=()=>{tone(440);timers.forEach(clearTimeout);showLevels(W)};
$("levelsBack").onclick=()=>{tone(440);showWorlds()};
$("resetBtn").onclick=()=>{if(testing)return;tone(400);startLevel(W,L,Date.now()%1000)};
window.addEventListener("resize",()=>{if(!$("game").hidden&&!testing)buildBoard()});

showWorlds();

/* Register the service worker so the game works offline once installed */
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}))}
