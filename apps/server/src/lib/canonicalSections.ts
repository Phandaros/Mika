import type { PrismaClient } from "../generated/prisma/client.js";
import type { Prisma } from "../generated/prisma/client.js";
import { DisciplineType, type DisciplineType as DisciplineTypeValue } from "./enums.js";
import { makeLocalAsanaGid } from "./asanaDto.js";

export type CanonicalSectionScope = "civil" | "electrical";

export interface CanonicalSection {
  scope: CanonicalSectionScope;
  name: string;
  type: DisciplineTypeValue;
}

export const CIVIL_SECTION: CanonicalSection = { scope: "civil", name: "Civil", type: DisciplineType.OTHER };
export const ELECTRICAL_SECTION: CanonicalSection = { scope: "electrical", name: "Elétrico", type: DisciplineType.ELECTRICAL };
export const CANONICAL_SECTIONS: readonly CanonicalSection[] = [CIVIL_SECTION, ELECTRICAL_SECTION];

type Tx = Prisma.TransactionClient;

interface ProjectLike {
  id?: string;
  asanaGid: string;
  name: string;
}

interface SectionLike {
  id: string;
  asanaGid: string;
  name: string;
  projectGid: string;
}

interface NormalizationSummary {
  projectsChecked: number;
  sectionsCreated: number;
  sectionsRenamed: number;
  sectionsRemoved: number;
  membershipsMoved: number;
  membershipsDeduped: number;
  uncertainSections: Array<{ project: string; section: string; movedTo: string }>;
}

function emptySummary(): NormalizationSummary {
  return {
    projectsChecked: 0,
    sectionsCreated: 0,
    sectionsRenamed: 0,
    sectionsRemoved: 0,
    membershipsMoved: 0,
    membershipsDeduped: 0,
    uncertainSections: []
  };
}

function mergeSummary(target: NormalizationSummary, source: NormalizationSummary): NormalizationSummary {
  target.projectsChecked += source.projectsChecked;
  target.sectionsCreated += source.sectionsCreated;
  target.sectionsRenamed += source.sectionsRenamed;
  target.sectionsRemoved += source.sectionsRemoved;
  target.membershipsMoved += source.membershipsMoved;
  target.membershipsDeduped += source.membershipsDeduped;
  target.uncertainSections.push(...source.uncertainSections);
  return target;
}

export function normalizeSectionName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export function canonicalSectionForName(value: string | null | undefined): CanonicalSection | null {
  const normalized = normalizeSectionName(value ?? "");

  if (normalized === "civil") {
    return CIVIL_SECTION;
  }

  if (normalized === "eletrico") {
    return ELECTRICAL_SECTION;
  }

  return null;
}

export function inferCanonicalSection(value: string | null | undefined): { section: CanonicalSection; uncertain: boolean } {
  const normalized = normalizeSectionName(value ?? "");
  const electrical = /(eletric|spda|telecom|automac|ilumin|subest|cabine|forca|energia|lumin)/.test(normalized);

  if (electrical) {
    return { section: ELECTRICAL_SECTION, uncertain: false };
  }

  const civil =
    /(civil|hidrau|sanit|ppc|sprinkler|pressuriz|gas|climat|exaust|vacuo|hvac|bim|estrutur|drenag|arquiteton|estudo preliminar|backlog|tarefas|task)/.test(
      normalized
    );

  return { section: CIVIL_SECTION, uncertain: !civil };
}

export function sectionMatchesCanonicalScope(
  sectionName: string | null | undefined,
  scope: CanonicalSectionScope | "general"
): boolean {
  if (scope === "general") {
    return true;
  }

  const canonical = canonicalSectionForName(sectionName);
  return canonical?.scope === scope;
}

export function isCanonicalSectionName(value: string | null | undefined): boolean {
  return canonicalSectionForName(value) !== null;
}

async function ensureCanonicalSection(
  tx: Tx,
  project: ProjectLike,
  canonical: CanonicalSection,
  sections: SectionLike[],
  summary: NormalizationSummary
): Promise<SectionLike> {
  const existing = sections.find((section) => canonicalSectionForName(section.name)?.scope === canonical.scope);

  if (existing) {
    if (existing.name !== canonical.name) {
      const updated = await tx.section.update({
        where: { id: existing.id },
        data: { name: canonical.name }
      });
      summary.sectionsRenamed += 1;
      return updated;
    }

    return existing;
  }

  const created = await tx.section.create({
    data: {
      asanaGid: makeLocalAsanaGid("section"),
      projectGid: project.asanaGid,
      name: canonical.name
    }
  });
  summary.sectionsCreated += 1;
  sections.push(created);
  return created;
}

