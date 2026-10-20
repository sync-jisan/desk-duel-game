// Generated from the single-file Desk Duel v2. Edit freely.
import {$,TAU,clamp,lerp,rand,randn,fmt,esc,now,initials,dayKey,mulberry,hashStr,_rgb,hex2rgb,shade,rgba,mix,ICON,COIN,$$} from './utils';

/* ============================= PHYSICS =============================
   Rigid-body capsules sliding on a desk, in real units (mm, g, s).
   - Coulomb friction integrated at 9 points along each pen, so spin and
     slide are coupled exactly like a real rod (spinning pens curve, and
     both motions die out together). Sideways friction is lower for round
     pens (they partly roll). Only points over the desk carry weight, so a
     pen hanging over the edge pivots and drags realistically.
   - A flick is modelled as a finger (effective mass 200 g) striking the pen at the grab
     point: heavy pens launch slower but carry more momentum, and hitting
     near the end converts energy into spin.
   - Sequential-impulse contact solver with restitution, Coulomb contact
     friction, two-point manifolds for flat contacts, split-impulse
     position correction, adaptive sub-stepping (max 2 mm per sub-step,
     so nothing tunnels) and sleeping.
   =================================================================== */
const PH={g:9810,tick:1/120,maxDisp:2.0,nFric:9,iters:8,biasIters:3,slop:.2,beta:.35,restThresh:70,margin:.6,hitMin:35,
  fingerMass:200,fingerE:.5,fingerSpeed:1300,maxPull:120,penMu:.24,sleepV:4,sleepW:.05,sleepT:.12,cr:14,fallDur:1.05};
const OBS_MAT={book:{e:.28,mu:.45,snd:'book'},eraser:{e:.6,mu:.65,snd:'rubber'},mug:{e:.45,mu:.25,snd:'ceramic'},stapler:{e:.5,mu:.3,snd:'metal'},
  jar:{e:.42,mu:.3,snd:'glass'},ruler:{e:.5,mu:.25,snd:'plastic'},nameplate:{e:.45,mu:.35,snd:'wood'},cup:{e:.4,mu:.3,snd:'metal'},inkwell:{e:.4,mu:.3,snd:'glass'}};

function flickSpeed(m){return (1+PH.fingerE)*PH.fingerMass/(PH.fingerMass+m)*PH.fingerSpeed;}

function makeWorld(arena,land){
  const w=land?arena.h:arena.w,h=land?arena.w:arena.h;
  const W={w,h,cr:PH.cr,mu:arena.mu,land,bodies:[],obs:[],t:0,C:[],nc:0,memo:new Map()};
  arena.obs.forEach((o,i)=>{
    const p=land?{x:(1-o.v)*w,y:o.u*h}:{x:o.u*w,y:o.v*h},m=OBS_MAT[o.k]||OBS_MAT.book;
    const ob={isObs:true,oi:i,k:o.k,c:o.c,x:p.x,y:p.y,vx:0,vy:0,w:0,bvx:0,bvy:0,bw:0,im:0,iI:0,e:m.e,mu:m.mu,snd:m.snd};
    if(o.t==='box'){
      const a=(o.a||0)+(land?Math.PI/2:0),rr=o.rr!=null?o.rr:3,ca=Math.cos(a),sa=Math.sin(a);
      Object.assign(ob,{t:'box',a,ca,sa,bw:0,sw:o.w,sh:o.h,hx:o.w/2-rr,hy:o.h/2-rr,rr});
      const ex=Math.abs(ca)*o.w/2+Math.abs(sa)*o.h/2,ey=Math.abs(sa)*o.w/2+Math.abs(ca)*o.h/2;
      ob.x0=p.x-ex;ob.x1=p.x+ex;ob.y0=p.y-ey;ob.y1=p.y+ey;
    }else Object.assign(ob,{t:'circle',r:o.r,rr:o.r,x0:p.x-o.r,x1:p.x+o.r,y0:p.y-o.r,y1:p.y+o.r});
    W.obs.push(ob);
  });
  return W;
}
function makeBody(pen,x,y,a,owner){
  const m=pen.mass,L=pen.len,r=pen.rad,I=m*(L*L/12+r*r/4);
  return {isObs:false,pen,owner,x,y,a,px:x,py:y,pa:a,vx:0,vy:0,w:0,bvx:0,bvy:0,bw:0,ux:Math.cos(a),uy:Math.sin(a),
    m,im:1/m,I,iI:1/I,L,r,h:L/2-r,grip:pen.grip,roll:pen.roll,e:pen.e,mat:pen.mat,state:'on',asleep:true,sleepT:0,fallT:0,danger:0};
}
function cloneWorld(W){const C=Object.assign({},W);C.bodies=W.bodies.map(b=>Object.assign({},b));C.C=[];C.nc=0;C.memo=null;return C;}

