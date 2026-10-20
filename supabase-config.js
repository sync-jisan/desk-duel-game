/* =====================================================================
   DESK DUEL — SUPABASE CONFIGURATION
   Project Ref: iipbtnpdkmklbwoxrmig
   URL: https://iipbtnpdkmklbwoxrmig.supabase.co
   ===================================================================== */

window.DESKDUEL_SUPABASE_CONFIG = {
  // Your Supabase Project URL
  url: 'https://iipbtnpdkmklbwoxrmig.supabase.co',

  // Your Supabase Publishable / Anon Key.
  anonKey: localStorage.getItem('deskduel_supabase_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcGJ0bnBka21rbGJ3b3hybWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MTM1ODIsImV4cCI6MjEwODA4OTU4Mn0.TX9tlM717RBaNxgiDYnTyTpAORt_YJdsFz2Rt02U9pM',

  // Project Reference ID
  projectRef: 'iipbtnpdkmklbwoxrmig'
};

// Fetch dynamic environment variables from Next.js server when hosted on Vercel / web server
if (typeof window !== 'undefined' && window.location && /^https?:/.test(window.location.protocol)) {
  fetch('/api/config')
    .then(function(res) { return res.ok ? res.json() : null; })
    .then(function(cfg) {
      if (cfg && cfg.url && cfg.anonKey) {
        window.DESKDUEL_SUPABASE_CONFIG.url = cfg.url;
        window.DESKDUEL_SUPABASE_CONFIG.anonKey = localStorage.getItem('deskduel_supabase_key') || cfg.anonKey;
        window.DESKDUEL_SUPABASE_CONFIG.projectRef = cfg.projectRef || window.DESKDUEL_SUPABASE_CONFIG.projectRef;
      }
    })
    .catch(function() {});
}

// Helper to save key from UI
window.setDeskDuelSupabaseKey = function(key) {
  if (!key) return;
  key = key.trim();
  localStorage.setItem('deskduel_supabase_key', key);
  window.DESKDUEL_SUPABASE_CONFIG.anonKey = key;
};
