import type { DebugFrame, DebugValue, HeapBlock, MemoryRegion } from '@av/shared';

import type { GdbMi } from './gdb';
import { list, miQuote, str, tuple, type MiTuple } from './mi';

const MAX_FRAMES = 16;
const MAX_CHILDREN = 64;
const MAX_DEPTH = 3;
const MAX_HEAP_VIEWS = 48;
const HEAP_RECORD_BYTES = 24;
const HEAP_MAX_RECORDS = 1024;

interface VarObj {
  name: string;
  numchild: number;
  value: string;
  type: string;
  hasMore: boolean;
  exp?: string;
}

function toVarObj(t: MiTuple): VarObj {
  return {
    name: str(t['name']) ?? '',
    numchild: Number(str(t['numchild']) ?? 0),
    value: str(t['value']) ?? '',
    type: str(t['type']) ?? '',
    hasMore: str(t['has_more']) === '1',
    exp: str(t['exp']),
  };
}

export function classifyType(type: string): DebugValue['kind'] {
  const t = type.trim();
  if (/\(\*\)\s*\(/.test(t) || /^\w[\w\s]*\(.*\)$/.test(t)) {
    return 'function';
  }
  if (/\[\d*\]$/.test(t)) {
    return 'array';
  }
  if (t.endsWith('*')) {
    return 'pointer';
  }
  if (/^(struct|union)\b/.test(t)) {
    return 'struct';
  }
  return 'scalar';
}

/** First hexadecimal address in a GDB value ("0x55… \"hi\"", "(int *) 0x7ff…"). */
export function parseAddress(value: string): string | null {
  const match = /0x[0-9a-f]+/i.exec(value);
  if (!match) {
    return null;
  }
  return BigInt(match[0]) === 0n ? null : `0x${BigInt(match[0]).toString(16)}`;
}

/** Type a pointer points to, or null when it cannot be viewed (void, functions). */
export function pointeeType(pointerType: string): string | null {
  const t = pointerType.replace(/\bconst\b|\bvolatile\b|\brestrict\b/g, '').trim();
  if (!t.endsWith('*') || /\(\*\)\s*\(/.test(t)) {
    return null;
  }
  const target = t.slice(0, -1).trim();
  return target === 'void' || target === '' ? null : target;
}

function childExpression(parent: string, parentKind: DebugValue['kind'], exp: string): string {
  const simple = /^[A-Za-z_]\w*$/.test(parent);
  const base = simple ? parent : `(${parent})`;
  if (exp.startsWith('*')) {
    return `*${base}`;
  }
  if (/^\d+$/.test(exp)) {
    return `${base}[${exp}]`;
  }
  return parentKind === 'pointer' ? `${base}->${exp}` : `${base}.${exp}`;
}

function littleEndianU64(hex: string, offset: number): bigint {
  let value = 0n;
  for (let i = 7; i >= 0; i--) {
    const byte = hex.slice((offset + i) * 2, (offset + i) * 2 + 2);
    value = (value << 8n) | BigInt(Number.parseInt(byte || '0', 16));
  }
  return value;
}

/**
 * Collects variables, call frames and heap blocks of a stopped program through
 * GDB variable objects. Everything shown is read from the process: values,
 * addresses and allocation sizes are never inferred.
 */
export class Inspector {
  private roots: string[] = [];
  private readonly sizeCache = new Map<string, number | null>();
  private globals: string[] | null = null;

  constructor(private readonly gdb: GdbMi) {}

  private async mi(command: string): Promise<MiTuple> {
    return (await this.gdb.command(command)).record.results;
  }

  private async tryMi(command: string): Promise<MiTuple | null> {
    try {
      return await this.mi(command);
    } catch {
      return null;
    }
  }

  async sizeOf(type: string): Promise<number | null> {
    if (!this.sizeCache.has(type)) {
      const r = await this.tryMi(`-data-evaluate-expression ${miQuote(`sizeof(${type})`)}`);
      const size = r ? Number(str(r['value'])) : Number.NaN;
      this.sizeCache.set(type, Number.isFinite(size) && size > 0 ? size : null);
    }
    return this.sizeCache.get(type) ?? null;
  }

  private async readable(address: string): Promise<boolean> {
    return (await this.tryMi(`-data-read-memory-bytes ${address} 1`)) !== null;
  }

  async frames(): Promise<DebugFrame[]> {
    const r = await this.mi(`-stack-list-frames 0 ${MAX_FRAMES - 1}`);
    return list(r['stack']).map((f) => {
      const frame = tuple(f) ?? {};
      const file = str(frame['file']) ?? null;
      const line = str(frame['line']);
      return {
        level: Number(str(frame['level']) ?? 0),
        func: str(frame['func']) ?? '??',
        line: line ? Number(line) : null,
        file,
        address: str(frame['addr']) ?? '',
        user: file !== null && file.endsWith('main.c'),
        args: [],
        locals: [],
      };
    });
  }

  async regions(): Promise<MemoryRegion[]> {
    const r = await this.gdb.command('-interpreter-exec console "info proc mappings"').catch(() => null);
    if (!r) {
      return [];
    }
    const regions: MemoryRegion[] = [];
    for (const line of r.console.split('\n')) {
      const m = /^\s*(0x[0-9a-f]+)\s+(0x[0-9a-f]+)\s+0x[0-9a-f]+\s+0x[0-9a-f]+\s+(\S+)\s*(.*)$/i.exec(line);
      if (!m) {
        continue;
      }
      const [, start = '', end = '', perms = '', objfile = ''] = m;
      let name: MemoryRegion['name'] | null = null;
      if (objfile === '[stack]') {
        name = 'stack';
      } else if (objfile === '[heap]') {
        name = 'heap';
      } else if (/\/(prog|prog-debug)$/.test(objfile)) {
        name = perms.includes('x') ? 'text' : 'data';
      }
      if (name) {
        regions.push({ name, start, end });
      }
    }
    return regions;
  }

  async heapBlocks(): Promise<{ blocks: HeapBlock[]; available: boolean; overflow: boolean }> {
    const header = await this.tryMi('-data-read-memory-bytes &av_heap_count 16');
    const contents = str(tuple(list(header?.['memory'])[0])?.['contents']);
    if (!contents) {
      return { blocks: [], available: false, overflow: false };
    }
    const count = Math.min(Number(littleEndianU64(contents, 0)), HEAP_MAX_RECORDS);
    const overflow = littleEndianU64(contents, 8) !== 0n;
    if (count === 0) {
      return { blocks: [], available: true, overflow };
    }
    const table = await this.tryMi(`-data-read-memory-bytes &av_heap_table ${count * HEAP_RECORD_BYTES}`);
    const hex = str(tuple(list(table?.['memory'])[0])?.['contents']) ?? '';
    const blocks: HeapBlock[] = [];
    for (let i = 0; i < count; i++) {
      const base = i * HEAP_RECORD_BYTES;
      const address = littleEndianU64(hex, base);
      const size = littleEndianU64(hex, base + 8);
      const state = littleEndianU64(hex, base + 16);
      if (address === 0n) {
        continue;
      }
      blocks.push({ address: `0x${address.toString(16)}`, size: Number(size), state: state === 1n ? 'live' : 'freed' });
    }
    return { blocks, available: true, overflow };
  }

  /** Lists the arguments and locals of a frame, with their values. */
  async frameVariables(frame: DebugFrame): Promise<void> {
    const r = await this.tryMi(`-stack-list-variables --thread 1 --frame ${frame.level} --simple-values`);
    for (const item of list(r?.['variables'])) {
      const v = tuple(item);
      const name = str(v?.['name']);
      if (!v || !name) {
        continue;
      }
      const value = await this.inspect(name, name, frame.level, 0);
      if (str(v['arg']) === '1') {
        frame.args.push(value);
      } else {
        frame.locals.push(value);
      }
    }
  }

  /** Global and static variables defined in main.c. */
  async globalVariables(): Promise<DebugValue[]> {
    if (this.globals === null) {
      const r = await this.tryMi('-symbol-info-variables');
      const names: string[] = [];
      for (const file of list(tuple(r?.['symbols'])?.['debug'])) {
        const f = tuple(file);
        if (!str(f?.['filename'])?.endsWith('main.c')) {
          continue;
        }
        for (const sym of list(f?.['symbols'])) {
          const name = str(tuple(sym)?.['name']);
          if (name) {
            names.push(name);
          }
        }
      }
      this.globals = names;
    }
    const values: DebugValue[] = [];
    for (const name of this.globals) {
      values.push(await this.inspect(name, `'main.c'::${name}`, null, 0));
    }
    return values;
  }

  /** Creates a variable object for an expression and converts it (recursively). */
  async inspect(name: string, expression: string, frame: number | null, depth: number): Promise<DebugValue> {
    const frameOpt = frame === null ? '' : `--thread 1 --frame ${frame} `;
    let created: MiTuple;
    try {
      created = await this.mi(`-var-create ${frameOpt}- * ${miQuote(expression)}`);
    } catch (error) {
      return {
        name,
        expression,
        type: '',
        value: '',
        kind: 'unknown',
        address: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    const vo = toVarObj(created);
    this.roots.push(vo.name);
    const value = await this.convert(vo, name, expression, frame, depth);
    if (depth === 0) {
      const addr = await this.tryMi(`-data-evaluate-expression ${frameOpt}${miQuote(`&(${expression})`)}`);
      value.address = addr ? parseAddress(str(addr['value']) ?? '') : null;
      const size = await this.tryMi(`-data-evaluate-expression ${frameOpt}${miQuote(`sizeof(${expression})`)}`);
      const bytes = Number(str(size?.['value']));
      if (Number.isFinite(bytes)) {
        value.sizeBytes = bytes;
      }
    }
    return value;
  }

  private async convert(
    vo: VarObj,
    name: string,
    expression: string,
    frame: number | null,
    depth: number,
  ): Promise<DebugValue> {
    let kind = classifyType(vo.type);
    if (kind === 'scalar' && vo.numchild > 0) {
      // typedef'd struct or union
      kind = 'struct';
    }
    const value: DebugValue = { name, expression, type: vo.type, value: vo.value, kind, address: null };

    if (kind === 'pointer' || kind === 'function') {
      value.pointsTo = parseAddress(vo.value);
    }
    if (kind === 'array' && /^(const\s+)?(unsigned\s+|signed\s+)?char\s*\[/.test(vo.type)) {
      // Character arrays: show the string as GDB prints it.
      const frameOpt = frame === null ? '' : `--thread 1 --frame ${frame} `;
      const printed = await this.tryMi(`-data-evaluate-expression ${frameOpt}${miQuote(expression)}`);
      value.value = str(printed?.['value']) ?? vo.value;
    }

    const expandPointer =
      kind === 'pointer' && depth <= 1 && value.pointsTo && pointeeType(vo.type) !== null && !/char\s*\*$/.test(vo.type);
    const expand = (kind === 'array' || kind === 'struct') && depth < MAX_DEPTH;
    if (vo.numchild === 0 || (!expand && !expandPointer)) {
      return value;
    }
    if (expandPointer && !(await this.readable(value.pointsTo as string))) {
      value.error = `Cannot access memory at address ${value.pointsTo}`;
      return value;
    }
    const children = await this.tryMi(`-var-list-children --all-values ${vo.name} 0 ${MAX_CHILDREN}`);
    if (!children) {
      return value;
    }
    value.truncated = str(children['has_more']) === '1';
    value.children = [];
    let elementSize: number | null = null;
    let baseAddress: bigint | null = null;
    if (kind === 'array' && depth === 0) {
      const elemType = vo.type.replace(/\s*\[\d*\]$/, '');
      elementSize = await this.sizeOf(elemType);
    }
    for (const item of list(children['children'])) {
      const t = tuple(item);
      if (!t) {
        continue;
      }
      const child = toVarObj(t);
      const exp = child.exp ?? '';
      const childExpr = childExpression(expression, kind, exp);
      const label = /^\d+$/.test(exp) ? `[${exp}]` : exp;
      const converted = await this.convert(child, label, childExpr, frame, depth + 1);
      if (elementSize !== null && /^\d+$/.test(exp)) {
        if (baseAddress === null) {
          const frameOpt = frame === null ? '' : `--thread 1 --frame ${frame} `;
          const addr = await this.tryMi(`-data-evaluate-expression ${frameOpt}${miQuote(`&(${expression})[0]`)}`);
          const parsed = addr ? parseAddress(str(addr['value']) ?? '') : null;
          baseAddress = parsed ? BigInt(parsed) : -1n;
        }
        if (baseAddress > 0n) {
          converted.address = `0x${(baseAddress + BigInt(Number(exp) * elementSize)).toString(16)}`;
        }
      }
      value.children.push(converted);
    }
    return value;
  }

  /**
   * Gives a typed view to live heap blocks referenced by typed pointers.
   * A block of n bytes pointed to by a T* is shown as T[n / sizeof(T)].
   */
  async typeHeap(blocks: HeapBlock[], roots: DebugValue[]): Promise<void> {
    const byAddress = new Map(blocks.filter((b) => b.state === 'live').map((b) => [b.address, b]));
    const queue: { address: string; type: string }[] = [];
    const collect = (v: DebugValue): void => {
      if (v.kind === 'pointer' && v.pointsTo) {
        const target = pointeeType(v.type);
        if (target) {
          queue.push({ address: v.pointsTo, type: target });
        }
      }
      v.children?.forEach(collect);
    };
    roots.forEach(collect);

    let typed = 0;
    while (queue.length > 0 && typed < MAX_HEAP_VIEWS) {
      const next = queue.shift();
      const block = next ? byAddress.get(next.address) : undefined;
      if (!next || !block || block.view) {
        continue;
      }
      const elemSize = await this.sizeOf(next.type);
      if (!elemSize || block.size < elemSize) {
        continue;
      }
      const count = Math.floor(block.size / elemSize);
      const expression = count > 1 ? `*(${next.type} (*)[${count}])${block.address}` : `*(${next.type} *)${block.address}`;
      const view = await this.inspect(count > 1 ? `${next.type}[${count}]` : next.type, expression, null, 1);
      if (view.error) {
        continue;
      }
      view.address = block.address;
      if (count > 1 && view.children) {
        view.children.forEach((child, i) => {
          child.address = `0x${(BigInt(block.address) + BigInt(i * elemSize)).toString(16)}`;
        });
      }
      block.view = view;
      typed++;
      collect(view);
    }
  }

  /** Deletes the variable objects created for the last snapshot. */
  async release(): Promise<void> {
    const roots = this.roots;
    this.roots = [];
    for (const name of roots) {
      await this.tryMi(`-var-delete ${name}`);
    }
  }
}
