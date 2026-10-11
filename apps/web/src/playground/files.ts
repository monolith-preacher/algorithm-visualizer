import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { EXAMPLES, NEW_FILE_TEMPLATE } from './examples';

export interface CFile {
  id: string;
  name: string;
  code: string;
  /** Content the file was created with (used by "Revert"). */
  original: string;
  breakpoints: number[];
  updatedAt: number;
}

interface FilesState {
  files: CFile[];
  activeId: string;
  stdin: string;
  sanitizers: boolean;
  create(name?: string, code?: string): void;
  select(id: string): void;
  rename(id: string, name: string): void;
  remove(id: string): void;
  update(id: string, code: string): void;
  revert(id: string): void;
  toggleBreakpoint(id: string, line: number): void;
  setBreakpoints(id: string, lines: number[]): void;
  setStdin(stdin: string): void;
  setSanitizers(on: boolean): void;
}

const newId = () => Math.random().toString(36).slice(2, 10);

export function sanitizeName(name: string): string {
  const base = name.trim().replace(/[^\w.-]+/g, '_').slice(0, 48) || 'program';
  return base.endsWith('.c') ? base : `${base}.c`;
}

function makeFile(name: string, code: string): CFile {
  return { id: newId(), name: sanitizeName(name), code, original: code, breakpoints: [], updatedAt: Date.now() };
}

function uniqueName(files: CFile[], name: string): string {
  const taken = new Set(files.map((f) => f.name));
  if (!taken.has(name)) {
    return name;
  }
  const stem = name.replace(/\.c$/, '');
  for (let i = 2; ; i++) {
    const candidate = `${stem}_${i}.c`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}

const first = makeFile(EXAMPLES[0]?.file ?? 'main.c', EXAMPLES[0]?.code ?? NEW_FILE_TEMPLATE);

/** Programs are stored in the browser (localStorage); nothing is sent to the server until compiled. */
export const useFiles = create<FilesState>()(
  persist(
    (set) => ({
      files: [first],
      activeId: first.id,
      stdin: '',
      sanitizers: false,
      create: (name = 'untitled.c', code = NEW_FILE_TEMPLATE) =>
        set((s) => {
          const file = makeFile(uniqueName(s.files, sanitizeName(name)), code);
          return { files: [...s.files, file], activeId: file.id };
        }),
      select: (id) => set({ activeId: id }),
      rename: (id, name) =>
        set((s) => ({
          files: s.files.map((f) =>
            f.id === id ? { ...f, name: uniqueName(s.files.filter((o) => o.id !== id), sanitizeName(name)) } : f,
          ),
        })),
      remove: (id) =>
        set((s) => {
          const files = s.files.filter((f) => f.id !== id);
          if (files.length === 0) {
            const blank = makeFile('main.c', NEW_FILE_TEMPLATE);
            return { files: [blank], activeId: blank.id };
          }
          return { files, activeId: s.activeId === id ? (files[0]?.id ?? '') : s.activeId };
        }),
      update: (id, code) =>
        set((s) => ({ files: s.files.map((f) => (f.id === id ? { ...f, code, updatedAt: Date.now() } : f)) })),
      revert: (id) =>
        set((s) => ({ files: s.files.map((f) => (f.id === id ? { ...f, code: f.original, updatedAt: Date.now() } : f)) })),
      toggleBreakpoint: (id, line) =>
        set((s) => ({
          files: s.files.map((f) =>
            f.id === id
              ? {
                  ...f,
                  breakpoints: f.breakpoints.includes(line)
                    ? f.breakpoints.filter((l) => l !== line)
                    : [...f.breakpoints, line].sort((a, b) => a - b),
                }
              : f,
          ),
        })),
      setBreakpoints: (id, lines) =>
        set((s) => ({ files: s.files.map((f) => (f.id === id ? { ...f, breakpoints: lines } : f)) })),
      setStdin: (stdin) => set({ stdin }),
      setSanitizers: (sanitizers) => set({ sanitizers }),
    }),
    { name: 'algoviz.playground.v1', storage: createJSONStorage(() => localStorage) },
  ),
);

export function useActiveFile(): CFile {
  return useFiles((s) => s.files.find((f) => f.id === s.activeId) ?? (s.files[0] as CFile));
}
