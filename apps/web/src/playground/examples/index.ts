import dynamicArray from './dynamic_array.c?raw';
import hello from './hello.c?raw';
import linkedList from './linked_list.c?raw';
import memoryBugs from './memory_bugs.c?raw';
import pointers from './pointers.c?raw';
import recursion from './recursion.c?raw';
import structs from './structs.c?raw';

export interface Example {
  file: string;
  title: string;
  description: string;
  code: string;
}

export const EXAMPLES: Example[] = [
  { file: 'hello.c', title: 'Input and output', description: 'scanf, printf and loops (interactive stdin)', code: hello },
  { file: 'pointers.c', title: 'Pointers', description: 'Pointers, pointer-to-pointer and arithmetic', code: pointers },
  { file: 'linked_list.c', title: 'Linked list', description: 'malloc/free and in-place reversal', code: linkedList },
  { file: 'recursion.c', title: 'Recursion', description: 'Factorial, Fibonacci and fast power', code: recursion },
  { file: 'dynamic_array.c', title: 'Dynamic array', description: 'Growing a buffer with realloc', code: dynamicArray },
  { file: 'structs.c', title: 'Structs and qsort', description: 'Arrays of structs and function pointers', code: structs },
  { file: 'memory_bugs.c', title: 'Memory bugs', description: 'Overflow, use-after-free, NULL, leak', code: memoryBugs },
];

export const NEW_FILE_TEMPLATE = `#include <stdio.h>

int main(void) {
    printf("Hello, C!\\n");
    return 0;
}
`;
