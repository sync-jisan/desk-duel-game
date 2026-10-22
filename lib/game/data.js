// Generated from the single-file Desk Duel v2. Edit freely.
/* Game content: weight classes, pens, desks, career leagues, trophies. */
import {$,TAU,clamp,lerp,rand,randn,fmt,esc,now,initials,dayKey,mulberry,hashStr,_rgb,hex2rgb,shade,rgba,mix,ICON,COIN,$$} from './utils';
/* ============================== DATA =============================== */
const TEAM=[
  {id:'blue',c:'#3b82f6',n:'Blue'},{id:'red',c:'#ef4444',n:'Red'},{id:'green',c:'#22c55e',n:'Green'},
  {id:'amber',c:'#f59e0b',n:'Amber'},{id:'purple',c:'#a855f7',n:'Purple'},{id:'pink',c:'#ec4899',n:'Pink'},{id:'teal',c:'#14b8a6',n:'Teal'}];
const teamColor=id=>(TEAM.find(t=>t.id===id)||TEAM[0]).c;

/* Weight classes. The heavier the class, the tougher the rivals and the bigger the rewards. */
const CLASSES=[
  {id:'feather',name:'Featherweight',max:8,  col:'#7dd3fc',mult:1},
  {id:'light',  name:'Lightweight',  max:13, col:'#86efac',mult:1.3},
  {id:'middle', name:'Middleweight', max:20, col:'#fde047',mult:1.65},
  {id:'heavy',  name:'Heavyweight',  max:30, col:'#fb923c',mult:2.1},
  {id:'titan',  name:'Titan',        max:999,col:'#f472b6',mult:2.7}];
const classOf=mass=>{for(let i=0;i<CLASSES.length;i++)if(mass<=CLASSES[i].max)return i;return CLASSES.length-1;};

/* Pens: mass (g), length (mm), radius (mm), grip (friction multiplier), roll (sideways friction factor; round pens roll a little),
   e (bounciness), mat (sound material). All physics runs in real units: millimetres, grams, seconds. */
const PENS=[
  {id:'ballpoint',  name:'Matador Ballpoint',style:'ballpoint',  mass:6, len:148,rad:4.6,grip:1.0, roll:.82,e:.38,mat:'plastic',price:0,
   desc:'The school-bag classic. Light, quick and easy to control.'},
  {id:'pencil',     name:'Staedtler Noris HB', style:'pencil',     mass:5, len:172,rad:4.2,grip:1.08,roll:1,  e:.32,mat:'wood',   price:250,
   desc:'The famous striped HB. Longest reach in the game, and a hex body that never rolls.'},
  {id:'click',      name:'BIC 4-Colour',   style:'click',      mass:9, len:142,rad:5.4,grip:1.0, roll:.82,e:.38,mat:'plastic',price:600,
   desc:'Four colours, one chunky click barrel. A dependable all-rounder.'},
  {id:'gel',        name:'Pilot G2 Gel',    style:'gel',        mass:12,len:146,rad:5.9,grip:1.25,roll:.78,e:.26,mat:'rubber', price:1100,
   desc:'The rubber grip bites into the desk. Stops fast and is hard to shove.'},
  {id:'highlighter',name:'Stabilo Boss', style:'highlighter',mass:15,len:124,rad:7.8,grip:1.0, roll:.86,e:.34, mat:'plastic',price:1900,
   desc:'Short, flat and chunky. Its wide body blocks shots like a wall.'},
  {id:'marker',     name:'Sharpie Permanent', style:'marker',     mass:18,len:136,rad:7.2,grip:1.0, roll:.82,e:.34, mat:'plastic',price:2800,
   desc:'Heavy plastic with a real punch. Leaves a mark on every rival.'},
  {id:'fountain',   name:'Pelikan Souverän', style:'fountain',   mass:23,len:140,rad:6.4,grip:.9, roll:.82,e:.42, mat:'resin',  price:4200,
   desc:'Striped resin and a gold nib. Glides further than its weight suggests.'},
  {id:'steel',      name:'Zebra F-701',     style:'steel',      mass:29,len:146,rad:6.0,grip:.9, roll:.86,e:.48,mat:'metal',  price:6000,
   desc:'All-steel body with a knurled grip. Hits like a hammer.'},
  {id:'brass',      name:'Kaweco Brass Sport', style:'brass',      mass:37,len:140,rad:6.5,grip:.88,roll:1,  e:.44, mat:'metal',  price:7500,
   desc:'Solid octagonal brass. Slow to start, almost impossible to stop.'},
  {id:'gold',       name:'Parker Sonnet Gold', style:'gold',       mass:46,len:145,rad:7.0,grip:.86,roll:.86,e:.45,mat:'metal',  price:12000,
   desc:'Gold-plated luxury with serious mass behind every hit.'},
  {id:'tungsten',   name:'Montblanc Meisterstück', style:'tungsten',   mass:62,len:138,rad:7.0,grip:.85,roll:1,  e:.42,mat:'metal',  price:18000,
   desc:'The legendary flagship, weighted to the max. Only masters can make it move well.'}];
