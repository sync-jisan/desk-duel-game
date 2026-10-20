/* =====================================================================
   DESK DUEL — SUPABASE CONFIGURATION
   Project Ref: iipbtnpdkmklbwoxrmig
   URL: https://iipbtnpdkmklbwoxrmig.supabase.co
   ===================================================================== */

window.DESKDUEL_SUPABASE_CONFIG = {
  // Your Supabase Project URL
  url: 'https://iipbtnpdkmklbwoxrmig.supabase.co',

  // Your Supabase Publishable / Anon Key.
  // You can paste it here, OR enter it directly in the in-game Online settings!
  // Find your key at: https://supabase.com/dashboard/project/iipbtnpdkmklbwoxrmig/settings/api
  anonKey: localStorage.getItem('deskduel_supabase_key') || '',

  // Project Reference ID
  projectRef: 'iipbtnpdkmklbwoxrmig'
};

// Helper to save key from UI
window.setDeskDuelSupabaseKey = function(key) {
  if (!key) return;
  key = key.trim();
  localStorage.setItem('deskduel_supabase_key', key);
  window.DESKDUEL_SUPABASE_CONFIG.anonKey = key;
};
