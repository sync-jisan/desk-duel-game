/* All static screens, the HUD, Auth Gate, and the icon sprite.
   The engine (lib/game/engine.js) fills in dynamic content and switches screens by toggling classes. */
export default function GameMarkup() {
  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="gcoin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe9a3" />
            <stop offset=".5" stopColor="#ffc23d" />
            <stop offset="1" stopColor="#e58a00" />
          </linearGradient>

          {/* ---- shared illustration gradients (dd-*) ---- */}
          <linearGradient id="dd-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff3c4" /><stop offset=".38" stopColor="#ffcf4d" /><stop offset="1" stopColor="#e07b00" />
          </linearGradient>
          <linearGradient id="dd-goldD" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffc23d" /><stop offset="1" stopColor="#a85a00" />
          </linearGradient>
          <linearGradient id="dd-blue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9cc8ff" /><stop offset=".42" stopColor="#3b82f6" /><stop offset="1" stopColor="#1e3a8a" />
          </linearGradient>
          <linearGradient id="dd-red" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffb0b0" /><stop offset=".42" stopColor="#ef4444" /><stop offset="1" stopColor="#8f1414" />
          </linearGradient>
          <linearGradient id="dd-green" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bbf7d0" /><stop offset=".42" stopColor="#22c55e" /><stop offset="1" stopColor="#14532d" />
          </linearGradient>
          <linearGradient id="dd-violet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e9d5ff" /><stop offset=".42" stopColor="#a78bfa" /><stop offset="1" stopColor="#4c1d95" />
          </linearGradient>
          <linearGradient id="dd-pink" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fbcfe8" /><stop offset=".42" stopColor="#f472b6" /><stop offset="1" stopColor="#9d174d" />
          </linearGradient>
          <linearGradient id="dd-cyan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cffafe" /><stop offset=".42" stopColor="#38bdf8" /><stop offset="1" stopColor="#075985" />
          </linearGradient>
          <linearGradient id="dd-steel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" /><stop offset=".5" stopColor="#cbd5e1" /><stop offset="1" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="dd-bag" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c4b5fd" /><stop offset=".45" stopColor="#8b5cf6" /><stop offset="1" stopColor="#4c1d95" />
          </linearGradient>
          <linearGradient id="dd-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e7b876" /><stop offset="1" stopColor="#b0763a" />
          </linearGradient>
          <radialGradient id="dd-globe" cx=".35" cy=".3" r=".8">
            <stop offset="0" stopColor="#bae6fd" /><stop offset=".45" stopColor="#3b82f6" /><stop offset="1" stopColor="#172554" />
          </radialGradient>
          <radialGradient id="dd-burst" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#ffffff" /><stop offset=".3" stopColor="#fff1b0" /><stop offset=".65" stopColor="#ffb21f" stopOpacity=".75" /><stop offset="1" stopColor="#ff7a00" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="dd-glow" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".55" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="dd-glowGold" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#ffc23d" stopOpacity=".5" /><stop offset="1" stopColor="#ffc23d" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="dd-shadow" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#000" stopOpacity=".45" /><stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>

          {/* sparkle + pens (tip points right, viewBox 100x20) */}
          <symbol id="dd-spark" viewBox="-6 -6 12 12"><path d="M0-6 1.4-1.4 6 0 1.4 1.4 0 6-1.4 1.4-6 0-1.4-1.4z" fill="#fff" /></symbol>
          <symbol id="dd-pen-base" viewBox="0 0 100 20">
            <rect x="6" y="0.6" width="26" height="4.4" rx="2.2" fill="url(#dd-steel)" />
            <rect x="69" y="3.2" width="6" height="13.6" fill="url(#dd-steel)" />
            <path d="M75 3.6 92 8.4v3.2L75 16.4z" fill="url(#dd-steel)" />
            <path d="M92 8.4 99.4 10 92 11.6z" fill="#1e293b" />
            <rect x="8" y="5" width="60" height="2.6" rx="1.3" fill="#fff" opacity=".5" />
          </symbol>
          <symbol id="dd-pen-blue" viewBox="0 0 100 20"><rect x="1" y="3" width="70" height="14" rx="7" fill="url(#dd-blue)" /><rect x="1" y="3" width="22" height="14" rx="7" fill="#0b1020" opacity=".3" /><use href="#dd-pen-base" width="100" height="20" /></symbol>
          <symbol id="dd-pen-red" viewBox="0 0 100 20"><rect x="1" y="3" width="70" height="14" rx="7" fill="url(#dd-red)" /><rect x="1" y="3" width="22" height="14" rx="7" fill="#0b1020" opacity=".3" /><use href="#dd-pen-base" width="100" height="20" /></symbol>
          <symbol id="dd-pen-green" viewBox="0 0 100 20"><rect x="1" y="3" width="70" height="14" rx="7" fill="url(#dd-green)" /><rect x="1" y="3" width="22" height="14" rx="7" fill="#0b1020" opacity=".3" /><use href="#dd-pen-base" width="100" height="20" /></symbol>
          <symbol id="dd-pen-violet" viewBox="0 0 100 20"><rect x="1" y="3" width="70" height="14" rx="7" fill="url(#dd-violet)" /><rect x="1" y="3" width="22" height="14" rx="7" fill="#0b1020" opacity=".3" /><use href="#dd-pen-base" width="100" height="20" /></symbol>
          <symbol id="dd-pen-pink" viewBox="0 0 100 20"><rect x="1" y="3" width="70" height="14" rx="7" fill="url(#dd-pink)" /><rect x="1" y="3" width="22" height="14" rx="7" fill="#0b1020" opacity=".3" /><use href="#dd-pen-base" width="100" height="20" /></symbol>
          <symbol id="dd-pen-cyan" viewBox="0 0 100 20"><rect x="1" y="3" width="70" height="14" rx="7" fill="url(#dd-cyan)" /><rect x="1" y="3" width="22" height="14" rx="7" fill="#0b1020" opacity=".3" /><use href="#dd-pen-base" width="100" height="20" /></symbol>
          <symbol id="dd-pen-gold" viewBox="0 0 100 20"><rect x="1" y="3" width="70" height="14" rx="7" fill="url(#dd-gold)" /><rect x="1" y="3" width="22" height="14" rx="7" fill="#3a1d00" opacity=".25" /><use href="#dd-pen-base" width="100" height="20" /></symbol>

          {/* ---- mode tile illustrations (viewBox 120x100) ---- */}
          <symbol id="art-career" viewBox="0 0 120 100">
            <circle cx="60" cy="46" r="46" fill="url(#dd-glow)" />
            <use href="#dd-pen-blue" x="6" y="36" width="108" height="22" transform="rotate(-38 60 47)" />
            <use href="#dd-pen-red" x="6" y="36" width="108" height="22" transform="translate(120 0) scale(-1 1) rotate(-38 60 47)" />
            <path d="M40 30H30a12 12 0 0 0 13 15M80 30h10a12 12 0 0 1-13 15" fill="none" stroke="#b86d04" strokeWidth="5.5" strokeLinecap="round" />
            <path d="M40 30H30a12 12 0 0 0 13 15M80 30h10a12 12 0 0 1-13 15" fill="none" stroke="url(#dd-gold)" strokeWidth="3.4" strokeLinecap="round" />
            <path d="M38 22h44v18c0 14-9.5 23-22 23S38 54 38 40z" fill="url(#dd-gold)" stroke="#a35f00" strokeWidth="1.4" />
            <ellipse cx="60" cy="22.5" rx="22" ry="3.2" fill="#ffe9a3" stroke="#a35f00" strokeWidth="1.2" />
            <path d="M45 27c0 13 3 22 9 28" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".55" />
            <path d="m60 31 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" fill="#fff7d6" stroke="#b86d04" strokeWidth=".8" />
            <path d="M55 62h10l1.5 10h-13z" fill="url(#dd-goldD)" />
            <rect x="42" y="71" width="36" height="7" rx="3" fill="url(#dd-gold)" stroke="#a35f00" strokeWidth="1.1" />
            <rect x="37" y="78" width="46" height="11" rx="3.5" fill="#3b2410" />
            <rect x="37" y="78" width="46" height="3" rx="1.5" fill="#6b4220" />
            <rect x="50" y="81.5" width="20" height="4.6" rx="1.2" fill="url(#dd-gold)" />
            <use href="#dd-spark" x="88" y="8" width="12" height="12" />
            <use href="#dd-spark" x="20" y="14" width="8" height="8" />
            <use href="#dd-spark" x="94" y="52" width="7" height="7" opacity=".8" />
          </symbol>

          <symbol id="art-quick" viewBox="0 0 120 100">
            <circle cx="60" cy="52" r="40" fill="url(#dd-burst)" opacity=".85" />
            <path d="M60 22l6 18 18-8-10 16 20 6-20 5 10 17-18-9-6 19-6-19-18 9 10-17-20-5 20-6-10-16 18 8z" fill="#ffd76a" opacity=".35" />
            <use href="#dd-pen-blue" x="-6" y="44" width="70" height="15" transform="rotate(-14 60 52)" />
            <use href="#dd-pen-red" x="-6" y="44" width="70" height="15" transform="translate(120 0) scale(-1 1) rotate(-14 60 52)" />
            <path d="M8 36h14M4 46h12M10 72h12M98 36h14M104 64h12M96 74h12" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".35" />
            <path d="M68 6 45 50h14l-8 44 31-52H66z" fill="url(#dd-gold)" stroke="#7a4300" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M66 12 51 44" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".7" />
            <use href="#dd-spark" x="84" y="14" width="10" height="10" />
            <use href="#dd-spark" x="26" y="78" width="8" height="8" opacity=".85" />
          </symbol>

          <symbol id="art-party" viewBox="0 0 120 100">
            <ellipse cx="60" cy="92" rx="40" ry="6" fill="url(#dd-shadow)" />
            <circle cx="60" cy="50" r="40" fill="url(#dd-glow)" opacity=".7" />
            <use href="#dd-pen-violet" x="58" y="83" width="80" height="16" transform="rotate(-124 60 91)" />
            <use href="#dd-pen-green" x="58" y="83" width="80" height="16" transform="rotate(-56 60 91)" />
            <use href="#dd-pen-blue" x="58" y="83" width="86" height="17" transform="rotate(-90 60 91)" />
            <rect x="18" y="20" width="6" height="3.4" rx="1" fill="#f472b6" transform="rotate(30 21 22)" />
            <rect x="96" y="16" width="6" height="3.4" rx="1" fill="#ffc23d" transform="rotate(-25 99 18)" />
            <rect x="88" y="44" width="5" height="3" rx="1" fill="#38bdf8" transform="rotate(50 90 45)" />
            <rect x="24" y="52" width="5" height="3" rx="1" fill="#22c55e" transform="rotate(-40 26 53)" />
            <circle cx="34" cy="10" r="2.2" fill="#38bdf8" />
            <circle cx="104" cy="32" r="2" fill="#f472b6" />
            <circle cx="14" cy="38" r="1.8" fill="#ffc23d" />
            <use href="#dd-spark" x="70" y="2" width="10" height="10" />
            <use href="#dd-spark" x="38" y="24" width="7" height="7" opacity=".8" />
          </symbol>

          <symbol id="art-online" viewBox="0 0 120 100">
            <circle cx="60" cy="50" r="44" fill="url(#dd-glow)" opacity=".6" />
            <ellipse cx="60" cy="50" rx="54" ry="15" fill="none" stroke="#ffd76a" strokeWidth="1.6" strokeDasharray="3 5" opacity=".55" transform="rotate(-18 60 50)" />
            <circle cx="60" cy="50" r="31" fill="url(#dd-globe)" stroke="#0f1f4d" strokeWidth="1.2" />
            <path d="M44 30c6 2 9 7 6 11s-9 3-10 9 4 9 2 13c-4-3-11-10-11-17 0-6 5-13 13-16zM66 22c6 1 13 5 17 12-4 2-9 0-12 3s0 9-4 11-8-3-8-8 4-6 4-11-2-5 3-7zM70 64c4-3 10-3 13 0-2 6-8 11-14 13-1-5-3-10 1-13z" fill="#34d399" opacity=".88" />
            <path d="M29 50h62M60 19c9 9 9 53 0 62M60 19c-9 9-9 53 0 62" fill="none" stroke="#fff" strokeWidth="1" opacity=".22" />
            <ellipse cx="49" cy="34" rx="10" ry="6" fill="#fff" opacity=".28" transform="rotate(-30 49 34)" />
            <path d="M8 62c22 12 82 0 104-26" fill="none" stroke="#ffd76a" strokeWidth="1.6" strokeDasharray="3 5" opacity=".7" />
            <use href="#dd-pen-red" x="70" y="10" width="42" height="9" transform="rotate(-24 91 14)" />
            <use href="#dd-pen-gold" x="4" y="70" width="42" height="9" transform="rotate(14 25 74)" />
            <circle cx="96" cy="70" r="5" fill="#22c55e" stroke="#0b1020" strokeWidth="2" />
            <circle cx="96" cy="70" r="9" fill="none" stroke="#22c55e" strokeWidth="1.4" opacity=".5" />
            <use href="#dd-spark" x="14" y="16" width="9" height="9" />
          </symbol>

          <symbol id="art-shop" viewBox="0 0 120 100">
            <ellipse cx="58" cy="93" rx="38" ry="5" fill="url(#dd-shadow)" />
            <circle cx="60" cy="48" r="42" fill="url(#dd-glow)" opacity=".6" />
            <use href="#dd-pen-cyan" x="50" y="40" width="62" height="13" transform="rotate(-72 50 46)" />
            <use href="#dd-pen-pink" x="50" y="40" width="58" height="13" transform="rotate(-112 56 46)" />
            <path d="M47 40v-7a13 13 0 0 1 26 0v7" fill="none" stroke="#ede9fe" strokeWidth="4" strokeLinecap="round" />
            <path d="M28 40h64l-5 50a3 3 0 0 1-3 3H36a3 3 0 0 1-3-3z" fill="url(#dd-bag)" stroke="#2e1065" strokeWidth="1.3" />
            <path d="M28 40h64l-.7 7H28.7z" fill="#2e1065" opacity=".35" />
            <path d="M35 50c1 12 2 26 4 37" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".35" />
            <circle cx="47" cy="40" r="2.4" fill="#2e1065" /><circle cx="73" cy="40" r="2.4" fill="#2e1065" />
            <use href="#i-coin" x="48" y="56" width="24" height="24" />
            <use href="#i-coin" x="86" y="70" width="22" height="22" />
            <use href="#i-coin" x="92" y="58" width="17" height="17" />
            <use href="#dd-spark" x="16" y="30" width="9" height="9" />
            <use href="#dd-spark" x="98" y="30" width="7" height="7" opacity=".85" />
          </symbol>

          {/* ---- brand mark (viewBox 160x84) ---- */}
          <symbol id="art-brand" viewBox="0 0 160 84">
            <circle cx="80" cy="42" r="40" fill="url(#dd-glowGold)" />
            <use href="#dd-pen-blue" x="4" y="30" width="142" height="28" transform="rotate(-16 80 44)" />
            <use href="#dd-pen-red" x="4" y="30" width="142" height="28" transform="translate(160 0) scale(-1 1) rotate(-16 80 44)" />
            <circle cx="80" cy="40" r="18" fill="url(#dd-burst)" />
            <use href="#dd-spark" x="68" y="28" width="24" height="24" />
            <use href="#dd-spark" x="112" y="6" width="10" height="10" opacity=".85" />
            <use href="#dd-spark" x="34" y="10" width="8" height="8" opacity=".7" />
          </symbol>

          {/* ---- auth hero (viewBox 320x180) ---- */}
          <symbol id="art-auth" viewBox="0 0 320 180">
            <ellipse cx="160" cy="88" rx="150" ry="80" fill="url(#dd-glowGold)" opacity=".7" />
            <path d="M52 108h216l34 52H18z" fill="url(#dd-wood)" />
            <path d="M18 160h284v9a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z" fill="#6e4219" />
            <path d="M60 120c50-4 120 4 190-2M44 136c70-5 150 5 232-1M32 150c80-4 170 4 258 0" fill="none" stroke="#8a5a2b" strokeWidth="1.2" opacity=".35" />
            <path d="M52 108h216l3 4H49z" fill="#fff" opacity=".22" />
            <ellipse cx="104" cy="130" rx="58" ry="7" fill="url(#dd-shadow)" />
            <ellipse cx="216" cy="130" rx="58" ry="7" fill="url(#dd-shadow)" />
            <use href="#dd-pen-blue" x="44" y="104" width="116" height="23" transform="rotate(-10 102 116)" />
            <use href="#dd-pen-red" x="44" y="104" width="116" height="23" transform="translate(320 0) scale(-1 1) rotate(-10 102 116)" />
            <circle cx="160" cy="102" r="28" fill="url(#dd-burst)" />
            <path d="M160 74l4 14 12-6-6 12 14 4-14 4 6 12-12-6-4 14-4-14-12 6 6-12-14-4 14-4-6-12 12 6z" fill="#fff6d0" opacity=".7" />
            <path d="M132 86l-12-8M188 86l12-8M140 70l-5-12M180 70l5-12" stroke="#ffd76a" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M138 26h44v14c0 12-9 19-22 19s-22-7-22-19z" fill="url(#dd-gold)" stroke="#a35f00" strokeWidth="1.3" />
            <path d="M138 30h-8a10 10 0 0 0 11 12M182 30h8a10 10 0 0 1-11 12" fill="none" stroke="url(#dd-gold)" strokeWidth="3.4" strokeLinecap="round" />
            <path d="M154 58h12l1 6h-14z" fill="url(#dd-goldD)" />
            <rect x="148" y="63" width="24" height="5" rx="2" fill="url(#dd-gold)" />
            <path d="M145 30c0 9 2 16 7 21" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity=".55" />
            <use href="#i-coin" x="56" y="34" width="30" height="30" />
            <use href="#i-coin" x="236" y="26" width="34" height="34" />
            <use href="#i-coin" x="262" y="70" width="22" height="22" />
            <use href="#i-coin" x="30" y="76" width="20" height="20" />
            <use href="#dd-spark" x="104" y="16" width="12" height="12" />
            <use href="#dd-spark" x="208" y="60" width="10" height="10" />
            <use href="#dd-spark" x="286" y="20" width="9" height="9" opacity=".8" />
            <use href="#dd-spark" x="22" y="40" width="8" height="8" opacity=".7" />
          </symbol>

          <symbol id="i-coin" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10.6" fill="url(#gcoin)" stroke="#a35f00" strokeWidth="1.1" />
            <circle cx="12" cy="12" r="7.4" fill="none" stroke="#b86d04" strokeWidth="1.3" opacity=".75" />
            <path d="m12 7.6 1.35 2.75 3.03.44-2.19 2.14.52 3.02L12 14.52l-2.71 1.43.52-3.02-2.19-2.14 3.03-.44z" fill="#a35f00" opacity=".85" />
          </symbol>
          <symbol id="i-play" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" /></symbol>
          <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="17" cy="9" r="2.8" /><path d="M16.5 14.2c2.8.3 5 2.4 5 5.3" /></symbol>
          <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></symbol>
          <symbol id="i-cpu" viewBox="0 0 24 24"><rect x="4.5" y="7" width="15" height="12" rx="3.2" /><path d="M12 3.2V7M9 12.2h.01M15 12.2h.01M9.5 15.8h5M2.5 12v3M21.5 12v3" /></symbol>
          <symbol id="i-trophy" viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H4.5a3.2 3.2 0 0 0 3.8 4.2M16 6h3.5a3.2 3.2 0 0 1-3.8 4.2" /><path d="M12 13v4M8.5 20.5h7M9.5 17h5" /></symbol>
          <symbol id="i-bag" viewBox="0 0 24 24"><path d="M5 8h14l-1.1 12.1a1 1 0 0 1-1 .9H7.1a1 1 0 0 1-1-.9z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></symbol>
          <symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></symbol>
          <symbol id="i-chart" viewBox="0 0 24 24"><path d="M5 20v-7M11 20V5M17 20v-10M3 20.5h18" /></symbol>
          <symbol id="i-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 4" /><path d="M12 17.3h.01" /></symbol>
          <symbol id="i-vol" viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></symbol>
          <symbol id="i-mute" viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="m16 9 6 6M22 9l-6 6" /></symbol>
          <symbol id="i-expand" viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></symbol>
          <symbol id="i-pause" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.3" fill="currentColor" stroke="none" /><rect x="14" y="5" width="4" height="14" rx="1.3" fill="currentColor" stroke="none" /></symbol>
          <symbol id="i-back" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></symbol>
          <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9.5" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></symbol>
          <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></symbol>
          <symbol id="i-gift" viewBox="0 0 24 24"><rect x="3.5" y="8" width="17" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12M12 8S10.6 3.6 8.2 4.4 8.8 8 12 8zM12 8s1.4-4.4 3.8-3.6S15.2 8 12 8z" /></symbol>
          <symbol id="i-star" viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></symbol>
          <symbol id="i-crown" viewBox="0 0 24 24"><path d="M3 8l4.2 4.2L12 5l4.8 7.2L21 8l-2 11H5z" /></symbol>
          <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></symbol>
          <symbol id="i-bolt" viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></symbol>
          <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></symbol>
          <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></symbol>
          <symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></symbol>
          <symbol id="i-flag" viewBox="0 0 24 24"><path d="M5 21V4M5 4h12l-2.5 4.5L17 13H5" /></symbol>
          <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
          <symbol id="i-pen" viewBox="0 0 24 24"><path d="M4 20l1.5-5L16 4.5a2.1 2.1 0 0 1 3 3L8.5 18z" /><path d="M14 6.5l3 3" /></symbol>
          <symbol id="i-desk" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h6M7 14h3" /></symbol>
          <symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></symbol>
          <symbol id="i-copy" viewBox="0 0 24 24"><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.2" /><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" /></symbol>
          <symbol id="i-share" viewBox="0 0 24 24"><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" /></symbol>
          <symbol id="i-weight" viewBox="0 0 24 24"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></symbol>
          <symbol id="i-google" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
          </symbol>
        </defs>
      </svg>

      <canvas id="game" aria-label="Desk Duel game board"></canvas>

      {/* ============ HUD ============ */}
      <div id="hud">
        <div className="hud-top" id="hudTop">
          <div className="hud-meta"><div className="pillx"><span id="hudRound">Round 1</span><span className="sep"></span><span id="hudGoal">First to 2</span></div></div>
          <div className="hud-row" id="hudPlayers"></div>
        </div>
        <button className="icon-btn hud-pause" id="pauseBtn" data-act="pause" aria-label="Pause"><svg className="i"><use href="#i-pause" /></svg></button>
        <div className="hud-bottom" id="hudBottom">
          <div className="power" id="power"><i></i><span><b id="powerTxt">POWER 0%</b><em id="spinTxt"></em></span></div>
          <div className="turn-pill" id="turnPill"><span className="dot"></span><span id="turnText">Your turn</span><span className="clock" id="clock"></span></div>
        </div>
      </div>
      <div id="splash"></div>
      <div className="round-card" id="roundCard" data-act="roundNext"></div>
      <div id="toasts" aria-live="polite"></div>

      {/* ============ AUTH GATE SCREEN ============ */}
      <section className="screen solid active" id="scr-auth">
        <div className="scroll">
          <div className="auth-page">
            <div className="auth-card">
              <div className="auth-bonus-badge">
                <svg className="coin" style={{ width: '16px', height: '16px' }}><use href="#i-coin" /></svg>
                <span>Welcome Bonus: +500 Coins</span>
              </div>
              <div className="auth-hero" aria-hidden="true">
                <svg viewBox="0 0 320 180"><use href="#art-auth" width="320" height="180" /></svg>
              </div>
              <h1 className="auth-title">Desk Duel</h1>
              <p className="auth-sub">Fun Pen Battles · Knock Your Friends Off The Desk!</p>
              <div className="auth-features">
                <div className="auth-feat"><b>5 Leagues</b><small>Fight your way to the top</small></div>
                <div className="auth-feat"><b>Online Matches</b><small>Play with friends anywhere</small></div>
                <div className="auth-feat"><b>Lots of Pens</b><small>Unlock bigger &amp; heavier pens</small></div>
                <div className="auth-feat"><b>Cloud Save</b><small>Play on any phone or PC</small></div>
              </div>

              <div className="auth-btn-wrap">
                <button className="btn-google block hero" data-act="signInGoogle">
                  <svg><use href="#i-google" /></svg>
                  <span>Continue with Google</span>
                </button>
              </div>

              <p className="auth-footnote">
                🔒 Sign in with Google to save your pens, coins, and wins.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ MAIN MENU ============ */}
      <section className="screen" id="scr-menu">
        <header className="topbar">
          <button className="profile btn ghost" style={{ padding: '0', border: '0', height: 'auto', gap: '10px' }} data-act="go" data-to="stats" aria-label="Profile and stats">
            <div className="profile-avatar-wrap" id="mAvatarWrap">
              <div className="lvl" id="mLvl"><span>1</span></div>
            </div>
            <div className="meta" style={{ textAlign: 'left' }}><b id="mLvlName">Player</b><small id="mXp">Level 1 · 0/250 XP</small></div>
          </button>
          <div className="sp"></div>
          <button className="coin-pill" data-act="go" data-to="shop" aria-label="Coins — open shop"><svg className="coin"><use href="#i-coin" /></svg><span className="coins">0</span></button>
          <button className="icon-btn" data-act="openLeaderboard" aria-label="Global Leaderboard" title="Leaderboard"><svg className="i"><use href="#i-trophy" /></svg></button>
          <button className="icon-btn" id="giftBtn" data-act="daily" aria-label="Daily reward" title="Daily Reward"><svg className="i"><use href="#i-gift" /></svg><span className="dot hidden"></span></button>
          <button className="icon-btn" data-act="sound" aria-label="Toggle sound"><svg className="i"><use className="sndic" href="#i-vol" /></svg></button>
          <button className="icon-btn" data-act="go" data-to="settings" aria-label="Settings"><svg className="i"><use href="#i-gear" /></svg></button>
        </header>
        <div className="menu-body">
          <div className="brand">
            <svg className="brand-mark" viewBox="0 0 160 84" aria-hidden="true"><use href="#art-brand" width="160" height="84" /></svg>
            <h1>DESK<em>DUEL</em></h1>
            <p>The Desk Pen Battle Game</p>
          </div>
          <nav className="tiles" aria-label="Game modes">
            <button className="tile hero" data-act="go" data-to="career">
              <span className="ti tile-art" aria-hidden="true"><svg viewBox="0 0 120 100"><use href="#art-career" width="120" height="100" /></svg></span><span className="tag" id="careerTag">League 1</span>
              <b>Career</b><small id="careerSub">Beat 5 leagues and become the champion.</small>
              <div className="prog"><i id="careerProg" style={{ width: '0' }}></i></div>
            </button>
            <button className="tile" data-act="go" data-to="quick"><span className="ti tile-art" aria-hidden="true"><svg viewBox="0 0 120 100"><use href="#art-quick" width="120" height="100" /></svg></span><b>Quick Match</b><small>Play against the computer</small></button>
            <button className="tile" data-act="go" data-to="party"><span className="ti tile-art" aria-hidden="true"><svg viewBox="0 0 120 100"><use href="#art-party" width="120" height="100" /></svg></span><b>Party Mode</b><small>2 to 3 players on this device</small></button>
            <button className="tile" data-act="go" data-to="online"><span className="ti tile-art" aria-hidden="true"><svg viewBox="0 0 120 100"><use href="#art-online" width="120" height="100" /></svg></span><span className="tag" id="onlineTag">New</span><b>Online Mode</b><small>Play with friends on other devices</small></button>
            <button className="tile" id="shopTile" data-act="go" data-to="shop"><span className="ti tile-art" aria-hidden="true"><svg viewBox="0 0 120 100"><use href="#art-shop" width="120" height="100" /></svg></span><b>Pen Shop</b><small>Buy new pens and battle desks</small></button>
          </nav>
          <div className="menu-links">
            <button className="btn" data-act="openLeaderboard"><svg className="i"><use href="#i-trophy" /></svg>Leaderboard</button>
            <button className="btn" data-act="daily"><svg className="i"><use href="#i-gift" /></svg>Daily Bonus</button>
            <button className="btn" data-act="go" data-to="how"><svg className="i"><use href="#i-help" /></svg>How to play</button>
            <button className="btn" data-act="go" data-to="stats"><svg className="i"><use href="#i-chart" /></svg>Profile &amp; Stats</button>
            <button className="btn" data-act="fullscreen"><svg className="i"><use href="#i-expand" /></svg>Fullscreen</button>
          </div>
          <div className="version" id="mCloudStatus">v2.0 · ☁️ Sign in with Google for Cloud Save</div>
        </div>
      </section>

      {/* ============ CAREER ============ */}
      <section className="screen solid" id="scr-career">
        <header className="topbar">
          <button className="icon-btn" data-act="back" aria-label="Back"><svg className="i"><use href="#i-back" /></svg></button>
          <h2>Career</h2>
          <button className="coin-pill" data-act="go" data-to="shop"><svg className="coin"><use href="#i-coin" /></svg><span className="coins">0</span></button>
        </header>
        <div className="scroll"><div className="wrap" id="careerBody"></div></div>
      </section>

      {/* ============ QUICK MATCH ============ */}
      <section className="screen solid" id="scr-quick">
        <header className="topbar">
          <button className="icon-btn" data-act="back" aria-label="Back"><svg className="i"><use href="#i-back" /></svg></button>
          <h2>Quick Match</h2>
          <button className="coin-pill" data-act="go" data-to="shop"><svg className="coin"><use href="#i-coin" /></svg><span className="coins">0</span></button>
        </header>
        <div className="scroll"><div className="wrap narrow" id="quickBody"></div></div>
      </section>

      {/* ============ PARTY ============ */}
      <section className="screen solid" id="scr-party">
        <header className="topbar">
          <button className="icon-btn" data-act="back" aria-label="Back"><svg className="i"><use href="#i-back" /></svg></button>
          <h2>Party</h2>
          <button className="coin-pill" data-act="go" data-to="shop"><svg className="coin"><use href="#i-coin" /></svg><span className="coins">0</span></button>
        </header>
        <div className="scroll"><div className="wrap narrow" id="partyBody"></div></div>
      </section>

      {/* ============ ONLINE ============ */}
      <section className="screen solid" id="scr-online">
        <header className="topbar">
          <button className="icon-btn" data-act="back" aria-label="Back"><svg className="i"><use href="#i-back" /></svg></button>
          <h2>Online Multiplayer</h2>
          <div className="coin-pill"><svg className="coin"><use href="#i-coin" /></svg><span className="coins">0</span></div>
        </header>
        <div className="scroll"><div className="wrap narrow" id="onlineBody"></div></div>
      </section>

      {/* ============ SHOP ============ */}
      <section className="screen solid" id="scr-shop">
        <header className="topbar">
          <button className="icon-btn" data-act="back" aria-label="Back"><svg className="i"><use href="#i-back" /></svg></button>
          <h2>Pen Shop</h2>
          <div className="coin-pill"><svg className="coin"><use href="#i-coin" /></svg><span className="coins">0</span></div>
        </header>
        <div className="scroll"><div className="wrap">
          <div className="tabs" id="shopTabs">
            <button data-act="shopTab" data-tab="pens" className="on">Pens</button>
            <button data-act="shopTab" data-tab="desks">Desks</button>
          </div>
          <div id="shopBody"></div>
        </div></div>
      </section>

      {/* ============ STATS / PROFILE ============ */}
      <section className="screen solid" id="scr-stats">
        <header className="topbar">
          <button className="icon-btn" data-act="back" aria-label="Back"><svg className="i"><use href="#i-back" /></svg></button>
          <h2>Profile &amp; Stats</h2>
          <div className="coin-pill"><svg className="coin"><use href="#i-coin" /></svg><span className="coins">0</span></div>
        </header>
        <div className="scroll"><div className="wrap" id="statsBody"></div></div>
      </section>

      {/* ============ SETTINGS ============ */}
      <section className="screen solid" id="scr-settings">
        <header className="topbar">
          <button className="icon-btn" data-act="back" aria-label="Back"><svg className="i"><use href="#i-back" /></svg></button>
          <h2>Settings</h2>
        </header>
        <div className="scroll"><div className="wrap narrow" id="settingsBody"></div></div>
      </section>

      {/* ============ HOW TO PLAY ============ */}
      <section className="screen solid" id="scr-how">
        <header className="topbar">
          <button className="icon-btn" data-act="back" aria-label="Back"><svg className="i"><use href="#i-back" /></svg></button>
          <h2>How to play</h2>
        </header>
        <div className="scroll"><div className="wrap">
          <div className="how">
            <div className="card">
              <svg className="ill" viewBox="0 0 220 96">
                <ellipse cx="122" cy="58" rx="62" ry="5" fill="url(#dd-shadow)" />
                <use href="#dd-pen-blue" x="56" y="40" width="132" height="22" />
                <path d="M98 50 62 82" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray="5 6" opacity=".9" />
                <circle cx="98" cy="50" r="4.5" fill="#ffc23d" stroke="#7a4300" strokeWidth="1.2" />
                <circle cx="60" cy="84" r="11" fill="#3b82f6" opacity=".25" />
                <circle cx="60" cy="84" r="7.5" fill="#fff" stroke="#3b82f6" strokeWidth="3" />
              </svg>
              <b><span>1</span>Pull back like a slingshot</b>
              <p>Touch or click your pen, then pull back. Pull further back to shoot with more power.</p>
            </div>
            <div className="card">
              <svg className="ill" viewBox="0 0 220 96">
                <use href="#dd-pen-blue" x="30" y="56" width="110" height="18" opacity=".3" />
                <use href="#dd-pen-blue" x="92" y="28" width="110" height="18" transform="rotate(-18 147 37)" />
                <path d="M60 64C100 60 120 50 160 30" stroke="#ffc23d" strokeWidth="3" fill="none" strokeDasharray="2 8" strokeLinecap="round" />
                <path d="m160 30-11 2 6 8z" fill="#ffc23d" />
                <use href="#dd-spark" x="184" y="12" width="10" height="10" />
              </svg>
              <b><span>2</span>Let go to shoot</b>
              <p>Release your finger to shoot your pen across the desk. The dotted line shows where your pen will go.</p>
            </div>
            <div className="card">
              <svg className="ill" viewBox="0 0 220 96">
                <g transform="rotate(-20 110 50)">
                  <use href="#dd-pen-green" x="52" y="40" width="124" height="20" />
                  <circle cx="152" cy="50" r="4.5" fill="#ffc23d" stroke="#7a4300" strokeWidth="1.2" />
                </g>
                <path d="M150 16a46 46 0 0 1 26 48" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".9" />
                <path d="m176 64-9-3 8-7z" fill="#fff" />
                <path d="M70 80a46 46 0 0 1-26-40" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".35" />
              </svg>
              <b><span>3</span>Spin your shot</b>
              <p>Pull from the tip or back of your pen to make it spin. Spinning pens can hit around corners and cover more area.</p>
            </div>
            <div className="card">
              <svg className="ill" viewBox="0 0 220 96">
                <rect x="10" y="12" width="150" height="72" rx="8" fill="url(#dd-wood)" />
                <path d="M20 34c40-3 90 3 130-1M20 60c40-3 90 3 130-1" stroke="#8a5a2b" strokeWidth="1.2" fill="none" opacity=".35" />
                <rect x="10" y="12" width="150" height="4" rx="2" fill="#fff" opacity=".25" />
                <path d="M160 12v72" stroke="#fff" strokeDasharray="4 4" opacity=".6" />
                <use href="#dd-pen-red" x="124" y="36" width="92" height="18" transform="rotate(14 170 45)" />
                <circle cx="168" cy="45" r="4.5" fill="#fff" stroke="#000" strokeOpacity=".45" />
                <path d="M188 22l6-6M196 32l8-2M182 16l1-8" stroke="#ffd76a" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <b><span>4</span>Knock enemy pens off</b>
              <p>A pen falls when its center leaves the desk. The last pen remaining on the desk wins the round!</p>
            </div>
            <div className="card">
              <svg className="ill" viewBox="0 0 220 96">
                <use href="#dd-pen-cyan" x="16" y="28" width="92" height="12" />
                <text x="60" y="64" fill="#c9d3f0" fontSize="12" fontWeight="700" fontFamily="Rubik,sans-serif" textAnchor="middle">6 g · fast</text>
                <use href="#dd-pen-pink" x="116" y="22" width="96" height="24" />
                <text x="162" y="64" fill="#c9d3f0" fontSize="12" fontWeight="700" fontFamily="Rubik,sans-serif" textAnchor="middle">62 g · heavy</text>
                <path d="M30 76h60M130 76h60" stroke="#fff" strokeOpacity=".18" strokeWidth="6" strokeLinecap="round" />
                <path d="M30 76h52M130 76h20" stroke="#38bdf8" strokeWidth="6" strokeLinecap="round" />
                <path d="M130 76h20" stroke="#f472b6" strokeWidth="6" strokeLinecap="round" />
              </svg>
              <b><span>5</span>Light vs Heavy pens</b>
              <p>Heavy pens hit harder and are hard to push, but light pens slide faster and farther. Choose the best pen for your play style!</p>
            </div>
            <div className="card">
              <svg className="ill" viewBox="0 0 220 96">
                <circle cx="104" cy="48" r="44" fill="url(#dd-glowGold)" />
                <use href="#i-coin" x="70" y="18" width="60" height="60" />
                <use href="#i-coin" x="112" y="28" width="44" height="44" />
                <use href="#i-coin" x="50" y="40" width="34" height="34" />
                <use href="#dd-spark" x="150" y="12" width="12" height="12" />
                <use href="#dd-spark" x="44" y="16" width="8" height="8" />
              </svg>
              <b><span>6</span>Win coins &amp; unlock pens</b>
              <p>Win rounds and knock enemy pens off the table to earn coins. Use your coins in the shop to buy cool pens and tables.</p>
            </div>
          </div>
          <div className="panel" style={{ marginTop: '14px' }}>
            <h3>Game Rules</h3>
            <ul className="rules">
              <li>Players take turns, <b>one shot each</b>. In Party mode, players take turns one by one.</li>
              <li>Knock enemy pens off the table while keeping your pen on. If your pen falls off, <b>you lose the round</b>.</li>
              <li>If both pens fall off at the same time, the round is a tie and played again.</li>
              <li>First player to reach the target number of round wins takes the match.</li>
              <li>If you run out of time on your turn, your turn is skipped.</li>
              <li><b>Online Mode:</b> One player creates a room and shares the 5-letter code or invite link. Up to 3 players can join from any phone or PC.</li>
            </ul>
          </div>
          <div className="panel">
            <h3>Bonus Coins (Trick Shots)</h3>
            <ul className="rules">
              <li><b>Double KO</b>: Knock 2 enemy pens off with 1 shot (+20 coins).</li>
              <li><b>Bank Shot</b>: Bounce off an obstacle before knocking a pen off (+12 coins).</li>
              <li><b>Spin KO</b>: Knock out an enemy pen while your pen is spinning (+8 coins).</li>
              <li><b>Sniper Shot</b>: Knock out an enemy pen from far away (+8 coins).</li>
              <li><b>Chain Hit</b>: Hit an enemy pen into another pen to knock it off (+12 coins).</li>
              <li><b>Close Call</b>: Your pen stops right at the edge without falling (+6 coins).</li>
            </ul>
          </div>
          <div className="panel">
            <h3>Controls</h3>
            <ul className="rules">
              <li>Touch or Mouse: Press on your pen, pull back, and release to shoot.</li>
              <li>Move your finger back to your pen to cancel a shot. Press <span className="kbd">Esc</span> to pause. Press <span className="kbd">Space</span> to continue to the next round.</li>
            </ul>
          </div>
        </div></div>
      </section>

      {/* ============ PAUSE ============ */}
      <section className="screen" id="scr-pause" style={{ background: 'rgba(3,6,14,.62)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
        <div className="menu-body">
          <div className="dialog" style={{ width: 'min(380px,100%)' }}>
            <h3>Paused</h3>
            <p className="sub" id="pauseSub"></p>
            <div style={{ display: 'grid', gap: '10px', marginTop: '18px' }}>
              <button className="btn primary lg block" data-act="resume"><svg className="i"><use href="#i-play" /></svg>Resume</button>
              <button className="btn block" data-act="restart"><svg className="i"><use href="#i-refresh" /></svg>Restart match</button>
              <button className="btn block" data-act="go" data-to="settings"><svg className="i"><use href="#i-gear" /></svg>Settings</button>
              <button className="btn danger block" data-act="quit"><svg className="i"><use href="#i-home" /></svg>Quit to menu</button>
            </div>
          </div>
        </div>
      </section>

      {/* ============ RESULTS ============ */}
      <section className="screen solid" id="scr-results">
        <div className="scroll"><div className="wrap narrow" id="resultsBody" style={{ paddingTop: 'calc(24px + var(--st))' }}></div></div>
      </section>

      <div className="modal" id="modal" role="dialog" aria-modal="true"><div className="dialog" id="dialog"></div></div>
    </>
  );
}
