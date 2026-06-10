import type { Prisma } from "../generated/prisma/client.js";
import type { RequestHandler } from "express";
import type { WeeklyReportStatus } from "shared";
import { z } from "zod";
import { taskInclude, toPublicUser, userSelect } from "../lib/asanaDto.js";
import { Role } from "../lib/enums.js";
import { hasMinimumRole } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  buildTaskSnapshot,
  createWeeklyReportForUser,
  isReportEligibleRole,
  REPORT_ELIGIBLE_ROLES,
  type TaskSnapshot
} from "../lib/weeklyReportTasks.js";
import { getCurrentWeekEnd, getCurrentWeekStart, getWeekStart } from "../lib/weekUtils.js";
import { AppError } from "../middleware/errorHandler.js";
import { getAuthUser } from "../middleware/auth.js";

const reportStatusValues = ["PENDING", "SUBMITTED", "LATE"] as const;

const listReportsQuerySchema = z.object({
  userId: z.string().optional(),
  weekStart: z.string().datetime().optional(),
  status: z.enum(reportStatusValues).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(25)
});

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(25)
});

const updateItemSchema = z.object({
  comment: z.string().max(2000)
});

const weeklyReportInclude = {
  user: { select: userSelect },
  items: {
    include: {
      task: { include: taskInclude }
    },
    orderBy: { createdAt: "asc" as const }
  }
} satisfies Prisma.WeeklyReportInclude;

type WeeklyReportRecord = Prisma.WeeklyReportGetPayload<{ include: typeof weeklyReportInclude }>;

function parseSnapshot(value: Prisma.JsonValue | null | undefined): TaskSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.title !== "string") {
    return null;
  }

  return {
    title: record.title,
    status: typeof record.status === "string" ? record.status : "",
    projectName: typeof record.projectName === "string" ? record.projectName : "",
    sectionName: typeof record.sectionName === "string" ? record.sectionName : ""
  };
}

function toItemDto(item: WeeklyReportRecord["items"][number], useSnapshot: boolean) {
  const snapshot = parseSnapshot(item.taskSnapshot);

  if (useSnapshot && snapshot) {
    return {
      id: item.id,
      taskId: item.taskId,
      taskTitle: snapshot.title,
      taskStatus: snapshot.status,
      projectName: snapshot.projectName,
      sectionName: snapshot.sectionName,
      comment: item.comment
    };
  }

  const live = buildTaskSnapshot(item.task);

  return {
    id: item.id,
    taskId: item.taskId,
    taskTitle: live.title,
    taskStatus: live.status,
    projectName: live.projectName,
    sectionName: live.sectionName,
    comment: item.comment
  };
}

function toReportDto(report: WeeklyReportRecord) {
  const publicUser = toPublicUser(report.user);
  const useSnapshot = report.status === "SUBMITTED";

  return {
    id: report.id,
    userId: report.userId,
    userName: publicUser?.name ?? "",
    userAvatarUrl: publicUser?.avatarUrl ?? undefined,
    weekStart: report.weekStart.toISOString(),
    weekEnd: report.weekEnd.toISOString(),
    status: report.status as WeeklyReportStatus,
    submittedAt: report.submittedAt?.toISOString(),
    items: report.items.map((item) => toItemDto(item, useSnapshot))
  };
}

function toSummaryDto(report: Prisma.WeeklyReportGetPayload<{ include: { user: { select: typeof userSelect } }; select: { _count: { select: { items: true } } } }>) {
  return {
    id: report.id,
    userId: report.userId,
    userName: toPublicUser(report.user)?.name ?? "",
    weekStart: report.weekStart.toISOString(),
    status: report.status as WeeklyReportStatus,
    submittedAt: report.submittedAt?.toISOString(),
    itemCount: report._count.items
  };
}

async function loadReportById(id: string): Promise<WeeklyReportRecord | null> {
  return prisma.weeklyReport.findUnique({
    where: { id },
    include: weeklyReportInclude
  });
}

function assertReportOwner(report: { userId: string }, authUserId: string): void {
  if (report.userId !== authUserId) {
    throw new AppError(403, "Acesso negado ao relatório");
  }
}

async function buildSummaryStats(weekStart: Date) {
  const [expected, submitted, late, pending] = await Promise.all([
    prisma.user.count({
      where: {
        isActive: true,
        role: { in: [...REPORT_ELIGIBLE_ROLES] }
      }
    }),
    prisma.weeklyReport.count({
      where: { weekStart, status: "SUBMITTED" }
    }),
    prisma.weeklyReport.count({
      where: { weekStart, status: "LATE" }
    }),
    prisma.weeklyReport.count({
      where: { weekStart, status: "PENDING" }
    })
  ]);

  return {
    expected,
    submitted,
    late,
    pending,
    submissionRate: expected > 0 ? Math.round((submitted / expected) * 100) : 0
  };
}

