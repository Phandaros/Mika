import type { PrismaClient } from "../generated/prisma/client.js";
import type { Prisma } from "../generated/prisma/client.js";
import {
  ELECTRICAL_SECTION,
  canonicalSectionForName,
  ensureCanonicalSectionsForProject,
  normalizeSectionName
} from "./canonicalSections.js";

export const TITLE_PREFIX_RE = /^\[([^\]]+)\]\s*-?\s*/;
const SPRINT_BOARD_PATTERN = /eletrico.*sprint.*board/;
const MATCH_THRESHOLD = 0.85;
const AMBIGUITY_DELTA = 0.03;

const STOPWORDS = new Set(["residencial", "cond", "condominio", "edificio", "torre", "bloco", "empreendimento"]);

export interface ProjectCandidate {
  id: string;
  asanaGid: string;
  name: string;
  archived: boolean;
}

export interface ProjectMatchScore {
  project: ProjectCandidate;
  score: number;
  reason: string;
}

export type ProjectMatchResult =
  | { kind: "match"; match: ProjectMatchScore }
  | { kind: "ambiguous"; candidates: ProjectMatchScore[] }
  | { kind: "none" };

export interface FixSprintBoardSummary {
  sprintBoardProject: string | null;
  alreadyCorrect: number;
  movedToRealProject: number;
  movedWithinSprintBoard: number;
  ambiguous: number;
  errors: number;
}

export function isSprintBoardProjectName(value: string | null | undefined): boolean {
  return SPRINT_BOARD_PATTERN.test(normalizeSectionName(value ?? ""));
}

export function isOtherSprintBoardProjectName(value: string | null | undefined): boolean {
  const normalized = normalizeSectionName(value ?? "");
  return normalized.includes("sprint") && normalized.includes("board");
}

export function parseTitleProjectPrefix(title: string): string | null {
  const match = TITLE_PREFIX_RE.exec(title.trim());
  if (!match?.[1]) {
    return null;
  }

  const prefix = match[1].trim();
  return prefix.length > 0 ? prefix : null;
}

function significantTokens(value: string): string[] {
  return normalizeSectionName(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row]![0] = row;
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0]![col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    const currentRow = matrix[row]!;
    const previousRow = matrix[row - 1]!;

    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      currentRow[col] = Math.min(
        previousRow[col]! + 1,
        currentRow[col - 1]! + 1,
        previousRow[col - 1]! + cost
      );
    }
  }

  return matrix[rows - 1]![cols - 1]!;
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) {
    return 1;
  }

  return 1 - levenshteinDistance(a, b) / maxLen;
}

function tokensMatchFuzzy(left: string, right: string): boolean {
  if (left === right) {
    return true;
  }

  const stemLeft = left.replace(/[oa]$/, "");
  const stemRight = right.replace(/[oa]$/, "");

  if (stemLeft.length >= 4 && stemLeft === stemRight) {
    return true;
  }

  return levenshteinSimilarity(left, right) >= 0.85;
}

export function scoreProjectMatch(prefix: string, projectName: string): { score: number; reason: string } {
  const normalizedPrefix = normalizeSectionName(prefix);
  const normalizedProject = normalizeSectionName(projectName);

  if (!normalizedPrefix || !normalizedProject) {
    return { score: 0, reason: "empty" };
  }

  const candidates: Array<{ score: number; reason: string }> = [];

  if (normalizedPrefix === normalizedProject) {
    candidates.push({ score: 1, reason: "exact" });
  }

  if (normalizedProject.includes(normalizedPrefix) || normalizedPrefix.includes(normalizedProject)) {
    candidates.push({ score: 0.95, reason: "contains" });
  }

  const prefixTokens = significantTokens(prefix);
  const projectTokens = significantTokens(projectName);

  if (prefixTokens.length > 0 && projectTokens.length > 0) {
    const overlap = prefixTokens.filter((token) => projectTokens.includes(token)).length;
    const denominator = Math.max(prefixTokens.length, projectTokens.length);
    const tokenScore = overlap / denominator;

    if (tokenScore >= 0.5) {
      candidates.push({ score: Math.min(0.9, 0.7 + tokenScore * 0.2), reason: `tokens(${overlap}/${denominator})` });
    }

    let fuzzyOverlap = 0;
    for (const prefixToken of prefixTokens) {
      if (projectTokens.some((projectToken) => tokensMatchFuzzy(prefixToken, projectToken))) {
        fuzzyOverlap += 1;
      }
    }

    const fuzzyDenominator = Math.max(prefixTokens.length, projectTokens.length);
    const fuzzyScore = fuzzyOverlap / fuzzyDenominator;

    if (fuzzyScore >= 0.5) {
      candidates.push({
        score: Math.min(0.95, 0.75 + fuzzyScore * 0.2),
        reason: `fuzzy-tokens(${fuzzyOverlap}/${fuzzyDenominator})`
      });
    }
  }

  const similarity = levenshteinSimilarity(normalizedPrefix, normalizedProject);
  candidates.push({ score: similarity, reason: `similarity(${similarity.toFixed(2)})` });

  return candidates.sort((left, right) => right.score - left.score)[0] ?? { score: 0, reason: "none" };
}