const PEN=id=>PENS.find(p=>p.id===id)||PENS[0];

/* Desks. Obstacles use portrait-normalised coordinates (u across, v down). */
const ARENAS=[
  {id:'classroom',name:'Classroom Desk',mat:'oak',   mu:.30,w:460,h:640,price:0,   desc:'Classic oak. Fair, friendly and wide open.',obs:[]},
  {id:'library',  name:'Library Table', mat:'walnut',mu:.32,w:480,h:660,price:500, desc:'Book stacks to hide behind and bank shots off.',
   obs:[{t:'box',k:'book',u:.17,v:.5,w:118,h:84,a:.14,c:'#9a3412'},{t:'box',k:'book',u:.83,v:.47,w:104,h:76,a:-.2,c:'#1e40af'},{t:'box',k:'eraser',u:.62,v:.45,w:48,h:22,a:.55,rr:5}]},
  {id:'exam',     name:'Exam Paper',    mat:'paper', mu:.34,w:420,h:590,price:800, desc:'A tight notebook page. Nowhere to hide.',obs:[]},
  {id:'office',   name:'Glass Office',  mat:'glass', mu:.23,w:500,h:680,price:1200,desc:'Slick smoked glass. Pens glide a long way.',
   obs:[{t:'circle',k:'mug',u:.21,v:.5,r:40,c:'#f1f5f9'},{t:'box',k:'stapler',u:.79,v:.52,w:44,h:118,a:.28,rr:9}]},
  {id:'artroom',  name:'Art Room Mat',  mat:'mat',   mu:.42,w:470,h:650,price:1800,desc:'Grippy cutting mat. Short slides, big hits.',
   obs:[{t:'circle',k:'jar',u:.15,v:.5,r:25,c:'#ef4444'},{t:'circle',k:'jar',u:.62,v:.52,r:25,c:'#3b82f6'},{t:'box',k:'ruler',u:.86,v:.62,w:170,h:20,a:1.57,rr:2}]},
  {id:'study',    name:'Mahogany Study',mat:'mahogany',mu:.28,w:500,h:690,price:2600,desc:'Leather inlay, an ink pot and a heavy old tome.',
   obs:[{t:'circle',k:'inkwell',u:.23,v:.5,r:28,c:'#1e293b'},{t:'box',k:'book',u:.77,v:.5,w:96,h:132,a:.18,c:'#14532d'}]},
  {id:'boardroom',name:'Boardroom Marble',mat:'marble',mu:.25,w:520,h:720,price:4000,desc:'Polished marble where only the big leagues play.',
   obs:[{t:'box',k:'nameplate',u:.34,v:.5,w:124,h:34,a:-.3,rr:4},{t:'circle',k:'cup',u:.12,v:.86,r:29},{t:'circle',k:'cup',u:.88,v:.14,r:29}]}];
const ARENA=id=>ARENAS.find(a=>a.id===id)||ARENAS[0];