/* Signed distance from a point to the desk's rounded-rectangle edge (positive = on the desk). */
function edgeMargin(W,x,y){
  const hw=W.w/2,hh=W.h/2,cr=W.cr,qx=Math.abs(x-hw)-(hw-cr),qy=Math.abs(y-hh)-(hh-cr);
  if(qx<=0&&qy<=0)return cr-(qx>qy?qx:qy);
  const ox=qx>0?qx:0,oy=qy>0?qy:0;return cr-Math.sqrt(ox*ox+oy*oy);
}

/* ---- friction: distributed Coulomb friction along the pen ---- */
const SUP=new Uint8Array(16);
function friction(W,b,h){
  const N=PH.nFric,ux=b.ux,uy=b.uy,half=b.L/2-b.r*.5;
  let ns=N;
  if(edgeMargin(W,b.x,b.y)>half+1){for(let k=0;k<N;k++)SUP[k]=1;}
  else{ns=0;for(let k=0;k<N;k++){const s=-half+2*half*k/(N-1),ok=edgeMargin(W,b.x+ux*s,b.y+uy*s)>=0?1:0;SUP[k]=ok;ns+=ok;}}
  b.danger=N-ns;
  if(!ns)return;
  const mu=W.mu*b.grip,q=b.m*PH.g/ns,eps=Math.max(3,2*mu*PH.g*h),roll=b.roll;
  let Fx=0,Fy=0,T=0;
  for(let k=0;k<N;k++){
    if(!SUP[k])continue;
    const s=-half+2*half*k/(N-1),rx=ux*s,ry=uy*s,pvx=b.vx-b.w*ry,pvy=b.vy+b.w*rx;
    const va=pvx*ux+pvy*uy,vl=pvy*ux-pvx*uy,sp=Math.sqrt(va*va+vl*vl);
    if(sp<1e-7)continue;
    const f=mu*q/(sp>eps?sp:eps),fa=-va*f,fl=-vl*f*roll,fx=fa*ux-fl*uy,fy=fa*uy+fl*ux;
    Fx+=fx;Fy+=fy;T+=rx*fy-ry*fx;
  }
  b.vx+=Fx*b.im*h;b.vy+=Fy*b.im*h;b.w+=T*b.iI*h;
}

/* ---- geometry helpers ---- */
const SS={ax:0,ay:0,bx:0,by:0},CP={x:0,y:0};
function segSeg(p1x,p1y,q1x,q1y,p2x,p2y,q2x,q2y,o){
  const d1x=q1x-p1x,d1y=q1y-p1y,d2x=q2x-p2x,d2y=q2y-p2y,rx=p1x-p2x,ry=p1y-p2y;
  const a=d1x*d1x+d1y*d1y,e=d2x*d2x+d2y*d2y,f=d2x*rx+d2y*ry;let s,t;
  if(a<=1e-9&&e<=1e-9){s=0;t=0;}
  else if(a<=1e-9){s=0;t=clamp(f/e,0,1);}
  else{const c=d1x*rx+d1y*ry;
    if(e<=1e-9){t=0;s=clamp(-c/a,0,1);}
    else{const b=d1x*d2x+d1y*d2y,den=a*e-b*b;s=den>1e-9?clamp((b*f-c*e)/den,0,1):0;t=(b*s+f)/e;
      if(t<0){t=0;s=clamp(-c/a,0,1);}else if(t>1){t=1;s=clamp((b-c)/a,0,1);}}}
  o.ax=p1x+d1x*s;o.ay=p1y+d1y*s;o.bx=p2x+d2x*t;o.by=p2y+d2y*t;
}
function closestSeg(px,py,ax,ay,bx,by,o){const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;let t=l>1e-12?((px-ax)*dx+(py-ay)*dy)/l:0;t=t<0?0:t>1?1:t;o.x=ax+dx*t;o.y=ay+dy*t;return t;}
function capsuleDist(A,B){
  const ac=Math.cos(A.a),as=Math.sin(A.a),bc=Math.cos(B.a),bs=Math.sin(B.a);
  segSeg(A.x-ac*A.h,A.y-as*A.h,A.x+ac*A.h,A.y+as*A.h,B.x-bc*B.h,B.y-bs*B.h,B.x+bc*B.h,B.y+bs*B.h,SS);
  return Math.hypot(SS.bx-SS.ax,SS.by-SS.ay)-A.r-B.r;
}

