import { useEffect, useState, type ReactNode } from "react";
import { Markdown } from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading1,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Send
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface TaskCommentEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  submitLabel?: string;
  minHeightClassName?: string;
}

type MarkdownEditor = Editor & {
  getMarkdown: () => string;
};

const toolbarButtonClass =
  "flex h-7 w-7 items-center justify-center rounded text-[--color-text-secondary] transition-colors hover:bg-[--bg-4] hover:text-[--color-text-primary] disabled:cursor-not-allowed disabled:opacity-50";

export function TaskCommentEditor({
  value,
  onChange,
  onSubmit,
  disabled,
  submitLabel = "Comentar",
  minHeightClassName = "min-h-[112px]"
}: TaskCommentEditorProps) {
  const [linkDraft, setLinkDraft] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      Placeholder.configure({
        placeholder: "Adicionar um comentário"
      })
    ],
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "mika-rich-text mika-rich-text-editor"
      }
    },
    onUpdate: ({ editor: nextEditor }) => {
      onChange(markdownFromEditor(nextEditor));
    }
  });

  useEffect(() => {
    if (!editor || value || !editor.getText().trim()) {
      return;
    }

    editor.commands.clearContent();
  }, [editor, value]);

  function submitComment() {
    if (!editor || !value.trim() || disabled) {
      return;
    }

    onSubmit();
  }

  function applyLink() {
    if (!editor) {
      return;
    }

    const href = linkDraft.trim();
    if (!href) {
      editor.chain().focus().unsetLink().run();
      setLinkOpen(false);
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkDraft("");
    setLinkOpen(false);
  }

  return (
    <div className="rounded-md border border-[--color-border] bg-[--bg-1]">
      <div className="flex min-h-9 flex-wrap items-center gap-1 border-b border-[--color-border-subtle] px-2 py-1">
        <ToolbarButton editor={editor} label="Parágrafo" active={editor?.isActive("paragraph")} onClick={() => editor?.chain().focus().setParagraph().run()}>
          <Pilcrow size={15} />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Título" active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={15} />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Negrito" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Itálico" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Lista com marcadores" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Lista numerada" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={15} />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Citação" active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          <Quote size={15} />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Código" active={editor?.isActive("codeBlock")} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
          <Code size={15} />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Quebra de seção" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
          <Minus size={15} />
        </ToolbarButton>
        <button
          type="button"
          className={cn(toolbarButtonClass, editor?.isActive("link") && "bg-[--bg-4] text-[--color-text-primary]")}
          onClick={() => {
            setLinkOpen((current) => !current);
            setLinkDraft(editor?.getAttributes("link").href ?? "");
          }}
          disabled={!editor}
          aria-label="Link"
          title="Link"
        >
          <LinkIcon size={15} />
        </button>
      </div>

      {linkOpen ? (
        <div className="flex items-center gap-2 border-b border-[--color-border-subtle] px-2 py-2">
          <Input
            value={linkDraft}
            onChange={(event) => setLinkDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              }
            }}
            placeholder="https://..."
            className="h-8 bg-[--bg-3] text-[13px]"
          />
          <Button type="button" className="h-8 px-3 text-xs" onClick={applyLink}>
            Aplicar
          </Button>
        </div>
      ) : null}

      <EditorContent editor={editor} className={cn(minHeightClassName, "px-3 py-2")} />

      <div className="flex items-center justify-between border-t border-[--color-border-subtle] px-3 py-2">
        <span className="text-[12px] text-[--color-text-muted]">Markdown será preservado no comentário.</span>
        <Button type="button" className="h-8 px-3 text-xs" disabled={disabled || !value.trim()} onClick={submitComment}>
          <Send size={14} />
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function ToolbarButton({
  editor,
  label,
  active,
  onClick,
  children
}: {
  editor: Editor | null;
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(toolbarButtonClass, active && "bg-[--bg-4] text-[--color-text-primary]")}
      onClick={onClick}
      disabled={!editor}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function markdownFromEditor(editor: Editor): string {
  return (editor as MarkdownEditor).getMarkdown();
}
