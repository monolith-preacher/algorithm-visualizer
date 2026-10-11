/** Short descriptions of the signals a C program commonly dies from. */
const MEANINGS: Record<string, string> = {
  SIGSEGV: 'Segmentation fault: invalid memory access',
  SIGBUS: 'Bus error: misaligned or nonexistent physical address',
  SIGFPE: 'Arithmetic exception (e.g. integer division by zero)',
  SIGABRT: 'Aborted (abort(), failed assert or sanitizer/heap check)',
  SIGILL: 'Illegal instruction',
  SIGKILL: 'Killed',
  SIGXCPU: 'CPU time limit exceeded',
  SIGXFSZ: 'File size limit exceeded',
  SIGPIPE: 'Broken pipe',
  SIGTERM: 'Terminated',
  SIGINT: 'Interrupted',
  SIGTRAP: 'Trace/breakpoint trap',
};

export function signalMeaning(name: string): string {
  return MEANINGS[name] ?? name;
}