const LEAGUES=[
  {id:'rookie',name:'Rookie Desk',cls:0,arena:'classroom',blurb:'Featherweights learn the ropes.',opp:[
    {id:'r1',name:'Danny Doodles',col:'#38bdf8',pen:'ballpoint',skill:.1, reward:60, need:2,quote:'I mostly just draw on desks.'},
    {id:'r2',name:'Pip Pencil',   col:'#eab308',pen:'pencil',   skill:.17,reward:80, need:2,quote:'Long pencil. Long reach. Long day for you.'},
    {id:'r3',name:'Sasha Sharp',  col:'#f472b6',pen:'pencil',   skill:.24,reward:100,need:2,quote:'Sharpened this morning. Just for you.'},
    {id:'r4',name:'Mr. Hall Monitor',col:'#ef4444',pen:'ballpoint',skill:.34,reward:200,need:3,boss:1,quote:'No running in the halls. No mercy on the desk.'}]},
  {id:'class',name:'Classroom Clash',cls:1,arena:'library',blurb:'Lightweights brawl between the book stacks.',opp:[
    {id:'c1',name:'Clicky Ken',  col:'#a78bfa',pen:'click',skill:.32,reward:120,need:2,quote:'Click. Click. Gone.'},
    {id:'c2',name:'Gel Gina',    col:'#34d399',pen:'gel',  skill:.38,reward:140,need:2,quote:'My grip never slips.'},
    {id:'c3',name:'Rosa Rubber', col:'#fb7185',pen:'gel',  skill:.44,reward:160,need:2,quote:'I bounce back. You bounce off.'},
    {id:'c4',name:'Captain Clipboard',col:'#f59e0b',pen:'click',skill:.53,reward:320,need:3,boss:1,quote:'Attendance is mandatory. So is losing.'}]},
  {id:'office',name:'Office Brawl',cls:2,arena:'office',blurb:'Middleweights on slick glass. Mind the coffee.',opp:[
    {id:'o1',name:'Intern Ivan',    col:'#22d3ee',pen:'highlighter',skill:.5, reward:200,need:2,quote:'First week on the job. Big plans.'},
    {id:'o2',name:'Hilda Highlight',col:'#facc15',pen:'highlighter',skill:.56,reward:230,need:2,quote:'I make important things stand out. Like your loss.'},
    {id:'o3',name:'Mark Sharpie',   col:'#64748b',pen:'marker',     skill:.61,reward:260,need:2,quote:'Permanent results only.'},
    {id:'o4',name:'The Middle Manager',col:'#3b82f6',pen:'marker',skill:.7,reward:500,need:3,boss:1,quote:'Let’s circle back to you falling off.'}]},
  {id:'exec',name:'Executive Suite',cls:3,arena:'study',blurb:'Heavyweights. Every hit sounds expensive.',opp:[
    {id:'e1',name:'Fiona Fountain',col:'#0ea5e9',pen:'fountain',skill:.68,reward:300,need:2,quote:'Ink runs in the family.'},
    {id:'e2',name:'Steel Steve',   col:'#94a3b8',pen:'steel',   skill:.73,reward:340,need:2,quote:'Forged, not bought.'},
    {id:'e3',name:'Duchess Ink',   col:'#c084fc',pen:'fountain',skill:.78,reward:380,need:2,quote:'Darling, this desk is mine.'},
    {id:'e4',name:'The CFO',       col:'#10b981',pen:'steel',   skill:.86,reward:750,need:3,boss:1,quote:'You are a cost I intend to cut.'}]},
  {id:'titan',name:'Titan Tower',cls:4,arena:'boardroom',blurb:'The heaviest pens. The best players. One throne.',opp:[
    {id:'t1',name:'Brass Knuckles Bo',col:'#d97706',pen:'brass',   skill:.84,reward:450,need:2,quote:'Heavy pen. Heavier hands.'},
    {id:'t2',name:'Goldie',           col:'#eab308',pen:'gold',    skill:.88,reward:500,need:2,quote:'Everything I touch turns to gold. Then falls.'},
    {id:'t3',name:'The Anvil',        col:'#475569',pen:'tungsten',skill:.93,reward:560,need:2,quote:'…'},
    {id:'t4',name:'The Chairman',     col:'#dc2626',pen:'tungsten',skill:1,  reward:1500,need:3,boss:1,quote:'This desk has had one owner for forty years.'}]}];
