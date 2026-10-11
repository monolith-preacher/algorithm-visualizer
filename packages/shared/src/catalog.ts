/**
 * Algorithm Lab catalog. Every entry corresponds to a real C implementation in
 * clib/src and to an id accepted by clib/driver/avlab.c.
 */

export type ModuleId = 'sorting' | 'searching' | 'recursion' | 'stacks' | 'queues' | 'lists';

export type VisualKind =
  | 'sort'
  | 'search'
  | 'call-tree'
  | 'hanoi'
  | 'array-stack'
  | 'linked-stack'
  | 'array-queue'
  | 'circular-queue'
  | 'linked-queue'
  | 'linked-list';

export type Metric = 'comparisons' | 'swaps' | 'writes' | 'auxWrites';

export interface Complexity {
  best?: string;
  average?: string;
  worst?: string;
  space: string;
}

export interface OperationSpec {
  /** Operation keyword understood by the C driver. */
  name: string;
  label: string;
  args: ('value' | 'index')[];
  complexity: string;
  /** Operation allocates memory (allocation failure can be injected). */
  allocates?: boolean;
}

export interface InputSpec {
  /** Array algorithms: size limits. Recursion: limits for n. */
  min: number;
  max: number;
  default: number;
  valueMin?: number;
  valueMax?: number;
}

export interface AlgorithmInfo {
  id: string;
  name: string;
  module: ModuleId;
  /** Path of the implementation relative to clib/src. */
  source: string;
  /** Header with the public types and prototypes, relative to clib/src. */
  header: string;
  visual: VisualKind;
  summary: string;
  complexity: Complexity;
  /** Operation-level complexity for data structures. */
  operations?: OperationSpec[];
  properties?: string[];
  /** Counters that are meaningful for this algorithm. */
  metrics?: Metric[];
  input?: InputSpec;
  /** Technical notes shown in the Info tab. */
  notes: string[];
}

export interface ModuleInfo {
  id: ModuleId;
  name: string;
  description: string;
}

export const MODULES: ModuleInfo[] = [
  { id: 'sorting', name: 'Sorting', description: 'Comparison-based in-memory sorting of int arrays.' },
  { id: 'searching', name: 'Searching', description: 'Sequential and divide-and-conquer search in arrays.' },
  { id: 'recursion', name: 'Recursion', description: 'Linear and tree recursion with explicit call stacks.' },
  { id: 'stacks', name: 'Stacks', description: 'LIFO containers backed by arrays and by linked nodes.' },
  { id: 'queues', name: 'Queues', description: 'FIFO containers: linear array, ring buffer and linked nodes.' },
  { id: 'lists', name: 'Linked Lists', description: 'Singly, doubly and circular lists of heap-allocated nodes.' },
];

const SORT_INPUT: InputSpec = { min: 2, max: 100, default: 24, valueMin: 1, valueMax: 99 };
const SEARCH_INPUT: InputSpec = { min: 1, max: 64, default: 16, valueMin: 0, valueMax: 99 };

const STACK_OPS: OperationSpec[] = [
  { name: 'push', label: 'Push', args: ['value'], complexity: 'O(1)', allocates: true },
  { name: 'pop', label: 'Pop', args: [], complexity: 'O(1)' },
  { name: 'peek', label: 'Peek', args: [], complexity: 'O(1)' },
];

const QUEUE_OPS: OperationSpec[] = [
  { name: 'enqueue', label: 'Enqueue', args: ['value'], complexity: 'O(1)', allocates: true },
  { name: 'dequeue', label: 'Dequeue', args: [], complexity: 'O(1)' },
  { name: 'front', label: 'Front', args: [], complexity: 'O(1)' },
];

