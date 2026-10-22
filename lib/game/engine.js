// Generated from Desk Duel Next.js conversion with Supabase Realtime, Cloud Save & Google OAuth
/* The game runtime: save data, audio, renderer, match rules, Supabase realtime & cloud save, Google Auth and UI.
   startGame() wires everything to the DOM rendered by components/GameMarkup.jsx. */
import {$,TAU,clamp,lerp,rand,randn,fmt,esc,now,initials,dayKey,mulberry,hashStr,_rgb,hex2rgb,shade,rgba,mix,ICON,COIN,$$} from './utils';
import {TEAM,teamColor,CLASSES,classOf,PENS,PEN,ARENAS,ARENA,LEAGUES,ALL_OPP,QUICK_DIFF,DAILY,ACH,ownsClassIn} from './data';
import {PH,OBS_MAT,flickSpeed,makeWorld,makeBody,cloneWorld,edgeMargin,SUP,friction,SS,segSeg,closestSeg,capsuleDist,CAND,cand,newContact,pushContact,wake,emitManifold,capCap,capCircle,CLIP,clipRect,capBox,prep,applyImp,solveV,solveB,substep,stepWorld,flick,bodiesResting,settled,quiet,simulate,predictPath,aiCfg,clearLine,scoreState,Planner} from './physics';
import { getSupabase } from '@/lib/supabase';
import { SND, SFX, MATSND, buzz, initAudio } from './audio';

let started=false;
export function startGame(){
  if(started)return; // React Strict Mode runs effects twice in development
  started=true;

/* ============================== SAVE =============================== */
const SAVE_KEY='deskduel.save.v2';
const DEF_SETTINGS={sound:1,music:0,volume:.8,vibrate:1,shake:1,guide:'path',slowmo:1,quality:'high',tut:0};
function defaultSave(){return {v:2,coins:500,xp:0,level:1,trophies:100,owned:{ballpoint:1},equip:'ballpoint',desks:{classroom:1},career:{},
  stats:{matches:0,wins:0,losses:0,streak:0,bestStreak:0,rounds:0,roundsLost:0,kos:0,selfKos:0,shots:0,tricks:0,coinsEarned:0,
    doubleKos:0,bankKos:0,spinKos:0,longKos:0,chainKos:0,closeCalls:0,flawless:0,expertWins:0,party:0,party3:0,careerWins:0,online:0,onlineWins:0},
  ach:{},daily:{last:'',streak:0},settings:Object.assign({},DEF_SETTINGS),
  quick:{diff:'medium',need:2,arena:'classroom',pen:'ballpoint'},
  party:{n:3,need:2,arena:'classroom',clock:0,slots:[
    {name:'Player 1',type:'human',skill:'medium',color:'blue',pen:'ballpoint'},
    {name:'Player 2',type:'human',skill:'medium',color:'red',pen:'ballpoint'},
    {name:'CPU',type:'cpu',skill:'medium',color:'green',pen:'ballpoint'}]},
  profile:{color:'blue',name:'Player',avatar_url:'',email:'',google_id:'',trophies:100},online:{arena:'classroom',need:2,clock:20,pen:''},seenWelcome:0};}
function merge(base,over){
  if(!over||typeof over!=='object')return base;
  for(const k of Object.keys(over)){
    const b=base[k],o=over[k];
    if(b&&typeof b==='object'&&!Array.isArray(b)&&o&&typeof o==='object'&&!Array.isArray(o))base[k]=merge(b,o);
    else if(o!==undefined)base[k]=o;
  }
  return base;
}
let S=null;
function loadSave(){
  let raw=null;try{raw=localStorage.getItem(SAVE_KEY);}catch(e){}
  if(raw){try{S=merge(defaultSave(),JSON.parse(raw));}catch(e){S=null;}}
  if(!S){S=defaultSave();migrateV1();}
  if(S.trophies===undefined)S.trophies=100;
  if(!S.profile)S.profile={color:'blue',name:'Player',avatar_url:'',email:'',google_id:'',trophies:100};
  if(!S.profile.name)S.profile.name='Player';
  if(!S.owned[S.equip])S.equip='ballpoint';
  if(!S.desks.classroom)S.desks.classroom=1;
}
function persist(){
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(S));}catch(e){}
  if(typeof syncProgressToCloud==='function')syncProgressToCloud();
}
function migrateV1(){
  // Carry over the first version's stats and settings, with a small veteran bonus.
  try{
    const st=JSON.parse(localStorage.getItem('dd_stats')||'null'),se=JSON.parse(localStorage.getItem('dd_settings')||'null');
    if(se){S.settings.sound=se.sound==='0'?0:1;S.settings.vibrate=se.vibrate==='0'?0:1;S.settings.shake=se.shake==='0'?0:1;}
    if(st&&st.played){S.stats.matches=st.played|0;S.stats.wins=st.wins|0;S.stats.losses=st.losses|0;S.stats.bestStreak=st.best|0;S.stats.rounds=st.roundsWon|0;
      S._veteran=Math.min(600,(st.wins|0)*20);S.coins+=S._veteran;}
  }catch(e){}
}
const ownsClass=c=>Object.keys(S.owned).some(id=>classOf(PEN(id).mass)>=c);

/* ============================== AUDIO ============================== */
/* Sound lives in ./audio.js (synthesized WebAudio: reverb bus, stereo hits, voice limits). */

/* ============================ RENDERER ============================ */
const cv=$('#game'),ctx=cv.getContext('2d');
const VIEW={w:1,h:1,dpr:1,sc:1,ox:0,oy:0};
const LAYERS={floor:document.createElement('canvas'),desk:document.createElement('canvas'),key:''};
const LIGHT={x:-.45,y:-.89};
const px=n=>n/VIEW.sc;

function rr(c,x,y,w,h,r){c.beginPath();rra(c,x,y,w,h,r);}
function rra(c,x,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function capsulePath(c,h,r){c.beginPath();c.moveTo(-h,-r);c.lineTo(h,-r);c.arc(h,0,r,-Math.PI/2,Math.PI/2);c.lineTo(-h,r);c.arc(-h,0,r,Math.PI/2,Math.PI*1.5);c.closePath();}

/* ---------- pen painting (local frame: x along the pen, tip at +L/2, lit side = -y) ----------
   Light comes from the upper left and from above. Pens are painted once into cached sprites (penSprite),
   so the painters can afford fine detail: specular streaks, edge occlusion, engraving, knurling, print. */
const dk=(h,k)=>mix(h,'#000000',k),lt=(h,k)=>mix(h,'#ffffff',k);
const GOLD='#d6a945',GOLDL='#efcf78',CHROME='#bcc4ce',STEEL='#a9b1bb';
function cyl(c,base,r,k=1,y=0){const g=c.createLinearGradient(0,y-r,0,y+r);
  g.addColorStop(0,shade(base,-.45));g.addColorStop(.06,shade(base,.1*k));g.addColorStop(.17,shade(base,.4*k));g.addColorStop(.3,shade(base,.12*k));
  g.addColorStop(.5,base);g.addColorStop(.78,shade(base,-.28));g.addColorStop(.9,shade(base,-.46));g.addColorStop(.955,shade(base,-.34));g.addColorStop(1,shade(base,-.72));return g;}
function metal(c,base,r,k=1,y=0){const g=c.createLinearGradient(0,y-r,0,y+r);
  g.addColorStop(0,shade(base,-.6));g.addColorStop(.07,shade(base,.3*k));g.addColorStop(.16,shade(base,.8*k));g.addColorStop(.25,shade(base,.26*k));
  g.addColorStop(.42,shade(base,-.3));g.addColorStop(.57,shade(base,.04));g.addColorStop(.73,shade(base,.34*k));g.addColorStop(.87,shade(base,-.36));g.addColorStop(1,shade(base,-.72));return g;}
function flat(c,base,r){const g=c.createLinearGradient(0,-r,0,r); // flat-topped body with rounded long edges
  g.addColorStop(0,shade(base,-.5));g.addColorStop(.05,shade(base,.36));g.addColorStop(.13,shade(base,.16));g.addColorStop(.5,base);
  g.addColorStop(.85,shade(base,-.12));g.addColorStop(.93,shade(base,-.4));g.addColorStop(1,shade(base,-.7));return g;}
function shadeOver(c,x0,x1,r,k=1){ // cylinder shading laid over a flat pattern (stripes, knurling, engraving)
  const g=c.createLinearGradient(0,-r,0,r);g.addColorStop(0,`rgba(0,0,0,${.6*k})`);g.addColorStop(.09,'rgba(255,255,255,.1)');g.addColorStop(.19,`rgba(255,255,255,${.3*k})`);
  g.addColorStop(.32,'rgba(255,255,255,0)');g.addColorStop(.62,'rgba(0,0,0,.08)');g.addColorStop(.86,`rgba(0,0,0,${.36*k})`);g.addColorStop(1,`rgba(0,0,0,${.72*k})`);c.fillStyle=g;c.fillRect(x0,-r,x1-x0,2*r);}
function bodyPath(c,x0,x1,r,rb,rf){
  rb=Math.max(0,Math.min(rb,r,(x1-x0)/2));rf=Math.max(0,Math.min(rf,r,(x1-x0)/2));c.beginPath();c.moveTo(x0+rb,-r);c.lineTo(x1-rf,-r);
  if(rf>0)c.arcTo(x1,-r,x1,-r+rf,rf);c.lineTo(x1,r-rf);if(rf>0)c.arcTo(x1,r,x1-rf,r,rf);c.lineTo(x0+rb,r);
  if(rb>0)c.arcTo(x0,r,x0,r-rb,rb);c.lineTo(x0,-r+rb);if(rb>0)c.arcTo(x0,-r,x0+rb,-r,rb);c.closePath();}
function fb(c,x0,x1,r,rb,rf,fill){bodyPath(c,x0,x1,r,rb,rf);c.fillStyle=fill;c.fill();}
function cone(c,x0,x1,r0,r1,fill){c.beginPath();c.moveTo(x0,-r0);c.lineTo(x1,-r1);c.lineTo(x1,r1);c.lineTo(x0,r0);c.closePath();c.fillStyle=fill;c.fill();}
function coneS(c,x0,x1,r0,r1,mk,base,n=8){ // shaded cone: thin slices, each with a gradient fitted to its own radius
  for(let i=0;i<n;i++){const a=x0+(x1-x0)*i/n,b=x0+(x1-x0)*(i+1)/n+(i<n-1?.08:0),ra=r0+(r1-r0)*i/n,rb=r0+(r1-r0)*(i+1)/n;
    c.beginPath();c.moveTo(a,-ra);c.lineTo(b,-rb);c.lineTo(b,rb);c.lineTo(a,ra);c.closePath();c.fillStyle=mk(c,base,(ra+rb)/2);c.fill();}}
function band(c,x0,x1,r,fill){c.fillStyle=fill;c.fillRect(x0,-r,x1-x0,2*r);}
function vl(c,x,r,col,w){c.beginPath();c.moveTo(x,-r);c.lineTo(x,r);c.strokeStyle=col;c.lineWidth=w;c.stroke();}
function ring(c,x0,x1,r,fill){band(c,x0,x1,r,fill);vl(c,x0+.12,r,'rgba(0,0,0,.4)',.24);vl(c,x1-.12,r,'rgba(0,0,0,.4)',.24);vl(c,x0+.42,r*.96,'rgba(255,255,255,.3)',.18);}
function gloss(c,x0,x1,r,a=.34){c.save();c.translate(0,-r*.5);bodyPath(c,x0,x1,r*.14,r*.14,r*.14);c.fillStyle=`rgba(255,255,255,${a})`;c.fill();c.restore();}
function spec(c,x0,x1,r,a=.7,y=-.52,w=.14){ // crisp specular streak with tapered ends
  const y0=r*(y-w/2),y1=r*(y+w/2),ym=(y0+y1)/2,e=Math.min((x1-x0)/2,r*1.4),g=c.createLinearGradient(0,y0,0,y1);
  g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,`rgba(255,255,255,${a})`);g.addColorStop(1,'rgba(255,255,255,0)');
  c.beginPath();c.moveTo(x0,ym);c.lineTo(x0+e,y0);c.lineTo(x1-e,y0);c.lineTo(x1,ym);c.lineTo(x1-e,y1);c.lineTo(x0+e,y1);c.closePath();c.fillStyle=g;c.fill();}
