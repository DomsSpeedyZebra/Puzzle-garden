/* Puzzle Garden game logic. Needs levels.js (WORLDS) loaded first.
   Screens: worlds map -> level picker -> game. Water only flows when a tap is pressed.

   Things on the board:
   pipe   - turn by tapping (unless stuck/metal). A "bridge" lets two streams cross without mixing.
   slot   - an empty spot to fill with a piece from the tray (drag it, or tap piece then tap slot)
   pebble - a small stone that can be dragged out of the way
   hedgehog - must stay dry
   tap    - press to test. May have a colour (blue/red) and an amount (number of blocks)
   flower - needs water of its colour, and the right amount if it shows blocks */

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
let hasTested=store.get("pg_tested",false);
let unlockAll=store.get("pg_unlock_all",false);      // parent shortcut: hold the title for 3 seconds
const isDone=(w,l)=>done.has(w+":"+l);
const doneCount=w=>WORLDS[w].levels?WORLDS[w].levels.filter((_,l)=>isDone(w,l)).length:0;
const UNLOCK_AFTER=10;
const worldOpen=w=>!WORLDS[w].soon&&(w===0||unlockAll||doneCount(w-1)>=UNLOCK_AFTER);

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
const sndUhOh=(when=0)=>{tone(392,.18,when,"triangle",.12);tone(311,.28,when+.2,"triangle",.12)};
const sndPlace=()=>tone(330,.1,0,"sine",.14,520);

/* ---------- Icons and world art ---------- */
const ICON={
  back:'<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" stroke="var(--grass-deep)" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reset:'<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2" stroke="var(--water-edge)" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M3 3v5h5" stroke="var(--water-edge)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  on:'<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="var(--ink)"/><path d="M16 8a5 5 0 0 1 0 8M18.5 5.5a8.5 8.5 0 0 1 0 13" stroke="var(--ink)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  off:'<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="var(--ink)" opacity=".5"/><path d="M16 9l6 6M22 9l-6 6" stroke="var(--tap)" stroke-width="2.4" stroke-linecap="round"/></svg>',
  bloom:'<svg viewBox="0 0 100 100"><g fill="var(--petal)"><circle cx="50" cy="24" r="18"/><circle cx="76" cy="44" r="18"/><circle cx="66" cy="74" r="18"/><circle cx="34" cy="74" r="18"/><circle cx="24" cy="44" r="18"/></g><circle cx="50" cy="52" r="15" fill="var(--centre)"/></svg>',
  lock:'<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="3" fill="var(--ink)" opacity=".55"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="var(--ink)" stroke-width="2.4" fill="none" opacity=".55"/></svg>'
};
const WORLD_ART=[
  '<svg viewBox="0 0 100 80"><path d="M50 78V40" stroke="var(--grass-deep)" stroke-width="6"/><ellipse cx="38" cy="60" rx="12" ry="6" fill="var(--grass-deep)" transform="rotate(-30 38 60)"/><g fill="var(--petal)"><circle cx="50" cy="16" r="11"/><circle cx="64" cy="27" r="11"/><circle cx="59" cy="43" r="11"/><circle cx="41" cy="43" r="11"/><circle cx="36" cy="27" r="11"/></g><circle cx="50" cy="31" r="9" fill="var(--centre)"/></svg>',
  '<svg viewBox="0 0 100 80"><path d="M50 40V22" stroke="var(--grass-deep)" stroke-width="5"/><ellipse cx="41" cy="22" rx="10" ry="6" fill="var(--grass)"/><ellipse cx="59" cy="18" rx="10" ry="6" fill="var(--grass)"/><path d="M28 40h44l-6 36H34z" fill="var(--soil-deep)"/><rect x="24" y="36" width="52" height="10" rx="4" fill="var(--soil)"/></svg>',
  '<svg viewBox="0 0 100 80"><path d="M14 66c4-26 22-40 42-40s32 16 32 40z" fill="var(--hog)"/><path d="M22 50l-8-8M32 38l-6-10M46 30l-2-12M60 30l4-12M74 38l8-8" stroke="var(--hog-dark)" stroke-width="5" stroke-linecap="round"/><ellipse cx="84" cy="60" rx="12" ry="9" fill="var(--hog-face)"/><circle cx="88" cy="56" r="2.5" fill="var(--ink)"/><circle cx="96" cy="61" r="3" fill="var(--ink)"/></svg>',
  '<svg viewBox="0 0 100 80"><ellipse cx="50" cy="66" rx="44" ry="12" fill="var(--water)"/><ellipse cx="48" cy="54" rx="24" ry="14" fill="var(--centre)"/><circle cx="66" cy="36" r="11" fill="var(--centre)"/><path d="M76 36l10 3-10 4z" fill="var(--hose-edge)"/><circle cx="68" cy="33" r="2.4" fill="var(--ink)"/></svg>',
  '<svg viewBox="0 0 100 80"><g fill="var(--cube)" stroke="var(--cube-edge)" stroke-width="2"><rect x="38" y="58" width="24" height="18" rx="3"/><rect x="38" y="38" width="24" height="18" rx="3"/><rect x="38" y="18" width="24" height="18" rx="3"/></g><circle cx="45" cy="26" r="2.4" fill="var(--ink)"/><circle cx="55" cy="26" r="2.4" fill="var(--ink)"/><path d="M45 31q5 4 10 0" stroke="var(--ink)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'
];
$("winHome").innerHTML=ICON.back;$("homeBtn").innerHTML=ICON.back;$("levelsBack").innerHTML=ICON.back;$("resetBtn").innerHTML=ICON.reset;
function paintMute(){$("mute").innerHTML=muted?ICON.off:ICON.on}
paintMute();
$("mute").onclick=()=>{muted=!muted;store.set("pg_muted",muted);paintMute();tone(660)};