/* ---- contact generation ---- */
const CAND=new Float64Array(40);let NC=0;
function cand(ax,ay,bx,by){const i=NC*5,dx=bx-ax,dy=by-ay;CAND[i]=ax;CAND[i+1]=ay;CAND[i+2]=bx;CAND[i+3]=by;CAND[i+4]=Math.sqrt(dx*dx+dy*dy);NC++;}
function newContact(W){let c=W.C[W.nc];if(!c){c={A:null,B:null,nx:0,ny:0,px:0,py:0,sep:0,rax:0,ray:0,rbx:0,rby:0,kn:0,kt:0,jn:0,jt:0,jb:0,bounce:0,mu:0,e:0};W.C[W.nc]=c;}W.nc++;return c;}
function pushContact(W,A,B,ax,ay,bx,by,d,nx,ny,rA,rB,mu,e){
  const c=newContact(W);c.A=A;c.B=B;c.nx=nx;c.ny=ny;
  c.px=((ax+nx*rA)+(bx-nx*rB))*.5;c.py=((ay+ny*rA)+(by-ny*rB))*.5;c.sep=d-rA-rB;c.mu=mu;c.e=e;c.jn=0;c.jt=0;c.jb=0;
}
function wake(b){if(b.asleep){b.asleep=false;b.sleepT=0;}}
/* Picks the deepest candidate plus a second, well-separated one (stable line contact for pens lying side by side). */
function emitManifold(W,A,B,rA,rB,fnx,fny,mu,e){
  const lim=rA+rB+PH.margin;let i0=-1,d0=1e9;
  for(let i=0;i<NC;i++){const d=CAND[i*5+4];if(d<lim&&d<d0){d0=d;i0=i;}}
  if(i0<0)return 0;
  let k=i0*5,nx,ny;
  if(d0>1e-6){nx=(CAND[k+2]-CAND[k])/d0;ny=(CAND[k+3]-CAND[k+1])/d0;}else{nx=fnx;ny=fny;}
  pushContact(W,A,B,CAND[k],CAND[k+1],CAND[k+2],CAND[k+3],d0,nx,ny,rA,rB,mu,e);
  const p0x=CAND[k],p0y=CAND[k+1];let i1=-1,best=6;
  for(let i=0;i<NC;i++){
    if(i===i0)continue;const j=i*5,d=CAND[j+4];if(d>=lim||d<1e-6)continue;
    const mx=(CAND[j+2]-CAND[j])/d,my=(CAND[j+3]-CAND[j+1])/d;if(mx*nx+my*ny<.6)continue;
    const sp=Math.hypot(CAND[j]-p0x,CAND[j+1]-p0y);if(sp>best){best=sp;i1=i;}
  }
  if(i1>=0){const j=i1*5,d=CAND[j+4];pushContact(W,A,B,CAND[j],CAND[j+1],CAND[j+2],CAND[j+3],d,(CAND[j+2]-CAND[j])/d,(CAND[j+3]-CAND[j+1])/d,rA,rB,mu,e);}
  if(A.asleep)wake(A);if(!B.isObs&&B.asleep)wake(B);
  return 1;
}
function capCap(W,A,B){
  const dx=B.x-A.x,dy=B.y-A.y,R=A.h+B.h+A.r+B.r+PH.margin;if(dx*dx+dy*dy>R*R)return;
  const a0x=A.x-A.ux*A.h,a0y=A.y-A.uy*A.h,a1x=A.x+A.ux*A.h,a1y=A.y+A.uy*A.h;
  const b0x=B.x-B.ux*B.h,b0y=B.y-B.uy*B.h,b1x=B.x+B.ux*B.h,b1y=B.y+B.uy*B.h;
  NC=0;
  segSeg(a0x,a0y,a1x,a1y,b0x,b0y,b1x,b1y,SS);cand(SS.ax,SS.ay,SS.bx,SS.by);
  closestSeg(a0x,a0y,b0x,b0y,b1x,b1y,CP);cand(a0x,a0y,CP.x,CP.y);
  closestSeg(a1x,a1y,b0x,b0y,b1x,b1y,CP);cand(a1x,a1y,CP.x,CP.y);
  closestSeg(b0x,b0y,a0x,a0y,a1x,a1y,CP);cand(CP.x,CP.y,b0x,b0y);
  closestSeg(b1x,b1y,a0x,a0y,a1x,a1y,CP);cand(CP.x,CP.y,b1x,b1y);
  let fnx=-A.uy,fny=A.ux;if(fnx*dx+fny*dy<0){fnx=-fnx;fny=-fny;}
  emitManifold(W,A,B,A.r,B.r,fnx,fny,PH.penMu,Math.sqrt(A.e*B.e));
}
function capCircle(W,A,O){
  const ex=Math.abs(A.ux)*A.h+A.r+PH.margin,ey=Math.abs(A.uy)*A.h+A.r+PH.margin;
  if(A.x+ex<O.x0||A.x-ex>O.x1||A.y+ey<O.y0||A.y-ey>O.y1)return;
  closestSeg(O.x,O.y,A.x-A.ux*A.h,A.y-A.uy*A.h,A.x+A.ux*A.h,A.y+A.uy*A.h,CP);
  NC=0;cand(CP.x,CP.y,O.x,O.y);
  const dx=O.x-A.x,dy=O.y-A.y,l=Math.hypot(dx,dy)||1;
  emitManifold(W,A,O,A.r,O.r,dx/l,dy/l,O.mu,Math.sqrt(A.e*O.e));
}
const CLIP={t0:0,t1:1};
function clipRect(px,py,dx,dy,hx,hy,o){
  let t0=0,t1=1;const P=[-dx,dx,-dy,dy],Q=[px+hx,hx-px,py+hy,hy-py];
  for(let i=0;i<4;i++){const p=P[i],q=Q[i];
    if(Math.abs(p)<1e-12){if(q<0)return false;}
    else{const r=q/p;if(p<0){if(r>t1)return false;if(r>t0)t0=r;}else{if(r<t0)return false;if(r<t1)t1=r;}}}
  o.t0=t0;o.t1=t1;return true;
}
function capBox(W,A,O){
  const ex=Math.abs(A.ux)*A.h+A.r+PH.margin,ey=Math.abs(A.uy)*A.h+A.r+PH.margin;
  if(A.x+ex<O.x0||A.x-ex>O.x1||A.y+ey<O.y0||A.y-ey>O.y1)return;
  const ca=O.ca,sa=O.sa,rx=A.x-O.x,ry=A.y-O.y,lx=rx*ca+ry*sa,ly=-rx*sa+ry*ca,lux=A.ux*ca+A.uy*sa,luy=-A.ux*sa+A.uy*ca;
  const p0x=lx-lux*A.h,p0y=ly-luy*A.h,p1x=lx+lux*A.h,p1y=ly+luy*A.h,hx=O.hx,hy=O.hy;
  const toW=(x,y,o)=>{o[0]=O.x+x*ca-y*sa;o[1]=O.y+x*sa+y*ca;};
  const wa=[0,0],wb=[0,0];
  if(clipRect(p0x,p0y,p1x-p0x,p1y-p0y,hx,hy,CLIP)){
    // Deep penetration (segment core inside the box core): push out along the shallowest axis.
    const t=(CLIP.t0+CLIP.t1)/2,mx=p0x+(p1x-p0x)*t,my=p0y+(p1y-p0y)*t,dxp=hx-Math.abs(mx),dyp=hy-Math.abs(my);
    let ox,oy,bx,by,depth;
    if(dxp<dyp){ox=mx>=0?1:-1;oy=0;bx=ox*hx;by=my;depth=dxp;}else{ox=0;oy=my>=0?1:-1;bx=mx;by=oy*hy;depth=dyp;}
    toW(mx,my,wa);toW(bx,by,wb);const nx=-(ox*ca-oy*sa),ny=-(ox*sa+oy*ca);
    pushContact(W,A,O,wa[0],wa[1],wb[0],wb[1],-depth,nx,ny,A.r,O.rr,O.mu,Math.sqrt(A.e*O.e));if(A.asleep)wake(A);return;
  }
  NC=0;let bd=1e9,bax=0,bay=0,bbx=0,bby=0;
  const E=[-hx,-hy,hx,-hy, hx,-hy,hx,hy, hx,hy,-hx,hy, -hx,hy,-hx,-hy];
  for(let i=0;i<16;i+=4){segSeg(p0x,p0y,p1x,p1y,E[i],E[i+1],E[i+2],E[i+3],SS);const d=Math.hypot(SS.bx-SS.ax,SS.by-SS.ay);
    if(d<bd){bd=d;bax=SS.ax;bay=SS.ay;bbx=SS.bx;bby=SS.by;}}
  const add=(ax,ay,bx,by)=>{toW(ax,ay,wa);toW(bx,by,wb);cand(wa[0],wa[1],wb[0],wb[1]);};
  add(bax,bay,bbx,bby);
  add(p0x,p0y,clamp(p0x,-hx,hx),clamp(p0y,-hy,hy));
  add(p1x,p1y,clamp(p1x,-hx,hx),clamp(p1y,-hy,hy));
  const dx=O.x-A.x,dy=O.y-A.y,l=Math.hypot(dx,dy)||1;
  emitManifold(W,A,O,A.r,O.rr,dx/l,dy/l,O.mu,Math.sqrt(A.e*O.e));
}