function hline(c,x0,x1,y,col,w){c.beginPath();c.moveTo(x0,y);c.lineTo(x1,y);c.strokeStyle=col;c.lineWidth=w;c.stroke();}
function label(c,text,x,y,size,col,lit){c.save();c.scale(1,lit);c.fillStyle=col;c.font=`800 ${size}px Rubik,system-ui,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,x,y);c.restore();}
// print/engrave text anchored at (x,y) in the pen frame, never mirrored; o: {w,f,rot,fit,emb (light engraving edge)}
function ptxt(c,s,x,y,size,col,lit,o={}){c.save();c.translate(x,y);c.scale(1,lit);if(o.rot)c.rotate(o.rot);
  c.font=`${o.st?o.st+' ':''}${o.w||800} ${size}px ${o.f||'Rubik,system-ui,sans-serif'}`;c.textAlign='center';c.textBaseline='middle';
  if(o.fit){const m=c.measureText(s).width;if(m>o.fit)c.scale(o.fit/m,1);}
  if(o.emb){c.fillStyle=o.emb;c.fillText(s,size*.07,size*.08);}
  c.fillStyle=col;c.fillText(s,0,0);c.restore();}
// hexagonal body seen flat face up: lit facet, top facet, shaded facet
function hex(c,x0,x1,r,a,b,d){c.fillStyle=a;c.fillRect(x0,-r,x1-x0,r/2);c.fillStyle=b;c.fillRect(x0,-r/2,x1-x0,r);c.fillStyle=d;c.fillRect(x0,r/2,x1-x0,r/2);
  hline(c,x0,x1,-r/2,'rgba(255,255,255,.4)',.24);hline(c,x0,x1,r/2,'rgba(0,0,0,.28)',.24);hline(c,x0,x1,-r+.12,'rgba(0,0,0,.3)',.24);hline(c,x0,x1,r-.12,'rgba(0,0,0,.5)',.3);}
// pocket clip lying along the top of the pen, from its fixed end x0 to its free end x1
function clipBar(c,x0,x1,w0,w1,base,o={}){const d=x1>x0?1:-1,path=()=>{c.beginPath();c.moveTo(x0,-w0/2);c.lineTo(x1,-w1/2);c.arc(x1,0,w1/2,-Math.PI/2,Math.PI/2,d<0);c.lineTo(x0,w0/2);c.closePath();};
  c.save();c.translate(.35*d,Math.max(w0,w1)*.42);path();c.fillStyle='rgba(0,0,0,.34)';c.fill();c.restore();
  path();c.fillStyle=(o.mk||metal)(c,base,Math.max(w0,w1)/2);c.fill();
  hline(c,x0+.6*d,x1,-Math.min(w0,w1)*.26,'rgba(255,255,255,.6)',.22);hline(c,x0+.6*d,x1,Math.min(w0,w1)*.4,'rgba(0,0,0,.3)',.2);}
function tipBall(c,x,r,col='#4b5563'){c.beginPath();c.arc(x,0,r,0,TAU);c.fillStyle=col;c.fill();c.beginPath();c.arc(x-r*.25,-r*.3,r*.35,0,TAU);c.fillStyle='rgba(255,255,255,.55)';c.fill();}
function gNib(c,r){const g=c.createLinearGradient(0,-r,0,r);g.addColorStop(0,'#7a5614');g.addColorStop(.22,GOLDL);g.addColorStop(.4,'#fff2c2');g.addColorStop(.56,GOLD);g.addColorStop(.85,'#9c741e');g.addColorStop(1,'#5e420c');return g;}

const PEN_ART={
  // Matador Ballpoint: clear hex barrel with the refill showing, coloured posted cap and clip, metal tip
  ballpoint(c,L,r,T,lit){const h=L/2,b0=-h+33,b1=h-22,ink=dk(T,.18),i0=-h+68;
    fb(c,-h+30,b1+.5,r*.32,0,0,cyl(c,'#e9eef3',r*.32));fb(c,i0,b1+.5,r*.26,0,0,cyl(c,ink,r*.26));
    coneS(c,b1,h-6,r*.32,r*.21,metal,'#c9a043',5);
    c.save();c.globalAlpha=.3;c.fillStyle='#f4f8fc';c.fillRect(b0,-r,b1-b0,r/2);c.fillStyle='#d5e0eb';c.fillRect(b0,-r/2,b1-b0,r);c.fillStyle='#9fb1c3';c.fillRect(b0,r/2,b1-b0,r/2);
    c.globalAlpha=.4;c.fillStyle=ink;c.fillRect(i0,-r*.74,b1-i0,r*.12);c.fillRect(i0,r*.62,b1-i0,r*.12);c.restore(); // ink refracted by the side facets
    hline(c,b0,b1,-r/2,'rgba(255,255,255,.9)',.3);hline(c,b0,b1,r/2,'rgba(255,255,255,.5)',.26);
    hline(c,b0,b1,-r+.18,'rgba(60,80,100,.5)',.32);hline(c,b0,b1,r-.18,'rgba(25,35,50,.7)',.36);
    spec(c,b0+3,b1-1,r,.85,-.75,.16);spec(c,b0+8,b1-8,r,.3,.06,.1);
    c.beginPath();c.arc(-2,0,.6,0,TAU);c.fillStyle='rgba(30,40,55,.65)';c.fill();
    ptxt(c,'MATADOR',b0+27,0,r*.5,'rgba(18,28,56,.88)',lit,{w:900});
    c.save();c.globalAlpha=.62;coneS(c,b1,h-6,r,r*.34,cyl,'#e3ebf3',8);c.restore();vl(c,b1+.1,r,'rgba(255,255,255,.75)',.3);
    coneS(c,h-6.2,h-1.1,r*.34,r*.15,metal,CHROME,5);tipBall(c,h-1,r*.13);
    fb(c,-h,-h+36,r*1.06,r*.9,.7,cyl(c,T,r*1.06));fb(c,-h,-h+3.2,r*.84,r*.7,0,cyl(c,dk(T,.35),r*.84));
    vl(c,-h+35.5,r*1.06,'rgba(0,0,0,.35)',.4);spec(c,-h+3,-h+35,r*1.06,.7);
    clipBar(c,-h+4,-h+38,r*.62,r*.42,lt(T,.12),{mk:cyl});c.beginPath();c.arc(-h+38,0,r*.3,0,TAU);c.fillStyle=cyl(c,lt(T,.22),r*.3);c.fill();},
  // Staedtler Noris HB: black/yellow striped hex, team-colour dipped band, crimped ferrule, pink eraser, cedar cone, graphite
  pencil(c,L,r,T,lit){const h=L/2,x0=-h+33,x1=h-24,Y='#f6c418',K1='#2b2b2e',K2='#0e0e10';
    fb(c,-h,-h+10,r*.9,r*.7,0,cyl(c,'#f28da5',r*.9,.5));
    c.beginPath();c.ellipse(-h+2.2,r*.08,1.6,r*.55,0,0,TAU);c.fillStyle='rgba(90,60,70,.2)';c.fill();
    fb(c,-h+9,-h+22,r*1.04,0,0,metal(c,'#c6ccd4',r*1.04));
    for(const x of [-h+10.6,-h+12,-h+13.4,-h+17.6,-h+19,-h+20.4]){vl(c,x,r*1.03,'rgba(40,45,55,.5)',.34);vl(c,x+.45,r*1.03,'rgba(255,255,255,.45)',.22);}
    hex(c,-h+22,x0,r,lt(T,.28),T,dk(T,.38));vl(c,-h+22.5,r,'rgba(238,200,96,.85)',.5);vl(c,x0-.5,r,'rgba(238,200,96,.85)',.5);
    coneS(c,x1,h-6,r,r*.3,cyl,'#e8c18a',8);
    c.strokeStyle='rgba(140,88,40,.32)';c.lineWidth=.22;for(const f of [-.72,-.42,-.16,.14,.4,.7]){c.beginPath();c.moveTo(x1+1,f*r);c.lineTo(h-6,f*r*.3);c.stroke();}
    hex(c,x0,x1,r,K1,Y,K2);
    for(const [y0,y1,col] of [[-r,-r/2,K1],[-r/2,r/2,Y],[r/2,r,K2]]){c.beginPath();c.ellipse(x1,(y0+y1)/2,3.3,(y1-y0)/2,0,-Math.PI/2,Math.PI/2);c.fillStyle=col;c.fill();}
    hline(c,x0,x1+3,-r/2,'rgba(255,255,255,.4)',.24);
    coneS(c,h-6.3,h-.25,r*.31,r*.05,metal,'#4a4d52',5);c.beginPath();c.arc(h-.3,0,r*.06,0,TAU);c.fillStyle='#2b2d31';c.fill();
    spec(c,x0+2,x1-1,r,.4,-.8,.16);spec(c,x0+4,x1-4,r,.3,-.38,.1);
    ptxt(c,'NORIS HB',x0+38,0,r*.6,'rgba(22,16,0,.88)',lit,{w:900});ptxt(c,'HB',x1-12,0,r*.5,'rgba(22,16,0,.7)',lit,{w:900});},
  // BIC 4-Colour: chunky two-tone barrel, four colour slider tabs, metal clip
  click(c,L,r,T,lit){const h=L/2,j=-h+62;
    fb(c,j-1,h-30,r*.98,0,0,cyl(c,'#f3f5f7',r*.98,.6));coneS(c,h-30.5,h-6,r*.98,r*.36,cyl,'#eef1f4',9);
    coneS(c,h-6.2,h-1.2,r*.36,r*.15,metal,CHROME,4);tipBall(c,h-1.1,r*.12);
    spec(c,j,h-26,r,.7);ptxt(c,'BIC',h-60,0,r*.92,dk(T,.12),lit,{w:900});ptxt(c,'4 COLOURS',h-44,0,r*.36,'rgba(40,48,64,.7)',lit,{w:800});
    fb(c,-h,j+1,r,r*.9,0,cyl(c,T,r));vl(c,j+.6,r,'rgba(0,0,0,.38)',.5);vl(c,j+1.2,r*.98,'rgba(255,255,255,.55)',.3);spec(c,-h+3,j,r,.75);
    for(const [col,yy,w,dx] of [['#2563eb',-.7,.3,8],['#1f2229',-.24,.4,0],['#dc2626',.24,.4,0],['#16a34a',.7,.3,0]]){const y=yy*r,ww=w*r;
      rr(c,-h+25,y-ww/2-.3,18,ww+.6,ww/2);c.fillStyle='rgba(8,12,22,.4)';c.fill();
      rr(c,-h+26.3+dx,y-ww/2+ww*.3,8,ww,ww*.45);c.fillStyle='rgba(0,0,0,.35)';c.fill();
      rr(c,-h+26+dx,y-ww/2,8,ww,ww*.45);c.fillStyle=cyl(c,col,ww/2,1,y);c.fill();
      hline(c,-h+27+dx,-h+33+dx,y-ww*.2,'rgba(255,255,255,.6)',.22);}
    band(c,-h+.6,-h+3.6,r*.97,metal(c,CHROME,r*.97));clipBar(c,-h+2,-h+23,r*.62,r*.5,CHROME);},
  // Pilot G2: clear barrel and gel refill, ribbed rubber grip and clip in the ink colour
  gel(c,L,r,T,lit){const h=L/2,b0=-h+22,b1=h-38,ink=dk(T,.12);
    fb(c,b0,b1+2,r*.34,0,0,cyl(c,'#e6ebf0',r*.34));fb(c,-h+62,b1+2,r*.28,0,0,cyl(c,ink,r*.28));fb(c,-h+56,-h+62,r*.28,0,0,cyl(c,'#f3ecd6',r*.28));
    c.save();c.globalAlpha=.3;fb(c,b0,b1,r*.97,0,0,cyl(c,'#dbe4ee',r*.97));c.restore();
    hline(c,b0,b1,-r*.97+.2,'rgba(60,80,100,.42)',.3);hline(c,b0,b1,r*.97-.2,'rgba(20,30,45,.55)',.35);
    spec(c,b0+2,b1-2,r*.97,.85,-.6,.13);spec(c,b0+6,b1-8,r*.97,.25,.55,.1);
    ptxt(c,'G2',-h+76,0,r*.95,'#ffffff',lit,{w:900,f:'"Arial Black","Helvetica Neue",Arial,sans-serif',emb:'rgba(0,0,0,.55)'});ptxt(c,'0.7',-h+86,0,r*.42,'#ffffff',lit,{w:800,emb:'rgba(0,0,0,.5)'});
    fb(c,b1,h-13,r*1.04,1.2,1.2,cyl(c,lt(T,.06),r*1.04,.7));
    for(let x=b1+2.2;x<h-15;x+=1.55){vl(c,x,r*1.0,'rgba(0,0,0,.3)',.45);vl(c,x+.55,r*.98,'rgba(255,255,255,.24)',.3);}
    spec(c,b1+1,h-14,r*1.04,.4,-.56,.12);
    c.save();c.globalAlpha=.65;coneS(c,h-13.2,h-4,r*.9,r*.32,cyl,'#e7eef5',8);c.restore();
    coneS(c,h-4.2,h-.8,r*.32,r*.13,metal,CHROME,4);tipBall(c,h-.8,r*.12);
    fb(c,-h,-h+7,r*.6,r*.5,0,cyl(c,lt(T,.1),r*.6));fb(c,-h+6,-h+24,r,r*.35,0,cyl(c,T,r));vl(c,-h+23.6,r,'rgba(0,0,0,.3)',.4);spec(c,-h+7,-h+23,r,.55);
    clipBar(c,-h+8,-h+48,r*.72,r*.42,T,{mk:cyl});c.beginPath();c.arc(-h+48,0,r*.28,0,TAU);c.fillStyle=cyl(c,lt(T,.15),r*.28);c.fill();},
  // Stabilo Boss: flat, squat fluorescent body with ridged grip, cap with moulded clip
  highlighter(c,L,r,T,lit){const h=L/2,neon=lt(T,.08),cj=h-37;
    c.beginPath();c.moveTo(-h+4,-r*.98);c.lineTo(cj,-r*.86);c.lineTo(cj,r*.86);c.lineTo(-h+4,r*.98);c.quadraticCurveTo(-h,r*.98,-h,r*.6);c.lineTo(-h,-r*.6);c.quadraticCurveTo(-h,-r*.98,-h+4,-r*.98);c.closePath();c.fillStyle=flat(c,neon,r);c.fill();
    for(let x=-h+5;x<-h+17;x+=1.6){vl(c,x,r*.78,'rgba(0,0,0,.14)',.5);vl(c,x+.6,r*.78,'rgba(255,255,255,.24)',.3);}
    ptxt(c,'BOSS',-h+44,-r*.06,r*.8,'rgba(10,10,12,.9)',lit,{w:900});ptxt(c,'ORIGINAL',-h+44,r*.5,r*.3,'rgba(10,10,12,.7)',lit,{w:800});
    spec(c,-h+3,cj-1,r*.94,.6,-.88,.07);spec(c,-h+20,cj-4,r*.94,.18,-.3,.3);
    fb(c,cj-1,h,r*.9,0,r*.45,flat(c,dk(neon,.06),r*.9));vl(c,cj-.6,r*.9,'rgba(0,0,0,.38)',.6);vl(c,cj,r*.88,'rgba(255,255,255,.35)',.3);
    clipBar(c,cj+3,h-5,r*.5,r*.42,dk(neon,.02),{mk:cyl});spec(c,cj+1,h-2,r*.9,.45,-.86,.08);},
  // Sharpie: black barrel with colour band and print, team-colour cap with moulded clip
  marker(c,L,r,T,lit){const h=L/2,cj=h-46,K='#17191e';
    fb(c,-h,cj+1,r*.94,r*.55,0,cyl(c,K,r*.94,1.4));c.beginPath();c.ellipse(-h+.9,0,.6,r*.4,0,0,TAU);c.fillStyle='rgba(0,0,0,.5)';c.fill();
    ring(c,-h+4,-h+13,r*.95,cyl(c,T,r*.95));vl(c,-h+15,r*.93,'rgba(205,210,220,.65)',.45);vl(c,cj-5,r*.93,'rgba(205,210,220,.65)',.45);
    ptxt(c,'SHARPIE',-h+44,0,r*.74,'#f1f4f8',lit,{w:900,st:'italic'});ptxt(c,'PERMANENT MARKER',-h+71,0,r*.3,'rgba(220,225,235,.75)',lit,{w:800});
    spec(c,-h+2,cj,r*.94,.6,-.56,.12);
    fb(c,cj,h,r,0,r*.85,cyl(c,T,r));ring(c,cj,cj+3.2,r*1.03,cyl(c,dk(T,.2),r*1.03));spec(c,cj+3,h-2,r,.65);
    clipBar(c,h-7,cj+6,r*.5,r*.4,lt(T,.08),{mk:cyl});c.beginPath();c.arc(cj+6,0,r*.28,0,TAU);c.fillStyle=cyl(c,lt(T,.15),r*.28);c.fill();},
  // Pelikan Souverän: striped barrel (team colour), black resin, gold rings, beak clip, two-tone gold nib
  fountain(c,L,r,T,lit){const h=L/2,b0=-h+52,b1=h-35,K='#101216';
    c.save();bodyPath(c,b0,b1,r*.96,0,0);c.clip();c.fillStyle=K;c.fillRect(b0,-r,b1-b0,2*r);
    const sc=dk(T,.08),n=12;for(let i=0;i<n;i++){const a0=-Math.PI/2+i*Math.PI/n,a1=a0+.64*Math.PI/n,y0=Math.sin(a0)*r*.96,y1=Math.sin(a1)*r*.96;
      c.fillStyle=sc;c.fillRect(b0,y0,b1-b0,y1-y0);c.fillStyle='rgba(255,255,255,.14)';c.fillRect(b0,y0,b1-b0,(y1-y0)*.35);}
    shadeOver(c,b0,b1,r*.96);c.restore();spec(c,b0+1,b1-1,r*.96,.85,-.62,.1);
    fb(c,-h,-h+54,r*1.04,r*.75,.5,cyl(c,K,r*1.04,1.4));ring(c,-h+2.6,-h+4,r*.98,metal(c,GOLD,r*.98));
    ring(c,-h+45.5,-h+49.5,r*1.045,metal(c,GOLD,r*1.045));ring(c,-h+51,-h+52.4,r*1.045,metal(c,GOLD,r*1.045));spec(c,-h+5,-h+45,r*1.04,.75,-.56,.12);
    const beak=()=>{c.beginPath();c.moveTo(-h+5,-r*.3);c.quadraticCurveTo(-h+18,-r*.17,-h+30,-r*.17);c.quadraticCurveTo(-h+38,-r*.26,-h+42,-r*.2);c.arc(-h+42,0,r*.2,-Math.PI/2,Math.PI/2);
      c.quadraticCurveTo(-h+38,r*.26,-h+30,r*.17);c.quadraticCurveTo(-h+18,r*.17,-h+5,r*.3);c.closePath();};
    c.save();c.translate(.35,r*.28);beak();c.fillStyle='rgba(0,0,0,.36)';c.fill();c.restore();beak();c.fillStyle=metal(c,GOLD,r*.3);c.fill();
    hline(c,-h+30,-h+42,0,'rgba(90,60,10,.6)',.28);hline(c,-h+6,-h+40,-r*.08,'rgba(255,248,215,.7)',.2);
    ring(c,b1-.5,b1+2,r*.98,metal(c,GOLD,r*.98));coneS(c,b1+2,h-22,r*.86,r*.7,cyl,K,6);
    fb(c,h-24,h-7,r*.46,0,2,cyl(c,'#1b1b1f',r*.46));
    const nib=()=>{c.beginPath();c.moveTo(h-23,-r*.74);c.bezierCurveTo(h-14,-r*.74,h-5,-r*.34,h,-r*.04);c.lineTo(h,r*.04);c.bezierCurveTo(h-5,r*.34,h-14,r*.74,h-23,r*.74);c.closePath();};
    nib();c.fillStyle=gNib(c,r*.74);c.fill();
    c.save();nib();c.clip();const sv=c.createLinearGradient(0,-r*.5,0,r*.5);sv.addColorStop(0,'#8b939d');sv.addColorStop(.35,'#f4f6f8');sv.addColorStop(.6,'#c3c9d1');sv.addColorStop(1,'#6b7280');
    c.fillStyle=sv;c.beginPath();c.ellipse(h-4,0,9,r*.62,0,0,TAU);c.fill();c.strokeStyle='rgba(120,85,20,.75)';c.lineWidth=.3;c.beginPath();c.ellipse(h-4,0,9,r*.62,0,0,TAU);c.stroke();
    c.strokeStyle='rgba(110,75,10,.5)';c.lineWidth=.22;for(const s of [-1,1]){c.beginPath();c.moveTo(h-21,s*r*.5);c.quadraticCurveTo(h-17,s*r*.2,h-14,s*r*.42);c.stroke();}c.restore();
    c.beginPath();c.arc(h-12.8,0,.75,0,TAU);c.fillStyle='#24180a';c.fill();hline(c,h-12.2,h-.2,0,'rgba(36,24,6,.9)',.28);
    c.beginPath();c.arc(h-.45,0,.5,0,TAU);c.fillStyle='#9aa1aa';c.fill();},
  // Zebra F-701: brushed stainless barrel, knurled grip, flat steel clip, anodised team-colour button and ring
  steel(c,L,r,T,lit){const h=L/2,g0=h-48,g1=h-22,rnd=mulberry(701);
    fb(c,-h,-h+7,r*.6,r*.45,0,metal(c,T,r*.6));fb(c,-h+6,g0+.5,r,r*.25,0,metal(c,STEEL,r));
    for(let i=0;i<48;i++){const y=(rnd()*2-1)*r*.94,x=-h+7+rnd()*30,l=16+rnd()*60;hline(c,x,Math.min(g0,x+l),y,rnd()<.5?`rgba(255,255,255,${.06+rnd()*.12})`:`rgba(0,0,0,${.05+rnd()*.09})`,.16+rnd()*.2);}
    ring(c,-h+43,-h+49,r*1.01,metal(c,T,r*1.01));ptxt(c,'F-701',-h+68,0,r*.6,'rgba(36,42,52,.85)',lit,{w:800,emb:'rgba(255,255,255,.55)'});
    spec(c,-h+8,g0-1,r,.55,-.62,.08);
    c.save();bodyPath(c,g0,g1,r*.97,0,0);c.clip();c.fillStyle=metal(c,'#9aa3ad',r*.97);c.fillRect(g0,-r,g1-g0,2*r);
    for(const [col,o] of [['rgba(15,20,28,.55)',0],['rgba(255,255,255,.28)',.42]]){c.strokeStyle=col;c.lineWidth=.3;c.beginPath();
      for(let x=g0-2*r+o;x<g1+2*r;x+=1.15){c.moveTo(x,-r);c.lineTo(x+2*r,r);c.moveTo(x+2*r,-r);c.lineTo(x,r);}c.stroke();}
    shadeOver(c,g0,g1,r*.97,.8);c.restore();vl(c,g0,r,'rgba(0,0,0,.5)',.45);vl(c,g1,r*.97,'rgba(0,0,0,.5)',.45);
    coneS(c,g1,h-4,r*.97,r*.3,metal,'#b3bbc5',10);coneS(c,h-4.2,h-.7,r*.3,r*.12,metal,'#6b7280',4);tipBall(c,h-.7,r*.11);
    clipBar(c,-h+6,-h+41,r*.62,r*.56,'#c3cad3');rr(c,-h+9,-r*.12,5,r*.24,r*.12);c.fillStyle='rgba(20,25,32,.55)';c.fill();},
  // Kaweco Brass Sport: octagonal posted cap, round barrel, patina, team-colour cap top and band
  brass(c,L,r,T,lit){const h=L/2,cm=-h+58,B='#c69b45',ya=r*.414,rnd=mulberry(77);
    coneS(c,cm-1,h-19,r*.95,r*.84,metal,B,10);coneS(c,h-19.2,h-7,r*.84,r*.4,metal,B,8);coneS(c,h-7.2,h-1,r*.4,r*.15,metal,CHROME,4);tipBall(c,h-.9,r*.12);
    const fx=(a,b)=>{const g=c.createLinearGradient(-h,0,cm,0);g.addColorStop(0,a);g.addColorStop(.45,b);g.addColorStop(1,a);return g;};
    c.fillStyle=fx('#e9cc83','#d9b260');c.fillRect(-h,-r,cm-(-h),r-ya);c.fillStyle=fx('#cfa44c','#e2bf6e');c.fillRect(-h,-ya,cm+h,2*ya);c.fillStyle=fx('#8f6a26','#7a5a1e');c.fillRect(-h,ya,cm+h,r-ya);
    hline(c,-h,cm,-ya,'rgba(255,244,205,.85)',.32);hline(c,-h,cm,ya,'rgba(255,236,180,.45)',.26);hline(c,-h,cm,-r+.14,'rgba(60,40,8,.45)',.26);hline(c,-h,cm,r-.14,'rgba(40,25,4,.6)',.3);
    spec(c,-h+4,cm-3,r,.5,-.12,.18);ptxt(c,'KAWECO',-h+30,0,r*.56,'rgba(74,48,10,.8)',lit,{w:800,emb:'rgba(255,238,190,.6)'});
    fb(c,-h,-h+3,r*.98,r*.25,0,cyl(c,T,r*.98));ring(c,cm-6,cm,r*1.0,cyl(c,T,r));
    c.save();c.globalCompositeOperation='source-atop';
    for(let i=0;i<18;i++){const x=-h+rnd()*(L-8),y=(rnd()*2-1)*r,rx=2+rnd()*8,ry=.8+rnd()*2.4;c.beginPath();c.ellipse(x,y,rx,ry,(rnd()-.5)*.4,0,TAU);c.fillStyle=`rgba(70,44,10,${.08+rnd()*.13})`;c.fill();}
    for(let i=0;i<26;i++){c.beginPath();c.arc(cm-8+rnd()*12+(rnd()<.5?-40:0),(rnd()*2-1)*r*.9,.15+rnd()*.35,0,TAU);c.fillStyle=`rgba(64,118,92,${.18+rnd()*.2})`;c.fill();}
    c.strokeStyle='rgba(60,40,10,.07)';c.lineWidth=.3;for(let j=0;j<6;j++){c.beginPath();c.ellipse(h-30,-r*.1,2+j*.7,1.2+j*.45,.2,0,TAU);c.stroke();}c.restore();},
  // Parker Sonnet: gold cap with fine engraving and arrow clip, engraved centre band, gold guilloché under translucent team-colour lacquer
  gold(c,L,r,T,lit){const h=L/2,cb=-h+60,lb=cb+9;
    coneS(c,lb-1,h-14,r*.98,r*.6,metal,GOLD,12);
    c.save();c.beginPath();c.moveTo(lb-1,-r*.98);c.lineTo(h-14,-r*.6);c.lineTo(h-14,r*.6);c.lineTo(lb-1,r*.98);c.closePath();c.clip();
    c.strokeStyle='rgba(110,72,8,.45)';c.lineWidth=.26;c.beginPath();for(let x=lb-2*r;x<h;x+=1.2){c.moveTo(x,-r);c.lineTo(x+1.6*r,r);c.moveTo(x+1.6*r,-r);c.lineTo(x,r);}c.stroke();
    c.globalAlpha=.58;c.fillStyle=cyl(c,T,r);c.fillRect(lb-1,-r,h-lb,2*r);c.restore();spec(c,lb+1,h-15,r*.9,.8,-.56,.1);
    coneS(c,h-14.2,h-3,r*.6,r*.2,metal,GOLD,8);coneS(c,h-3.2,h-.6,r*.2,r*.11,metal,CHROME,3);tipBall(c,h-.6,r*.1);
    ring(c,cb,lb,r*1.02,metal(c,GOLDL,r*1.02));ptxt(c,'PARKER',(cb+lb)/2,0,r*.4,'rgba(92,60,8,.85)',lit,{w:800,fit:lb-cb-1.2,emb:'rgba(255,246,210,.7)'});
    fb(c,-h,cb+.5,r,r*.8,0,metal(c,GOLD,r));
    c.save();bodyPath(c,-h+3,cb,r,0,0);c.clip();c.lineWidth=.16;
    for(const [col,o] of [['rgba(100,66,6,.32)',0],['rgba(255,244,200,.22)',.35]]){c.strokeStyle=col;c.beginPath();for(let x=-h-2*r+o;x<cb+2*r;x+=.95){c.moveTo(x,-r);c.lineTo(x+1.2*r,r);c.moveTo(x+1.2*r,-r);c.lineTo(x,r);}c.stroke();}
    shadeOver(c,-h+3,cb,r,.45);c.restore();spec(c,-h+4,cb-1,r,.7,-.6,.1);fb(c,-h,-h+2.6,r*.78,r*.6,0,metal(c,GOLDL,r*.78));
    const ax0=-h+3,ax1=cb-4,w=r*.34,arrow=()=>{c.beginPath();c.moveTo(ax0,-w*1.45);c.lineTo(ax0+10,-w*.55);c.lineTo(ax1-8,-w*.5);c.lineTo(ax1-8,-w*1.15);c.lineTo(ax1,0);
      c.lineTo(ax1-8,w*1.15);c.lineTo(ax1-8,w*.5);c.lineTo(ax0+10,w*.55);c.lineTo(ax0,w*1.45);c.closePath();};
    c.save();c.translate(.35,r*.3);arrow();c.fillStyle='rgba(0,0,0,.34)';c.fill();c.restore();arrow();c.fillStyle=metal(c,GOLDL,w*1.45);c.fill();
    c.strokeStyle='rgba(100,66,6,.6)';c.lineWidth=.25;c.beginPath();for(let i=0;i<4;i++){const x=ax0+1.4+i*2.3;c.moveTo(x,-w*1.1);c.lineTo(x+2,0);c.lineTo(x,w*1.1);}c.stroke();
    hline(c,ax0+10,ax1-8,0,'rgba(100,66,6,.45)',.22);hline(c,ax0+10,ax1-1,-w*.28,'rgba(255,250,225,.75)',.2);},
  // Montblanc Meisterstück: deep precious resin (tinted with the team colour), three gold cap rings, gold clip, white star cap top
  tungsten(c,L,r,T,lit){const h=L/2,cl=-h+62,K='#0a0b0e',R=mix('#0b0c10',T,.34);
    fb(c,-h,cl+1,r*.96,r*.96,0,cyl(c,R,r*.96,1.2));ring(c,-h+9.5,-h+11,r*.96,metal(c,GOLD,r*.96));
    spec(c,-h+3,cl,r*.96,.8,-.6,.11);spec(c,-h+12,cl-4,r*.96,.25,.62,.08);
    fb(c,cl,h,r,0,r,cyl(c,K,r,1.3));spec(c,cl+11,h-3,r,.85,-.6,.1);spec(c,cl+14,h-8,r,.2,.62,.08);
    ring(c,cl,cl+1.4,r*1.01,metal(c,GOLD,r*1.01));ring(c,cl+2.4,cl+8.4,r*1.025,metal(c,GOLD,r*1.025));ring(c,cl+9.4,cl+10.8,r*1.01,metal(c,GOLD,r*1.01));
    ptxt(c,'MEISTERSTÜCK',cl+5.4,0,2.3,'rgba(78,50,6,.85)',lit,{rot:Math.PI/2,fit:r*1.75,w:700,f:'Georgia,"Times New Roman",serif',emb:'rgba(255,240,195,.55)'});
    c.save();bodyPath(c,cl,h,r,0,r);c.clip();const sg=c.createRadialGradient(h-1.4,-r*.28,.2,h-1,0,r*.75);sg.addColorStop(0,'#ffffff');sg.addColorStop(.7,'#eef0f3');sg.addColorStop(1,'#b9bec6');
    c.beginPath();c.ellipse(h-.2,0,2.7,r*.6,0,0,TAU);c.fillStyle=sg;c.fill();c.restore();
    ring(c,h-10,h-8.5,r*.99,metal(c,GOLD,r*.99));clipBar(c,h-9,cl+15,r*.5,r*.36,GOLD);
    c.beginPath();c.arc(cl+15,0,r*.22,0,TAU);c.fillStyle=metal(c,GOLDL,r*.22);c.fill();}
};
function litSide(a){return (Math.sin(a)*LIGHT.x-Math.cos(a)*LIGHT.y)>0?1:-1;}
function paintPenLit(c,pen,T,lit){c.save();if(lit<0)c.scale(1,-1);(PEN_ART[pen.style]||PEN_ART.ballpoint)(c,pen.len,pen.rad,T,lit);c.restore();}
function paintPen(c,pen,T,a){paintPenLit(c,pen,T,litSide(a));}

/* ---------- pen sprites ----------
   Pens are blitted every frame, so each (pen, team colour, lit side) is painted ONCE per pixel scale into an
   offscreen canvas at device resolution (with a tight occlusion halo baked in), then drawn with drawImage under
   the pen's transform. The soft cast shadow and the team glow are pre-blurred sprites as well, so a frame costs
   three drawImage calls per pen and no gradients or shadowBlur. The cache resets when VIEW.sc*VIEW.dpr changes. */
const SPR={q:0,map:new Map(),gen:0};
if(document.fonts&&document.fonts.addEventListener)document.fonts.addEventListener('loadingdone',()=>{SPR.map.clear();SPR.gen++;});
function sprFetch(key,wmm,hmm,paint){
  const q=Math.max(1,Math.round(VIEW.sc*VIEW.dpr*20));if(q!==SPR.q||SPR.map.size>240){SPR.q=q;SPR.map.clear();}
  let s=SPR.map.get(key);if(s)return s;
  const k=VIEW.sc*VIEW.dpr,cnv=document.createElement('canvas');cnv.width=Math.max(2,Math.ceil(wmm*k));cnv.height=Math.max(2,Math.ceil(hmm*k));
  const c=cnv.getContext('2d');c.setTransform(k,0,0,k,cnv.width/2,cnv.height/2);paint(c,k,cnv);
  s={cnv,w:cnv.width/k,h:cnv.height/k};SPR.map.set(key,s);return s;}
// draws only the blurred silhouette of img (device px, identity transform): the image itself lands off-canvas
function castShadow(c,img,blur,ox,oy,col,dx=0,dy=0){c.save();c.setTransform(1,0,0,1,0,0);const off=img.width+c.canvas.width+blur*4+40;
  c.shadowColor=col;c.shadowBlur=blur;c.shadowOffsetX=off+ox;c.shadowOffsetY=oy;c.drawImage(img,dx-off,dy);c.restore();}
function penSprite(pen,T,lit){return sprFetch('p|'+pen.id+'|'+T+'|'+lit,pen.len+6,pen.rad*2+6,(c,k,cnv)=>{
  const a=document.createElement('canvas');a.width=cnv.width;a.height=cnv.height;const ac=a.getContext('2d');ac.setTransform(k,0,0,k,a.width/2,a.height/2);paintPenLit(ac,pen,T,lit);
  castShadow(c,a,Math.max(1,1.3*k),0,0,'rgba(0,0,0,.6)');c.setTransform(1,0,0,1,0,0);c.drawImage(a,0,0);});}
function penShadow(pen,T){const src=penSprite(pen,T,1);return sprFetch('s|'+pen.id,src.w+12,src.h+12,(c,k,cnv)=>
  castShadow(c,src.cnv,2.8*k,0,0,'rgba(0,0,0,.5)',(cnv.width-src.cnv.width)/2,(cnv.height-src.cnv.height)/2));}
function penGlow(pen,T){const r=pen.rad;return sprFetch('g|'+pen.id+'|'+T,pen.len+42,r*2+42,(c,k)=>{c.shadowColor=T;c.shadowBlur=14*k;c.fillStyle=T;capsulePath(c,pen.len/2-r,r+4.5);c.fill();});}
function blit(c,s){c.drawImage(s.cnv,-s.w/2,-s.h/2,s.w,s.h);}
function blitPen(c,pen,T,a){blit(c,penSprite(pen,T,litSide(a)));}
function drawPenPreview(cnv,penId,T,ang=-.08){
  const p=PEN(penId),r=cnv.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1),w=Math.max(10,r.width),h=Math.max(10,r.height);
  cnv.width=w*d;cnv.height=h*d;const c=cnv.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,cnv.width,cnv.height);
  const k=Math.min((w*.86)/p.len,(h*.5)/(p.rad*2)),s=k*d,a=document.createElement('canvas');a.width=cnv.width;a.height=cnv.height;
  const ac=a.getContext('2d');ac.setTransform(d,0,0,d,0,0);ac.translate(w/2,h/2);ac.rotate(ang);ac.scale(k,k);paintPen(ac,p,T,ang);
  castShadow(c,a,3.2*s,1.4*s,3*s,'rgba(0,0,0,.42)');castShadow(c,a,1.1*s,0,.5*s,'rgba(0,0,0,.5)');c.drawImage(a,0,0);
}

/* ---------- desk surfaces (painted once into the cached desk layer; rnd is seeded per desk) ---------- */
const HAND="'Marker Felt','Bradley Hand','Segoe Print','Comic Sans MS',cursive";
function withLong(c,W,fn){c.save();if(W.h>W.w){c.translate(W.w,0);c.rotate(Math.PI/2);}fn(Math.max(W.w,W.h),Math.min(W.w,W.h));c.restore();}
function sheen(c,W,a=.1){const g=c.createLinearGradient(0,0,W.w,W.h);g.addColorStop(0,`rgba(255,255,255,${a})`);g.addColorStop(.45,'rgba(255,255,255,0)');g.addColorStop(.7,'rgba(255,255,255,0)');g.addColorStop(1,`rgba(255,255,255,${a*.5})`);c.fillStyle=g;c.fillRect(0,0,W.w,W.h);}
function knot(c,x,y,s,ring){
  for(let j=5;j>=1;j--){c.beginPath();c.ellipse(x,y,s*(1.3+j*.42)*1.7,s*(1.1+j*.3)*.7,0,0,TAU);c.strokeStyle=ring(.05+.03*(5-j));c.lineWidth=.4+j*.1;c.stroke();}
  const g=c.createRadialGradient(x-s*.3,y-s*.2,s*.1,x,y,s*1.5);g.addColorStop(0,ring(.85));g.addColorStop(.55,ring(.55));g.addColorStop(1,ring(0));
  c.fillStyle=g;c.beginPath();c.ellipse(x,y,s*1.7,s*.95,0,0,TAU);c.fill();
  c.beginPath();c.moveTo(x-s*.9,y+s*.12);c.lineTo(x+s*.75,y-s*.16);c.strokeStyle=ring(.7);c.lineWidth=.35;c.stroke();}
// planks run along x (the desk's long axis); each plank is two boards with their own tone and figure
function wood(c,L,S,rnd,P){const pw=S/P.planks;
  for(let p=0;p<P.planks;p++){const y0=p*pw,jx=L*(.18+rnd()*.64);
    for(const [x0,x1] of [[0,jx],[jx,L]]){c.save();c.beginPath();c.rect(x0,y0,x1-x0,pw);c.clip();
      const base=P.tones[Math.floor(rnd()*P.tones.length)],g=c.createLinearGradient(0,y0,0,y0+pw);
      g.addColorStop(0,shade(base,-.07));g.addColorStop(.5,shade(base,.04));g.addColorStop(1,shade(base,-.09));c.fillStyle=g;c.fillRect(x0,y0,x1-x0,pw);
      for(let i=0;i<P.lines;i++){const y=y0+rnd()*pw,amp=.5+rnd()*2,f=.003+rnd()*.01,ph=rnd()*TAU;c.beginPath();
        for(let x=x0-6;x<=x1+12;x+=12){const yy=y+Math.sin(x*f+ph)*amp+Math.sin(x*f*2.7+ph*1.7)*amp*.35;x<x0?c.moveTo(x,yy):c.lineTo(x,yy);}
        c.strokeStyle=P.ring(.04+rnd()*.11);c.lineWidth=.3+rnd()*1.1;c.stroke();}
      // flat-sawn 'cathedral' figure: nested arches pointing along the board
      for(let q=0;q<P.cath;q++){const yc=y0+pw*(.3+rnd()*.4),dir=rnd()<.5?1:-1,xt=x0+(x1-x0)*(dir>0?.05+rnd()*.5:.45+rnd()*.5),kq=.14+rnd()*.16,n=7+Math.floor(rnd()*6),sp=1.6+rnd()*1.8;
        for(let i=0;i<n;i++){const tip=xt-dir*i*sp*(.8+rnd()*.4),ph=rnd()*TAU;c.beginPath();
          const sm=Math.min(pw,Math.sqrt((x1-x0+30)/kq));for(let s=-sm;s<=sm;s+=1.5){const x=tip+dir*kq*s*s,y=yc+s+Math.sin(x*.016+ph)*1.3;s<=-sm?c.moveTo(x,y):c.lineTo(x,y);}
          c.strokeStyle=P.ring(.04+rnd()*.09);c.lineWidth=.3+rnd()*.9;c.stroke();}}
      if(P.pores)for(let i=0,n=P.pores*(x1-x0)/L;i<n;i++){c.fillStyle=P.ring(.07+rnd()*.13);c.fillRect(x0+rnd()*(x1-x0),y0+rnd()*pw,.8+rnd()*2.6,.26+rnd()*.24);}
      if(rnd()<P.knots)knot(c,x0+(x1-x0)*(.15+rnd()*.7),y0+pw*(.25+rnd()*.5),1.6+rnd()*2.2,P.ring);
      c.restore();}
    c.fillStyle=P.seam;c.fillRect(jx-.4,y0,.8,pw);c.fillStyle='rgba(255,255,255,.08)';c.fillRect(jx+.4,y0,.5,pw);
    if(p>0){c.fillStyle=P.seam;c.fillRect(0,y0-.5,L,1);c.fillStyle='rgba(255,255,255,.09)';c.fillRect(0,y0+.5,L,.6);}}}
// everyday wear on a lacquered top: softened finish where arms rest, fine scratches, little dents
function wear(c,W,rnd,amt){
  for(let i=0;i<3;i++){const x=W.w*(.2+rnd()*.6),y=W.h*(.5+rnd()*.4),rad=40+rnd()*80,g=c.createRadialGradient(x,y,0,x,y,rad);g.addColorStop(0,`rgba(255,236,200,${.06*amt})`);g.addColorStop(1,'rgba(255,236,200,0)');c.fillStyle=g;c.fillRect(x-rad,y-rad,rad*2,rad*2);}
  for(let i=0;i<Math.round(46*amt);i++){const x=rnd()*W.w,y=rnd()*W.h,a=rnd()*TAU,l=4+rnd()*28,cx=Math.cos(a),sy=Math.sin(a);
    c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+cx*l*.5+(rnd()-.5)*3,y+sy*l*.5+(rnd()-.5)*3,x+cx*l,y+sy*l);
    c.strokeStyle=rnd()<.7?`rgba(255,245,225,${.07+rnd()*.13})`:`rgba(40,20,5,${.08+rnd()*.1})`;c.lineWidth=.18+rnd()*.35;c.stroke();}
  for(let i=0;i<Math.round(10*amt);i++){const x=rnd()*W.w,y=rnd()*W.h,s=.6+rnd()*1.2;c.beginPath();c.ellipse(x,y,s,s*.7,rnd()*3,0,TAU);c.fillStyle='rgba(40,20,5,.14)';c.fill();
    c.beginPath();c.ellipse(x+.35,y+.35,s*.8,s*.5,0,0,TAU);c.fillStyle='rgba(255,240,215,.08)';c.fill();}}
// page coordinates for paper: px across from the margin side, py down from the header (portrait or landscape desks)
function pageFrame(c,W,fn){c.save();if(W.w>W.h){c.translate(0,W.h);c.rotate(-Math.PI/2);}fn(Math.min(W.w,W.h),Math.max(W.w,W.h));c.restore();}
function scrawl(c,x,y,w,size,rnd,col,lw=.45){ // loose handwriting: readable as writing from afar
  c.beginPath();let px=x;c.moveTo(px,y);
  while(px<x+w){const lw2=size*(.32+rnd()*.38),up=size*(.25+rnd()*.55)*(rnd()<.18?1.7:1);c.bezierCurveTo(px+lw2*.2,y-up,px+lw2*.75,y-up,px+lw2*.5,y);c.quadraticCurveTo(px+lw2*.7,y+size*.12,px+lw2,y);px+=lw2;
    if(rnd()<.2){px+=size*.45;c.moveTo(px,y);}}
  c.strokeStyle=col;c.lineWidth=lw;c.lineCap='round';c.lineJoin='round';c.stroke();}
function hand(c,s,x,y,size,col,a=0,al='left'){c.save();c.translate(x,y);c.rotate(a);c.font=`${size}px ${HAND}`;c.textAlign=al;c.textBaseline='alphabetic';c.fillStyle=col;c.fillText(s,0,0);c.restore();}
function blob(c,x,y,s,rnd,n=12,j=.45){const P=[];for(let i=0;i<n;i++){const a=i/n*TAU,d=s*(1-j/2+rnd()*j);P.push([x+Math.cos(a)*d,y+Math.sin(a)*d]);}
  c.beginPath();for(let i=0;i<=n;i++){const p=P[i%n],q=P[(i+1)%n],mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2;i?c.quadraticCurveTo(p[0],p[1],mx,my):c.moveTo(mx,my);}c.closePath();}
function splat(c,x,y,s,col,rnd){blob(c,x,y,s,rnd,14,.6);c.fillStyle=col;c.fill();
  for(let i=0;i<7;i++){const a=rnd()*TAU,d=s*(1.2+rnd()*1.9);c.beginPath();c.arc(x+Math.cos(a)*d,y+Math.sin(a)*d,s*(.07+rnd()*.17),0,TAU);c.fill();}
  c.beginPath();c.ellipse(x-s*.25,y-s*.3,s*.3,s*.14,-.5,0,TAU);c.fillStyle='rgba(255,255,255,.22)';c.fill();}
const SURF={
  oak(c,W,rnd){withLong(c,W,(L,S)=>wood(c,L,S,rnd,{tones:['#d7a666','#cf9a5a','#dcae70','#c99254'],ring:a=>`rgba(112,62,22,${a})`,lines:24,cath:2,knots:.35,pores:1300,planks:4,seam:'rgba(70,38,12,.5)'}));
    wear(c,W,rnd,1);sheen(c,W,.13);},
  walnut(c,W,rnd){withLong(c,W,(L,S)=>{wood(c,L,S,rnd,{tones:['#78523a','#613f28','#6d482f','#553722'],ring:a=>`rgba(26,12,4,${Math.min(1,a*1.5)})`,lines:28,cath:2,knots:.25,pores:500,planks:3,seam:'rgba(15,7,2,.6)'});
      for(let i=0;i<5;i++){c.fillStyle=`rgba(210,170,120,${.03+rnd()*.04})`;c.fillRect(0,rnd()*S,L,2+rnd()*7);}});
    wear(c,W,rnd,.7);sheen(c,W,.1);},
  mahogany(c,W,rnd,k){withLong(c,W,(L,S)=>{wood(c,L,S,rnd,{tones:['#8a3e27','#7f3621','#94472f'],ring:a=>`rgba(40,8,2,${Math.min(1,a*1.3)})`,lines:24,cath:1,knots:0,pores:400,planks:3,seam:'rgba(25,5,0,.55)'});
      for(let i=0;i<14;i++){c.fillStyle=`rgba(255,190,150,${.022+rnd()*.03})`;c.fillRect(0,rnd()*S,L,3+rnd()*10);}}); // ribbon figure
    // leather writing inlay, recessed into the wood, with gold tooling
    const m=34,x0=m,y0=m,w=W.w-2*m,h=W.h-2*m,lg=c.createLinearGradient(0,y0,0,y0+h);lg.addColorStop(0,'#24593f');lg.addColorStop(1,'#163c2b');
    c.save();rr(c,x0,y0,w,h,10);c.fillStyle=lg;c.fill();c.clip();
    for(let i=0;i<2600;i++){c.fillStyle=rnd()<.6?`rgba(0,0,0,${.05+rnd()*.1})`:`rgba(150,220,180,${.025+rnd()*.04})`;c.fillRect(x0+rnd()*w,y0+rnd()*h,.5+rnd()*.9,.5+rnd()*.7);}
    for(let i=0;i<7;i++){const x=x0+rnd()*w,y=y0+rnd()*h,a=rnd()*TAU,l=30+rnd()*70;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+Math.cos(a+.6)*l*.5,y+Math.sin(a+.6)*l*.5,x+Math.cos(a)*l,y+Math.sin(a)*l);
      c.strokeStyle='rgba(0,0,0,.1)';c.lineWidth=1.4;c.stroke();c.strokeStyle='rgba(180,240,200,.05)';c.lineWidth=.6;c.stroke();}
    const sg=c.createRadialGradient(W.w*.4,W.h*.35,20,W.w*.5,W.h*.5,Math.max(w,h)*.7);sg.addColorStop(0,'rgba(170,240,200,.07)');sg.addColorStop(1,'rgba(0,0,0,.18)');c.fillStyle=sg;c.fillRect(x0,y0,w,h);
    c.shadowColor='rgba(0,0,0,.65)';c.shadowBlur=4*k;c.shadowOffsetX=1.2*k;c.shadowOffsetY=1.8*k;c.strokeStyle='#000';c.lineWidth=8;rr(c,x0-4,y0-4,w+8,h+8,14);c.stroke();c.restore();
    c.strokeStyle='rgba(255,200,160,.16)';c.lineWidth=.8;rr(c,x0-.6,y0-.6,w+1.2,h+1.2,10.5);c.stroke();
    const gold='rgba(222,178,74,.75)';c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=1;rr(c,x0+6.4,y0+6.4,w-12,h-12,6);c.stroke();
    c.strokeStyle=gold;c.lineWidth=1;rr(c,x0+6,y0+6,w-12,h-12,6);c.stroke();
    c.setLineDash([2.4,2]);c.lineWidth=.8;rr(c,x0+10,y0+10,w-20,h-20,4);c.stroke();c.setLineDash([]);
    for(const [cx,cy,sx,sy] of [[x0+10,y0+10,1,1],[x0+w-10,y0+10,-1,1],[x0+10,y0+h-10,1,-1],[x0+w-10,y0+h-10,-1,-1]]){c.save();c.translate(cx,cy);c.scale(sx,sy);
      c.beginPath();c.arc(9,9,6,Math.PI,Math.PI*1.5);c.moveTo(4,14);c.quadraticCurveTo(10,10,14,4);c.strokeStyle=gold;c.lineWidth=.8;c.stroke();
      c.beginPath();c.arc(12,12,1.4,0,TAU);c.fillStyle=gold;c.fill();c.restore();}
    for(const [x,y,sx,sy] of [[0,0,1,1],[W.w,0,-1,1],[0,W.h,1,-1],[W.w,W.h,-1,-1]])brassCorner(c,x,y,sx,sy,k);
    sheen(c,W,.08);},
  glass(c,W,rnd){const g=c.createLinearGradient(0,0,W.w*.6,W.h);g.addColorStop(0,'#2c3f4a');g.addColorStop(.55,'#17252e');g.addColorStop(1,'#0e171d');c.fillStyle=g;c.fillRect(0,0,W.w,W.h);
    const dg=c.createRadialGradient(W.w*.5,W.h*.55,20,W.w*.5,W.h*.55,Math.max(W.w,W.h)*.7);dg.addColorStop(0,'rgba(90,140,160,.08)');dg.addColorStop(1,'rgba(0,0,0,.25)');c.fillStyle=dg;c.fillRect(0,0,W.w,W.h);
    // reflection of a window: two tall panes with a transom, skewed by the viewing angle
    c.save();c.translate(W.w*.5,-W.h*.04);c.transform(1,0,-.34,1,0,0);
    for(const [x,w] of [[0,W.w*.2],[W.w*.23,W.w*.18]]){const gg=c.createLinearGradient(x,0,x+w,0);gg.addColorStop(0,'rgba(200,232,255,0)');gg.addColorStop(.12,'rgba(200,232,255,.075)');gg.addColorStop(.85,'rgba(200,232,255,.045)');gg.addColorStop(1,'rgba(200,232,255,0)');
      c.fillStyle=gg;c.fillRect(x,0,w,W.h*.64);c.fillStyle='rgba(8,16,22,.3)';c.fillRect(x,W.h*.3,w,3.5);}
    c.restore();
    c.save();c.translate(W.w*.08,W.h*.78);c.rotate(-.62);const sg=c.createLinearGradient(0,-7,0,7);sg.addColorStop(0,'rgba(255,255,255,0)');sg.addColorStop(.5,'rgba(255,255,255,.05)');sg.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=sg;c.fillRect(-60,-7,Math.max(W.w,W.h)*.95,14);c.restore();
    // fingerprints, smudges and dust on the glass
    for(let i=0;i<6;i++){const x=W.w*(.1+rnd()*.8),y=W.h*(.1+rnd()*.8),a=rnd()*3,sm=c.createRadialGradient(x,y,0,x,y,9);sm.addColorStop(0,'rgba(220,235,245,.05)');sm.addColorStop(1,'rgba(220,235,245,0)');c.fillStyle=sm;c.fillRect(x-9,y-9,18,18);
      c.save();c.translate(x,y);c.rotate(a);c.strokeStyle='rgba(220,235,245,.05)';c.lineWidth=.3;for(let j=0;j<8;j++){c.beginPath();c.ellipse(0,0,1.2+j*.85,1+j*.62,0,rnd()*3,rnd()*3+3.6);c.stroke();}c.restore();}
    for(let i=0;i<320;i++){c.fillStyle=`rgba(220,235,245,${.04+rnd()*.12})`;c.fillRect(rnd()*W.w,rnd()*W.h,.3+rnd()*.5,.3+rnd()*.5);}
    for(let i=0;i<12;i++){const x=rnd()*W.w,y=rnd()*W.h,a=rnd()*TAU,l=6+rnd()*22;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);c.strokeStyle='rgba(220,240,255,.07)';c.lineWidth=.25;c.stroke();}
    // polished edge: a bright rim and a soft inner bevel
    c.strokeStyle='rgba(170,228,255,.3)';c.lineWidth=2;rr(c,2.5,2.5,W.w-5,W.h-5,W.cr-2);c.stroke();
    c.strokeStyle='rgba(170,228,255,.07)';c.lineWidth=7;rr(c,7.5,7.5,W.w-15,W.h-15,W.cr-5);c.stroke();},
  mat(c,W,rnd){const g=c.createRadialGradient(W.w*.45,W.h*.4,40,W.w*.5,W.h*.5,Math.max(W.w,W.h)*.75);g.addColorStop(0,'#348760');g.addColorStop(1,'#2a704e');c.fillStyle=g;c.fillRect(0,0,W.w,W.h);
    for(let i=0;i<1800;i++){c.fillStyle=rnd()<.5?'rgba(0,0,0,.06)':'rgba(255,255,255,.04)';c.fillRect(rnd()*W.w,rnd()*W.h,.6,.6);}
    const m=12,line=(x,y,w,h,a)=>{c.fillStyle=`rgba(232,250,240,${a})`;c.fillRect(x,y,w,h);};
    for(let x=m,i=0;x<=W.w-m+.01;x+=10,i++)line(x-(i%5?.2:.35),m,i%5?.4:.7,W.h-2*m,i%5?.13:.3);
    for(let y=m,i=0;y<=W.h-m+.01;y+=10,i++)line(m,y-(i%5?.2:.35),W.w-2*m,i%5?.4:.7,i%5?.13:.3);
    c.fillStyle='rgba(232,250,240,.6)';for(let x=m,i=0;x<=W.w-m+.01;x+=1,i++){const l=i%10?i%5?1.5:2.6:4.2;c.fillRect(x-.12,m-l,.24,l);c.fillRect(x-.12,W.h-m,.24,l);}
    for(let y=m,i=0;y<=W.h-m+.01;y+=1,i++){const l=i%10?i%5?1.5:2.6:4.2;c.fillRect(m-l,y-.12,l,.24);c.fillRect(W.w-m,y-.12,l,.24);}
    c.font='600 3.6px Rubik,sans-serif';c.textAlign='center';c.textBaseline='alphabetic';for(let x=m+10,n=1;x<=W.w-m;x+=10,n++)c.fillText(String(n),x,m-5);
    c.textAlign='right';c.textBaseline='middle';for(let y=m+10,n=1;y<=W.h-m;y+=10,n++)c.fillText(String(n),m-5,y);
    // angle guides and a circle template
    c.strokeStyle='rgba(232,250,240,.2)';c.lineWidth=.5;const ox=m,oy=W.h-m;for(const a of [Math.PI/6,Math.PI/4,Math.PI/3]){c.beginPath();c.moveTo(ox,oy);c.lineTo(ox+Math.cos(a)*W.h,oy-Math.sin(a)*W.h);c.stroke();}
    c.fillStyle='rgba(232,250,240,.45)';c.font='700 4.5px Rubik,sans-serif';c.textAlign='left';c.textBaseline='alphabetic';
    for(const [a,t] of [[Math.PI/6,'30°'],[Math.PI/4,'45°'],[Math.PI/3,'60°']])c.fillText(t,ox+Math.cos(a)*92+2,oy-Math.sin(a)*92);
    c.beginPath();c.arc(W.w/2,W.h/2,Math.min(W.w,W.h)*.3,0,TAU);c.stroke();c.beginPath();c.arc(W.w/2,W.h/2,Math.min(W.w,W.h)*.15,0,TAU);c.stroke();
    c.fillStyle='rgba(232,250,240,.4)';c.font='800 4.2px Rubik,sans-serif';c.textAlign='center';c.fillText('SELF-HEALING CUTTING MAT  ·  A2  ·  450 × 600 mm',W.w/2,W.h-3.6);
    // knife scores and paint
    for(let i=0;i<34;i++){const onGrid=rnd()<.4,x=onGrid?m+Math.round(rnd()*(W.w-2*m)/10)*10:rnd()*W.w,y=rnd()*W.h,a=onGrid?Math.PI/2:rnd()*TAU,l=10+rnd()*60;
      c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);c.strokeStyle=`rgba(${rnd()<.5?'210,245,225':'10,40,25'},${.12+rnd()*.14})`;c.lineWidth=.22;c.stroke();}
    const cols=['rgba(239,68,68,.55)','rgba(59,130,246,.55)','rgba(250,204,21,.6)','rgba(255,255,255,.5)','rgba(168,85,247,.5)'];
    for(let i=0;i<16;i++)splat(c,rnd()*W.w,rnd()*W.h,1.2+rnd()*5,cols[i%cols.length],rnd);},
  paper(c,W,rnd){pageFrame(c,W,(pw,ph)=>{
    c.fillStyle='#f7f3e8';c.fillRect(0,0,pw,ph);
    const g=c.createRadialGradient(pw*.45,ph*.4,pw*.2,pw*.5,ph*.5,ph*.75);g.addColorStop(0,'rgba(255,255,255,.4)');g.addColorStop(1,'rgba(150,130,90,.14)');c.fillStyle=g;c.fillRect(0,0,pw,ph);
    for(let i=0;i<1600;i++){const x=rnd()*pw,y=rnd()*ph,a=rnd()*TAU,l=.6+rnd()*2.2;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);c.strokeStyle=`rgba(120,100,70,${.03+rnd()*.05})`;c.lineWidth=.2;c.stroke();}
    const top=36,sp=8;c.fillStyle='rgba(84,146,210,.5)';for(let y=top;y<ph-5;y+=sp)c.fillRect(0,y,pw,.45);c.fillStyle='rgba(84,146,210,.6)';c.fillRect(0,top-sp-1.5,pw,.8);
    c.fillStyle='rgba(226,70,86,.6)';c.fillRect(30,0,.55,ph);c.fillRect(31.7,0,.4,ph);
    for(const f of [.17,.5,.83]){const y=ph*f,hg=c.createRadialGradient(13-1,y-1,.5,13,y,4.4);hg.addColorStop(0,'#3d2716');hg.addColorStop(.7,'#5b3c22');hg.addColorStop(1,'#20140a');
      c.beginPath();c.arc(13,y,4.4,0,TAU);c.fillStyle=hg;c.fill();c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=.8;c.beginPath();c.arc(13,y,4,Math.PI*.9,Math.PI*1.9);c.stroke();
      c.strokeStyle='rgba(255,255,255,.7)';c.lineWidth=.5;c.beginPath();c.arc(13,y,4.6,-.2,Math.PI*.8);c.stroke();}
    const fy=ph*.52;c.fillStyle='rgba(120,100,60,.08)';c.fillRect(0,fy,pw,1.6);c.fillStyle='rgba(255,255,255,.5)';c.fillRect(0,fy-.7,pw,.7); // fold crease
    examPage(c,pw,ph,rnd,top,sp);});},
  marble(c,W,rnd){const g=c.createLinearGradient(0,0,W.w,W.h);g.addColorStop(0,'#f4f1eb');g.addColorStop(.5,'#ebe7df');g.addColorStop(1,'#dcd6cc');c.fillStyle=g;c.fillRect(0,0,W.w,W.h);
    for(let i=0;i<28;i++){const x=rnd()*W.w,y=rnd()*W.h,rad=30+rnd()*130,a=.03+rnd()*.05,gg=c.createRadialGradient(x,y,0,x,y,rad),dark=rnd()<.55;
      gg.addColorStop(0,dark?`rgba(150,145,138,${a})`:`rgba(255,255,255,${a*1.6})`);gg.addColorStop(1,dark?'rgba(150,145,138,0)':'rgba(255,255,255,0)');c.fillStyle=gg;c.fillRect(x-rad,y-rad,rad*2,rad*2);}
    const walk=(x,y,a,steps,st,turn)=>{const P=[[x,y]];for(let i=0;i<steps;i++){a+=(rnd()-.5)*turn;x+=Math.cos(a)*st;y+=Math.sin(a)*st;P.push([x,y]);}return P;};
    const vein=(P,w,col,soft)=>{c.lineCap='round';c.lineJoin='round';
      const path=()=>{c.beginPath();c.moveTo(P[0][0],P[0][1]);for(let i=1;i<P.length-1;i++)c.quadraticCurveTo(P[i][0],P[i][1],(P[i][0]+P[i+1][0])/2,(P[i][1]+P[i+1][1])/2);c.lineTo(P[P.length-1][0],P[P.length-1][1]);};
      if(soft)for(const [m,al] of [[9,.03],[4.5,.05],[2.2,.09]]){path();c.strokeStyle=col(al);c.lineWidth=w*m;c.stroke();}
      path();c.strokeStyle=col(soft?.3:.2);c.lineWidth=w*.75;c.stroke();};
    const grey=a=>`rgba(104,106,118,${a})`,goldv=a=>`rgba(176,136,62,${a})`,D=Math.hypot(W.w,W.h);
    for(let v=0;v<4;v++){const gold=v===1||v===3,P=walk(rnd()*W.w*.4-W.w*.1,rnd()*W.h,-.55+rnd()*.5+(v%2?.9:0),Math.ceil(D/11),11,.4);vein(P,gold?1.3:1.8+rnd()*1.2,gold?goldv:grey,true);
      for(let b=0;b<5;b++){const p=P[Math.floor(rnd()*P.length)];vein(walk(p[0],p[1],rnd()*TAU,8+Math.floor(rnd()*14),7,.55),.45+rnd()*.5,gold?goldv:grey,rnd()<.5);}}
    for(let i=0;i<34;i++)vein(walk(rnd()*W.w,rnd()*W.h,rnd()*TAU,6+Math.floor(rnd()*16),8,.7),.18+rnd()*.3,a=>grey(a*.5),false);
    c.save();c.translate(W.w*.55,-W.h*.05);c.transform(1,0,-.34,1,0,0);const rg=c.createLinearGradient(0,0,W.w*.3,0);rg.addColorStop(0,'rgba(255,255,255,0)');rg.addColorStop(.3,'rgba(255,255,255,.12)');rg.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=rg;c.fillRect(0,0,W.w*.3,W.h*.7);c.restore();
    sheen(c,W,.2);}
};
function examPage(c,pw,ph,rnd,top,sp){const blue='rgba(28,52,140,.82)',red='rgba(212,32,44,.85)',pencil='rgba(70,70,80,.5)',L=i=>top+sp*i-1.6;
  hand(c,'Name: Alex P.',38,top-sp-4,7,blue);hand(c,'Date: 14 / 10',pw-12,top-sp-4,6,blue,0,'right');
  hand(c,'Pen Physics Quiz',pw/2,L(1),8.5,blue,0,'center');c.fillStyle=blue;c.fillRect(pw/2-38,L(1)+1.6,76,.6);
  hand(c,'1.  F = m × a',38,L(3),6.5,blue);hand(c,'= 6 g × 4 m/s²',52,L(4),6.5,blue);hand(c,'= 24 mN',52,L(5),6.5,blue);
  c.strokeStyle=red;c.lineWidth=.9;c.lineCap='round';c.beginPath();c.moveTo(96,L(5)-3);c.lineTo(99,L(5));c.lineTo(106,L(5)-7);c.stroke();
  hand(c,'2.  Which pen wins?',38,L(7),6.5,blue);hand(c,'The heaviest one!',52,L(8),6.5,blue);
  c.strokeStyle=blue;c.lineWidth=.5;c.beginPath();c.moveTo(118,L(8)-2.4);c.lineTo(146,L(8)-2.2);c.stroke();scrawl(c,150,L(8),40,5.5,rnd,blue);
  hand(c,'3.  Draw the flick:',38,L(10),6.5,blue);
  c.save();c.translate(70,L(13)-2);c.rotate(-.2);c.strokeStyle=pencil;c.lineWidth=.5;rr(c,-24,-2.5,48,5,2.5);c.stroke();c.beginPath();c.moveTo(24,0);c.lineTo(29,0);c.stroke();
  c.beginPath();c.moveTo(-34,9);c.quadraticCurveTo(-10,14,8,6);c.stroke();c.beginPath();c.moveTo(8,6);c.lineTo(3,5);c.moveTo(8,6);c.lineTo(5,10);c.stroke();c.restore();
  for(let i=15;i<23;i++)scrawl(c,i===19?48:44,L(i),pw-(i%4===2?110:70)-44,5.2,rnd,blue);
  hand(c,'4.',38,L(19),6.5,blue);
  c.save();c.translate(pw-46,top+sp*2.4);c.rotate(-.12);c.strokeStyle=red;c.lineWidth=1.3;c.beginPath();c.ellipse(0,0,22,15,0,0,TAU);c.stroke();
  hand(c,'A+',0,6,17,red,0,'center');c.restore();hand(c,'Great work!',pw-50,top+sp*5.3,6,red,-.08,'center');hand(c,'10/10',pw-48,top+sp*6.6,5.5,red,-.08,'center');
  // margin doodles, an eraser smudge
  c.strokeStyle=pencil;c.lineWidth=.45;c.beginPath();for(let i=0;i<=10;i++){const a=-Math.PI/2+i*Math.PI*.8,d=i%2?3:7.5;i?c.lineTo(15+Math.cos(a)*d,ph*.35+Math.sin(a)*d):c.moveTo(15+Math.cos(a)*d,ph*.35+Math.sin(a)*d);}c.stroke();
  c.beginPath();const sx=15,sy=ph*.66;for(let a=0;a<12;a+=.3){const rr2=.6+a*.6;a?c.lineTo(sx+Math.cos(a)*rr2,sy+Math.sin(a)*rr2):c.moveTo(sx,sy);}c.stroke();
  const eg=c.createRadialGradient(pw*.62,ph*.74,2,pw*.62,ph*.74,22);eg.addColorStop(0,'rgba(120,110,110,.12)');eg.addColorStop(1,'rgba(120,110,110,0)');c.fillStyle=eg;c.fillRect(pw*.62-22,ph*.74-22,44,44);
  for(let i=0;i<6;i++){c.fillStyle='rgba(230,150,160,.6)';c.beginPath();c.ellipse(pw*.6+rnd()*30,ph*.72+rnd()*20,.9+rnd()*.8,.5,rnd()*3,0,TAU);c.fill();}}
const EDGE={oak:'#8a5a2c',walnut:'#3a2414',mahogany:'#4a1a0e',glass:'#1d3b3a',mat:'#1f553a',paper:'#d6cdb8',marble:'#b7b0a4'};
// front face of the slab (the outline swept down by its thickness th), textured per material
function deskSide(c,W,mat,th,rnd){const E=EDGE[mat]||'#5b3a1e',y0=W.h-W.cr-2,y1=W.h+th;
  c.save();rr(c,-.4,0,W.w+.8,W.h+th,W.cr+.4);c.clip();
  const g=c.createLinearGradient(0,W.h-1,0,y1);g.addColorStop(0,shade(E,.22));g.addColorStop(.25,E);g.addColorStop(1,shade(E,-.5));c.fillStyle=g;c.fillRect(-2,y0,W.w+4,y1-y0+2);
  const wl=(n,col)=>{for(let i=0;i<n;i++){const y=W.h+rnd()*th,amp=.3+rnd()*.8,f=.01+rnd()*.03,ph=rnd()*TAU;c.beginPath();for(let x=-4;x<=W.w+8;x+=10){const yy=y+Math.sin(x*f+ph)*amp;x<0?c.moveTo(x,yy):c.lineTo(x,yy);}c.strokeStyle=col(.08+rnd()*.18);c.lineWidth=.3+rnd()*.6;c.stroke();}};
  if(mat==='oak')wl(14,a=>`rgba(80,42,12,${a})`);
  else if(mat==='walnut')wl(14,a=>`rgba(10,4,0,${a*1.4})`);
  else if(mat==='mahogany'){wl(10,a=>`rgba(20,2,0,${a*1.3})`);for(const [y,col,w] of [[W.h+2.6,'rgba(255,200,170,.22)',.8],[W.h+4.6,'rgba(0,0,0,.35)',1.2],[W.h+7.4,'rgba(255,200,170,.14)',.7]]){c.fillStyle=col;c.fillRect(-2,y,W.w+4,w);}}
  else if(mat==='glass'){c.fillStyle='rgba(90,170,150,.35)';c.fillRect(-2,W.h,W.w+4,th);c.fillStyle='rgba(200,255,240,.45)';c.fillRect(-2,W.h+.4,W.w+4,.7);c.fillStyle='rgba(200,255,240,.18)';c.fillRect(-2,W.h+th-2.2,W.w+4,.6);}
  else if(mat==='paper'){for(let y=W.h+.5,i=0;y<y1;y+=1.05,i++){c.fillStyle=i%2?'rgba(170,158,130,.5)':'rgba(255,252,242,.7)';c.fillRect(-2,y,W.w+4,.5);}}
  else if(mat==='mat'){c.fillStyle='rgba(240,250,240,.55)';c.fillRect(-2,W.h+3.2,W.w+4,.9);c.fillStyle='rgba(0,0,0,.25)';c.fillRect(-2,W.h+4.1,W.w+4,th-4);}
  else if(mat==='marble'){for(let i=0;i<26;i++){const x=rnd()*W.w;c.beginPath();c.moveTo(x,W.h);c.quadraticCurveTo(x+(rnd()-.5)*10,W.h+th/2,x+(rnd()-.5)*16,y1);c.strokeStyle=`rgba(90,88,96,${.08+rnd()*.15})`;c.lineWidth=.3+rnd()*.7;c.stroke();}
    c.fillStyle='rgba(255,255,255,.35)';c.fillRect(-2,W.h+.3,W.w+4,.8);}
  const hg=c.createLinearGradient(0,0,W.w,0);hg.addColorStop(0,'rgba(255,255,255,.1)');hg.addColorStop(.5,'rgba(0,0,0,0)');hg.addColorStop(1,'rgba(0,0,0,.22)');c.fillStyle=hg;c.fillRect(-2,y0,W.w+4,y1-y0+2);
  c.fillStyle='rgba(0,0,0,.4)';c.fillRect(-2,y1-1.4,W.w+4,1.6);c.restore();}
function brassCorner(c,x,y,sx,sy,k){c.save();c.translate(x,y);c.scale(sx,sy);const s=32;
  const path=()=>{c.beginPath();c.moveTo(0,0);c.lineTo(s,0);c.lineTo(s,3.5);c.quadraticCurveTo(9,9,3.5,s);c.lineTo(0,s);c.closePath();};
  const g=c.createLinearGradient(sx<0?s:0,sy<0?s:0,sx<0?0:s,sy<0?0:s);g.addColorStop(0,'#f3d48a');g.addColorStop(.35,'#c79a42');g.addColorStop(.6,'#e6c070');g.addColorStop(1,'#8a6420');
  c.save();c.shadowColor='rgba(0,0,0,.5)';c.shadowBlur=2.4*k;c.shadowOffsetX=.8*k;c.shadowOffsetY=1.4*k;path();c.fillStyle=g;c.fill();c.restore();
  c.strokeStyle='rgba(255,240,200,.6)';c.lineWidth=.5;path();c.stroke();
  c.beginPath();c.moveTo(s-4,3.3);c.quadraticCurveTo(12,12,3.3,s-4);c.strokeStyle='rgba(90,60,10,.5)';c.lineWidth=.5;c.stroke();
  for(const [px2,py2] of [[7,7],[20,4.2],[4.2,20]]){c.beginPath();c.arc(px2,py2,1.7,0,TAU);const sg=c.createRadialGradient(px2-.5,py2-.5,.2,px2,py2,1.7);sg.addColorStop(0,'#fff1c4');sg.addColorStop(1,'#7a5618');c.fillStyle=sg;c.fill();
    c.beginPath();c.moveTo(px2-1.2,py2+.4);c.lineTo(px2+1.2,py2-.4);c.strokeStyle='rgba(60,40,5,.75)';c.lineWidth=.35;c.stroke();}
  c.restore();}

/* ---------- decorations: flat things lying on the desk (never anything that looks solid) ---------- */
function spot(W,cands,rad){for(const [u,v] of cands){const x=W.w*u,y=W.h*v;
    if(W.obs.every(o=>Math.hypot(o.x-x,o.y-y)>rad+(o.t==='circle'?o.r:Math.max(o.sw,o.sh)/2)))return [x,y];}
  const [u,v]=cands[cands.length-1];return [W.w*u,W.h*v];}
function sticky(c,x,y,a,s,col,lines,ink,k){c.save();c.translate(x,y);c.rotate(a);
  c.save();c.shadowColor='rgba(0,0,0,.3)';c.shadowBlur=3*k;c.shadowOffsetX=1*k;c.shadowOffsetY=2.2*k;c.fillStyle=col;c.beginPath();c.moveTo(0,0);c.lineTo(s,0);c.lineTo(s,s*.94);c.quadraticCurveTo(s*.6,s*1.01,0,s);c.closePath();c.fill();c.restore();
  const g=c.createLinearGradient(0,0,0,s);g.addColorStop(0,'rgba(255,255,255,.12)');g.addColorStop(.18,'rgba(0,0,0,.04)');g.addColorStop(.25,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,.12)');
  c.fillStyle=g;c.beginPath();c.moveTo(0,0);c.lineTo(s,0);c.lineTo(s,s*.94);c.quadraticCurveTo(s*.6,s*1.01,0,s);c.closePath();c.fill();
  const lh=s/(lines.length+1.2);lines.forEach((t,i)=>hand(c,t,s/2,lh*(i+1.25),Math.min(lh*.8,s*.24),ink,0,'center'));c.restore();}
function coffeeRing(c,x,y,r,rnd,a=.3){c.save();c.translate(x,y);
  const nr=rnd()<.6?2:1;for(let j=0;j<nr;j++){const ox=j?r*.35:0,oy=j?r*.28:0,s=j?.75:1;c.beginPath();c.arc(ox,oy,r,rnd()*1.2,rnd()*1.2+TAU*(.55+rnd()*.4));c.strokeStyle=`rgba(110,62,26,${a*s})`;c.lineWidth=1.6;c.stroke();
    c.beginPath();c.arc(ox,oy,r-1.4,0,TAU);c.strokeStyle=`rgba(110,62,26,${a*.25*s})`;c.lineWidth=2.4;c.stroke();}
  c.restore();}
function inkBlot(c,x,y,s,rnd,col='rgba(22,30,88,'){blob(c,x,y,s,rnd,16,.55);c.fillStyle=col+'.5)';c.fill();c.strokeStyle=col+'.35)';c.lineWidth=.7;c.stroke();
  for(let i=0;i<7;i++){const a=rnd()*TAU,d=s*(1.1+rnd()*1.6);c.beginPath();c.arc(x+Math.cos(a)*d,y+Math.sin(a)*d,s*(.05+rnd()*.14),0,TAU);c.fillStyle=col+'.5)';c.fill();}}
function carve(c,s,x,y,a,size){c.save();c.translate(x,y);c.rotate(a);c.font=`700 ${size}px Georgia,serif`;c.textAlign='center';c.textBaseline='middle';
  c.fillStyle='rgba(255,236,205,.28)';c.fillText(s,.55,.6);c.fillStyle='rgba(60,28,8,.55)';c.fillText(s,0,0);
  const w=c.measureText(s).width/2+7;c.beginPath();c.moveTo(0,size*1.25);c.bezierCurveTo(-w*.9,size*.2,-w*.6,-size*1.3,0,-size*.55);c.bezierCurveTo(w*.6,-size*1.3,w*.9,size*.2,0,size*1.25);
  c.strokeStyle='rgba(255,236,205,.22)';c.lineWidth=1.3;c.save();c.translate(.5,.5);c.stroke();c.restore();c.strokeStyle='rgba(60,28,8,.45)';c.stroke();c.restore();}
function paperSheet(c,x,y,a,w,h,k,fill='#fbfaf6'){c.save();c.translate(x,y);c.rotate(a);c.save();c.shadowColor='rgba(0,0,0,.28)';c.shadowBlur=3*k;c.shadowOffsetX=.8*k;c.shadowOffsetY=1.8*k;c.fillStyle=fill;c.fillRect(-w/2,-h/2,w,h);c.restore();}
function paperClip(c,x,y,a,s){c.save();c.translate(x,y);c.rotate(a);c.beginPath();c.moveTo(0,s*.3);c.lineTo(0,-s*.35);c.arc(s*.12,-s*.35,s*.12,Math.PI,0);c.lineTo(s*.24,s*.38);c.arc(s*.06,s*.38,s*.18,0,Math.PI);c.lineTo(-s*.12,-s*.42);c.arc(s*.08,-s*.42,s*.2,Math.PI,0);c.lineTo(s*.28,-s*.1);
  c.strokeStyle='rgba(0,0,0,.25)';c.lineWidth=1.2;c.save();c.translate(.5,.8);c.stroke();c.restore();c.strokeStyle='#c8ced6';c.lineWidth=.8;c.stroke();c.strokeStyle='rgba(255,255,255,.7)';c.lineWidth=.3;c.stroke();c.restore();}
function tape(c,x,y,a,w,h){c.save();c.translate(x,y);c.rotate(a);c.fillStyle='rgba(236,222,180,.78)';c.beginPath();c.moveTo(-w/2,-h/2);for(let i=0;i<=6;i++)c.lineTo(w/2+(i%2?.8:-.2),-h/2+h*i/6);for(let i=6;i>=0;i--)c.lineTo(-w/2+(i%2?-.8:.2),-h/2+h*i/6);c.closePath();c.fill();
  c.fillStyle='rgba(255,255,255,.18)';c.fillRect(-w/2,-h/2,w,h*.3);c.restore();}
function decorate(c,W,arena,rnd,k){
  const id=arena.id,ink='rgba(30,60,140,.5)',gr='rgba(60,60,70,.42)';
  if(id==='classroom'){
    carve(c,'J + K',W.w*.78,W.h*.22,-.3,13);
    c.strokeStyle=ink;c.lineWidth=.7;c.beginPath();const sx=W.w*.18,sy=W.h*.17;for(let a=0;a<16;a+=.22){const r=1+a*1.4;a?c.lineTo(sx+Math.cos(a)*r,sy+Math.sin(a)*r):c.moveTo(sx,sy);}c.stroke();
    c.save();c.translate(W.w*.22,W.h*.72);c.rotate(-.05);c.strokeStyle=gr;c.lineWidth=1;c.lineCap='round';c.beginPath();
    for(const q of [1,2]){c.moveTo(q*14,0);c.lineTo(q*14+.6,42);c.moveTo(0,q*14);c.lineTo(42,q*14-.5);}c.stroke();
    c.strokeStyle='rgba(200,30,30,.45)';c.beginPath();c.moveTo(3,3);c.lineTo(11,11);c.moveTo(11,3);c.lineTo(3,11);c.moveTo(31,31);c.lineTo(39,39);c.moveTo(39,31);c.lineTo(31,39);c.moveTo(17,3);c.lineTo(25,11);c.moveTo(25,3);c.lineTo(17,11);c.stroke();
    c.strokeStyle=ink;c.beginPath();c.arc(21,21,4.5,0,TAU);c.stroke();c.beginPath();c.arc(7,35,4.5,0,TAU);c.stroke();c.restore();
    c.save();c.translate(W.w*.1,W.h*.42);c.strokeStyle=gr;c.lineWidth=.6;c.strokeRect(0,0,14,14);c.strokeRect(6,-6,14,14);c.beginPath();c.moveTo(0,0);c.lineTo(6,-6);c.moveTo(14,0);c.lineTo(20,-6);c.moveTo(0,14);c.lineTo(6,8);c.moveTo(14,14);c.lineTo(20,8);c.stroke();c.restore();
    c.save();c.translate(W.w*.86,W.h*.52);c.strokeStyle=ink;c.lineWidth=.6;c.beginPath();for(let i=0;i<=10;i++){const a=-Math.PI/2+i*Math.PI*.8,d=i%2?3.5:9;i?c.lineTo(Math.cos(a)*d,Math.sin(a)*d):c.moveTo(Math.cos(a)*d,Math.sin(a)*d);}c.stroke();c.restore();
    hand(c,'E = mc²',W.w*.48,W.h*.93,9,gr,-.06);scrawl(c,W.w*.08,W.h*.94,60,6,rnd,gr,.5);
    inkBlot(c,W.w*.38,W.h*.33,5,rnd);coffeeRing(c,W.w*.6,W.h*.6,30,rnd,.22);
    c.fillStyle='rgba(30,60,140,.3)';for(let i=0;i<8;i++){c.beginPath();c.arc(W.w*(.1+rnd()*.8),W.h*(.1+rnd()*.8),.6+rnd()*1.6,0,TAU);c.fill();}
    sticky(c,W.w*.7,W.h*.79,.08,64,'#ffe66d',['DON’T','FALL!'],'rgba(30,60,140,.8)',k);
  }else if(id==='library'){
    const lg=c.createRadialGradient(W.w*.1,W.h*.06,10,W.w*.1,W.h*.06,Math.max(W.w,W.h)*.85);lg.addColorStop(0,'rgba(255,214,150,.14)');lg.addColorStop(1,'rgba(255,214,150,0)');c.fillStyle=lg;c.fillRect(0,0,W.w,W.h);
    const [cx,cy]=spot(W,[[.66,.85],[.4,.85],[.5,.15]],46);paperSheet(c,cx,cy,.18,84,52,k,'#f3ead2');
    c.strokeStyle='rgba(120,90,40,.4)';c.lineWidth=.5;for(let y=-12;y<26;y+=7.5){c.beginPath();c.moveTo(-38,y);c.lineTo(38,y);c.stroke();}c.beginPath();c.moveTo(-6,-12);c.lineTo(-6,26);c.stroke();
    c.fillStyle='rgba(120,30,30,.75)';c.font='800 6px Rubik,sans-serif';c.textAlign='left';c.fillText('LIBRARY CARD',-38,-17);c.font='700 3.4px Rubik,sans-serif';c.fillStyle='rgba(80,60,30,.7)';c.fillText('DATE DUE',-38,-13.6);c.fillText('BORROWER',-3,-13.6);
    [['12 MAR',-36,-6.5],['02 APR',-36,1],['19 MAY',-36,8.5]].forEach(([t,x,y],i)=>{c.save();c.translate(x+14,y-2);c.rotate((rnd()-.5)*.2);c.fillStyle=i===1?'rgba(170,40,60,.6)':'rgba(90,50,140,.55)';c.font='800 5px "Courier New",monospace';c.textAlign='center';c.fillText(t,0,0);c.restore();});
    hand(c,'A. Lovelace',0,-6,5.5,'rgba(30,50,120,.7)');c.restore();
    const [rx,ry]=spot(W,[[.42,.2],[.6,.25],[.3,.8]],40);coffeeRing(c,rx,ry,33,rnd,.26);inkBlot(c,W.w*.88,W.h*.9,3.5,rnd);
  }else if(id==='office'){
    const [rx,ry]=spot(W,[[.72,.2],[.3,.2],[.5,.8]],44);coffeeRing(c,rx,ry,32,rnd,.22);
    const [sx2,sy2]=spot(W,[[.12,.78],[.2,.85],[.5,.88]],40);sticky(c,sx2,sy2,-.12,60,'#7dd3fc',['Q3 goals:','• win','• win more'],'rgba(10,30,60,.8)',k);
    const [bx,by]=spot(W,[[.72,.86],[.55,.88],[.4,.12]],34);paperSheet(c,bx,by,-.06,54,32,k,'#fafafa');c.fillStyle='rgba(20,30,50,.9)';c.font='800 5px Rubik,sans-serif';c.textAlign='left';c.fillText('ALEX SMITH',-22,-4);
    c.font='600 3.2px Rubik,sans-serif';c.fillStyle='rgba(20,30,50,.6)';c.fillText('Chief Flicking Officer',-22,1);c.fillText('alex@deskduel.example',-22,8);c.fillStyle='#3b82f6';c.fillRect(17,-11,6,22);c.restore();
  }else if(id==='artroom'){
    const [sx2,sy2]=spot(W,[[.35,.2],[.5,.18],[.4,.85]],52);paperSheet(c,sx2,sy2,-.08,80,58,k);
    c.strokeStyle='rgba(60,60,70,.55)';c.lineWidth=.45;c.beginPath();c.moveTo(-30,8);c.lineTo(22,-12);c.lineTo(25,-8);c.lineTo(-27,12);c.closePath();c.moveTo(22,-12);c.lineTo(30,-15);c.lineTo(25,-8);c.stroke();
    for(let i=0;i<12;i++){c.beginPath();c.moveTo(-24+i*4,14);c.lineTo(-20+i*4,18);c.stroke();}hand(c,'study #3',-32,-16,5,'rgba(60,60,70,.6)');c.restore();
    tape(c,sx2-38,sy2-24,-.6,16,6);tape(c,sx2+38,sy2+26,-.5,16,6);tape(c,W.w*.78,W.h*.9,.3,34,8);
  }else if(id==='study'){
    const [ex,ey]=spot(W,[[.5,.82],[.5,.18],[.3,.85]],44);paperSheet(c,ex,ey,-.1,78,48,k,'#efe4c8');
    c.strokeStyle='rgba(120,90,50,.35)';c.lineWidth=.5;c.beginPath();c.moveTo(-39,-24);c.lineTo(0,2);c.lineTo(39,-24);c.stroke();scrawl(c,-14,10,30,4,rnd,'rgba(40,30,70,.5)',.35);scrawl(c,-14,16,24,4,rnd,'rgba(40,30,70,.5)',.35);
    const wg=c.createRadialGradient(-1,0,1,0,2,7);wg.addColorStop(0,'#d23a3a');wg.addColorStop(1,'#7f1010');blob(c,0,2,6.5,rnd,10,.3);c.fillStyle=wg;c.fill();c.strokeStyle='rgba(60,0,0,.5)';c.lineWidth=.5;c.beginPath();c.arc(0,2,4,0,TAU);c.stroke();
    c.fillStyle='rgba(255,220,220,.4)';c.font='700 5px Georgia,serif';c.textAlign='center';c.textBaseline='middle';c.fillText('C',0,2.2);c.restore();
    inkBlot(c,W.w*.36,W.h*.36,3.4,rnd,'rgba(10,14,40,');inkBlot(c,W.w*.3,W.h*.62,2.2,rnd,'rgba(10,14,40,');
  }else if(id==='boardroom'){
    const [ax,ay]=spot(W,[[.64,.82],[.6,.2],[.36,.84]],56);paperSheet(c,ax,ay,.06,80,104,k);
    c.fillStyle='rgba(20,24,34,.88)';c.font='800 7px Rubik,sans-serif';c.textAlign='left';c.fillText('AGENDA',-32,-36);c.font='600 3.6px Rubik,sans-serif';c.fillStyle='rgba(20,24,34,.55)';c.fillText('BOARD MEETING · 09:00',-32,-30);
    for(let i=0;i<7;i++){c.fillStyle='rgba(20,24,34,.6)';c.fillText(`${i+1}.`,-32,-18+i*8);c.fillStyle='rgba(20,24,34,.2)';c.fillRect(-26,-19.4+i*8,40+((i*37)%22),1.1);}
    c.restore();paperClip(c,ax-24,ay-50,.12,14);
    const [rx,ry]=spot(W,[[.72,.32],[.3,.3],[.5,.7]],36);coffeeRing(c,rx,ry,28,rnd,.16);
  }
}

/* ---------- obstacles: footprint = top face; the body is swept towards the viewer by its height ---------- */
function obsShadow(c,k){c.shadowColor='rgba(0,0,0,.5)';c.shadowBlur=9*k;c.shadowOffsetX=3*k;c.shadowOffsetY=6*k;}
function noShadow(c){c.shadowColor='transparent';c.shadowBlur=0;c.shadowOffsetX=0;c.shadowOffsetY=0;}
// shadow only (the shape itself is drawn far off and its shadow is pulled back into place); offsets in mm
function dropShadow(c,k,path,a=.5,b=9,ox=3,oy=6){c.save();const m=c.getTransform(),far=4000;c.shadowColor=`rgba(0,0,0,${a})`;c.shadowBlur=b*k;
  c.shadowOffsetX=far*m.a+ox*k;c.shadowOffsetY=far*m.b+oy*k;c.translate(-far,0);path();c.fillStyle='#000';c.fill();c.restore();}
function boxPath(c,o,dy=0,inset=0){c.save();c.translate(o.x,o.y+dy);c.rotate(o.a);rr(c,-o.sw/2+inset,-o.sh/2+inset,o.sw-2*inset,o.sh-2*inset,Math.max(0,o.rr-inset));c.restore();}
function circPath(c,o,dy=0,r=o.r){c.beginPath();c.arc(o.x,o.y+dy,r,0,TAU);}
function sweep(c,t,path,fill){const n=Math.max(2,Math.ceil(t/.45));for(let i=n;i>=1;i--){const f=i/n;path(t*f);c.fillStyle=fill(f);c.fill();}}
function boxCorners(o){const ca=Math.cos(o.a),sa=Math.sin(o.a),w=o.sw/2,h=o.sh/2;return [[-w,-h],[w,-h],[w,h],[-w,h]].map(([x,y])=>[o.x+x*ca-y*sa,o.y+x*sa+y*ca]);}
// visible side faces of a box: fn(i, a, b) for each edge whose face looks towards the viewer (edge 3 = local left)
function boxFaces(o,fn){const P=boxCorners(o);for(let i=0;i<4;i++){const a=P[i],b=P[(i+1)%4];if(a[0]-b[0]>.01)fn(i,a,b);}}
function faceQuad(c,a,b,t0,t1){c.beginPath();c.moveTo(a[0],a[1]+t0);c.lineTo(b[0],b[1]+t0);c.lineTo(b[0],b[1]+t1);c.lineTo(a[0],a[1]+t1);c.closePath();}
function hgrad(c,o,r,a,b,d){const g=c.createLinearGradient(o.x-r,0,o.x+r,0);g.addColorStop(0,a);g.addColorStop(.35,b);g.addColorStop(1,d);return g;}
const BOOK_TITLES={'#9a3412':['WORLD ATLAS','ATLAS'],'#1e40af':['POETRY','POEMS'],'#14532d':['ENCYCLOPÆDIA','VOL. IX']};
function obBook(c,o,k){const w=o.sw,h=o.sh,col=o.c||'#7c2d12',tome=w*h>11000,t=tome?8:6,[title,short]=BOOK_TITLES[o.c]||['NOTES','NOTES'];
  dropShadow(c,k,()=>boxPath(c,o,t*.7),.5,10,3.5,6.5);dropShadow(c,k,()=>boxPath(c,o,t),.5,1.8,.4,.8);
  sweep(c,t,dy=>boxPath(c,o,dy),f=>mix('#efe6cf','#c8b995',f));
  boxFaces(o,(i,a,b)=>{if(i===3){faceQuad(c,a,b,0,t);c.fillStyle=shade(col,-.35);c.fill();return;}
    faceQuad(c,a,b,1,t-1);c.fillStyle=tome?'rgba(214,170,70,.55)':'rgba(255,250,235,.25)';c.fill();
    c.strokeStyle='rgba(120,100,70,.3)';c.lineWidth=.22;for(let j=1;j<6;j++){const y=1+(t-2)*j/6;c.beginPath();c.moveTo(a[0],a[1]+y);c.lineTo(b[0],b[1]+y);c.stroke();}
    c.strokeStyle=shade(col,-.2);c.lineWidth=1.1;c.beginPath();c.moveTo(a[0],a[1]+t-.5);c.lineTo(b[0],b[1]+t-.5);c.stroke();});
  c.save();c.translate(o.x,o.y);c.rotate(o.a);
  c.fillStyle='#b91c1c';c.beginPath();c.moveTo(w*.12,h/2-2);c.lineTo(w*.12+2.6,h/2-2);c.lineTo(w*.12+2.6,h/2+6.5);c.lineTo(w*.12+1.3,h/2+5);c.lineTo(w*.12,h/2+6.5);c.closePath();c.fill();
  const g=c.createLinearGradient(-w/2,-h/2,w/2,h/2);g.addColorStop(0,shade(col,.16));g.addColorStop(.6,col);g.addColorStop(1,shade(col,-.24));rr(c,-w/2,-h/2,w,h,2.2);c.fillStyle=g;c.fill();
  c.save();c.clip();const rnd=mulberry(hashStr(col)+o.oi);for(let i=0;i<5;i++){const x=(rnd()-.5)*w,y=(rnd()-.5)*h,rad=10+rnd()*24,bg=c.createRadialGradient(x,y,0,x,y,rad);bg.addColorStop(0,`rgba(0,0,0,${.05+rnd()*.05})`);bg.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=bg;c.fillRect(x-rad,y-rad,rad*2,rad*2);}
  for(let i=0;i<260;i++){c.fillStyle=rnd()<.5?'rgba(0,0,0,.07)':'rgba(255,255,255,.05)';c.fillRect((rnd()-.5)*w,(rnd()-.5)*h,.5,.5);}
  for(const [x,y] of [[w/2,-h/2],[w/2,h/2]]){const cg=c.createRadialGradient(x,y,0,x,y,7);cg.addColorStop(0,'rgba(255,240,220,.28)');cg.addColorStop(1,'rgba(255,240,220,0)');c.fillStyle=cg;c.fillRect(x-7,y-7,14,14);}c.restore();
  const sw=Math.min(14,w*.13),sg=c.createLinearGradient(-w/2,0,-w/2+sw,0);sg.addColorStop(0,shade(col,-.6));sg.addColorStop(.4,shade(col,-.22));sg.addColorStop(1,shade(col,-.42));
  c.fillStyle=sg;rr(c,-w/2,-h/2,sw,h,2.2);c.fill();c.fillStyle='rgba(0,0,0,.4)';c.fillRect(-w/2+sw,-h/2,.8,h);c.fillStyle='rgba(255,255,255,.12)';c.fillRect(-w/2+sw+.8,-h/2,.6,h);
  for(const f of [.1,.27,.73,.9]){const y=-h/2+h*f;c.fillStyle='rgba(255,255,255,.14)';c.fillRect(-w/2,y-1.2,sw,.9);c.fillStyle='rgba(0,0,0,.3)';c.fillRect(-w/2,y,sw,.9);c.fillStyle='rgba(222,180,80,.75)';c.fillRect(-w/2+1.5,y+1.6,sw-3,.45);}
  c.save();c.translate(-w/2+sw/2,0);c.rotate(-Math.PI/2);c.font=`800 ${sw*.42}px Georgia,serif`;c.textAlign='center';c.textBaseline='middle';const sm=c.measureText(short).width;if(sm>h*.4)c.scale(h*.4/sm,1);
  c.fillStyle='rgba(0,0,0,.4)';c.fillText(short,.3,.4);c.fillStyle='#e7c26a';c.fillText(short,0,0);c.restore();
  const cx=(sw)/2,gold='rgba(226,184,86,.8)';c.strokeStyle='rgba(0,0,0,.3)';c.lineWidth=.8;rr(c,-w/2+sw+5.3,-h/2+5.3,w-sw-10,h-10,1.5);c.stroke();
  c.strokeStyle=gold;c.lineWidth=.7;rr(c,-w/2+sw+5,-h/2+5,w-sw-10,h-10,1.5);c.stroke();c.lineWidth=.35;rr(c,-w/2+sw+7.2,-h/2+7.2,w-sw-14.4,h-14.4,1);c.stroke();
  for(const [x,y] of [[-w/2+sw+7.2,-h/2+7.2],[w/2-7.2,-h/2+7.2],[-w/2+sw+7.2,h/2-7.2],[w/2-7.2,h/2-7.2]]){c.beginPath();c.moveTo(x,y-2);c.lineTo(x+2,y);c.lineTo(x,y+2);c.lineTo(x-2,y);c.closePath();c.fillStyle=gold;c.fill();}
  const fs=Math.min(h*.13,(w-sw)*.13);c.font=`700 ${fs}px Georgia,"Times New Roman",serif`;c.textAlign='center';c.textBaseline='middle';const tm=c.measureText(title).width,fit=Math.min(1,(w-sw-22)/tm);
  c.save();c.translate(cx,-fs*.3);c.scale(fit,1);c.fillStyle='rgba(0,0,0,.45)';c.fillText(title,.35,.45);const tg=c.createLinearGradient(0,-fs/2,0,fs/2);tg.addColorStop(0,'#fbe3a0');tg.addColorStop(.6,'#d7a645');tg.addColorStop(1,'#a87a22');c.fillStyle=tg;c.fillText(title,0,0);c.restore();
  c.fillStyle=gold;c.fillRect(cx-fs*1.2,fs*.55,fs*2.4,.5);c.font=`600 ${fs*.38}px Georgia,serif`;c.fillText(tome?'FIRST EDITION':'ILLUSTRATED',cx,fs*1.05);
  c.restore();}
function obEraser(c,o,k){const w=o.sw,h=o.sh,t=4;
  dropShadow(c,k,()=>boxPath(c,o,t*.6),.45,6,2.5,4.5);dropShadow(c,k,()=>boxPath(c,o,t),.5,1.6,.3,.8);
  sweep(c,t,dy=>boxPath(c,o,dy),f=>mix('#eeece5','#c4c1b6',f));
  const P=boxCorners(o),lerpP=(a,b,f)=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
  boxFaces(o,(i,a,b)=>{if(i===0||i===2){const f0=i===0?.2:.2,f1=.8;faceQuad(c,lerpP(a,b,f0),lerpP(a,b,f1),0,t);c.fillStyle='#1e3a8a';c.fill();}});
  c.save();c.translate(o.x,o.y);c.rotate(o.a);
  const g=c.createLinearGradient(0,-h/2,0,h/2);g.addColorStop(0,'#fbfaf6');g.addColorStop(1,'#dedbd1');rr(c,-w/2,-h/2,w,h,o.rr);c.fillStyle=g;c.fill();
  const sm=c.createRadialGradient(w/2-4,0,1,w/2-4,0,9);sm.addColorStop(0,'rgba(80,80,90,.32)');sm.addColorStop(1,'rgba(80,80,90,0)');c.save();rr(c,-w/2,-h/2,w,h,o.rr);c.clip();c.fillStyle=sm;c.fillRect(w/2-14,-h/2,14,h);c.restore();
  const sx=-w*.3-.3,sw=w*.6+.6,bg=c.createLinearGradient(0,-h/2,0,h/2);bg.addColorStop(0,'#3b6fe0');bg.addColorStop(.5,'#1d4ed8');bg.addColorStop(1,'#163a9e');
  c.fillStyle=bg;c.fillRect(sx,-h/2-.35,sw,h+.7);c.fillStyle='#f8fafc';c.fillRect(sx,-h*.2,sw,h*.4);c.fillStyle='#0f172a';c.fillRect(sx,-h*.2-.5,sw,.5);c.fillRect(sx,h*.2,sw,.5);
  c.fillStyle='#1e3a8a';c.font=`900 ${h*.26}px Rubik,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText('ERASER',0,.3);
  c.fillStyle='rgba(255,255,255,.85)';c.font=`800 ${h*.12}px Rubik,sans-serif`;c.fillText('PVC-FREE · DUST-FREE',0,-h*.34);
  c.fillStyle='rgba(255,255,255,.35)';c.fillRect(sx,-h/2-.35,sw,.6);c.fillStyle='rgba(0,0,0,.25)';c.fillRect(sx-.4,-h/2,.4,h);c.fillRect(sx+sw,-h/2,.4,h);
  c.fillStyle='rgba(255,255,255,.5)';c.fillRect(-w/2+2,-h/2+1.2,w*.18,1);c.restore();}
