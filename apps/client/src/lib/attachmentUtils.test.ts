import { describe, expect, it } from "vitest";
import {
  authenticatedAssetRequestPath,
  normalizeAuthenticatedAssetUrl,
  parseCommentImageSource,
  withCommentImageWidth,
  resolveCommentMarkdownForSubmit
} from "./attachmentUtils";

describe("authenticated asset URLs", () => {
  it("keeps new image URLs portable between development and production", () => {
    expect(normalizeAuthenticatedAssetUrl("/api/v1/attachments/image-id/file")).toBe(
      "/api/v1/attachments/image-id/file"
    );
  });

  it("maps an absolute development URL to the current API request path", () => {
    expect(
      authenticatedAssetRequestPath(
        "http://desktop-tp1sbgh:3101/api/v1/attachments/image-id/file"
      )
    ).toBe("/attachments/image-id/file");
  });

  it("maps an absolute production URL to the same portable URL", () => {
    expect(
      normalizeAuthenticatedAssetUrl(
        "http://desktop-tp1sbgh:3001/api/v1/attachments/image-id/file"
      )
    ).toBe("/api/v1/attachments/image-id/file");
  });

  it("rejects URLs outside authenticated attachment routes", () => {
    expect(authenticatedAssetRequestPath("https://example.com/image.png")).toBeNull();
    expect(authenticatedAssetRequestPath("/api/v1/users/user-id")).toBeNull();
  });
});

describe("comment image width metadata", () => {
  it("round-trips a resized image without changing its attachment URL", () => {
    const source = "/api/v1/attachments/image-id/file";
    const serialized = withCommentImageWidth(source, 312.6);

    expect(serialized).toBe(`${source}#mika-width=313`);
    expect(parseCommentImageSource(serialized)).toEqual({ src: source, width: 313 });
  });

  it("preserves an existing URL fragment when appending width metadata", () => {
    expect(withCommentImageWidth("https://example.com/image.png#preview", 240)).toBe(
      "https://example.com/image.png#preview&mika-width=240"
    );
  });

  it("keeps images without width metadata unchanged", () => {
    const source = "/api/v1/attachments/image-id/file";

    expect(parseCommentImageSource(source)).toEqual({ src: source, width: null });
    expect(withCommentImageWidth(source, null)).toBe(source);
  });
});

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