/* ---- contact solver ---- */
function prep(W,c,ev){
  const A=c.A,B=c.B,nx=c.nx,ny=c.ny,tx=-ny,ty=nx;
  c.rax=c.px-A.x;c.ray=c.py-A.y;c.rbx=c.px-B.x;c.rby=c.py-B.y;
  const rna=c.rax*ny-c.ray*nx,rnb=c.rbx*ny-c.rby*nx,rta=c.rax*ty-c.ray*tx,rtb=c.rbx*ty-c.rby*tx;
  c.kn=1/(A.im+B.im+rna*rna*A.iI+rnb*rnb*B.iI);c.kt=1/(A.im+B.im+rta*rta*A.iI+rtb*rtb*B.iI);
  const dvx=(B.vx-B.w*c.rby)-(A.vx-A.w*c.ray),dvy=(B.vy+B.w*c.rbx)-(A.vy+A.w*c.rax),vn=dvx*nx+dvy*ny;
  c.bounce=vn<-PH.restThresh?-c.e*vn:0;
  if(ev&&W.memo){
    const key=A.owner*100+(B.isObs?50+B.oi:B.owner),last=W.memo.get(key);
    if(vn<-PH.hitMin&&(last===undefined||W.t-last>.06))ev.hit(A,B,-vn,c.px,c.py);
    W.memo.set(key,W.t);
  }
}
function applyImp(A,B,px,py,c){
  A.vx-=px*A.im;A.vy-=py*A.im;A.w-=(c.rax*py-c.ray*px)*A.iI;
  B.vx+=px*B.im;B.vy+=py*B.im;B.w+=(c.rbx*py-c.rby*px)*B.iI;
}
function solveV(c){
  const A=c.A,B=c.B,nx=c.nx,ny=c.ny,tx=-ny,ty=nx;
  let dvx=(B.vx-B.w*c.rby)-(A.vx-A.w*c.ray),dvy=(B.vy+B.w*c.rbx)-(A.vy+A.w*c.rax);
  const vn=dvx*nx+dvy*ny;let l=(c.bounce-vn)*c.kn;const j0=c.jn;c.jn=j0+l>0?j0+l:0;l=c.jn-j0;
  if(l!==0)applyImp(A,B,l*nx,l*ny,c);
  dvx=(B.vx-B.w*c.rby)-(A.vx-A.w*c.ray);dvy=(B.vy+B.w*c.rbx)-(A.vy+A.w*c.rax);
  const vt=dvx*tx+dvy*ty,mx=c.mu*c.jn,t0=c.jt;let lt=-vt*c.kt;c.jt=clamp(t0+lt,-mx,mx);lt=c.jt-t0;
  if(lt!==0)applyImp(A,B,lt*tx,lt*ty,c);
}
function solveB(c,h){
  const A=c.A,B=c.B,nx=c.nx,ny=c.ny;
  const dvx=(B.bvx-B.bw*c.rby)-(A.bvx-A.bw*c.ray),dvy=(B.bvy+B.bw*c.rbx)-(A.bvy+A.bw*c.rax),vn=dvx*nx+dvy*ny;
  const target=PH.beta*Math.max(-c.sep-PH.slop,0)/h;let l=(target-vn)*c.kn;const j0=c.jb;c.jb=j0+l>0?j0+l:0;l=c.jb-j0;
  if(l!==0){const px=l*nx,py=l*ny;
    A.bvx-=px*A.im;A.bvy-=py*A.im;A.bw-=(c.rax*py-c.ray*px)*A.iI;
    B.bvx+=px*B.im;B.bvy+=py*B.im;B.bw+=(c.rbx*py-c.rby*px)*B.iI;}
}