function obStapler(c,o,k){const w=o.sw,h=o.sh,t=7;
  dropShadow(c,k,()=>boxPath(c,o,t*.6),.55,10,3.5,6.5);dropShadow(c,k,()=>boxPath(c,o,t),.5,1.8,.4,.8);
  sweep(c,t,dy=>boxPath(c,o,dy),f=>mix('#2c323c','#0d1014',f));
  c.save();c.translate(o.x,o.y);c.rotate(o.a);
  const bg=c.createLinearGradient(-w/2,0,w/2,0);bg.addColorStop(0,'#3a414c');bg.addColorStop(.5,'#262b33');bg.addColorStop(1,'#15181d');rr(c,-w/2,-h/2,w,h,o.rr);c.fillStyle=bg;c.fill();
  c.fillStyle='#8b949f';rr(c,-w/2+8,-h/2+2.5,w-16,8,2);c.fill(); // anvil plate at the front
  c.save();c.shadowColor='rgba(0,0,0,.5)';c.shadowBlur=2*k;c.shadowOffsetX=.6*k;c.shadowOffsetY=1.2*k;
  const ag=c.createLinearGradient(-w/2+5,0,w/2-5,0);ag.addColorStop(0,'#59626e');ag.addColorStop(.18,'#e4e8ee');ag.addColorStop(.34,'#a3acb7');ag.addColorStop(.55,'#f2f5f8');ag.addColorStop(.78,'#7b8490');ag.addColorStop(1,'#3a414b');
  c.beginPath();c.moveTo(-w/2+9,-h/2+5);c.lineTo(w/2-9,-h/2+5);c.quadraticCurveTo(w/2-5,-h/2+12,w/2-5,-h/2+22);c.lineTo(w/2-5,h/2-14);c.lineTo(-w/2+5,h/2-14);c.lineTo(-w/2+5,-h/2+22);c.quadraticCurveTo(-w/2+5,-h/2+12,-w/2+9,-h/2+5);c.closePath();c.fillStyle=ag;c.fill();c.restore();
  c.fillStyle='rgba(255,255,255,.55)';c.fillRect(-w*.1,-h/2+16,1,h-34);c.fillStyle='rgba(0,0,0,.25)';c.fillRect(-w/2+6,-h/2+22,w-12,.5);
  const pg=c.createLinearGradient(0,0,0,30);pg.addColorStop(0,'#2b3038');pg.addColorStop(1,'#1a1e24');rr(c,-w/2+9,h/2-50,w-18,30,4);c.fillStyle=pg;c.fill();
  c.strokeStyle='rgba(255,255,255,.12)';c.lineWidth=.5;for(let y=h/2-47;y<h/2-22;y+=2.4){c.beginPath();c.moveTo(-w/2+11,y);c.lineTo(w/2-11,y);c.stroke();}
  const cg=c.createLinearGradient(-w/2,0,w/2,0);cg.addColorStop(0,'#242932');cg.addColorStop(.4,'#3c434e');cg.addColorStop(1,'#111419');rr(c,-w/2+3,h/2-16,w-6,14,6);c.fillStyle=cg;c.fill();
  for(const x of [-w/2+3.6,w/2-3.6]){c.beginPath();c.arc(x,h/2-9,2,0,TAU);c.fillStyle='#c3cad3';c.fill();c.beginPath();c.arc(x-.4,h/2-9.4,.7,0,TAU);c.fillStyle='#fff';c.fill();}
  c.save();c.translate(w*.16,-h*.06);c.rotate(-Math.PI/2);c.font='800 4.4px Rubik,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='rgba(255,255,255,.55)';c.fillText('HEAVY DUTY · HD-45',.3,.35);c.fillStyle='rgba(40,46,56,.75)';c.fillText('HEAVY DUTY · HD-45',0,0);c.restore();
  c.restore();}