export function findBestProjectMatch(prefix: string, projects: ProjectCandidate[]): ProjectMatchResult {
  const scored = projects
    .map((project) => {
      const { score, reason } = scoreProjectMatch(prefix, project.name);
      return { project, score, reason };
    })
    .filter((item) => item.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { kind: "none" };
  }

  const best = scored[0];

  if (!best) {
    return { kind: "none" };
  }

  const tied = scored.filter((item) => Math.abs(item.score - best.score) <= AMBIGUITY_DELTA);

  if (tied.length > 1) {
    return { kind: "ambiguous", candidates: tied };
  }

  return { kind: "match", match: best };
}

type Tx = Prisma.TransactionClient;

interface MembershipRecord {
  id: string;
  taskId: string;
  projectGid: string | null;
  projectName: string | null;
  sectionGid: string | null;
  sectionName: string | null;
  task: { id: string; name: string };
  section: { id: string; asanaGid: string; name: string } | null;
}

async function getElectricalSection(tx: Tx, projectAsanaGid: string) {
  return tx.section.findFirst({
    where: { projectGid: projectAsanaGid, name: ELECTRICAL_SECTION.name },
    select: { id: true, asanaGid: true, name: true }
  });
}

async function moveMembershipToElectricalInProject(
  tx: Tx,
  membership: MembershipRecord,
  project: ProjectCandidate,
  electricalSection: { id: string; asanaGid: string; name: string }
): Promise<"updated" | "deduped"> {
  const duplicate = await tx.taskMembership.findFirst({
    where: {
      id: { not: membership.id },
      taskId: membership.taskId,
      projectGid: project.asanaGid,
      sectionGid: electricalSection.asanaGid
    },
    select: { id: true }
  });

  if (duplicate) {
    await tx.taskMembership.delete({ where: { id: membership.id } });
    return "deduped";
  }

  await tx.taskMembership.update({
    where: { id: membership.id },
    data: {
      projectGid: project.asanaGid,
      projectName: project.name,
      sectionGid: electricalSection.asanaGid,
      sectionName: electricalSection.name
    }
  });

  return "updated";
}

async function moveToRealProject(
  tx: Tx,
  membership: MembershipRecord,
  targetProject: ProjectCandidate,
  electricalSection: { id: string; asanaGid: string; name: string }
): Promise<"created" | "deduped"> {
  const duplicate = await tx.taskMembership.findFirst({
    where: {
      taskId: membership.taskId,
      projectGid: targetProject.asanaGid,
      sectionGid: electricalSection.asanaGid
    },
    select: { id: true }
  });

  await tx.taskMembership.delete({ where: { id: membership.id } });

  if (duplicate) {
    return "deduped";
  }

  await tx.taskMembership.create({
    data: {
      taskId: membership.taskId,
      projectGid: targetProject.asanaGid,
      projectName: targetProject.name,
      sectionGid: electricalSection.asanaGid,
      sectionName: electricalSection.name
    }
  });

  return "created";
}

function formatMembershipLocation(projectName: string | null | undefined, sectionName: string | null | undefined): string {
  if (!projectName) {
    return "—";
  }

  return sectionName ? `${projectName} / ${sectionName}` : projectName;
}

