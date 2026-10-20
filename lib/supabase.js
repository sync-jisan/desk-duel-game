import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iipbtnpdkmklbwoxrmig.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcGJ0bnBka21rbGJ3b3hybWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MTM1ODIsImV4cCI6MjEwODA4OTU4Mn0.TX9tlM717RBaNxgiDYnTyTpAORt_YJdsFz2Rt02U9pM';

let client = null;

export function getSupabase() {
  if (typeof window === 'undefined') return null;
  if (!client) {
    try {
      client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        realtime: {
          params: { eventsPerSecond: 30 }
        }
      });
    } catch (e) {
      console.warn('Supabase client initialization warning:', e);
    }
  }
  return client;
}

export default getSupabase;