function obRuler(c,o,k){const w=o.sw,h=o.sh,t=1.6;
  dropShadow(c,k,()=>boxPath(c,o,1),.26,5,2,4);boxPath(c,o,t);c.fillStyle='rgba(90,140,200,.45)';c.fill();
  c.save();c.translate(o.x,o.y);c.rotate(o.a);rr(c,-w/2,-h/2,w,h,o.rr);const g=c.createLinearGradient(0,-h/2,0,h/2);g.addColorStop(0,'rgba(200,228,255,.6)');g.addColorStop(.3,'rgba(160,205,250,.42)');g.addColorStop(1,'rgba(130,180,240,.5)');c.fillStyle=g;c.fill();
  c.save();c.clip();c.fillStyle='rgba(255,255,255,.22)';c.fillRect(-w/2,-h/2,w,3.2);c.save();c.rotate(-.5);const gl=c.createLinearGradient(-12,0,12,0);gl.addColorStop(0,'rgba(255,255,255,0)');gl.addColorStop(.5,'rgba(255,255,255,.28)');gl.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=gl;c.fillRect(-12,-w,24,w*2);c.restore();c.restore();
  c.strokeStyle='rgba(255,255,255,.6)';c.lineWidth=.35;rr(c,-w/2+.2,-h/2+.2,w-.4,h-.4,o.rr);c.stroke();
  c.fillStyle='rgba(12,26,56,.8)';const n=Math.floor(w-12);for(let i=0;i<=n;i++){const L=i%10===0?h*.42:i%5===0?h*.3:h*.17;c.fillRect(-w/2+5+i-.11,-h/2+.4,.22,L);}
  c.font=`700 ${h*.21}px Rubik,sans-serif`;c.textAlign='center';c.textBaseline='middle';for(let i=0;i<=n;i+=10)c.fillText(String(i/10),-w/2+5+i,-h/2+h*.62);
  c.font=`600 ${h*.15}px Rubik,sans-serif`;c.fillText('cm',-w/2+9.5,h/2-2.6);c.fillText('SHATTERPROOF',w/2-24,h/2-2.6);
  c.beginPath();c.arc(w/2-5,h*.15,1.8,0,TAU);c.strokeStyle='rgba(12,26,56,.55)';c.lineWidth=.4;c.stroke();c.restore();}
function obNameplate(c,o,k){const w=o.sw,h=o.sh,t=6;
  dropShadow(c,k,()=>boxPath(c,o,t*.6),.55,9,3,6);dropShadow(c,k,()=>boxPath(c,o,t),.5,1.6,.4,.8);
  sweep(c,t,dy=>boxPath(c,o,dy),f=>mix('#4a2a18','#1f0f07',f));
  c.save();c.translate(o.x,o.y);c.rotate(o.a);const g=c.createLinearGradient(0,-h/2,0,h/2);g.addColorStop(0,'#6a3e26');g.addColorStop(1,'#3a1f10');rr(c,-w/2,-h/2,w,h,o.rr);c.fillStyle=g;c.fill();
  c.save();c.clip();const rnd=mulberry(55);for(let i=0;i<14;i++){const y=-h/2+rnd()*h,a=.3+rnd()*.8,ph=rnd()*TAU;c.beginPath();for(let x=-w/2;x<=w/2;x+=6){const yy=y+Math.sin(x*.05+ph)*a;x===-w/2?c.moveTo(x,yy):c.lineTo(x,yy);}c.strokeStyle=`rgba(20,8,2,${.12+rnd()*.2})`;c.lineWidth=.3+rnd()*.5;c.stroke();}c.restore();
  c.strokeStyle='rgba(255,210,170,.25)';c.lineWidth=.8;c.beginPath();c.moveTo(-w/2+o.rr,-h/2+.5);c.lineTo(w/2-o.rr,-h/2+.5);c.stroke();
  const px0=-w/2+7,pw=w-14,ph=h-12,pg=c.createLinearGradient(0,-ph/2,0,ph/2);pg.addColorStop(0,'#f6d985');pg.addColorStop(.45,'#cfa046');pg.addColorStop(.55,'#e0b65c');pg.addColorStop(1,'#9c7020');
  c.save();c.shadowColor='rgba(0,0,0,.5)';c.shadowBlur=1.2*k;c.shadowOffsetY=.6*k;rr(c,px0,-ph/2,pw,ph,1.4);c.fillStyle=pg;c.fill();c.restore();
  c.save();rr(c,px0,-ph/2,pw,ph,1.4);c.clip();for(let y=-ph/2,i=0;y<ph/2;y+=.6,i++){c.fillStyle=i%2?'rgba(255,255,255,.07)':'rgba(90,60,10,.06)';c.fillRect(px0,y,pw,.3);}c.restore();
  c.strokeStyle='rgba(255,246,210,.7)';c.lineWidth=.4;rr(c,px0+.6,-ph/2+.6,pw-1.2,ph-1.2,1);c.stroke();
  for(const x of [px0+3.2,px0+pw-3.2]){c.beginPath();c.arc(x,0,1.1,0,TAU);c.fillStyle='#7a5618';c.fill();c.beginPath();c.moveTo(x-.8,.3);c.lineTo(x+.8,-.3);c.strokeStyle='rgba(255,240,200,.7)';c.lineWidth=.3;c.stroke();}
  c.font=`700 ${ph*.52}px Georgia,"Times New Roman",serif`;c.textAlign='center';c.textBaseline='middle';const tm=c.measureText('THE CHAIRMAN').width,f=Math.min(1,(pw-12)/tm);
  c.save();c.scale(f,1);c.fillStyle='rgba(255,246,210,.75)';c.fillText('THE CHAIRMAN',.35,.9);c.fillStyle='#3a2408';c.fillText('THE CHAIRMAN',0,.5);c.restore();c.restore();}
function obMug(c,o,k){const r=o.r,t=9,col=o.c||'#f1f5f9',rnd=mulberry(17+o.oi);
  const handle=(dy,hole=true)=>{c.beginPath();rra(c,o.x+r-7,o.y-9+dy,20,18,8);if(hole)rra(c,o.x+r+.5,o.y-4.3+dy,7.5,8.6,4.3);};
  dropShadow(c,k,()=>{circPath(c,o,t*.6);rra(c,o.x+r-7,o.y-9+t*.6,20,18,8);},.5,11,4,7);dropShadow(c,k,()=>{circPath(c,o,t);rra(c,o.x+r-7,o.y-9+t,20,18,8);},.5,2,.5,1);
  const hg=hgrad(c,o,r,shade(col,-.02),shade(col,-.08),shade(col,-.42)),hh=hgrad(c,{x:o.x+r+3},10,shade(col,-.08),shade(col,-.2),shade(col,-.5));
  for(let i=Math.ceil((t-2)/.45);i>=1;i--){handle(i*.45);c.fillStyle=hh;c.fill('evenodd');}
  sweep(c,t,dy=>circPath(c,o,dy),f=>f>.2&&f<.36?'#1e3a8a':hg);
  c.beginPath();const da=1.05;c.moveTo(o.x+Math.cos(da)*r-1.2,o.y+Math.sin(da)*r-1);c.lineTo(o.x+Math.cos(da)*r-1.2,o.y+Math.sin(da)*r+5);c.arc(o.x+Math.cos(da)*r,o.y+Math.sin(da)*r+5,1.2,Math.PI,0,true);c.lineTo(o.x+Math.cos(da)*r+1.4,o.y+Math.sin(da)*r-1);c.fillStyle='#5a3a22';c.fill();
  handle(0);const ht=c.createLinearGradient(o.x+r,o.y-9,o.x+r+6,o.y+9);ht.addColorStop(0,'#ffffff');ht.addColorStop(1,shade(col,-.22));c.fillStyle=ht;c.fill('evenodd');
  const rim=c.createRadialGradient(o.x-r*.35,o.y-r*.4,r*.1,o.x,o.y,r);rim.addColorStop(0,'#ffffff');rim.addColorStop(.75,shade(col,-.04));rim.addColorStop(1,shade(col,-.22));circPath(c,o);c.fillStyle=rim;c.fill();
  const wg=c.createLinearGradient(0,o.y-r,0,o.y+r);wg.addColorStop(0,shade(col,-.45));wg.addColorStop(.6,shade(col,-.1));wg.addColorStop(1,shade(col,-.02));circPath(c,o,0,r-4.2);c.fillStyle=wg;c.fill();
  const cf=c.createRadialGradient(o.x-r*.15,o.y,1,o.x,o.y+1.6,r-6.4);cf.addColorStop(0,'#7a5030');cf.addColorStop(.55,'#4a2d17');cf.addColorStop(1,'#26160a');circPath(c,{x:o.x,y:o.y+1.6},0,r-6.4);c.fillStyle=cf;c.fill();
  c.strokeStyle='rgba(200,150,100,.35)';c.lineWidth=1;c.stroke();
  for(let i=0;i<14;i++){const a=rnd()*TAU,d=(r-8)*(.8+rnd()*.18);c.beginPath();c.arc(o.x+Math.cos(a)*d,o.y+1.6+Math.sin(a)*d,.3+rnd()*.7,0,TAU);c.strokeStyle='rgba(230,190,140,.35)';c.lineWidth=.25;c.stroke();}
  c.beginPath();c.ellipse(o.x-r*.32,o.y-r*.18,r*.22,r*.1,-.5,0,TAU);c.fillStyle='rgba(255,255,255,.18)';c.fill();
  c.strokeStyle='rgba(255,255,255,.85)';c.lineWidth=1.1;c.beginPath();c.arc(o.x,o.y,r-2,-2.75,-1.45);c.stroke();c.strokeStyle='rgba(0,0,0,.12)';c.lineWidth=.5;circPath(c,o,0,r-4.2);c.stroke();}
function obJar(c,o,k){const r=o.r,t=7,col=o.c||'#ef4444',open=o.oi%2===1,rnd=mulberry(31+o.oi);
  dropShadow(c,k,()=>circPath(c,o,t*.6),.5,9,3,6);dropShadow(c,k,()=>circPath(c,o,t),.5,1.8,.4,.8);
  const pg=hgrad(c,o,r,shade(col,.1),col,shade(col,-.55)),lg=hgrad(c,o,r,'#ffffff','#eef2f6','#9aa3ae');
  sweep(c,t,dy=>circPath(c,o,dy),f=>f>.25&&f<.6?lg:pg);
  for(let i=0;i<3;i++){const a=.35+rnd()*2.4,x=o.x+Math.cos(a)*r,y=o.y+Math.sin(a)*r,l=3+rnd()*5,w=1.2+rnd()*1.2;c.beginPath();c.moveTo(x-w,y-1);c.lineTo(x-w*.8,y+l);c.arc(x,y+l,w*.8,Math.PI,0,true);c.lineTo(x+w,y-1);c.fillStyle=shade(col,.08);c.fill();}
  if(!open){const g=c.createRadialGradient(o.x-r*.3,o.y-r*.35,r*.1,o.x,o.y,r);g.addColorStop(0,shade(col,.4));g.addColorStop(.6,col);g.addColorStop(1,shade(col,-.4));circPath(c,o);c.fillStyle=g;c.fill();
    c.strokeStyle='rgba(0,0,0,.28)';c.lineWidth=.45;c.beginPath();for(let a=0;a<TAU;a+=.13){c.moveTo(o.x+Math.cos(a)*(r-2.4),o.y+Math.sin(a)*(r-2.4));c.lineTo(o.x+Math.cos(a)*r,o.y+Math.sin(a)*r);}c.stroke();
    c.strokeStyle='rgba(255,255,255,.3)';c.lineWidth=.6;circPath(c,o,0,r-3.6);c.stroke();
    c.fillStyle='rgba(255,255,255,.7)';c.font=`800 ${r*.32}px Rubik,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText('ACRYLIC',o.x,o.y+1);c.font=`700 ${r*.17}px Rubik,sans-serif`;c.fillText('250 ml',o.x,o.y+r*.36);
    for(const sc of ['#facc15','#3b82f6','#ffffff']){c.beginPath();c.arc(o.x+(rnd()-.5)*r,o.y+(rnd()-.5)*r,.5+rnd()*1.2,0,TAU);c.fillStyle=sc;c.fill();}
    blob(c,o.x+r*.68,o.y+r*.62,3.2,rnd,10,.5);c.fillStyle=shade(col,.06);c.fill();
  }else{circPath(c,o);c.fillStyle='#e8edf2';c.fill();c.strokeStyle='rgba(0,0,0,.18)';c.lineWidth=.4;for(const d of [1,2]){circPath(c,o,0,r-d);c.stroke();}
    const g=c.createRadialGradient(o.x-r*.25,o.y-r*.3,r*.1,o.x,o.y,r-3);g.addColorStop(0,shade(col,.35));g.addColorStop(.6,col);g.addColorStop(1,shade(col,-.35));circPath(c,o,0,r-3);c.fillStyle=g;c.fill();
    c.lineCap='round';for(let i=0;i<4;i++){c.beginPath();c.arc(o.x+(rnd()-.5)*6,o.y+(rnd()-.5)*6,4+rnd()*(r-10),rnd()*TAU,rnd()*TAU+1.5);c.strokeStyle=i%2?shade(col,.3):shade(col,-.2);c.lineWidth=.8;c.stroke();}
    c.beginPath();c.ellipse(o.x-r*.3,o.y-r*.32,r*.22,r*.1,-.6,0,TAU);c.fillStyle='rgba(255,255,255,.4)';c.fill();
    c.beginPath();c.arc(o.x,o.y,r-1.4,.4,1.6);c.strokeStyle=col;c.lineWidth=1.6;c.stroke();}
  c.strokeStyle='rgba(255,255,255,.6)';c.lineWidth=.8;c.beginPath();c.arc(o.x,o.y,r-.8,-2.7,-1.6);c.stroke();}
function obCup(c,o,k){const r=o.r,t=9,rnd=mulberry(91+o.oi*7);
  dropShadow(c,k,()=>circPath(c,o,t*.6),.55,10,3.5,6.5);dropShadow(c,k,()=>circPath(c,o,t),.5,2,.4,.9);
  sweep(c,t,dy=>circPath(c,o,dy),()=>hgrad(c,o,r,'#4a3528','#2e2119','#120c08'));
  c.setLineDash([1.4,1.2]);c.strokeStyle='rgba(225,200,170,.5)';c.lineWidth=.4;circPath(c,o,2.2,r-.6);c.stroke();circPath(c,o,t-2,r-.6);c.stroke();c.setLineDash([]);
  const rg=c.createRadialGradient(o.x-r*.3,o.y-r*.3,r*.2,o.x,o.y,r);rg.addColorStop(0,'#6b4c39');rg.addColorStop(1,'#2a1d15');circPath(c,o);c.fillStyle=rg;c.fill();
  c.setLineDash([1.4,1.2]);c.strokeStyle='rgba(225,200,170,.6)';c.lineWidth=.4;circPath(c,o,0,r-1.2);c.stroke();c.setLineDash([]);
  const ig=c.createRadialGradient(o.x,o.y+2,1,o.x,o.y,r-2.4);ig.addColorStop(0,'#1a1210');ig.addColorStop(1,'#050303');circPath(c,o,0,r-2.4);c.fillStyle=ig;c.fill();
  const items=[['#1e3a8a','pen'],['#f6c418','pencil'],['#b91c1c','pen'],['#facc15','hl'],['#111827','pen']],base=rnd()*TAU,P=[];
  items.forEach((it,i)=>{const a=base+i*TAU/items.length+(rnd()-.5)*.35,d=r*(.38+rnd()*.16);P.push([it,a,d]);});
  P.sort((p,q)=>Math.sin(p[1])*p[2]-Math.sin(q[1])*q[2]);
  for(const [[col,kind],a,d] of P){const ex=o.x+Math.cos(a)*d,ey=o.y+Math.sin(a)*d,bx=o.x+Math.cos(a)*d*.55,by=o.y+Math.sin(a)*d*.55,rad=kind==='hl'?4.4:kind==='pencil'?3:3.3;
    c.lineCap='round';c.beginPath();c.moveTo(bx,by);c.lineTo(ex,ey);c.strokeStyle=shade(col,-.35);c.lineWidth=rad*2;c.stroke();c.strokeStyle=shade(col,.1);c.lineWidth=rad*.9;c.stroke();
    const eg=c.createRadialGradient(ex-rad*.3,ey-rad*.35,.2,ex,ey,rad);
    if(kind==='pencil'){eg.addColorStop(0,'#ffc4d0');eg.addColorStop(1,'#d66d86');c.beginPath();c.arc(ex,ey,rad+.5,0,TAU);c.fillStyle='#c3c9d1';c.fill();}
    else{eg.addColorStop(0,shade(col,.55));eg.addColorStop(1,shade(col,-.3));}
    c.beginPath();c.arc(ex,ey,rad,0,TAU);c.fillStyle=eg;c.fill();}
  c.strokeStyle='rgba(255,230,200,.25)';c.lineWidth=.8;c.beginPath();c.arc(o.x,o.y,r-.6,-2.8,-1.5);c.stroke();}
function obInkwell(c,o,k){const r=o.r,t=8;
  dropShadow(c,k,()=>circPath(c,o,t*.6),.4,10,3.5,6.5);dropShadow(c,k,()=>circPath(c,o,t),.45,2,.4,.9);
  const cx=o.x+r*.55,cy=o.y+r*.95,cg=c.createRadialGradient(cx,cy,0,cx,cy,r*.75);cg.addColorStop(0,'rgba(150,180,255,.28)');cg.addColorStop(1,'rgba(150,180,255,0)');c.fillStyle=cg;c.fillRect(cx-r,cy-r,r*2,r*2);
  sweep(c,t,dy=>circPath(c,o,dy),()=>hgrad(c,o,r,'#3c4f7a','#1b2744','#070b16'));
  c.strokeStyle='rgba(200,220,255,.18)';c.lineWidth=.4;for(let a=.2;a<Math.PI-.1;a+=.32){c.beginPath();c.moveTo(o.x+Math.cos(a)*r,o.y+Math.sin(a)*r);c.lineTo(o.x+Math.cos(a)*r,o.y+Math.sin(a)*r+t);c.stroke();}
  const g=c.createRadialGradient(o.x-r*.4,o.y-r*.4,r*.1,o.x,o.y,r);g.addColorStop(0,'#5a6f9e');g.addColorStop(.5,'#1f2d4f');g.addColorStop(1,'#0a1020');circPath(c,o);c.fillStyle=g;c.fill();
  for(let i=0;i<16;i++){const a0=i/16*TAU,a1=(i+1)/16*TAU;c.beginPath();c.moveTo(o.x+Math.cos(a0)*r*.5,o.y+Math.sin(a0)*r*.5);c.lineTo(o.x+Math.cos(a0)*r,o.y+Math.sin(a0)*r);c.lineTo(o.x+Math.cos(a1)*r,o.y+Math.sin(a1)*r);c.lineTo(o.x+Math.cos(a1)*r*.5,o.y+Math.sin(a1)*r*.5);c.closePath();
    const lit=Math.cos(a0+.4-Math.PI*1.25);c.fillStyle=lit>0?`rgba(200,220,255,${.05+lit*.12})`:`rgba(0,0,0,${-lit*.18})`;c.fill();c.strokeStyle='rgba(210,225,255,.16)';c.lineWidth=.3;c.stroke();}
  c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=1.6;c.beginPath();c.arc(o.x,o.y,r-2,3.5,4.5);c.stroke();
  for(const [x,y,s] of [[-.55,-.35,1.1],[-.2,-.72,.7],[.5,-.5,.5]]){c.beginPath();c.arc(o.x+x*r,o.y+y*r,s,0,TAU);c.fillStyle='rgba(255,255,255,.75)';c.fill();}
  const bg=c.createLinearGradient(o.x-r*.5,o.y-r*.5,o.x+r*.5,o.y+r*.5);bg.addColorStop(0,'#f5d98c');bg.addColorStop(.4,'#c39236');bg.addColorStop(.7,'#e6c26c');bg.addColorStop(1,'#7c5618');
  c.save();c.shadowColor='rgba(0,0,0,.5)';c.shadowBlur=1.5*k;c.shadowOffsetY=.8*k;circPath(c,o,0,r*.48);c.fillStyle=bg;c.fill();c.restore();
  c.strokeStyle='rgba(90,60,10,.5)';c.lineWidth=.4;circPath(c,o,0,r*.42);c.stroke();
  const ig=c.createRadialGradient(o.x-r*.1,o.y-r*.12,.4,o.x,o.y,r*.33);ig.addColorStop(0,'#1d2a4a');ig.addColorStop(1,'#020309');circPath(c,o,0,r*.33);c.fillStyle=ig;c.fill();
  c.beginPath();c.ellipse(o.x-r*.1,o.y-r*.12,r*.12,r*.05,-.5,0,TAU);c.fillStyle='rgba(255,255,255,.3)';c.fill();}
function drawObstacle(c,o,k){
  c.save();
  switch(o.k){
    case 'book':obBook(c,o,k);break;
    case 'eraser':obEraser(c,o,k);break;
    case 'stapler':obStapler(c,o,k);break;
    case 'ruler':obRuler(c,o,k);break;
    case 'nameplate':obNameplate(c,o,k);break;
    case 'mug':obMug(c,o,k);break;
    case 'jar':obJar(c,o,k);break;
    case 'cup':obCup(c,o,k);break;
    case 'inkwell':obInkwell(c,o,k);break;
    default:if(o.t==='box'){dropShadow(c,k,()=>boxPath(c,o,3),.5,8,3,6);boxPath(c,o);c.fillStyle=o.c||'#64748b';c.fill();}
      else{dropShadow(c,k,()=>circPath(c,o,3),.5,8,3,6);circPath(c,o);c.fillStyle=o.c||'#64748b';c.fill();}
  }
  c.restore();
}
// The finished desk (surface, decorations, obstacles) is kept per arena/size/transform, so the
// redraw that every new round triggers is a single blit instead of a full repaint.
const DESK_PIX={key:'',cnv:null,x:0,y:0};
function drawDeskTop(c,W,arena,k){
  const m=c.getTransform(),live=c.canvas===LAYERS.desk,key=[arena.id,W.w,W.h,m.a.toFixed(4),m.e.toFixed(2),m.f.toFixed(2),c.canvas.width,c.canvas.height,SPR.gen].join('|');
  if(live&&DESK_PIX.key===key&&DESK_PIX.cnv){c.save();c.setTransform(1,0,0,1,0,0);c.drawImage(DESK_PIX.cnv,DESK_PIX.x,DESK_PIX.y);c.restore();return;}
  if(live){const pad=6,x0=Math.floor(m.e+(-pad)*m.a),y0=Math.floor(m.f+(-pad)*m.d),x1=Math.ceil(m.e+(W.w+pad)*m.a),y1=Math.ceil(m.f+(W.h+11+pad)*m.d);
    const cnv=document.createElement('canvas');cnv.width=Math.max(1,x1-x0);cnv.height=Math.max(1,y1-y0);const d=cnv.getContext('2d');d.setTransform(m.a,m.b,m.c,m.d,m.e-x0,m.f-y0);
    paintDesk(d,W,arena,k);Object.assign(DESK_PIX,{key,cnv,x:x0,y:y0});c.save();c.setTransform(1,0,0,1,0,0);c.drawImage(cnv,x0,y0);c.restore();return;}
  paintDesk(c,W,arena,k);
}
function paintDesk(c,W,arena,k){
  const rnd=mulberry(hashStr(arena.id)),th=11,mat=arena.mat;
  deskSide(c,W,mat,th,mulberry(hashStr(arena.id+'|side')));
  c.save();rr(c,0,0,W.w,W.h,W.cr);c.clip();
  (SURF[mat]||SURF.oak)(c,W,rnd,k);decorate(c,W,arena,rnd,k);
  const e=22,sides=[[0,0,W.w,e,0,0,0,e],[0,W.h-e,W.w,e,0,W.h,0,W.h-e],[0,0,e,W.h,0,0,e,0],[W.w-e,0,e,W.h,W.w,0,W.w-e,0]];
  for(const [x,y,w,h,x0,y0,x1,y1] of sides){const g=c.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,'rgba(0,0,0,.16)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(x,y,w,h);}
  const lg=c.createRadialGradient(W.w*.2,W.h*.1,20,W.w*.4,W.h*.4,Math.max(W.w,W.h)*1.05);lg.addColorStop(0,'rgba(255,250,235,.06)');lg.addColorStop(1,'rgba(0,0,0,.1)');c.fillStyle=lg;c.fillRect(0,0,W.w,W.h);
  c.restore();
  const bg=c.createLinearGradient(0,0,W.w,W.h);bg.addColorStop(0,'rgba(255,255,255,.45)');bg.addColorStop(.5,'rgba(255,255,255,.18)');bg.addColorStop(1,'rgba(255,255,255,.08)');
  c.strokeStyle=bg;c.lineWidth=1.4;rr(c,.7,.7,W.w-1.4,W.h-1.4,W.cr-.7);c.stroke();
  c.strokeStyle='rgba(255,255,255,.22)';c.lineWidth=.6;c.beginPath();c.moveTo(W.cr,W.h+.3);c.lineTo(W.w-W.cr,W.h+.3);c.stroke();
  for(const o of W.obs)drawObstacle(c,o,k);
}
function drawDeskPreview(cnv,arenaId){
  const a=ARENA(arenaId),r=cnv.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1),w=Math.max(10,r.width),h=Math.max(10,r.height);
  cnv.width=w*d;cnv.height=h*d;const c=cnv.getContext('2d');c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,h);
  const W=makeWorld(a,true),k=Math.min((w-12)/W.w,(h-14)/(W.h+11));
  c.translate((w-W.w*k)/2,(h-(W.h+11)*k)/2);c.scale(k,k);
  c.save();c.shadowColor='rgba(0,0,0,.6)';c.shadowBlur=14*d;c.shadowOffsetY=6*d;c.fillStyle='#000';rr(c,0,0,W.w,W.h+8,W.cr);c.fill();c.restore();
  drawDeskTop(c,W,a,k*d);
}

/* ---------- camera & cached layers ---------- */
function fitCamera(){
  const W=M.W;if(!W)return;
  let top=6,bot=6;const side=10;
  if(M.on&&!M.demo){top=$('#hudTop').getBoundingClientRect().bottom+10;bot=$('#hudBottom').getBoundingClientRect().height+4;}
  const pad=24,aw=VIEW.w-side*2,ah=Math.max(120,VIEW.h-top-bot);
  VIEW.sc=Math.min(aw/(W.w+pad*2),ah/(W.h+pad*2+11));
  VIEW.ox=(VIEW.w-W.w*VIEW.sc)/2;VIEW.oy=top+(ah-(W.h+11)*VIEW.sc)/2;
}
function layout(){
  VIEW.dpr=Math.min(S.settings.quality==='low'?1.25:2,window.devicePixelRatio||1);
  VIEW.w=Math.max(1,window.innerWidth);VIEW.h=Math.max(1,window.innerHeight);
  cv.width=Math.round(VIEW.w*VIEW.dpr);cv.height=Math.round(VIEW.h*VIEW.dpr);
  fitCamera();LAYERS.key='';
}
function worldXform(c,sx=0,sy=0){const s=VIEW.dpr*VIEW.sc;c.setTransform(s,0,0,s,VIEW.dpr*(VIEW.ox+sx),VIEW.dpr*(VIEW.oy+sy));}
function ensureLayers(){
  const W=M.W,key=[cv.width,cv.height,VIEW.sc.toFixed(5),VIEW.ox.toFixed(1),VIEW.oy.toFixed(1),M.arena.id,W.land].join('|');
  if(key===LAYERS.key)return;LAYERS.key=key;
  for(const L of [LAYERS.floor,LAYERS.desk]){L.width=cv.width;L.height=cv.height;}
  const f=LAYERS.floor.getContext('2d'),k=VIEW.dpr*VIEW.sc;
  f.setTransform(1,0,0,1,0,0);const g=f.createLinearGradient(0,0,0,cv.height);g.addColorStop(0,'#0d1530');g.addColorStop(1,'#050913');f.fillStyle=g;f.fillRect(0,0,cv.width,cv.height);
  worldXform(f);
  const x0=-VIEW.ox/VIEW.sc-50,y0=-VIEW.oy/VIEW.sc-50,x1=(VIEW.w-VIEW.ox)/VIEW.sc+50,y1=(VIEW.h-VIEW.oy)/VIEW.sc+50;
  f.fillStyle='rgba(255,255,255,.022)';for(let x=Math.floor(x0/150)*150;x<x1;x+=150)f.fillRect(x,y0,1.4,y1-y0);
  let row=0;for(let y=Math.floor(y0/600)*600;y<y1;y+=600,row++)for(let x=Math.floor(x0/150)*150;x<x1;x+=150)f.fillRect(x,y+((x/150+row)%2?300:0),150,1.4);
  const lg=f.createRadialGradient(W.w/2,W.h/2,Math.min(W.w,W.h)*.2,W.w/2,W.h/2,Math.max(W.w,W.h)*1.05);lg.addColorStop(0,'rgba(120,150,255,.09)');lg.addColorStop(1,'rgba(0,0,0,0)');f.fillStyle=lg;f.fillRect(x0,y0,x1-x0,y1-y0);
  f.save();f.shadowColor='rgba(0,0,0,.7)';f.shadowBlur=46*k;f.shadowOffsetY=24*k;f.shadowOffsetX=8*k;f.fillStyle='#000';rr(f,-3,2,W.w+6,W.h+12,W.cr+3);f.fill();f.restore();
  f.setTransform(1,0,0,1,0,0);const vg=f.createRadialGradient(cv.width/2,cv.height/2,Math.min(cv.width,cv.height)*.35,cv.width/2,cv.height/2,Math.max(cv.width,cv.height)*.75);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.55)');f.fillStyle=vg;f.fillRect(0,0,cv.width,cv.height);
  const d=LAYERS.desk.getContext('2d');d.setTransform(1,0,0,1,0,0);d.clearRect(0,0,cv.width,cv.height);worldXform(d);drawDeskTop(d,W,M.arena,k);
}

/* ---------- effects ---------- */
const FX={parts:[],rings:[],floats:[],conf:[],trails:new Map(),shake:0,flash:0,flashCol:'#fff',slow:0};
function burst(x,y,n,col,spd=220){for(let i=0;i<n;i++){const a=Math.random()*TAU,s=spd*(.3+Math.random());FX.parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:2+Math.random()*1.6,sz:1+Math.random()*2.2,col:col||'#fff8e1',type:'spark'});}}
function puff(x,y,n,col){for(let i=0;i<n;i++){const a=Math.random()*TAU,s=30+Math.random()*60;FX.parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:1.4+Math.random(),sz:4+Math.random()*7,col:col||'rgba(255,255,255,.5)',type:'puff'});}}
function ringFx(x,y,col,max=40){FX.rings.push({x,y,r:3,max,life:1,col:col||'#fff'});}
function floater(text,x,y,col,size=22,sub){FX.floats.push({text,x,y,col:col||'#fff',size,life:1,sub});}
function confetti(n=160){const cols=['#ffc23d','#3b82f6','#ef4444','#22c55e','#a855f7','#ffffff','#38bdf8'];
  for(let i=0;i<n;i++)FX.conf.push({x:Math.random()*VIEW.w,y:-20-Math.random()*VIEW.h*.6,vx:rand(-50,50),vy:rand(60,190),rot:Math.random()*TAU,vr:rand(-8,8),sz:rand(5,10),col:cols[i%cols.length],life:1});}
function updateFX(dt){
  for(const p of FX.parts){p.x+=p.vx*dt;p.y+=p.vy*dt;const k=Math.pow(.02,dt);p.vx*=k;p.vy*=k;p.life-=p.decay*dt;}
  FX.parts=FX.parts.filter(p=>p.life>0);if(FX.parts.length>420)FX.parts.splice(0,FX.parts.length-420);
  for(const r of FX.rings){r.life-=dt*2.4;r.r+=(r.max-r.r)*Math.min(1,dt*9);}FX.rings=FX.rings.filter(r=>r.life>0);
  for(const f of FX.floats){f.y-=34*dt;f.life-=dt*.62;}FX.floats=FX.floats.filter(f=>f.life>0);
  for(const q of FX.conf){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=60*dt;q.vx*=.995;q.rot+=q.vr*dt;if(q.y>VIEW.h+30)q.life=0;}FX.conf=FX.conf.filter(q=>q.life>0);
  FX.shake*=Math.pow(.015,dt);FX.flash=Math.max(0,FX.flash-dt*2.2);
}
function drawFX(c){
  for(const r of FX.rings){c.globalAlpha=clamp(r.life,0,1)*.8;c.strokeStyle=r.col;c.lineWidth=px(3)*r.life+px(.5);c.beginPath();c.arc(r.x,r.y,r.r,0,TAU);c.stroke();}
  for(const p of FX.parts){c.globalAlpha=clamp(p.life,0,1);
    if(p.type==='puff'){c.fillStyle=p.col;c.beginPath();c.arc(p.x,p.y,p.sz*(1.6-p.life*.6),0,TAU);c.fill();}
    else{c.strokeStyle=p.col;c.lineWidth=p.sz*.7;c.lineCap='round';c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-p.vx*.025,p.y-p.vy*.025);c.stroke();}}
  c.globalAlpha=1;
  for(const f of FX.floats){const a=clamp(f.life*1.8,0,1),s=f.size*(1+(1-Math.min(1,(1-f.life)*6))*.4);
    c.globalAlpha=a;c.font=`900 italic ${px(s)}px Rubik,system-ui,sans-serif`;c.textAlign='center';c.textBaseline='middle';
    c.lineJoin='round';c.lineWidth=px(5);c.strokeStyle='rgba(5,8,18,.75)';c.strokeText(f.text,f.x,f.y);c.fillStyle=f.col;c.fillText(f.text,f.x,f.y);
    if(f.sub){c.font=`800 ${px(12)}px Rubik,system-ui,sans-serif`;c.lineWidth=px(4);c.strokeText(f.sub,f.x,f.y+px(s*.85));c.fillStyle='#fde68a';c.fillText(f.sub,f.x,f.y+px(s*.85));}}
  c.globalAlpha=1;
}

/* ---------- drawing pens in the world ---------- */
function pose(b,al){let da=b.a-b.pa;return {x:b.px+(b.x-b.px)*al,y:b.py+(b.y-b.py)*al,a:b.pa+da*al};}
function drawPenOnDesk(c,b,P,col,t,active){
  const h=b.L/2-b.r,r=b.r;
  // team glow (a pre-blurred sprite, so no per-frame shadowBlur)
  c.save();c.translate(P.x,P.y);c.rotate(P.a);
  c.globalAlpha=active?.5+.2*Math.sin(t*6):.34;
  if(S.settings.quality!=='low')blit(c,penGlow(b.pen,col));else{c.fillStyle=col;capsulePath(c,h,r+4.5);c.fill();}
  c.restore();
  // soft contact shadow, cast away from the light (offset in world space, so it never turns with the pen)
  c.save();c.translate(P.x+r*.34,P.y+r*.6);c.rotate(P.a);blit(c,penShadow(b.pen,col));c.restore();
  // body: cached sprite of the painted pen
  c.save();c.translate(P.x,P.y);c.rotate(P.a);blitPen(c,b.pen,col,P.a);
  if(active){c.globalAlpha=.55+.35*Math.sin(t*6);c.strokeStyle='#fff';c.lineWidth=px(1.6);capsulePath(c,h,r+px(3));c.stroke();c.globalAlpha=1;}
  c.restore();
}
function drawCenterMark(c,b,P,t){
  const m=edgeMargin(M.W,b.x,b.y),danger=m<24;
  const rad=px(danger?4.2:3);
  if(danger){c.globalAlpha=.55+.45*Math.sin(t*10);c.strokeStyle='#ff3b5c';c.lineWidth=px(2);c.beginPath();c.arc(P.x,P.y,px(9)+2*Math.sin(t*10),0,TAU);c.stroke();c.globalAlpha=1;}
  c.fillStyle=danger?'#ff3b5c':'rgba(255,255,255,.92)';c.strokeStyle='rgba(0,0,0,.55)';c.lineWidth=px(1.3);
  c.beginPath();c.arc(P.x,P.y,rad,0,TAU);c.fill();c.stroke();
}
function drawFalling(c,b,col,al){
  const k=clamp(b.fallT/PH.fallDur,0,1),t=b.fallT,z=Math.min(720,.5*PH.g*t*t),persp=1400/(1400+z);
  const cx=M.W.w/2,cy=M.W.h/2,x=cx+(b.x-cx)*persp,y=cy+(b.y-cy)*persp;
  const tilt=Math.min(Math.PI/2*.92,t*7),cs=Math.cos(tilt),nx=b.fnx||0,ny=b.fny||0;
  const alpha=1-clamp((k-.55)/.45,0,1);if(alpha<=0)return;
  // a round pen tipping over the edge only foreshortens along its own length (by how much it points off the desk)
  const un=Math.cos(b.a)*nx+Math.sin(b.a)*ny,f=Math.sqrt(Math.max(.05,1-un*un*(1-cs*cs)));
  c.save();c.globalAlpha=alpha;c.translate(x,y);c.scale(persp,persp);
  c.rotate(b.a);c.scale(f,1);blitPen(c,b.pen,col,b.a);
  c.globalAlpha=alpha*Math.min(.65,k*1.2);c.fillStyle='#000';capsulePath(c,b.L/2-b.r,b.r+.5);c.fill();
  c.restore();
}

/* ---------- aiming visuals ---------- */
let PRED=null,PRED_KEY='';
function drawAim(c,b,aim,col,t,showPath){
  const {gx,gy,vx,vy}=aim,len=Math.hypot(vx,vy),mp=maxPull(),L=Math.min(len,mp),p=L/mp,ang=Math.atan2(vy,vx);
  const ex=gx-Math.cos(ang)*L,ey=gy-Math.sin(ang)*L;
  // elastic band
  c.lineCap='round';
  c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=px(7);c.beginPath();c.moveTo(gx,gy);c.lineTo(ex,ey);c.stroke();
  const g=c.createLinearGradient(gx,gy,ex,ey);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(1,rgba(col,.95));
  c.strokeStyle=g;c.lineWidth=px(4);c.beginPath();c.moveTo(gx,gy);c.lineTo(ex,ey);c.stroke();
  c.fillStyle='#fff';c.beginPath();c.arc(ex,ey,px(9),0,TAU);c.fill();c.strokeStyle=col;c.lineWidth=px(3);c.stroke();
  // power ring
  c.strokeStyle='rgba(0,0,0,.4)';c.lineWidth=px(6);c.beginPath();c.arc(gx,gy,px(22),0,TAU);c.stroke();
  c.strokeStyle=`hsl(${120-p*120},90%,55%)`;c.lineWidth=px(4);c.beginPath();c.arc(gx,gy,px(22),-Math.PI/2,-Math.PI/2+p*TAU);c.stroke();
  c.fillStyle='#ffc23d';c.beginPath();c.arc(gx,gy,px(4.5),0,TAU);c.fill();
  if(len<minPull())return;
  const dx=Math.cos(ang),dy=Math.sin(ang);
  if(showPath&&S.settings.guide==='path'){
    const key=[aim.t.toFixed(1),ang.toFixed(3),p.toFixed(3)].join('|');
    if(key!==PRED_KEY){PRED_KEY=key;PRED=predictPath(M.W,b.owner,aim.t,ang,p);}
    const pts=PRED.pts,bad=PRED.res==='fall';let acc=0,lx=pts[0],ly=pts[1];
    c.fillStyle=bad?'#ff5370':'#ffe08a';
    for(let i=2;i<pts.length;i+=2){const x=pts[i],y=pts[i+1];acc+=Math.hypot(x-lx,y-ly);lx=x;ly=y;
      if(acc>=px(11)){acc=0;const f=i/pts.length;c.globalAlpha=.95-.55*f;c.beginPath();c.arc(x,y,px(2.6),0,TAU);c.fill();}}
    c.globalAlpha=1;
    if(PRED.res==='hit'){c.strokeStyle='#ffe08a';c.lineWidth=px(2.5);c.beginPath();c.arc(PRED.hx,PRED.hy,px(12)+px(2)*Math.sin(t*10),0,TAU);c.stroke();}
    else if(PRED.res==='fall'){c.strokeStyle='#ff5370';c.lineWidth=px(3.5);const s=px(9);c.beginPath();c.moveTo(lx-s,ly-s);c.lineTo(lx+s,ly+s);c.moveTo(lx+s,ly-s);c.lineTo(lx-s,ly+s);c.stroke();}
    else{c.save();c.translate(PRED.x,PRED.y);c.rotate(PRED.a);c.setLineDash([px(4),px(4)]);c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=px(1.5);capsulePath(c,b.L/2-b.r,b.r);c.stroke();c.setLineDash([]);c.restore();}
  }else if(S.settings.guide!=='off'){
    const fl=40+p*160;c.setLineDash([px(2),px(10)]);c.strokeStyle='#ffe08a';c.lineWidth=px(4);c.beginPath();c.moveTo(b.x,b.y);c.lineTo(b.x+dx*fl,b.y+dy*fl);c.stroke();c.setLineDash([]);
    const axp=b.x+dx*fl,ayp=b.y+dy*fl;c.fillStyle='#ffe08a';c.beginPath();c.moveTo(axp+dx*px(14),ayp+dy*px(14));c.lineTo(axp-dy*px(8),ayp+dx*px(8));c.lineTo(axp+dy*px(8),ayp-dx*px(8));c.closePath();c.fill();
  }
}
function drawTutorial(c,b,t){
  const opp=M.W.bodies.find((o,i)=>i!==b.owner&&o.state==='on');if(!opp)return;
  const a=Math.atan2(opp.y-b.y,opp.x-b.x),k=(t%1.9)/1.9,e=k<.7?k/.7:1,L=110*e,hx=b.x-Math.cos(a)*L,hy=b.y-Math.sin(a)*L;
  c.globalAlpha=k<.7?1:1-(k-.7)/.3;c.setLineDash([px(6),px(7)]);c.strokeStyle='#fff';c.lineWidth=px(3);c.beginPath();c.moveTo(b.x,b.y);c.lineTo(hx,hy);c.stroke();c.setLineDash([]);
  c.fillStyle='rgba(255,255,255,.95)';c.beginPath();c.arc(hx,hy,px(12),0,TAU);c.fill();c.strokeStyle='#ffc23d';c.lineWidth=px(3);c.stroke();
  c.globalAlpha=1;c.font=`800 ${px(16)}px Rubik,system-ui,sans-serif`;c.textAlign='center';c.lineWidth=px(5);c.strokeStyle='rgba(5,8,18,.8)';
  const ty=b.y-Math.sign(Math.sin(a)||1)*px(46);c.strokeText('Drag back, then let go',b.x,ty);c.fillStyle='#ffe08a';c.fillText('Drag back, then let go',b.x,ty);
}

/* ---------- frame ---------- */
function render(al,t){
  if(!cv.width||!cv.height)return; // window minimised / zero-size during resize
  ctx.setTransform(1,0,0,1,0,0);
  const W=M.W;if(!W){ctx.fillStyle='#070b16';ctx.fillRect(0,0,cv.width,cv.height);return;}
  ensureLayers();
  let sx=0,sy=0;if(S.settings.shake&&FX.shake>.15){sx=rand(-FX.shake,FX.shake);sy=rand(-FX.shake,FX.shake);}
  ctx.fillStyle='#050913';ctx.fillRect(0,0,cv.width,cv.height);
  ctx.drawImage(LAYERS.floor,sx*VIEW.dpr,sy*VIEW.dpr);
  worldXform(ctx,sx,sy);
  for(const b of W.bodies)if(b.state==='fall'&&b.fallT>.14)drawFalling(ctx,b,M.players[b.owner].col,al);
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(LAYERS.desk,sx*VIEW.dpr,sy*VIEW.dpr);
  worldXform(ctx,sx,sy);
  const turnB=(M.phase==='aim'||M.phase==='think'||M.phase==='aiAim')?W.bodies[M.turn]:null;
  // motion trails
  if(S.settings.quality!=='low')for(const b of W.bodies){if(b.state!=='on')continue;const tr=FX.trails.get(b.owner);if(!tr||!tr.length)continue;
    tr.forEach((q,i)=>{ctx.save();ctx.globalAlpha=.07*(i+1)/tr.length;ctx.translate(q.x,q.y);ctx.rotate(q.a);ctx.fillStyle=M.players[b.owner].col;capsulePath(ctx,b.L/2-b.r,b.r);ctx.fill();ctx.restore();});}
  const poses=W.bodies.map(b=>pose(b,al));
  W.bodies.forEach((b,i)=>{if(b.state==='on')drawPenOnDesk(ctx,b,poses[i],M.players[b.owner].col,t,b===turnB&&!DRAG&&M.phase==='aim'&&isLocal(M.players[M.turn]));});
  W.bodies.forEach((b,i)=>{if(b.state==='on')drawCenterMark(ctx,b,poses[i],t);});
  for(const b of W.bodies)if(b.state==='fall'&&b.fallT<=.14)drawFalling(ctx,b,M.players[b.owner].col,al);
  drawFX(ctx);
  if(M.phase==='aim'&&DRAG&&turnB)drawAim(ctx,turnB,DRAG,M.players[M.turn].col,t,true);
  else if(M.phase==='aiAim'&&M.aiShot&&turnB){const s=M.aiShot,e=clamp(M.t/.42,0,1),ee=1-Math.pow(1-e,3),gx=turnB.x+Math.cos(turnB.a)*s.t,gy=turnB.y+Math.sin(turnB.a)*s.t,L=s.p*maxPull()*ee;
    drawAim(ctx,turnB,{gx,gy,vx:Math.cos(s.ang)*L,vy:Math.sin(s.ang)*L,t:s.t},M.players[M.turn].col,t,false);}
  else if(M.phase==='aim'&&M.remoteAim&&M.remoteAim.on&&turnB&&!isLocal(M.players[M.turn])){
    const a=M.remoteAim,R=M.remoteAimV&&M.remoteAimV.turn===M.turn?M.remoteAimV:(M.remoteAimV={turn:M.turn,t:a.t,vx:a.vx,vy:a.vy});
    R.t+=(a.t-R.t)*.35;R.vx+=(a.vx-R.vx)*.35;R.vy+=(a.vy-R.vy)*.35;
    drawAim(ctx,turnB,{gx:turnB.x+Math.cos(turnB.a)*R.t,gy:turnB.y+Math.sin(turnB.a)*R.t,vx:R.vx,vy:R.vy,t:R.t},M.players[M.turn].col,t,false);}
  else if(M.phase==='aim'&&!M.demo&&!S.settings.tut&&turnB&&isLocal(M.players[M.turn]))drawTutorial(ctx,turnB,t);
  ctx.setTransform(1,0,0,1,0,0);
  if(FX.slow>0&&S.settings.quality!=='low'){const g=ctx.createRadialGradient(cv.width/2,cv.height/2,Math.min(cv.width,cv.height)*.3,cv.width/2,cv.height/2,Math.max(cv.width,cv.height)*.7);
    g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${.45*Math.min(1,FX.slow*2)})`);ctx.fillStyle=g;ctx.fillRect(0,0,cv.width,cv.height);}
  if(FX.flash>0){ctx.globalAlpha=FX.flash*.35;ctx.fillStyle=FX.flashCol;ctx.fillRect(0,0,cv.width,cv.height);ctx.globalAlpha=1;}
  if(FX.conf.length){ctx.setTransform(VIEW.dpr,0,0,VIEW.dpr,0,0);for(const q of FX.conf){ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.rot);ctx.fillStyle=q.col;ctx.fillRect(-q.sz/2,-q.sz/4,q.sz,q.sz/2);ctx.restore();}}
}

