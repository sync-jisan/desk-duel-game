// Generated from the single-file Desk Duel v2. Edit freely.
/* The game runtime: save data, audio, renderer, match rules, online play and UI.
   startGame() wires everything to the DOM rendered by components/GameMarkup.jsx. */
import {$,TAU,clamp,lerp,rand,randn,fmt,esc,now,initials,dayKey,mulberry,hashStr,_rgb,hex2rgb,shade,rgba,mix,ICON,COIN,$$} from './utils';
import {TEAM,teamColor,CLASSES,classOf,PENS,PEN,ARENAS,ARENA,LEAGUES,ALL_OPP,QUICK_DIFF,DAILY,ACH,ownsClassIn} from './data';
import {PH,OBS_MAT,flickSpeed,makeWorld,makeBody,cloneWorld,edgeMargin,SUP,friction,SS,segSeg,closestSeg,capsuleDist,CAND,cand,newContact,pushContact,wake,emitManifold,capCap,capCircle,CLIP,clipRect,capBox,prep,applyImp,solveV,solveB,substep,stepWorld,flick,bodiesResting,settled,simulate,predictPath,aiCfg,clearLine,scoreState,Planner} from './physics';

let started=false;
export function startGame(){
  if(started)return; // React Strict Mode runs effects twice in development
  started=true;
  /* ============================== SAVE =============================== */
  const SAVE_KEY='deskduel.save.v2';
  const DEF_SETTINGS={sound:1,volume:.8,vibrate:1,shake:1,guide:'path',slowmo:1,quality:'high',tut:0};
  function defaultSave(){return {v:2,coins:250,xp:0,level:1,owned:{ballpoint:1},equip:'ballpoint',desks:{classroom:1},career:{},
    stats:{matches:0,wins:0,losses:0,streak:0,bestStreak:0,rounds:0,roundsLost:0,kos:0,selfKos:0,shots:0,tricks:0,coinsEarned:0,
      doubleKos:0,bankKos:0,spinKos:0,longKos:0,chainKos:0,closeCalls:0,flawless:0,expertWins:0,party:0,party3:0,careerWins:0,online:0,onlineWins:0},
    ach:{},daily:{last:'',streak:0},settings:Object.assign({},DEF_SETTINGS),
    quick:{diff:'medium',need:2,arena:'classroom',pen:'ballpoint'},
    party:{n:3,need:2,arena:'classroom',clock:0,slots:[
      {name:'Player 1',type:'human',skill:'medium',color:'blue',pen:'ballpoint'},
      {name:'Player 2',type:'human',skill:'medium',color:'red',pen:'ballpoint'},
      {name:'CPU',type:'cpu',skill:'medium',color:'green',pen:'ballpoint'}]},
    profile:{color:'blue',name:''},online:{arena:'classroom',need:2,clock:20,pen:''},seenWelcome:0};}
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
    if(!S.owned[S.equip])S.equip='ballpoint';
    if(!S.desks.classroom)S.desks.classroom=1;
  }
  function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(S));}catch(e){}}
  function migrateV1(){
    // Carry over the first version's stats and settings, with a small veteran bonus.
    try{
      const st=JSON.parse(localStorage.getItem('dd_stats')||'null'),se=JSON.parse(localStorage.getItem('dd_settings')||'null');
      if(se){S.settings.sound=se.sound==='0'?0:1;S.settings.vibrate=se.vibrate==='0'?0:1;S.settings.shake=se.shake==='0'?0:1;}
      if(st&&st.played){S.stats.matches=st.played|0;S.stats.wins=st.wins|0;S.stats.losses=st.losses|0;S.stats.bestStreak=st.best|0;S.stats.rounds=st.roundsWon|0;
        S._veteran=Math.min(600,(st.wins|0)*20);S.coins+=S._veteran;}
    }catch(e){}
  }
  const ownsClass=c=>ownsClassIn(S,c);

  /* ============================== AUDIO ============================== */
  const SND={ctx:null,master:null,noise:null,muted:false,
    unlock(){
      if(!this.ctx){
        try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;this.ctx=new C();
          const comp=this.ctx.createDynamicsCompressor();comp.threshold.value=-12;comp.ratio.value=5;
          this.master=this.ctx.createGain();this.master.connect(comp);comp.connect(this.ctx.destination);
          const n=this.ctx.sampleRate,b=this.ctx.createBuffer(1,n,n),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;this.noise=b;
        }catch(e){this.ctx=null;return;}
      }
      if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
      this.setVol();
    },
    setVol(){if(this.master)this.master.gain.value=S.settings.sound?S.settings.volume*.9:0;},
    ok(){return !!this.ctx&&S.settings.sound&&!this.muted&&this.ctx.state==='running';},
    tone(f,d,o={}){
      if(!this.ok())return;const c=this.ctx,t=c.currentTime+(o.delay||0),os=c.createOscillator(),g=c.createGain();
      os.type=o.type||'sine';os.frequency.setValueAtTime(f,t);if(o.to)os.frequency.exponentialRampToValueAtTime(Math.max(20,o.to),t+d);
      const v=o.vol==null?.15:o.vol;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+(o.attack||.004));g.gain.exponentialRampToValueAtTime(.0001,t+d);
      os.connect(g);g.connect(this.master);os.start(t);os.stop(t+d+.05);
    },
    noiseB(d,o={}){
      if(!this.ok())return;const c=this.ctx,t=c.currentTime+(o.delay||0),s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
      s.buffer=this.noise;f.type=o.type||'bandpass';f.frequency.setValueAtTime(o.f||1000,t);if(o.to)f.frequency.exponentialRampToValueAtTime(o.to,t+d);f.Q.value=o.q==null?1:o.q;
      const v=o.vol==null?.2:o.vol;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+(o.attack||.002));g.gain.exponentialRampToValueAtTime(.0001,t+d);
      s.connect(f);f.connect(g);g.connect(this.master);s.start(t,Math.random()*.5);s.stop(t+d+.05);
    }};
  const MATSND={
    plastic:{f:2600,q:1.4,body:780,ring:0,dur:.05}, wood:{f:1500,q:1.8,body:430,ring:0,dur:.05}, rubber:{f:950,q:.8,body:260,ring:0,dur:.04},
    resin:{f:2200,q:2,body:900,ring:.3,dur:.06}, metal:{f:4300,q:3.5,body:1650,ring:1,dur:.07}, book:{f:650,q:.9,body:170,ring:0,dur:.05},
    ceramic:{f:3200,q:4,body:2300,ring:.8,dur:.06}, glass:{f:3900,q:5,body:2900,ring:1,dur:.06}};
  const SFX={
    ui(){SND.tone(720,.05,{vol:.06});SND.tone(1080,.04,{vol:.03,delay:.02});},
    back(){SND.tone(560,.07,{vol:.06,to:430});},
    grab(){SND.tone(460,.05,{type:'triangle',vol:.05});},
    flick(p){SND.noiseB(.035,{type:'highpass',f:2600,vol:.22+.22*p});SND.tone(250,.07,{type:'triangle',vol:.08+.08*p,to:115});},
    hit(k,ma,mb,mass){
      if(!SND.ok())return;const A=MATSND[ma]||MATSND.plastic,B=MATSND[mb]||A,v=.05+.36*k,body=(A.body+B.body)/2;
      SND.noiseB(Math.max(A.dur,B.dur),{f:(A.f+B.f)/2*(.9+Math.random()*.2),q:(A.q+B.q)/2,vol:v});
      SND.tone(body*(.95+Math.random()*.1),.05+.05*k,{type:'triangle',vol:v*.35,to:body*.7});
      const ring=Math.max(A.ring,B.ring);if(ring){SND.tone(body*2.1,.28*ring,{vol:v*.12*ring});SND.tone(body*3.3,.2*ring,{vol:v*.07*ring});}
      if(mass>18)SND.tone(105,.1,{vol:v*.55*clamp(mass/60,0,1),to:55});
    },
    fall(){SND.noiseB(.5,{f:1500,to:260,q:.8,vol:.11});[.47,.57,.65].forEach((d,i)=>SND.noiseB(.06,{f:2300-i*300,q:2,vol:.13/(i+1),delay:d}));SND.tone(150,.12,{vol:.12,delay:.47,to:70});},
    ko(){SND.tone(110,.6,{vol:.3,to:36});SND.noiseB(.35,{type:'lowpass',f:900,vol:.18});},
    coin(){SND.tone(1318,.09,{type:'triangle',vol:.08});SND.tone(1760,.16,{type:'triangle',vol:.08,delay:.07});},
    win(){[523,659,784,1047].forEach((f,i)=>SND.tone(f,.22,{type:'triangle',vol:.1,delay:i*.11}));SND.tone(1047,.7,{vol:.06,delay:.44});},
    lose(){[392,330,262].forEach((f,i)=>SND.tone(f,.3,{type:'triangle',vol:.08,delay:i*.17}));},
    round(){SND.noiseB(.45,{f:500,to:3200,q:.7,vol:.07});SND.tone(392,.12,{type:'triangle',vol:.07,delay:.05});SND.tone(587,.22,{type:'triangle',vol:.07,delay:.15});},
    turn(){SND.tone(880,.08,{vol:.05});SND.tone(1320,.1,{vol:.04,delay:.06});},
    tick(){SND.tone(1250,.03,{type:'square',vol:.035});},
    trick(){[880,1175,1568,2093].forEach((f,i)=>SND.tone(f,.13,{type:'triangle',vol:.07,delay:i*.06}));},
    buy(){SFX.coin();SND.tone(660,.35,{vol:.06,delay:.15});SND.tone(990,.35,{vol:.04,delay:.22});},
    deny(){SND.tone(200,.12,{type:'square',vol:.05});SND.tone(150,.15,{type:'square',vol:.05,delay:.08});}};
  function buzz(ms){if(S.settings.vibrate&&!SND.muted&&navigator.vibrate){try{navigator.vibrate(ms);}catch(e){}}}


  /* ============================ RENDERER ============================ */
  const cv=$('#game'),ctx=cv.getContext('2d');
  const VIEW={w:1,h:1,dpr:1,sc:1,ox:0,oy:0};
  const LAYERS={floor:document.createElement('canvas'),desk:document.createElement('canvas'),key:''};
  const LIGHT={x:-.45,y:-.89};
  const px=n=>n/VIEW.sc;

  function rr(c,x,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
  function capsulePath(c,h,r){c.beginPath();c.moveTo(-h,-r);c.lineTo(h,-r);c.arc(h,0,r,-Math.PI/2,Math.PI/2);c.lineTo(-h,r);c.arc(-h,0,r,Math.PI/2,Math.PI*1.5);c.closePath();}

  /* ---------- pen painting (local frame: x along the pen, tip at +L/2, lit side = -y) ---------- */
  function cyl(c,base,r,k=1){const g=c.createLinearGradient(0,-r,0,r);
    g.addColorStop(0,shade(base,.16*k));g.addColorStop(.2,shade(base,.5*k));g.addColorStop(.42,base);g.addColorStop(.78,shade(base,-.32));g.addColorStop(1,shade(base,-.62));return g;}
  function metal(c,base,r){const g=c.createLinearGradient(0,-r,0,r);
    g.addColorStop(0,shade(base,-.12));g.addColorStop(.14,shade(base,.78));g.addColorStop(.3,shade(base,.18));g.addColorStop(.55,shade(base,-.2));g.addColorStop(.72,shade(base,.28));g.addColorStop(1,shade(base,-.58));return g;}
  function bodyPath(c,x0,x1,r,rb,rf){
    rb=Math.max(0,Math.min(rb,r,(x1-x0)/2));rf=Math.max(0,Math.min(rf,r,(x1-x0)/2));c.beginPath();c.moveTo(x0+rb,-r);c.lineTo(x1-rf,-r);
    if(rf>0)c.arcTo(x1,-r,x1,-r+rf,rf);c.lineTo(x1,r-rf);if(rf>0)c.arcTo(x1,r,x1-rf,r,rf);c.lineTo(x0+rb,r);
    if(rb>0)c.arcTo(x0,r,x0,r-rb,rb);c.lineTo(x0,-r+rb);if(rb>0)c.arcTo(x0,-r,x0+rb,-r,rb);c.closePath();}
  function fb(c,x0,x1,r,rb,rf,fill){bodyPath(c,x0,x1,r,rb,rf);c.fillStyle=fill;c.fill();}
  function cone(c,x0,x1,r0,r1,fill){c.beginPath();c.moveTo(x0,-r0);c.lineTo(x1,-r1);c.lineTo(x1,r1);c.lineTo(x0,r0);c.closePath();c.fillStyle=fill;c.fill();}
  function band(c,x0,x1,r,fill){c.fillStyle=fill;c.fillRect(x0,-r,x1-x0,2*r);}
  function gloss(c,x0,x1,r,a=.34){c.save();c.translate(0,-r*.5);bodyPath(c,x0,x1,r*.14,r*.14,r*.14);c.fillStyle=`rgba(255,255,255,${a})`;c.fill();c.restore();}
  function hline(c,x0,x1,y,col,w){c.beginPath();c.moveTo(x0,y);c.lineTo(x1,y);c.strokeStyle=col;c.lineWidth=w;c.stroke();}
  function label(c,text,x,y,size,col,lit){c.save();c.scale(1,lit);c.fillStyle=col;c.font=`800 ${size}px Rubik,system-ui,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,x,y);c.restore();}

  const PEN_ART={
    ballpoint(c,L,r,T,lit){const h=L/2;
      fb(c,-h+28,h-20,r*.96,0,1.5,cyl(c,mix('#dbe6f3',T,.2),r));
      c.globalAlpha=.9;band(c,-h+30,h-24,r*.22,shade(T,-.1));c.globalAlpha=1;
      hline(c,-h+29,h-21,-r*.47,'rgba(255,255,255,.4)',.5);hline(c,-h+29,h-21,r*.47,'rgba(0,0,0,.18)',.5);
      cone(c,h-20,h-5,r*.9,r*.3,cyl(c,'#e9eef4',r));cone(c,h-5,h-.4,r*.3,r*.12,'#4b5563');
      fb(c,-h,-h+32,r*1.06,r*.95,1.2,cyl(c,T,r));
      fb(c,-h+5,-h+42,r*.36,1,r*.36,cyl(c,shade(T,.12),r*.4));
      gloss(c,-h+30,h-24,r);},
    pencil(c,L,r,T,lit){const h=L/2,x0=-h+25,x1=h-26;
      fb(c,-h,-h+12,r*.94,r*.85,0,cyl(c,'#f39ab0',r));
      fb(c,-h+11,-h+25,r*1.01,0,0,metal(c,'#c9ced6',r));
      c.fillStyle='rgba(0,0,0,.22)';for(const x of [-h+14,-h+17.5,-h+21])c.fillRect(x,-r,1,2*r);
      cone(c,x1,h-6,r,r*.32,'#e8c48e');cone(c,h-6,h,r*.32,r*.05,'#2b2b2b');
      const f=[['#ffd95a',-r,-r/3],['#f5b700',-r/3,r/3],['#cf9200',r/3,r]];
      for(const [col,y0,y1] of f){c.fillStyle=col;c.fillRect(x0,y0,x1-x0,y1-y0);
        c.beginPath();c.arc(x1,(y0+y1)/2,(y1-y0)/2,-Math.PI/2,Math.PI/2);c.fill();}
      hline(c,x0,x1,-r/3,'rgba(255,255,255,.35)',.5);hline(c,x0,x1,r/3,'rgba(0,0,0,.2)',.5);
      fb(c,x0+2,x0+8,r,0,0,cyl(c,T,r));
      label(c,'HB',x0+30,0,r*1.05,'rgba(60,40,0,.55)',lit);
      gloss(c,x0,x1,r,.25);},
    click(c,L,r,T,lit){const h=L/2;
      fb(c,-h+6,h-36,r,r*.9,0,cyl(c,T,r));
      fb(c,h-38,h-14,r*1.02,1,1,cyl(c,'#1f2937',r));
      c.fillStyle='rgba(255,255,255,.1)';for(let x=h-36;x<h-16;x+=3)c.fillRect(x,-r,1.2,2*r);
      cone(c,h-14,h-3,r*.92,r*.3,metal(c,'#cbd5e1',r));cone(c,h-3,h,r*.3,r*.1,'#475569');
      fb(c,-h,-h+8,r*.55,r*.5,0,cyl(c,shade(T,.25),r*.55));
      band(c,-h+6,-h+9,r*1.02,metal(c,'#d1d5db',r));
      fb(c,-h+9,-h+54,r*.42,1,r*.42,metal(c,'#e5e7eb',r*.42));
      gloss(c,-h+10,h-38,r);},
    gel(c,L,r,T,lit){const h=L/2;
      c.globalAlpha=.92;fb(c,-h+30,h-34,r*.97,0,0,cyl(c,'#cfd8e3',r));c.globalAlpha=1;
      band(c,-h+32,h-36,r*.34,shade(T,-.05));
      fb(c,h-36,h-12,r*1.05,1.5,1.5,cyl(c,shade(T,-.35),r));
      c.fillStyle='rgba(0,0,0,.28)';for(let x=h-33;x<h-14;x+=3.4)for(const y of [-r*.55,0,r*.55]){c.beginPath();c.arc(x,y,r*.13,0,TAU);c.fill();}
      cone(c,h-12,h-3,r*.9,r*.28,cyl(c,'#e2e8f0',r));cone(c,h-3,h,r*.28,r*.1,'#475569');
      fb(c,-h,-h+34,r*1.08,r*.95,1,cyl(c,T,r));
      fb(c,-h+4,-h+44,r*.38,1,r*.38,cyl(c,shade(T,.3),r*.4));
      gloss(c,-h+32,h-36,r);},
    highlighter(c,L,r,T,lit){const h=L/2,neon=mix(T,'#ffffff',.22);
      fb(c,-h,h-31,r,r*.55,0,cyl(c,neon,r));
      c.fillStyle='rgba(255,255,255,.85)';c.fillRect(-h+16,-r*.62,44,r*1.24);
      label(c,'HI-LITE',-h+38,0,r*.62,shade(T,-.5),lit);
      fb(c,h-34,h,r*1.05,0,r*.7,cyl(c,shade(T,-.12),r));
      band(c,h-35,h-33.6,r*1.05,'rgba(0,0,0,.28)');
      fb(c,h-30,h-6,r*.34,1,r*.34,cyl(c,shade(T,.25),r*.34));
      gloss(c,-h+6,h-34,r);},
    marker(c,L,r,T,lit){const h=L/2;
      fb(c,-h+12,h-38,r,0,0,cyl(c,'#222a38',r));
      c.fillStyle=cyl(c,'#f1f5f9',r);c.fillRect(-h+26,-r,54,2*r);
      band(c,-h+26,-h+29,r,cyl(c,T,r));
      label(c,'PERMANENT',-h+54,0,r*.55,'#111827',lit);
      fb(c,-h,-h+14,r*.98,r*.8,0,cyl(c,T,r));
      fb(c,h-40,h,r*1.06,0,r*.75,cyl(c,T,r));
      fb(c,h-36,h-8,r*.36,1,r*.36,cyl(c,shade(T,.25),r*.36));
      gloss(c,-h+12,h-40,r,.25);},
    fountain(c,L,r,T,lit){const h=L/2,G='#d4a63a';
      fb(c,-h+30,h-30,r*.95,0,0,cyl(c,'#141b2c',r,1.5));
      fb(c,-h,-h+46,r*1.06,r*.9,0,cyl(c,'#0b1120',r,1.5));
      band(c,-h+40,-h+46,r*1.07,metal(c,G,r));band(c,-h+33,-h+36,r*1.07,cyl(c,T,r));
      fb(c,-h,-h+5,r*.72,r*.62,0,metal(c,G,r*.72));
      fb(c,-h+6,-h+47,r*.36,1,r*.36,metal(c,G,r*.36));
      band(c,h-31,h-29,r*.96,metal(c,G,r));
      fb(c,h-29,h-18,r*.78,0,1,cyl(c,'#1f2937',r));
      c.beginPath();c.moveTo(h-19,-r*.72);c.quadraticCurveTo(h-7,-r*.62,h,0);c.quadraticCurveTo(h-7,r*.62,h-19,r*.72);c.closePath();c.fillStyle=metal(c,G,r*.72);c.fill();
      hline(c,h-12,h,0,'rgba(60,40,0,.75)',.5);c.fillStyle='rgba(60,40,0,.75)';c.beginPath();c.arc(h-13,0,.9,0,TAU);c.fill();
      gloss(c,-h+46,h-30,r,.24);},
    steel(c,L,r,T,lit){const h=L/2;
      fb(c,-h+1,h-22,r,r*.6,0,metal(c,'#9aa3ae',r));
      for(let i=1;i<8;i++)hline(c,-h+3,h-24,-r+i*r/4,i%2?'rgba(255,255,255,.07)':'rgba(0,0,0,.06)',.35);
      c.save();c.beginPath();c.rect(h-50,-r,26,2*r);c.clip();c.strokeStyle='rgba(0,0,0,.3)';c.lineWidth=.6;
      for(let x=h-64;x<h-14;x+=2.6){c.beginPath();c.moveTo(x,-r);c.lineTo(x+2*r,r);c.moveTo(x+2*r,-r);c.lineTo(x,r);c.stroke();}c.restore();
      band(c,-h+30,-h+36,r*1.01,cyl(c,T,r));
      cone(c,h-22,h-4,r,r*.28,metal(c,'#d1d5db',r));cone(c,h-4,h,r*.28,r*.1,'#374151');
      fb(c,-h+4,-h+46,r*.42,1,r*.42,metal(c,'#e5e7eb',r*.42));},
    brass(c,L,r,T,lit){const h=L/2;
      fb(c,-h+1,h-20,r,r*.35,0,metal(c,'#c79a3e',r));
      hline(c,-h+2,h-21,-r/3,'rgba(255,240,200,.35)',.5);hline(c,-h+2,h-21,r/3,'rgba(60,35,0,.3)',.5);
      for(const x of [-h+40,-h+44,h-42,h-38])band(c,x,x+1.2,r*1.01,'rgba(60,35,0,.45)');
      band(c,-h+26,-h+32,r*1.01,cyl(c,T,r));
      cone(c,h-20,h-4,r,r*.3,metal(c,'#d7b46a',r));cone(c,h-4,h,r*.3,r*.1,'#3f2d10');},
    gold(c,L,r,T,lit){const h=L/2;
      fb(c,-h,h-26,r,r*.85,0,metal(c,'#e8bf55',r));
      c.save();bodyPath(c,-h+8,h-30,r,0,0);c.clip();c.strokeStyle='rgba(120,80,0,.2)';c.lineWidth=.5;
      for(let x=-h-10;x<h;x+=3.2){c.beginPath();c.moveTo(x,-r);c.lineTo(x+r*1.6,r);c.stroke();}c.restore();
      band(c,-h+22,-h+28,r*1.02,cyl(c,'#111827',r));band(c,-h+24,-h+26,r*1.03,cyl(c,T,r));
      fb(c,h-28,h-14,r*.82,0,1,cyl(c,'#111827',r));
      cone(c,h-14,h-3,r*.8,r*.26,metal(c,'#f1d58a',r));cone(c,h-3,h,r*.26,r*.1,'#3f2d10');
      fb(c,-h+4,-h+48,r*.4,1,r*.4,metal(c,'#f5d57a',r*.4));},
    tungsten(c,L,r,T,lit){const h=L/2;
      fb(c,-h,h-20,r,r*.3,0,metal(c,'#555c69',r));
      hline(c,-h+1,h-21,-r/3,'rgba(255,255,255,.18)',.5);hline(c,-h+1,h-21,r/3,'rgba(0,0,0,.35)',.5);
      c.save();c.shadowColor=T;c.shadowBlur=8*VIEW.dpr;band(c,-h+24,-h+30,r*1.02,cyl(c,T,r));band(c,h-34,h-31,r*1.02,cyl(c,T,r));c.restore();
      cone(c,h-20,h-4,r,r*.3,metal(c,'#6b7280',r));cone(c,h-4,h,r*.3,r*.1,'#111827');
      label(c,'W',-h+50,0,r*.9,'rgba(255,255,255,.35)',lit);}
  };
  function litSide(a){return (Math.sin(a)*LIGHT.x-Math.cos(a)*LIGHT.y)>0?1:-1;}
  function paintPen(c,pen,T,a){
    const lit=litSide(a);c.save();if(lit<0)c.scale(1,-1);
    (PEN_ART[pen.style]||PEN_ART.ballpoint)(c,pen.len,pen.rad,T,lit);
    c.restore();
  }
  function drawPenPreview(cnv,penId,T,ang=-.08){
    const p=PEN(penId),r=cnv.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1),w=Math.max(10,r.width),h=Math.max(10,r.height);
    cnv.width=w*d;cnv.height=h*d;const c=cnv.getContext('2d');c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,h);
    const k=Math.min((w*.86)/p.len,(h*.5)/(p.rad*2));
    c.translate(w/2,h/2);c.rotate(ang);c.scale(k,k);
    c.save();c.translate(2.2,3.6);capsulePath(c,p.len/2-p.rad,p.rad);c.fillStyle='rgba(0,0,0,.35)';c.fill();c.restore();
    const sv=VIEW.dpr;VIEW.dpr=d;paintPen(c,p,T,ang);VIEW.dpr=sv;
  }

  /* ---------- desk surfaces ---------- */
  function withLong(c,W,fn){c.save();if(W.h>W.w){c.translate(W.w,0);c.rotate(Math.PI/2);}fn(Math.max(W.w,W.h),Math.min(W.w,W.h));c.restore();}
  function grain(c,L,S,rnd,col,n,planks,seam){
    const pw=S/planks;
    for(let p=0;p<planks;p++){
      const y0=p*pw;
      for(let i=0;i<n;i++){
        const y=y0+rnd()*pw,amp=.6+rnd()*2.6,f=.004+rnd()*.012,ph=rnd()*TAU;
        c.beginPath();for(let x=-4;x<=L+8;x+=10){const yy=y+Math.sin(x*f+ph)*amp+Math.sin(x*f*3.1+ph*2)*amp*.3;x<0?c.moveTo(x,yy):c.lineTo(x,yy);}
        c.strokeStyle=col(.05+rnd()*.14);c.lineWidth=.4+rnd()*1.1;c.stroke();
      }
      if(p>0){c.fillStyle=seam;c.fillRect(0,y0-.6,L,1.2);}
      // staggered plank joints
      const jx=rnd()*L;c.fillStyle=seam;c.fillRect(jx,y0,1,pw);
      for(let k=0;k<(rnd()<.6?1:2);k++){const kx=rnd()*L,ky=y0+pw*(.25+rnd()*.5),kr=3+rnd()*4;
        for(let j=0;j<4;j++){c.beginPath();c.ellipse(kx,ky,kr*(1+j*.9)*2.2,kr*(1+j*.9)*.7,0,0,TAU);c.strokeStyle=col(.12-j*.025);c.lineWidth=.8;c.stroke();}
        c.beginPath();c.ellipse(kx,ky,kr*1.6,kr*.55,0,0,TAU);c.fillStyle=col(.18);c.fill();}
    }
  }
  function sheen(c,W,a=.1){const g=c.createLinearGradient(0,0,W.w,W.h);g.addColorStop(0,`rgba(255,255,255,${a})`);g.addColorStop(.45,'rgba(255,255,255,0)');g.addColorStop(.7,'rgba(255,255,255,0)');g.addColorStop(1,`rgba(255,255,255,${a*.5})`);c.fillStyle=g;c.fillRect(0,0,W.w,W.h);}
  const SURF={
    oak(c,W,rnd){withLong(c,W,(L,S)=>{const g=c.createLinearGradient(0,0,0,S);g.addColorStop(0,'#d9a86a');g.addColorStop(.5,'#cc9658');g.addColorStop(1,'#bb8448');c.fillStyle=g;c.fillRect(0,0,L,S);
      grain(c,L,S,rnd,a=>`rgba(105,60,22,${a})`,16,4,'rgba(80,45,15,.32)');});sheen(c,W,.12);},
    walnut(c,W,rnd){withLong(c,W,(L,S)=>{const g=c.createLinearGradient(0,0,0,S);g.addColorStop(0,'#7a5236');g.addColorStop(1,'#573822');c.fillStyle=g;c.fillRect(0,0,L,S);
      grain(c,L,S,rnd,a=>`rgba(30,15,5,${a*1.4})`,18,3,'rgba(20,10,3,.45)');});sheen(c,W,.1);},
    mahogany(c,W,rnd){withLong(c,W,(L,S)=>{const g=c.createLinearGradient(0,0,0,S);g.addColorStop(0,'#86402a');g.addColorStop(1,'#5f2618');c.fillStyle=g;c.fillRect(0,0,L,S);
      grain(c,L,S,rnd,a=>`rgba(35,8,2,${a*1.3})`,16,3,'rgba(25,5,0,.4)');
      const m=34;rr(c,m,m,L-2*m,S-2*m,10);const lg=c.createLinearGradient(0,m,0,S-m);lg.addColorStop(0,'#24573f');lg.addColorStop(1,'#173d2b');c.fillStyle=lg;c.fill();
      for(let i=0;i<900;i++){c.fillStyle=`rgba(0,0,0,${rnd()*.12})`;c.fillRect(m+rnd()*(L-2*m),m+rnd()*(S-2*m),1.2,1.2);}
      c.setLineDash([3,3]);c.strokeStyle='rgba(212,166,58,.55)';c.lineWidth=1;rr(c,m+6,m+6,L-2*m-12,S-2*m-12,6);c.stroke();c.setLineDash([]);
      c.strokeStyle='rgba(212,166,58,.35)';c.lineWidth=1.6;rr(c,m+2,m+2,L-2*m-4,S-2*m-4,8);c.stroke();});sheen(c,W,.08);},
    glass(c,W,rnd){const g=c.createLinearGradient(0,0,W.w,W.h);g.addColorStop(0,'#2a3b46');g.addColorStop(.5,'#18262f');g.addColorStop(1,'#101b22');c.fillStyle=g;c.fillRect(0,0,W.w,W.h);
      c.save();c.globalAlpha=.06;c.strokeStyle='#9fd6ff';c.lineWidth=.6;for(let x=0;x<W.w;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,W.h);c.stroke();}for(let y=0;y<W.h;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(W.w,y);c.stroke();}c.restore();
      for(let i=0;i<3;i++){const x=W.w*(.1+i*.33+rnd()*.1);c.save();c.translate(x,0);c.rotate(.5);const gg=c.createLinearGradient(0,0,60+rnd()*60,0);gg.addColorStop(0,'rgba(255,255,255,0)');gg.addColorStop(.5,`rgba(255,255,255,${.035+rnd()*.035})`);gg.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=gg;c.fillRect(0,-W.h,120,W.h*3);c.restore();}
      c.strokeStyle='rgba(160,220,255,.25)';c.lineWidth=2;rr(c,3,3,W.w-6,W.h-6,W.cr-2);c.stroke();},
    mat(c,W,rnd){c.fillStyle='#2f7d56';c.fillRect(0,0,W.w,W.h);
      for(let x=0;x<=W.w;x+=10){c.fillStyle=x%50===0?'rgba(255,255,255,.22)':'rgba(255,255,255,.09)';c.fillRect(x-.3,0,x%50===0?.9:.5,W.h);}
      for(let y=0;y<=W.h;y+=10){c.fillStyle=y%50===0?'rgba(255,255,255,.22)':'rgba(255,255,255,.09)';c.fillRect(0,y-.3,W.w,y%50===0?.9:.5);}
      c.strokeStyle='rgba(255,255,255,.14)';c.lineWidth=.8;c.beginPath();c.moveTo(0,0);c.lineTo(W.w,W.w);c.moveTo(W.w,0);c.lineTo(0,W.w);c.stroke();
      c.beginPath();c.arc(W.w/2,W.h/2,Math.min(W.w,W.h)*.3,0,TAU);c.stroke();
      c.fillStyle='rgba(255,255,255,.35)';c.font='600 7px Rubik,sans-serif';c.textAlign='center';for(let x=50;x<W.w;x+=50)c.fillText(String(x/10),x,9);
      for(let i=0;i<14;i++){c.fillStyle=['rgba(239,68,68,.35)','rgba(59,130,246,.35)','rgba(250,204,21,.35)'][i%3];c.beginPath();c.arc(rnd()*W.w,rnd()*W.h,1+rnd()*4,0,TAU);c.fill();}},
    paper(c,W,rnd){c.fillStyle='#f6f2e7';c.fillRect(0,0,W.w,W.h);
      withLong(c,W,(L,S)=>{for(let x=46;x<L;x+=9){c.fillStyle='rgba(96,155,215,.45)';c.fillRect(x,0,.7,S);}
        c.fillStyle='rgba(230,80,90,.6)';c.fillRect(0,S-32,L,1);c.fillStyle='rgba(230,80,90,.6)';
        for(const f of [.2,.5,.8]){c.beginPath();c.arc(L*f,S-14,5.5,0,TAU);c.fillStyle='rgba(30,40,60,.25)';c.fill();}
        c.save();c.translate(18,S-48);c.rotate(-Math.PI/2);c.fillStyle='rgba(30,50,110,.6)';c.font='600 11px Rubik,sans-serif';c.fillText('Name: ____________',0,0);c.restore();
        c.save();c.translate(L-46,46);c.strokeStyle='rgba(220,40,50,.75)';c.lineWidth=2;c.beginPath();c.ellipse(0,0,22,16,-.2,0,TAU);c.stroke();
        c.rotate(-Math.PI/2);c.fillStyle='rgba(220,40,50,.8)';c.font='800 18px Rubik,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('A+',0,0);c.restore();});},
    marble(c,W,rnd){const g=c.createLinearGradient(0,0,W.w,W.h);g.addColorStop(0,'#efece6');g.addColorStop(1,'#d9d4cc');c.fillStyle=g;c.fillRect(0,0,W.w,W.h);
      for(let i=0;i<22;i++){c.beginPath();let x=rnd()*W.w,y=rnd()*W.h;c.moveTo(x,y);
        for(let k=0;k<6;k++){const nx=x+(rnd()-.4)*180,ny=y+(rnd()-.5)*180;c.quadraticCurveTo(x+(rnd()-.5)*120,y+(rnd()-.5)*120,nx,ny);x=nx;y=ny;}
        c.strokeStyle=i%7===0?`rgba(190,150,70,${.2+rnd()*.2})`:`rgba(80,80,90,${.06+rnd()*.16})`;c.lineWidth=.4+rnd()*2.2;c.stroke();}
      sheen(c,W,.22);}
  };
  const EDGE={oak:'#7b4c22',walnut:'#2e1c10',mahogany:'#3a140c',glass:'#0a1218',mat:'#1c4d35',paper:'#c9c0aa',marble:'#9e978c'};
  function decorate(c,W,arena,rnd){
    const id=arena.id;
    if(id==='classroom'){
      c.save();c.translate(W.w*.7,W.h*.8);c.rotate(.08);c.fillStyle='rgba(0,0,0,.16)';c.fillRect(3,4,70,62);c.fillStyle='#ffe66d';c.fillRect(0,0,70,62);
      c.fillStyle='rgba(30,60,140,.65)';c.font='800 15px Rubik,sans-serif';c.textAlign='center';c.fillText('DON’T',35,26);c.fillText('FALL!',35,46);c.restore();
      c.strokeStyle='rgba(30,60,140,.35)';c.lineWidth=1.3;c.beginPath();const sx=W.w*.18,sy=W.h*.17;for(let a=0;a<14;a+=.25){const r=1+a*1.5;a===0?c.moveTo(sx+Math.cos(a)*r,sy+Math.sin(a)*r):c.lineTo(sx+Math.cos(a)*r,sy+Math.sin(a)*r);}c.stroke();
      c.save();c.translate(W.w*.22,W.h*.72);c.strokeStyle='rgba(60,30,10,.32)';c.lineWidth=1.4;c.beginPath();
      for(const k of [1,2]){c.moveTo(k*14,0);c.lineTo(k*14,42);c.moveTo(0,k*14);c.lineTo(42,k*14);}c.stroke();
      c.strokeStyle='rgba(200,30,30,.4)';c.beginPath();c.moveTo(3,3);c.lineTo(11,11);c.moveTo(11,3);c.lineTo(3,11);c.moveTo(31,31);c.lineTo(39,39);c.moveTo(39,31);c.lineTo(31,39);c.stroke();
      c.strokeStyle='rgba(30,60,140,.4)';c.beginPath();c.arc(21,21,4.5,0,TAU);c.stroke();c.restore();
      c.fillStyle='rgba(30,60,140,.3)';for(let i=0;i<7;i++){c.beginPath();c.arc(W.w*(.1+rnd()*.8),W.h*(.1+rnd()*.8),1+rnd()*2.5,0,TAU);c.fill();}
      c.save();c.translate(W.w*.78,W.h*.22);c.rotate(-.3);c.strokeStyle='rgba(70,35,10,.3)';c.lineWidth=1.6;c.font='700 14px Rubik,sans-serif';c.strokeText('J + K',0,0);c.restore();
    }else if(id==='office'){
      c.strokeStyle='rgba(120,80,40,.25)';c.lineWidth=3;c.beginPath();c.arc(W.w*.72,W.h*.2,30,.3,5.6);c.stroke();
      c.save();c.translate(W.w*.18,W.h*.82);c.rotate(-.12);c.fillStyle='rgba(0,0,0,.25)';c.fillRect(3,4,64,58);c.fillStyle='#7dd3fc';c.fillRect(0,0,64,58);
      c.fillStyle='rgba(10,30,60,.7)';c.font='700 11px Rubik,sans-serif';c.fillText('Q3 goals:',7,18);c.fillText('• win',7,34);c.fillText('• win more',7,48);c.restore();
    }else if(id==='library'){
      c.save();c.translate(W.w*.66,W.h*.84);c.rotate(.18);c.fillStyle='rgba(0,0,0,.2)';c.fillRect(2,3,84,52);c.fillStyle='#f3ead2';c.fillRect(0,0,84,52);
      c.strokeStyle='rgba(120,90,40,.35)';c.lineWidth=.7;for(let y=14;y<52;y+=8){c.beginPath();c.moveTo(4,y);c.lineTo(80,y);c.stroke();}
      c.fillStyle='rgba(120,30,30,.7)';c.font='800 8px Rubik,sans-serif';c.fillText('LIBRARY CARD',6,10);c.restore();
    }
  }
  function obsShadow(c,k){c.shadowColor='rgba(0,0,0,.5)';c.shadowBlur=9*k;c.shadowOffsetX=3*k;c.shadowOffsetY=6*k;}
  function noShadow(c){c.shadowColor='transparent';c.shadowBlur=0;c.shadowOffsetX=0;c.shadowOffsetY=0;}
  function drawObstacle(c,o,k){
    c.save();c.translate(o.x,o.y);if(o.t==='box')c.rotate(o.a);
    const w=o.sw,h=o.sh;
    switch(o.k){
      case 'book':{obsShadow(c,k);c.fillStyle='#efe4cc';rr(c,-w/2,-h/2,w,h,3);c.fill();noShadow(c);
        c.strokeStyle='rgba(150,120,80,.5)';c.lineWidth=.5;for(let i=1;i<4;i++){rr(c,-w/2+i*.8,-h/2+i*.8,w-i*1.6,h-i*1.6,2);c.stroke();}
        const col=o.c||'#7c2d12';const g=c.createLinearGradient(0,-h/2,0,h/2);g.addColorStop(0,shade(col,.12));g.addColorStop(1,shade(col,-.25));
        c.fillStyle=g;rr(c,-w/2,-h/2,w-3.5,h,3);c.fill();
        c.fillStyle=shade(col,-.35);c.fillRect(-w/2,-h/2,10,h);c.fillStyle='rgba(212,166,58,.75)';c.fillRect(-w/2+2,-h/2+6,6,1.4);c.fillRect(-w/2+2,h/2-7.4,6,1.4);
        c.strokeStyle='rgba(212,166,58,.6)';c.lineWidth=1;rr(c,-w/2+16,-h/2+8,w-30,h-16,2);c.stroke();
        c.fillStyle='rgba(212,166,58,.7)';c.fillRect(-w/2+24,-4,w-46,2.2);c.fillRect(-w/2+30,2,w-58,1.6);break;}
      case 'eraser':{obsShadow(c,k);c.fillStyle='#f5f4ee';rr(c,-w/2,-h/2,w,h,o.rr);c.fill();noShadow(c);
        c.fillStyle='#2563eb';c.fillRect(-w*.28,-h/2,w*.56,h);c.fillStyle='#fff';c.font=`800 ${h*.32}px Rubik,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText('ERASE',0,.5);
        c.fillStyle='rgba(255,255,255,.4)';c.fillRect(-w/2+2,-h/2+2,w-4,2);break;}
      case 'stapler':{obsShadow(c,k);c.fillStyle='#1f2633';rr(c,-w/2,-h/2,w,h,o.rr);c.fill();noShadow(c);
        const g=c.createLinearGradient(-w/2,0,w/2,0);g.addColorStop(0,'#6b7280');g.addColorStop(.3,'#cbd5e1');g.addColorStop(.6,'#64748b');g.addColorStop(1,'#374151');
        c.fillStyle=g;rr(c,-w/2+5,-h/2+6,w-10,h*.7,6);c.fill();c.fillStyle='#111827';c.beginPath();c.arc(0,h/2-12,5,0,TAU);c.fill();break;}
      case 'ruler':{obsShadow(c,k);c.fillStyle='rgba(147,197,253,.75)';rr(c,-w/2,-h/2,w,h,o.rr);c.fill();noShadow(c);
        c.fillStyle='rgba(15,23,42,.65)';for(let x=0;x<=w-8;x+=2){const L=x%20===0?h*.5:x%10===0?h*.35:h*.18;c.fillRect(-w/2+4+x,-h/2,.45,L);}
        c.font='600 4.5px Rubik,sans-serif';c.textAlign='center';for(let x=0,n=0;x<=w-8;x+=20,n+=2)c.fillText(String(n),-w/2+4+x,h/2-2.5);
        c.fillStyle='rgba(255,255,255,.35)';c.fillRect(-w/2+1,-h/2+1,w-2,1.2);break;}
      case 'nameplate':{obsShadow(c,k);const g=c.createLinearGradient(0,-h/2,0,h/2);g.addColorStop(0,'#5a3220');g.addColorStop(1,'#2e170c');c.fillStyle=g;rr(c,-w/2,-h/2,w,h,o.rr);c.fill();noShadow(c);
        const gg=c.createLinearGradient(0,-h/2,0,h/2);gg.addColorStop(0,'#f3d27a');gg.addColorStop(.5,'#c99a3e');gg.addColorStop(1,'#a77a24');c.fillStyle=gg;rr(c,-w/2+8,-h/2+7,w-16,h-14,2);c.fill();
        c.fillStyle='#3a2408';c.font='800 10px Rubik,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('THE CHAIRMAN',0,.5);break;}
      case 'mug':{const r=o.r;c.save();obsShadow(c,k);c.fillStyle=o.c||'#f1f5f9';c.beginPath();c.arc(0,0,r,0,TAU);c.fill();rr(c,r-4,-7,16,14,6);c.fill();c.restore();
        const g=c.createRadialGradient(-r*.3,-r*.3,r*.1,0,0,r);g.addColorStop(0,'#ffffff');g.addColorStop(1,'#cbd5e1');c.fillStyle=g;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();
        c.fillStyle='#3a2414';c.beginPath();c.arc(0,0,r-5,0,TAU);c.fill();const cg=c.createRadialGradient(-r*.25,-r*.25,1,0,0,r-5);cg.addColorStop(0,'rgba(200,140,80,.5)');cg.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=cg;c.fill();
        c.strokeStyle='rgba(255,255,255,.35)';c.lineWidth=1;c.beginPath();c.arc(0,0,r-8,-2.5,-1.2);c.stroke();break;}
      case 'jar':{const r=o.r,col=o.c||'#ef4444';c.save();obsShadow(c,k);c.fillStyle=col;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();c.restore();
        const g=c.createRadialGradient(-r*.35,-r*.35,r*.1,0,0,r);g.addColorStop(0,shade(col,.45));g.addColorStop(.6,col);g.addColorStop(1,shade(col,-.4));c.fillStyle=g;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();
        c.strokeStyle='rgba(0,0,0,.25)';c.lineWidth=.6;for(let a=0;a<TAU;a+=.2){c.beginPath();c.moveTo(Math.cos(a)*(r-3),Math.sin(a)*(r-3));c.lineTo(Math.cos(a)*r,Math.sin(a)*r);c.stroke();}
        c.fillStyle='rgba(255,255,255,.5)';c.font=`800 ${r*.42}px Rubik,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText('PAINT',0,1);break;}
      case 'cup':{const r=o.r;c.save();obsShadow(c,k);c.fillStyle='#1f2937';c.beginPath();c.arc(0,0,r,0,TAU);c.fill();c.restore();
        c.strokeStyle='rgba(255,255,255,.12)';c.lineWidth=.7;for(let a=0;a<TAU;a+=.26){c.beginPath();c.moveTo(Math.cos(a)*r*.82,Math.sin(a)*r*.82);c.lineTo(Math.cos(a)*r,Math.sin(a)*r);c.stroke();}
        c.fillStyle='#0b1120';c.beginPath();c.arc(0,0,r*.8,0,TAU);c.fill();
        [['#ef4444',-6,-5],['#3b82f6',6,-3],['#facc15',-2,7],['#22c55e',8,8]].forEach(([col,x,y])=>{c.fillStyle=col;c.beginPath();c.arc(x,y,4,0,TAU);c.fill();c.fillStyle='rgba(255,255,255,.4)';c.beginPath();c.arc(x-1.2,y-1.2,1.3,0,TAU);c.fill();});
        c.strokeStyle='rgba(203,213,225,.7)';c.lineWidth=1.6;c.beginPath();c.arc(0,0,r-.8,0,TAU);c.stroke();break;}
      case 'inkwell':{const r=o.r;c.save();obsShadow(c,k);c.fillStyle='#1e293b';c.beginPath();c.arc(0,0,r,0,TAU);c.fill();c.restore();
        const g=c.createRadialGradient(-r*.4,-r*.4,r*.1,0,0,r);g.addColorStop(0,'rgba(180,200,255,.55)');g.addColorStop(.5,'rgba(30,41,59,.9)');g.addColorStop(1,'#0b1020');c.fillStyle=g;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();
        const m=c.createLinearGradient(0,-r*.5,0,r*.5);m.addColorStop(0,'#f1f5f9');m.addColorStop(.5,'#94a3b8');m.addColorStop(1,'#475569');c.fillStyle=m;c.beginPath();c.arc(0,0,r*.45,0,TAU);c.fill();
        c.fillStyle='#0b1020';c.beginPath();c.arc(0,0,r*.25,0,TAU);c.fill();break;}
    }
    c.restore();
  }
  function drawDeskTop(c,W,arena,k){
    const rnd=mulberry(hashStr(arena.id)),th=11;
    c.fillStyle=EDGE[arena.mat]||'#5b3a1e';rr(c,-2.5,2,W.w+5,W.h+th,W.cr+2);c.fill();
    c.fillStyle='rgba(0,0,0,.35)';rr(c,-2.5,W.h-4,W.w+5,th+6,W.cr);c.fill();
    c.save();rr(c,0,0,W.w,W.h,W.cr);c.clip();
    (SURF[arena.mat]||SURF.oak)(c,W,rnd);decorate(c,W,arena,rnd);
    const e=24;
    const sides=[[0,0,W.w,e,0,0,0,e],[0,W.h-e,W.w,e,0,W.h,0,W.h-e],[0,0,e,W.h,0,0,e,0],[W.w-e,0,e,W.h,W.w,0,W.w-e,0]];
    for(const [x,y,w,h,x0,y0,x1,y1] of sides){const g=c.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,'rgba(0,0,0,.24)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(x,y,w,h);}
    c.restore();
    c.strokeStyle='rgba(255,255,255,.26)';c.lineWidth=1.3;rr(c,.7,.7,W.w-1.4,W.h-1.4,W.cr);c.stroke();
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
    VIEW.w=window.innerWidth;VIEW.h=window.innerHeight;
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
    // team glow
    c.save();c.translate(P.x,P.y);c.rotate(P.a);
    c.globalAlpha=active?.5+.2*Math.sin(t*6):.34;c.fillStyle=col;
    if(S.settings.quality!=='low'){c.shadowColor=col;c.shadowBlur=14*VIEW.dpr*VIEW.sc;}
    capsulePath(c,h,r+4.5);c.fill();c.restore();
    // contact shadow
    c.save();c.translate(P.x+2.2,P.y+3.8);c.rotate(P.a);c.fillStyle='rgba(0,0,0,.16)';capsulePath(c,h+1,r+1.6);c.fill();c.fillStyle='rgba(0,0,0,.28)';capsulePath(c,h,r*.92);c.fill();c.restore();
    // body
    c.save();c.translate(P.x,P.y);c.rotate(P.a);paintPen(c,b.pen,col,P.a);
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
    c.rotate(b.a);c.scale(f,1);paintPen(c,b.pen,col,b.a);
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
  const EV={
    hit(A,B,speed,x,y){
      const k=clamp(speed/1800,0,1);
      if(!M.demo){SFX.hit(k,A.mat,B.isObs?B.snd:B.mat,Math.max(A.m,B.isObs?0:B.m));}
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
      SFX.fall();buzz(35);
      const sh=M.shot,self=sh&&b.owner===sh.shooter,pl=M.players[b.owner];
      if(S.settings.slowmo&&M.W.bodies.filter(x=>x.state==='on').length<=1)FX.slow=1.1;
      const lx=clamp(b.x,50,M.W.w-50),ly=clamp(b.y,40,M.W.h-40);
      floater(self?'SELF KO':'KNOCKOUT!',lx,ly,self?'#ff8aa0':'#ffffff',self?20:26,self?'':pl.name+' is out');
      FX.flash=.7;FX.flashCol=pl.col;FX.shake=Math.max(FX.shake,9);SFX.ko();
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
      case 'moving':M.t+=dt;if(settled(M.W)||M.t>10){if(M.t>10)forceStop();M.phase='post';M.t=0;resolveShot();}break;
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
    $('#hudPlayers').innerHTML=M.players.map((p,i)=>`<div class="pc" id="pc${i}" style="--c:${p.col}"><div class="av" style="--c:${p.col}">${esc(initials(p.name))}</div>
      <div class="nm"><b>${esc(p.name)}</b><small id="pcs${i}">${pcSub(p)}</small></div><div class="pips" id="pips${i}"></div></div>`).join('');
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
      <div class="board">${M.players.map(p=>`<div class="${p===w?'win':''}"><div class="av" style="--c:${p.col}">${esc(initials(p.name))}</div><b>${p.score}</b><small>${esc(p.name)}</small></div>`).join('')}</div>
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
  function toMenu(){M.paused=false;hideRoundCard();document.body.classList.remove('in-match');startDemo();NAV.length=0;showScreen('menu');}

  /* ============================== INPUT ============================== */
  function toWorld(cx,cy){return {x:(cx-VIEW.ox)/VIEW.sc,y:(cy-VIEW.oy)/VIEW.sc};}
  function canAim(){return M.on&&!M.demo&&!M.paused&&M.phase==='aim'&&isLocal(M.players[M.turn])&&SCREEN===null&&!modalOpen();}
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

  /* ============================== ONLINE ==============================
     Peer-to-peer rooms over WebRTC (PeerJS, loaded only when needed).
     - The host creates a room named by a 5-letter code; guests connect to it
       directly. Guests only talk to the host; the host relays.
     - The host's device is the authority: it runs the match controller, the
       CPU players and the shot clock, and broadcasts every decision.
     - Every device simulates each flick with the same physics engine from the
       same exact starting state, so motion is smooth with no network lag. When
       a shot settles the host sends its exact result and everyone snaps to it.
     - A player who drops out mid-match is replaced by a CPU.
     =================================================================== */
  const NET={on:false,role:null,peer:null,conns:new Map(),host:null,me:null,code:'',lobby:null,state:'idle',err:'',queue:[],heard:new Map(),aimT:0,joinT:0,lib:null,busyText:''};
  const NET_PREFIX='deskduel2-room-',NET_VER=1,CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  /* STUN finds a direct route; the free PeerJS TURN relay (UDP and TCP) is the fallback for strict networks */
  const PEER_OPTS={debug:0,config:{iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},
    {urls:['turn:eu-0.turn.peerjs.com:3478','turn:us-0.turn.peerjs.com:3478','turn:eu-0.turn.peerjs.com:3478?transport=tcp','turn:us-0.turn.peerjs.com:3478?transport=tcp'],username:'peerjs',credential:'peerjsp'}]}};
  function loadPeerLib(){
    // PeerJS is bundled from npm and only downloaded when someone opens Online play
    if(window.Peer)return Promise.resolve();
    if(NET.lib)return NET.lib;
    NET.lib=import('peerjs').then(m=>{window.Peer=m.Peer||m.default;}).catch(e=>{NET.lib=null;throw e;});
    return NET.lib;
  }
  const randCode=()=>Array.from({length:5},()=>CODE_CHARS[Math.random()*CODE_CHARS.length|0]).join('');
  function netErrText(e){
    const t=e&&e.type;
    if(t==='peer-unavailable')return 'Room not found. Check the code with your host.';
    if(t==='browser-incompatible')return 'This browser does not support online play. Try Chrome, Safari or Firefox.';
    if(t==='network'||t==='server-error'||t==='socket-error'||t==='socket-closed')return 'Can’t reach the online service. Check your internet connection.';
    if(t==='webrtc')return 'The direct connection failed. Try another network (for example Wi‑Fi instead of mobile data).';
    return 'Connection problem'+(t?' ('+t+')':'')+'. Please try again.';
  }
  function myProfile(){return {name:(S.profile.name||'').trim().slice(0,14)||'Player',color:S.profile.color||'blue',pen:S.owned[S.online.pen]?S.online.pen:S.equip};}
  function cleanPlayer(p){
    return {pid:String(p.pid),name:String(p.name||'Player').replace(/[<>&"]/g,'').trim().slice(0,14)||'Player',
      color:TEAM.some(t=>t.id===p.color)?p.color:'blue',pen:PENS.some(x=>x.id===p.pen)?p.pen:'ballpoint',
      host:!!p.host,cpu:p.cpu?(QUICK_DIFF[p.cpu]?p.cpu:'medium'):undefined};
  }
  function fixColors(){const used=new Set();for(const p of NET.lobby.players){if(used.has(p.color)){const f=TEAM.find(t=>!used.has(t.id));if(f)p.color=f.id;}used.add(p.color);}}
  function netSend(m){const c=NET.host;if(c&&c.open)try{c.send(m);}catch(e){}}
  function netBroadcast(m,except){for(const [pid,c] of NET.conns)if(pid!==except&&c.open)try{c.send(m);}catch(e){}}
  function netLobbyChanged(){if(NET.role!=='host')return;fixColors();netBroadcast({k:'lobby',lobby:NET.lobby});if(SCREEN==='online')renderOnline();}
  function netReset(){
    clearTimeout(NET.joinT);
    try{if(NET.peer)NET.peer.destroy();}catch(e){}
    Object.assign(NET,{on:false,role:null,peer:null,host:null,me:null,code:'',lobby:null,state:'idle',queue:[],busyText:''});
    NET.conns=new Map();NET.heard=new Map();
  }
  function netFail(msg){netReset();NET.state='idle';NET.err=msg;if(SCREEN==='online')renderOnline();SFX.deny();}
  function netBusy(text){NET.state='loading';NET.busyText=text;NET.err='';if(SCREEN==='online')renderOnline();}

  /* ---------- host ---------- */
  async function netHost(){
    netBusy('Creating your room…');
    try{await loadPeerLib();}catch(e){return netFail('Online play could not load. Check your internet connection.');}
    netReset();NET.state='loading';NET.busyText='Creating your room…';NET.role='host';NET.me='H';
    const attempt=n=>{
      const code=randCode(),peer=new Peer(NET_PREFIX+code,PEER_OPTS);NET.peer=peer;
      peer.on('open',()=>{if(NET.peer!==peer)return;NET.on=true;NET.code=code;NET.state='lobby';
        NET.lobby={code,arena:S.desks[S.online.arena]?S.online.arena:'classroom',need:S.online.need,clock:S.online.clock,players:[cleanPlayer(Object.assign({pid:'H',host:true},myProfile()))]};
        SFX.turn();if(SCREEN==='online')renderOnline();});
      peer.on('connection',c=>hostAccept(c));
      peer.on('disconnected',()=>{try{if(!peer.destroyed)peer.reconnect();}catch(e){}});
      peer.on('error',e=>{if(NET.peer!==peer)return;
        if(e.type==='unavailable-id'&&n<5){peer.destroy();attempt(n+1);return;}
        if(NET.state!=='lobby')netFail(netErrText(e));else if(e.type!=='peer-unavailable')toast('Connection problem',netErrText(e),'x','blue');});
    };
    attempt(0);
  }
  function hostAccept(c){
    c.on('data',m=>hostRecv(c,m));
    c.on('close',()=>hostDrop(c.peer,'left the room'));
    c.on('error',()=>hostDrop(c.peer,'lost connection'));
  }
  function hostRecv(c,m){
    if(!m||typeof m!=='object'||NET.role!=='host')return;
    const pid=c.peer;NET.heard.set(pid,now());
    switch(m.k){
      case 'hello':{
        const no=why=>{try{c.send({k:'reject',why});}catch(e){}setTimeout(()=>{try{c.close();}catch(e){}},400);};
        if(m.v!==NET_VER)return no('version');
        if(online()&&M.phase!=='matchEnd')return no('started');
        if(NET.lobby.players.length>=3)return no('full');
        NET.conns.set(pid,c);
        const p=cleanPlayer(Object.assign({},m.p,{pid,host:false,cpu:undefined}));NET.lobby.players.push(p);fixColors();
        try{c.send({k:'welcome',you:pid,lobby:NET.lobby});}catch(e){}
        netLobbyChanged();toast(p.name+' joined','Room '+NET.code,'users','blue');SFX.turn();break;}
      case 'update':{const p=NET.lobby.players.find(x=>x.pid===pid);if(p&&m.p){Object.assign(p,cleanPlayer(Object.assign({},p,m.p,{pid,host:false,cpu:undefined})));netLobbyChanged();}break;}
      case 'aim':if(online()&&M.phase==='aim'&&M.players[M.turn].pid===pid&&m.a){M.remoteAim=m.a;netBroadcast({k:'aim',turn:M.turn,a:m.a},pid);}break;
      case 'flick':if(online()&&M.phase==='aim'&&M.players[M.turn].pid===pid&&m.seq===M.shotSeq+1)fire(+m.gt||0,+m.ang||0,clamp(+m.p||0,0,1));break;
      case 'pong':break;
      case 'bye':hostDrop(pid,'left the room');break;
    }
  }
  function hostDrop(pid,why){
    if(NET.role!=='host')return;
    const c=NET.conns.get(pid);if(!c)return;NET.conns.delete(pid);NET.heard.delete(pid);try{c.close();}catch(e){}
    const li=NET.lobby?NET.lobby.players.findIndex(p=>p.pid===pid):-1;let name='A player';
    if(li>=0){name=NET.lobby.players[li].name;NET.lobby.players.splice(li,1);}
    const i=online()?M.players.findIndex(p=>p.pid===pid):-1;
    if(i>=0&&M.phase!=='matchEnd'){
      const p=M.players[i];p.human=false;p.skill=.42;p.pid='cpu-'+i;netBroadcast({k:'left',idx:i});
      if(M.turn===i&&M.phase==='aim'){M.phase='think';M.t=0;M.remoteAim=null;const cfg=aiCfg(p.skill);cfg.turn=M.roundShots;M.planner=new Planner(M.W,i,cfg);
        netBroadcast({k:'turn',turn:M.turn,phase:'think',clock:M.clock,rs:M.roundShots});}
      updateHud();toast(name+' '+why,'A CPU plays for them','users','blue');
    }else toast(name+' '+why,'','users','blue');
    netLobbyChanged();
  }
  function hostStart(){
    const L=NET.lobby;if(!L||L.players.length<2)return;
    persist();
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
    UI.joinCode=code;netBusy('Joining room '+code+'…');
    try{await loadPeerLib();}catch(e){return netFail('Online play could not load. Check your internet connection.');}
    netReset();NET.state='loading';NET.busyText='Joining room '+code+'…';NET.role='guest';NET.code=code;
    const peer=new Peer(PEER_OPTS);NET.peer=peer;
    peer.on('open',id=>{
      if(NET.peer!==peer)return;NET.me=id;
      const c=peer.connect(NET_PREFIX+code,{reliable:true,serialization:'json'});NET.host=c;
      NET.joinT=setTimeout(()=>{if(NET.peer===peer&&NET.state!=='lobby')netFail('Could not connect to room '+code+'. Check the code, or try again on another network (for example the same Wi\u2011Fi as the host).');},20000);
      c.on('open',()=>{NET.heard.set('H',now());netSend({k:'hello',v:NET_VER,p:myProfile()});});
      c.on('data',m=>guestRecv(m));
      c.on('close',()=>guestLost('The host closed the room.'));
      c.on('error',()=>guestLost('Lost connection to the host.'));
    });
    peer.on('disconnected',()=>{try{if(!peer.destroyed)peer.reconnect();}catch(e){}});
    peer.on('error',e=>{if(NET.peer!==peer)return;if(NET.state!=='lobby'&&!online())netFail(netErrText(e));});
  }
  function guestRecv(m){
    if(!m||typeof m!=='object'||NET.role!=='guest')return;
    NET.heard.set('H',now());
    switch(m.k){
      case 'welcome':clearTimeout(NET.joinT);NET.on=true;NET.state='lobby';NET.me=m.you;NET.lobby=m.lobby;NET.err='';if(SCREEN==='online')renderOnline();SFX.turn();
        toast('Joined room '+NET.code,'Waiting for the host to start','users','blue');break;
      case 'reject':netFail({full:'That room is full (3 players max).',started:'That match has already started. Join when it ends.',version:'Your friend is using a different version of Desk Duel.'}[m.why]||'The host could not let you in.');break;
      case 'lobby':NET.lobby=m.lobby;if(SCREEN==='online')renderOnline();break;
      case 'ping':netSend({k:'pong'});break;
      case 'hostLeft':guestLost('The host closed the room.');break;
      default:NET.queue.push(m);
    }
  }
  function guestLost(msg){
    if(NET.role!=='guest'||!NET.peer)return;
    if(!NET.on){netFail('Found room '+NET.code+' but could not connect to it. Try again, or join the same Wi\u2011Fi as the host.');return;}
    const inGame=online()||SCREEN==='results';netReset();NET.err=msg;
    if(inGame){toMenu();go('online');}else if(SCREEN==='online')renderOnline();
    toast('Disconnected',msg,'x','blue');
  }
  function netLeave(){
    if(NET.role==='host')netBroadcast({k:'hostLeft'});else if(NET.role==='guest')netSend({k:'bye'});
    const p=NET.peer;NET.peer=null;setTimeout(()=>{try{if(p)p.destroy();}catch(e){}},250);
    netReset();NET.err='';
  }
  function netUpdateProfile(){
    if(!NET.on)return;
    if(NET.role==='host'){const p=NET.lobby.players.find(x=>x.pid==='H');if(p)Object.assign(p,cleanPlayer(Object.assign({pid:'H',host:true},myProfile())));netLobbyChanged();}
    else netSend({k:'update',p:myProfile()});
  }
  function netSendAim(d){
    if(!online())return;const t=now();if(d&&t-NET.aimT<70)return;NET.aimT=t;
    const a=d?{t:q4(d.t),vx:Math.round(d.vx*10)/10,vy:Math.round(d.vy*10)/10,on:1}:{on:0};
    if(NET.role==='host')netBroadcast({k:'aim',turn:M.turn,a});else netSend({k:'aim',a});
  }
  /* heartbeat: detects players who silently vanished (closed tab, lost signal) */
  setInterval(()=>{
    if(!NET.on)return;const t=now();
    if(NET.role==='host'){netBroadcast({k:'ping'});for(const [pid] of NET.conns){const h=NET.heard.get(pid);if(h&&t-h>12000)hostDrop(pid,'lost connection');else if(!h)NET.heard.set(pid,t);}}
    else if(NET.role==='guest'){const h=NET.heard.get('H');if(h&&t-h>12000)guestLost('Lost connection to the host.');}
  },2000);

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
      if(m.k==='result'&&!m.skipped&&online()&&M.phase==='moving'&&M.W&&!settled(M.W)&&NET.queue.length<4){if(!m._rx)m._rx=now();if(now()-m._rx<5000)return;}
      NET.queue.shift();guestApply(m);
    }
  }
  function guestApply(m){
    switch(m.k){
      case 'start':
        Object.assign(M,{opts:null,on:true,demo:false,mode:'online',arena:ARENA(m.arena),need:m.need,clock:m.clock,career:null,diff:null,round:1,starter:0,matchOver:false,
          roundWinner:null,paused:false,trickCoins:0,tricks:[],shotSeq:0,predSeq:0,remoteAim:null,land:false,phase:'intro',t:0,planner:null,aiShot:null});
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
  let SCREEN='menu';const NAV=[];const RENDER={};const UI={shopTab:'pens',careerPen:null};
  function showScreen(id,fresh){
    $$('.screen').forEach(s=>s.classList.toggle('active',s.id==='scr-'+id));SCREEN=id||null;
    if(id&&RENDER[id])RENDER[id]();
    if(id&&fresh){const sc=$('#scr-'+id+' .scroll');if(sc)sc.scrollTop=0;}
  }
  function go(id){if(SCREEN&&SCREEN!==id)NAV.push(SCREEN);showScreen(id,true);}
  function back(){const prev=NAV.pop();if(prev)showScreen(prev);else if(M.on&&!M.demo&&M.phase!=='matchEnd')showScreen('pause');else showScreen('menu');}
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
    const need=xpNeed(S.level);$('#mLvl').style.setProperty('--p',Math.round(S.xp/need*100));$('#mLvl span').textContent=S.level;
    $('#mLvlName').textContent='Level '+S.level;$('#mXp').textContent=fmt(S.xp)+' / '+fmt(need)+' XP';
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
    openModal(`<h3>${o.boss?'Boss fight':'Career match'} · ${esc(L.name)}</h3>
      <div class="vs"><div class="side"><div class="av" style="--c:${me}">YOU</div><b>You</b><small id="vsPen">${esc(PEN(UI.careerPen).name)}</small></div><div class="x">VS</div>
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
    startMatch({mode:'career',career:o,arena:L.arena,need:o.need,players:[
      {name:'You',color:S.profile.color,pen:UI.careerPen||S.equip,human:true},
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
    startMatch({mode:'quick',diff:q.diff,arena:q.arena,need:+q.need,players:[
      {name:'You',color:S.profile.color,pen:pen.id,human:true},
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
  function saveOnlineName(){const el=$('#onName');if(el){S.profile.name=el.value.trim().slice(0,14);persist();}}
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

  /* ---------- stats ---------- */
  RENDER.stats=function(){
    const st=S.stats,rate=st.matches?Math.round(st.wins/st.matches*100)+'%':'–',need=xpNeed(S.level),got=ACH.filter(a=>S.ach[a.id]).length;refreshCoins();
    const items=[['Matches',st.matches],['Wins',st.wins],['Win rate',rate],['Best streak',st.bestStreak],['Knockouts',st.kos],['Self KOs',st.selfKos],
      ['Rounds won',st.rounds],['Trick shots',st.tricks],['Flicks',st.shots],['Coins earned',fmt(st.coinsEarned)],['Career wins',st.careerWins],['Party games',st.party]];
    $('#statsBody').innerHTML=`<div class="panel"><div class="profile"><div class="lvl" style="--p:${Math.round(S.xp/need*100)}"><span>${S.level}</span></div>
        <div style="flex:1"><b style="font-size:17px">Level ${S.level}</b><small>${fmt(S.xp)} / ${fmt(need)} XP · ${Object.keys(S.owned).length}/${PENS.length} pens · ${got}/${ACH.length} trophies</small>
        <div class="xpbar"><i style="width:${S.xp/need*100}%"></i></div></div></div></div>
      <div class="panel"><h3>Career stats</h3><p class="sub" style="margin-bottom:12px">Counts matches where Player 1 is you.</p><div class="sgrid">${items.map(i=>`<div class="stat"><b>${i[1]}</b><span>${i[0]}</span></div>`).join('')}</div></div>
      <div class="panel"><h3>Trophies · ${got}/${ACH.length}</h3>${ACH.map(a=>{const v=Math.min(a.v(S),a.n),ok=!!S.ach[a.id];
        return `<div class="ach ${ok?'got':''}"><div class="ic">${ICON(ok?a.ic:'lock')}</div><div class="meta"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>${!ok&&a.n>1?`<div class="pbar"><i style="width:${v/a.n*100}%"></i></div>`:''}</div>
          <span class="reward">${ok?ICON('check'):COIN+fmt(a.reward)}</span></div>`;}).join('')}</div>`;
  };

  /* ---------- settings ---------- */
  RENDER.settings=function(){
    const s=S.settings,seg=(k,o)=>`<div class="seg">${o.map(([v,l])=>`<button class="${String(s[k])===String(v)?'on':''}" data-act="setS" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
    const sw=k=>`<button class="switch ${s[k]?'on':''}" data-act="toggleS" data-k="${k}" aria-pressed="${!!s[k]}"></button>`;
    const set=(t,d,ctl)=>`<div class="set"><div class="meta"><b>${t}</b><small>${d}</small></div>${ctl}</div>`;
    $('#settingsBody').innerHTML=`<div class="panel">
      ${set('Sound','Impacts, flicks and fanfares',sw('sound'))}
      ${set('Volume',`<span id="volTxt">${Math.round(s.volume*100)}%</span>`,`<input type="range" min="0" max="100" value="${Math.round(s.volume*100)}" id="volRange" style="max-width:220px">`)}
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
  RENDER.online=function(){renderOnline();};
  function renderOnline(){
    const el=$('#onlineBody');if(!el)return;refreshCoins();
    if(NET.state==='loading'){
      el.innerHTML=`<div class="panel" style="text-align:center;padding:42px 18px"><div class="spinner"></div><h3 style="margin-top:18px">${esc(NET.busyText||'Connecting…')}</h3>
        <p class="sub">This usually takes a few seconds.</p><button class="btn" style="margin-top:18px" data-act="netCancel">Cancel</button></div>`;return;}
    const prof=myProfile();
    const profileBits=`<div class="field"><div class="label">Your pen <em>bought pens work online too</em></div><div class="picker">${ownedPens().map(p=>penPick(p,p.id===prof.pen,'pickPen','online')).join('')}</div></div>
      <div class="field" style="margin-bottom:0"><div class="label">Your color</div><div class="swatches">${TEAM.map(t=>`<button class="sw ${prof.color===t.id?'on':''}" style="--sw:${t.c}" data-act="setColor" data-v="${t.id}" aria-label="${t.n}"></button>`).join('')}</div></div>`;
    if(NET.state==='lobby'&&NET.lobby){
      const L=NET.lobby,host=NET.role==='host',canShare=!!navigator.share;
      const rows=L.players.map(p=>{const col=teamColor(p.color),me=p.pid===NET.me;
        return `<div class="stand ${me?'first':''}"><div class="av" style="--c:${col}">${p.cpu?ICON('cpu'):esc(initials(p.name))}</div>
          <div class="meta"><b>${esc(p.name)} ${me?'<span class="chip next">You</span>':''}${p.host?' <span class="chip">Host</span>':''}${p.cpu?' <span class="chip">CPU</span>':''}</b>
          <small>${esc(PEN(p.pen).name)} · ${CLASSES[classOf(PEN(p.pen).mass)].name}</small></div>
          ${host&&p.cpu?`<select class="sel" style="width:auto" data-cpu="${p.pid}" aria-label="CPU level">${Object.entries(QUICK_DIFF).map(([k,d])=>`<option value="${k}" ${k===p.cpu?'selected':''}>${d.n}</option>`).join('')}</select>
            <button class="icon-btn" data-act="netRemoveCpu" data-id="${p.pid}" aria-label="Remove CPU">${ICON('x')}</button>`:''}</div>`;}).join('');
      const settings=host?`<div class="field" style="margin-top:0"><div class="label">Desk <em>from your collection</em></div><div class="picker">${ARENAS.map(a=>deskPick(a,a.id===L.arena,'online')).join('')}</div></div>
        <div class="field"><div class="label">Rounds to win</div><div class="seg">${[1,2,3,5].map(n=>`<button class="${+L.need===n?'on':''}" data-act="netSet" data-k="need" data-v="${n}">${n}</button>`).join('')}</div></div>
        <div class="field" style="margin-bottom:0"><div class="label">Shot clock <em>keeps everyone moving</em></div><div class="seg">${[[0,'Off'],[10,'10 s'],[20,'20 s'],[30,'30 s']].map(([v,l])=>`<button class="${+L.clock===v?'on':''}" data-act="netSet" data-k="clock" data-v="${v}">${l}</button>`).join('')}</div></div>`
        :`<div class="kv" style="margin:0"><span>Desk</span><b>${esc(ARENA(L.arena).name)}</b><span>Rounds to win</span><b>${L.need}</b><span>Shot clock</span><b>${+L.clock?L.clock+' s':'Off'}</b></div>`;
      el.innerHTML=`<div class="panel" style="text-align:center"><div class="label" style="justify-content:center">Room code</div><div class="roomcode">${esc(L.code)}</div>
          <div class="btn-row" style="justify-content:center"><button class="btn sm" style="flex:0 0 auto;min-width:0" data-act="netCopy">${ICON('copy')} Copy invite</button>${canShare?`<button class="btn sm" style="flex:0 0 auto;min-width:0" data-act="netShare">${ICON('share')} Share</button>`:''}</div>
          <p class="sub" style="margin-top:12px">${host?'Friends open Desk Duel, tap <b>Online</b>, then type this code.':'You’re in! The host will start the match.'}</p></div>
        <div class="panel"><h3>Players · ${L.players.length}/3</h3><div class="standings" style="margin-top:10px">${rows}</div>
          ${host&&L.players.length<3?`<button class="btn block" style="margin-top:10px" data-act="netAddCpu">${ICON('cpu')} Add a CPU player</button>`:''}</div>
        <div class="panel"><h3 style="margin-bottom:10px">Match settings</h3>${settings}</div>
        <div class="panel"><h3 style="margin-bottom:4px">You</h3>${profileBits}</div>
        <div class="cta">${host?`<div class="note">${ICON('users')} ${L.players.length<2?'Waiting for at least one more player':'Ready when you are'}</div><button class="btn primary lg block ${L.players.length<2?'disabled':''}" data-act="netStart">${ICON('play')} Start match</button>`
          :`<div class="note">${ICON('users')} Waiting for the host to start…</div>`}<button class="btn block ghost" style="margin-top:8px" data-act="leaveRoom">Leave room</button></div>`;
      requestAnimationFrame(()=>drawPicks(el));return;
    }
    el.innerHTML=`${NET.err?`<div class="panel errbox">${ICON('x')}<span>${esc(NET.err)}</span></div>`:''}
      <div class="panel"><h3>Play online with friends</h3><p class="sub">2–3 players, each on their own phone or computer. Everyone needs Desk Duel open and an internet connection.</p>
        <div class="field"><div class="label">Your name</div><input class="txt" id="onName" maxlength="14" placeholder="Your name" value="${esc(S.profile.name||'')}" autocomplete="nickname"></div>${profileBits}</div>
      <div class="panel"><button class="btn primary lg block" data-act="netHost">${ICON('globe')} Create a room</button>
        <div class="or">or join a friend</div>
        <div class="joinrow"><input class="txt codein" id="joinCode" maxlength="5" placeholder="CODE" value="${esc(UI.joinCode||'')}" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-label="Room code"><button class="btn lg" data-act="netJoin">Join</button></div></div>
      <p class="sub" style="text-align:center;font-size:12px;margin:4px 8px 0">Players connect directly to each other. Coins you win online are saved on your own device.</p>`;
    requestAnimationFrame(()=>drawPicks(el));
  }
  $('#onlineBody').addEventListener('input',e=>{const el=e.target;
    if(el.id==='onName'){S.profile.name=el.value.slice(0,14);persist();}
    else if(el.id==='joinCode'){const v=el.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);if(v!==el.value)el.value=v;UI.joinCode=v;}});
  $('#onlineBody').addEventListener('change',e=>{const el=e.target;
    if(el.id==='onName')netUpdateProfile();
    else if(el.dataset.cpu&&NET.role==='host'){const p=NET.lobby.players.find(x=>x.pid===el.dataset.cpu);if(p){p.cpu=el.value;netLobbyChanged();}}});
  $('#onlineBody').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='joinCode'){e.preventDefault();ACT.netJoin();}});

  /* ---------- results ---------- */
  function finishMatch(){
    if(M.demo){startDemo();return;}
    if(isHost())netBroadcast({k:'matchEnd'});
    M.phase='matchEnd';
    const R=computeRewards(),sorted=[...M.players].sort((a,b)=>b.score-a.score||b.kos-a.kos),champ=sorted[0];
    const xpBefore=S.xp/xpNeed(S.level)*100,lvlBefore=S.level;let ups=[],unlockNote='';
    if(R){
      S.coins+=R.total;S.stats.coinsEarned+=R.total;S.stats.matches++;
      const streaky=M.mode==='quick'||M.mode==='career';
      if(R.won){S.stats.wins++;if(streaky){S.stats.streak++;S.stats.bestStreak=Math.max(S.stats.bestStreak,S.stats.streak);}
        if(R.flawless)S.stats.flawless++;if(M.mode==='quick'&&M.diff==='expert')S.stats.expertWins++;}
      else{S.stats.losses++;if(streaky)S.stats.streak=0;}
      if(M.mode==='party'){S.stats.party++;if(M.players.length===3)S.stats.party3++;}
      if(M.mode==='online'){S.stats.online++;if(R.won)S.stats.onlineWins++;}
      if(M.mode==='career'&&R.won){const o=M.career;S.career[o.id]=(S.career[o.id]||0)+1;S.stats.careerWins++;
        if(o.boss&&o.league<LEAGUES.length-1){const nl=LEAGUES[o.league+1];unlockNote=ownsClass(nl.cls)?`${nl.name} is now open!`:`${nl.name} unlocked. Buy a ${CLASSES[nl.cls].name} pen in the shop to enter.`;}}
      ups=addXp(R.xp);persist();
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
      <div class="standings">${sorted.map((p,i)=>`<div class="stand ${i===0?'first':''}"><div class="pos">${i+1}</div><div class="av" style="--c:${p.col}">${esc(initials(p.name))}</div>
        <div class="meta"><b>${esc(p.name)}</b><small>${esc(PEN(p.pen).name)} · ${p.kos} KO${p.kos===1?'':'s'}${p.selfKos?` · ${p.selfKos} self`:''}</small></div><div class="sc">${p.score}</div></div>`).join('')}</div>
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
  function claimDaily(){const d=dailyState();if(d.claimed)return;const v=DAILY[d.idx];S.coins+=v;S.daily={last:d.today,streak:d.streak};persist();
    closeModal();SFX.buy();refreshCoins(true);toast('Daily reward','+'+v+' coins · day '+(d.idx+1)+' streak','gift');RENDER.menu();}
  function welcome(){
    S.seenWelcome=1;persist();
    openModal(`<h3>Welcome to Desk Duel</h3><p class="sub">The pen fighting championship. Flick your pen, knock rivals off the desk, earn coins and work your way up from Featherweight to Titan.</p>
      <div class="kv"><span>Starting coins</span><b>${COIN}250</b>${S._veteran?`<span>Veteran bonus</span><b>${COIN}${fmt(S._veteran)}</b>`:''}<span>Your pen</span><b>Classic Ballpoint</b></div>
      <div class="btn-row"><button class="btn" data-act="closeModal">Look around</button><button class="btn primary" data-act="welcomeGo">${ICON('play')} Start Career</button></div>`);
  }

  /* ---------- actions ---------- */
  function fullscreen(){try{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().then(()=>{try{screen.orientation.lock('portrait').catch(()=>{});}catch(e){}}).catch(()=>{});}catch(e){}}
  const QUIET=new Set(['back','doBuy','claimDaily','roundNext']);
  const ACT={
    go:el=>{if(el.dataset.tab)UI.shopTab=el.dataset.tab;closeModal();go(el.dataset.to);},
    back:()=>{SFX.back();if(SCREEN==='online'&&NET.on){ACT.leaveRoom();return;}back();},
    sound:()=>{S.settings.sound=S.settings.sound?0:1;SND.unlock();SND.setVol();persist();syncSoundIcon();if(SCREEN==='settings')RENDER.settings();},
    fullscreen,
    daily:openDaily,claimDaily,closeModal,welcomeGo:()=>{closeModal();go('career');},
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
    toggleS:el=>{const k=el.dataset.k;S.settings[k]=S.settings[k]?0:1;persist();if(k==='sound'){SND.setVol();syncSoundIcon();}RENDER.settings();},
    setColor:el=>{S.profile.color=el.dataset.v;persist();netUpdateProfile();if(SCREEN==='online')renderOnline();else RENDER.settings();},
    replayTut:()=>{S.settings.tut=0;persist();toast('Tutorial hint on','It shows on your next turn','help','blue');},
    reset:()=>openModal(`<h3>Reset all progress?</h3><p class="sub">Coins, pens, desks, career, stats and trophies will be erased. This cannot be undone.</p>
      <div class="btn-row"><button class="btn" data-act="closeModal">Cancel</button><button class="btn danger" data-act="doReset">Erase everything</button></div>`),
    doReset:()=>{const keep=S.settings;S=defaultSave();S.settings=keep;S.seenWelcome=1;persist();closeModal();refreshCoins();RENDER.settings();toast('Progress reset','Fresh start with 250 coins','refresh','blue');},
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
    careerNext:()=>{const nx=nextOpp();toMenu();go('career');if(nx)setTimeout(()=>oppPreview(nx.id),120);}
  };
  document.addEventListener('click',e=>{
    const el=e.target.closest('[data-act]');if(!el||el.disabled||el.classList.contains('disabled'))return;
    const f=ACT[el.dataset.act];if(!f)return;SND.unlock();if(!QUIET.has(el.dataset.act))SFX.ui();f(el,e);
  });
  addEventListener('keydown',e=>{
    if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'))return;
    if(e.key==='Escape'){
      if(modalOpen()){closeModal();return;}
      if(M.on&&!M.demo&&M.phase!=='matchEnd'){if(DRAG){DRAG=null;hidePower();return;}if(SCREEN==='pause')pause(false);else if(SCREEN===null)pause(true);else back();}
      else if(SCREEN==='online'&&NET.on)ACT.leaveRoom();
      else if(SCREEN&&SCREEN!=='menu'&&SCREEN!=='results')back();
    }else if((e.key===' '||e.key==='Enter')&&M.phase==='roundEnd'&&!M.demo&&SCREEN===null){e.preventDefault();nextRound();}
  });

  /* ============================ MAIN LOOP ============================ */
  let lastT=0,acc=0;
  function frame(ts){
    const dt=Math.min(.05,Math.max(0,(ts-lastT)/1000));lastT=ts;
    if(NET.role==='guest')guestTick();
    const run=M.on&&!M.paused&&M.W;let al=1;
    if(run){
      let sc=1;if(FX.slow>0){FX.slow=Math.max(0,FX.slow-dt);sc=FX.slow>.3?.3:lerp(1,.3,FX.slow/.3);}
      acc+=dt*sc;let n=0;
      while(acc>=PH.tick&&n<8){for(const b of M.W.bodies){b.px=b.x;b.py=b.y;b.pa=b.a;}stepWorld(M.W,PH.tick,EV);trails();acc-=PH.tick;n++;}
      if(n>=8)acc=0;al=acc/PH.tick;
      updateMatch(dt);updateFX(dt*sc);
    }else updateFX(dt);
    render(al,ts/1000);
    requestAnimationFrame(frame);
  }
  function boot(){
    loadSave();SND.setVol();layout();startDemo();showScreen('menu');
    requestAnimationFrame(t=>{lastT=t;requestAnimationFrame(frame);});
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{LAYERS.key='';DESK_CACHE.clear();});
    let room='';try{room=(new URLSearchParams(location.search).get('room')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);}catch(e){}
    if(room.length===5){UI.joinCode=room;S.seenWelcome=1;persist();go('online');}
    else if(!S.seenWelcome)setTimeout(welcome,800);
  }
  addEventListener('resize',()=>{layout();DESK_CACHE.clear();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&M.on&&!M.demo&&!online()&&SCREEN===null&&!M.paused&&M.phase!=='roundEnd'&&M.phase!=='matchEnd')pause(true);});
  document.addEventListener('pointerdown',()=>SND.unlock(),{passive:true});
    // automated tests can reach the game state when the page is opened with ?ddtest
    if(/[?&]ddtest\b/.test(location.search))window.__DD={M,NET,S:()=>S,VIEW,FX,screen:()=>SCREEN,PH,PENS,ARENAS,startMatch,predictPath,flick,stepWorld,makeWorld,makeBody,simulate,edgeMargin,aiCfg,Planner,cloneWorld};
  boot();

}
