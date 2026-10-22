/* Desk Duel — synthesized audio engine (WebAudio only, no assets).
   Chain: voices -> bus (dry) -> master -> glue comp -> limiter -> out
                    \-> send -> lowpass -> convolver (generated IR) -> master
   Safe on SSR, before initAudio(), before unlock(); never throws. */

let getS = null;
const cfg = () => { try { return (getS && getS()) || null; } catch (e) { return null; } };
const rnd = (a, b) => a + Math.random() * (b - a);
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
let _muted = false, voices = 0, hitsActive = 0;
const lastHit = {};
const MAX_VOICES = 72, MAX_HITS = 12;

export function initAudio(getSettings) {
  getS = typeof getSettings === 'function' ? getSettings : null;
  try { SND.setVol(); } catch (e) {}
}

function setP(p, v, t) { try { p.setTargetAtTime(v, t, .03); } catch (e) { try { p.value = v; } catch (e2) {} } }

export const SND = {
  ctx: null, master: null, comp: null, noise: null, ir: null, bus: null, verb: null, mbus: null,
  get muted() { return _muted; },
  set muted(v) { _muted = !!v; try { this._mGain(); } catch (e) {} },
  unlock() {
    try {
      if (typeof window === 'undefined') return;
      if (!this.ctx) {
        const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
        const c = this.ctx = new C();
        const comp = this.comp = c.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = .004; comp.release.value = .2;
        const lim = c.createDynamicsCompressor();
        lim.threshold.value = -2.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .09;
        this.master = c.createGain(); this.master.gain.value = 0;
        this.master.connect(comp); comp.connect(lim); lim.connect(c.destination);
        const sr = c.sampleRate, b = c.createBuffer(1, sr, sr), d = b.getChannelData(0);
        for (let i = 0; i < sr; i++) d[i] = Math.random() * 2 - 1;
        this.noise = b;
        // generated stereo impulse: ~1.1s exponentially decaying noise with soft onset
        const L = Math.floor(sr * 1.1), ir = c.createBuffer(2, L, sr);
        for (let ch = 0; ch < 2; ch++) {
          const x = ir.getChannelData(ch);
          for (let i = 0; i < L; i++) { const t = i / L; x[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * Math.min(1, i / (sr * .006)); }
        }
        this.ir = ir;
        const pre = c.createBiquadFilter(); pre.type = 'lowpass'; pre.frequency.value = 5200;
        const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 220;
        const conv = c.createConvolver(); conv.buffer = ir;
        const vOut = c.createGain(); vOut.gain.value = .9;
        this.verb = c.createGain(); this.verb.connect(hp); hp.connect(pre); pre.connect(conv); conv.connect(vOut); vOut.connect(this.master);
        this.bus = c.createGain(); this.bus.connect(this.master);
        const send = c.createGain(); send.gain.value = .15; this.bus.connect(send); send.connect(this.verb);
        this.mbus = c.createGain(); this.mbus.gain.value = 0; this.mbus.connect(this.master);
        const ms = c.createGain(); ms.gain.value = .35; this.mbus.connect(ms); ms.connect(this.verb);
      }
      if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') { const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {}); }
      this.setVol();
    } catch (e) { this.ctx = null; }
  },
  setVol() {
    try {
      const s = cfg();
      if (this.master && this.ctx) setP(this.master.gain, s && s.sound ? (+s.volume || 0) * .9 : 0, this.ctx.currentTime);
      this.music();
    } catch (e) {}
  },
  ok() {
    try { const s = cfg(); return !!this.ctx && !!s && !!s.sound && !_muted && this.ctx.state === 'running'; } catch (e) { return false; }
  },
  // per-event output with stereo pan + custom reverb send; auto-disconnects
  chan(pan = 0, wet = .15, life = 3) {
    const c = this.ctx; pan = +pan || 0;
    if (!pan && Math.abs(wet - .15) < .01) return this.bus;
    const g = c.createGain(), nodes = [g];
    let tail = g;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = cl(pan, -1, 1) * .8; g.connect(p); tail = p; nodes.push(p); }
    tail.connect(this.master);
    const s = c.createGain(); s.gain.value = wet; tail.connect(s); s.connect(this.verb); nodes.push(s);
    setTimeout(() => nodes.forEach(n => { try { n.disconnect(); } catch (e) {} }), life * 1000 + 200);
    return g;
  },
  _env(g, t, d, v, o) {
    const a = o.attack || .004;
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + a);
    if (o.rel) { g.gain.setValueAtTime(v, Math.max(t + a, t + d - o.rel)); g.gain.exponentialRampToValueAtTime(.0001, t + d); }
    else g.gain.exponentialRampToValueAtTime(.0001, t + Math.max(d, a + .005));
  },
  _go(src, nodes, t, d, cap) {
    if (cap) { voices++; }
    src.onended = () => { if (cap) voices--; nodes.forEach(n => { try { n.disconnect(); } catch (e) {} }); };
    src.start(t); src.stop(t + d + .05);
  },
  tone(f, d, o = {}) {
    try {
      if (!this.ok() || (!o.nocap && voices >= MAX_VOICES)) return;
      const c = this.ctx, t = o.at || c.currentTime + (o.delay || 0), os = c.createOscillator(), g = c.createGain(), nodes = [os, g];
      os.type = o.type || 'sine'; os.frequency.setValueAtTime(f, t);
      if (o.det) os.detune.value = o.det;
      if (o.to) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.glide || d));
      this._env(g, t, d, o.vol == null ? .15 : o.vol, o);
      let n = os;
      if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.lp, t); fl.Q.value = o.lq || .7;
        if (o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo, t + d); n.connect(fl); n = fl; nodes.push(fl); }
      n.connect(g); g.connect(o.out || this.bus);
      this._go(os, nodes, t, d, !o.nocap);
    } catch (e) {}
  },
  noiseB(d, o = {}) {
    try {
      if (!this.ok() || !this.noise || (!o.nocap && voices >= MAX_VOICES)) return;
      const c = this.ctx, t = o.at || c.currentTime + (o.delay || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise; if (o.rate) s.playbackRate.value = o.rate;
      f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t);
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + d); f.Q.value = o.q == null ? 1 : o.q;
      this._env(g, t, d, o.vol == null ? .2 : o.vol, o);
      s.connect(f); f.connect(g); g.connect(o.out || this.bus);
      if (!o.nocap) voices++;
      s.onended = () => { if (!o.nocap) voices--; [s, f, g].forEach(n => { try { n.disconnect(); } catch (e) {} }); };
      s.start(t, Math.random() * .5); s.stop(t + d + .05);
    } catch (e) {}
  },
  /* ---------- generative lo-fi music (off unless settings.music) ---------- */
  _mus: null,
  _mGain() {
    if (!this.mbus || !this.ctx) return;
    const s = cfg(), on = !!(this._mus && s && s.music && !_muted);
    setP(this.mbus.gain, on ? .5 : 0, this.ctx.currentTime);
  },
  music(on) {
    try {
      const s = cfg(), want = (on === undefined ? !!(this._mus || (s && s.music)) : !!on) && !!(s && s.music);
      if (want && !this._mus && this.ctx) {
        const m = this._mus = { step: 0, next: this.ctx.currentTime + .15, id: 0 };
        m.id = setInterval(() => { try { this._sched(); } catch (e) {} }, 90);
      } else if (!want && this._mus) { clearInterval(this._mus.id); this._mus = null; }
      this._mGain();
    } catch (e) {}
  },
  _sched() {
    const m = this._mus; if (!m || !this.ctx) return;
    const c = this.ctx;
    if (!this.ok()) { m.next = c.currentTime + .15; return; }
    const e8 = 60 / 76 / 2, out = this.mbus;
    const prog = [[53, 57, 60, 64, 67], [52, 55, 59, 62], [50, 53, 57, 60, 64], [48, 52, 55, 59, 62]];
    while (m.next < c.currentTime + .3) {
      const st = m.step % 16, ch = prog[Math.floor(m.step / 16) % 4], t = m.next + (st & 1 ? e8 * .12 : 0);
      if (st === 0) {
        const len = e8 * 16 + .6;
        ch.slice(0, 4).forEach((n, i) => {
          this.tone(mtof(n), len, { at: t + i * .02, type: 'triangle', vol: .028, attack: 1.4, rel: 1.6, lp: 900, nocap: 1, out });
          this.tone(mtof(n), len, { at: t, type: 'sine', vol: .02, det: 7, attack: 1.8, rel: 1.6, nocap: 1, out });
        });
      }
      if (st === 0 || st === 10) this.tone(mtof(ch[0] - 12), e8 * 5, { at: t, vol: .07, attack: .02, rel: .5, lp: 400, nocap: 1, out });
      if (Math.random() < (st % 4 === 0 ? .6 : .32)) {
        const n = ch[(Math.random() * ch.length) | 0] + 12;
        this.tone(mtof(n), .55, { at: t, vol: .03, attack: .005, nocap: 1, out });
        this.tone(mtof(n) * 2, .22, { at: t, vol: .006, nocap: 1, out });
      }
      if (st % 4 === 2) this.noiseB(.04, { at: t, type: 'highpass', f: 7500, vol: .012, nocap: 1, out });
      if (st === 8) this.noiseB(.09, { at: t, type: 'bandpass', f: 1800, q: .8, vol: .018, nocap: 1, out });
      m.next += e8; m.step++;
    }
  }
};

