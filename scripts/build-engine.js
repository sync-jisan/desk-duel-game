const fs = require('fs');

const html = fs.readFileSync('public/desk-duel.html', 'utf8');
const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
const lastScript = scriptMatch[scriptMatch.length - 1].replace(/<\/?script[^>]*>/gi, '');
const lines = lastScript.split('\n');

const saveIdx = lines.findIndex(l => l.includes('/* ============================== SAVE =============================== */'));
const physIdx = lines.findIndex(l => l.includes('/* ============================= PHYSICS ============================='));
const rendIdx = lines.findIndex(l => l.includes('/* ============================ RENDERER ============================ */'));
const bootCallIdx = lines.findIndex(l => l.trim() === 'boot();' && lines.indexOf(l) > 3000);

console.log('Indices:', { saveIdx, physIdx, rendIdx, bootCallIdx });

// Part 1: from SAVE to PHYSICS
const part1 = lines.slice(saveIdx, physIdx).join('\n');

// Part 2: from RENDERER to before final boot(); })();
const part2Lines = lines.slice(rendIdx, bootCallIdx);
let part2 = part2Lines.join('\n');

// Replace local getSupabase declaration with imported version
const sbDeclRegex = /\/\* ---------- Supabase Client & Cloud Progress ---------- \*\/[\s\S]*?function getSupabase\(\)\{[\s\S]*?\n\}/;
if (sbDeclRegex.test(part2)) {
  part2 = part2.replace(sbDeclRegex, '/* ---------- Supabase Client & Cloud Progress ---------- */\nfunction hasSupabaseKey(){return !!getSupabase();}');
  console.log('Replaced local getSupabase declaration successfully.');
} else {
  console.warn('Could not match sbDeclRegex!');
}

const header = `// Generated from Desk Duel Next.js conversion with Supabase Realtime, Cloud Save & Google OAuth
/* The game runtime: save data, audio, renderer, match rules, Supabase realtime & cloud save, Google Auth and UI.
   startGame() wires everything to the DOM rendered by components/GameMarkup.jsx. */
import {$,TAU,clamp,lerp,rand,randn,fmt,esc,now,initials,dayKey,mulberry,hashStr,_rgb,hex2rgb,shade,rgba,mix,ICON,COIN,$$} from './utils';
import {TEAM,teamColor,CLASSES,classOf,PENS,PEN,ARENAS,ARENA,LEAGUES,ALL_OPP,QUICK_DIFF,DAILY,ACH,ownsClassIn} from './data';
import {PH,OBS_MAT,flickSpeed,makeWorld,makeBody,cloneWorld,edgeMargin,SUP,friction,SS,segSeg,closestSeg,capsuleDist,CAND,cand,newContact,pushContact,wake,emitManifold,capCap,capCircle,CLIP,clipRect,capBox,prep,applyImp,solveV,solveB,substep,stepWorld,flick,bodiesResting,settled,simulate,predictPath,aiCfg,clearLine,scoreState,Planner} from './physics';
import { getSupabase } from '@/lib/supabase';

let started=false;
export function startGame(){
  if(started)return; // React Strict Mode runs effects twice in development
  started=true;
`;

const footer = `
  if(/[?&]ddtest\\b/.test(location.search))window.__DD={M,NET,S:()=>S,VIEW,FX,screen:()=>SCREEN,PH,PENS,ARENAS,startMatch,predictPath,flick,stepWorld,makeWorld,makeBody,simulate,edgeMargin,aiCfg,Planner,cloneWorld};
  boot();
}
`;

const fullEngine = header + '\n' + part1 + '\n' + part2 + '\n' + footer;
fs.writeFileSync('lib/game/engine.js', fullEngine, 'utf8');
console.log('Written lib/game/engine.js, size:', fullEngine.length);
