import { describe, expect, it } from "vitest";

import rawSeed from "./neetcode-150-list.json";
import { buildCatalogSeed } from "./seed-data";

type MutableRawCatalog = Record<
  string,
  Record<string, Record<string, unknown>>
>;

const authoritativeRawSeed: unknown = rawSeed;

function mutableCatalog(): MutableRawCatalog {
  return structuredClone(rawSeed) as MutableRawCatalog;
}

function firstProblem(
  catalog: MutableRawCatalog,
): [string, string, Record<string, unknown>] {
  const [groupName, group] = Object.entries(catalog)[0] ?? [];
  const [title, problem] = Object.entries(group ?? {})[0] ?? [];

  if (!groupName || !title || !problem) {
    throw new Error(
      "Expected the authoritative catalog fixture to be populated",
    );
  }

  return [groupName, title, problem];
}

describe("buildCatalogSeed", () => {
  it("maps the complete authoritative catalog deterministically", () => {
    const seed = buildCatalogSeed(authoritativeRawSeed);

    expect(seed.patterns).toHaveLength(18);
    expect(seed.prerequisites).toHaveLength(21);
    expect(seed.problems).toHaveLength(150);
    expect(seed.problemPatterns).toHaveLength(150);
    expect(
      seed.problems.filter(({ difficulty }) => difficulty === "easy"),
    ).toHaveLength(28);
    expect(
      seed.problems.filter(({ difficulty }) => difficulty === "medium"),
    ).toHaveLength(101);
    expect(
      seed.problems.filter(({ difficulty }) => difficulty === "hard"),
    ).toHaveLength(21);
    expect(new Set(seed.problems.map(({ title }) => title)).size).toBe(150);
    expect(new Set(seed.problems.map(({ url }) => url)).size).toBe(150);
    expect(
      seed.problems.find(({ title }) => title === "Contains Duplicate"),
    ).toMatchObject({
      number: null,
      difficulty: "easy",
      estimatedMinutes: 15,
      source: "neetcode-150",
    });
    expect(seed.groupAliases["1-D Dynamic Programming"]).toBe("1-d-dp");
    expect(seed.groupAliases["2-D Dynamic Programming"]).toBe("2-d-dp");
  });

  it("rejects a problem without a LeetCode URL", () => {
    const catalog = mutableCatalog();
    const [, , problem] = firstProblem(catalog);
    delete problem.url;

    expect(() => buildCatalogSeed(catalog)).toThrow();
  });

  it("rejects a problem without a NeetCode URL", () => {
    const catalog = mutableCatalog();
    const [, , problem] = firstProblem(catalog);
    delete problem.nurl;

    expect(() => buildCatalogSeed(catalog)).toThrow();
  });

  it("rejects an unknown group", () => {
    const catalog = mutableCatalog();
    const [groupName, group] = Object.entries(catalog)[0] ?? [];

    if (!groupName || !group) {
      throw new Error(
        "Expected the authoritative catalog fixture to be populated",
      );
    }

    delete catalog[groupName];
    catalog["Unknown Group"] = group;

    expect(() => buildCatalogSeed(catalog)).toThrow();
  });

  it("rejects duplicate problem titles", () => {
    const catalog = mutableCatalog();
    const groups = Object.values(catalog);
    const firstGroup = groups[0];
    const secondGroup = groups[1];
    const duplicateTitle = Object.keys(firstGroup ?? {})[0];
    const replacedTitle = Object.keys(secondGroup ?? {})[0];

    if (!firstGroup || !secondGroup || !duplicateTitle || !replacedTitle) {
      throw new Error("Expected at least two populated catalog groups");
    }

    secondGroup[duplicateTitle] = secondGroup[replacedTitle]!;
    delete secondGroup[replacedTitle];

    expect(() => buildCatalogSeed(catalog)).toThrow();
  });

  it("rejects duplicate LeetCode URLs", () => {
    const catalog = mutableCatalog();
    const groups = Object.values(catalog);
    const firstProblemRecord = Object.values(groups[0] ?? {})[0];
    const secondProblemRecord = Object.values(groups[1] ?? {})[0];

    if (!firstProblemRecord || !secondProblemRecord) {
      throw new Error("Expected at least two populated catalog groups");
    }

    secondProblemRecord.url = firstProblemRecord.url;

    expect(() => buildCatalogSeed(catalog)).toThrow();
  });

  it("rejects an unknown difficulty", () => {
    const catalog = mutableCatalog();
    const [, , problem] = firstProblem(catalog);
    problem.difficulty = "Legendary";

    expect(() => buildCatalogSeed(catalog)).toThrow();
  });

  it("rejects a catalog with fewer than 18 groups", () => {
    const catalog = mutableCatalog();
    const groupName = Object.keys(catalog)[0];

    if (!groupName) {
      throw new Error(
        "Expected the authoritative catalog fixture to be populated",
      );
    }

    delete catalog[groupName];

    expect(() => buildCatalogSeed(catalog)).toThrow();
  });

  it("rejects a catalog with fewer than 150 problems", () => {
    const catalog = mutableCatalog();
    const [groupName, title] = firstProblem(catalog);
    delete catalog[groupName]![title];

    expect(() => buildCatalogSeed(catalog)).toThrow();
  });
});
