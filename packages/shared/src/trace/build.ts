import type { AlgorithmInfo } from '../catalog';
import { buildArrayTrace, type ArrayTrace } from './array-model';
import type { TraceEvent } from './events';
import { buildRecursionTrace, type RecursionTrace } from './recursion-model';
import type { SourceMap } from './source';
import { buildStructureTrace, type StructureTrace } from './structure-model';

export type LabTrace = ArrayTrace | RecursionTrace | StructureTrace;

/** Builds the step model matching an algorithm's visualization. */
export function buildTrace(algorithm: AlgorithmInfo, events: TraceEvent[], source: SourceMap): LabTrace {
  switch (algorithm.visual) {
    case 'sort':
      return buildArrayTrace(events, source, 'sort');
    case 'search':
      return buildArrayTrace(events, source, 'search');
    case 'call-tree':
    case 'hanoi':
      return buildRecursionTrace(events, source);
    default:
      return buildStructureTrace(events, source);
  }
}
