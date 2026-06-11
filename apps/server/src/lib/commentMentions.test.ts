import { describe, expect, it } from "vitest";
import { extractUserMentionIds } from "./commentMentions.js";

describe("extractUserMentionIds", () => {
  it("extracts user ids from mention links", () => {
    const content = "Olá @[João](mk://user/user-1) e @[Maria](mk://user/user-2)";
    expect(extractUserMentionIds(content)).toEqual(["user-1", "user-2"]);
  });

  it("ignores task and project mentions", () => {
    const content = "@[Tarefa](mk://task/task-1) @[Projeto](mk://project/project-1)";
    expect(extractUserMentionIds(content)).toEqual([]);
  });
});
