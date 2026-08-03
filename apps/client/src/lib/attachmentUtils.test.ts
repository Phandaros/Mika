import { describe, expect, it } from "vitest";
import { resolveCommentMarkdownForSubmit } from "./attachmentUtils";

describe("resolveCommentMarkdownForSubmit", () => {
  it("replaces an uploaded image blob URL before persisting edited markdown", () => {
    const blobUrl = "blob:http://desktop-tp1sbgh:5173/image-preview";
    const apiUrl = "/api/v1/attachments/image-id/file";
    const markdown = `Texto antes\n\n![image.png](${blobUrl})\n\nTexto depois`;

    expect(resolveCommentMarkdownForSubmit(markdown, new Map([[blobUrl, apiUrl]]))).toBe(
      `Texto antes\n\n![image.png](${apiUrl})\n\nTexto depois`
    );
  });
});
