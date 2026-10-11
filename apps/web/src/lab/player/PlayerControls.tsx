import { ChevronLast, Pause, Play, RotateCcw, StepBack, StepForward } from 'lucide-react';

import { IconButton } from '../../components/ui/Button';
import { cx } from '../../lib/cx';
import { SPEEDS, type Player } from './usePlayer';

const OPERATION_TONE: Record<string, string> = {
  compare: 'text-st-compare',
  swap: 'text-st-swap',
  write: 'text-st-write',
  copy: 'text-st-write',
  call: 'text-cyan',
  return: 'text-accent',
  move: 'text-cyan',
  alloc: 'text-st-write',
  free: 'text-st-swap',
  op: 'text-cyan',
  op_end: 'text-accent',
  end: 'text-accent',
};

export function PlayerControls({ player, operation, className }: { player: Player; operation?: string; className?: string }) {
  const speedIndex = Math.max(0, SPEEDS.indexOf(player.speed));
  const disabled = player.length <= 1;
  return (
    <div className={cx('flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-surface px-3 py-2', className)}>
      <div className="flex items-center gap-1">
        <IconButton label="Reset (Home)" onClick={player.reset} disabled={disabled}>
          <RotateCcw size={13} />
        </IconButton>
        <IconButton label="Step back (←)" onClick={player.back} disabled={disabled || player.index === 0}>
          <StepBack size={13} />
        </IconButton>
        <IconButton
          label={player.playing ? 'Pause (Space)' : 'Play (Space)'}
          onClick={player.toggle}
          disabled={disabled}
          tone="accent"
          className="w-9"
        >
          {player.playing ? <Pause size={14} /> : <Play size={14} />}
        </IconButton>
        <IconButton label="Step forward (→)" onClick={player.forward} disabled={disabled || player.index >= player.length - 1}>
          <StepForward size={13} />
        </IconButton>
        <IconButton label="Last step (End)" onClick={player.end} disabled={disabled}>
          <ChevronLast size={14} />
        </IconButton>
      </div>

      <div className="flex min-w-40 flex-1 items-center gap-2">
        <input
          type="range"
          min={0}
          max={Math.max(0, player.length - 1)}
          value={player.index}
          onChange={(e) => player.seek(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer accent-cyan"
          aria-label="Step"
          disabled={disabled}
        />
        <span className="w-24 text-right font-mono text-[11px] text-muted tabular-nums">
          {player.index + 1}
          <span className="text-faint"> / {player.length}</span>
        </span>
      </div>

      {operation && (
        <span className={cx('w-20 font-mono text-[11px] tracking-wide', OPERATION_TONE[operation] ?? 'text-muted')}>
          {operation === 'op_end' ? 'result' : operation}
        </span>
      )}

      <label className="flex items-center gap-2 font-mono text-[11px] text-faint">
        speed
        <input
          type="range"
          min={0}
          max={SPEEDS.length - 1}
          value={speedIndex}
          onChange={(e) => player.setSpeed(SPEEDS[Number(e.target.value)] ?? 8)}
          className="h-1 w-20 cursor-pointer accent-cyan"
          aria-label="Playback speed"
        />
        <span className="w-14 text-muted tabular-nums">{player.speed} st/s</span>
      </label>
    </div>
  );
}
