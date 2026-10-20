'use client';
import {useEffect} from 'react';

/* Starts the game engine once the static markup is on the page. */
export default function GameBoot(){
  useEffect(()=>{
    import('@/lib/game/engine').then(m=>m.startGame());
  },[]);
  return null;
}
