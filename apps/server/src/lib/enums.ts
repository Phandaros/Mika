export const Role = {
  ADMIN: "ADMIN",
  COORDINATOR: "COORDINATOR",
  DESIGNER: "DESIGNER",
  INTERN: "INTERN"
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ProjectStatus = {
  ACTIVE: "ACTIVE",
  ON_HOLD: "ON_HOLD",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const DisciplineType = {
  HYDRAULIC: "HYDRAULIC",
  SANITARY: "SANITARY",
  FIRE_PROTECTION: "FIRE_PROTECTION",
  SPRINKLER: "SPRINKLER",
  PRESSURIZED_STAIR: "PRESSURIZED_STAIR",
  ELECTRICAL: "ELECTRICAL",
  SPDA: "SPDA",
  TELECOM: "TELECOM",
  HVAC: "HVAC",
  GAS: "GAS",
  AUTOMATION: "AUTOMATION",
  EXHAUST: "EXHAUST",
  VACUUM: "VACUUM",
  OTHER: "OTHER"
} as const;

export type DisciplineType = (typeof DisciplineType)[keyof typeof DisciplineType];

export const DisciplineStatus = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  IN_REVIEW: "IN_REVIEW",
  COMPLETED: "COMPLETED"
} as const;

export type DisciplineStatus = (typeof DisciplineStatus)[keyof typeof DisciplineStatus];

export const TaskStatus = {
  TODO: "TODO",
  ON_SCHEDULE: "ON_SCHEDULE",
  OVERDUE: "OVERDUE",
  IN_PROGRESS: "IN_PROGRESS",
  AWAITING_REVIEW: "AWAITING_REVIEW",
  IN_ANALYSIS: "IN_ANALYSIS",
  AWAITING_DEFINITION: "AWAITING_DEFINITION",
  FINISHED: "FINISHED"
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const Priority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT"
} as const;

export type Priority = (typeof Priority)[keyof typeof Priority];
