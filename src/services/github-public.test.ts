import { expect, it } from "vitest";
import { extractQueryTerms, scoreFileCandidate } from "./github-public";

it("extracts and expands query terms including technical translations", () => {
  const terms = extractQueryTerms("Bug fix rota harita tracking planlama");
  expect(terms).toContain("rota");
  expect(terms).toContain("route");
  expect(terms).toContain("harita");
  expect(terms).toContain("map");
  expect(terms).toContain("tracking");
});

it("ranks preferred analyst files with highest score", () => {
  const preferred = new Set(["components/RouteHistoryCard.tsx"]);
  const scorePreferred = scoreFileCandidate(
    "components/RouteHistoryCard.tsx",
    ["route"],
    preferred,
  );
  const scoreOther = scoreFileCandidate(
    "components/OtherCard.tsx",
    ["route"],
    new Set(),
  );
  expect(scorePreferred).toBeGreaterThan(scoreOther + 900);
});

it("boosts source code files over irrelevant config and docs", () => {
  const terms = ["route", "tracking"];
  const emptyPreferred = new Set<string>();

  const tsxScore = scoreFileCandidate(
    "components/RouteHistoryCard.tsx",
    terms,
    emptyPreferred,
  );
  const tsScore = scoreFileCandidate(
    "lib/gps-tracking.ts",
    terms,
    emptyPreferred,
  );
  const xcconfigScore = scoreFileCandidate(
    "ios/debug.xcconfig",
    terms,
    emptyPreferred,
  );
  const envScore = scoreFileCandidate(".env.example", terms, emptyPreferred);
  const gitignoreScore = scoreFileCandidate(
    ".gitignore",
    terms,
    emptyPreferred,
  );
  const readmeScore = scoreFileCandidate("README.md", terms, emptyPreferred);
  const docsScore = scoreFileCandidate("docs/GUIDE.md", terms, emptyPreferred);

  expect(tsxScore).toBeGreaterThan(0);
  expect(tsScore).toBeGreaterThan(0);
  expect(xcconfigScore).toBeLessThan(0);
  expect(envScore).toBeLessThan(0);
  expect(gitignoreScore).toBeLessThan(0);
  expect(readmeScore).toBeLessThan(0);
  expect(docsScore).toBeLessThan(0);

  expect(tsxScore).toBeGreaterThan(xcconfigScore + 100);
  expect(tsScore).toBeGreaterThan(readmeScore + 100);
});
