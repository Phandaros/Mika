import { mergeAttributes, ResizableNodeView } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { api } from "../../lib/api";
import {
  authenticatedAssetRequestPath,
  parseCommentImageSource,
  withCommentImageWidth
} from "../../lib/attachmentUtils";

const MIN_IMAGE_WIDTH = 80;

export const ResizableMarkdownImage = Image.extend({
  parseMarkdown: (token, helpers) => {
    const parsedSource = parseCommentImageSource(token.href);

    return helpers.createNode("image", {
      src: parsedSource.src,
      title: token.title,
      alt: token.text,
      width: parsedSource.width
    });
  },

  renderMarkdown: (node) => {
    const src = withCommentImageWidth(node.attrs?.src ?? "", node.attrs?.width);
    const alt = node.attrs?.alt ?? "";
    const title = node.attrs?.title ?? "";

    return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
  },

  addNodeView() {
    const resize = this.options.resize;

    if (!resize || !resize.enabled || typeof document === "undefined") {
      return null;
    }

    const { directions, minWidth, minHeight, alwaysPreserveAspectRatio } = resize;

    return ({ node, getPos, HTMLAttributes, editor }) => {
      const image = document.createElement("img");
      image.draggable = false;
      image.decoding = "async";

      const mergedAttributes = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes);

      Object.entries(mergedAttributes).forEach(([key, value]) => {
        if (value == null || key === "src" || key === "width" || key === "height") {
          return;
        }

        image.setAttribute(key, String(value));
      });

      const nodeView = new ResizableNodeView({
        element: image,
        editor,
        node,
        getPos,
        onResize: (width, height) => {
          image.style.width = `${width}px`;
          image.style.height = `${height}px`;
        },
        onCommit: (width, height) => {
          const position = getPos();

          if (position === undefined) {
            return;
          }

          editor
            .chain()
            .setNodeSelection(position)
            .updateAttributes(this.name, { width, height })
            .run();
        },
        onUpdate: (updatedNode) => updatedNode.type === node.type,
        options: {
          directions,
          min: {
            width: minWidth,
            height: minHeight
          },
          preserveAspectRatio: alwaysPreserveAspectRatio === true,
          className: {
            container: "mika-resizable-image",
            wrapper: "mika-resizable-image__wrapper",
            handle: "mika-resizable-image__handle",
            resizing: "mika-resizable-image--resizing"
          }
        }
      });

      const container = nodeView.dom as HTMLElement;
      const source = typeof mergedAttributes.src === "string" ? mergedAttributes.src : "";
      const requestPath = authenticatedAssetRequestPath(source);
      let disposed = false;
      let objectUrl: string | null = null;

      container.dataset.imageState = "loading";
      container.title = "Arraste os cantos para redimensionar a imagem";

      image.addEventListener("load", () => {
        if (!disposed) {
          container.dataset.imageState = "ready";
        }
      });

      image.addEventListener("error", () => {
        if (!disposed) {
          container.dataset.imageState = "failed";
        }
      });

      if (requestPath) {
        void (async () => {
          try {
            const response = await api.get<Blob>(requestPath, { responseType: "blob" });

            if (disposed) {
              return;
            }

            objectUrl = URL.createObjectURL(response.data);
            image.src = objectUrl;
          } catch {
            if (!disposed) {
              container.dataset.imageState = "failed";
            }
          }
        })();
      } else {
        image.src = source;
      }

      const destroyNodeView = nodeView.destroy.bind(nodeView);
      nodeView.destroy = () => {
        disposed = true;

        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }

        destroyNodeView();
      };

      return nodeView;
    };
  }
}).configure({
  inline: false,
  allowBase64: false,
  resize: {
    enabled: true,
    directions: ["bottom-left", "bottom-right"],
    minWidth: MIN_IMAGE_WIDTH,
    minHeight: MIN_IMAGE_WIDTH,
    alwaysPreserveAspectRatio: true
  }
});
