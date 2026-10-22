// Static at build time so it also works in the Android app build (output: export).
export const dynamic = 'force-static';
import { NextResponse } from 'next/server';

export async function GET() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://iipbtnpdkmklbwoxrmig.supabase.co';

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcGJ0bnBka21rbGJ3b3hybWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MTM1ODIsImV4cCI6MjEwODA4OTU4Mn0.TX9tlM717RBaNxgiDYnTyTpAORt_YJdsFz2Rt02U9pM';

  const projectRef =
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF ||
    'iipbtnpdkmklbwoxrmig';

  return NextResponse.json({
    url,
    anonKey,
    projectRef,
  });
}
