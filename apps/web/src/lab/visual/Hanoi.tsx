import type { RecursionStep } from '@av/shared';

const PEGS = ['A', 'B', 'C'];
const WIDTH = 660;
const HEIGHT = 260;
const BASE_Y = 225;
const DISK_H = 17;

/** Three pegs with the disk arrays held in the C Towers struct. */
export function Hanoi({ step, disks, animationMs }: { step: RecursionStep; disks: number; animationMs: number }) {
  const pegs = step.pegs ?? [[], [], []];
  const pegX = (p: number) => (WIDTH / 6) * (2 * p + 1);
  const width = (d: number) => 36 + ((150 - 36) * (d - 1)) / Math.max(1, disks - 1);
  const positions = new Map<number, { x: number; y: number }>();
  pegs.forEach((peg, p) =>
    peg.forEach((disk, level) => positions.set(disk, { x: pegX(p), y: BASE_Y - (level + 1) * (DISK_H + 2) })),
  );
  const moving = step.move?.disk ?? null;
  const total = 2 ** disks - 1;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
      <div className="flex items-center gap-4 font-mono text-xs text-faint">
        <span>
          moves <span className="text-fg tabular-nums">{step.moves ?? 0}</span> / {total}
        </span>
        {step.move && (
          <span className="text-cyan">
            disk {step.move.disk}: {step.move.from} → {step.move.to}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full max-w-3xl">
        <rect x={20} y={BASE_Y} width={WIDTH - 40} height={6} rx={2} fill="var(--color-line-strong)" />
        {PEGS.map((name, p) => (
          <g key={name}>
            <rect x={pegX(p) - 3} y={BASE_Y - (disks + 1.5) * (DISK_H + 2)} width={6} height={(disks + 1.5) * (DISK_H + 2)} rx={3} fill="var(--color-line-strong)" />
            <text x={pegX(p)} y={BASE_Y + 24} textAnchor="middle" className="font-mono" fontSize={12} fill="var(--color-muted)">
              {name}
            </text>
          </g>
        ))}
        {[...positions].map(([disk, pos]) => {
          const w = width(disk);
          const hue = 165 + (disk / Math.max(1, disks)) * 45;
          const active = disk === moving;
          return (
            <g
              key={disk}
              style={{
                transform: `translate(${pos.x - w / 2}px, ${pos.y}px)`,
                transition: `transform ${animationMs}ms cubic-bezier(.4,.1,.2,1)`,
              }}
            >
              <rect
                width={w}
                height={DISK_H}
                rx={4}
                fill={`hsl(${hue} 70% ${active ? 58 : 42}%)`}
                stroke={active ? 'var(--color-cyan)' : 'transparent'}
                strokeWidth={1.5}
              />
              <text x={w / 2} y={DISK_H / 2 + 4} textAnchor="middle" className="font-mono" fontSize={10.5} fill="#06110d">
                {disk}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