/* ---- stepping ---- */
function substep(W,h,ev){
  const B=W.bodies,nb=B.length;
  for(let i=0;i<nb;i++){const b=B[i];if(b.state!=='on')continue;b.ux=Math.cos(b.a);b.uy=Math.sin(b.a);if(!b.asleep)friction(W,b,h);}
  W.nc=0;
  for(let i=0;i<nb;i++){const A=B[i];if(A.state!=='on')continue;
    for(let j=i+1;j<nb;j++){const C=B[j];if(C.state!=='on'||(A.asleep&&C.asleep))continue;capCap(W,A,C);}
    if(!A.asleep)for(const o of W.obs){if(o.t==='box')capBox(W,A,o);else capCircle(W,A,o);}}
  const nc=W.nc,C=W.C;
  for(let k=0;k<nc;k++)prep(W,C[k],ev);
  for(let it=0;it<PH.iters;it++)for(let k=0;k<nc;k++)solveV(C[k]);
  for(let it=0;it<PH.biasIters;it++)for(let k=0;k<nc;k++)solveB(C[k],h);
  for(let i=0;i<nb;i++){const b=B[i];if(b.state!=='on'||b.asleep)continue;
    b.x+=(b.vx+b.bvx)*h;b.y+=(b.vy+b.bvy)*h;b.a+=(b.w+b.bw)*h;b.bvx=b.bvy=b.bw=0;
    if(b.vx*b.vx+b.vy*b.vy<PH.sleepV*PH.sleepV&&Math.abs(b.w)<PH.sleepW){b.sleepT+=h;if(b.sleepT>PH.sleepT){b.asleep=true;b.vx=b.vy=b.w=0;}}else b.sleepT=0;
  }
  W.t+=h;
  for(let i=0;i<nb;i++){const b=B[i];if(b.state!=='on')continue;
    if(edgeMargin(W,b.x,b.y)<0){
      b.state='fall';b.fallT=0;b.asleep=false;
      // the pen tips over the edge: give it a little outward drift
      let nx=b.x-clamp(b.x,W.cr,W.w-W.cr),ny=b.y-clamp(b.y,W.cr,W.h-W.cr),l=Math.hypot(nx,ny);
      if(l<1e-6){nx=b.x-W.w/2;ny=b.y-W.h/2;l=Math.hypot(nx,ny)||1;}nx/=l;ny/=l;
      const vo=b.vx*nx+b.vy*ny;if(vo<140){b.vx+=nx*(140-vo);b.vy+=ny*(140-vo);}
      b.fnx=nx;b.fny=ny;
      if(ev)ev.fall(b);
    }}
}
function stepWorld(W,dt,ev){
  let vmax=0,any=false;
  for(const b of W.bodies){
    if(b.state==='fall'){b.fallT+=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.a+=b.w*dt;b.w*=1-.6*dt;if(b.fallT>=PH.fallDur)b.state='out';continue;}
    if(b.state!=='on'||b.asleep)continue;any=true;
    const s=Math.sqrt(b.vx*b.vx+b.vy*b.vy)+Math.abs(b.w)*b.L*.5;if(s>vmax)vmax=s;
  }
  if(!any){W.t+=dt;return;}
  const n=Math.min(64,Math.max(2,Math.ceil(vmax*dt/PH.maxDisp))),h=dt/n;
  for(let i=0;i<n;i++)substep(W,h,ev);
}
/* Finger-strike flick: t = grab offset along the pen (mm), ang = shot direction, p = power 0..1 */
function flick(b,t,ang,p){
  const dx=Math.cos(ang),dy=Math.sin(ang),ux=Math.cos(b.a),uy=Math.sin(b.a);
  t=clamp(t,-b.L/2+2,b.L/2-2);
  const rx=ux*t,ry=uy*t,rn=rx*dy-ry*dx,mEff=1/(b.im+rn*rn*b.iI),u=clamp(p,0,1)*PH.fingerSpeed;
  const J=(1+PH.fingerE)*PH.fingerMass*mEff/(PH.fingerMass+mEff)*u;
  b.vx+=J*dx*b.im;b.vy+=J*dy*b.im;b.w+=rn*J*b.iI;b.asleep=false;b.sleepT=0;
}
function bodiesResting(W){for(const b of W.bodies)if(b.state==='on'&&!b.asleep)return false;return true;}
function settled(W){for(const b of W.bodies){if(b.state==='on'&&!b.asleep)return false;if(b.state==='fall'&&b.fallT<.7)return false;}return true;}
function simulate(W,maxT){for(let t=0;t<maxT;t+=PH.tick){stepWorld(W,PH.tick,null);if(bodiesResting(W))break;}}

