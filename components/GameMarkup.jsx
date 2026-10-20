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
              <div className="auth-logo">
                <svg className="i"><use href="#i-pen" /></svg>
              </div>
              <h1 className="auth-title">Desk Duel</h1>
              <p className="auth-sub">Pen Fighting Championship · Real-Time Physics Battle</p>

              <div className="auth-btn-wrap" style={{ margin: '26px 0 14px' }}>
                <button className="btn-google block hero" data-act="signInGoogle">
                  <svg><use href="#i-google" /></svg>
                  <span>Continue with Google</span>
                </button>
              </div>

              <p className="auth-footnote">
                🔒 Sign in with Google to play and sync your pens, trophies, and stats.
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
            <svg viewBox="0 0 150 64" aria-hidden="true">
              <g transform="rotate(-14 75 32)">
                <rect x="8" y="22" width="104" height="17" rx="8.5" fill="#3b82f6" />
                <rect x="10" y="23.5" width="100" height="5" rx="2.5" fill="#bfdbfe" opacity=".75" />
                <rect x="8" y="22" width="26" height="17" rx="8.5" fill="#1e40af" />
                <rect x="12" y="19" width="30" height="5" rx="2.5" fill="#e2e8f0" />
                <path d="M110 22.5 L130 28.6 L130 32.4 L110 38.5Z" fill="#e8ebf1" />
                <path d="M130 28.6 L142 30.5 L130 32.4Z" fill="#334155" />
              </g>
              <g transform="rotate(18 75 32)">
                <rect x="26" y="40" width="98" height="15" rx="7.5" fill="#ef4444" />
                <rect x="28" y="41.3" width="94" height="4.5" rx="2.2" fill="#fecaca" opacity=".75" />
                <rect x="26" y="40" width="22" height="15" rx="7.5" fill="#991b1b" />
              </g>
            </svg>
            <h1>DESK<em>DUEL</em></h1>
            <p>Pen Fighting Championship</p>
          </div>
          <nav className="tiles" aria-label="Game modes">
            <button className="tile hero" data-act="go" data-to="career">
              <span className="ti"><svg className="i"><use href="#i-trophy" /></svg></span><span className="tag" id="careerTag">League 1</span>
              <b>Career</b><small id="careerSub">Climb five weight-class leagues and dethrone The Chairman.</small>
              <div className="prog"><i id="careerProg" style={{ width: '0' }}></i></div>
            </button>
            <button className="tile" data-act="go" data-to="quick"><span className="ti"><svg className="i"><use href="#i-bolt" /></svg></span><b>Quick Match</b><small>1 vs CPU · win coins</small></button>
            <button className="tile" data-act="go" data-to="party"><span className="ti"><svg className="i"><use href="#i-users" /></svg></span><b>Party</b><small>2–3 players on one device</small></button>
            <button className="tile" data-act="go" data-to="online"><span className="ti"><svg className="i"><use href="#i-globe" /></svg></span><span className="tag" id="onlineTag">New</span><b>Online</b><small>Friends on their own devices</small></button>
            <button className="tile" id="shopTile" data-act="go" data-to="shop"><span className="ti"><svg className="i"><use href="#i-bag" /></svg></span><b>Pen Shop</b><small>Heavier pens, tougher leagues</small></button>
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
                <rect x="60" y="44" width="110" height="12" rx="6" fill="#3b82f6" />
                <rect x="62" y="45.5" width="104" height="3.5" rx="1.7" fill="#bfdbfe" opacity=".7" />
                <path d="M170 44 L186 48.5 L186 51.5 L170 56Z" fill="#e2e8f0" />
                <circle cx="98" cy="50" r="4" fill="#ffc23d" />
                <path d="M98 50 L60 84" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray="5 5" />
                <circle cx="60" cy="84" r="8" fill="#fff" opacity=".9" />
                <circle cx="60" cy="84" r="8" fill="none" stroke="#3b82f6" strokeWidth="3" />
              </svg>
              <b><span>1</span>Grab &amp; pull back</b>
              <p>Press on your pen and drag away from where you want it to go, like a slingshot. Pull further for more power.</p>
            </div>
            <div className="card">
              <svg className="ill" viewBox="0 0 220 96">
                <rect x="40" y="58" width="100" height="12" rx="6" fill="#3b82f6" opacity=".35" />
                <rect x="92" y="34" width="100" height="12" rx="6" fill="#3b82f6" transform="rotate(-18 142 40)" />
                <path d="M60 64 C 100 60, 120 50, 160 30" stroke="#ffc23d" strokeWidth="3" fill="none" strokeDasharray="2 8" strokeLinecap="round" />
                <path d="M160 30 l-10 2 l5 8z" fill="#ffc23d" />
              </svg>
              <b><span>2</span>Let go to flick</b>
              <p>Your pen slides, spins and collides with real physics. The dotted line predicts your path.</p>
            </div>
            <div className="card">
              <svg className="ill" viewBox="0 0 220 96">
                <g transform="rotate(-20 110 50)">
                  <rect x="55" y="44" width="110" height="12" rx="6" fill="#22c55e" />
                  <circle cx="152" cy="50" r="4" fill="#ffc23d" />
                </g>
                <path d="M150 18 A 46 46 0 0 1 176 64" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
                <path d="M176 64 l-9 -3 l8 -7z" fill="#fff" />
              </svg>
              <b><span>3</span>Add spin</b>
              <p>Grab near the end of your pen to make it spin. Spinning pens sweep a wider area and curve as they slide.</p>
            </div>
            <div className="card">
              <svg className="ill" viewBox="0 0 220 96">
                <rect x="10" y="12" width="150" height="72" rx="8" fill="#cf9a55" />
                <rect x="128" y="40" width="80" height="11" rx="5.5" fill="#ef4444" transform="rotate(12 168 45)" opacity=".85" />
                <circle cx="168" cy="46" r="4" fill="#fff" stroke="#000" strokeOpacity=".4" />
                <path d="M160 12 v72" stroke="#fff" strokeDasharray="4 4" opacity=".6" />
              </svg>
              <b><span>4</span>Knock them off</b>
              <p>A pen falls when its <b>center dot</b> leaves the desk. Last pen standing wins the round.</p>
            </div>
            <div className="card">
              <svg className="ill" viewBox="0 0 220 96">
                <rect x="20" y="30" width="80" height="9" rx="4.5" fill="#7dd3fc" />
                <text x="60" y="62" fill="#97a4c8" fontSize="12" fontFamily="Rubik,sans-serif" textAnchor="middle">6 g · fast</text>
                <rect x="120" y="27" width="84" height="15" rx="7.5" fill="#f472b6" />
                <text x="162" y="62" fill="#97a4c8" fontSize="12" fontFamily="Rubik,sans-serif" textAnchor="middle">62 g · heavy</text>
              </svg>
              <b><span>5</span>Weight matters</b>
              <p>Heavy pens hit harder and are tough to shove, but slide shorter and need precise shots. Heavier classes face tougher rivals.</p>
            </div>
            <div className="card">
              <svg className="ill" viewBox="0 0 220 96">
                <use href="#i-coin" x="70" y="18" width="60" height="60" />
                <use href="#i-coin" x="112" y="28" width="44" height="44" />
                <use href="#i-coin" x="50" y="40" width="34" height="34" />
              </svg>
              <b><span>6</span>Earn &amp; upgrade</b>
              <p>Win matches, land knockouts and trick shots to earn coins. Spend them on pens and desks in the shop.</p>
            </div>
          </div>
          <div className="panel" style={{ marginTop: '14px' }}>
            <h3>Rules</h3>
            <ul className="rules">
              <li>Players take turns, <b>one flick each</b>. In Party mode, play rotates between all players.</li>
              <li>Knock rivals off and stay on yourself. If your own pen falls, <b>you are out</b> for the round.</li>
              <li>If every remaining pen falls on the same flick, the round is replayed.</li>
              <li>First to the target number of round wins takes the match.</li>
              <li>With a shot clock, a turn is skipped when time runs out.</li>
              <li><b>Online:</b> One player creates a room and shares the 5-letter code or invite link. Up to 3 players across any device.</li>
            </ul>
          </div>
          <div className="panel">
            <h3>Trick shots (bonus coins)</h3>
            <ul className="rules">
              <li><b>Double KO</b>: knock two rivals off with one flick.</li>
              <li><b>Bank shot</b>: bounce off an obstacle before the knockout.</li>
              <li><b>Spin KO</b>: knock out a rival with a fast-spinning pen.</li>
              <li><b>Sniper</b>: knock out a rival from long range.</li>
              <li><b>Chain KO</b>: your pen hits a rival who knocks out another.</li>
              <li><b>Close call</b>: your pen stops within 1 cm of the edge.</li>
            </ul>
          </div>
          <div className="panel">
            <h3>Controls</h3>
            <ul className="rules">
              <li>Touch or mouse: press on your pen, drag back, release.</li>
              <li>Drag back to the pen to cancel a shot. <span className="kbd">Esc</span> pauses. <span className="kbd">Space</span> continues after a round.</li>
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