const ALL_OPP=LEAGUES.flatMap((l,li)=>l.opp.map((o,oi)=>Object.assign(o,{league:li,idx:oi})));

const QUICK_DIFF={easy:{skill:.14,win:20,n:'Easy'},medium:{skill:.42,win:35,n:'Medium'},hard:{skill:.68,win:55,n:'Hard'},expert:{skill:.92,win:80,n:'Expert'}};
const DAILY=[40,60,80,100,130,160,250];

const ACH=[
  {id:'first',  name:'First Flick',      desc:'Win your first match',                     reward:50,  ic:'flag',   v:s=>s.stats.wins,        n:1},
  {id:'ko25',   name:'Knockout Artist',  desc:'Knock 25 rival pens off the desk',         reward:120, ic:'target', v:s=>s.stats.kos,         n:25},
  {id:'ko100',  name:'Desk Destroyer',   desc:'Knock 100 rival pens off the desk',        reward:400, ic:'target', v:s=>s.stats.kos,         n:100},
  {id:'double', name:'Double Trouble',   desc:'Knock two rivals off with one flick',      reward:150, ic:'bolt',   v:s=>s.stats.doubleKos,   n:1},
  {id:'bank',   name:'Bank Shot',        desc:'Bounce off an obstacle into a knockout',   reward:100, ic:'refresh',v:s=>s.stats.bankKos,     n:1},
  {id:'spin',   name:'Spin Doctor',      desc:'Knock out a rival with a spinning pen',    reward:80,  ic:'refresh',v:s=>s.stats.spinKos,     n:1},
  {id:'sniper', name:'Sniper',           desc:'Knock out a rival from long range',        reward:80,  ic:'target', v:s=>s.stats.longKos,     n:1},
  {id:'chain',  name:'Chain Reaction',   desc:'Hit a rival into another rival for a KO',  reward:120, ic:'bolt',   v:s=>s.stats.chainKos,    n:1},
  {id:'close',  name:'Living on the Edge',desc:'Stop within 1 cm of the edge',            reward:60,  ic:'flag',   v:s=>s.stats.closeCalls,  n:1},
  {id:'flawless',name:'Flawless',        desc:'Win a first-to-3 match without dropping a round',reward:150,ic:'star',v:s=>s.stats.flawless,n:1},
  {id:'streak5',name:'On a Roll',        desc:'Win 5 matches in a row',                   reward:200, ic:'bolt',   v:s=>s.stats.bestStreak,  n:5},
  {id:'expert', name:'Expert Slayer',    desc:'Beat an Expert CPU in Quick Match',        reward:250, ic:'crown',  v:s=>s.stats.expertWins,  n:1},
  {id:'online', name:'Online Champion',  desc:'Win an online match against friends',   reward:150, ic:'globe',  v:s=>s.stats.onlineWins,  n:1},
  {id:'party',  name:'Party Animal',     desc:'Finish a 3-player Party match',            reward:60,  ic:'users',  v:s=>s.stats.party3,      n:1},
  {id:'heavy',  name:'Heavy Hitter',     desc:'Own a Heavyweight pen',                    reward:150, ic:'weight', v:s=>ownsClassIn(s,3)?1:0,    n:1},
  {id:'titanp', name:'Titan Owner',      desc:'Own a Titan-class pen',                    reward:400, ic:'weight', v:s=>ownsClassIn(s,4)?1:0,    n:1},
  {id:'collect',name:'Collector',        desc:'Own 6 different pens',                     reward:250, ic:'pen',    v:s=>Object.keys(s.owned).length,n:6},
  {id:'champ',  name:'Desk Champion',    desc:'Defeat The Chairman in Titan Tower',       reward:1500,ic:'crown',  v:s=>s.career.t4?1:0,     n:1}];

const ownsClassIn=(s,c)=>Object.keys(s.owned).some(id=>classOf(PEN(id).mass)>=c);

export {TEAM,teamColor,CLASSES,classOf,PENS,PEN,ARENAS,ARENA,LEAGUES,ALL_OPP,QUICK_DIFF,DAILY,ACH,ownsClassIn};