/* Aim assist: simulate the shooter's pen alone (with obstacles) until it rests, falls, or first touches another pen. */
function predictPath(W,bi,t,ang,p){
  const b=Object.assign({},W.bodies[bi]),PW=Object.assign({},W,{bodies:[b],C:[],nc:0,memo:null});
  flick(b,t,ang,p);
  const others=W.bodies.filter((o,i)=>i!==bi&&o.state==='on'),pts=[b.x,b.y];let res='rest',hx=0,hy=0;
  outer:for(let k=0;k<420;k++){
    stepWorld(PW,PH.tick,null);
    if(b.state!=='on'){res='fall';pts.push(b.x,b.y);break;}
    pts.push(b.x,b.y);
    for(const o of others){if(capsuleDist(b,o)<.5){res='hit';hx=b.x;hy=b.y;break outer;}}
    if(b.asleep)break;
  }
  return {pts,res,x:b.x,y:b.y,a:b.a,hx,hy};
}

/* ================================ AI ================================
   The CPU plans like a real player: it imagines dozens of flicks with the
   same physics engine, scores each outcome (knockouts, its own safety,
   rivals left near the edge, distance from threats), stress-tests the best
   few against its own hand shake, then executes with skill-based error.
   Planning is time-sliced across frames so the game never stutters.
   =================================================================== */