function listOps(frontBack: [string, string], extra: OperationSpec[] = []): OperationSpec[] {
  return [
    { name: 'insert_front', label: 'Insert front', args: ['value'], complexity: frontBack[0], allocates: true },
    { name: 'insert_back', label: 'Insert back', args: ['value'], complexity: frontBack[1], allocates: true },
    { name: 'insert_at', label: 'Insert at', args: ['index', 'value'], complexity: 'O(n)', allocates: true },
    { name: 'remove', label: 'Remove', args: ['value'], complexity: 'O(n)' },
    { name: 'search', label: 'Search', args: ['value'], complexity: 'O(n)' },
    { name: 'traverse', label: 'Traverse', args: [], complexity: 'O(n)' },
    ...extra,
  ];
}

export const ALGORITHMS: AlgorithmInfo[] = [
  {
    id: 'bubble-sort',
    name: 'Bubble Sort',
    module: 'sorting',
    source: 'sorting/bubble_sort.c',
    header: 'sorting/sorting.h',
    visual: 'sort',
    summary: 'Repeatedly swaps adjacent out-of-order pairs; each pass moves the largest remaining element to the end.',
    complexity: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
    properties: ['stable', 'in-place', 'adaptive'],
    metrics: ['comparisons', 'swaps', 'writes'],
    input: SORT_INPUT,
    notes: [
      'After pass k the last k positions hold their final values, so the inner loop shrinks by one each pass.',
      'The swapped flag stops the algorithm after a pass without exchanges: a sorted input costs n − 1 comparisons and no swaps.',
      'Worst case (reverse order): n(n − 1)/2 comparisons and n(n − 1)/2 swaps.',
      'Only adjacent elements are exchanged and equal elements are never swapped, which makes the sort stable.',
    ],
  },
  {
    id: 'selection-sort',
    name: 'Selection Sort',
    module: 'sorting',
    source: 'sorting/selection_sort.c',
    header: 'sorting/sorting.h',
    visual: 'sort',
    summary: 'Selects the minimum of the unsorted suffix and swaps it into the next position.',
    complexity: { best: 'O(n²)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
    properties: ['not stable', 'in-place', 'not adaptive'],
    metrics: ['comparisons', 'swaps', 'writes'],
    input: SORT_INPUT,
    notes: [
      'Always performs exactly n(n − 1)/2 comparisons, independent of the input order.',
      'Performs at most n − 1 swaps (the swap is skipped when the minimum is already in place), which is useful when writes are expensive.',
      'The long-distance swap can move an element past an equal one, so the sort is not stable.',
    ],
  },
  {
    id: 'insertion-sort',
    name: 'Insertion Sort',
    module: 'sorting',
    source: 'sorting/insertion_sort.c',
    header: 'sorting/sorting.h',
    visual: 'sort',
    summary: 'Grows a sorted prefix by shifting larger elements right and inserting the key into the gap.',
    complexity: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
    properties: ['stable', 'in-place', 'adaptive', 'online'],
    metrics: ['comparisons', 'writes'],
    input: SORT_INPUT,
    notes: [
      'Elements are shifted with single assignments instead of swaps; the key is held in a local variable, so a value may temporarily appear twice in the array.',
      'Running time is O(n + d), where d is the number of inversions: nearly sorted input is handled in close to linear time.',
      'The comparison stops at the first element ≤ key, which keeps equal elements in their original order (stable).',
    ],
  },
  {
    id: 'merge-sort',
    name: 'Merge Sort',
    module: 'sorting',
    source: 'sorting/merge_sort.c',
    header: 'sorting/sorting.h',
    visual: 'sort',
    summary: 'Top-down divide and conquer: sorts both halves recursively and merges them through an auxiliary buffer.',
    complexity: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)' },
    properties: ['stable', 'not in-place'],
    metrics: ['comparisons', 'writes', 'auxWrites'],
    input: SORT_INPUT,
    notes: [
      'A single auxiliary buffer of n ints is allocated with malloc once and reused by every merge; the function returns -1 if the allocation fails.',
      'Each merge copies a[lo..hi] into aux and writes the merged sequence back into a, so every level of the recursion performs n writes into each array.',
      'Ties are resolved in favour of the left half (aux[j] < aux[i] is strict), which keeps the sort stable.',
      'Recursion depth is ⌈log₂ n⌉; extra space is O(n) for the buffer plus O(log n) for the call stack.',
    ],
  },
  {
    id: 'quick-sort',
    name: 'Quick Sort',
    module: 'sorting',
    source: 'sorting/quick_sort.c',
    header: 'sorting/sorting.h',
    visual: 'sort',
    summary: 'Partitions around a pivot (Lomuto scheme, last element) and sorts both sides recursively.',
    complexity: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n²)', space: 'O(log n) avg · O(n) worst' },
    properties: ['not stable', 'in-place'],
    metrics: ['comparisons', 'swaps', 'writes'],
    input: SORT_INPUT,
    notes: [
      'Lomuto partition: i marks the end of the ≤ pivot region; every element ≤ pivot is swapped into it, then the pivot is swapped to position i + 1, its final place.',
      'With the last element as pivot, already sorted, reverse-sorted and all-equal inputs produce maximally unbalanced partitions: n(n − 1)/2 comparisons and recursion depth n.',
      'Swaps of an element with itself (i == j) are executed by the code and counted as swaps.',
    ],
  },
  {
    id: 'heap-sort',
    name: 'Heap Sort',
    module: 'sorting',
    source: 'sorting/heap_sort.c',
    header: 'sorting/sorting.h',
    visual: 'sort',
    summary: 'Builds a max-heap in the array, then repeatedly swaps the root to the end and restores the heap.',
    complexity: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(1)' },
    properties: ['not stable', 'in-place', 'not adaptive'],
    metrics: ['comparisons', 'swaps', 'writes'],
    input: SORT_INPUT,
    notes: [
      'The heap is implicit: the children of index i are 2i + 1 and 2i + 2, so no extra memory is needed.',
      'Bottom-up heap construction (sift_down from n/2 − 1 to 0) runs in O(n); each of the n − 1 extractions costs O(log n).',
      'The highlighted range is the part of the array that still forms the heap; positions after it are final.',
    ],
  },
  {
    id: 'linear-search',
    name: 'Linear Search',
    module: 'searching',
    source: 'searching/linear_search.c',
    header: 'searching/searching.h',
    visual: 'search',
    summary: 'Examines elements from left to right until one equals the target.',
    complexity: { best: 'O(1)', average: 'O(n)', worst: 'O(n)', space: 'O(1)' },
    properties: ['no precondition'],
    metrics: ['comparisons'],
    input: SEARCH_INPUT,
    notes: [
      'Works on unsorted data and returns the index of the first occurrence.',
      'A successful search for a uniformly random present element inspects (n + 1)/2 elements on average; an unsuccessful search always inspects n.',
    ],
  },
  {
    id: 'binary-search',
    name: 'Binary Search',
    module: 'searching',
    source: 'searching/binary_search.c',
    header: 'searching/searching.h',
    visual: 'search',
    summary: 'Halves the candidate interval [lo, hi] at every probe of a sorted array.',
    complexity: { best: 'O(1)', average: 'O(log n)', worst: 'O(log n)', space: 'O(1)' },
    properties: ['requires sorted input'],
    metrics: ['comparisons'],
    input: SEARCH_INPUT,
    notes: [
      'Precondition: the array is sorted in non-decreasing order. The Lab driver verifies it with is_sorted() before calling binary_search and rejects unsorted input.',
      'mid = lo + (hi − lo) / 2 avoids the signed overflow of (lo + hi) / 2 for large indices.',
      'At most ⌊log₂ n⌋ + 1 iterations; each iteration compares a[mid] with the target at most twice.',
      'With duplicates, the returned index is some position holding the target, not necessarily the first one.',
    ],
  },
  {
    id: 'factorial',
    name: 'Factorial',
    module: 'recursion',
    source: 'recursion/factorial.c',
    header: 'recursion/recursion.h',
    visual: 'call-tree',
    summary: 'Linear recursion n! = n · (n − 1)!, with 1! = 0! = 1.',
    complexity: { average: 'O(n)', space: 'O(n) stack' },
    input: { min: 0, max: 20, default: 6 },
    notes: [
      'Each call waits for the result of the next one, so n frames are live at the deepest point and the multiplications happen while the stack unwinds.',
      '20! = 2 432 902 008 176 640 000 is the largest factorial representable in a 64-bit unsigned long long; the Lab limits n to 20.',
    ],
  },
  {
    id: 'fibonacci',
    name: 'Fibonacci',
    module: 'recursion',
    source: 'recursion/fibonacci.c',
    header: 'recursion/recursion.h',
    visual: 'call-tree',
    summary: 'Naive tree recursion F(n) = F(n − 1) + F(n − 2), F(0) = 0, F(1) = 1.',
    complexity: { average: 'O(φⁿ), φ ≈ 1.618', space: 'O(n) stack' },
    input: { min: 0, max: 12, default: 5 },
    notes: [
      'The call tree has 2·F(n + 1) − 1 nodes: the same subproblems are recomputed many times (F(n − 2) is evaluated by both children of F(n)).',
      'Only one root-to-leaf path is on the call stack at a time, so the space is proportional to the depth n, not to the number of calls.',
    ],
  },
  {
    id: 'hanoi',
    name: 'Towers of Hanoi',
    module: 'recursion',
    source: 'recursion/hanoi.c',
    header: 'recursion/recursion.h',
    visual: 'hanoi',
    summary: 'Moves n disks from A to C: move n − 1 disks to the spare peg, move the largest disk, move n − 1 disks on top.',
    complexity: { average: 'O(2ⁿ)', space: 'O(n) stack' },
    input: { min: 1, max: 10, default: 4 },
    notes: [
      'Exactly 2ⁿ − 1 moves, which is optimal; the call hanoi(n, from, to, via) always moves disk n directly from from to to.',
      'The pegs are real arrays in a Towers struct; move_disk() checks that no disk is ever placed on a smaller one.',
    ],
  },
  {
    id: 'array-stack',
    name: 'Static Stack',
    module: 'stacks',
    source: 'stacks/array_stack.c',
    header: 'stacks/array_stack.h',
    visual: 'array-stack',
    summary: 'Fixed-capacity stack in an array; top is the index of the last element (-1 when empty).',
    complexity: { space: 'O(capacity)' },
    operations: STACK_OPS,
    notes: [
      'Capacity is the compile-time constant ARRAY_STACK_CAPACITY (8). Pushing onto a full stack fails (overflow) instead of writing out of bounds.',
      'Pop only decrements top: the popped value stays in memory until it is overwritten. Slots above top are shown with the bytes they actually contain.',
    ],
  },
  {
    id: 'linked-stack',
    name: 'Dynamic Stack',
    module: 'stacks',
    source: 'stacks/linked_stack.c',
    header: 'stacks/linked_stack.h',
    visual: 'linked-stack',
    summary: 'Unbounded stack of malloc-allocated nodes linked from top to bottom.',
    complexity: { space: 'O(n)' },
    operations: STACK_OPS,
    notes: [
      'Push allocates one StackNode with malloc and links it in front of the current top; pop unlinks the top node and releases it with free.',
      'If malloc returns NULL, push returns false and leaves the stack unchanged. Use "Fail next malloc" to exercise that path.',
      'Addresses are real heap addresses of the C process (address-space randomization is disabled for reproducible replays).',
    ],
  },
  {
    id: 'array-queue',
    name: 'Static Queue',
    module: 'queues',
    source: 'queues/array_queue.c',
    header: 'queues/array_queue.h',
    visual: 'array-queue',
    summary: 'Linear queue in a fixed array with front and rear indices that only move forward.',
    complexity: { space: 'O(capacity)' },
    operations: QUEUE_OPS,
    notes: [
      'front indexes the first element and rear the next free slot; the queue is empty when front == rear.',
      'Slots before front are never reused: once rear reaches the capacity, enqueue fails even if dequeues freed space. The circular queue solves this.',
    ],
  },
  {
    id: 'circular-queue',
    name: 'Circular Queue',
    module: 'queues',
    source: 'queues/circular_queue.c',
    header: 'queues/circular_queue.h',
    visual: 'circular-queue',
    summary: 'Ring buffer: front and rear advance modulo the capacity, reusing freed slots.',
    complexity: { space: 'O(capacity)' },
    operations: QUEUE_OPS,
    notes: [
      'rear = (rear + 1) % CAPACITY wraps the index back to 0 after the last slot.',
      'front == rear holds both when the queue is empty and when it is full, so an explicit count disambiguates the two states.',
    ],
  },
  {
    id: 'linked-queue',
    name: 'Dynamic Queue',
    module: 'queues',
    source: 'queues/linked_queue.c',
    header: 'queues/linked_queue.h',
    visual: 'linked-queue',
    summary: 'Queue of malloc-allocated nodes with pointers to both ends.',
    complexity: { space: 'O(n)' },
    operations: QUEUE_OPS,
    notes: [
      'Keeping a rear pointer makes enqueue O(1): the new node is linked after rear without walking the list.',
      'When the last node is dequeued, rear must also be reset to NULL, otherwise it would dangle.',
    ],
  },
  {
    id: 'singly-linked-list',
    name: 'Singly Linked List',
    module: 'lists',
    source: 'lists/singly_linked_list.c',
    header: 'lists/singly_linked_list.h',
    visual: 'linked-list',
    summary: 'Nodes linked through next pointers, reachable from head.',
    complexity: { space: 'O(n)' },
    operations: listOps(['O(1)', 'O(n)']),
    notes: [
      'Without a tail pointer, insert_back walks the whole list to find the last node.',
      'Removal keeps a prev pointer one node behind current so the predecessor can be relinked; removing the head updates list->head instead.',
      'Indices are 0-based; insert_at accepts 0 ≤ index ≤ size.',
    ],
  },
  {
    id: 'doubly-linked-list',
    name: 'Doubly Linked List',
    module: 'lists',
    source: 'lists/doubly_linked_list.c',
    header: 'lists/doubly_linked_list.h',
    visual: 'linked-list',
    summary: 'Nodes with prev and next pointers; head and tail give O(1) access to both ends.',
    complexity: { space: 'O(n)' },
    operations: listOps(['O(1)', 'O(1)'], [
      { name: 'traverse_backward', label: 'Traverse backward', args: [], complexity: 'O(n)' },
    ]),
    notes: [
      'Every link is stored twice (a->next == b and b->prev == a); insertion and removal update up to four pointers.',
      'Once a node is found, unlinking it is O(1) because its predecessor is reachable through prev.',
    ],
  },
  {
    id: 'circular-linked-list',
    name: 'Circular Linked List',
    module: 'lists',
    source: 'lists/circular_linked_list.c',
    header: 'lists/circular_linked_list.h',
    visual: 'linked-list',
    summary: 'Singly linked ring addressed through its tail: tail->next is the head.',
    complexity: { space: 'O(n)' },
    operations: listOps(['O(1)', 'O(1)']),
    notes: [
      'Storing tail instead of head reaches both ends in O(1): insert_back is insert_front followed by advancing tail.',
      'A single node points to itself. Traversals stop after size nodes (or when the head is reached again) because no next pointer is NULL.',
    ],
  },
];

export function findAlgorithm(id: string): AlgorithmInfo | undefined {
  return ALGORITHMS.find((a) => a.id === id);
}

export function algorithmsOf(module: ModuleId): AlgorithmInfo[] {
  return ALGORITHMS.filter((a) => a.module === module);
}

export const SORTING_IDS = ALGORITHMS.filter((a) => a.module === 'sorting').map((a) => a.id);
export const STRUCTURE_LIMITS = { maxOperations: 200, maxNodes: 16, valueMin: -999, valueMax: 999 };
