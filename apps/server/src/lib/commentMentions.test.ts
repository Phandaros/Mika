import { describe, expect, it } from "vitest";
import { extractUserMentionIds, findNewUserMentionIds } from "./commentMentions.js";

describe("findNewUserMentionIds", () => {
  it("returns only users that were not mentioned before", () => {
    const previous = "Olá @[João](mk://user/user-1)";
    const next = "Olá @[João](mk://user/user-1) e @[Maria](mk://user/user-2)";

    expect(findNewUserMentionIds(previous, next)).toEqual(["user-2"]);
  });

  it("returns nothing when an edit keeps the same mentions", () => {
    const content = "Olá @[João](mk://user/user-1)";

    expect(findNewUserMentionIds(content, `${content} texto novo`)).toEqual([]);
  });
});

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
