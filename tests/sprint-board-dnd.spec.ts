import { expect, test, type Page } from "@playwright/test";

const task = {
  id: "sprint-task-1",
  disciplineId: "section-civil",
  title: "Tarefa Kanban sem flicker",
  description: null,
  status: "TODO",
  priority: "MEDIUM",
  assigneeId: null,
  creatorId: "user-coordinator",
  startDate: null,
  dueDate: null,
  estimatedDays: null,
  platform: null,
  taskDiscipline: null,
  estimatedTime: null,
  maxDeadline: null,
  conclusionDays: null,
  stage: null,
  completed: false,
  completedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  assignee: null,
  discipline: {
    id: "section-civil",
    name: "Civil",
    projectId: "project-1",
    projectName: "Projeto Teste"
  }
};

const user = {
  id: "user-coordinator",
  name: "Coordenador Teste",
  email: "coordenador@example.com",
  role: "COORDINATOR",
  avatarUrl: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

async function mockSprintBoardApi(page: Page) {
  let resolveStatusPatch: (() => void) | null = null;
  const statusPatchRequested = new Promise<void>((resolve) => {
    void page.route("**/api/v1/tasks/sprint-task-1/status", async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.fallback();
        return;
      }

      resolve();
      await new Promise<void>((release) => {
        resolveStatusPatch = release;
      });

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ task: { ...task, status: "IN_PROGRESS" } })
      });
    });
  });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith("/tasks/sprint-task-1/status")) {
      await route.fallback();
      return;
    }

    if (url.pathname.endsWith("/auth/refresh")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user, accessToken: "test-token" })
      });
      return;
    }

    if (url.pathname.endsWith("/sprint/summary")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          total: 1,
          active: 1,
          completed: 0,
          byStatus: {
            TODO: 1,
            ON_SCHEDULE: 0,
            OVERDUE: 0,
            IN_PROGRESS: 0,
            AWAITING_REVIEW: 0,
            IN_ANALYSIS: 0,
            AWAITING_DEFINITION: 0,
            FINISHED: 0
          }
        })
      });
      return;
    }

    if (url.pathname.endsWith("/sprint/tasks")) {
      const status = url.searchParams.get("status");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tasks: status === "TODO" ? [task] : [],
          nextCursor: null
        })
      });
      return;
    }

    if (url.pathname.endsWith("/notifications")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ notifications: [] }) });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });

  return {
    statusPatchRequested,
    releaseStatusPatch: () => resolveStatusPatch?.()
  };
}

test("Sprint Board keeps a dragged task in the destination column while status PATCH is pending", async ({ page }) => {
  const api = await mockSprintBoardApi(page);

  await page.goto("/sprint/civil");

  const sourceColumn = page.getByTestId("sprint-column-TODO");
  const destinationColumn = page.getByTestId("sprint-column-IN_PROGRESS");
  const card = page.getByTestId("sprint-task-card-sprint-task-1");

  await expect(sourceColumn.getByTestId("sprint-task-card-sprint-task-1")).toBeVisible();

  const cardBox = await card.boundingBox();
  const destinationBox = await destinationColumn.boundingBox();
  expect(cardBox).not.toBeNull();
  expect(destinationBox).not.toBeNull();

  await page.mouse.move(cardBox!.x + cardBox!.width / 2, cardBox!.y + cardBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(destinationBox!.x + destinationBox!.width / 2, destinationBox!.y + 140, { steps: 12 });
  await page.mouse.up();

  await api.statusPatchRequested;

  await expect(destinationColumn.getByTestId("sprint-task-card-sprint-task-1")).toBeVisible();
  await expect(sourceColumn.getByTestId("sprint-task-card-sprint-task-1")).toHaveCount(0);
  await expect(page.getByTestId("sprint-column-count-TODO")).toHaveText("0");
  await expect(page.getByTestId("sprint-column-count-IN_PROGRESS")).toHaveText("1");

  api.releaseStatusPatch();
  await expect(destinationColumn.getByTestId("sprint-task-card-sprint-task-1")).toBeVisible();
});
