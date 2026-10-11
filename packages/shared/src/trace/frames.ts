import type { TraceEvent, VarValue, Vars } from './events';
import type { SourceMap } from './source';

/** A C call frame reconstructed from call/return events. */
export interface Frame {
  id: number;
  fn: string;
  vars: Vars;
  /** Set when the function has executed its return; the frame is popped at the next event. */
  returning: boolean;
  returnValue?: VarValue;
  /** Active subarray recorded with TRACE_RANGE while this frame was on top. */
  range: [number, number] | null;
  /** Frame-local index marks (pivot, min, key). */
  marks: Record<string, number>;
}

/** Common fields of every visualization step. */
export interface StepBase {
  /** Event that produced the step ("start" and "end" are synthetic). */
  kind: string;
  /** Code line to highlight, in raw source numbering (null: no highlight). */
  line: number | null;
  /** Call stack, outermost frame first. */
  frames: Frame[];
}

export class FrameTracker {
  private frames: Frame[] = [];
  private nextId = 1;

  /** Applies the effect of an event on the call stack. */
  apply(event: TraceEvent): void {
    // A frame that executed its return disappears before the next event.
    while (this.top()?.returning) {
      this.frames.pop();
    }
    if (event.t === 'call') {
      this.frames.push({
        id: this.nextId++,
        fn: event.fn,
        vars: { ...event.vars },
        returning: false,
        range: null,
        marks: {},
      });
      return;
    }
    const top = this.top();
    if (!top) {
      return;
    }
    if (event.vars && event.t !== 'mark' && event.t !== 'range') {
      top.vars = { ...event.vars };
    }
    if (event.t === 'return') {
      top.returning = true;
      top.returnValue = event.value;
    }
  }

  top(): Frame | undefined {
    return this.frames[this.frames.length - 1];
  }

  /** Innermost range on the stack. */
  range(): [number, number] | null {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const range = this.frames[i]?.range;
      if (range) {
        return range;
      }
    }
    return null;
  }

  mark(kind: string): number | null {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const value = this.frames[i]?.marks[kind];
      if (value !== undefined) {
        return value;
      }
    }
    return null;
  }

  snapshot(): Frame[] {
    return this.frames.map((f) => ({ ...f, vars: { ...f.vars }, marks: { ...f.marks } }));
  }

  depth(): number {
    return this.frames.length;
  }
}

/** Source line an event should highlight. */
export function eventLine(event: TraceEvent, source: SourceMap): number | null {
  switch (event.t) {
    case 'call':
      return source.signatureLine(event.fn) ?? source.resolve(event.line);
    case 'return':
      return event.retLine ? source.resolve(event.retLine) : source.closingLine(event.fn);
    default:
      return event.line > 0 ? source.resolve(event.line) : null;
  }
}
