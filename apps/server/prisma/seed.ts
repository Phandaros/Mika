import bcrypt from "bcrypt";
import { DEFAULT_DISCIPLINES } from "../../../packages/shared/src/index.ts";
import { prisma } from "../src/lib/prisma.js";
import { DisciplineStatus, Priority, ProjectStatus, Role, TaskStatus } from "../src/lib/enums.js";

const adminId = "seed-admin";
const projectId = "seed-project-mk-tower";
const disciplineIds = ["seed-discipline-hydraulic", "seed-discipline-sanitary", "seed-discipline-fire"];

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "admin@mkengenharia.eng.br" },
    update: {
      name: "Administrador MK",
      passwordHash,
      role: Role.ADMIN,
      isActive: true
    },
    create: {
      id: adminId,
      name: "Administrador MK",
      email: "admin@mkengenharia.eng.br",
      passwordHash,
      role: Role.ADMIN,
      isActive: true
    }
  });

  await prisma.project.upsert({
    where: { id: projectId },
    update: {
      name: "Residencial MK Tower",
      description: "Projeto exemplo para validacao do fluxo Projeto > Disciplina > Tarefa.",
      client: "MK Engenharia",
      status: ProjectStatus.ACTIVE
    },
    create: {
      id: projectId,
      name: "Residencial MK Tower",
      description: "Projeto exemplo para validacao do fluxo Projeto > Disciplina > Tarefa.",
      client: "MK Engenharia",
      status: ProjectStatus.ACTIVE,
      startDate: new Date()
    }
  });

  const selectedDisciplines = DEFAULT_DISCIPLINES.slice(0, 3);

  for (const [index, discipline] of selectedDisciplines.entries()) {
    await prisma.discipline.upsert({
      where: { id: disciplineIds[index] },
      update: {
        name: discipline.name,
        type: discipline.type,
        status: index === 0 ? DisciplineStatus.IN_PROGRESS : DisciplineStatus.NOT_STARTED,
        responsibleId: adminId
      },
      create: {
        id: disciplineIds[index],
        projectId,
        name: discipline.name,
        type: discipline.type,
        status: index === 0 ? DisciplineStatus.IN_PROGRESS : DisciplineStatus.NOT_STARTED,
        responsibleId: adminId
      }
    });
  }

  const tasks = [
    {
      id: "seed-task-01",
      disciplineId: disciplineIds[0],
      title: "Levantar pontos de agua fria",
      status: TaskStatus.BACKLOG,
      priority: Priority.MEDIUM
    },
    {
      id: "seed-task-02",
      disciplineId: disciplineIds[0],
      title: "Compatibilizar shaft hidraulico",
      status: TaskStatus.TODO,
      priority: Priority.HIGH
    },
    {
      id: "seed-task-03",
      disciplineId: disciplineIds[1],
      title: "Revisar prumadas sanitarias",
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.URGENT
    },
    {
      id: "seed-task-04",
      disciplineId: disciplineIds[2],
      title: "Conferir memorial PPCI",
      status: TaskStatus.IN_REVIEW,
      priority: Priority.HIGH
    },
    {
      id: "seed-task-05",
      disciplineId: disciplineIds[2],
      title: "Enviar prancha de sprinklers",
      status: TaskStatus.DONE,
      priority: Priority.LOW
    }
  ];

  for (const task of tasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigneeId: adminId,
        completedAt: task.status === TaskStatus.DONE ? new Date() : null
      },
      create: {
        id: task.id,
        disciplineId: task.disciplineId,
        title: task.title,
        description: "Tarefa exemplo criada pelo seed inicial.",
        status: task.status,
        priority: task.priority,
        assigneeId: adminId,
        creatorId: adminId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        completedAt: task.status === TaskStatus.DONE ? new Date() : null
      }
    });
  }

  console.log("Seed concluido: admin@mkengenharia.eng.br / admin123");
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