export async function runFixSprintBoardTasks(
  prisma: PrismaClient,
  options: { apply: boolean }
): Promise<FixSprintBoardSummary> {
  const summary: FixSprintBoardSummary = {
    sprintBoardProject: null,
    alreadyCorrect: 0,
    movedToRealProject: 0,
    movedWithinSprintBoard: 0,
    ambiguous: 0,
    errors: 0
  };

  const allProjects = await prisma.project.findMany({
    select: { id: true, asanaGid: true, name: true, archived: true }
  });

  const sprintBoardProject = allProjects.find((project) => isSprintBoardProjectName(project.name));

  if (!sprintBoardProject) {
    console.error('Projeto "Elétrico - Sprint Board" não encontrado no banco.');
    return summary;
  }

  summary.sprintBoardProject = sprintBoardProject.name;
  console.log(`Projeto Sprint Board: ${sprintBoardProject.name} (${sprintBoardProject.id})`);

  const candidateProjects = allProjects.filter(
    (project) =>
      project.id !== sprintBoardProject.id &&
      !project.archived &&
      !isOtherSprintBoardProjectName(project.name)
  );

  const memberships = await prisma.taskMembership.findMany({
    where: { projectGid: sprintBoardProject.asanaGid },
    include: {
      task: { select: { id: true, name: true } },
      section: { select: { id: true, asanaGid: true, name: true } }
    }
  });

  console.log(`Memberships no Sprint Board: ${memberships.length}`);

  for (const membership of memberships) {
    const sectionName = membership.sectionName ?? membership.section?.name ?? null;
    const electricalScope = canonicalSectionForName(sectionName)?.scope === "electrical";

    if (electricalScope) {
      summary.alreadyCorrect += 1;
      continue;
    }

    const prefix = parseTitleProjectPrefix(membership.task.name);
    const fromLabel = formatMembershipLocation(membership.projectName ?? sprintBoardProject.name, sectionName);
    const matchResult = prefix ? findBestProjectMatch(prefix, candidateProjects) : { kind: "none" as const };

    if (matchResult.kind === "ambiguous") {
      summary.ambiguous += 1;
      console.log(`[${membership.task.id}] "${membership.task.name}"`);
      console.log(`  de: ${fromLabel}`);
      console.log(
        `  AMBÍGUO — candidatos: ${matchResult.candidates
          .map((item) => `${item.project.name} (${item.score.toFixed(2)}, ${item.reason})`)
          .join(", ")}`
      );
      continue;
    }

    const targetProject = matchResult.kind === "match" ? matchResult.match.project : sprintBoardProject;
    const matchReason = matchResult.kind === "match" ? `${matchResult.match.reason} ${matchResult.match.score.toFixed(2)}` : "fallback";

    console.log(`[${membership.task.id}] "${membership.task.name}"`);
    console.log(`  de: ${fromLabel}`);
    console.log(`  para: ${targetProject.name} / ${ELECTRICAL_SECTION.name} (${matchReason})`);

    if (!options.apply) {
      if (matchResult.kind === "match") {
        summary.movedToRealProject += 1;
      } else {
        summary.movedWithinSprintBoard += 1;
      }
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await ensureCanonicalSectionsForProject(tx, targetProject);
        const electricalSection = await getElectricalSection(tx, targetProject.asanaGid);

        if (!electricalSection) {
          throw new Error(`Seção Elétrico não encontrada em ${targetProject.name}`);
        }

        if (matchResult.kind === "match") {
          await moveToRealProject(tx, membership, targetProject, electricalSection);
          summary.movedToRealProject += 1;
          return;
        }

        await moveMembershipToElectricalInProject(tx, membership, sprintBoardProject, electricalSection);
        summary.movedWithinSprintBoard += 1;
      });
    } catch (error) {
      summary.errors += 1;
      console.error(`  ERRO: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return summary;
}

export function printFixSprintBoardSummary(summary: FixSprintBoardSummary, apply: boolean): void {
  console.log(
    [
      apply ? "[apply] " : "[dry-run] ",
      `Projeto Sprint Board: ${summary.sprintBoardProject ?? "não encontrado"}`,
      `Já corretas: ${summary.alreadyCorrect}`,
      `Mover para projeto real: ${summary.movedToRealProject}`,
      `Fallback Sprint Board / Elétrico: ${summary.movedWithinSprintBoard}`,
      `Ambíguas (não aplicadas): ${summary.ambiguous}`,
      `Erros: ${summary.errors}`
    ].join("\n")
  );
}