export const MATSND = {
  plastic: { f: 2600, q: 1.4, body: 780, ring: 0, dur: .05, p: [2.3], dk: .05, click: .7 },
  wood:    { f: 1500, q: 1.8, body: 430, ring: 0, dur: .05, p: [2.6], dk: .07, click: .8 },
  rubber:  { f: 950,  q: .8,  body: 260, ring: 0, dur: .04, p: [], dk: .06, click: .25 },
  resin:   { f: 2200, q: 2,   body: 900, ring: .3, dur: .06, p: [2.4, 4.1], dk: .06, click: .7 },
  metal:   { f: 4300, q: 3.5, body: 1650, ring: 1, dur: .07, p: [2.76, 5.4, 8.93], dk: .5, click: 1 },
  book:    { f: 650,  q: .9,  body: 170, ring: 0, dur: .05, p: [], dk: .06, click: .45 },
  ceramic: { f: 3200, q: 4,   body: 2300, ring: .8, dur: .06, p: [2.1, 3.9], dk: .3, click: .9 },
  glass:   { f: 3900, q: 5,   body: 2900, ring: 1, dur: .06, p: [2.32, 4.25, 6.63], dk: .45, click: 1 }
};

const T = (f, d, o) => SND.tone(f, d, o), N = (d, o) => SND.noiseB(d, o);
const chord = (ns, d, o) => ns.forEach((f, i) => { T(f, d, { type: 'triangle', ...o, delay: (o.delay || 0) + i * .008 }); T(f * 1.002, d, { type: 'sawtooth', ...o, vol: (o.vol || .05) * .35, delay: (o.delay || 0) + i * .008 }); });

