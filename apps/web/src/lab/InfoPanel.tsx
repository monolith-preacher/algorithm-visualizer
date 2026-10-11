import type { ReactNode } from 'react';

import type { AlgorithmInfo } from '@av/shared';

import { Badge } from '../components/ui/misc';
import { METRIC_HINT, METRIC_LABEL } from './panels/StatsPanel';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="panel-title">{title}</h3>
      {children}
    </section>
  );
}

/** Technical reference for an algorithm, kept separate from the execution view. */
export function InfoPanel({ algorithm }: { algorithm: AlgorithmInfo }) {
  const c = algorithm.complexity;
  const rows: [string, string | undefined][] = [
    ['Best', c.best],
    ['Average', c.average],
    ['Worst', c.worst],
    ['Space', c.space],
  ];
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-7 px-6 py-6">
        <div className="flex flex-col gap-2">
          <h2 className="font-mono text-lg font-semibold">{algorithm.name}</h2>
          <p className="text-sm leading-relaxed text-muted">{algorithm.summary}</p>
          {algorithm.properties && (
            <div className="flex flex-wrap gap-1.5">
              {algorithm.properties.map((p) => (
                <Badge key={p} tone="cyan">
                  {p}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Section title={algorithm.operations ? 'Space' : 'Complexity'}>
          <table className="w-full max-w-md border-collapse font-mono text-xs">
            <tbody>
              {rows
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => (
                  <tr key={k} className="border-b border-line">
                    <td className="py-1.5 pr-6 text-muted">{algorithm.module === 'recursion' && k === 'Average' ? 'Time' : k}</td>
                    <td className="py-1.5 text-fg">{v}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Section>

        {algorithm.operations && (
          <Section title="Operations">
            <table className="w-full max-w-md border-collapse font-mono text-xs">
              <tbody>
                {algorithm.operations.map((op) => (
                  <tr key={op.name} className="border-b border-line">
                    <td className="py-1.5 pr-6 text-muted">{op.label}</td>
                    <td className="py-1.5 pr-6 text-faint">
                      {op.name}({['s', ...op.args].join(', ')})
                    </td>
                    <td className="py-1.5 text-fg">{op.complexity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <Section title="Notes">
          <ul className="flex flex-col gap-2.5">
            {algorithm.notes.map((note) => (
              <li key={note} className="flex gap-2.5 text-sm leading-relaxed text-fg/90">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan" />
                {note}
              </li>
            ))}
          </ul>
        </Section>

        {algorithm.metrics && (
          <Section title="Counters">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 font-mono text-xs">
              {algorithm.metrics.map((m) => (
                <div key={m} className="contents">
                  <dt className="text-muted">{METRIC_LABEL[m]}</dt>
                  <dd className="text-faint">{METRIC_HINT[m]}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}

        <Section title="Implementation">
          <div className="flex flex-col gap-1 font-mono text-xs text-muted">
            <span>
              clib/src/<span className="text-fg">{algorithm.source}</span>
            </span>
            <span>
              clib/src/<span className="text-fg">{algorithm.header}</span>
            </span>
          </div>
          <p className="text-xs leading-relaxed text-faint">
            The visualization is produced by running this C file, compiled with the TRACE_* instrumentation enabled, on
            the selected input. Every step corresponds to an event emitted by the running program; timing figures come
            from a separate build with the instrumentation compiled out.
          </p>
        </Section>
      </div>
    </div>
  );
}
