'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MotionEffects() {
  const [matchmaking, setMatchmaking] = useState({
    active: false,
    timer: 60,
    mode: 'squad',
    status: 'Searching for players...'
  });

  const [spectator, setSpectator] = useState({
    active: false,
    code: '',
    playersCount: 0
  });

  const [duelInvite, setDuelInvite] = useState(null);

  useEffect(() => {
    // Listen for custom events dispatched by the game engine
    const handleMmUpdate = (e) => {
      if (e.detail) {
        setMatchmaking((prev) => ({ ...prev, ...e.detail }));
      }
    };

    const handleSpectateUpdate = (e) => {
      if (e.detail) {
        setSpectator(e.detail);
      }
    };

    const handleDuelChallenge = (e) => {
      if (e.detail) {
        setDuelInvite(e.detail);
      }
    };

    window.addEventListener('deskduel-matchmaking', handleMmUpdate);
    window.addEventListener('deskduel-spectate', handleSpectateUpdate);
    window.addEventListener('deskduel-duel-invite', handleDuelChallenge);

    return () => {
      window.removeEventListener('deskduel-matchmaking', handleMmUpdate);
      window.removeEventListener('deskduel-spectate', handleSpectateUpdate);
      window.removeEventListener('deskduel-duel-invite', handleDuelChallenge);
    };
  }, []);

  return (
    <>
      {/* ================= SPECTATOR MODE HUD BANNER ================= */}
      <AnimatePresence>
        {spectator.active && (
          <motion.div
            className="spectator-live-bar"
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            <div className="spec-badge">
              <motion.span
                className="spec-dot"
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <span className="spec-label">LIVE SPECTATOR</span>
            </div>

            <div className="spec-info">
              <span>Room <b>{spectator.code}</b></span>
              <span className="spec-sep">•</span>
              <span>{spectator.playersCount || 2} Players</span>
            </div>

            <motion.button
              className="spec-exit-btn"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                if (window.__deskDuelEngine && window.__deskDuelEngine.exitSpectator) {
                  window.__deskDuelEngine.exitSpectator();
                } else {
                  const btn = document.querySelector('[data-act="exitSpectator"]');
                  if (btn) btn.click();
                }
              }}
            >
              Exit Spectating
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= MATCHMAKING RADAR MODAL ================= */}
      <AnimatePresence>
        {matchmaking.active && (
          <motion.div
            className="matchmaking-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="matchmaking-modal"
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            >
              <div className="mm-header">
                <span className="mm-pill">
                  {matchmaking.mode === 'duo' ? 'Duo (1v1)' : 'Squad (Up to 5P)'}
                </span>
                <span className="mm-timer">{matchmaking.timer}s</span>
              </div>

              {/* Duo vs Squad Mode Selection */}
              <div className="seg" style={{ margin: '8px 0 12px' }}>
                <button
                  type="button"
                  className={matchmaking.mode === 'duo' ? 'on' : ''}
                  onClick={() => {
                    if (window.__deskDuelEngine && window.__deskDuelEngine.startMatchmaking) {
                      window.__deskDuelEngine.startMatchmaking('duo');
                    }
                  }}
                >
                  ⚔️ Duo (1v1)
                </button>
                <button
                  type="button"
                  className={matchmaking.mode === 'squad' ? 'on' : ''}
                  onClick={() => {
                    if (window.__deskDuelEngine && window.__deskDuelEngine.startMatchmaking) {
                      window.__deskDuelEngine.startMatchmaking('squad');
                    }
                  }}
                >
                  👥 Squad (5P)
                </button>
              </div>

              {/* Framer Motion Radar Animation */}
              <div className="radar-container">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="radar-wave"
                    initial={{ scale: 0.3, opacity: 0.8 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    transition={{
                      duration: 2.4,
                      repeat: Infinity,
                      delay: i * 0.8,
                      ease: 'easeOut'
                    }}
                  />
                ))}

                <motion.div
                  className="radar-scanner"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                />

                <div className="radar-center">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    ⚔️
                  </motion.div>
                </div>
              </div>

              <motion.h3
                className="mm-title"
                animate={{ opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {matchmaking.status || 'Searching Global Players…'}
              </motion.h3>
              <p className="mm-sub">
                Matching you with open players looking for a duel. Max 1 minute search.
              </p>

              <div className="mm-btn-wrap">
                <motion.button
                  className="btn danger block"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    if (window.__deskDuelEngine && window.__deskDuelEngine.cancelMatchmaking) {
                      window.__deskDuelEngine.cancelMatchmaking();
                    } else {
                      const btn = document.querySelector('[data-act="cancelMatchmaking"]');
                      if (btn) btn.click();
                    }
                  }}
                >
                  Cancel Matchmaking
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= REALTIME DUEL CHALLENGE MODAL ================= */}
      <AnimatePresence>
        {duelInvite && (
          <motion.div
            className="duel-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="duel-modal"
              initial={{ scale: 0.75, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            >
              <div className="duel-icon-wrap">
                <motion.span
                  animate={{ rotate: [-8, 8, -8] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ display: 'inline-block', fontSize: '32px' }}
                >
                  ⚔️
                </motion.span>
              </div>
              <h3 className="duel-title">Duel Invitation!</h3>
              <p className="duel-sub">
                <b>{duelInvite.from_name || 'A Friend'}</b> invited you to join room <b>{duelInvite.room_code}</b> (Max 5 Players)!
              </p>

              <div className="duel-actions">
                <motion.button
                  className="btn ghost"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    const fromId = duelInvite.from_id;
                    setDuelInvite(null);
                    if (window.__deskDuelEngine && window.__deskDuelEngine.declineDuel) {
                      window.__deskDuelEngine.declineDuel(fromId);
                    }
                  }}
                >
                  Decline
                </motion.button>

                <motion.button
                  className="btn primary lg"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    const roomCode = duelInvite.room_code;
                    const fromId = duelInvite.from_id;
                    setDuelInvite(null);
                    if (window.__deskDuelEngine && window.__deskDuelEngine.acceptDuel) {
                      window.__deskDuelEngine.acceptDuel(roomCode, fromId);
                    }
                  }}
                >
                  Accept &amp; Play!
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
