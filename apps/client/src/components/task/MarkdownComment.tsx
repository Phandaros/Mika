import { EditorContent, useEditor } from "@tiptap/react";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { cn } from "../../lib/utils";

interface MarkdownCommentProps {
  content: string;
  className?: string;
}

export function MarkdownComment({ content, className }: MarkdownCommentProps) {
  const editor = useEditor(
    {
      editable: false,
      extensions: [StarterKit, Markdown],
      content,
      contentType: "markdown",
      editorProps: {
        attributes: {
          class: "mika-rich-text mika-rich-text-readonly"
        }
      }
    },
    [content]
  );

  return <EditorContent editor={editor} className={cn("min-w-0", className)} />;
}
