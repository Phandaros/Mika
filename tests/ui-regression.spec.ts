import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const globalsCss = readFileSync(resolve("apps/client/src/styles/globals.css"), "utf8");

function alphaFromColor(color: string): number {
  const match = /rgba?\(([^)]+)\)/.exec(color);
  if (!match) {
    return 1;
  }

  const parts = match[1]?.split(",").map((part) => part.trim()) ?? [];
  if (parts.length < 4) {
    return 1;
  }

  return Number(parts[3]);
}

test("chips use translucent token backgrounds", async ({ page }) => {
  await page.setContent(`
    <style>
      ${globalsCss}
      .chip {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }
    </style>
    <span class="chip" data-chip="status" style="background-color: var(--status-inprogress-bg); color: var(--status-inprogress-text)">Em andamento</span>
    <span class="chip" data-chip="priority" style="background-color: var(--priority-high-bg); color: var(--priority-high-text)">Alta</span>
    <span class="chip" data-chip="discipline" style="background-color: var(--disc-ele-bg); color: var(--disc-ele-text)">ELE</span>
    <span class="chip" data-chip="platform" style="background-color: var(--plat-cad-bg); color: var(--plat-cad-text)">CAD</span>
  `);

  for (const chip of await page.locator("[data-chip]").all()) {
    const background = await chip.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(alphaFromColor(background)).toBeLessThan(0.3);
  }
});

test("task detail field grid keeps labels and values aligned", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.setContent(`
    <style>
      ${globalsCss}
      .field-grid {
        display: grid;
        grid-template-columns: 140px 1fr;
        column-gap: 16px;
      }
      .field-cell {
        min-height: 32px;
        display: flex;
        align-items: center;
        border-bottom: 1px solid var(--color-border-subtle);
      }
    </style>
    <div class="field-grid" data-testid="task-detail-field-grid">
      <div class="field-cell" data-label>Status</div>
      <div class="field-cell" data-value>Em andamento</div>
      <div class="field-cell" data-label>Plataforma</div>
      <div class="field-cell" data-value>CAD</div>
    </div>
  `);

  const labels = await page.locator("[data-label]").all();
  const values = await page.locator("[data-value]").all();

  for (let index = 0; index < labels.length; index += 1) {
    const labelBox = await labels[index]!.boundingBox();
    const valueBox = await values[index]!.boundingBox();
    expect(labelBox).not.toBeNull();
    expect(valueBox).not.toBeNull();
    expect(Math.abs(labelBox!.y - valueBox!.y)).toBeLessThanOrEqual(1);
  }
});

test("list table fits inside a 1280px viewport and empty cells render dash", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.setContent(`
    <style>
      ${globalsCss}
      body { margin: 0; }
      .table-wrap { width: 100%; overflow-x: auto; }
      table { width: 100%; min-width: 1100px; table-layout: fixed; border-collapse: collapse; }
      thead { position: sticky; top: 0; z-index: 10; background: var(--bg-1); }
      td, th { padding: 8px 12px; }
      .empty { color: var(--color-text-muted); }
      .numeric { text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
    </style>
    <div class="table-wrap" data-testid="table-wrap">
      <table data-testid="project-list-table">
        <thead><tr><th>Tarefa</th><th>Seção</th><th>Responsável</th><th>Status</th><th>Plataforma</th><th>Disciplina</th><th>Status Conclusão</th><th>Prazo Máximo</th><th>Dias Estimados</th><th>Dias Conclusão</th><th>Etapa</th></tr></thead>
        <tbody>
          <tr><td>Tarefa teste</td><td>ELE</td><td class="empty">—</td><td>Em andamento</td><td class="empty">—</td><td class="empty">—</td><td>Aberta</td><td class="empty">—</td><td class="numeric empty">—</td><td class="numeric empty">—</td><td class="empty">—</td></tr>
        </tbody>
      </table>
    </div>
  `);

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(1280);
  await expect(page.locator("td.empty").first()).toHaveText("—");
  await expect(page.locator("td.numeric.empty").first()).toHaveCSS("text-align", "right");
});