/* ============================== MATCH ==============================
   Offline the match runs entirely on this device. Online, the host's
   device is the authority: it runs this same controller and broadcasts
   every decision. Guests mirror it (see ONLINE section) while running the
   identical physics locally for smooth, lag-free motion.
   =================================================================== */
const M={on:false,demo:false,mode:'',players:[],arena:ARENAS[0],W:null,need:2,round:1,starter:0,turn:0,phase:'idle',t:0,planner:null,aiShot:null,
  clock:0,clockLeft:0,lastTick:0,shot:null,roundWinner:null,matchOver:false,career:null,diff:null,land:false,paused:false,opts:null,trickCoins:0,tricks:[],
  me:0,shotSeq:0,predSeq:0,remoteAim:null,roundShots:0};
let DRAG=null;
const maxPull=()=>Math.max(PH.maxPull,80/VIEW.sc);
const minPull=()=>Math.max(10,14/VIEW.sc);
const humanCount=()=>M.players.filter(p=>p.human).length;
const online=()=>M.mode==='online'&&!M.demo;
const isHost=()=>online()&&NET.role==='host';
const isGuest=()=>online()&&NET.role==='guest';
/* Is this player controlled by the person holding this device? */
const isLocal=p=>!!p&&p.human&&(!online()||p.pid===NET.me);
const q4=v=>Math.round(v*1e4)/1e4;
const CPU_NAMES=['Robo Rex','Inkbot 3000','Lefty Lou','Dr. Doodle','Nibs','Smudge','Scribbles','Professor Nib','Clicky McClick','Ballpoint Betty'];
const SPAWNS={2:[{u:.5,v:.74},{u:.5,v:.26}],3:[{u:.5,v:.77},{u:.25,v:.3},{u:.75,v:.3}]};

function colorDist(a,b){const x=hex2rgb(a),y=hex2rgb(b);return Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2]);}
function distinctColors(list){
  // keep every player's colour clearly different from the others
  const out=[];for(const c of list){let col=c;if(out.some(o=>colorDist(o,col)<90)){const alt=TEAM.map(t=>t.c).find(t=>out.every(o=>colorDist(o,t)>=90));if(alt)col=alt;}out.push(col);}return out;
}
function overlapsObs(W,b){
  const T=Object.assign({},W,{bodies:[b],C:[],nc:0,memo:null});b.ux=Math.cos(b.a);b.uy=Math.sin(b.a);
  for(const o of W.obs){if(o.t==='box')capBox(T,b,o);else capCircle(T,b,o);}
  b.asleep=true;for(let i=0;i<T.nc;i++)if(T.C[i].sep<3)return true;return false;
}
function spawnPens(){
  const W=M.W,n=M.players.length,sp=SPAWNS[n]||SPAWNS[2];
  const pts=sp.map(s=>W.land?{x:(1-s.v)*W.w,y:s.u*W.h}:{x:s.u*W.w,y:s.v*W.h});
  const cx=pts.reduce((a,p)=>a+p.x,0)/n,cy=pts.reduce((a,p)=>a+p.y,0)/n;
  M.players.forEach((p,i)=>{
    const P=pts[i],face=Math.atan2(cy-P.y,cx-P.x),a=(Math.random()<.45?face+Math.PI/2:face)+rand(-.45,.45);
    const b=makeBody(PEN(p.pen),P.x+rand(-14,14),P.y+rand(-10,10),a,i);
    for(let k=0;k<60&&overlapsObs(W,b);k++){b.x+=(W.w/2-b.x)*.05+rand(-3,3);b.y+=(P.y-b.y)*.1+rand(-3,3);b.a+=.07;}
    b.x=q4(b.x);b.y=q4(b.y);b.a=q4(b.a);b.px=b.x;b.py=b.y;b.pa=b.a;W.bodies.push(b);
  });
}
function chooseLand(){const top=M.demo?0:118,bot=M.demo?0:100,aw=window.innerWidth-20,ah=window.innerHeight-top-bot;return aw>ah*1.12;}
/* Exact body state, used to keep every device in lock-step */
function posesOf(W){return W.bodies.map(b=>{if(b.state==='on'){b.x=q4(b.x);b.y=q4(b.y);b.a=q4(b.a);}return [b.x,b.y,b.a,b.state==='on'?0:b.state==='fall'?1:2];});}

function startMatch(o){
  if(!o.demo&&!isGoogleSignedIn()){showScreen('auth');return;}
  M.opts=o;M.on=true;M.demo=!!o.demo;M.mode=o.mode;M.arena=ARENA(o.arena);M.need=o.need;M.clock=o.clock||0;M.career=o.career||null;M.diff=o.diff||null;
  const cols=distinctColors(o.players.map(p=>p.col||teamColor(p.color)));
  M.players=o.players.map((p,i)=>({name:p.name,col:cols[i],pen:p.pen,human:!!p.human,skill:p.skill||0,boss:!!p.boss,pid:p.pid||null,score:0,out:false,kos:0,selfKos:0,idx:i}));
  M.me=online()?M.players.findIndex(p=>p.pid===NET.me):(M.players[0]&&M.players[0].human&&!M.demo?0:-1);
  M.round=1;M.starter=0;M.matchOver=false;M.roundWinner=null;M.paused=false;M.trickCoins=0;M.tricks=[];M.shotSeq=0;M.predSeq=0;M.remoteAim=null;
  FX.parts.length=0;FX.rings.length=0;FX.floats.length=0;FX.slow=0;FX.flash=0;
  NAV.length=0;hideRoundCard();closeModal();
  if(!M.demo){document.body.classList.add('in-match');showScreen(null);buildHud();}
  else document.body.classList.remove('in-match');
  M.land=online()?false:chooseLand();
  if(isHost())netBroadcast({k:'start',arena:M.arena.id,need:M.need,clock:M.clock,players:M.players.map(p=>({pid:p.pid,name:p.name,col:p.col,pen:p.pen,human:p.human}))});
  newRound();
}
function startDemo(){
  const n=Math.random()<.5?2:3,pens=PENS.slice(0,8),ar=['classroom','library','office','artroom','study','boardroom','exam'];
  const pick=a=>a[Math.random()*a.length|0];
  startMatch({demo:true,mode:'demo',arena:pick(ar),need:99,players:Array.from({length:n},(_,i)=>({name:'CPU '+(i+1),color:['blue','red','green'][i],pen:pick(pens).id,human:false,skill:.25+Math.random()*.3}))});
}
function newRound(){
  M.W=makeWorld(M.arena,M.land);spawnPens();M.players.forEach(p=>p.out=false);
  M.turn=M.starter;M.phase='intro';M.t=0;M.planner=null;M.aiShot=null;DRAG=null;FX.trails.clear();PRED_KEY='';M.roundShots=0;M.remoteAim=null;
  layout();
  if(isHost())netBroadcast({k:'round',round:M.round,bodies:posesOf(M.W),scores:M.players.map(p=>p.score)});
  if(!M.demo){updateHud();splash('Round '+M.round,M.players.map(p=>p.score).join(' – '));SFX.round();}
}
function newShot(){M.shot={shooter:M.turn,sx:0,sy:0,firstPen:-1,obsFirst:false,spin:0,hitDist:0,touched:new Set(),power:0};}
function beginTurn(){
  const n=M.players.length;let k=0;while(M.players[M.turn].out&&k<n){M.turn=(M.turn+1)%n;k++;}
  const p=M.players[M.turn];M.t=0;DRAG=null;PRED_KEY='';M.remoteAim=null;newShot();
  if(p.human){
    M.phase='aim';M.clockLeft=M.clock;M.lastTick=0;
    if(!M.demo&&isLocal(p)&&(online()||humanCount()>1)){splash(online()?'Your turn':p.name,online()?'':'Your turn',p.col,true);SFX.turn();}
  }else{
    M.phase='think';const cfg=aiCfg(p.skill);cfg.turn=M.roundShots;if(M.demo)cfg.samples=Math.min(cfg.samples,18),cfg.robust=0;
    M.planner=new Planner(M.W,M.turn,cfg);
  }
  if(isHost())netBroadcast({k:'turn',turn:M.turn,phase:M.phase,clock:M.clock,rs:M.roundShots});
  if(!M.demo)updateHud();
}
function fire(t,ang,p){
  t=q4(t);ang=q4(ang);p=q4(p);
  const b=M.W.bodies[M.turn],pl=M.players[M.turn];
  M.shotSeq++;
  if(isHost())netBroadcast({k:'flick',turn:M.turn,seq:M.shotSeq,gt:t,ang,p,poses:posesOf(M.W)});
  M.shot.sx=b.x;M.shot.sy=b.y;M.shot.power=p;
  flick(b,t,ang,p);M.phase='moving';M.t=0;DRAG=null;hidePower();M.remoteAim=null;
  if(!M.demo){SFX.flick(p);buzz(8);if(isLocal(pl)){S.stats.shots++;if(!S.settings.tut){S.settings.tut=1;persist();}}updateHud();}
}
function timeUp(){
  DRAG=null;hidePower();netSendAim(null);
  const b=M.W.bodies[M.turn];floater('TIME UP',b.x,b.y-px(30),'#ff8aa0',22);SFX.deny();
  M.phase='post';M.t=.2;M.shot.skipped=true;
  if(isHost())netBroadcast({k:'result',skipped:true,shooter:M.turn,poses:posesOf(M.W),out:M.players.map(p=>p.out),kos:M.players.map(p=>p.kos),tricks:[]});
}
// stereo position of a desk x coordinate (-1 left … 1 right), kept subtle
const panOf=x=>M.W?clamp((x/M.W.w)*2-1,-1,1)*.6:0;
const EV={
  hit(A,B,speed,x,y){
    const k=clamp(speed/1800,0,1);
    if(!M.demo){SFX.hit(k,A.mat,B.isObs?B.snd:B.mat,Math.max(A.m,B.isObs?0:B.m),panOf(x));}
    if(speed>120)burst(x,y,Math.round(3+k*12));
    if(speed>300){ringFx(x,y,'#fff',16+k*30);FX.shake=Math.max(FX.shake,k*8);if(!M.demo)buzz(10+k*25|0);}
    if(speed>1300&&!M.demo&&!B.isObs)floater('SMASH!',x,y-px(26),'#ffc23d',22);
    const sh=M.shot;if(!sh||M.phase!=='moving')return;
    const sb=M.W.bodies[sh.shooter];
    if(A===sb||B===sb){const o=A===sb?B:A;
      if(o.isObs){if(sh.firstPen<0)sh.obsFirst=true;}
      else{sh.touched.add(o.owner);if(sh.firstPen<0){sh.firstPen=o.owner;sh.spin=Math.abs(sb.w);sh.hitDist=Math.hypot(o.x-sh.sx,o.y-sh.sy);}}}
  },
  fall(b){
    puff(b.x,b.y,6);
    if(M.demo)return;
    const pan=panOf(b.x);SFX.fall(pan);buzz(35);
    const sh=M.shot,self=sh&&b.owner===sh.shooter,pl=M.players[b.owner];
    if(S.settings.slowmo&&M.W.bodies.filter(x=>x.state==='on').length<=1)FX.slow=1.1;
    const lx=clamp(b.x,50,M.W.w-50),ly=clamp(b.y,40,M.W.h-40);
    floater(self?'SELF KO':'KNOCKOUT!',lx,ly,self?'#ff8aa0':'#ffffff',self?20:26,self?'':pl.name+' is out');
    FX.flash=.7;FX.flashCol=pl.col;FX.shake=Math.max(FX.shake,9);SFX.ko(pan);
  }
};
/* Credits the profile owner with knockouts and trick shots (shared by host and guests). */
function creditShot(shooter,oppKos,selfOut,tricks){
  if(shooter!==M.me||M.demo)return;
  S.stats.kos+=oppKos;if(selfOut)S.stats.selfKos++;
  for(const t of tricks){S.stats[t[2]]=(S.stats[t[2]]||0)+1;S.stats.tricks++;M.trickCoins+=t[1];M.tricks.push(t[0]);}
  checkAch();
}
function showTricks(shooter,tricks){
  if(!tricks.length||M.demo)return;
  const W=M.W,b=W.bodies[shooter],x=clamp(b.x,60,W.w-60),y=clamp(b.y-px(40),40,W.h-40),mine=shooter===M.me;
  tricks.forEach((t,i)=>floater(t[0],x,y-i*px(34),'#ffc23d',22,mine?'+'+t[1]+' coins':''));SFX.trick();
}
function resolveShot(){
  const sh=M.shot,shooter=M.players[sh.shooter],W=M.W;
  const fallen=M.players.filter(p=>!p.out&&W.bodies[p.idx].state!=='on');
  let oppKos=0,selfOut=false;
  for(const p of fallen){p.out=true;if(p.idx===sh.shooter){selfOut=true;shooter.selfKos++;}else{oppKos++;shooter.kos++;}}
  const tricks=[];
  if(!selfOut&&oppKos>0){
    if(oppKos>=2)tricks.push(['DOUBLE KO',20,'doubleKos']);
    if(sh.obsFirst&&sh.firstPen>=0)tricks.push(['BANK SHOT',12,'bankKos']);
    if(sh.spin>16)tricks.push(['SPIN KO',8,'spinKos']);
    if(sh.hitDist>360)tricks.push(['SNIPER',8,'longKos']);
    if(sh.firstPen>=0&&fallen.some(p=>p.idx!==sh.shooter&&!sh.touched.has(p.idx)))tricks.push(['CHAIN KO',12,'chainKos']);
  }
  if(!selfOut&&!sh.skipped){const b=W.bodies[sh.shooter];if(edgeMargin(W,b.x,b.y)<10&&sh.power>.25)tricks.push(['CLOSE CALL',6,'closeCalls']);}
  if(isHost())netBroadcast({k:'result',shooter:sh.shooter,poses:posesOf(W),out:M.players.map(p=>p.out),kos:M.players.map(p=>p.kos),
    oppKos,selfOut,tricks});
  creditShot(sh.shooter,oppKos,selfOut,tricks);
  showTricks(sh.shooter,tricks);
  if(!M.demo)updateHud();
}
function afterShot(){
  const alive=M.players.filter(p=>!p.out);
  if(alive.length<=1){endRound(alive[0]||null);return;}
  M.roundShots++;
  if(M.roundShots>=36){if(!M.demo)toast('Stalemate','Nobody fell in 36 flicks — replaying the round','refresh','blue');endRound(null);return;}
  M.turn=(M.shot.shooter+1)%M.players.length;beginTurn();
}
function endRound(w){
  M.phase='roundEnd';M.t=0;M.roundWinner=w;
  if(w)w.score++;
  M.matchOver=!!(w&&w.score>=M.need);
  if(M.demo)return;
  if(isHost())netBroadcast({k:'roundEnd',w:w?w.idx:-1,scores:M.players.map(p=>p.score),over:M.matchOver});
  showRoundEnd(w);
}
function showRoundEnd(w){
  const me=M.players[M.me];
  if(me&&w){if(w===me)S.stats.rounds++;else S.stats.roundsLost++;}
  updateHud();showRoundCard(w);
  const good=M.mode==='party'?w&&w.human:w===me;
  if(good)SFX.win();else if(w)SFX.lose();
}
function nextRound(){
  if(M.phase!=='roundEnd'||isGuest())return;
  hideRoundCard();
  if(M.matchOver){finishMatch();return;}
  if(M.roundWinner)M.round++;
  M.starter=(M.starter+1)%M.players.length;newRound();
}
function forceStop(){for(const b of M.W.bodies){if(b.state==='on'){b.vx=b.vy=b.w=0;b.asleep=true;}else if(b.state==='fall')b.state='out';}}
function updateMatch(dt){
  if(!M.on||!M.W)return;
  if(isGuest()){guestUpdate(dt);return;}
  switch(M.phase){
    case 'intro':M.t+=dt;if(M.t>=(M.demo?.5:1.15))beginTurn();break;
    case 'aim':
      M.t+=dt;
      if(M.clock&&!M.demo){M.clockLeft-=dt;const s=Math.ceil(M.clockLeft);if(isLocal(M.players[M.turn])&&M.clockLeft<=3.05&&s!==M.lastTick&&s>0){M.lastTick=s;SFX.tick();}
        updateClock();if(M.clockLeft<=0)timeUp();}
      break;
    case 'think':{M.t+=dt;const pl=M.planner;pl.work(M.demo?3:7);if((pl.done&&M.t>=pl.cfg.think)||M.t>3.4){
      M.aiShot=pl.result();M.aiShot.t=q4(M.aiShot.t);M.aiShot.ang=q4(M.aiShot.ang);M.aiShot.p=q4(M.aiShot.p);M.phase='aiAim';M.t=0;
      if(isHost())netBroadcast({k:'aiAim',turn:M.turn,gt:M.aiShot.t,ang:M.aiShot.ang,p:M.aiShot.p});}break;}
    case 'aiAim':M.t+=dt;if(M.t>=.56){const s=M.aiShot;fire(s.t,s.ang,s.p);}break;
    case 'moving':{M.t+=dt;M.quietT=quiet(M.W)?(M.quietT||0)+dt:0;
      // settled, or everything has been (almost) still for 0.25 s, or the 8 s safety cap
      const stuck=M.quietT>=.25||M.t>8;
      if(settled(M.W)||stuck){if(stuck&&!settled(M.W))forceStop();M.phase='post';M.t=0;M.quietT=0;resolveShot();}break;}
    case 'post':M.t+=dt;if(M.t>=.5)afterShot();break;
    case 'roundEnd':M.t+=dt;if(M.t>=(M.demo?1.2:3.1))nextRound();break;
  }
}
function trails(){
  for(const b of M.W.bodies){
    let tr=FX.trails.get(b.owner);if(!tr){tr=[];FX.trails.set(b.owner,tr);}
    if(b.state==='on'&&!b.asleep&&Math.hypot(b.vx,b.vy)+Math.abs(b.w)*b.L*.3>650){tr.push({x:b.x,y:b.y,a:b.a});if(tr.length>7)tr.shift();}
    else if(tr.length)tr.shift();
  }
}

/* ---------- rewards, XP, trophies ---------- */
const xpNeed=l=>200+l*100;
function addXp(x){S.xp+=x;const ups=[];while(S.xp>=xpNeed(S.level)){S.xp-=xpNeed(S.level);S.level++;const bonus=50+S.level*25;S.coins+=bonus;ups.push([S.level,bonus]);}return ups;}
function checkAch(){
  let any=false;
  for(const a of ACH){if(S.ach[a.id])continue;if(a.v(S)>=a.n){S.ach[a.id]=Date.now();S.coins+=a.reward;any=true;
    toast('Trophy: '+a.name,a.desc+' · +'+fmt(a.reward)+' coins',a.ic);}}
  if(any){SFX.trick();refreshCoins(true);}
  persist();
}
function computeRewards(){
  const p0=M.players[M.me];if(!p0||M.demo)return null;
  const top=Math.max(...M.players.map(p=>p.score)),won=p0.score===top&&M.players.filter(p=>p.score===top).length===1;
  const cls=classOf(PEN(p0.pen).mass),mult=CLASSES[cls].mult,lines=[];let total=0;
  const add=(label,v)=>{v=Math.round(v);if(v>0){lines.push([label,v]);total+=v;}};
  if(M.mode==='quick'){const d=QUICK_DIFF[M.diff];add(won?'Victory · '+d.n:'Match played',(won?d.win:6)*mult);}
  else if(M.mode==='career'){const o=M.career;if(won){add('Defeated '+o.name,o.reward);if(!S.career[o.id])add('First win bonus',o.reward);}else add('Match played',o.reward*.08);}
  else if(M.mode==='online')add(won?'Online victory':'Online match played',(won?40:10)*mult);
  else add(won?'Party winner':'Party played',(won?25:8)*mult);
  add('Rounds won ×'+p0.score,p0.score*5*mult);
  add('Knockouts ×'+p0.kos,p0.kos*3*mult);
  if(M.trickCoins)add('Trick shots · '+M.tricks.length,M.trickCoins);
  const flawless=won&&M.need>=3&&M.players.every(p=>p===p0||p.score===0);
  if(flawless)add('Flawless victory',20*mult);
  if(won&&(M.mode==='quick'||M.mode==='career')){const st=S.stats.streak+1;if(st>=2){const pct=Math.min(50,(st-1)*10);add('Win streak ×'+st+' (+'+pct+'%)',total*pct/100);}}
  const xp=Math.round(((won?120:40)+p0.score*10+p0.kos*6)*(1+cls*.15));
  return {won,lines,total,xp,flawless,cls};
}

/* ---------- HUD ---------- */
function buildHud(){
  $('#hudPlayers').innerHTML=M.players.map((p,i)=>{
    const isMe=(p.human&&(online()?p.pid===NET.me:i===0));
    const avHtml=(isMe&&S.profile&&S.profile.avatar_url)
      ?`<img class="google-avatar" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex:none" src="${esc(S.profile.avatar_url)}" alt="Avatar" referrerpolicy="no-referrer">`
      :`<div class="av" style="--c:${p.col}">${esc(initials(p.name))}</div>`;
    return `<div class="pc" id="pc${i}" style="--c:${p.col}">${avHtml}
      <div class="nm"><b>${esc(p.name)}</b><small id="pcs${i}">${pcSub(p)}</small></div><div class="pips" id="pips${i}"></div></div>`;
  }).join('');
}
const pcSub=p=>(online()&&p.pid===NET.me?'You · ':p.human?'':'CPU · ')+esc(PEN(p.pen).name);
function updateHud(){
  if(M.demo||!M.on)return;
  $('#hudRound').textContent='Round '+M.round;$('#hudGoal').textContent='First to '+M.need;
  const aiming=['aim','think','aiAim'].includes(M.phase);
  M.players.forEach((p,i)=>{const el=$('#pc'+i);if(!el)return;el.classList.toggle('turn',i===M.turn&&aiming);el.classList.toggle('out',p.out);
    $('#pcs'+i).innerHTML=pcSub(p);
    $('#pips'+i).innerHTML=Array.from({length:M.need},(_,k)=>`<i class="pip${k<p.score?' on':''}"></i>`).join('');});
  const pill=$('#turnPill'),p=M.players[M.turn];pill.style.setProperty('--c',p.col);
  const dots='<span class="think"><i></i><i></i><i></i></span>';
  let txt='';
  if(M.phase==='aim'){
    if(!isLocal(p))txt=`${esc(p.name)} is aiming ${dots}`;
    else txt=!online()&&humanCount()>1?`<b>${esc(p.name)}</b>&nbsp;— drag back from your pen`:'Your turn — drag back from your pen';
  }
  else if(M.phase==='think'||M.phase==='aiAim')txt=`${esc(p.name)} is aiming ${dots}`;
  else if(M.phase==='intro')txt='Get ready…';
  $('#turnText').innerHTML=txt;
  pill.classList.toggle('hide',!txt||(M.phase==='aim'&&!!DRAG));
  updateClock();
}
function updateClock(){const el=$('#clock');if(M.phase==='aim'&&M.clock&&!M.demo){el.textContent=Math.max(0,Math.ceil(M.clockLeft))+'s';el.classList.toggle('warn',M.clockLeft<=3);}else el.textContent='';}
function updatePower(){
  if(!DRAG)return;const len=Math.hypot(DRAG.vx,DRAG.vy),p=Math.min(1,len/maxPull()),el=$('#power');
  el.classList.add('show');el.style.setProperty('--p',len<minPull()?0:p);
  $('#powerTxt').textContent=len<minPull()?'RELEASE TO CANCEL':'POWER '+Math.round(p*100)+'%';
  const b=M.W.bodies[M.turn];$('#spinTxt').textContent=Math.abs(DRAG.t)>b.L*.2?'+ SPIN':'';
  $('#turnPill').classList.add('hide');
}
function hidePower(){$('#power').classList.remove('show');if(M.phase==='aim'||M.phase==='think')$('#turnPill').classList.remove('hide');}
function splash(big,small,col,turn){const el=$('#splash');el.classList.toggle('turn',!!turn);el.innerHTML=`<b>${esc(big)}</b>${small?`<small>${esc(small)}</small>`:''}`;el.style.setProperty('--sc',col||'var(--accent)');el.classList.remove('show');void el.offsetWidth;el.classList.add('show');}
function showRoundCard(w){
  const el=$('#roundCard'),me=M.players[M.me],personal=!!me&&(M.mode!=='party'||humanCount()===1);let title,sub;
  if(!w){title='Draw!';sub='Every pen fell — replaying the round';}
  else if(personal&&w===me){title='Round won!';sub=M.matchOver?'And that wins the match':'Nice flicking';}
  else if(personal){title=w.name+' takes it';sub=M.matchOver?'Match over':'Shake it off — next round';}
  else{title=w.name+' wins the round';sub=M.matchOver?'…and the match!':'Next round coming up';}
  const action=isGuest()?`<p class="sub" style="margin-top:4px">${ICON('users')} The host starts the next round…</p>`
    :`<button class="btn primary block" data-act="roundNext">${M.matchOver?'See results':'Next round'} ${ICON('arrow')}</button>`;
  el.innerHTML=`<h3 style="color:${w?w.col:'#fff'}">${esc(title)}</h3><p class="sub">${esc(sub)}</p>
    <div class="board">${M.players.map(p=>{
      const isMe=(p.human&&(online()?p.pid===NET.me:(p.name===(S.profile&&S.profile.name)||p.name==='You')));
      const avHtml=(isMe&&S.profile&&S.profile.avatar_url)
        ?`<img class="google-avatar" style="width:28px;height:28px;border-radius:50%;object-fit:cover;margin:0 auto 4px;display:block" src="${esc(S.profile.avatar_url)}" alt="Avatar" referrerpolicy="no-referrer">`
        :`<div class="av" style="--c:${p.col}">${esc(initials(p.name))}</div>`;
      return `<div class="${p===w?'win':''}">${avHtml}<b>${p.score}</b><small>${esc(p.name)}</small></div>`;
    }).join('')}</div>
    ${action}<div class="bar2"><i></i></div>`;
  el.style.setProperty('--dur','3.1s');el.classList.remove('show');void el.offsetWidth;el.classList.add('show');
}
function hideRoundCard(){$('#roundCard').classList.remove('show');}

/* ---------- pause / quit ---------- */
function pause(on){
  if(!M.on||M.demo)return;if(on&&M.phase==='roundEnd'&&!online())return;
  // online games never freeze for the other players; the menu just overlays the table
  M.paused=on&&!online();if(on){DRAG=null;hidePower();netSendAim(null);}
  NAV.length=0;showScreen(on?'pause':null);
}
function toMenu(){M.paused=false;hideRoundCard();document.body.classList.remove('in-match');startDemo();NAV.length=0;if(!isGoogleSignedIn())showScreen('auth');else showScreen('menu');}

/* ============================== INPUT ============================== */
function toWorld(cx,cy){return {x:(cx-VIEW.ox)/VIEW.sc,y:(cy-VIEW.oy)/VIEW.sc};}
function canAim(){return isGoogleSignedIn()&&M.on&&!M.demo&&!M.paused&&M.phase==='aim'&&isLocal(M.players[M.turn])&&SCREEN===null&&!modalOpen();}
cv.addEventListener('pointerdown',e=>{
  SND.unlock();if(!canAim()||DRAG)return;
  const b=M.W.bodies[M.turn],p=toWorld(e.clientX,e.clientY),ux=Math.cos(b.a),uy=Math.sin(b.a);
  const s=clamp((p.x-b.x)*ux+(p.y-b.y)*uy,-b.L/2,b.L/2),qx=b.x+ux*s,qy=b.y+uy*s,d=Math.hypot(p.x-qx,p.y-qy);
  if(d>Math.max(42,36/VIEW.sc)){ringFx(b.x,b.y,M.players[M.turn].col,b.L*.6);floater('Grab your pen',b.x,b.y-px(34),'#fff',16);return;}
  DRAG={id:e.pointerId,t:s,gx:qx,gy:qy,cx:p.x,cy:p.y,vx:0,vy:0};
  try{cv.setPointerCapture(e.pointerId);}catch(_){}
  SFX.grab();e.preventDefault();updatePower();netSendAim(DRAG);
});
cv.addEventListener('pointermove',e=>{if(!DRAG||e.pointerId!==DRAG.id)return;const p=toWorld(e.clientX,e.clientY);DRAG.cx=p.x;DRAG.cy=p.y;DRAG.vx=DRAG.gx-p.x;DRAG.vy=DRAG.gy-p.y;updatePower();netSendAim(DRAG);});
cv.addEventListener('pointerup',e=>{
  if(!DRAG||e.pointerId!==DRAG.id)return;const d=DRAG;DRAG=null;hidePower();if(!canAim()){netSendAim(null);return;}
  const len=Math.hypot(d.vx,d.vy);if(len<minPull()){netSendAim(null);updateHud();return;}
  const ang=Math.atan2(d.vy,d.vx),pw=Math.min(1,len/maxPull());
  if(isGuest())guestFire(d.t,ang,pw);else fire(d.t,ang,pw);
});
cv.addEventListener('pointercancel',()=>{DRAG=null;hidePower();netSendAim(null);});
cv.addEventListener('contextmenu',e=>e.preventDefault());

/* ============================== ONLINE (SUPABASE POWERED) ==============================
   Ultra-low latency room multiplayer powered by Supabase Realtime Channels & PostgreSQL:
   - Supabase Realtime WebSockets provide instant cross-network peer communication
     bypassing NAT, firewall, and WebRTC STUN/TURN issues entirely.
   - Realtime Presence tracks active room participants and auto-detects disconnections.
   - Supabase PostgreSQL (deskduel_rooms table) acts as a live room registry for lobby discovery.
   - Match results are archived in deskduel_matches.
   - Player coins, XP, levels, unlocks and stats are backed up in deskduel_profiles.
   - The host's device is the authority: it runs the match controller, the
     CPU players and the shot clock, and broadcasts every decision.
   - Every device simulates each flick with the same physics engine from the
     same exact starting state, so motion is smooth with zero visual lag.
   ======================================================================================== */
const NET={on:false,role:null,channel:null,conns:new Map(),uids:new Map(),registered:false,beatT:0,host:null,me:null,code:'',lobby:null,state:'idle',err:'',queue:[],heard:new Map(),aimT:0,joinT:0,busyText:''};
const NET_VER=2,CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randCode=()=>Array.from({length:5},()=>CODE_CHARS[Math.random()*CODE_CHARS.length|0]).join('');

/* ---------- Supabase Client & Cloud Progress ---------- */
function hasSupabaseKey(){return !!getSupabase();}