function aiCfg(s){s=clamp(s,0,1);return {skill:s,samples:Math.round(8+s*s*160+s*30),angErr:lerp(.15,.006,Math.pow(s,.75)),powErr:lerp(.2,.018,s),tErr:lerp(.3,.03,s),
  think:lerp(.55,1.05,s),aggr:lerp(.5,1,s),caution:lerp(.12,1,s),robust:s>=.3?Math.round(1+s*6):0,threat:s>.45};}
/* Is the straight line between two points free of obstacles (with some clearance)? */
function clearLine(W,x0,y0,x1,y1,pad){
  for(const o of W.obs){
    if(o.t==='circle'){closestSeg(o.x,o.y,x0,y0,x1,y1,CP);if(Math.hypot(CP.x-o.x,CP.y-o.y)<o.r+pad)return false;}
    else{const rx=x0-o.x,ry=y0-o.y,lx=rx*o.ca+ry*o.sa,ly=-rx*o.sa+ry*o.ca,qx=x1-o.x,qy=y1-o.y,mx=qx*o.ca+qy*o.sa,my=-qx*o.sa+qy*o.ca;
      if(clipRect(lx,ly,mx-lx,my-ly,o.sw/2+pad,o.sh/2+pad,CLIP))return false;}
  }
  return true;
}
function scoreState(W,me,opp,cfg){
  const A=W.bodies[me];let ko=0;for(const i of opp)if(W.bodies[i].state!=='on')ko++;
  if(A.state!=='on')return -20000+ko*400;
  // the longer a round lasts, the more the CPU gets impatient and goes for the kill
  const imp=1+(cfg.turn||0)*.14,caution=cfg.caution/(1+(cfg.turn||0)*.1);
  let s=ko*3000;if(ko===opp.length)s+=20000;
  s+=caution*Math.min(edgeMargin(W,A.x,A.y),150)*8;
  for(const i of opp){const O=W.bodies[i];if(O.state!=='on')continue;
    s+=cfg.aggr*imp*(150-Math.min(edgeMargin(W,O.x,O.y),150))*6;
    if(W.obs.length&&clearLine(W,A.x,A.y,O.x,O.y,6))s+=cfg.aggr*(imp-1)*260;
    if(cfg.threat)s+=Math.min(Math.hypot(O.x-A.x,O.y-A.y),280)*.8*caution;}
  return s;
}
class Planner{
  constructor(W,me,cfg){
    this.W=W;this.me=me;this.cfg=cfg;this.opp=[];
    W.bodies.forEach((b,i)=>{if(i!==me&&b.state==='on')this.opp.push(i);});
    this.cands=this.gen();this.k=0;this.stage=0;this.top=null;this.done=false;this.best=null;
  }
  gen(){
    const W=this.W,A=W.bodies[this.me],hA=A.L/2,out=[],cfg=this.cfg;
    for(let n=0;n<cfg.samples;n++){
      let ang,p;const r=Math.random();
      if(r<.8&&this.opp.length){
        let tot=0;const ws=this.opp.map(i=>{const O=W.bodies[i],w=1/(30+Math.max(0,edgeMargin(W,O.x,O.y)));tot+=w;return w;});
        let x=Math.random()*tot,ti=this.opp[0];for(let j=0;j<ws.length;j++){x-=ws[j];if(x<=0){ti=this.opp[j];break;}}
        const O=W.bodies[ti],s=(Math.random()*2-1)*O.L*.42,ax=O.x+Math.cos(O.a)*s,ay=O.y+Math.sin(O.a)*s;
        ang=Math.atan2(ay-A.y,ax-A.x)+randn()*.05;p=clamp(.3+Math.random()*.75,.15,1);
      }else if(r<.88&&this.opp.length&&W.obs.length){const O=W.bodies[this.opp[Math.random()*this.opp.length|0]];
        ang=Math.atan2(O.y-A.y,O.x-A.x)+(Math.random()<.5?1:-1)*(Math.PI/2+randn()*.45);p=.15+Math.random()*.4;}
      else if(r<.94){ang=Math.atan2(W.h/2-A.y,W.w/2-A.x)+randn()*.5;p=.1+Math.random()*.35;}
      else{ang=Math.random()*TAU;p=.2+Math.random()*.8;}
      const t=(Math.random()<.6?(Math.random()*2-1)*.2:(Math.random()*2-1)*.85)*hA;
      out.push({ang,t,p,sc:-1e9});
    }
    return out;
  }
  evalShot(c){const W2=cloneWorld(this.W);flick(W2.bodies[this.me],c.t,c.ang,c.p);simulate(W2,4.5);return scoreState(W2,this.me,this.opp,this.cfg);}
  work(ms){
    const end=now()+ms,cfg=this.cfg;
    while(!this.done&&now()<end){
      if(this.stage===0){
        if(this.k<this.cands.length){const c=this.cands[this.k++];c.sc=this.evalShot(c);}
        else{this.cands.sort((a,b)=>b.sc-a.sc);
          if(cfg.robust>0){this.top=this.cands.slice(0,Math.min(4,this.cands.length)).map(c=>({c,sum:c.sc,n:1}));this.stage=1;this.k=0;}
          else this.finish(this.cands[0]);}
      }else{
        const total=this.top.length*cfg.robust;
        if(this.k<total){const e=this.top[this.k%this.top.length],c=e.c,hA=this.W.bodies[this.me].L/2;this.k++;
          e.sum+=this.evalShot({ang:c.ang+randn()*cfg.angErr*1.2,t:c.t+randn()*cfg.tErr*.5*hA,p:clamp(c.p*(1+randn()*cfg.powErr*1.2),.05,1)});e.n++;}
        else{this.top.sort((a,b)=>b.sum/b.n-a.sum/a.n);this.finish(this.top[0].c);}
      }
    }
    return this.done;
  }
  finish(c){const cfg=this.cfg,hA=this.W.bodies[this.me].L/2;
    this.best={ang:c.ang+randn()*cfg.angErr,t:clamp(c.t+randn()*cfg.tErr*hA*.5,-hA*.9,hA*.9),p:clamp(c.p*(1+randn()*cfg.powErr),.08,1)};this.done=true;}
  result(){if(!this.done){const ev=this.cands.slice(0,Math.max(1,this.k)).sort((a,b)=>b.sc-a.sc);this.finish(ev[0]);}return this.best;}
}

export {PH,OBS_MAT,flickSpeed,makeWorld,makeBody,cloneWorld,edgeMargin,SUP,friction,SS,segSeg,closestSeg,capsuleDist,CAND,cand,newContact,pushContact,wake,emitManifold,capCap,capCircle,CLIP,clipRect,capBox,prep,applyImp,solveV,solveB,substep,stepWorld,flick,bodiesResting,settled,simulate,predictPath,aiCfg,clearLine,scoreState,Planner};
