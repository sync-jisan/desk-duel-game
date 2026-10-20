// Generated from the single-file Desk Duel v2. Edit freely.
/* Small math, colour and string helpers shared by the whole game. */
/* ============================ UTILITIES ============================ */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const TAU=Math.PI*2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const randn=()=>{let u=0;while(u===0)u=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(TAU*Math.random());};
const fmt=n=>Math.round(n).toLocaleString('en-US');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=()=>performance.now();
const initials=n=>{const w=String(n).replace(/^(the|mr\.?|mrs\.?|ms\.?|dr\.?|captain|professor)\s+/i,'').split(/\s+/).filter(Boolean);
  if(!w.length)return '?';if(w.length===1)return w[0].length<=3?w[0].toUpperCase():w[0][0].toUpperCase();return (w[0][0]+w[w.length-1][0]).toUpperCase();};
function dayKey(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function mulberry(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
const _rgb=new Map();
function hex2rgb(h){let c=_rgb.get(h);if(c)return c;let s=h.replace('#','');if(s.length===3)s=s.split('').map(x=>x+x).join('');const n=parseInt(s,16);c=[n>>16&255,n>>8&255,n&255];_rgb.set(h,c);return c;}
function shade(h,k,a){const [r,g,b]=hex2rgb(h),t=k<0?0:255,f=Math.abs(k);const R=r+(t-r)*f|0,G=g+(t-g)*f|0,B=b+(t-b)*f|0;return a==null?`rgb(${R},${G},${B})`:`rgba(${R},${G},${B},${a})`;}
function rgba(h,a){const [r,g,b]=hex2rgb(h);return `rgba(${r},${g},${b},${a})`;}
function mix(h1,h2,t){const a=hex2rgb(h1),b=hex2rgb(h2);return '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*t).toString(16).padStart(2,'0')).join('');}
const ICON=(id,cls='i')=>`<svg class="${cls}"><use href="#i-${id}"/></svg>`;
const COIN='<svg class="coin"><use href="#i-coin"/></svg>';


export {$,TAU,clamp,lerp,rand,randn,fmt,esc,now,initials,dayKey,mulberry,hashStr,_rgb,hex2rgb,shade,rgba,mix,ICON,COIN,$$};
