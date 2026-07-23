import { describe, expect, it } from "vitest";
import {
  stripProjectPrefix,
  workloadTaskDisplayLabel,
  workloadTaskProjectIdentity
} from "./workloadTaskLabel";

describe("stripProjectPrefix", () => {
  it("remove apenas o prefixo que corresponde ao projeto vinculado", () => {
    expect(stripProjectPrefix("[Torino] PPCI - Executivo", "Torino")).toBe("PPCI - Executivo");
    expect(stripProjectPrefix("[Torino] - PPCI - Executivo", "Torino")).toBe("PPCI - Executivo");
  });

  it("preserva prefixos sem vínculo com o projeto", () => {
    expect(stripProjectPrefix("[Hope Town] HID - Alterações", "Civil - Sprint Board")).toBe(
      "[Hope Town] HID - Alterações"
    );
  });

  it("usa o mesmo projeto multiprojeto no rótulo e na identidade visual", () => {
    const task = {
      title: "[Hope Town] HID - Alterações",
      projects: [
        { id: "sprint", asanaGid: "sprint", name: "Civil - Sprint Board" },
        { id: "park", asanaGid: "park", name: "Parkside" },
        { id: "hope", asanaGid: "hope", name: "Hope Town" }
      ],
      discipline: {
        id: "section",
        name: "Civil",
        projectId: "sprint",
        projectName: "Civil - Sprint Board"
      }
    };

    expect(workloadTaskProjectIdentity(task)).toEqual({ id: "hope", name: "Hope Town" });
    expect(workloadTaskDisplayLabel(task, "global")).toEqual({
      taskTitle: "HID - Alterações",
      projectName: "Hope Town",
      fullLabel: "[Hope Town] HID - Alterações"
    });
  });

  it("usa o primeiro projeto visível quando o título não define um vínculo", () => {
    const task = {
      title: "HID - Executivo",
      projects: [
        { id: "sprint", asanaGid: "sprint", name: "Civil - Sprint Board" },
        { id: "park", asanaGid: "park", name: "Parkside" }
      ],
      discipline: {
        id: "section",
        name: "Civil",
        projectId: "sprint",
        projectName: "Civil - Sprint Board"
      }
    };

    expect(workloadTaskProjectIdentity(task)).toEqual({ id: "park", name: "Parkside" });
  });
});