function getPlayerId(){
  if(S&&S.profile&&S.profile.google_id)return S.profile.google_id;
  let pid=localStorage.getItem('deskduel_player_id');
  if(!pid){pid='p_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36);localStorage.setItem('deskduel_player_id',pid);}
  return pid;
}

/* Cloud save only runs for a real Supabase session (AUTH_UID). The row id is the
   auth user id, which the database policies require. Email is never uploaded. */
let AUTH_UID='';
let _syncDebounce=null,_lastSyncKey='';
const PROFILE_COLS='id,name,avatar_url,avatar_color,equipped_pen,coins,xp,level,trophies,login_streak,stats,owned_pens,owned_desks,career,achievements,updated_at';
function syncProgressToCloud(immediate){
  const sb=getSupabase();if(!sb||!S||!AUTH_UID)return;
  clearTimeout(_syncDebounce);
  const doSync=async()=>{
    try{
      const pid=AUTH_UID;
      const pName=(S.profile&&S.profile.name?S.profile.name:'').trim().slice(0,14)||'Player';
      const row={
        id:pid,
        name:pName,
        avatar_url:(S.profile&&S.profile.avatar_url)||null,
        avatar_color:S.profile&&S.profile.color?S.profile.color:'blue',
        equipped_pen:S.equip||'ballpoint',
        coins:S.coins||0,
        xp:S.xp||0,
        level:S.level||1,
        trophies:S.trophies||100,
        login_streak:S.daily?S.daily.streak:1,
        stats:S.stats||{},
        owned_pens:S.owned||{},
        owned_desks:S.desks||{},
        career:S.career||{},
        achievements:S.ach||{}
      };
      // skip the network call when nothing changed since the last upload
      const key=JSON.stringify(row);if(key===_lastSyncKey)return;
      const now=new Date().toISOString();
      const {error}=await sb.from('deskduel_profiles').upsert(Object.assign({},row,{last_online:now,updated_at:now}));
      if(error)console.warn('Supabase profile sync error:',error.message);else _lastSyncKey=key;
    }catch(err){console.warn('Supabase profile sync error:',err);}
  };
  if(immediate){
    return doSync();
  }else{
    _syncDebounce=setTimeout(doSync,2500);
  }
}

async function loadProgressFromCloud(forcedId){
  const sb=getSupabase();if(!sb)return false;
  const pid=forcedId||AUTH_UID;if(!pid)return false;
  try{
    // Look up by the auth user id only. (The old email lookup let anyone load
    // someone else's progress by typing their email.)
    const {data,error}=await sb.from('deskduel_profiles').select(PROFILE_COLS).eq('id',pid).maybeSingle();
    if(!error&&data){
      let changed=false;
      if(data.name&&data.name!=='Player'){
        S.profile.name=data.name;
        S.profile.name_customized=true;
        changed=true;
      }
      if(data.avatar_url&&!S.profile.avatar_url){S.profile.avatar_url=data.avatar_url;changed=true;}
      if(data.trophies&&data.trophies>=(S.trophies||0)){S.trophies=data.trophies;changed=true;}
      if(data.coins>S.coins){S.coins=data.coins;changed=true;}
      if(data.level>S.level){S.level=data.level;S.xp=data.xp;changed=true;}
      if(data.owned_pens){S.owned=Object.assign({},S.owned,data.owned_pens);changed=true;}
      if(data.owned_desks){S.desks=Object.assign({},S.desks,data.owned_desks);changed=true;}
      if(data.career){S.career=Object.assign({},S.career,data.career);changed=true;}
      if(data.achievements){S.ach=Object.assign({},S.ach,data.achievements);changed=true;}
      if(data.login_streak&&(!S.daily||!S.daily.streak)){S.daily=Object.assign({},S.daily,{streak:data.login_streak});changed=true;}
      if(changed){
        persist();
        updateNameEverywhere(S.profile.name);
        refreshCoins(true);
        if(SCREEN==='menu')RENDER.menu();
        if(SCREEN==='stats')RENDER.stats();
      }
      return true;
    }
  }catch(e){console.warn('Cloud restore error:',e);}
  return false;
}

/* ==================== GOOGLE AUTH & PLAYER IDENTITY ==================== */
function isGoogleSignedIn(){
  return !!(S.profile&&(S.profile.google_id||S.profile.email));
}

async function initGoogleAuth(){
  const sb=getSupabase();if(!sb)return;
  try{
    if(typeof window!=='undefined'&&window.location.hash&&window.location.hash.includes('access_token')){
      setTimeout(()=>{
        if(window.history&&window.history.replaceState){
          window.history.replaceState(null,'',window.location.pathname+window.location.search);
        }
      },600);
    }
    // onAuthStateChange fires INITIAL_SESSION on load, so getSession() isn't needed.
    // Token refreshes only update the id; they must never navigate (that used to
    // kick players out of a running match every hour).
    sb.auth.onAuthStateChange((event,session)=>{
      const user=session&&session.user;
      AUTH_TOKEN=session&&session.access_token||'';
      if(user&&(event==='INITIAL_SESSION'||event==='SIGNED_IN')){
        if(AUTH_UID===user.id)return;
        setTimeout(()=>applyGoogleUser(user,event==='SIGNED_IN'),0);
      }else if(user&&(event==='TOKEN_REFRESHED'||event==='USER_UPDATED')){
        AUTH_UID=user.id;
      }else if(event==='SIGNED_OUT'){
        if(AUTH_UID)applySignedOut();
      }else if(event==='INITIAL_SESSION'&&!user&&S.profile.google_id&&!String(S.profile.google_id).startsWith('g_')){
        // the saved profile belongs to an expired session: ask to sign in again
        S.profile.google_id='';persist();if(SCREEN!==null)showScreen('auth',true);
      }
    });
  }catch(e){console.warn('initGoogleAuth notice:',e);}
}

function getAuthRedirectUrl(){
  if(typeof window!=='undefined'&&window.location){
    const origin=(window.location.origin||'').replace(/\/+$/,'');
    if(origin&&origin!=='null'){
      return origin + '/';
    }
  }
  return 'https://desk-duel-bd.vercel.app/';
}

function applyGoogleUser(user,showNotice){
  if(!user)return;
  const meta=user.user_metadata||{};
  const customName=meta.custom_name||meta.name||meta.full_name||'';
  const gName=(customName||(user.email?user.email.split('@')[0]:'')||'Player').trim().slice(0,14);
  const gAvatar=meta.avatar_url||meta.picture||'';
  const gEmail=user.email||'';
  const prevId=S.profile.google_id;
  AUTH_UID=user.id;
  S.profile.google_id=user.id;
  try{localStorage.setItem('deskduel_player_id',user.id);}catch(e){}
  if(gAvatar)S.profile.avatar_url=gAvatar;
  if(gEmail)S.profile.email=gEmail;
  if(!S.profile.name_customized||!S.profile.name||S.profile.name==='Player'){
    if(gName)S.profile.name=gName;
  }
  // The welcome bonus is paid once per account, not on every sign-in.
  // (players who were already signed in before this update count as welcomed)
  if(!S.welcomed)S.welcomed={};
  if(prevId===user.id)S.welcomed[user.id]=1;
  const firstTime=!S.welcomed[user.id];
  if(firstTime){S.welcomed[user.id]=1;S.coins=(S.coins||0)+500;}
  persist();
  updateNameEverywhere(S.profile.name);
  // Only leave the sign-in screen; never interrupt a match or another screen.
  if(SCREEN==='auth'){
    NAV.length=0;
    showScreen(UI.joinCode?'online':'menu',true);
  }
  if(firstTime)openWelcomeBonusModal(S.profile.name||gName,500);
  loadProgressFromCloud(user.id).then(()=>syncProgressToCloud());
  if(SCREEN==='online'&&UI.joinCode&&NET.state==='idle')fetchOpenRooms();
  if(showNotice)toast('Signed in as '+S.profile.name,'Cloud save active','user','blue');
}

function applySignedOut(){
  if(NET.on)netLeave();
  if(M.on&&!M.demo)toMenu();
  AUTH_UID='';_lastSyncKey='';
  S.profile.google_id='';
  S.profile.email='';
  S.profile.avatar_url='';
  S.profile.name='Player';
  persist();
  toast('Signed Out','Please sign in with Google to play','user','blue');
  NAV.length=0;
  showScreen('auth',true);
}

async function handleGoogleSignIn(){
  const sb=getSupabase();
  if(!sb){
    toast('Cloud Unavailable','Please check internet connection','globe','blue');
    return;
  }
  try{
    if(window.location.protocol==='file:'){
      openGoogleProfileModal('Local Game Mode: Connect your Google profile to link your progress.');
      return;
    }
    const redirectUrl=getAuthRedirectUrl();
    const {data,error}=await sb.auth.signInWithOAuth({
      provider:'google',
      options:{
        redirectTo:redirectUrl,
        queryParams:{access_type:'offline',prompt:'consent'}
      }
    });
    if(error){
      console.warn('OAuth redirect notice:',error.message);
      openGoogleProfileModal(error.message);
      return;
    }
    if(data&&data.url){
      window.location.href=data.url;
    }
  }catch(err){
    console.warn('signInWithOAuth fallback:',err);
    openGoogleProfileModal();
  }
}

function openGoogleProfileModal(optNotice){
  const curName=S.profile.name==='Player'?'':S.profile.name;
  const curEmail=S.profile.email||'';
  const curAvatar=S.profile.avatar_url||'';
  openModal(`
    <div style="text-align:center;margin-bottom:14px">
      <div style="width:48px;height:48px;border-radius:50%;background:#ffffff;display:grid;place-items:center;margin:0 auto 10px;box-shadow:0 4px 14px rgba(0,0,0,.35)">
        <svg style="width:26px;height:26px"><use href="#i-google"/></svg>
      </div>
      <h3 style="margin:0 0 4px">Play with an offline profile</h3>
      <p class="sub" style="font-size:13px;margin:0">Google sign-in isn't available right now. Pick a name and play; sign in later to sync to the cloud and the Global Leaderboard.</p>
      ${optNotice?`<small style="display:block;margin-top:8px;color:#fcd34d;background:rgba(245,158,11,.15);padding:6px 10px;border-radius:8px;font-size:11px">${esc(optNotice)}</small>`:''}
    </div>
    <div class="field" style="margin:10px 0">
      <div class="label">Gamer Name</div>
      <input class="txt" id="gNameIn" maxlength="14" placeholder="Your Gamer Name" value="${esc(curName)}" autocomplete="nickname">
    </div>
    <p class="sub" style="font-size:12px;margin:4px 0 0">Offline profile: progress stays on this device until you sign in with Google.</p>
    <div class="field" style="margin:10px 0">
      <div class="label">Choose Avatar</div>
      <div style="display:flex;gap:8px;overflow-x:auto;padding:4px 0">
        ${[
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face',
          'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop&crop=face',
          'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face',
          'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face'
        ].map(url=>`<img class="google-avatar g-sel-av ${curAvatar===url?'selected':''}" src="${url}" data-url="${url}" style="width:40px;height:40px;cursor:pointer;border:2px solid ${curAvatar===url?'var(--accent)':'transparent'}">`).join('')}
      </div>
      <input class="txt" id="gAvatarIn" placeholder="Or paste custom image URL" value="${esc(curAvatar)}" style="margin-top:6px;font-size:12px">
    </div>
    <div class="btn-row" style="margin-top:18px">
      <button class="btn" data-act="closeModal">Cancel</button>
      <button class="btn primary" data-act="saveGoogleProfile">${ICON('play')} Start Playing</button>
    </div>
  `);
  $$('.g-sel-av').forEach(img=>{
    img.addEventListener('click',()=>{
      const v=$('#gAvatarIn');if(v)v.value=img.dataset.url;
      $$('.g-sel-av').forEach(el=>el.style.borderColor='transparent');
      img.style.borderColor='var(--accent)';
    });
  });
}

function saveGoogleProfileFromModal(){
  const nameIn=($('#gNameIn')?$('#gNameIn').value.trim():'')||'Player';
  let avatarIn=($('#gAvatarIn')?$('#gAvatarIn').value.trim():'')||'';
  if(avatarIn&&!/^https:\/\//i.test(avatarIn))avatarIn='';
  S.profile.name=nameIn.slice(0,14);
  S.profile.avatar_url=avatarIn;
  if(!S.profile.google_id){
    S.profile.google_id='g_'+Math.random().toString(36).slice(2,10);
  }
  if(!S.welcomed)S.welcomed={};
  const wasSigned=!!S.welcomed.offline;
  if(!wasSigned){S.welcomed.offline=1;S.coins=(S.coins||0)+500;}
  persist();
  closeModal();
  NAV.length=0;
  if(UI.joinCode){
    showScreen('online',true);
  }else{
    showScreen('menu',true);
  }
  if(!wasSigned){
    openWelcomeBonusModal(S.profile.name,500);
  }
  syncProgressToCloud();
  toast('Offline profile ready','Progress is saved on this device','user','blue');
}

async function handleGoogleSignOut(){
  const sb=getSupabase();
  if(sb){try{await sb.auth.signOut();}catch(e){}}
  applySignedOut();
}

function updateNameEverywhere(name){
  if(!name)return;
  name=name.trim().slice(0,14);
  if(S&&S.profile)S.profile.name=name;
  $$('#mLvlName').forEach(el=>{el.textContent=name;});
  const pIn=$('#profileNameIn');if(pIn&&document.activeElement!==pIn)pIn.value=name;
  const oIn=$('#onName');if(oIn&&document.activeElement!==oIn)oIn.value=name;
  if(SCREEN==='stats')RENDER.stats();
  if(SCREEN==='menu')RENDER.menu();
  if(SCREEN==='online')renderOnline();
}

async function saveProfileName(newName){
  newName=(newName||'').trim().replace(/[\r\n\t]/g,'').slice(0,14);
  if(!newName){
    toast('Invalid Name','Name cannot be blank','x','gold');
    return;
  }
  S.profile.name=newName;
  S.profile.name_customized=true;
  persist();
  updateNameEverywhere(newName);

  // 1. Immediate sync to Supabase table
  await syncProgressToCloud(true);

  // 2. Also update Supabase Auth user metadata so session refresh always has it
  const sb=getSupabase();
  if(sb){
    try{
      await sb.auth.updateUser({
        data:{
          name:newName,
          full_name:newName,
          custom_name:newName
        }
      });
    }catch(e){console.warn('sb.auth.updateUser notice:',e);}
  }
  toast('Name Updated!','Display name saved in cloud as '+S.profile.name,'check','blue');
}

function openWelcomeBonusModal(name,bonus){
  openModal(`
    <div style="text-align:center">
      <div class="medal" style="margin:0 auto 10px">${ICON('trophy')}</div>
      <h2 style="margin:0 0 6px">Welcome, ${esc(name)}!</h2>
      <p class="sub" style="margin-bottom:14px">${AUTH_UID?'Your Google account is connected with Cloud Save active.':'Your profile is saved on this device.'} We added a special welcome bonus to your balance!</p>
      <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border-radius:999px;background:rgba(255,194,61,.2);border:1px solid rgba(255,194,61,.5);font-size:20px;font-weight:900;color:var(--accent);margin-bottom:18px">
        ${COIN} +${fmt(bonus)} Coins
      </div>
      <div class="kv" style="text-align:left;margin-bottom:16px">
        <span>Gamer</span><b>${esc(name)}</b>
        <span>Cloud Save</span>${AUTH_UID?'<b style="color:#4ade80">Active ✓</b>':'<b style="color:#fbbf24">This device</b>'}
        <span>Starting Trophies</span><b>🏆 ${S.trophies||100}</b>
      </div>
      <button class="btn primary lg block" data-act="welcomeBonusGo">${ICON('play')} Start Playing</button>
    </div>
  `);
  try{confetti();}catch(e){}
  try{if(SFX.fanfare)SFX.fanfare();else if(SFX.win)SFX.win();}catch(e){}
  refreshCoins(true);
}

/* ==================== DAILY LOGIN BONUS RPC ==================== */
async function handleClaimDailyBonus(){
  if(S.daily.last===dayKey()){closeModal();toast('Already claimed today','Come back tomorrow for the next bonus','gift','gold');return;}
  const sb=getSupabase();
  if(sb&&AUTH_UID){
    try{
      // push unsynced local coins first, then add the bonus on top of them
      await syncProgressToCloud(true);
      const {data,error}=await sb.rpc('claim_daily_login_bonus',{p_user_id:AUTH_UID});
      if(!error&&data&&data.success){
        const bonus=data.awarded_coins||150;
        const streak=data.new_streak||1;
        // (the old code set coins to the server total, which could be lower than
        // the local balance and silently took coins away)
        S.coins=Math.max((S.coins||0)+bonus,data.total_coins||0);
        S.daily={last:dayKey(),streak:streak};
        persist();refreshCoins(true);confetti();SFX.fanfare();
        openModal(`
          <div style="text-align:center">
            <div class="medal" style="margin:0 auto 10px">${ICON('gift')}</div>
            <h2>Daily Login Bonus!</h2>
            <p class="sub">Day ${streak} Streak Claimed!</p>
            <div style="font-size:24px;font-weight:900;color:var(--accent);margin:14px 0">${COIN} +${fmt(bonus)} Coins</div>
            <p class="sub" style="font-size:12px;color:var(--muted)">Come back tomorrow for Day ${((streak%7)+1)} bonus (+${DAILY[streak%7]} coins)!</p>
            <button class="btn primary block" data-act="closeModal" style="margin-top:14px">Awesome!</button>
          </div>
        `);
        if(SCREEN==='menu')RENDER.menu();
        if(SCREEN==='stats')RENDER.stats();
        return;
      }else if(data&&data.already_claimed){
        toast('Already Claimed Today',`Next bonus in ${data.next_available_in_hours||'a few'} hrs`,'gift','gold');
        return;
      }
    }catch(err){console.warn('claim_daily_login_bonus rpc fallback:',err);}
  }
  claimDailyLocal();
}

/* ==================== LEADERBOARD SYSTEM ==================== */
let _currentLbTab='trophies';
async function openLeaderboardModal(tab){
  if(tab)_currentLbTab=tab;
  const activeTab=_currentLbTab||'trophies';
  const sb=getSupabase();
  openModal(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h3 style="margin:0">${ICON('trophy')} Global Leaderboard</h3>
      <span class="cloud-pill"><span class="pulse-dot"></span> Live</span>
    </div>
    <div class="seg" style="margin-bottom:14px">
      <button class="${activeTab==='trophies'?'on':''}" data-act="setLbFilter" data-tab="trophies">🏆 Trophies</button>
      <button class="${activeTab==='online'?'on':''}" data-act="setLbFilter" data-tab="online">⚡ Online</button>
      <button class="${activeTab==='wins'?'on':''}" data-act="setLbFilter" data-tab="wins">🥇 Wins</button>
      <button class="${activeTab==='coins'?'on':''}" data-act="setLbFilter" data-tab="coins">💰 Coins</button>
    </div>
    <div class="panel" style="text-align:center;padding:28px 10px"><div class="spinner"></div><p class="sub" style="margin-top:12px">Loading top duelists…</p></div>
  `);

  let data=null;
  if(sb){
    try{
      let query=sb.from('deskduel_leaderboard').select('id,name,avatar_color,avatar_url,level,coins,equipped_pen,trophies,online_wins,total_wins,login_streak');
      if(activeTab==='online')query=query.order('online_wins',{ascending:false});
      else if(activeTab==='wins')query=query.order('total_wins',{ascending:false});
      else if(activeTab==='coins')query=query.order('coins',{ascending:false});
      else query=query.order('trophies',{ascending:false});
      const res=await query.limit(50);
      if(!res.error)data=res.data;
    }catch(e){console.warn('leaderboard fetch error:',e);}
  }

  const pid=AUTH_UID||getPlayerId();
  const myName=S.profile&&S.profile.name?S.profile.name:'Player';
  const myAvatar=S.profile&&S.profile.avatar_url;
  const myTrophies=S.trophies||100;
  const myOnlineWins=S.stats.onlineWins||0;
  const myTotalWins=S.stats.wins||0;
  const myCoins=S.coins||0;

  let players=data||[];
  if(!players.length){
    players=[
      {id:pid,name:myName,avatar_url:myAvatar,avatar_color:S.profile.color||'blue',level:S.level,equipped_pen:S.equip||'ballpoint',trophies:myTrophies,online_wins:myOnlineWins,total_wins:myTotalWins,coins:myCoins,login_streak:S.daily?S.daily.streak:1}
    ];
  }

  const myIdx=players.findIndex(p=>p.id===pid);
  const myRank=myIdx>=0?String(myIdx+1):(players.length>=50?'50+':'–');

  const top3=players.slice(0,3);
  const p1=top3[0],p2=top3[1],p3=top3[2];

  const getMetric=p=>{
    if(!p)return '';
    if(activeTab==='online')return `${p.online_wins||0} wins`;
    if(activeTab==='wins')return `${p.total_wins||0} wins`;
    if(activeTab==='coins')return `${fmt(p.coins||0)} coins`;
    return `🏆 ${p.trophies||100}`;
  };

  const renderAv=(p,size=36)=>{
    if(!p)return `<div class="av" style="width:${size}px;height:${size}px;font-size:12px;--c:#64748b">–</div>`;
    if(p.avatar_url&&/^https:\/\//i.test(p.avatar_url)){
      return `<img class="lb-avatar" src="${esc(p.avatar_url)}" alt="" loading="lazy" decoding="async" style="width:${size}px;height:${size}px" referrerpolicy="no-referrer">`;
    }
    return `<div class="av" style="width:${size}px;height:${size}px;font-size:12px;--c:${teamColor(p.avatar_color||'blue')}">${esc(initials(p.name))}</div>`;
  };

  const podiumHtml=`
    <div class="lb-podium">
      <div class="lb-step">
        <div class="av-wrap">${renderAv(p2,44)}</div>
        <b>${esc(p2?p2.name:'–')}</b>
        <div class="trophies" style="color:#cbd5e1">#2 · ${getMetric(p2)}</div>
      </div>
      <div class="lb-step first">
        <div class="crown">👑</div>
        <div class="av-wrap">${renderAv(p1,54)}</div>
        <b style="font-size:14px">${esc(p1?p1.name:'–')}</b>
        <div class="trophies">#1 · ${getMetric(p1)}</div>
      </div>
      <div class="lb-step">
        <div class="av-wrap">${renderAv(p3,44)}</div>
        <b>${esc(p3?p3.name:'–')}</b>
        <div class="trophies" style="color:#f97316">#3 · ${getMetric(p3)}</div>
      </div>
    </div>
  `;

  const restRows=players.slice(3).map((r,idx)=>{
    const rank=idx+4;
    const isMe=r.id===pid;
    return `
      <div class="lb-item ${isMe?'me':''}">
        <div class="lb-rank" style="color:${rank<=10?'var(--text)':'var(--muted)'}">#${rank}</div>
        ${renderAv(r,36)}
        <div class="lb-info">
          <b>${esc(r.name)} ${isMe?'<span class="chip next">You</span>':''}</b>
          <small>Lvl ${r.level} · ${esc(PEN(r.equipped_pen||'ballpoint').name)}</small>
        </div>
        <div class="lb-stats">
          <div class="tr">${getMetric(r)}</div>
          <small>${fmt(r.coins||0)} coins</small>
        </div>
      </div>
    `;
  }).join('');

  const stickyMeHtml=`
    <div class="lb-sticky-me">
      <div style="font-weight:900;font-size:16px;color:var(--accent);width:32px;text-align:center">#${myRank}</div>
      ${renderAv({avatar_url:myAvatar,avatar_color:S.profile.color||'blue',name:myName},36)}
      <div style="flex:1;min-width:0">
        <b style="font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">${esc(myName)} <span class="chip next">You</span></b>
        <small style="color:var(--muted);font-size:12px">Lvl ${S.level} · ${esc(PEN(S.equip||'ballpoint').name)}</small>
      </div>
      <div style="text-align:right">
        <div style="color:var(--accent);font-weight:900;font-size:14px">${activeTab==='online'?myOnlineWins+' wins':activeTab==='wins'?myTotalWins+' wins':activeTab==='coins'?fmt(myCoins)+' coins':'🏆 '+myTrophies}</div>
        <small style="color:var(--muted)">Your Rank</small>
      </div>
    </div>
  `;

  openModal(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h3 style="margin:0">${ICON('trophy')} Global Leaderboard</h3>
      <span class="cloud-pill"><span class="pulse-dot"></span> Live</span>
    </div>
    <div class="seg" style="margin-bottom:14px">
      <button class="${activeTab==='trophies'?'on':''}" data-act="setLbFilter" data-tab="trophies">🏆 Trophies</button>
      <button class="${activeTab==='online'?'on':''}" data-act="setLbFilter" data-tab="online">⚡ Online</button>
      <button class="${activeTab==='wins'?'on':''}" data-act="setLbFilter" data-tab="wins">🥇 Wins</button>
      <button class="${activeTab==='coins'?'on':''}" data-act="setLbFilter" data-tab="coins">💰 Coins</button>
    </div>
    ${podiumHtml}
    <div class="lb-list">
      ${restRows||(players.length<=3?'<p class="sub" style="text-align:center;padding:12px 0">Play online matches to join the top 50!</p>':'')}
    </div>
    ${stickyMeHtml}
    <div class="btn-row" style="margin-top:14px">
      <button class="btn block" data-act="closeModal">Close</button>
    </div>
  `);
}

let OPEN_ROOMS=[],LOADING_ROOMS=false,_roomsChannel=null;
const ROOM_FRESH_MS=90000,ROOM_BEAT_MS=30000;
let AUTH_TOKEN='';
async function fetchOpenRooms(){
  const sb=getSupabase();if(!sb)return [];
  LOADING_ROOMS=true;
  try{
    // hosts refresh updated_at every 30 s, so anything older is a closed tab
    const fresh=new Date(Date.now()-ROOM_FRESH_MS).toISOString();
    const {data,error}=await sb.from('deskduel_rooms').select('code,host_id,host_name,arena,need,clock,status,player_count,max_players,updated_at')
      .eq('status','lobby').gt('updated_at',fresh).order('updated_at',{ascending:false}).limit(8);
    if(!error&&data){OPEN_ROOMS=data.filter(r=>r.code!==NET.code&&(r.player_count||1)<(r.max_players||3));}
  }catch(e){console.warn('fetchOpenRooms error:',e);}
  LOADING_ROOMS=false;
  if(SCREEN==='online')renderOnline();
  subscribeRoomsRealtime();
  return OPEN_ROOMS;
}

function subscribeRoomsRealtime(){
  const sb=getSupabase();
  if(!sb||_roomsChannel)return;
  try{
    let t=0;
    const ch=sb.channel('deskduel_open_rooms_realtime');
    _roomsChannel=ch;
    ch.on('postgres_changes',{event:'*',schema:'public',table:'deskduel_rooms'},()=>{
        // many changes arrive in bursts (every lobby edit); refetch once per burst
        clearTimeout(t);
        t=setTimeout(()=>{if(SCREEN==='online'&&NET.state==='idle')fetchOpenRooms();},600);
      })
      .subscribe(st=>{
        // Forget the channel first: removeChannel() itself reports CLOSED, and
        // removing again from inside that callback looped until the stack overflowed.
        if(_roomsChannel!==ch)return;
        if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'||st==='CLOSED'){
          _roomsChannel=null;
          if(st!=='CLOSED')setTimeout(()=>{try{sb.removeChannel(ch);}catch(e){}},0);
        }
      });
  }catch(err){console.warn('Rooms realtime sub error:',err);}
}

function netErrText(e){
  const t=e&&e.type;
  if(t==='channel-error')return 'Could not connect to room channel. Check internet connection.';
  return 'Connection problem'+(t?' ('+t+')':'')+'. Please try again.';
}
function myProfile(){return {name:(S.profile.name||'').trim().slice(0,14)||'Player',color:S.profile.color||'blue',pen:S.owned[S.online.pen]?S.online.pen:S.equip};}
function cleanPlayer(p){
  return {pid:String(p.pid),name:String(p.name||'Player').replace(/[<>&"]/g,'').trim().slice(0,14)||'Player',
    color:TEAM.some(t=>t.id===p.color)?p.color:'blue',pen:PENS.some(x=>x.id===p.pen)?p.pen:'ballpoint',
    host:!!p.host,cpu:p.cpu?(QUICK_DIFF[p.cpu]?p.cpu:'medium'):undefined};
}
function fixColors(){const used=new Set();for(const p of NET.lobby.players){if(used.has(p.color)){const f=TEAM.find(t=>!used.has(t.id));if(f)p.color=f.id;}used.add(p.color);}}

/* Realtime Broadcast senders */
function netSend(m){
  if(NET.channel&&NET.channel.send){
    try{NET.channel.send({type:'broadcast',event:'game',payload:{from:NET.me,to:'H',m}});}catch(e){}
  }
}
function netBroadcast(m,except){
  if(NET.channel&&NET.channel.send){
    try{NET.channel.send({type:'broadcast',event:'game',payload:{from:NET.me,to:'all',except:except||null,m}});}catch(e){}
  }
}
function netSendTo(targetPid,m){
  if(NET.channel&&NET.channel.send){
    try{NET.channel.send({type:'broadcast',event:'game',payload:{from:NET.me,to:targetPid,m}});}catch(e){}
  }
}

async function netLobbyChanged(){
  if(NET.role!=='host')return;
  fixColors();
  netBroadcast({k:'lobby',lobby:NET.lobby});
  if(SCREEN==='online')renderOnline();
  if(NET.lobby){
    roomUpdate({arena:NET.lobby.arena,need:NET.lobby.need,clock:NET.lobby.clock,player_count:NET.lobby.players.length,players:NET.lobby.players});
  }
}

function netReset(){
  clearTimeout(NET.joinT);clearInterval(NET.beatT);
  // detach first so the channel's own CLOSED/leave callbacks see it is no longer ours
  const old=NET.channel;NET.channel=null;
  if(old){const sb=getSupabase();try{sb?sb.removeChannel(old):old.unsubscribe();}catch(e){}}
  Object.assign(NET,{on:false,role:null,channel:null,host:null,me:null,code:'',lobby:null,state:'idle',queue:[],busyText:'',registered:false,beatT:0});
  NET.conns=new Map();NET.heard=new Map();NET.uids=new Map();
}
function netFail(msg){netReset();NET.state='idle';NET.err=msg;if(SCREEN==='online')renderOnline();SFX.deny();}
function netBusy(text){NET.state='loading';NET.busyText=text;NET.err='';if(SCREEN==='online')renderOnline();}

/* ---------- host ---------- */
/* Claim a free room code in the registry. The code is the primary key, so an
   insert fails if another room already uses it and we simply try a new code.
   (The old upsert silently overwrote other people's rooms.) */
async function claimRoomCode(sb){
  if(!AUTH_UID)return {code:randCode(),registered:false};
  for(let i=0;i<5;i++){
    const code=randCode();
    const {error}=await sb.from('deskduel_rooms').insert({
      code,host_id:AUTH_UID,host_name:myProfile().name,
      arena:S.desks[S.online.arena]?S.online.arena:'classroom',need:S.online.need,clock:S.online.clock,
      status:'lobby',player_count:1,max_players:3,players:[],updated_at:new Date().toISOString()
    });
    if(!error)return {code,registered:true};
    if(error.code!=='23505'){console.warn('room registry insert:',error.message);return {code,registered:false};}
  }
  return {code:randCode(),registered:false};
}
function roomUpdate(fields){
  const sb=getSupabase();if(!sb||!NET.registered||!NET.code)return Promise.resolve();
  return sb.from('deskduel_rooms').update(Object.assign({},fields,{updated_at:new Date().toISOString()})).eq('code',NET.code).then(r=>{if(r.error)console.warn('room update:',r.error.message);},()=>{});
}
async function netHost(){
  const sb=getSupabase();
  if(!sb){netFail('Could not connect to online servers. Please check your internet connection.');return;}
  netReset();netBusy('Creating your room…');NET.role='host';NET.me='H';
  const {code,registered}=await claimRoomCode(sb);
  if(NET.role!=='host')return; // cancelled while waiting
  NET.code=code;NET.registered=registered;

  const channel=sb.channel('deskduel_room_'+code,{
    config:{broadcast:{ack:false,self:false},presence:{key:'H'}}
  });
  NET.channel=channel;

  channel
    .on('presence',{event:'leave'},({key})=>{
      if(NET.channel!==channel)return;
      if(key&&key!=='H')hostDrop(key,'left the room');
    })
    .on('broadcast',{event:'game'},({payload})=>{
      if(!payload||!payload.m||payload.from===NET.me)return;
      if(payload.to&&payload.to!=='H'&&payload.to!=='all')return;
      hostRecv(payload.from,payload.m);
    });

  channel.subscribe(async(status)=>{
    if(NET.channel!==channel)return;
    if(status==='SUBSCRIBED'){
      // re-subscribed after a network blip: re-announce presence and keep going
      if(NET.state==='lobby'||online()){try{await channel.track({pid:'H',name:myProfile().name,color:myProfile().color,pen:myProfile().pen,host:true});}catch(e){}return;}
      NET.on=true;NET.code=code;NET.state='lobby';
      NET.lobby={code,arena:S.desks[S.online.arena]?S.online.arena:'classroom',need:S.online.need,clock:S.online.clock,players:[cleanPlayer(Object.assign({pid:'H',host:true},myProfile()))]};
      if(AUTH_UID)NET.uids.set('H',AUTH_UID);
      await channel.track({pid:'H',name:myProfile().name,color:myProfile().color,pen:myProfile().pen,host:true});
      SFX.turn();if(SCREEN==='online')renderOnline();
      roomUpdate({players:NET.lobby.players,player_count:1});
      // heartbeat so the room browser knows this lobby is still alive
      clearInterval(NET.beatT);
      NET.beatT=setInterval(()=>{if(NET.role==='host'&&NET.registered)roomUpdate({});},ROOM_BEAT_MS);
    }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
      if(NET.state!=='lobby'&&!online())netFail('Could not connect to Supabase Realtime. Please check your network and try again.');
    }
  });
}

/* Close the room even if the host just closes the tab (keepalive request). */
function hostCloseOnExit(){
  if(NET.role!=='host'||!NET.registered||!NET.code)return;
  const sb=getSupabase();if(!sb)return;
  try{
    netBroadcast({k:'hostLeft'});
    fetch(sb.supabaseUrl+'/rest/v1/deskduel_rooms?code=eq.'+encodeURIComponent(NET.code),{
      method:'PATCH',keepalive:true,
      headers:{'Content-Type':'application/json',apikey:sb.supabaseKey,Authorization:'Bearer '+(AUTH_TOKEN||sb.supabaseKey),Prefer:'return=minimal'},
      body:JSON.stringify({status:'finished',updated_at:new Date().toISOString()})
    }).catch(()=>{});
  }catch(e){}
}
addEventListener('pagehide',()=>{hostCloseOnExit();if(NET.role==='guest')netSend({k:'bye'});syncProgressToCloud(true);});

function hostRecv(fromPid,m){
  if(!m||typeof m!=='object'||NET.role!=='host')return;
  NET.heard.set(fromPid,now());
  switch(m.k){
    case 'hello':{
      const no=why=>{netSendTo(fromPid,{k:'reject',why});};
      if(m.v!==NET_VER)return no('version');
      if(online()&&M.phase!=='matchEnd')return no('started');
      if(NET.lobby.players.length>=3)return no('full');
      NET.conns.set(fromPid,true);
      if(m.uid&&/^[0-9a-f-]{36}$/i.test(m.uid))NET.uids.set(fromPid,m.uid);
      const p=cleanPlayer(Object.assign({},m.p,{pid:fromPid,host:false,cpu:undefined}));
      const exist=NET.lobby.players.findIndex(x=>x.pid===fromPid);
      if(exist>=0)NET.lobby.players[exist]=p;
      else NET.lobby.players.push(p);
      fixColors();
      netSendTo(fromPid,{k:'welcome',you:fromPid,lobby:NET.lobby});
      netLobbyChanged();
      if(exist<0){toast(p.name+' joined','Room '+NET.code,'users','blue');SFX.turn();}
      break;}
    case 'update':{
      const p=NET.lobby.players.find(x=>x.pid===fromPid);
      if(p&&m.p){Object.assign(p,cleanPlayer(Object.assign({},p,m.p,{pid:fromPid,host:false,cpu:undefined})));netLobbyChanged();}
      break;}
    case 'aim':
      if(online()&&M.phase==='aim'&&M.players[M.turn].pid===fromPid&&m.a){
        M.remoteAim=m.a;netBroadcast({k:'aim',turn:M.turn,a:m.a},fromPid);
      }
      break;
    case 'flick':
      if(online()&&M.phase==='aim'&&M.players[M.turn].pid===fromPid&&m.seq===M.shotSeq+1){
        fire(+m.gt||0,+m.ang||0,clamp(+m.p||0,0,1));
      }
      break;
    case 'pong':break;
    case 'bye':hostDrop(fromPid,'left the room');break;
  }
}

function hostDrop(pid,why){
  if(NET.role!=='host')return;
  NET.conns.delete(pid);NET.heard.delete(pid);
  const li=NET.lobby?NET.lobby.players.findIndex(p=>p.pid===pid):-1;let name='A player';
  if(li>=0){name=NET.lobby.players[li].name;NET.lobby.players.splice(li,1);}
  const i=online()?M.players.findIndex(p=>p.pid===pid):-1;
  if(i>=0&&M.phase!=='matchEnd'){
    const p=M.players[i];p.human=false;p.skill=.42;p.pid='cpu-'+i;netBroadcast({k:'left',idx:i});
    if(M.turn===i&&M.phase==='aim'){
      M.phase='think';M.t=0;M.remoteAim=null;const cfg=aiCfg(p.skill);cfg.turn=M.roundShots;M.planner=new Planner(M.W,i,cfg);
      netBroadcast({k:'turn',turn:M.turn,phase:'think',clock:M.clock,rs:M.roundShots});
    }
    updateHud();toast(name+' '+why,'A CPU plays for them','users','blue');
  }else toast(name+' '+why,'','users','blue');
  netLobbyChanged();
}

async function hostStart(){
  const L=NET.lobby;if(!L||L.players.length<2)return;
  persist();
  roomUpdate({status:'playing'});
  startMatch({mode:'online',arena:L.arena,need:+L.need,clock:+L.clock,players:L.players.map(p=>({pid:p.pid,name:p.name,color:p.color,pen:p.pen,human:!p.cpu,skill:p.cpu?QUICK_DIFF[p.cpu].skill:0}))});
}

function netAddCpu(){
  const L=NET.lobby;if(!L||L.players.length>=3)return;
  const host=L.players[0],cls=classOf(PEN(host.pen).mass),pool=PENS.filter(p=>classOf(p.mass)===cls);
  L.players.push(cleanPlayer({pid:'cpu-'+Date.now().toString(36),name:CPU_NAMES[Math.random()*CPU_NAMES.length|0],color:'green',pen:pool[Math.random()*pool.length|0].id,cpu:'medium'}));
  netLobbyChanged();
}

/* ---------- guest ---------- */
async function netJoin(code){
  code=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);
  if(code.length!==5){NET.err='Enter the 5-character room code.';renderOnline();SFX.deny();return;}
  const sb=getSupabase();
  if(!sb){netFail('Could not connect to online servers. Please check your internet connection.');return;}
  UI.joinCode=code;
  netReset();netBusy('Connecting to room '+code+'…');NET.role='guest';NET.code=code;
  // Quick registry check so a closed or running room fails right away
  // instead of after a 15 s timeout.
  try{
    const {data}=await sb.from('deskduel_rooms').select('status,player_count,max_players').eq('code',code).maybeSingle();
    if(NET.role!=='guest'||NET.code!==code)return;
    if(data&&data.status==='finished'){netFail('Room '+code+' has closed. Ask your friend for a new code.');return;}
    if(data&&data.status==='playing'){netFail('That match has already started. Join when it ends.');return;}
  }catch(e){}
  const myPid='G_'+Math.random().toString(36).slice(2,8);
  NET.me=myPid;

  const channel=sb.channel('deskduel_room_'+code,{
    config:{broadcast:{ack:false,self:false},presence:{key:myPid}}
  });
  NET.channel=channel;

  NET.joinT=setTimeout(()=>{
    if(NET.state!=='lobby')netFail('Could not connect to room '+code+'. Check the code or ask the host to open the room again.');
  },12000);

  channel
    .on('presence',{event:'sync'},()=>{
      if(NET.channel!==channel||NET.state==='lobby')return;
      // presence lists everyone in the room; no host means a wrong or dead code
      const st=channel.presenceState();
      if(!st.H&&NET.subT&&now()-NET.subT>4000)netFail('Room '+code+' was not found. Check the code and try again.');
      else if(st.H&&NET.subT&&now()-(NET.helloT||0)>1500){NET.helloT=now();netSend({k:'hello',v:NET_VER,p:myProfile(),uid:AUTH_UID||''});}
    })
    .on('presence',{event:'leave'},({key})=>{
      if(NET.channel!==channel)return;
      if(key==='H')guestLost('The host closed the room.');
    })
    .on('broadcast',{event:'game'},({payload})=>{
      if(!payload||!payload.m||payload.from===NET.me)return;
      if(payload.to&&payload.to!==NET.me&&payload.to!=='all')return;
      if(payload.from!=='H')return; // guests only take orders from the host
      guestRecv(payload.m);
    });

  channel.subscribe(async(status)=>{
    if(NET.channel!==channel)return;
    if(status==='SUBSCRIBED'){
      NET.subT=now();
      await channel.track({pid:myPid,name:myProfile().name,color:myProfile().color,pen:myProfile().pen,host:false});
      if(NET.state!=='lobby'&&!online()){NET.helloT=now();netSend({k:'hello',v:NET_VER,p:myProfile(),uid:AUTH_UID||''});}
      // re-check for the host shortly after joining
      setTimeout(()=>{if(NET.channel===channel&&NET.state!=='lobby'&&!online()&&!channel.presenceState().H)netFail('Room '+code+' was not found. Check the code and try again.');},5000);
    }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
      if(NET.state!=='lobby'&&!online()){clearTimeout(NET.joinT);netFail('Failed to connect to room '+code+'. Try again.');}
    }
  });
}