function clatter(out, t0, n, vol) {
  for (let i = 0; i < n; i++) {
    const dt = t0 + [0, .13, .23, .3, .35][i], v = vol * Math.pow(.55, i);
    N(.012, { type: 'highpass', f: 3200 * rnd(.85, 1.15), vol: v, delay: dt, out });
    N(.05, { f: 2100 * rnd(.8, 1.2), q: 3, vol: v * .7, delay: dt, out });
    T(rnd(700, 950), .04, { type: 'triangle', vol: v * .4, delay: dt, to: 520, out });
  }
}

const RAW = {
  ui() { const r = rnd(.97, 1.04); N(.006, { type: 'highpass', f: 4200, vol: .05 }); T(1150 * r, .045, { vol: .06, to: 1060 * r }); T(2300 * r, .03, { vol: .015, delay: .004 }); },
  back() { T(660, .1, { vol: .05, to: 440, lp: 2500 }); T(1320, .05, { vol: .01, to: 900 }); },
  grab() { N(.012, { f: 2000, q: 2, vol: .06 }); T(rnd(500, 540), .045, { type: 'triangle', vol: .045, to: 420 }); },
  flick(p = .5) {
    p = cl(+p || 0, 0, 1);
    N(.02, { type: 'highpass', f: 3000, vol: .22 + .25 * p });
    T(1800, .025, { vol: .05 + .05 * p, to: 600 });
    T(240, .08, { type: 'triangle', vol: .08 + .08 * p, to: 105 });
    N(.12 + .2 * p, { f: 600, to: 1800 + 1600 * p, q: 1.2, vol: .04 + .11 * p, attack: .03 + .03 * p });
  },
  hit(k = .5, ma, mb, mass = 10, pan = 0) {
    if (!SND.ok()) return;
    const c = SND.ctx, now = c.currentTime, key = ma + '|' + mb;
    if (lastHit[key] && now - lastHit[key] < .025) return;
    if (hitsActive >= MAX_HITS) return;
    lastHit[key] = now; hitsActive++; setTimeout(() => { hitsActive--; }, 260);
    k = cl(+k || 0, 0, 1);
    const A = MATSND[ma] || MATSND.plastic, B = MATSND[mb] || A, v = .04 + .38 * Math.pow(k, .8);
    const mf = cl((+mass || 0) / 60, 0, 1), sc = (1 - .28 * mf) * rnd(.95, 1.05), body = (A.body + B.body) / 2 * sc;
    const ring = Math.max(A.ring, B.ring), out = SND.chan(pan, .12 + .12 * ring, 2);
    const cf = (A.click + B.click) / 2;
    N(.006 + .006 * k, { type: 'highpass', f: Math.max(A.f, B.f) * rnd(.9, 1.1), vol: v * .8 * cf, out });
    N(Math.max(A.dur, B.dur) * (1 + .5 * mf), { f: (A.f + B.f) / 2 * sc, q: (A.q + B.q) / 2, vol: v * .7, out });
    T(body, .045 + .06 * k + .05 * mf, { type: 'triangle', vol: v * .4, to: body * .68, out });
    T(body * .5, .05 + .04 * mf, { vol: v * .25 * (1 - cf * .5), to: body * .35, out });
    const P = A.ring >= B.ring ? A : B;
    if (ring) P.p.forEach((r, i) => T(body * r * rnd(.995, 1.005), P.dk * ring * (.5 + k) / (1 + i * .4), { vol: v * .1 * ring / (1 + i * .7), attack: .002, out }));
    else if (P.p[0]) T(body * P.p[0], .03, { vol: v * .1, out });
    if (ma === 'rubber' || mb === 'rubber' || ma === 'book' || mb === 'book') N(.07, { type: 'lowpass', f: 500, vol: v * .5, out });
    if (mass > 18) T(110 * (1 - .3 * mf), .12 + .08 * mf, { vol: v * .6 * mf + .02, to: 48, out });
  },
  fall(pan = 0) {
    const out = SND.chan(pan, .25, 2.5);
    N(.48, { f: 1900, to: 300, q: .9, vol: .1, attack: .12, out });
    T(150, .16, { vol: .16, delay: .46, to: 55, out });
    N(.12, { type: 'lowpass', f: 380, vol: .14, delay: .46, out });
    clatter(out, .46, 4, .14);
  },
  ko(pan = 0) {
    const out = SND.chan(pan, .22, 3);
    N(.012, { type: 'highpass', f: 2500, vol: .25, out });
    N(.16, { type: 'lowpass', f: 1400, to: 300, vol: .3, out });
    T(170, .6, { vol: .34, to: 38, glide: .45, out });
    T(85, .7, { vol: .2, to: 30, out });
    [520, 1150, 2500].forEach((f, i) => N(1.1, { f: f * rnd(.95, 1.05), q: .9, vol: .05 / (1 + i * .5), attack: .3, delay: .12 + i * .03, out }));
  },
  coin() { const o = SND.chan(0, .25); [[987.8, 0], [1318.5, .075]].forEach(([f, d]) => { T(f, .12 + d * 2, { vol: .07, delay: d, out: o }); T(f * 2, .1, { type: 'triangle', vol: .025, delay: d, out: o }); T(f * 2.76, .06, { vol: .012, delay: d, out: o }); }); },
  win() {
    const o = SND.chan(0, .25, 3.5);
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => { T(f, .2, { type: 'triangle', vol: .09, delay: i * .1, lp: 4000, out: o }); });
    chord([523.3, 659.3, 784, 1046.5], 1.1, { vol: .05, delay: .42, attack: .01, rel: .7, lp: 1500, lpTo: 4200, out: o });
    T(130.8, 1, { vol: .12, delay: .42, rel: .6, out: o });
    [2093, 2637, 3136, 4186].forEach((f, i) => T(f, .4, { vol: .014, delay: .5 + i * .07, out: SND.chan(rnd(-.6, .6), .5) }));
  },
  lose() {
    const o = SND.chan(0, .25, 3);
    [440, 349.2, 293.7].forEach((f, i) => T(f, .34, { type: 'triangle', vol: .075, delay: i * .19, lp: 1800, to: f * .985, out: o }));
    chord([146.8, 174.6, 220], 1, { vol: .035, delay: .55, attack: .05, rel: .7, lp: 900, out: o });
  },
  round() {
    const o = SND.chan(0, .2, 2.5);
    N(.5, { f: 400, to: 4200, q: 1, vol: .07, attack: .42, out: o });
    T(200, .5, { type: 'sawtooth', vol: .02, to: 800, attack: .4, lp: 1200, out: o });
    T(140, .16, { vol: .2, delay: .5, to: 55, out: o }); N(.03, { type: 'highpass', f: 3000, vol: .12, delay: .5, out: o });
    chord([392, 587.3, 784], .5, { vol: .04, delay: .5, attack: .005, lp: 2800, out: o });
  },
  turn() { const o = SND.chan(0, .28); [[880, 0], [1318.5, .08]].forEach(([f, d]) => { T(f, .22, { vol: .05, delay: d, out: o }); T(f * 3, .08, { vol: .008, delay: d, out: o }); }); },
  tick() { T(1750, .028, { vol: .05, to: 1500 }); N(.014, { f: 2600, q: 6, vol: .08 }); T(870, .02, { type: 'triangle', vol: .02 }); },
  trick() {
    [784, 987.8, 1174.7, 1568, 1975.5, 2349.3].forEach((f, i) => T(f, .18, { type: 'triangle', vol: .055, delay: i * .05, out: SND.chan((i / 2.5) - 1, .35) }));
    N(.5, { type: 'highpass', f: 6000, vol: .03, attack: .2, delay: .1 });
  },
  buy() { RAW.coin(); const o = SND.chan(0, .3, 2); chord([659.3, 830.6, 987.8], .45, { vol: .03, delay: .14, rel: .3, lp: 3000, out: o }); },
  deny() { T(220, .1, { type: 'square', vol: .035, lp: 900, det: -8 }); T(220, .1, { type: 'square', vol: .025, lp: 900, det: 8 }); T(165, .14, { type: 'square', vol: .04, delay: .09, lp: 800 }); },
  fanfare() {
    const o = SND.chan(0, .28, 3.5);
    [392, 523.3, 659.3, 784, 1046.5].forEach((f, i) => T(f, .2, { type: 'triangle', vol: .085, delay: i * .085, lp: 4500, out: o }));
    chord([523.3, 659.3, 784], 1, { vol: .045, delay: .42, rel: .6, lp: 1800, lpTo: 4000, out: o });
    [2637, 3136, 3951].forEach((f, i) => T(f, .35, { vol: .012, delay: .5 + i * .08, out: o }));
  }
};

export const SFX = {};
Object.keys(RAW).forEach(k => { SFX[k] = (...a) => { try { if (SND.ok()) RAW[k](...a); } catch (e) {} }; });

// In the Android app a native haptics function is plugged in here (see native.js).
let _vibrateImpl = null;
export function setVibrate(fn) { _vibrateImpl = fn; }
export function buzz(ms) {
  try {
    const s = cfg(); if (!s || !s.vibrate || _muted) return;
    if (_vibrateImpl && _vibrateImpl(ms)) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
  } catch (e) {}
}
