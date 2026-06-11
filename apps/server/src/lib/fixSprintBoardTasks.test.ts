import { describe, expect, it } from "vitest";
import {
  findBestProjectMatch,
  isSprintBoardProjectName,
  parseTitleProjectPrefix,
  scoreProjectMatch,
  type ProjectCandidate
} from "./fixSprintBoardTasks.js";

const candidates: ProjectCandidate[] = [
  { id: "1", asanaGid: "p1", name: "BRISA ATLÂNTICA", archived: false },
  { id: "2", asanaGid: "p2", name: "BRISA PARK", archived: false },
  { id: "3", asanaGid: "p3", name: "RESIDENCIAL MK TOWER", archived: false }
];

describe("isSprintBoardProjectName", () => {
  it("matches electrical sprint board project names", () => {
    expect(isSprintBoardProjectName("Elétrico - Sprint Board")).toBe(true);
    expect(isSprintBoardProjectName("ELETRICO - SPRINT BOARD")).toBe(true);
  });

  it("does not match civil sprint board", () => {
    expect(isSprintBoardProjectName("Civil - Sprint Board")).toBe(false);
  });
});

describe("parseTitleProjectPrefix", () => {
  it("extracts bracketed project prefix", () => {
    expect(parseTitleProjectPrefix("[Brisa Atlântico] - Estudo prévio")).toBe("Brisa Atlântico");
  });

  it("returns null when title has no prefix", () => {
    expect(parseTitleProjectPrefix("Estudo prévio")).toBeNull();
  });
});

describe("scoreProjectMatch", () => {
  it("scores close names highly", () => {
    const result = scoreProjectMatch("Brisa Atlântico", "BRISA ATLÂNTICA");
    expect(result.score).toBeGreaterThanOrEqual(0.85);
  });

  it("scores unrelated names low", () => {
    const result = scoreProjectMatch("Brisa Atlântico", "RESIDENCIAL MK TOWER");
    expect(result.score).toBeLessThan(0.85);
  });
});

describe("findBestProjectMatch", () => {
  it("matches brisa atlantico to brisa atlantica", () => {
    const result = findBestProjectMatch("Brisa Atlântico", candidates);
    expect(result.kind).toBe("match");

    if (result.kind === "match") {
      expect(result.match.project.name).toBe("BRISA ATLÂNTICA");
    }
  });

  it("returns none without prefix match candidates", () => {
    const result = findBestProjectMatch("Projeto Inexistente XYZ", candidates);
    expect(result.kind).toBe("none");
  });

  it("flags ambiguous matches when scores tie closely", () => {
    const ambiguousCandidates: ProjectCandidate[] = [
      { id: "1", asanaGid: "p1", name: "BRISA ATLÂNTICA", archived: false },
      { id: "2", asanaGid: "p2", name: "BRISA ATLANTICA", archived: false }
    ];

    const result = findBestProjectMatch("Brisa Atlântica", ambiguousCandidates);
    expect(result.kind).toBe("ambiguous");
  });
});