export const listReports: RequestHandler = async (req, res, next) => {
  try {
    const parsed = listReportsQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new AppError(400, "Parâmetros de relatório inválidos", parsed.error.flatten());
    }

    const { userId, status, page, limit } = parsed.data;
    const weekStart = parsed.data.weekStart
      ? getWeekStart(new Date(parsed.data.weekStart))
      : getCurrentWeekStart();

    const where: Prisma.WeeklyReportWhereInput = {
      weekStart,
      ...(userId ? { userId } : {}),
      ...(status ? { status } : {})
    };

    const [total, reports, summary] = await Promise.all([
      prisma.weeklyReport.count({ where }),
      prisma.weeklyReport.findMany({
        where,
        include: {
          user: { select: userSelect },
          _count: { select: { items: true } }
        },
        orderBy: [{ submittedAt: "desc" }, { user: { name: "asc" } }],
        skip: (page - 1) * limit,
        take: limit
      }),
      buildSummaryStats(weekStart)
    ]);

    res.json({
      reports: reports.map((report) => toSummaryDto(report)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      summary
    });
  } catch (error) {
    next(error);
  }
};

export const getReport: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthUser(req);
    const reportId = req.params.id;

    if (!reportId) {
      throw new AppError(400, "ID do relatório é obrigatório");
    }

    const report = await loadReportById(reportId);

    if (!report) {
      throw new AppError(404, "Relatório não encontrado");
    }

    const isOwner = report.userId === authUser.id;
    const isCoordinator = hasMinimumRole(authUser.role, Role.COORDINATOR);

    if (!isOwner && !isCoordinator) {
      throw new AppError(403, "Acesso negado ao relatório");
    }

    res.json({ report: toReportDto(report) });
  } catch (error) {
    next(error);
  }
};

export const getMyReport: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthUser(req);

    if (!isReportEligibleRole(authUser.role)) {
      throw new AppError(403, "Relatórios semanais são destinados a projetistas");
    }

    const weekStart = getCurrentWeekStart();
    const weekEnd = getCurrentWeekEnd();

    await createWeeklyReportForUser(authUser.id, weekStart, weekEnd);

    const report = await prisma.weeklyReport.findUnique({
      where: {
        userId_weekStart: {
          userId: authUser.id,
          weekStart
        }
      },
      include: weeklyReportInclude
    });

    if (!report) {
      throw new AppError(500, "Não foi possível carregar o relatório semanal");
    }

    res.json({ report: toReportDto(report) });
  } catch (error) {
    next(error);
  }
};

export const getMyHistory: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthUser(req);
    const parsed = historyQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw new AppError(400, "Parâmetros de histórico inválidos", parsed.error.flatten());
    }

    const { page, limit } = parsed.data;
    const where = { userId: authUser.id };

    const [total, reports] = await Promise.all([
      prisma.weeklyReport.count({ where }),
      prisma.weeklyReport.findMany({
        where,
        include: {
          user: { select: userSelect },
          _count: { select: { items: true } }
        },
        orderBy: { weekStart: "desc" },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    res.json({
      reports: reports.map((report) => toSummaryDto(report)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
};

export const updateItem: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthUser(req);
    const parsed = updateItemSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(400, "Comentário inválido", parsed.error.flatten());
    }

    const report = await prisma.weeklyReport.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          where: { id: req.params.itemId },
          include: { task: { include: taskInclude } }
        }
      }
    });

    if (!report) {
      throw new AppError(404, "Relatório não encontrado");
    }

    assertReportOwner(report, authUser.id);

    if (report.status === "SUBMITTED") {
      throw new AppError(400, "Relatório já enviado e não pode ser editado");
    }

    const item = report.items[0];

    if (!item) {
      throw new AppError(404, "Item do relatório não encontrado");
    }

    const updated = await prisma.weeklyReportItem.update({
      where: { id: item.id },
      data: { comment: parsed.data.comment },
      include: { task: { include: taskInclude } }
    });

    res.json({
      item: toItemDto(
        {
          ...updated,
          task: updated.task
        } as WeeklyReportRecord["items"][number],
        false
      )
    });
  } catch (error) {
    next(error);
  }
};

export const submitReport: RequestHandler = async (req, res, next) => {
  try {
    const authUser = getAuthUser(req);

    const reportId = req.params.id;

    if (!reportId) {
      throw new AppError(400, "ID do relatório é obrigatório");
    }

    const report = await loadReportById(reportId);

    if (!report) {
      throw new AppError(404, "Relatório não encontrado");
    }

    assertReportOwner(report, authUser.id);

    if (report.status === "SUBMITTED") {
      throw new AppError(400, "Relatório já foi enviado");
    }

    if (report.items.length === 0) {
      throw new AppError(400, "Não há tarefas para enviar no relatório");
    }

    const hasEmptyComment = report.items.some((item) => item.comment.trim().length === 0);

    if (hasEmptyComment) {
      throw new AppError(400, "Preencha o comentário de todas as tarefas antes de enviar");
    }

    await prisma.$transaction(
      report.items.map((item) =>
        prisma.weeklyReportItem.update({
          where: { id: item.id },
          data: {
            taskSnapshot: buildTaskSnapshot(item.task) as unknown as Prisma.InputJsonValue
          }
        })
      )
    );

    const submitted = await prisma.weeklyReport.update({
      where: { id: report.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date()
      },
      include: weeklyReportInclude
    });

    res.json({ report: toReportDto(submitted) });
  } catch (error) {
    next(error);
  }
};