function guestRecv(m){
  if(!m||typeof m!=='object'||NET.role!=='guest')return;
  NET.heard.set('H',now());
  switch(m.k){
    case 'welcome':
      clearTimeout(NET.joinT);NET.on=true;NET.state='lobby';NET.me=m.you;NET.lobby=m.lobby;NET.err='';
      if(SCREEN==='online')renderOnline();SFX.turn();
      toast('Joined room '+NET.code,'Waiting for the host to start','users','blue');break;
    case 'reject':
      clearTimeout(NET.joinT);
      netFail({full:'That room is full (3 players max).',started:'That match has already started. Join when it ends.',version:'Different version of Desk Duel.'}[m.why]||'The host could not let you in.');break;
    case 'lobby':
      NET.lobby=m.lobby;if(SCREEN==='online')renderOnline();break;
    case 'ping':netSend({k:'pong'});break;
    case 'hostLeft':guestLost('The host closed the room.');break;
    default:NET.queue.push(m);
  }
}

function guestLost(msg){
  if(NET.role!=='guest')return;
  const inGame=online()||SCREEN==='results';netReset();NET.err=msg;
  if(inGame){toMenu();go('online');}else if(SCREEN==='online')renderOnline();
  toast('Disconnected',msg,'x','blue');
}

async function netLeave(){
  clearTimeout(NET.joinT);
  const sb=getSupabase();
  if(NET.channel){
    if(NET.role==='host'){
      netBroadcast({k:'hostLeft'});
      await roomUpdate({status:'finished'});
    }else if(NET.role==='guest'){
      netSend({k:'bye'});
    }
    try{await NET.channel.unsubscribe();}catch(e){}
  }
  netReset();NET.err='';
}

function netUpdateProfile(){
  if(!NET.on)return;
  if(NET.role==='host'){
    const p=NET.lobby.players.find(x=>x.pid==='H');
    if(p)Object.assign(p,cleanPlayer(Object.assign({pid:'H',host:true},myProfile())));
    netLobbyChanged();
  }else netSend({k:'update',p:myProfile()});
}

function netSendAim(d){
  if(!online())return;const t=now();if(d&&t-NET.aimT<60)return;NET.aimT=t;
  const a=d?{t:q4(d.t),vx:Math.round(d.vx*10)/10,vy:Math.round(d.vy*10)/10,on:1}:{on:0};
  if(NET.role==='host')netBroadcast({k:'aim',turn:M.turn,a});else netSend({k:'aim',a});
}

/* Heartbeat */
setInterval(()=>{
  if(!NET.on)return;const t=now();
  if(NET.role==='host'){
    netBroadcast({k:'ping'});
    for(const [pid] of NET.conns){
      const h=NET.heard.get(pid);
      if(h&&t-h>16000)hostDrop(pid,'lost connection');
    }
  }else if(NET.role==='guest'){
    const h=NET.heard.get('H');
    if(h&&t-h>16000)guestLost('Lost connection to the host.');
  }
},3000);

/* ---------- guest mirror of the host's match ---------- */
function setPoses(P){
  if(!M.W)return;
  P.forEach((q,i)=>{const b=M.W.bodies[i];if(!b)return;
    if(q[3]===0){Object.assign(b,{x:q[0],y:q[1],a:q[2],px:q[0],py:q[1],pa:q[2],vx:0,vy:0,w:0,bvx:0,bvy:0,bw:0,asleep:true,sleepT:0,state:'on',fallT:0});}
    else if(b.state==='on')b.state='out';});
}
function localFlick(gt,ang,p){
  const b=M.W.bodies[M.turn];M.shot.sx=b.x;M.shot.sy=b.y;M.shot.power=p;
  flick(b,gt,ang,p);M.phase='moving';M.t=0;DRAG=null;hidePower();M.remoteAim=null;SFX.flick(p);
  if(isLocal(M.players[M.turn])){buzz(8);S.stats.shots++;}
  updateHud();
}
function guestFire(t,ang,p){
  t=q4(t);ang=q4(ang);p=q4(p);const seq=M.shotSeq+1;M.predSeq=seq;
  netSendAim(null);netSend({k:'flick',seq,gt:t,ang,p});newShot();localFlick(t,ang,p);
}
function guestUpdate(dt){
  M.t+=dt;
  if(M.phase==='aim'&&M.clock){M.clockLeft-=dt;const s=Math.ceil(M.clockLeft);if(isLocal(M.players[M.turn])&&M.clockLeft<=3.05&&s!==M.lastTick&&s>0){M.lastTick=s;SFX.tick();}updateClock();}
}
function guestTick(){
  if(NET.role!=='guest')return;let n=0;
  while(NET.queue.length&&n++<60){
    const m=NET.queue[0];
    // wait until our own simulation of the shot has played out before snapping to the host's result
    // (if we fell behind, e.g. the tab was in the background, catch up instantly instead)
    if(m.k==='result'&&!m.skipped&&online()&&M.phase==='moving'&&M.W&&!settled(M.W)&&!quiet(M.W)&&NET.queue.length<4){if(!m._rx)m._rx=now();if(now()-m._rx<2500)return;}
    NET.queue.shift();guestApply(m);
  }
}
function guestApply(m){
  switch(m.k){
    case 'start':
      Object.assign(M,{opts:null,on:true,demo:false,mode:'online',arena:ARENA(m.arena),need:m.need,clock:m.clock,career:null,diff:null,round:1,starter:0,matchOver:false,
        roundWinner:null,paused:false,trickCoins:0,tricks:[],shotSeq:0,predSeq:0,remoteAim:null,land:false,phase:'intro',t:0,planner:null,aiShot:null,W:null}); // old demo board has a different pen count; wait for the host's round
      M.players=m.players.map((p,i)=>({name:p.name,col:p.col,pen:p.pen,human:p.human,skill:0,boss:false,pid:p.pid,score:0,out:false,kos:0,selfKos:0,idx:i}));
      M.me=M.players.findIndex(p=>p.pid===NET.me);
      FX.parts.length=0;FX.rings.length=0;FX.floats.length=0;FX.slow=0;FX.flash=0;
      NAV.length=0;closeModal();hideRoundCard();document.body.classList.add('in-match');showScreen(null);buildHud();break;
    case 'round':
      M.round=m.round;M.players.forEach((p,i)=>{p.score=m.scores[i];p.out=false;});
      M.W=makeWorld(M.arena,false);m.bodies.forEach((q,i)=>{const b=makeBody(PEN(M.players[i].pen),q[0],q[1],q[2],i);M.W.bodies.push(b);});
      Object.assign(M,{phase:'intro',t:0,roundShots:0,planner:null,aiShot:null,remoteAim:null,predSeq:0});DRAG=null;FX.trails.clear();PRED_KEY='';
      hideRoundCard();layout();updateHud();splash('Round '+M.round,m.scores.join(' – '));SFX.round();break;
    case 'turn':{
      Object.assign(M,{turn:m.turn,phase:m.phase,t:0,clockLeft:m.clock,lastTick:0,roundShots:m.rs,remoteAim:null});DRAG=null;hidePower();PRED_KEY='';newShot();
      const p=M.players[M.turn];if(m.phase==='aim'&&isLocal(p)){splash('Your turn','',p.col,true);SFX.turn();buzz(20);}
      updateHud();break;}
    case 'aim':if(m.turn===M.turn&&M.phase==='aim'&&!isLocal(M.players[M.turn]))M.remoteAim=m.a;break;
    case 'aiAim':M.turn=m.turn;M.aiShot={t:m.gt,ang:m.ang,p:m.p};M.phase='aiAim';M.t=0;updateHud();break;
    case 'flick':
      M.shotSeq=m.seq;if(M.predSeq===m.seq)break;
      setPoses(m.poses);M.turn=m.turn;newShot();localFlick(m.gt,m.ang,m.p);break;
    case 'result':
      setPoses(m.poses);m.out.forEach((o,i)=>{M.players[i].out=o;});m.kos.forEach((v,i)=>{M.players[i].kos=v;});
      if(m.selfOut)M.players[m.shooter].selfKos++;
      M.predSeq=0;M.phase='post';M.t=0;
      if(m.skipped){const b=M.W.bodies[m.shooter];floater('TIME UP',b.x,b.y-px(30),'#ff8aa0',22);SFX.deny();}
      creditShot(m.shooter,m.oppKos||0,!!m.selfOut,m.tricks||[]);showTricks(m.shooter,m.tricks||[]);updateHud();break;
    case 'roundEnd':{
      m.scores.forEach((s,i)=>{M.players[i].score=s;});const w=m.w>=0?M.players[m.w]:null;
      Object.assign(M,{roundWinner:w,matchOver:m.over,phase:'roundEnd',t:0});showRoundEnd(w);break;}
    case 'matchEnd':hideRoundCard();finishMatch();break;
    case 'left':{const p=M.players[m.idx];if(p){p.human=false;p.pid='cpu-'+m.idx;updateHud();toast(p.name+' left','A CPU plays for them','users','blue');}break;}
  }
}
function shareLink(){return /^https?:/.test(location.protocol)?location.origin+location.pathname+'?room='+NET.code:'';}
function copyText(t){
  if(navigator.clipboard&&window.isSecureContext)return navigator.clipboard.writeText(t);
  return new Promise((res,rej)=>{const ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
    try{document.execCommand('copy')?res():rej();}catch(e){rej(e);}ta.remove();});
}

/* =============================== UI =============================== */
let SCREEN='auth';const NAV=[];const RENDER={};const UI={shopTab:'pens',careerPen:null};
function showScreen(id,fresh){
  if(!isGoogleSignedIn()&&id!=='auth'){
    id='auth';
  }
  $$('.screen').forEach(s=>s.classList.toggle('active',s.id==='scr-'+id));SCREEN=id||null;
  if(id&&RENDER[id])RENDER[id]();
  if(id&&fresh){const sc=$('#scr-'+id+' .scroll');if(sc)sc.scrollTop=0;}
}
function go(id){
  if(!isGoogleSignedIn()){showScreen('auth');return;}
  if(SCREEN&&SCREEN!==id)NAV.push(SCREEN);showScreen(id,true);
}
function back(){
  if(!isGoogleSignedIn()){showScreen('auth');return;}
  const prev=NAV.pop();if(prev)showScreen(prev);else if(M.on&&!M.demo&&M.phase!=='matchEnd')showScreen('pause');else showScreen('menu');
}
function refreshCoins(bump){$$('.coins').forEach(el=>el.textContent=fmt(S.coins));if(bump)$$('.coin-pill').forEach(el=>{el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');});}
function openModal(html){$('#dialog').innerHTML=html;$('#modal').classList.add('active');requestAnimationFrame(()=>drawPicks($('#dialog')));}
function closeModal(){$('#modal').classList.remove('active');}
const modalOpen=()=>$('#modal').classList.contains('active');
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal();});
function toast(title,sub,icon='trophy',cls='gold'){
  const el=document.createElement('div');el.className='toast '+cls;
  el.innerHTML=`<div class="ic ${cls==='blue'?'blue':''}">${ICON(icon)}</div><div class="meta"><b>${esc(title)}</b>${sub?`<small>${esc(sub)}</small>`:''}</div>`;
  $('#toasts').appendChild(el);setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),400);},3400);
}
function syncSoundIcon(){$$('.sndic').forEach(u=>u.setAttribute('href',S.settings.sound?'#i-vol':'#i-mute'));}
const stars=s=>{const n=clamp(Math.round(s*5),1,5);return `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(5-n)}</span></span>`;};
const clsBadge=(ci,short)=>{const c=CLASSES[ci];return `<span class="cls" style="--cc:${c.col}">${short?c.name.replace('weight',''):c.name}</span>`;};

/* ---------- previews ---------- */
const DESK_CACHE=new Map();
function drawPicks(root){
  $$('canvas[data-pen]',root).forEach(c=>drawPenPreview(c,c.dataset.pen,c.dataset.col||teamColor(S.profile.color)));
  $$('canvas[data-desk]',root).forEach(c=>{
    const r=c.getBoundingClientRect(),key=c.dataset.desk+'|'+Math.round(r.width)+'x'+Math.round(r.height);let img=DESK_CACHE.get(key);
    if(!img){img=document.createElement('canvas');img.style.width=r.width+'px';img.style.height=r.height+'px';
      // draw offscreen at the same CSS size
      const tmp={getBoundingClientRect:()=>r,getContext:t=>img.getContext(t),set width(v){img.width=v;},set height(v){img.height=v;}};
      drawDeskPreview(tmp,c.dataset.desk);DESK_CACHE.set(key,img);}
    c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);
  });
}
const STATMAX=(()=>{let mom=0,rng=0,stab=0;for(const p of PENS){const v=flickSpeed(p.mass);mom=Math.max(mom,p.mass*v);rng=Math.max(rng,v*v/p.grip);stab=Math.max(stab,p.mass*p.grip);}return {mom,rng,stab};})();
function penStats(p){const v=flickSpeed(p.mass);return {weight:clamp(1+9*Math.log(p.mass/5)/Math.log(62/5),1,10),power:clamp(10*p.mass*v/STATMAX.mom,1,10),
  range:clamp(10*(v*v/p.grip)/STATMAX.rng,1,10),stab:clamp(10*p.mass*p.grip/STATMAX.stab,1,10)};}
const statRow=(n,v,col)=>`<div class="st">${n}<div class="bar"><i style="width:${v*10}%;--bc:${col}"></i></div><em>${Math.round(v)}</em></div>`;
function penPick(p,on,act,scope){return `<button class="pick ${on?'on':''}" data-act="${act}" data-scope="${scope}" data-id="${p.id}"><canvas data-pen="${p.id}"></canvas>
  <b>${esc(p.name)}</b><small>${clsBadge(classOf(p.mass),true)} ${p.mass} g</small></button>`;}
function deskPick(a,on,scope){const own=!!S.desks[a.id];
  return `<button class="pick ${on?'on':''} ${own?'':'locked'}" ${own?`data-act="pickDesk" data-scope="${scope}" data-id="${a.id}"`:'data-act="go" data-to="shop" data-tab="desks"'}>
  <canvas class="desk" data-desk="${a.id}"></canvas><b>${esc(a.name)}</b><small>${own?surfaceName(a):ICON('lock')+' '+fmt(a.price)}</small></button>`;}
const surfaceName=a=>a.mu<.2?'Slick surface':a.mu<.3?'Normal surface':'Grippy surface';
const ownedPens=()=>PENS.filter(p=>S.owned[p.id]);

/* ---------- main menu ---------- */
function leagueUnlocked(li){if(li===0)return true;return !!S.career[LEAGUES[li-1].opp[3].id]&&ownsClass(LEAGUES[li].cls);}
function oppUnlocked(o){if(!leagueUnlocked(o.league))return false;return o.idx===0||!!S.career[LEAGUES[o.league].opp[o.idx-1].id];}
const nextOpp=()=>ALL_OPP.find(o=>!S.career[o.id]);
RENDER.menu=function(){
  refreshCoins();syncSoundIcon();
  const need=xpNeed(S.level);
  const pName=(S.profile&&S.profile.name)?S.profile.name:'Player';
  const hasAvatar=S.profile&&S.profile.avatar_url;
  const avatarWrap=$('#mAvatarWrap');
  if(avatarWrap){
    if(hasAvatar){
      avatarWrap.innerHTML=`<img class="google-avatar" src="${esc(S.profile.avatar_url)}" alt="Avatar" referrerpolicy="no-referrer"><span class="lvl-badge">${S.level}</span>`;
    }else{
      avatarWrap.innerHTML=`<div class="lvl" id="mLvl" style="--p:${Math.round(S.xp/need*100)}"><span>${S.level}</span></div>`;
    }
  }else{
    const ml=$('#mLvl');if(ml){ml.style.setProperty('--p',Math.round(S.xp/need*100));const sp=ml.querySelector('span');if(sp)sp.textContent=S.level;}
  }
  $('#mLvlName').textContent=pName;
  $('#mXp').textContent=`Level ${S.level} · 🏆 ${S.trophies||100} · ${fmt(S.xp)} / ${fmt(need)} XP`;
  const mCloud=$('#mCloudStatus');
  if(mCloud){
    mCloud.innerHTML=AUTH_UID
      ? `v2.1 · <span class="cloud-pill" style="font-size:10px;padding:2px 8px"><span class="pulse-dot"></span> Cloud Save Active</span>`
      : `v2.1 · <span class="cloud-pill offline" style="font-size:10px;padding:2px 8px"><span class="pulse-dot warn"></span> Offline profile · saved on this device</span>`;
  }
  const beaten=ALL_OPP.filter(o=>S.career[o.id]).length,nx=nextOpp();
  $('#careerProg').style.width=(beaten/ALL_OPP.length*100)+'%';
  $('#careerTag').textContent=nx?'League '+(nx.league+1)+' / 5':'Champion';
  $('#careerSub').textContent=nx?(oppUnlocked(nx)?`Next rival: ${nx.name} · ${LEAGUES[nx.league].name}`:`Unlock ${LEAGUES[nx.league].name}: buy a ${CLASSES[LEAGUES[nx.league].cls].name} pen`):'You rule the desk. Replay any rival for coins.';
  $('#giftBtn .dot').classList.toggle('hidden',S.daily.last===dayKey());
  $('#onlineTag').textContent=NET.on?'Room '+NET.code:'New';
};

/* ---------- career ---------- */
RENDER.career=function(){
  refreshCoins();
  const html=LEAGUES.map((L,li)=>{
    const cl=CLASSES[L.cls],un=leagueUnlocked(li),done=L.opp.filter(o=>S.career[o.id]).length;
    let lock='';
    if(!un){const prev=LEAGUES[li-1],boss=!!S.career[prev.opp[3].id],has=ownsClass(L.cls);
      const txt=!boss&&!has?`Beat ${prev.opp[3].name} and own a ${cl.name} pen`:!boss?`Beat ${prev.opp[3].name} in ${prev.name}`:`Own a ${cl.name} pen to enter`;
      lock=`<div class="lock-note">${ICON('lock')}<span>${esc(txt)}</span>${!has?'<button class="btn sm" data-act="go" data-to="shop">Pen Shop</button>':''}</div>`;}
    const rows=L.opp.map(o=>{const ok=oppUnlocked(o),beat=S.career[o.id],isNext=ok&&!beat;
      return `<button class="opp ${ok?'':'locked'}" ${ok?`data-act="oppPreview" data-id="${o.id}"`:'disabled'}>
        <div class="av ${o.boss?'boss':''}" style="--c:${o.col}">${esc(initials(o.name))}</div>
        <div class="meta"><b>${esc(o.name)} ${o.boss?'<span class="chip boss">Boss</span>':''}</b><small>${esc(PEN(o.pen).name)} · ${stars(o.skill)}</small></div>
        ${beat?`<span class="chip good">${ICON('check')}${beat>1?'×'+beat:''}</span>`:isNext?'<span class="chip next">Next</span>':''}
        <span class="reward">${COIN}${fmt(o.reward)}</span></button>`;}).join('');
    return `<div class="league ${un?'':'locked'}" style="--cc:${cl.col}"><div class="league-h"><div class="num">${li+1}</div>
      <div class="t"><b>${esc(L.name)}</b><small>${esc(L.blurb)} · ${esc(ARENA(L.arena).name)}</small></div>
      <div style="text-align:right">${clsBadge(L.cls)}<small style="display:block;color:var(--muted);font-size:12px;margin-top:6px">${done}/4 beaten</small></div></div>${lock}${rows}</div>`;
  }).join('');
  $('#careerBody').innerHTML=`<p class="sub" style="margin:0 0 14px">Every league is a weight class. Heavier leagues bring smarter rivals and bigger prizes. Beat the boss, then buy a heavier pen to move up.</p>${html}`;
};
function oppPreview(id){
  const o=ALL_OPP.find(x=>x.id===id),L=LEAGUES[o.league],A=ARENA(L.arena);
  const elig=ownedPens().filter(p=>classOf(p.mass)>=L.cls);if(!elig.length){go('shop');return;}
  if(!UI.careerPen||!elig.some(p=>p.id===UI.careerPen))UI.careerPen=(elig.find(p=>p.id===S.equip)||elig[0]).id;
  const first=!S.career[o.id],me=teamColor(S.profile.color);
  const myName=(S.profile&&S.profile.name)?S.profile.name:'You';
  const myAv=(S.profile&&S.profile.avatar_url)
    ?`<img class="google-avatar" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid var(--accent);flex:none" src="${esc(S.profile.avatar_url)}" alt="Avatar" referrerpolicy="no-referrer">`
    :`<div class="av" style="--c:${me}">${esc(initials(myName))}</div>`;
  openModal(`<h3>${o.boss?'Boss fight':'Career match'} · ${esc(L.name)}</h3>
    <div class="vs"><div class="side">${myAv}<b>${esc(myName)}</b><small id="vsPen">${esc(PEN(UI.careerPen).name)}</small></div><div class="x">VS</div>
      <div class="side"><div class="av ${o.boss?'boss':''}" style="--c:${o.col}">${esc(initials(o.name))}</div><b>${esc(o.name)}</b><small>${esc(PEN(o.pen).name)}</small></div></div>
    <p class="quote">“${esc(o.quote)}”</p>
    <div class="label" style="margin-top:14px">Your pen <em>${CLASSES[L.cls].name} or heavier</em></div>
    <div class="picker">${elig.map(p=>penPick(p,p.id===UI.careerPen,'pickPen','career')).join('')}</div>
    <div class="kv"><span>Desk</span><b>${esc(A.name)}</b><span>Format</span><b>First to ${o.need} rounds</b><span>Rival skill</span><b>${stars(o.skill)}</b>
      <span>Prize</span><b>${COIN}${fmt(o.reward)}${first?` <span class="chip next">+${fmt(o.reward)} first win</span>`:''}</b></div>
    <div class="btn-row"><button class="btn" data-act="closeModal">Not now</button><button class="btn primary" data-act="careerFight" data-id="${o.id}">${ICON('play')} Fight</button></div>`);
}
function careerFight(id){
  const o=ALL_OPP.find(x=>x.id===id),L=LEAGUES[o.league];closeModal();
  const myName=(S.profile&&S.profile.name)?S.profile.name:'You';
  startMatch({mode:'career',career:o,arena:L.arena,need:o.need,players:[
    {name:myName,color:S.profile.color,pen:UI.careerPen||S.equip,human:true},
    {name:o.name,col:o.col,pen:o.pen,human:false,skill:o.skill,boss:o.boss}]});
}

/* ---------- quick match ---------- */
RENDER.quick=function(){
  const q=S.quick;if(!S.owned[q.pen])q.pen=S.equip;if(!S.desks[q.arena])q.arena='classroom';
  const cls=classOf(PEN(q.pen).mass),mult=CLASSES[cls].mult;refreshCoins();
  $('#quickBody').innerHTML=`<div class="panel">
    <div class="field" style="margin-top:0"><div class="label">Difficulty <em>coins for a win</em></div><div class="seg">${Object.entries(QUICK_DIFF).map(([k,d])=>
      `<button class="${q.diff===k?'on':''}" data-act="setQ" data-k="diff" data-v="${k}">${d.n}<small>${COIN}${Math.round(d.win*mult)}</small></button>`).join('')}</div></div>
    <div class="field"><div class="label">Rounds to win</div><div class="seg">${[1,2,3,5].map(n=>`<button class="${+q.need===n?'on':''}" data-act="setQ" data-k="need" data-v="${n}">${n}</button>`).join('')}</div></div>
    <div class="field"><div class="label">Your pen <em>the CPU picks a pen from your weight class</em></div><div class="picker">${ownedPens().map(p=>penPick(p,p.id===q.pen,'pickPen','quick')).join('')}</div></div>
    <div class="field" style="margin-bottom:0"><div class="label">Desk</div><div class="picker">${ARENAS.map(a=>deskPick(a,a.id===q.arena,'quick')).join('')}</div></div>
  </div>
  <div class="cta"><div class="note">${ICON('weight')} ${CLASSES[cls].name} · rewards ×${mult}</div><button class="btn primary lg block" data-act="startQuick">${ICON('play')} Start match</button></div>`;
  requestAnimationFrame(()=>drawPicks($('#quickBody')));
};
function startQuick(){
  const q=S.quick,pen=PEN(q.pen),cls=classOf(pen.mass),pool=PENS.filter(p=>classOf(p.mass)===cls),cpu=pool[Math.random()*pool.length|0],d=QUICK_DIFF[q.diff];
  const cpuColor=S.profile.color==='red'?'blue':'red';persist();
  const myName=(S.profile&&S.profile.name)?S.profile.name:'You';
  startMatch({mode:'quick',diff:q.diff,arena:q.arena,need:+q.need,players:[
    {name:myName,color:S.profile.color,pen:pen.id,human:true},
    {name:CPU_NAMES[Math.random()*CPU_NAMES.length|0],color:cpuColor,pen:cpu.id,human:false,skill:clamp(d.skill+cls*.03,0,1)}]});
}

