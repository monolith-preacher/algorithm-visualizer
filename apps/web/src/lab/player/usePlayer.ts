import { useCallback, useEffect, useState } from 'react';

export const SPEEDS = [0.5, 1, 2, 4, 8, 15, 30, 60, 120];

export interface Player {
  index: number;
  length: number;
  playing: boolean;
  speed: number;
  /** Duration of visual transitions, derived from the playback speed. */
  animationMs: number;
  play(): void;
  pause(): void;
  toggle(): void;
  forward(): void;
  back(): void;
  reset(): void;
  end(): void;
  seek(index: number): void;
  setSpeed(speed: number): void;
}

/**
 * Plays a precomputed list of steps. Stepping back simply shows an earlier
 * step of that list: every step stores the full state captured from the trace.
 */
export function usePlayer(length: number, resetKey?: unknown, options: { autoplay?: boolean; speed?: number } = {}): Player {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(options.speed ?? 8);
  const [key, setKey] = useState<unknown>(resetKey);
  const last = Math.max(0, length - 1);

  // A new trace restarts playback (state adjusted during render, see React docs
  // "Adjusting some state when a prop changes").
  if (key !== resetKey) {
    setKey(resetKey);
    setIndex(0);
    setPlaying(Boolean(options.autoplay) && length > 1);
  }

  const active = playing && index < last;
  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = setInterval(() => setIndex((i) => Math.min(i + 1, last)), 1000 / speed);
    return () => clearInterval(timer);
  }, [active, speed, last]);

  const play = useCallback(() => {
    setIndex((i) => (i >= last ? 0 : i));
    setPlaying(true);
  }, [last]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => (active ? pause() : play()), [active, pause, play]);
  const forward = useCallback(() => {
    setPlaying(false);
    setIndex((i) => Math.min(i + 1, last));
  }, [last]);
  const back = useCallback(() => {
    setPlaying(false);
    setIndex((i) => Math.max(i - 1, 0));
  }, []);
  const reset = useCallback(() => {
    setPlaying(false);
    setIndex(0);
  }, []);
  const end = useCallback(() => {
    setPlaying(false);
    setIndex(last);
  }, [last]);
  const seek = useCallback((i: number) => setIndex(Math.max(0, Math.min(i, last))), [last]);

  const animationMs = active ? Math.round(Math.min(280, 850 / speed)) : 220;
  return { index: Math.min(index, last), length, playing: active, speed, animationMs, play, pause, toggle, forward, back, reset, end, seek, setSpeed };
}

/** Space: play/pause · ←/→: step · Home: reset · End: last step. */
export function usePlayerShortcuts(player: Player, enabled = true): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.closest('input, textarea, select, [contenteditable="true"]') || target.closest('.monaco-editor'))) {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      switch (event.key) {
        case ' ':
          event.preventDefault();
          player.toggle();
          break;
        case 'ArrowRight':
          event.preventDefault();
          player.forward();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          player.back();
          break;
        case 'Home':
          player.reset();
          break;
        case 'End':
          player.end();
          break;
        default:
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player, enabled]);
}