async function moveMembershipToSection(
  tx: Tx,
  membership: { id: string; taskId: string; projectGid: string | null },
  project: ProjectLike,
  target: SectionLike,
  summary: NormalizationSummary
): Promise<void> {
  const duplicate = await tx.taskMembership.findFirst({
    where: {
      id: { not: membership.id },
      taskId: membership.taskId,
      projectGid: project.asanaGid,
      sectionGid: target.asanaGid
    },
    select: { id: true }
  });

  if (duplicate) {
    await tx.taskMembership.delete({ where: { id: membership.id } });
    summary.membershipsDeduped += 1;
    return;
  }

  await tx.taskMembership.update({
    where: { id: membership.id },
    data: {
      projectGid: project.asanaGid,
      projectName: project.name,
      sectionGid: target.asanaGid,
      sectionName: target.name
    }
  });
  summary.membershipsMoved += 1;
}

export async function ensureCanonicalSectionsForProject(tx: Tx, project: ProjectLike): Promise<NormalizationSummary> {
  const summary = emptySummary();
  summary.projectsChecked = 1;

  const sections = await tx.section.findMany({
    where: { projectGid: project.asanaGid },
    select: { id: true, asanaGid: true, name: true, projectGid: true }
  });

  const civil = await ensureCanonicalSection(tx, project, CIVIL_SECTION, sections, summary);
  const electrical = await ensureCanonicalSection(tx, project, ELECTRICAL_SECTION, sections, summary);
  const targetByScope: Record<CanonicalSectionScope, SectionLike> = {
    civil,
    electrical
  };
  const canonicalIds = new Set([civil.id, electrical.id]);
  const extraSections = sections.filter((section) => !canonicalIds.has(section.id));

  for (const section of extraSections) {
    const inferred = inferCanonicalSection(section.name);
    const target = targetByScope[inferred.section.scope];
    const memberships = await tx.taskMembership.findMany({
      where: { sectionGid: section.asanaGid },
      select: { id: true, taskId: true, projectGid: true }
    });

    for (const membership of memberships) {
      await moveMembershipToSection(tx, membership, project, target, summary);
    }

    if (inferred.uncertain) {
      summary.uncertainSections.push({ project: project.name, section: section.name, movedTo: target.name });
    }

    await tx.section.delete({ where: { id: section.id } });
    summary.sectionsRemoved += 1;
  }

  const looseMemberships = await tx.taskMembership.findMany({
    where: {
      projectGid: project.asanaGid,
      sectionGid: null
    },
    select: { id: true, taskId: true, projectGid: true }
  });

  for (const membership of looseMemberships) {
    await moveMembershipToSection(tx, membership, project, civil, summary);
  }

  return summary;
}

export async function normalizeAllProjectSections(prisma: PrismaClient): Promise<void> {
  const projects = await prisma.project.findMany({
    select: { id: true, asanaGid: true, name: true },
    orderBy: { name: "asc" }
  });
  const summary = emptySummary();

  for (const project of projects) {
    const projectSummary = await prisma.$transaction((tx) => ensureCanonicalSectionsForProject(tx, project));
    mergeSummary(summary, projectSummary);
  }

  if (
    summary.sectionsCreated === 0 &&
    summary.sectionsRenamed === 0 &&
    summary.sectionsRemoved === 0 &&
    summary.membershipsMoved === 0 &&
    summary.membershipsDeduped === 0
  ) {
    return;
  }

  console.log(
    [
      `Seções canônicas: ${summary.projectsChecked} projetos verificados`,
      `${summary.sectionsCreated} seções criadas`,
      `${summary.sectionsRenamed} renomeadas`,
      `${summary.sectionsRemoved} removidas`,
      `${summary.membershipsMoved} vínculos movidos`,
      `${summary.membershipsDeduped} vínculos duplicados removidos`
    ].join("; ")
  );

  for (const item of summary.uncertainSections) {
    console.log(`Seção incerta movida para ${item.movedTo}: ${item.project} / ${item.section}`);
  }
}
