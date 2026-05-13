import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma.js";
import { makeLocalAsanaGid } from "../src/lib/asanaDto.js";
import { Priority, Role, TaskStatus } from "../src/lib/enums.js";

const ADMIN_EMAIL = "admin@mkengenharia.eng.br";

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash("admin123", 10);

  let workspace = await prisma.asanaWorkspace.findFirst();
  if (!workspace) {
    workspace = await prisma.asanaWorkspace.create({
      data: {
        asanaGid: makeLocalAsanaGid("workspace"),
        name: "MK Engenharia",
        resourceType: "workspace"
      }
    });
  }

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: "Administrador MK",
      passwordHash,
      role: Role.ADMIN,
      isActive: true
    },
    create: {
      email: ADMIN_EMAIL,
      name: "Administrador MK",
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      asanaGid: makeLocalAsanaGid("user")
    }
  });

  const projectCount = await prisma.project.count();
  if (projectCount > 0 || !admin.asanaGid) {
    console.log("Seed: admin garantido; projetos ja existem — pulando demo.");
    return;
  }

  const project = await prisma.project.create({
    data: {
      asanaGid: makeLocalAsanaGid("project"),
      name: "Residencial MK Tower (demo)",
      notes: "Projeto exemplo do seed (schema Asana).",
      workspaceGid: workspace.asanaGid,
      ownerGid: admin.asanaGid
    }
  });

  const sectionNames = ["Backlog", "Em andamento", "Concluido"];
  const sections: { id: string; asanaGid: string; name: string }[] = [];

  for (const name of sectionNames) {
    const section = await prisma.section.create({
      data: {
        asanaGid: makeLocalAsanaGid("section"),
        name,
        projectGid: project.asanaGid
      }
    });
    sections.push({ id: section.id, asanaGid: section.asanaGid, name: section.name });
  }

  const demoTasks: Array<{ name: string; status: string; priority: string; sectionIdx: number }> = [
    { name: "Levantar pontos de agua fria", status: TaskStatus.BACKLOG, priority: Priority.MEDIUM, sectionIdx: 0 },
    { name: "Compatibilizar shaft hidraulico", status: TaskStatus.TODO, priority: Priority.HIGH, sectionIdx: 0 },
    { name: "Revisar prumadas sanitarias", status: TaskStatus.IN_PROGRESS, priority: Priority.URGENT, sectionIdx: 1 },
    { name: "Conferir memorial PPCI", status: TaskStatus.IN_REVIEW, priority: Priority.HIGH, sectionIdx: 1 },
    { name: "Enviar prancha de sprinklers", status: TaskStatus.DONE, priority: Priority.LOW, sectionIdx: 2 }
  ];

  for (const row of demoTasks) {
    const sec = sections[row.sectionIdx];
    if (!sec) {
      continue;
    }

    const task = await prisma.task.create({
      data: {
        asanaGid: makeLocalAsanaGid("task"),
        name: row.name,
        notes: "Tarefa exemplo criada pelo seed.",
        localStatus: row.status,
        priority: row.priority,
        assigneeGid: admin.asanaGid,
        completed: row.status === TaskStatus.DONE,
        completedAtAsana: row.status === TaskStatus.DONE ? new Date() : null
      }
    });

    await prisma.taskMembership.create({
      data: {
        taskId: task.id,
        projectGid: project.asanaGid,
        projectName: project.name,
        sectionGid: sec.asanaGid,
        sectionName: sec.name
      }
    });
  }

  console.log(`Seed concluido: ${ADMIN_EMAIL} / admin123`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
