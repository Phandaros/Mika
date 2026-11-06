import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCommentDraft,
  loadCommentDraft,
  purgeExpiredCommentDrafts,
  saveCommentDraft,
  stripLocalImages
} from "./commentDrafts";

const DAY_MS = 24 * 60 * 60 * 1000;

function createStorage() {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key)
  };
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: createStorage() });
});

describe("comment drafts", () => {
  const draft = { content: "texto", baseUpdatedAt: "2026-11-06T10:00:00.000Z", savedAt: 1_000 };

  it("keeps drafts separated by user and comment", () => {
    saveCommentDraft("user-1", "comment-1", draft);

    expect(loadCommentDraft("user-1", "comment-1", 1_000)).toEqual(draft);
    expect(loadCommentDraft("user-2", "comment-1", 1_000)).toBeNull();
    expect(loadCommentDraft("user-1", "comment-2", 1_000)).toBeNull();
  });

  it("discards a draft after seven days", () => {
    saveCommentDraft("user-1", "comment-1", draft);

    expect(loadCommentDraft("user-1", "comment-1", draft.savedAt + 8 * DAY_MS)).toBeNull();
  });

  it("clears a draft", () => {
    saveCommentDraft("user-1", "comment-1", draft);
    clearCommentDraft("user-1", "comment-1");

    expect(loadCommentDraft("user-1", "comment-1", 1_000)).toBeNull();
  });

  it("purges only expired drafts", () => {
    saveCommentDraft("user-1", "old", draft);
    saveCommentDraft("user-1", "recent", { ...draft, savedAt: 8 * DAY_MS });
    purgeExpiredCommentDrafts(8 * DAY_MS);

    expect(loadCommentDraft("user-1", "old", 8 * DAY_MS)).toBeNull();
    expect(loadCommentDraft("user-1", "recent", 8 * DAY_MS)).not.toBeNull();
  });
});

describe("stripLocalImages", () => {
  it("removes images that only exist in this tab", () => {
    const content = "antes\n\n![a.png](blob:http://localhost/1)\n\n![b.png](/api/v1/attachments/2/file)";

    expect(stripLocalImages(content)).toBe("antes\n\n![b.png](/api/v1/attachments/2/file)");
  });
});