/* ---------- party ---------- */
RENDER.party=function(){
  const P=S.party;refreshCoins();
  P.slots.forEach(s=>{if(!S.owned[s.pen])s.pen=S.equip;});if(!S.desks[P.arena])P.arena='classroom';
  const slots=P.slots.slice(0,P.n),used=slots.map(s=>s.color);
  const slotHtml=slots.map((s,i)=>{const col=teamColor(s.color),cpu=s.type==='cpu';
    return `<div class="slot" style="--c:${col}"><div class="slot-h"><div class="av" style="--c:${col}">${cpu?ICON('cpu'):i+1}</div>
      <input class="txt" maxlength="14" value="${esc(s.name)}" data-slot="${i}" data-f="name" aria-label="Player ${i+1} name">
      <div class="seg" style="flex:none"><button class="${cpu?'':'on'}" data-act="slotType" data-slot="${i}" data-v="human" aria-label="Human">${ICON('user')}</button>
        <button class="${cpu?'on':''}" data-act="slotType" data-slot="${i}" data-v="cpu" aria-label="Computer">${ICON('cpu')}</button></div></div>
      <div class="row"><div class="grow"><div class="label">Pen</div><select class="sel" data-slot="${i}" data-f="pen">${ownedPens().map(p=>`<option value="${p.id}" ${p.id===s.pen?'selected':''}>${esc(p.name)} · ${p.mass} g</option>`).join('')}</select></div>
      ${cpu?`<div class="grow"><div class="label">CPU level</div><select class="sel" data-slot="${i}" data-f="skill">${Object.entries(QUICK_DIFF).map(([k,d])=>`<option value="${k}" ${k===s.skill?'selected':''}>${d.n}</option>`).join('')}</select></div>`:''}</div>
      <div class="label" style="margin-top:12px">Color</div><div class="swatches">${TEAM.map(t=>`<button class="sw ${s.color===t.id?'on':''}" style="--sw:${t.c}" data-act="slotColor" data-slot="${i}" data-v="${t.id}" ${used.includes(t.id)&&s.color!==t.id?'disabled':''} aria-label="${t.n}"></button>`).join('')}</div></div>`;}).join('');
  const humans=slots.filter(s=>s.type==='human').length;
  $('#partyBody').innerHTML=`<div class="panel">
    <div class="field" style="margin-top:0"><div class="label">Players</div><div class="seg"><button class="${P.n===2?'on':''}" data-act="partyN" data-v="2">2 Players</button><button class="${P.n===3?'on':''}" data-act="partyN" data-v="3">3 Players</button></div></div>
    <p class="sub" style="margin:-6px 0 14px">Pass the device around. Each slot can be a person or a CPU. Last pen on the desk wins the round.</p>${slotHtml}</div>
  <div class="panel">
    <div class="field" style="margin-top:0"><div class="label">Rounds to win</div><div class="seg">${[1,2,3,5].map(n=>`<button class="${+P.need===n?'on':''}" data-act="setP" data-k="need" data-v="${n}">${n}</button>`).join('')}</div></div>
    <div class="field"><div class="label">Shot clock <em>skip the turn when time runs out</em></div><div class="seg">${[[0,'Off'],[10,'10 s'],[20,'20 s']].map(([v,l])=>`<button class="${+P.clock===v?'on':''}" data-act="setP" data-k="clock" data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="field" style="margin-bottom:0"><div class="label">Desk</div><div class="picker">${ARENAS.map(a=>deskPick(a,a.id===P.arena,'party')).join('')}</div></div>
  </div>
  <div class="cta"><div class="note">${ICON('users')} ${humans} ${humans===1?'person':'people'} · ${P.n-humans} CPU</div><button class="btn primary lg block" data-act="startParty">${ICON('play')} Start party</button></div>`;
  requestAnimationFrame(()=>drawPicks($('#partyBody')));
};
$('#partyBody').addEventListener('input',e=>{const el=e.target;if(el.dataset.f==='name'){S.party.slots[+el.dataset.slot].name=el.value;persist();}});
$('#partyBody').addEventListener('change',e=>{const el=e.target,f=el.dataset.f;if(f==='pen'||f==='skill'){S.party.slots[+el.dataset.slot][f]=el.value;persist();}});
function saveOnlineName(){
  const el=$('#onName');
  if(el&&el.value.trim()){
    const v=el.value.trim().slice(0,14);
    if(v&&v!==S.profile.name){
      saveProfileName(v);
    }
  }
}
function startParty(){
  const P=S.party,players=P.slots.slice(0,P.n).map((s,i)=>({name:(s.name||'').trim()||(s.type==='cpu'?'CPU '+(i+1):'Player '+(i+1)),color:s.color,
    pen:S.owned[s.pen]?s.pen:S.equip,human:s.type==='human',skill:QUICK_DIFF[s.skill]?QUICK_DIFF[s.skill].skill:.42}));
  persist();startMatch({mode:'party',arena:P.arena,need:+P.need,clock:+P.clock,players});
}

/* ---------- shop ---------- */
RENDER.shop=function(){
  refreshCoins();$$('#shopTabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===UI.shopTab));
  let html='';
  if(UI.shopTab==='pens'){
    html=`<p class="sub" style="margin:0 0 14px">Heavier pens carry more momentum and are harder to knock off, but they slide shorter and need precise shots. Each weight class unlocks a tougher Career league with bigger rewards.</p><div class="grid">`+
    PENS.map(p=>{const own=!!S.owned[p.id],eq=S.equip===p.id,ci=classOf(p.mass),st=penStats(p),short=p.price-S.coins;
      const btn=eq?`<button class="btn block good" disabled>${ICON('check')} Equipped</button>`:own?`<button class="btn block" data-act="equip" data-id="${p.id}">Equip</button>`
        :`<button class="btn primary block ${short>0?'disabled':''}" data-act="buyPen" data-id="${p.id}">${COIN} ${fmt(p.price)}</button>`;
      return `<div class="item ${eq?'equipped':''}"><canvas class="pv" data-pen="${p.id}"></canvas>
        <div class="hd"><div><b>${esc(p.name)}</b><small>${p.mass} g · ${p.len} mm</small></div>${clsBadge(ci)}</div><p>${esc(p.desc)}</p>
        <div class="stats">${statRow('Weight',st.weight,'#f472b6')}${statRow('Power',st.power,'#fb923c')}${statRow('Range',st.range,'#38bdf8')}${statRow('Stability',st.stab,'#86efac')}</div>
        <div class="act">${btn}${!own&&short>0?`<div class="lockline" style="margin-top:8px">${ICON('lock')} ${fmt(short)} more coins needed</div>`:''}</div></div>`;}).join('')+'</div>';
  }else{
    html=`<p class="sub" style="margin:0 0 14px">Desks change how pens slide. Owned desks can be picked in Quick Match and Party. Career leagues always use their home desk.</p><div class="grid">`+
    ARENAS.map(a=>{const own=!!S.desks[a.id],short=a.price-S.coins;
      return `<div class="item"><canvas class="pv desk" data-desk="${a.id}"></canvas><div class="hd"><div><b>${esc(a.name)}</b><small>${surfaceName(a)} · ${a.obs.length?a.obs.length+' obstacles':'open desk'}</small></div>${own?`<span class="chip good">${ICON('check')} Owned</span>`:''}</div>
        <p>${esc(a.desc)}</p><div class="stats">${statRow('Slide',clamp((.42-a.mu)/.03,1,10),'#38bdf8')}${statRow('Size',clamp((a.w*a.h-240000)/12000,1,10),'#a78bfa')}</div>
        <div class="act">${own?'':`<button class="btn primary block ${short>0?'disabled':''}" data-act="buyDesk" data-id="${a.id}">${COIN} ${fmt(a.price)}</button>${short>0?`<div class="lockline" style="margin-top:8px">${ICON('lock')} ${fmt(short)} more coins needed</div>`:''}`}</div></div>`;}).join('')+'</div>';
  }
  $('#shopBody').innerHTML=html;requestAnimationFrame(()=>drawPicks($('#shopBody')));
};
function confirmBuy(kind,id){
  const it=kind==='pen'?PEN(id):ARENA(id);
  openModal(`<h3>Buy ${esc(it.name)}?</h3><p class="sub">${esc(it.desc)}</p>
    ${kind==='pen'?`<canvas class="pv" data-pen="${id}" style="width:100%;height:84px;display:block;margin:14px 0"></canvas>`:`<canvas class="pv desk" data-desk="${id}" style="width:100%;height:150px;display:block;margin:14px 0"></canvas>`}
    <div class="kv"><span>Price</span><b>${COIN}${fmt(it.price)}</b><span>Balance after</span><b>${COIN}${fmt(S.coins-it.price)}</b></div>
    <div class="btn-row"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="doBuy" data-kind="${kind}" data-id="${id}">${ICON('bag')} Buy</button></div>`);
}
function doBuy(kind,id){
  const it=kind==='pen'?PEN(id):ARENA(id);if(S.coins<it.price){SFX.deny();return;}
  const before=LEAGUES.map((_,i)=>leagueUnlocked(i));
  S.coins-=it.price;if(kind==='pen'){S.owned[id]=1;S.equip=id;}else S.desks[id]=1;
  persist();closeModal();SFX.buy();refreshCoins(true);
  toast(kind==='pen'?it.name+' equipped':it.name+' unlocked',kind==='pen'?CLASSES[classOf(it.mass)].name+' · '+it.mass+' g':'Pick it in Quick Match or Party',kind==='pen'?'pen':'desk');
  LEAGUES.forEach((L,i)=>{if(!before[i]&&leagueUnlocked(i))setTimeout(()=>toast('New league unlocked',L.name+' is open in Career','trophy'),600);});
  checkAch();RENDER.shop();
}

/* ---------- stats & profile ---------- */
RENDER.stats=function(){
  const st=S.stats,rate=st.matches?Math.round(st.wins/st.matches*100)+'%':'–',need=xpNeed(S.level),got=ACH.filter(a=>S.ach[a.id]).length;refreshCoins();
  const signedIn=isGoogleSignedIn();
  const pName=(S.profile&&S.profile.name)?S.profile.name:'Player';
  const hasAvatar=S.profile&&S.profile.avatar_url;
  const pEmail=S.profile&&S.profile.email;
  const trophies=S.trophies||100;
  const d=dailyState();
  
  const profileCard=`
    <div class="profile-header-card">
      <div style="display:flex;align-items:center;gap:14px;width:100%">
        <div class="profile-avatar-wrap" style="width:58px;height:58px;flex:none">
          ${hasAvatar
            ? `<img class="google-avatar" style="width:58px;height:58px;border-radius:50%;object-fit:cover" src="${esc(S.profile.avatar_url)}" alt="Avatar" referrerpolicy="no-referrer"><span class="lvl-badge" style="width:22px;height:22px;font-size:11px">${S.level}</span>`
            : `<div class="lvl" style="width:58px;height:58px;font-size:20px;--p:${Math.round(S.xp/need*100)}"><span>${S.level}</span></div>`
          }
        </div>
        <div style="flex:1;min-width:0;text-align:left">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <b style="font-size:19px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(pName)}</b>
            ${AUTH_UID?'<span class="cloud-pill"><span class="pulse-dot"></span> Cloud Active</span>':'<span class="cloud-pill offline"><span class="pulse-dot warn"></span> Offline</span>'}
          </div>
          <div class="gmail-pill" style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:3px 10px;margin-top:5px;max-width:100%">
            <svg style="width:13px;height:13px;flex:none"><use href="#i-google"/></svg>
            <span style="font-size:12px;color:#e2e8f0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(pEmail || 'Google Gamer Profile')}</span>
            <span class="chip good" style="font-size:9px;padding:1px 6px;flex:none">Verified</span>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;width:100%;flex-wrap:wrap">
        ${signedIn
          ? `<button class="btn sm" data-act="signOutGoogle" style="flex:1">${ICON('user')} Sign Out</button>`
          : `<button class="btn-google block" data-act="signInGoogle" style="flex:1;height:40px;font-size:13px"><svg><use href="#i-google"/></svg> Sign in with Google</button>`
        }
        <button class="btn sm primary" data-act="openLeaderboard" style="flex:1">${ICON('trophy')} Leaderboard</button>
      </div>
    </div>
  `;

  const editNameCard=`
    <div class="panel" style="margin-top:12px">
      <div class="label" style="margin-bottom:8px">
        <span>Change Gamer Name</span>
        <em>Updates in duels &amp; leaderboards</em>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <input class="txt" id="profileNameIn" maxlength="14" value="${esc(pName)}" placeholder="Your Name" style="font-size:15px;font-weight:700">
        <button class="btn primary" data-act="updateProfileName" style="flex:none;height:40px;padding:0 16px">${ICON('check')} Save</button>
      </div>
    </div>
  `;

  const dailyCard=`
    <div class="panel">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <h3 style="margin:0">${ICON('gift')} Daily Login Bonus</h3>
        <span class="chip ${d.claimed?'good':'next'}">${d.claimed?'Claimed Today':'Ready to Claim'}</span>
      </div>
      <p class="sub" style="margin-bottom:10px">Log in daily to level up your bonus streak. Day 7 streak awards 500 coins!</p>
      <div class="daily-streak-bar">
        ${DAILY.map((v,i)=>`
          <div class="daily-box ${i<d.idx||(d.claimed&&i===d.idx)?'done':''} ${i===d.idx&&!d.claimed?'today':''}">
            <span>Day ${i+1}</span>
            <b>${v}</b>
          </div>
        `).join('')}
      </div>
      <div style="text-align:center">
        ${d.claimed
          ? `<button class="btn block" disabled style="opacity:.7">Come Back Tomorrow for Day ${((d.idx+1)%7)+1} (+${DAILY[(d.idx+1)%7]} ${COIN})</button>`
          : `<button class="btn primary lg block" data-act="claimDailyBonusRpc">${ICON('gift')} Claim Day ${d.idx+1} Bonus (+${DAILY[d.idx]} Coins)</button>`
        }
      </div>
    </div>
  `;

  const items=[
    ['Trophies',`🏆 ${trophies}`],
    ['Matches',st.matches],
    ['Wins',st.wins],
    ['Win rate',rate],
    ['Online wins',st.onlineWins||0],
    ['Best streak',st.bestStreak],
    ['Knockouts',st.kos],
    ['Self KOs',st.selfKos],
    ['Rounds won',st.rounds],
    ['Trick shots',st.tricks],
    ['Flicks',st.shots],
    ['Coins earned',fmt(st.coinsEarned)]
  ];

  $('#statsBody').innerHTML=`
    ${profileCard}
    ${editNameCard}
    <div class="panel">
      <div class="profile" style="padding:0">
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <b style="font-size:15px">Level ${S.level}</b>
            <small style="color:var(--muted)">${fmt(S.xp)} / ${fmt(need)} XP</small>
          </div>
          <div class="xpbar"><i style="width:${S.xp/need*100}%"></i></div>
          <small style="display:block;color:var(--muted);margin-top:6px;font-size:12px">${Object.keys(S.owned).length}/${PENS.length} pens unlocked · ${got}/${ACH.length} trophies</small>
        </div>
      </div>
    </div>
    ${dailyCard}
    <div class="panel">
      <h3>Career stats</h3>
      <p class="sub" style="margin-bottom:12px">Track your total matches, KOs, and duel milestones.</p>
      <div class="sgrid">${items.map(i=>`<div class="stat"><b>${i[1]}</b><span>${i[0]}</span></div>`).join('')}</div>
    </div>
    <div class="panel">
      <h3>Trophies · ${got}/${ACH.length}</h3>
      ${ACH.map(a=>{const v=Math.min(a.v(S),a.n),ok=!!S.ach[a.id];
        return `<div class="ach ${ok?'got':''}"><div class="ic">${ICON(ok?a.ic:'lock')}</div><div class="meta"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>${!ok&&a.n>1?`<div class="pbar"><i style="width:${v/a.n*100}%"></i></div>`:''}</div>
          <span class="reward">${ok?ICON('check'):COIN+fmt(a.reward)}</span></div>`;}).join('')}
    </div>
  `;
};

/* ---------- settings ---------- */
RENDER.settings=function(){
  const s=S.settings,seg=(k,o)=>`<div class="seg">${o.map(([v,l])=>`<button class="${String(s[k])===String(v)?'on':''}" data-act="setS" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const sw=k=>`<button class="switch ${s[k]?'on':''}" data-act="toggleS" data-k="${k}" aria-pressed="${!!s[k]}"></button>`;
  const set=(t,d,ctl)=>`<div class="set"><div class="meta"><b>${t}</b><small>${d}</small></div>${ctl}</div>`;
  $('#settingsBody').innerHTML=`<div class="panel">
    ${set('Sound','Impacts, flicks and fanfares',sw('sound'))}
    ${set('Volume',`<span id="volTxt">${Math.round(s.volume*100)}%</span>`,`<input type="range" min="0" max="100" value="${Math.round(s.volume*100)}" id="volRange" style="max-width:220px">`)}
    ${set('Background music','Soft lo-fi loop while you play',sw('music'))}
    ${set('Vibration','Haptic feedback on hits (phones)',sw('vibrate'))}
    ${set('Screen shake','Camera shake on big impacts',sw('shake'))}
    ${set('Slow-motion knockouts','Dramatic slow-mo on a deciding KO',sw('slowmo'))}
    ${set('Aim guide','Full path predicts your exact slide',seg('guide',[['off','Off'],['line','Arrow'],['path','Full path']]))}
    ${set('Graphics','Use Low on older phones',seg('quality',[['high','High'],['low','Low']]))}
  </div>
  <div class="panel"><h3>Your color</h3><p class="sub">Your pen color in Career and Quick Match.</p><div class="swatches" style="margin-top:12px">${TEAM.map(t=>`<button class="sw ${S.profile.color===t.id?'on':''}" style="--sw:${t.c}" data-act="setColor" data-v="${t.id}" aria-label="${t.n}"></button>`).join('')}</div></div>
  <div class="panel"><h3>Data</h3><p class="sub">Progress is saved in this browser on this device.</p>
    <div class="btn-row" style="margin-top:14px"><button class="btn" data-act="replayTut">${ICON('help')} Replay tutorial hint</button><button class="btn danger" data-act="reset">${ICON('refresh')} Reset progress</button></div></div>`;
  $('#volRange').addEventListener('input',e=>{s.volume=e.target.value/100;$('#volTxt').textContent=e.target.value+'%';SND.setVol();persist();});
  $('#volRange').addEventListener('change',()=>SFX.ui());
};
RENDER.pause=function(){$('#pauseSub').textContent=(online()?'Online · the game keeps running · ':'')+`Round ${M.round} · ${M.players.map(p=>p.name+' '+p.score).join(' · ')}`;
  $('#scr-pause [data-act=restart]').classList.toggle('hidden',online());$('#scr-pause [data-act=resume]').lastChild.textContent=online()?' Back to the game':' Resume';};

/* ---------- online ---------- */
RENDER.online=function(){renderOnline();fetchOpenRooms();};
function renderOnline(){
  const el=$('#onlineBody');if(!el)return;refreshCoins();
  const signedIn=isGoogleSignedIn();
  const pName=(S.profile&&S.profile.name)?S.profile.name:'Player';
  const hasAvatar=S.profile&&S.profile.avatar_url;
  
  const playerBar=`
    <div class="profile-header-card" style="margin-bottom:12px;padding:12px 14px">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
        <div class="profile-avatar-wrap" style="width:40px;height:40px">
          ${hasAvatar
            ? `<img class="google-avatar" style="width:40px;height:40px" src="${esc(S.profile.avatar_url)}" alt="Avatar" referrerpolicy="no-referrer"><span class="lvl-badge">${S.level}</span>`
            : `<div class="av" style="--c:${teamColor(S.profile.color)};width:40px;height:40px">${esc(initials(pName))}</div>`
          }
        </div>
        <div style="min-width:0;flex:1">
          <b style="font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">${esc(pName)}</b>
          <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
            ${AUTH_UID?'<span class="cloud-pill"><span class="pulse-dot"></span> Cloud Active</span>':'<span class="cloud-pill offline"><span class="pulse-dot warn"></span> Offline</span>'}
            <small style="color:var(--muted);font-size:11px">🏆 ${S.trophies||100}</small>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex:none">
        <button class="btn sm" data-act="openLeaderboard" title="Leaderboard">${ICON('trophy')} Ranks</button>
        ${signedIn
          ? `<button class="btn sm ghost" data-act="go" data-to="stats" title="Account">${ICON('user')}</button>`
          : `<button class="btn-google sm" style="height:34px;padding:0 10px;font-size:12px" data-act="signInGoogle"><svg><use href="#i-google"/></svg> Sign in</button>`
        }
      </div>
    </div>
  `;

  if(NET.state==='loading'){
    el.innerHTML=`${playerBar}<div class="panel" style="text-align:center;padding:42px 18px"><div class="spinner"></div><h3 style="margin-top:18px">${esc(NET.busyText||'Connecting to online server…')}</h3>
      <p class="sub">Joining real-time multiplayer room…</p><button class="btn" style="margin-top:18px" data-act="netCancel">Cancel</button></div>`;return;}

  const prof=myProfile();
  const profileBits=`<div class="field"><div class="label">Your pen <em>bought pens work online too</em></div><div class="picker">${ownedPens().map(p=>penPick(p,p.id===prof.pen,'pickPen','online')).join('')}</div></div>
    <div class="field" style="margin-bottom:0"><div class="label">Your color</div><div class="swatches">${TEAM.map(t=>`<button class="sw ${prof.color===t.id?'on':''}" style="--sw:${t.c}" data-act="setColor" data-v="${t.id}" aria-label="${t.n}"></button>`).join('')}</div></div>`;

  if(NET.state==='lobby'&&NET.lobby){
    const L=NET.lobby,host=NET.role==='host',canShare=!!navigator.share;
    const rows=L.players.map(p=>{const col=teamColor(p.color),me=p.pid===NET.me;
      const avHtml=(me&&S.profile&&S.profile.avatar_url)
        ?`<img class="google-avatar" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex:none" src="${esc(S.profile.avatar_url)}" alt="Avatar" referrerpolicy="no-referrer">`
        :`<div class="av" style="--c:${col}">${p.cpu?ICON('cpu'):esc(initials(p.name))}</div>`;
      return `<div class="stand ${me?'first':''}">${avHtml}
        <div class="meta"><b>${esc(p.name)} ${me?'<span class="chip next">You</span>':''}${p.host?' <span class="chip">Host</span>':''}${p.cpu?' <span class="chip">CPU</span>':''}</b>
        <small>${esc(PEN(p.pen).name)} · ${CLASSES[classOf(PEN(p.pen).mass)].name}</small></div>
        ${host&&p.cpu?`<select class="sel" style="width:auto" data-cpu="${p.pid}" aria-label="CPU level">${Object.entries(QUICK_DIFF).map(([k,d])=>`<option value="${k}" ${k===p.cpu?'selected':''}>${d.n}</option>`).join('')}</select>
          <button class="icon-btn" data-act="netRemoveCpu" data-id="${p.pid}" aria-label="Remove CPU">${ICON('x')}</button>`:''}</div>`;}).join('');
    const settings=host?`<div class="field" style="margin-top:0"><div class="label">Desk <em>from your collection</em></div><div class="picker">${ARENAS.map(a=>deskPick(a,a.id===L.arena,'online')).join('')}</div></div>
      <div class="field"><div class="label">Rounds to win</div><div class="seg">${[1,2,3,5].map(n=>`<button class="${+L.need===n?'on':''}" data-act="netSet" data-k="need" data-v="${n}">${n}</button>`).join('')}</div></div>
      <div class="field" style="margin-bottom:0"><div class="label">Shot clock <em>keeps everyone moving</em></div><div class="seg">${[[0,'Off'],[10,'10 s'],[20,'20 s'],[30,'30 s']].map(([v,l])=>`<button class="${+L.clock===v?'on':''}" data-act="netSet" data-k="clock" data-v="${v}">${l}</button>`).join('')}</div></div>`
      :`<div class="kv" style="margin:0"><span>Desk</span><b>${esc(ARENA(L.arena).name)}</b><span>Rounds to win</span><b>${L.need}</b><span>Shot clock</span><b>${+L.clock?L.clock+' s':'Off'}</b></div>`;
    el.innerHTML=`${playerBar}
      <div class="panel" style="text-align:center"><div class="label" style="justify-content:center">Room code · Realtime</div><div class="roomcode">${esc(L.code)}</div>
        <div class="btn-row" style="justify-content:center"><button class="btn sm" style="flex:0 0 auto;min-width:0" data-act="netCopy">${ICON('copy')} Copy invite</button>${canShare?`<button class="btn sm" style="flex:0 0 auto;min-width:0" data-act="netShare">${ICON('share')} Share</button>`:''}</div>
        <p class="sub" style="margin-top:12px">${host?'Friends open Desk Duel, tap <b>Online</b>, then enter this code or join from the room list.':'You’re in! The host will start the match.'}</p></div>
      <div class="panel"><h3>Players · ${L.players.length}/3</h3><div class="standings" style="margin-top:10px">${rows}</div>
        ${host&&L.players.length<3?`<button class="btn block" style="margin-top:10px" data-act="netAddCpu">${ICON('cpu')} Add a CPU player</button>`:''}</div>
      <div class="panel"><h3 style="margin-bottom:10px">Match settings</h3>${settings}</div>
      <div class="panel"><h3 style="margin-bottom:4px">You</h3>${profileBits}</div>
      <div class="cta">${host?`<div class="note">${ICON('users')} ${L.players.length<2?'Waiting for at least one more player':'Ready when you are'}</div><button class="btn primary lg block ${L.players.length<2?'disabled':''}" data-act="netStart">${ICON('play')} Start match</button>`
        :`<div class="note">${ICON('users')} Waiting for the host to start…</div>`}<button class="btn block ghost" style="margin-top:8px" data-act="leaveRoom">Leave room</button></div>`;
    requestAnimationFrame(()=>drawPicks(el));return;
  }

  let openRoomsHtml='';
  if(OPEN_ROOMS&&OPEN_ROOMS.length){
    openRoomsHtml=`<div class="panel" style="margin-top:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <h3 style="margin:0">Active Rooms (${OPEN_ROOMS.length})</h3>
        <button class="btn sm ghost" data-act="refreshRooms">${ICON('refresh')} Refresh</button>
      </div>`+
      OPEN_ROOMS.map(r=>`
        <div class="room-card">
          <div class="code">${esc(r.code)}</div>
          <div class="info">
            <b>${esc(r.host_name||'Host')}’s room</b>
            <small>${esc(ARENA(r.arena||'classroom').name)} · First to ${r.need||2}</small>
          </div>
          <div class="room-count">${ICON('users')} ${r.player_count||1}/3</div>
          <button class="btn sm primary" data-act="joinDirectRoom" data-code="${esc(r.code)}">Join</button>
        </div>
      `).join('')+`</div>`;
  }

  el.innerHTML=`${playerBar}
    ${NET.err?`<div class="panel errbox">${ICON('x')}<span>${esc(NET.err)}</span></div>`:''}
    <div class="panel"><h3>Play online with friends</h3><p class="sub">2–3 players over real-time connection. Instant multiplayer across phones, PCs and tablets.</p>
      <div class="field"><div class="label">Your name</div><input class="txt" id="onName" maxlength="14" placeholder="Your name" value="${esc(S.profile.name||'')}" autocomplete="nickname"></div>${profileBits}</div>
    <div class="panel"><button class="btn primary lg block" data-act="netHost">${ICON('globe')} Create a room</button>
      <div class="or">or join with code</div>
      <div class="joinrow"><input class="txt codein" id="joinCode" maxlength="5" placeholder="CODE" value="${esc(UI.joinCode||'')}" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-label="Room code"><button class="btn lg" data-act="netJoin">Join</button></div></div>
    ${openRoomsHtml}
    <div class="panel" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px">
      <div style="display:flex;align-items:center;gap:8px">
        ${AUTH_UID?'<span class="cloud-pill"><span class="pulse-dot"></span> Cloud Save Active</span>':'<span class="cloud-pill offline"><span class="pulse-dot warn"></span> Offline</span>'}
        <span style="font-size:13px;font-weight:700">Matches &amp; stats sync automatically</span>
      </div>
      <button class="btn sm primary" data-act="openLeaderboard">${ICON('trophy')} Ranks</button>
    </div>
    <p class="sub" style="text-align:center;font-size:12px;margin:4px 8px 0">Powered by Supabase Realtime &amp; PostgreSQL. Matches and progress sync automatically.</p>`;
  requestAnimationFrame(()=>drawPicks(el));
}
$('#onlineBody').addEventListener('input',e=>{const el=e.target;
  if(el.id==='onName'){S.profile.name=el.value.slice(0,14);persist();}
  else if(el.id==='joinCode'){const v=el.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);if(v!==el.value)el.value=v;UI.joinCode=v;}});
$('#onlineBody').addEventListener('change',e=>{const el=e.target;
  if(el.id==='onName'){saveOnlineName();netUpdateProfile();}
  else if(el.dataset.cpu&&NET.role==='host'){const p=NET.lobby.players.find(x=>x.pid===el.dataset.cpu);if(p){p.cpu=el.value;netLobbyChanged();}}});
$('#onlineBody').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='joinCode'){e.preventDefault();ACT.netJoin();}});

/* ---------- results ---------- */
function finishMatch(){
  if(M.demo){startDemo();return;}
  if(isHost())netBroadcast({k:'matchEnd'});
  M.phase='matchEnd';
  const R=computeRewards(),sorted=[...M.players].sort((a,b)=>b.score-a.score||b.kos-a.kos),champ=sorted[0];
  if(isHost()){
    const sb=getSupabase();
    if(sb&&champ){
      try{
        // ids are real account ids (from the hello message), not the per-room 'H'/'G_x' keys
        const uidOf=p=>NET.uids.get(p.pid)||null;
        if(AUTH_UID)sb.from('deskduel_matches').insert({
          room_code:NET.code,
          arena:M.arena.id,
          rounds_to_win:M.need,
          winner_name:champ.name,
          winner_id:uidOf(champ),
          players:M.players.map(p=>({id:uidOf(p),name:p.name,score:p.score,kos:p.kos,pen:p.pen,human:p.human})),
          scores:M.players.map(p=>p.score)
        }).then(r=>{if(r.error)console.warn('match log:',r.error.message);},()=>{});
        roomUpdate({status:'lobby'});
      }catch(e){}
    }
  }
  const xpBefore=S.xp/xpNeed(S.level)*100,lvlBefore=S.level;let ups=[],unlockNote='';
  if(R){
    S.coins+=R.total;S.stats.coinsEarned+=R.total;S.stats.matches++;
    const streaky=M.mode==='quick'||M.mode==='career';
    if(R.won){
      S.stats.wins++;
      if(streaky){S.stats.streak++;S.stats.bestStreak=Math.max(S.stats.bestStreak,S.stats.streak);}
      if(R.flawless)S.stats.flawless++;
      if(M.mode==='quick'&&M.diff==='expert')S.stats.expertWins++;
      const tg=M.mode==='online'?25:M.mode==='career'?15:8;
      S.trophies=(S.trophies||100)+tg;
    }else{
      S.stats.losses++;
      if(streaky)S.stats.streak=0;
      if((S.trophies||100)>100){
        const tl=M.mode==='online'?10:5;
        S.trophies=Math.max(100,(S.trophies||100)-tl);
      }
    }
    if(M.mode==='party'){S.stats.party++;if(M.players.length===3)S.stats.party3++;}
    if(M.mode==='online'){S.stats.online++;if(R.won)S.stats.onlineWins++;}
    if(M.mode==='career'&&R.won){const o=M.career;S.career[o.id]=(S.career[o.id]||0)+1;S.stats.careerWins++;
      if(o.boss&&o.league<LEAGUES.length-1){const nl=LEAGUES[o.league+1];unlockNote=ownsClass(nl.cls)?`${nl.name} is now open!`:`${nl.name} unlocked. Buy a ${CLASSES[nl.cls].name} pen in the shop to enter.`;}}
    ups=addXp(R.xp);persist();syncProgressToCloud();
  }
  const won=R?R.won:true,title=R?(won?'Victory!':'Defeat'):`${champ.name} wins!`;
  let sub='';
  if(M.mode==='career')sub=won?`You beat ${M.career.name}`:`${M.career.name} wins this time. Try a new angle.`;
  else if(M.mode==='quick')sub=won?`You beat ${M.players[1].name} on ${QUICK_DIFF[M.diff].n}`:`${M.players[1].name} takes it. Rematch?`;
  else if(M.mode==='online')sub=won?'You won the online match':`${champ.name} wins the online match`;
  else sub=`${champ.name} is the desk champion`;
  let btns='';
  if(M.mode==='career'){const nx=nextOpp();
    btns=won?(nx&&oppUnlocked(nx)&&nx.id!==M.career.id?`<button class="btn primary lg" data-act="careerNext">${ICON('arrow')} Next rival</button><button class="btn lg" data-act="toCareer">Career</button>`:`<button class="btn primary lg" data-act="toCareer">${ICON('trophy')} Career</button><button class="btn lg" data-act="toShop">${ICON('bag')} Pen Shop</button>`)
      :`<button class="btn primary lg" data-act="rematch">${ICON('refresh')} Retry</button><button class="btn lg" data-act="toCareer">Career</button>`;}
  else if(M.mode==='online')btns=NET.on?`<button class="btn primary lg" data-act="toLobby">${ICON('users')} Back to lobby</button><button class="btn lg" data-act="leaveRoom">Leave room</button>`
      :`<button class="btn primary lg" data-act="toMenu">${ICON('home')} Menu</button>`;
  else btns=`<button class="btn primary lg" data-act="rematch">${ICON('refresh')} Rematch</button><button class="btn lg" data-act="toMenu">${ICON('home')} Menu</button>`;
  $('#resultsBody').innerHTML=`<div class="result-hero"><div class="medal ${won?'':'lose'}">${ICON(won?'trophy':'flag')}</div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>
    <div class="standings">${sorted.map((p,i)=>{
      const isMe=(p.human&&(online()?p.pid===NET.me:(p.name===(S.profile&&S.profile.name)||p.name==='You')));
      const avHtml=(isMe&&S.profile&&S.profile.avatar_url)
        ?`<img class="google-avatar" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex:none" src="${esc(S.profile.avatar_url)}" alt="Avatar" referrerpolicy="no-referrer">`
        :`<div class="av" style="--c:${p.col}">${esc(initials(p.name))}</div>`;
      return `<div class="stand ${i===0?'first':''}"><div class="pos">${i+1}</div>${avHtml}
        <div class="meta"><b>${esc(p.name)}</b><small>${esc(PEN(p.pen).name)} · ${p.kos} KO${p.kos===1?'':'s'}${p.selfKos?` · ${p.selfKos} self`:''}</small></div><div class="sc">${p.score}</div></div>`;
    }).join('')}</div>
    ${R?`<div class="panel" style="margin-top:14px"><h3>Rewards</h3><div class="rewards">${R.lines.map(l=>`<div class="rw"><span>${esc(l[0])}</span><b>+${fmt(l[1])} ${COIN}</b></div>`).join('')}
      <div class="rw total"><span>Total</span><b><span id="rwTotal">0</span> ${COIN}</b></div></div>
      <div class="label" style="margin-top:14px">Level ${S.level}${ups.length?' · level up!':''} <em>+${fmt(R.xp)} XP · balance ${fmt(S.coins)} coins</em></div><div class="xpbar"><i id="xpFill" style="width:${ups.length?0:xpBefore}%"></i></div></div>`:''}
    ${unlockNote?`<div class="panel" style="margin-top:14px;border-color:rgba(255,194,61,.45)"><h3>${ICON('trophy')} League unlocked</h3><p class="sub">${esc(unlockNote)}</p></div>`:''}
    <div class="btn-row" style="margin-top:16px">${btns}</div>`;
  document.body.classList.remove('in-match');hideRoundCard();NAV.length=0;showScreen('results',true);
  if(won){confetti();}else SFX.lose();
  if(R){
    $$('#resultsBody .rw').forEach((el,i)=>setTimeout(()=>{el.classList.add('in');if(!el.classList.contains('total'))SFX.coin();},250+i*170));
    const t0=now()+250+R.lines.length*170,tot=$('#rwTotal');
    const tick=()=>{const k=clamp((now()-t0)/700,0,1);tot.textContent=fmt(R.total*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(tick);else{refreshCoins(true);}};requestAnimationFrame(tick);
    setTimeout(()=>{const f=$('#xpFill');if(f)f.style.width=(S.xp/xpNeed(S.level)*100)+'%';},400);
    ups.forEach((u,i)=>setTimeout(()=>toast('Level '+u[0]+'!','+'+fmt(u[1])+' bonus coins','star','blue'),900+i*500));
    setTimeout(checkAch,1200);
  }
}

/* ---------- daily reward & welcome ---------- */
function dailyState(){const today=dayKey(),claimed=S.daily.last===today,yest=dayKey(new Date(Date.now()-864e5));
  const streak=claimed?S.daily.streak:(S.daily.last===yest?S.daily.streak+1:1);return {today,claimed,streak,idx:(streak-1)%7};}
function openDaily(){
  const d=dailyState();
  openModal(`<h3>Daily reward</h3><p class="sub">Come back every day. The 7th day pays the most.</p>
    <div class="days">${DAILY.map((v,i)=>`<div class="day ${i<d.idx||(d.claimed&&i===d.idx)?'done':''} ${i===d.idx&&!d.claimed?'today':''}">Day ${i+1}${COIN}<b>${v}</b></div>`).join('')}</div>
    <div class="btn-row"><button class="btn" data-act="closeModal">Close</button>${d.claimed?'<button class="btn" disabled>Come back tomorrow</button>':`<button class="btn primary" data-act="claimDaily">${ICON('gift')} Claim ${DAILY[d.idx]}</button>`}</div>`);
}
function claimDailyLocal(){const d=dailyState();if(d.claimed)return;const v=DAILY[d.idx];S.coins+=v;S.daily={last:d.today,streak:d.streak};persist();
  closeModal();SFX.buy();refreshCoins(true);toast('Daily reward','+'+v+' coins · day '+(d.idx+1)+' streak','gift');RENDER.menu();}
function welcome(){
  S.seenWelcome=1;persist();
  openModal(`<h3>Welcome to Desk Duel</h3><p class="sub">The pen fighting championship. Flick your pen, knock rivals off the desk, earn coins and work your way up from Featherweight to Titan.</p>
    <div class="kv"><span>Starting bonus</span><b>${COIN}500</b><span>Cloud Save</span>${AUTH_UID?'<b style="color:#4ade80">Active ✓</b>':'<b style="color:#fbbf24">This device</b>'}<span>Your pen</span><b>${esc(PEN('ballpoint').name)}</b></div>
    <div style="margin:14px 0">
      <button class="btn-google block" data-act="signInGoogle"><svg><use href="#i-google"/></svg> Sign in with Google to sync</button>
    </div>
    <div class="btn-row"><button class="btn" data-act="closeModal">Play as Guest</button><button class="btn primary" data-act="welcomeGo">${ICON('play')} Start Career</button></div>`);
}

/* ---------- actions ---------- */
function fullscreen(){try{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().then(()=>{try{screen.orientation.lock('portrait').catch(()=>{});}catch(e){}}).catch(()=>{});}catch(e){}}
const QUIET=new Set(['back','doBuy','claimDaily','claimDailyBonusRpc','roundNext']);
const ACT={
  go:el=>{if(el.dataset.tab)UI.shopTab=el.dataset.tab;closeModal();go(el.dataset.to);},
  back:()=>{SFX.back();if(SCREEN==='online'&&NET.on){ACT.leaveRoom();return;}back();},
  sound:()=>{S.settings.sound=S.settings.sound?0:1;SND.unlock();SND.setVol();persist();syncSoundIcon();if(SCREEN==='settings')RENDER.settings();},
  fullscreen,
  daily:openDaily,claimDaily:handleClaimDailyBonus,claimDailyBonusRpc:handleClaimDailyBonus,
  closeModal:()=>{closeModal();if(isGoogleSignedIn()&&(SCREEN==='auth'||!SCREEN))showScreen('menu',true);},
  welcomeGo:()=>{closeModal();go('career');},
  welcomeBonusGo:()=>{closeModal();showScreen('menu',true);},
  signInGoogle:()=>handleGoogleSignIn(),
  signOutGoogle:()=>handleGoogleSignOut(),
  saveGoogleProfile:()=>saveGoogleProfileFromModal(),
  openLeaderboard:el=>openLeaderboardModal(el&&el.dataset?el.dataset.tab:'trophies'),
  setLbFilter:el=>openLeaderboardModal(el.dataset.tab),
  oppPreview:el=>oppPreview(el.dataset.id),careerFight:el=>careerFight(el.dataset.id),
  pickPen:el=>{const id=el.dataset.id;if(el.dataset.scope==='career'){UI.careerPen=id;$$('#dialog .pick').forEach(b=>b.classList.toggle('on',b.dataset.id===id));const v=$('#vsPen');if(v)v.textContent=PEN(id).name;}
    else if(el.dataset.scope==='quick'){S.quick.pen=id;persist();RENDER.quick();}
    else if(el.dataset.scope==='online'){S.online.pen=id;persist();netUpdateProfile();renderOnline();}},
  pickDesk:el=>{const id=el.dataset.id;if(el.dataset.scope==='online'){S.online.arena=id;persist();if(NET.lobby&&NET.role==='host'){NET.lobby.arena=id;netLobbyChanged();}return;}
    if(el.dataset.scope==='quick')S.quick.arena=id;else S.party.arena=id;persist();RENDER[el.dataset.scope]();},
  setQ:el=>{S.quick[el.dataset.k]=el.dataset.k==='need'?+el.dataset.v:el.dataset.v;persist();RENDER.quick();},
  startQuick,
  partyN:el=>{S.party.n=+el.dataset.v;persist();RENDER.party();},
  slotType:el=>{const s=S.party.slots[+el.dataset.slot],v=el.dataset.v;if(s.type===v)return;s.type=v;
    if(v==='cpu'&&/^Player \d$/.test(s.name))s.name='CPU';else if(v==='human'&&/^CPU/.test(s.name))s.name='Player '+(+el.dataset.slot+1);persist();RENDER.party();},
  slotColor:el=>{S.party.slots[+el.dataset.slot].color=el.dataset.v;persist();RENDER.party();},
  setP:el=>{S.party[el.dataset.k]=+el.dataset.v;persist();RENDER.party();},
  startParty,
  shopTab:el=>{UI.shopTab=el.dataset.tab;RENDER.shop();},
  buyPen:el=>confirmBuy('pen',el.dataset.id),buyDesk:el=>confirmBuy('desk',el.dataset.id),doBuy:el=>doBuy(el.dataset.kind,el.dataset.id),
  equip:el=>{S.equip=el.dataset.id;S.quick.pen=el.dataset.id;persist();RENDER.shop();toast(PEN(el.dataset.id).name+' equipped','','pen');},
  setS:el=>{const k=el.dataset.k;S.settings[k]=el.dataset.v;persist();if(k==='quality'){layout();}RENDER.settings();},
  toggleS:el=>{const k=el.dataset.k;S.settings[k]=S.settings[k]?0:1;persist();if(k==='sound'||k==='music'){SND.unlock();SND.setVol();if(k==='sound')syncSoundIcon();}RENDER.settings();},
  setColor:el=>{S.profile.color=el.dataset.v;persist();netUpdateProfile();if(SCREEN==='online')renderOnline();else RENDER.settings();},
  replayTut:()=>{S.settings.tut=0;persist();toast('Tutorial hint on','It shows on your next turn','help','blue');},
  reset:()=>openModal(`<h3>Reset all progress?</h3><p class="sub">Coins, pens, desks, career, stats and trophies will be erased. This cannot be undone.</p>
    <div class="btn-row"><button class="btn" data-act="closeModal">Cancel</button><button class="btn danger" data-act="doReset">Erase everything</button></div>`),
  doReset:()=>{const keep=S.settings;S=defaultSave();S.settings=keep;S.seenWelcome=1;persist();closeModal();refreshCoins();RENDER.settings();toast('Progress reset','Fresh start with 500 coins','refresh','blue');},
  pause:()=>pause(true),resume:()=>pause(false),
  restart:()=>{M.paused=false;startMatch(M.opts);},
  quit:()=>openModal(online()?`<h3>Leave this online match?</h3><p class="sub">${isHost()?'You are the host, so the match ends for everyone.':'A CPU will take your place.'} No coins are awarded.</p>
    <div class="btn-row"><button class="btn" data-act="closeModal">Keep playing</button><button class="btn danger" data-act="doQuit">Leave</button></div>`:`<h3>Quit this match?</h3><p class="sub">The match will not count and no coins are awarded.</p>
    <div class="btn-row"><button class="btn" data-act="closeModal">Keep playing</button><button class="btn danger" data-act="doQuit">Quit</button></div>`),
  doQuit:()=>{closeModal();if(online())netLeave();toMenu();},
  roundNext:()=>nextRound(),
  rematch:()=>startMatch(M.opts),
  toMenu:()=>toMenu(),
  toCareer:()=>{toMenu();go('career');},
  toShop:()=>{toMenu();go('shop');},
  netHost:()=>{saveOnlineName();netHost();},
  netJoin:()=>{saveOnlineName();const c=$('#joinCode');netJoin(c?c.value:UI.joinCode);},
  netCancel:()=>{netLeave();renderOnline();},
  netStart:()=>hostStart(),
  netAddCpu:()=>netAddCpu(),
  netRemoveCpu:el=>{if(NET.role!=='host')return;NET.lobby.players=NET.lobby.players.filter(p=>p.pid!==el.dataset.id);netLobbyChanged();},
  netSet:el=>{const k=el.dataset.k,v=+el.dataset.v;S.online[k]=v;persist();if(NET.lobby&&NET.role==='host'){NET.lobby[k]=v;netLobbyChanged();}},
  netCopy:()=>{const l=shareLink();copyText('Join my Desk Duel room! Code: '+NET.code+(l?'\n'+l:'')).then(()=>toast('Copied','Send it to your friends','copy','blue'),()=>toast('Room code: '+NET.code,'Copy it manually','copy','blue'));},
  netShare:()=>{const l=shareLink();navigator.share({title:'Desk Duel',text:'Join my Desk Duel room! Code: '+NET.code,url:l||undefined}).catch(()=>{});},
  leaveRoom:()=>openModal(`<h3>Leave room ${esc(NET.code)}?</h3><p class="sub">${NET.role==='host'?'This closes the room for everyone in it.':'You can rejoin with the same code while the room is open.'}</p>
    <div class="btn-row"><button class="btn" data-act="closeModal">Stay</button><button class="btn danger" data-act="doLeaveRoom">Leave room</button></div>`),
  doLeaveRoom:()=>{closeModal();const wasGame=online()||SCREEN==='results';netLeave();if(wasGame)toMenu();if(SCREEN!=='online'){NAV.length=0;showScreen('menu');go('online');}else renderOnline();},
  toLobby:()=>{toMenu();go('online');},
  careerNext:()=>{const nx=nextOpp();toMenu();go('career');if(nx)setTimeout(()=>oppPreview(nx.id),120);},
  joinDirectRoom:el=>{
    const code=el.dataset.code;
    if(code){saveOnlineName();netJoin(code);}
  },
  refreshRooms:()=>{
    fetchOpenRooms().then(()=>toast('Rooms Refreshed','','refresh','blue'));
  },
  updateProfileName:()=>{
    const inp=$('#profileNameIn');
    if(inp)saveProfileName(inp.value);
  }
};
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');if(!el||el.disabled||el.classList.contains('disabled'))return;
  const f=ACT[el.dataset.act];if(!f)return;SND.unlock();if(!QUIET.has(el.dataset.act))SFX.ui();f(el,e);
});
addEventListener('keydown',e=>{
  if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')){
    if(e.key==='Enter'&&e.target.id==='profileNameIn'){
      saveProfileName(e.target.value);
    }
    return;
  }
  if(e.key==='Escape'){
    if(modalOpen()){closeModal();return;}
    if(M.on&&!M.demo&&M.phase!=='matchEnd'){if(DRAG){DRAG=null;hidePower();return;}if(SCREEN==='pause')pause(false);else if(SCREEN===null)pause(true);else back();}
    else if(SCREEN==='online'&&NET.on)ACT.leaveRoom();
    else if(SCREEN&&SCREEN!=='menu'&&SCREEN!=='results')back();
  }else if((e.key===' '||e.key==='Enter')&&M.phase==='roundEnd'&&!M.demo&&SCREEN===null){e.preventDefault();nextRound();}
});

/* ============================ MAIN LOOP ============================ */
let lastT=0,acc=0,lastDraw=0;
// Screens with an opaque background hide the canvas completely.
const OPAQUE=new Set(['auth','career','quick','party','online','shop','stats','settings','how','results']);
function frame(ts){
  const dt=Math.min(.05,Math.max(0,(ts-lastT)/1000));lastT=ts;
  requestAnimationFrame(frame);
  if(NET.role==='guest')guestTick();
  // Nothing visible to draw: skip the background demo entirely (big battery/CPU win).
  if((M.demo||!M.on)&&SCREEN&&OPAQUE.has(SCREEN)&&!modalOpen()){acc=0;return;}
  // The menu backdrop demo is decorative: 30 fps is plenty.
  if(M.demo&&ts-lastDraw<31){return;}
  const fdt=M.demo?Math.min(.05,(ts-(lastDraw||ts))/1000||dt):dt;lastDraw=ts;
  const run=M.on&&!M.paused&&M.W;let al=1;
  if(run){
    let sc=1;if(FX.slow>0){FX.slow=Math.max(0,FX.slow-dt);sc=FX.slow>.3?.3:lerp(1,.3,FX.slow/.3);}
    acc+=fdt*sc;let n=0;
    while(acc>=PH.tick&&n<8){for(const b of M.W.bodies){b.px=b.x;b.py=b.y;b.pa=b.a;}stepWorld(M.W,PH.tick,EV);trails();acc-=PH.tick;n++;}
    if(n>=8)acc=0;al=acc/PH.tick;
    updateMatch(fdt);updateFX(fdt*sc);
  }else updateFX(fdt);
  render(al,ts/1000);
}
function boot(){
  loadSave();initAudio(()=>S.settings);SND.setVol();layout();startDemo();
  const hasAuthInUrl=typeof location!=='undefined'&&(location.hash.includes('access_token')||location.search.includes('code='));
  if(!isGoogleSignedIn()&&!hasAuthInUrl){
    showScreen('auth');
  }else{
    showScreen('menu');
  }
  requestAnimationFrame(t=>{lastT=t;requestAnimationFrame(frame);});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{LAYERS.key='';DESK_CACHE.clear();});
  let room='';try{room=(new URLSearchParams(location.search).get('room')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);}catch(e){}
  if(room.length===5){
    UI.joinCode=room;
    S.seenWelcome=1;
    persist();
    if(isGoogleSignedIn()){
      go('online');
    }
  }
  initGoogleAuth();
  const sb=getSupabase();
  if(sb&&isGoogleSignedIn()){loadProgressFromCloud();fetchOpenRooms();}
}
addEventListener('resize',()=>{layout();DESK_CACHE.clear();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&M.on&&!M.demo&&!online()&&SCREEN===null&&!M.paused&&M.phase!=='roundEnd'&&M.phase!=='matchEnd')pause(true);});
document.addEventListener('pointerdown',()=>SND.unlock(),{passive:true});

  if(/[?&]ddtest\b/.test(location.search))window.__DD={M,NET,S:()=>S,VIEW,FX,screen:()=>SCREEN,PH,PENS,ARENAS,startMatch,predictPath,flick,stepWorld,makeWorld,makeBody,simulate,edgeMargin,aiCfg,Planner,cloneWorld};
  boot();
}