/* Parent shortcut: hold the title for 3 seconds to open every world */
(function(){let t;const h=document.querySelector("h1");
  const start=()=>{t=setTimeout(()=>{unlockAll=!unlockAll;store.set("pg_unlock_all",unlockAll);tone(880,.2);tone(1175,.3,.15);showWorlds()},3000)};
  const stop=()=>clearTimeout(t);
  h.addEventListener("pointerdown",start);["pointerup","pointerleave","pointercancel"].forEach(e=>h.addEventListener(e,stop));})();

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
/* Same idea inside a tile's SVG: n cubes in columns of 5, bottom-left at (x,y) */
function svgCubes(n,x,y,cls="scube",s=9){
  let h="";
  for(let i=0;i<n;i++){const col=Math.floor(i/5),row=i%5;
    const gap=s>12?.5:1;
    h+=`<rect class="${cls}" x="${x+col*(s+gap+1)}" y="${y-(row+1)*(s+gap)}" width="${s}" height="${s}" rx="${s>12?3:2}"/>`}
  return h;
}

/* ---------- Screens ---------- */
let W=0, L=0;
function show(id){["home","levels","game"].forEach(s=>$(s).hidden=s!==id);$("win").hidden=true;clearTimeout(idleTimer);
  if(id!=="game"&&reloadPending)location.reload()}

