export type RecommendationFactors =
  | Readonly<{
      kind: "due_review";
      patternName: string;
      problemTitle: string;
      reviewDate: string;
      sessionMinutes: number;
    }>
  | Readonly<{
      kind: "prerequisite_building";
      patternName: string;
      problemTitle: string;
      unlocksPatternNames: readonly string[];
      sessionMinutes: number;
    }>
  | Readonly<{
      kind: "continue_pattern";
      patternName: string;
      problemTitle: string;
      mastery: "learning" | "practicing";
      sessionMinutes: number;
    }>
  | Readonly<{
      kind: "next_pattern";
      patternName: string;
      problemTitle: string;
      sessionMinutes: number;
    }>;

function formatList(items: readonly string[]): string {
  if (items.length < 2) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

export function formatRecommendationReason(
  factors: RecommendationFactors,
): string {
  switch (factors.kind) {
    case "due_review":
      return `${factors.patternName} is due for review, and ${factors.problemTitle} fits your ${factors.sessionMinutes}-minute session.`;
    case "prerequisite_building":
      return `${factors.problemTitle} builds ${factors.patternName}, unlocking ${formatList(factors.unlocksPatternNames)}, and fits your ${factors.sessionMinutes}-minute session.`;
    case "continue_pattern":
      return `Continue ${factors.patternName} with ${factors.problemTitle} while it is ${factors.mastery}; it fits your ${factors.sessionMinutes}-minute session.`;
    case "next_pattern":
      return `${factors.problemTitle} starts your next roadmap pattern, ${factors.patternName}, and fits your ${factors.sessionMinutes}-minute session.`;
  }
}
