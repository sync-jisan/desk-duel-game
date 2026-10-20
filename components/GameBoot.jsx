'use client';
import { useEffect } from 'react';

/* Starts the Desk Duel game engine once the React static markup has hydrated in the DOM. */
export default function GameBoot() {
  useEffect(() => {
    import('@/lib/game/engine').then((m) => m.startGame());
  }, []);
  return null;
}