function showWorlds(){
  show("home");
  $("worlds").innerHTML=WORLDS.map((w,i)=>{
    const open=worldOpen(i), n=w.levels?w.levels.length:20;
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
    if(!worldOpen(w)){bump(b);tone(200,.15);return}
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
const BOLTS='<circle class="bolt" cx="41" cy="41" r="3"/><circle class="bolt" cx="59" cy="41" r="3"/><circle class="bolt" cx="41" cy="59" r="3"/><circle class="bolt" cx="59" cy="59" r="3"/>';
function pipeInner(base,deg,fixed){
  const a=arms(base);
  return `<g class="pipe" style="transform:rotate(${deg}deg)">
    <g class="edge">${a}<circle cx="50" cy="50" r="17"/></g><g class="inner">${a}<circle cx="50" cy="50" r="11"/></g>${fixed?BOLTS:""}</g>`;
}
function bridgeInner(fixed){
  // vertical pipe underneath, horizontal pipe arching over it
  return `<g class="ax ax-v"><g class="edge"><line x1="50" y1="-2" x2="50" y2="102"/></g><g class="inner"><line x1="50" y1="-2" x2="50" y2="102"/></g></g>
    <ellipse cx="50" cy="56" rx="30" ry="9" fill="rgba(0,0,0,.18)"/>
    <g class="ax ax-h"><g class="edge"><path d="M-2 50H22Q50 26 78 50H102" fill="none"/></g><g class="inner"><path d="M-2 50H22Q50 26 78 50H102" fill="none"/></g></g>
    ${fixed?'<circle class="bolt" cx="50" cy="38" r="3"/>':""}`;
}
const pipeSVG=(base,deg,fixed)=>`<svg viewBox="0 0 100 100">${PATCH}${pipeInner(base,deg,fixed)}</svg>`;
const pieceSVG=p=>`<svg viewBox="0 0 100 100">${PATCH}${p.bridge?bridgeInner(false):pipeInner(p.base,p.deg,false)}</svg>`;
function tapSVG(c){
  const body=c.color==="r"?"var(--red-edge)":levelHasColour?"var(--water-edge)":"var(--tap)";
  return `<svg viewBox="0 0 100 100">${PATCH}
    <g class="edge">${arms(c.mask)}</g><g class="inner">${arms(c.mask)}</g>
    <g class="tapbody"${c.amt?` transform="translate(${c.mask===8?38:60} ${c.mask===1?60:c.mask===4?40:50}) scale(.76) translate(-50 -50)"`:""}><rect x="28" y="28" width="44" height="44" rx="12" fill="${body}"/><rect x="28" y="58" width="44" height="14" rx="7" fill="rgba(0,0,0,.22)"/>
    <g class="wheel"><circle cx="50" cy="44" r="12" fill="#fff"/><path d="M50 36v16M42 44h16" stroke="${body}" stroke-width="4" stroke-linecap="round"/></g></g>
    ${c.amt?`<g class="amt">${svgCubes(c.amt,c.mask===8?100-4-Math.ceil(c.amt/5)*20.5:4,98,"scube",19)}</g>`:""}</svg>`;
}
function flowerSVG(c){
  let p="";for(let i=0;i<6;i++)p+=`<ellipse cx="50" cy="25" rx="9" ry="14" transform="rotate(${i*60} 50 40)"/>`;
  const petal=c.color==="r"?"var(--rflower)":levelHasColour?"var(--bflower)":"var(--petal)";
  const need=c.need?`<g class="need">${svgCubes(c.need,96-Math.ceil(c.need/5)*20.5,98,"scube",19)}</g><g class="got"></g>`:"";
  const pot=levelHasColour?`<rect x="36" y="80" width="28" height="12" rx="4" fill="${petal}" opacity=".9"/>`:"";
  return `<svg viewBox="0 0 100 100">${PATCH}<g class="flowerwrap"${c.need?' transform="translate(0 10) scale(.8)"':''}>
    <path d="M50 90V48" stroke="var(--grass-deep)" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="38" cy="70" rx="11" ry="6" fill="var(--grass-deep)" transform="rotate(-30 38 70)"/>
    <ellipse cx="62" cy="64" rx="11" ry="6" fill="var(--grass-deep)" transform="rotate(30 62 64)"/>
    <g class="petals" fill="${petal}">${p}</g><circle class="centre" cx="50" cy="40" r="10"/>${pot}</g>${need}</svg>`;
}
const ROCK='<svg viewBox="0 0 100 100"><ellipse cx="44" cy="60" rx="30" ry="22" fill="var(--rock-dark)"/><ellipse cx="44" cy="55" rx="28" ry="20" fill="var(--rock)"/><ellipse cx="72" cy="72" rx="14" ry="10" fill="var(--rock-dark)"/><ellipse cx="34" cy="48" rx="8" ry="4" fill="#fff" opacity=".35"/></svg>';
const PEBBLE='<g class="pebble"><ellipse cx="50" cy="66" rx="26" ry="9" fill="rgba(0,0,0,.18)"/><ellipse cx="50" cy="52" rx="26" ry="20" fill="var(--pebble-dark)"/><ellipse cx="50" cy="48" rx="24" ry="17" fill="var(--pebble)"/><ellipse cx="41" cy="42" rx="8" ry="4" fill="#fff" opacity=".5"/></g>';
const HEDGEHOG=`<svg viewBox="0 0 100 100"><g class="hog">
  <path d="M14 76c2-26 18-42 38-42s32 14 32 42z" fill="var(--hog)"/>
  <path d="M20 62l-9-6M26 50l-7-10M38 40l-3-12M52 36l2-12M66 40l6-10M76 50l9-6" stroke="var(--hog-dark)" stroke-width="5" stroke-linecap="round"/>
  <ellipse cx="78" cy="68" rx="14" ry="10" fill="var(--hog-face)"/><circle cx="90" cy="70" r="3.5" fill="var(--ink)"/>
  <path class="sleepy" d="M74 64q4 3 8 0" stroke="var(--ink)" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <circle class="awake" cx="78" cy="64" r="3" fill="var(--ink)"/>
  <text class="zzz" x="58" y="26" font-family="var(--display)" font-weight="800" font-size="16" fill="var(--ink)" opacity=".55">z</text>
  <text class="zzz z2" x="68" y="16" font-family="var(--display)" font-weight="800" font-size="12" fill="var(--ink)" opacity=".45">z</text>
  </g></svg>`;
function grassSVG(seed,pebble){
  const x=20+(seed*37)%50, y=30+(seed*53)%40;
  return `<svg viewBox="0 0 100 100"><path d="M${x} ${y+12}l-6-14M${x} ${y+12}l0-16M${x} ${y+12}l6-14" stroke="var(--grass-tuft)" stroke-width="4" stroke-linecap="round"/>${pebble?PEBBLE:""}</svg>`;
}
function slotSVG(c){
  const hole='<rect class="hole" x="9" y="9" width="82" height="82" rx="14"/>';
  if(c.pebble)return `<svg viewBox="0 0 100 100">${PATCH}${hole}${PEBBLE}</svg>`;
  if(c.piece)return pieceSVG(c.piece);
  return `<svg viewBox="0 0 100 100">${PATCH}${hole}</svg>`;
}

/* ---------- Game state ---------- */
let cells, cols, rows, size, tray=[], selected=null, testing=false, solved=false, idleTimer, timers=[], levelHasColour=false, pieceId=0;

function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* Turn a level's text grid into cells. See levels.js for the codes. */
function parseLevel(def){
  const g=def.g.map(r=>r.trim().split(/\s+/));
  rows=g.length;cols=g[0].length;cells=[];tray=[];selected=null;pieceId=0;levelHasColour=false;
  const mkPiece=code=>({id:pieceId++,bridge:code==="X",base:code==="X"?15:parseInt(code,16),r:0,deg:0});
  g.forEach((r,y)=>r.forEach((c,x)=>{
    const cell={x,y,kind:"grass"};
    if(c==="R")cell.kind="rock";
    else if(c==="H")cell.kind="hedgehog";
    else if(c==="M")cell.pebble=true;
    else if(c[0]==="F"){cell.kind="flower";const m=c.match(/^F(r?)(?::(\d+))?$/);cell.color=m[1]?"r":"b";cell.need=m[2]?+m[2]:0;if(m[1])levelHasColour=true}
    else if(c[0]==="T"){cell.kind="tap";const m=c.match(/^T(\d+)(r?)(?::(\d+))?$/);cell.mask=+m[1];cell.color=m[2]?"r":"b";cell.amt=m[3]?+m[3]:0;if(m[2])levelHasColour=true}
    else if(c==="X"){cell.kind="pipe";cell.bridge=true;cell.base=15;cell.r=0;cell.deg=0;cell.fixed=true}
    else if(c[0]==="?"||(c[0]==="M"&&c.length>1)){cell.kind="slot";cell.pebble=c[0]==="M";const p=mkPiece(c.slice(1));cell.sol=p;tray.push(p)}
    else if(c!=="."){cell.kind="pipe";cell.fixed=c[0]==="!";cell.base=parseInt(c.replace("!",""),16);cell.r=0;cell.deg=0}
    cells.push(cell);
  }));
  (def.extra||[]).forEach(code=>tray.push(mkPiece(code)));
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
const piecePart=c=>c.kind==="pipe"?c:c.kind==="slot"&&c.piece&&!c.pebble?c.piece:null;   // the turnable bit of a cell
const isBridge=c=>{const p=piecePart(c);return !!(p&&p.bridge)};
function maskOf(c){
  if(c.kind==="tap")return c.mask;
  const p=piecePart(c);if(!p)return 0;
  return p.bridge?15:rotN(p.base,p.r);
}

/* Turn some pipes the wrong way, shuffle the tray, and make sure the level never starts solved. */
function scramble(seed,fresh){
  const rand=rng(seed*977+13+fresh*31);
  const turnable=cells.filter(c=>c.kind==="pipe"&&!c.fixed&&c.base!==15);
  const before=flow();
  const path=turnable.filter(c=>before.wet.has(c.y*cols+c.x+"|a")).sort(()=>rand()-.5);
  const extra=turnable.filter(c=>!path.includes(c));
  const def=WORLDS[W].levels[L];
  [...path,...extra].slice(0,def.mix||turnable.length).forEach(c=>{
    const opts=[1,2,3].filter(n=>rotN(c.base,n)!==c.base);
    c.r=opts[Math.floor(rand()*opts.length)];c.deg=c.r*90;
  });
  tray.forEach(p=>{if(!p.bridge){p.r=Math.floor(rand()*4);p.deg=p.r*90}});
  tray.sort(()=>rand()-.5);
  let guard=0;
  while(check(flow()).win&&path.length&&guard++<20){const c=path[guard%path.length];c.r=(c.r+1)%4;c.deg+=90}
}

/* Follow the water from every tap.
   wet:     "cellIndex|axis" -> {taps:Set, dist}   (axis is "a", or "h"/"v" on a bridge)
   flowers: cellIndex -> {taps:Set, dist}
   leaks:   open ends where water spills; hogs: hedgehogs that got wet */
function flow(){
  const wet=new Map(),flowers=new Map(),leaks=[],hogs=new Map();
  const taps=cells.map((c,i)=>c.kind==="tap"?i:-1).filter(i=>i>=0);
  taps.forEach(ti=>{
    const tap=cells[ti],seen=new Set(),q=[{c:tap,exits:[tap.mask],dist:0}];
    while(q.length){
      const {c,exits,dist}=q.shift();
      exits.forEach(d=>{
        const n=at(c.x+DX[d],c.y+DY[d]),ni=n?n.y*cols+n.x:-1;
        if(n&&n.kind==="flower"){const f=flowers.get(ni)||{taps:new Set(),dist:dist+1};f.taps.add(ti);f.dist=Math.min(f.dist,dist+1);flowers.set(ni,f);return}
        if(n&&n.kind==="hedgehog"){if(!hogs.has(ni))hogs.set(ni,dist+1);leaks.push({c,d,t:dist,ti});return}
        if(n&&maskOf(n)&opp(d)&&n.kind!=="tap"){
          const br=isBridge(n),axis=br?(d===2||d===8?"h":"v"):"a",k=ni+"|"+axis;
          const wv=wet.get(k)||{taps:new Set(),dist:dist+1};wv.taps.add(ti);wv.dist=Math.min(wv.dist,dist+1);wet.set(k,wv);
          if(seen.has(k))return;seen.add(k);
          const out=br?[d]:BITS.filter(b=>maskOf(n)&b&&b!==opp(d));
          q.push({c:n,exits:out,dist:dist+1});
          return;
        }
        leaks.push({c,d,t:dist,ti});
      });
    }
  });
  return{wet,flowers,leaks,hogs};
}
const colourOf=set=>{const cs=new Set([...set].map(ti=>cells[ti].color));return cs.size>1?"mix":[...cs][0]};
const amountOf=set=>[...set].reduce((s,ti)=>s+(cells[ti].amt||0),0);

/* Is each flower happy? Right colour, nothing mixed in, right amount (if it shows blocks). Hedgehogs dry. */
function check(f){
  const flowerState=new Map();let win=true;
  cells.forEach((c,i)=>{
    if(c.kind!=="flower")return;
    const got=f.flowers.get(i);
    let ok=!!got&&colourOf(got.taps)===c.color;
    if(ok&&c.need)ok=amountOf(got.taps)===c.need;
    flowerState.set(i,{ok,got});
    if(!ok)win=false;
  });
  if(f.hogs.size)win=false;
  return{win,flowerState};
}

/* ---------- Board ---------- */
function buildBoard(){
  const b=$("board"),gap=20,avail=Math.min(window.innerWidth,560)-32;
  const hasTray=tray.length||cells.some(c=>c.kind==="slot");
  let size0=Math.min(110,Math.floor((avail-gap)/cols));
  const ts=Math.min(70,size0),perRow=Math.max(1,Math.floor((avail-12)/(ts+8)));
  const trayH=hasTray?Math.ceil(Math.max(1,tray.length)/perRow)*(ts+8)+40:0;
  size=Math.max(40,Math.min(size0,Math.floor((window.innerHeight-200-trayH)/rows)));
  b.style.gridTemplateColumns=`repeat(${cols},${size}px)`;b.style.gridAutoRows=`${size}px`;
  b.innerHTML="";
  cells.forEach((c,i)=>{
    const el=document.createElement("div");
    el.className="tile";el.dataset.i=i;c.el=el;
    b.appendChild(el);renderCell(c);
  });
  renderTray();
}
function renderCell(c){
  const el=c.el,i=c.y*cols+c.x;
  el.className="tile";el.removeAttribute("aria-label");
  switch(c.kind){
    case "pipe":
      el.innerHTML=c.bridge?`<svg viewBox="0 0 100 100">${PATCH}${bridgeInner(true)}</svg>`:pipeSVG(c.base,c.deg,c.fixed);
      if(c.fixed)el.classList.add("fixed");
      if(c.bridge)el.classList.add("bridge");
      el.setAttribute("role","button");el.setAttribute("aria-label",c.fixed?"Stuck pipe":"Pipe, tap to turn");break;
    case "slot":
      el.innerHTML=slotSVG(c);el.classList.add("slot");
      if(c.piece&&c.piece.bridge)el.classList.add("bridge");
      if(c.pebble)el.classList.add("haspebble");
      el.setAttribute("aria-label",c.pebble?"Pebble, drag it away":c.piece?"Piece, tap to turn":"Empty spot for a piece");break;
    case "tap":el.innerHTML=tapSVG(c);el.classList.add("tap");el.setAttribute("role","button");el.setAttribute("aria-label","Tap, press to send the water");
      if(!hasTested&&W===0&&L<2)el.classList.add("pulse");break;
    case "flower":el.innerHTML=flowerSVG(c);break;
    case "rock":el.innerHTML=ROCK;break;
    case "hedgehog":el.innerHTML=HEDGEHOG;el.classList.add("hedgehog");break;
    default:el.innerHTML=grassSVG(i+L*7,c.pebble);if(c.pebble){el.classList.add("haspebble");el.setAttribute("aria-label","Pebble, drag it away")}
  }
}
function renderTray(){
  const t=$("tray");
  t.hidden=!tray.length&&!cells.some(c=>c.kind==="slot");
  const ts=Math.min(70,size);
  t.innerHTML=tray.map(p=>`<div class="piece${selected===p?" sel":""}" data-p="${p.id}" style="width:${ts}px;height:${ts}px">${pieceSVG(p)}</div>`).join("");
}
function bump(el){el.classList.remove("bump");void el.offsetWidth;el.classList.add("bump")}

/* ---------- Touch: tap and drag ---------- */
let drag=null;
function pointerDown(e){
  if(testing||solved)return;
  const tile=e.target.closest(".tile"),pc=e.target.closest(".piece");
  if(!tile&&!pc)return;
  e.preventDefault();
  let what=null;
  if(pc)what={type:"piece",piece:tray.find(p=>p.id===+pc.dataset.p),from:null,el:pc};
  else{
    const c=cells[+tile.dataset.i];
    if(c.pebble)what={type:"pebble",from:c,el:tile};
    else if(c.kind==="slot"&&c.piece)what={type:"piece",piece:c.piece,from:c,el:tile};
    else what={type:"tile",cell:c,el:tile};
  }
  drag={...what,x0:e.clientX,y0:e.clientY,moved:false,ghost:null};
}
function pointerMove(e){
  if(!drag||drag.type==="tile")return;
  const dx=e.clientX-drag.x0,dy=e.clientY-drag.y0;
  if(!drag.moved&&Math.hypot(dx,dy)>8){
    drag.moved=true;
    const g=document.createElement("div");g.className="ghost";
    const gs=size*1.1;g.style.width=g.style.height=gs+"px";
    g.innerHTML=drag.type==="pebble"?`<svg viewBox="0 0 100 100">${PEBBLE}</svg>`:pieceSVG(drag.piece);
    document.body.appendChild(g);drag.ghost=g;drag.el.classList.add("lifted");
    tone(600,.06);
  }
  if(drag.moved){const gs=size*1.1;drag.ghost.style.transform=`translate(${e.clientX-gs/2}px,${e.clientY-gs*.75}px)`}
}
function pointerUp(e){
  if(!drag)return;
  const d=drag;drag=null;
  if(d.ghost)d.ghost.remove();
  if(d.el)d.el.classList.remove("lifted");
  if(!d.moved){tapOn(d);return}
  const under=document.elementFromPoint(e.clientX,e.clientY);
  const tile=under&&under.closest(".tile"),target=tile?cells[+tile.dataset.i]:null;
  if(d.type==="piece"){
    if(target&&target.kind==="slot"&&!target.pebble){placePiece(d.piece,target,d.from);return}
    if(d.from){d.from.piece=null;tray.push(d.piece);renderCell(d.from);renderTray();sndPlace();armIdle()}
    return;
  }
  if(d.type==="pebble"){
    const freeGrass=target&&target.kind==="grass"&&!target.pebble;
    const freeSlot=target&&target.kind==="slot"&&!target.pebble&&!target.piece;
    if(freeGrass||freeSlot){d.from.pebble=false;target.pebble=true;renderCell(d.from);renderCell(target);tone(250,.15,0,"sine",.14);armIdle()}
    else bump(d.el);
  }
}
function tapOn(d){
  if(d.type==="piece"&&!d.from){selected=selected===d.piece?null:d.piece;renderTray();tone(560,.06);armIdle();return}
  if(d.type==="piece"&&d.from){if(!d.piece.bridge){turnPart(d.piece,d.from)}else bump(d.el);return}
  if(d.type==="pebble"){bump(d.el);return}
  const c=d.cell;
  if(c.kind==="tap")return test();
  if(c.kind==="pipe"){if(c.fixed){bump(c.el);tone(180,.12,0,"square",.05)}else turnPart(c,c);return}
  if(c.kind==="slot"&&!c.piece&&selected){placePiece(selected,c,null);return}
  if(c.kind==="slot"&&!c.piece&&tray.length){const p=$("tray").querySelector(".piece");if(p)bump(p);return}
  if(c.kind==="rock"||c.kind==="hedgehog")bump(c.el);
}
function placePiece(p,slot,from){
  if(from===slot){renderCell(slot);return}
  if(slot.piece)tray.push(slot.piece);               // swap the old piece back to the tray
  if(from)from.piece=null;
  tray=tray.filter(t=>t!==p);
  slot.piece=p;selected=null;
  if(from)renderCell(from);
  renderCell(slot);renderTray();sndPlace();
  try{navigator.vibrate&&navigator.vibrate(10)}catch(e){}
  armIdle();
}
function turnPart(part,cell){
  if(testing||solved)return;
  part.r=(part.r+1)%4;part.deg+=90;
  const g=cell.el.querySelector(".pipe");if(g)g.style.transform=`rotate(${part.deg}deg)`;
  tone(480+Math.random()*80,.08);
  try{navigator.vibrate&&navigator.vibrate(8)}catch(e){}
  armIdle();
}
$("board").addEventListener("pointerdown",pointerDown);
$("tray").addEventListener("pointerdown",pointerDown);
document.addEventListener("pointermove",pointerMove);
document.addEventListener("pointerup",pointerUp);
document.addEventListener("pointercancel",()=>{if(drag){if(drag.ghost)drag.ghost.remove();if(drag.el)drag.el.classList.remove("lifted");drag=null}});

/* ---------- Testing ---------- */
const WET_PARTS=".inner line,.inner circle,.inner path,.petals,.centre";
function paintWet(el,taps,dist){
  el.classList.add("wet","w-"+colourOf(taps));
  el.querySelectorAll(WET_PARTS).forEach(n=>n.style.transitionDelay=(dist*STEP/1000)+"s");
}
function dryAll(){
  document.querySelectorAll("#board .wet,#board .wrong,#board .soaked,#board .on").forEach(el=>{
    el.classList.remove("wet","w-b","w-r","w-mix","wrong","soaked","on");
    el.querySelectorAll(WET_PARTS).forEach(n=>n.style.transitionDelay="0s");
  });
  document.querySelectorAll("#board .got").forEach(g=>g.innerHTML="");
  document.querySelectorAll(".splash").forEach(s=>s.remove());
}

/* Press a tap: all taps run together. Happy flowers bloom; wrong ones shake. Leaks splash, then it all drains. */
function test(){
  if(testing||solved)return;
  testing=true;clearTimeout(idleTimer);selected=null;renderTray();
  if(!hasTested){hasTested=true;store.set("pg_tested",true)}
  cells.forEach(c=>{if(c.kind==="tap"){c.el.classList.remove("pulse");c.el.classList.add("on","wet","w-"+c.color)}});
  sndGurgle();
  const f=flow(),res=check(f);let maxD=0;
  f.wet.forEach((v,k)=>{
    const [i,axis]=k.split("|"),el=cells[+i].el;
    const target=axis==="a"?el:el.querySelector(".ax-"+axis);
    if(target)paintWet(target,v.taps,v.dist);
    maxD=Math.max(maxD,v.dist);
  });
  res.flowerState.forEach(({ok,got},i)=>{
    const c=cells[i];if(!got)return;
    const when=got.dist*STEP;maxD=Math.max(maxD,got.dist);
    timers.push(setTimeout(()=>{
      if(ok){c.el.classList.add("wet");tone(784,.25,0,"sine",.14)}
      else{c.el.classList.add("wrong");sndUhOh()}
      if(c.need){const g=c.el.querySelector(".got");if(g)g.innerHTML=svgCubes(amountOf(got.taps),4,98,"wcube",19)}
    },when));
  });
  f.hogs.forEach((dist,i)=>timers.push(setTimeout(()=>{cells[i].el.classList.add("soaked");sndUhOh()},(dist)*STEP)));
  if(res.win){
    solved=true;
    timers.push(setTimeout(celebrate,maxD*STEP+800));
    return;
  }
  let lastLeak=0;
  f.leaks.forEach(({c,d,t,ti})=>{
    const when=(t+1)*STEP;lastLeak=Math.max(lastLeak,when);
    timers.push(setTimeout(()=>splash(c,d,cells[ti].color),when));
  });
  if(f.leaks.length)sndSplosh(f.leaks[0].t*STEP/1000+.1);
  timers.push(setTimeout(()=>{dryAll();testing=false;armIdle()},Math.max(lastLeak,maxD*STEP)+1800));
}

function splash(c,d,color){
  const s=document.createElement("div");s.className="splash"+(color==="r"?" red":"");
  const x=(c.x+.5+DX[d]*.5)*size, y=(c.y+.5+DY[d]*.5)*size;
  s.style.left=x+"px";s.style.top=y+"px";
  for(let i=0;i<7;i++){const drop=document.createElement("i");
    const a=Math.random()*Math.PI*2, r=size*(.25+Math.random()*.35);
    drop.style.setProperty("--dx",Math.cos(a)*r+"px");drop.style.setProperty("--dy",Math.sin(a)*r+"px");
    drop.style.animationDelay=Math.random()*.15+"s";s.appendChild(drop)}
  $("board").appendChild(s);
}

/* ---------- Gentle hints after a quiet spell ---------- */
function armIdle(){
  clearTimeout(idleTimer);
  idleTimer=setTimeout(()=>{
    if(testing||solved)return;
    const f=flow();
    if(check(f).win){cells.forEach(c=>{if(c.kind==="tap")c.el.classList.add("pulse")});return}
    let el=null;
    const blocked=cells.find(c=>c.kind==="slot"&&c.pebble);
    const emptySlot=cells.find(c=>c.kind==="slot"&&!c.piece&&!c.pebble);
    if(blocked)el=blocked.el;
    else if(emptySlot&&tray.length)el=$("tray").querySelector(".piece");
    else{
      const wrongPart=c=>{const p=piecePart(c);if(!p||p.bridge)return false;
        if(c.kind==="pipe")return !c.fixed&&rotN(c.base,c.r)!==c.base;
        return rotN(p.base,p.r)!==c.sol.base};
      const t=cells.find(wrongPart);if(t)el=t.el;
    }
    if(el){el.classList.remove("nudge");void el.offsetWidth;el.classList.add("nudge")}
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

/* ---------- Stop iPhone zooming ----------
   Safari ignores most "don't zoom" settings, so we also block it here:
   pinch gestures, quick double-taps, and page scrolling while dragging a piece. */
["gesturestart","gesturechange","gestureend"].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
let lastTouchEnd=0;
document.addEventListener("touchend",e=>{const now=Date.now();if(now-lastTouchEnd<400)e.preventDefault();lastTouchEnd=now},{passive:false});
document.addEventListener("touchmove",e=>{if(drag||e.touches.length>1)e.preventDefault()},{passive:false});
document.addEventListener("dblclick",e=>e.preventDefault(),{passive:false});

/* ---------- Offline + automatic updates ----------
   The service worker keeps a copy for offline play. When a new version is published,
   the game reloads itself — straight away on the menus, or as soon as he leaves the level he's playing. */
let reloadPending=false;
if("serviceWorker" in navigator){
  const hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{
    if(!hadController)return;                       // first install, nothing to refresh
    if($("game").hidden)location.reload();else reloadPending=true;
  });
  window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").then(reg=>{
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")reg.update().catch(()=>{})});
  }).catch(()=>{}));
}

showWorlds();
