import type { TaskStatus } from "./enums.js";

export type IndicatorPeriod = "month" | "year" | "all";
export type IndicatorScope = "general" | "civil" | "electrical";
export type IndicatorPortfolioYear = "all" | `${number}`;

export interface IndicatorValuePoint {
  key: string;
  label: string;
  value: number;
}

export interface IndicatorStatusPoint {
  status: TaskStatus;
  label: string;
  value: number;
}

export interface IndicatorUserPoint {
  userId: string | null;
  userName: string;
  initials: string;
  openTasks: number;
  completedTasks: number;
  overdueTasks: number;
  estimatedDays: number;
}

export interface IndicatorScopePoint {
  scope: IndicatorScope;
  label: string;
  openTasks: number;
  completedTasks: number;
  overdueTasks: number;
  estimatedDays: number;
}

export interface IndicatorTaskKpis {
  openTasks: number;
  completedTasks: number;
  overdueTasks: number;
  dueTasks: number;
  onTimeRate: number;
}

export interface IndicatorPortfolioKpis {
  totalProjects: number;
  cadProjects: number;
  bimProjects: number;
  areaM2: number;
  projectedAreaM2: number;
}

export interface IndicatorPortfolioStatusGroup {
  fieldKey: string;
  label: string;
  values: IndicatorValuePoint[];
}

export interface IndicatorTasksSection {
  kpis: IndicatorTaskKpis;
  statusDistribution: IndicatorStatusPoint[];
  byUser: IndicatorUserPoint[];
  overdueByUser: IndicatorUserPoint[];
}

export interface IndicatorPortfolioSection {
  kpis: IndicatorPortfolioKpis;
  byPlatform: IndicatorValuePoint[];
  byDiscipline: IndicatorValuePoint[];
  projectedAreaByDiscipline: IndicatorValuePoint[];
  statusGroups: IndicatorPortfolioStatusGroup[];
}

export interface IndicatorTeamSection {
  byScope: IndicatorScopePoint[];
  byUser: IndicatorUserPoint[];
}

export interface IndicatorsResponse {
  period: IndicatorPeriod;
  scope: IndicatorScope;
  portfolioYear: IndicatorPortfolioYear;
  availablePortfolioYears: string[];
  periodLabel: string;
  generatedAt: string;
  tasks: IndicatorTasksSection;
  portfolio: IndicatorPortfolioSection;
  team: IndicatorTeamSection;
}
