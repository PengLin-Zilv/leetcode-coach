export const PATTERN_DEFINITIONS = [
  { name: "Arrays & Hashing", slug: "arrays-hashing", prerequisites: [] },
  {
    name: "Two Pointers",
    slug: "two-pointers",
    prerequisites: ["arrays-hashing"],
  },
  { name: "Stack", slug: "stack", prerequisites: ["arrays-hashing"] },
  {
    name: "Binary Search",
    slug: "binary-search",
    prerequisites: ["two-pointers"],
  },
  {
    name: "Sliding Window",
    slug: "sliding-window",
    prerequisites: ["two-pointers"],
  },
  { name: "Linked List", slug: "linked-list", prerequisites: ["two-pointers"] },
  {
    name: "Trees",
    slug: "trees",
    prerequisites: ["binary-search", "linked-list"],
  },
  { name: "Tries", slug: "tries", prerequisites: ["trees"] },
  {
    name: "Heap / Priority Queue",
    slug: "heap-priority-queue",
    prerequisites: ["trees"],
  },
  { name: "Backtracking", slug: "backtracking", prerequisites: ["trees"] },
  {
    name: "Intervals",
    slug: "intervals",
    prerequisites: ["heap-priority-queue"],
  },
  { name: "Greedy", slug: "greedy", prerequisites: ["heap-priority-queue"] },
  {
    name: "Advanced Graphs",
    slug: "advanced-graphs",
    prerequisites: ["heap-priority-queue", "graphs"],
  },
  { name: "Graphs", slug: "graphs", prerequisites: ["backtracking"] },
  { name: "1-D DP", slug: "1-d-dp", prerequisites: ["backtracking"] },
  { name: "2-D DP", slug: "2-d-dp", prerequisites: ["graphs", "1-d-dp"] },
  {
    name: "Bit Manipulation",
    slug: "bit-manipulation",
    prerequisites: ["1-d-dp"],
  },
  {
    name: "Math & Geometry",
    slug: "math-geometry",
    prerequisites: ["2-d-dp", "bit-manipulation"],
  },
] as const;

export const ESTIMATED_MINUTES = {
  easy: 15,
  medium: 30,
  hard: 45,
} as const;

export type PatternSlug = (typeof PATTERN_DEFINITIONS)[number]["slug"];
