import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode
} from "react";
import type { MentionProject } from "../../lib/mentionUtils";
import type { User } from "shared";
import Image from "@tiptap/extension-image";
import { Markdown } from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading1,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Paperclip,
  Pilcrow,
  Quote,
  Send,
  X
} from "lucide-react";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { useUploadInlineImage } from "../../hooks/useCommentAttachments";
import { useProjectOptions } from "../../hooks/useProjects";
import { useUsers } from "../../hooks/useUsers";
import { createMentionSuggestionExtension } from "../../lib/mentionSuggestion";
import {
  editorMentionsToMarkdown,
  markdownMentionsToEditorContent,
  type MentionContext
} from "../../lib/mentionUtils";
import {
  classifyFile,
  DOCUMENT_ACCEPT,
  extractDocumentsFromClipboard,
  extractImageFromClipboard,
  formatFileSize,
  getFileRejectionMessage,
  IMAGE_ACCEPT,
  resolveCommentMarkdownForSubmit,
  toAbsoluteApiUrl
} from "../../lib/attachmentUtils";
import { logCommentImageDebug } from "../../lib/commentImageDebug";
import { cn, createUploadId } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export type PendingMarkdownFile = {
  id: string;
  file: File;
};

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  submitLabel?: string;
  placeholder?: string;
  minHeightClassName?: string;
  pendingFiles?: PendingMarkdownFile[];
  onPendingFilesChange?: (files: PendingMarkdownFile[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
  mentionContext?: MentionContext | null;
  footerActions?: ReactNode;
  allowAttachmentOnly?: boolean;
}

export interface MarkdownEditorHandle {
  getSubmitContent: () => string;
}

function createPendingFile(file: File): PendingMarkdownFile {
  return { id: createUploadId(), file };
}

type MarkdownEditor = Editor & {
  getMarkdown: () => string;
};

const toolbarButtonClass =
  "flex h-7 w-7 items-center justify-center rounded text-[--color-text-secondary] transition-colors hover:bg-[--bg-4] hover:text-[--color-text-primary] disabled:cursor-not-allowed disabled:opacity-50";

const MAX_PENDING_FILES = 5;

function appendMarkdownBlock(current: string, block: string): string {
  const trimmed = current.trim();

  if (!trimmed) {
    return block;
  }

  return `${trimmed}\n\n${block}`;
}

function buildImageMarkdown(alt: string, src: string): string {
  return `![${alt}](${src})`;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor(
  {
    value,
    onChange,
    onSubmit,
    disabled,
    submitLabel = "Comentar",
    placeholder = "Adicionar um comentário",
    minHeightClassName = "min-h-[112px]",
    pendingFiles = [],
    onPendingFilesChange,
    onUploadingChange,
    mentionContext = null,
    footerActions,
    allowAttachmentOnly = false
  },
  ref
) {
  const { data: users = [] } = useUsers();
  const { data: projects = [] } = useProjectOptions();
  const usersRef = useRef<User[]>(users);
  const projectsRef = useRef<MentionProject[]>(projects);
  const mentionContextRef = useRef<MentionContext | null>(mentionContext);
  usersRef.current = users;
  projectsRef.current = projects;
  mentionContextRef.current = mentionContext;

  const mentionExtension = useMemo(
    () =>
      createMentionSuggestionExtension({
        usersRef,
        projectsRef,
        contextRef: mentionContextRef
      }),
    []
  );
  const [linkDraft, setLinkDraft] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [imageUploads, setImageUploads] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const valueRef = useRef(value);
  const pendingFilesRef = useRef(pendingFiles);
  const onPendingFilesChangeRef = useRef(onPendingFilesChange);
  const isApplyingMarkdownRef = useRef(false);
  const blobToApiUrlRef = useRef<Map<string, string>>(new Map());
  const submitRef = useRef<() => void>(() => undefined);
  const uploadInlineImage = useUploadInlineImage();

  valueRef.current = value;
  pendingFilesRef.current = pendingFiles;
  onPendingFilesChangeRef.current = onPendingFilesChange;

  const isUploading = imageUploads > 0 || uploadInlineImage.isPending;

  useImperativeHandle(ref, () => ({
    getSubmitContent: () => resolveCommentMarkdownForSubmit(valueRef.current, blobToApiUrlRef.current)
  }));

  useEffect(() => {
    onUploadingChange?.(isUploading);
  }, [isUploading, onUploadingChange]);

  const revokeBlobUrls = useCallback(() => {
    for (const blobUrl of blobToApiUrlRef.current.keys()) {
      if (blobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrl);
      }
    }

    blobToApiUrlRef.current.clear();
  }, []);

  useEffect(() => () => revokeBlobUrls(), [revokeBlobUrls]);

  const getEditorMarkdown = useCallback((editor: Editor): string => {
    return editorMentionsToMarkdown((editor as MarkdownEditor).getMarkdown());
  }, []);

  const syncMarkdownValue = useCallback(
    (nextMarkdown: string, options?: { updateEditor?: boolean }) => {
      isApplyingMarkdownRef.current = true;
      valueRef.current = nextMarkdown;
      onChange(nextMarkdown);

      const editor = editorRef.current;

      if (options?.updateEditor !== false && editor) {
        editor.commands.setContent(markdownMentionsToEditorContent(nextMarkdown), { contentType: "markdown", emitUpdate: false });
      }

      isApplyingMarkdownRef.current = false;
      logCommentImageDebug("syncMarkdownValue", { length: nextMarkdown.length, preview: nextMarkdown.slice(0, 160) });
    },
    [onChange]
  );

  const syncMarkdownFromEditor = useCallback(
    (editor: Editor) => {
      isApplyingMarkdownRef.current = true;
      const nextMarkdown = getEditorMarkdown(editor);
      valueRef.current = nextMarkdown;
      onChange(nextMarkdown);
      isApplyingMarkdownRef.current = false;
    },
    [getEditorMarkdown, onChange]
  );

  const insertMarkdownAtCursor = useCallback(
    (markdownSnippet: string) => {
      const editor = editorRef.current;

      if (!editor) {
        logCommentImageDebug("insertMarkdownAtCursor:editor-missing");
        syncMarkdownValue(appendMarkdownBlock(valueRef.current, markdownSnippet));
        return;
      }

      const inserted = editor.chain().focus().insertContent(markdownSnippet, { contentType: "markdown" }).run();
      const fromEditor = getEditorMarkdown(editor);
      const hasSnippet =
        fromEditor.includes(markdownSnippet) ||
        (markdownSnippet.includes("blob:") && fromEditor.includes("blob:"));

      logCommentImageDebug("insertMarkdownAtCursor", { inserted, hasSnippet, fromEditorPreview: fromEditor.slice(0, 160) });

      if (inserted && hasSnippet) {
        syncMarkdownFromEditor(editor);
        return;
      }

      syncMarkdownValue(appendMarkdownBlock(valueRef.current, markdownSnippet));
    },
    [getEditorMarkdown, syncMarkdownFromEditor, syncMarkdownValue]
  );

  const replaceMarkdownToken = useCallback(
    (token: string, replacement: string) => {
      const current = valueRef.current;
      const nextValue = current.includes(token) ? current.replace(token, replacement) : appendMarkdownBlock(current, replacement);

      logCommentImageDebug("replaceMarkdownToken", {
        foundToken: current.includes(token),
        replacementPreview: replacement.slice(0, 120)
      });

      syncMarkdownValue(nextValue);
    },
    [syncMarkdownValue]
  );

  const removeBlobReference = useCallback((blobUrl: string) => {
    blobToApiUrlRef.current.delete(blobUrl);

    if (blobUrl.startsWith("blob:")) {
      URL.revokeObjectURL(blobUrl);
    }
  }, []);

  const addPendingDocuments = useCallback((files: File[]) => {
    const onChangePending = onPendingFilesChangeRef.current;

    if (!onChangePending) {
      return;
    }

    const nextFiles = [...pendingFilesRef.current];

    if (nextFiles.length >= MAX_PENDING_FILES) {
      toast.error("Número máximo de arquivos por envio excedido (máximo 5)");
      return;
    }

    for (const file of files) {
      const kind = classifyFile(file);

      if (kind === "rejected") {
        toast.error(getFileRejectionMessage(file));
        continue;
      }

      if (kind === "image") {
        toast.error(getFileRejectionMessage(file));
        continue;
      }

      if (nextFiles.length >= MAX_PENDING_FILES) {
        toast.error("Número máximo de arquivos por envio excedido (máximo 5)");
        break;
      }

      nextFiles.push(createPendingFile(file));
    }

    onChangePending(nextFiles);
  }, []);

  const handleImageFileRef = useRef<(file: File) => void>(() => undefined);
  const processDroppedFilesRef = useRef<(files: FileList) => void>(() => undefined);

  const handleImageFile = useCallback(
    async (file: File) => {
      const kind = classifyFile(file);
      logCommentImageDebug("handleImageFile:start", { name: file.name, type: file.type, kind, size: file.size });

      if (kind !== "image") {
        toast.error(getFileRejectionMessage(file));
        return;
      }

      const blobUrl = URL.createObjectURL(file);
      const alt = file.name || "imagem";
      const placeholder = buildImageMarkdown(alt, blobUrl);
      blobToApiUrlRef.current.set(blobUrl, "");

      insertMarkdownAtCursor(placeholder);
      setImageUploads((count) => count + 1);

      try {
        const result = await uploadInlineImage.mutateAsync(file);
        const imageUrl = toAbsoluteApiUrl(result.url);
        blobToApiUrlRef.current.set(blobUrl, imageUrl);

        logCommentImageDebug("handleImageFile:upload-ok", { id: result.id, imageUrl, blobUrl });

        // Mantém blob: no editor para preview local; API URL é aplicada no submit.
      } catch (error) {
        replaceMarkdownToken(placeholder, "");
        removeBlobReference(blobUrl);

        const message = isAxiosError(error)
          ? (error.response?.data as { error?: string } | undefined)?.error ?? "Não foi possível enviar a imagem"
          : "Não foi possível enviar a imagem";

        logCommentImageDebug("handleImageFile:upload-failed", { message, error });
        toast.error(message);
      } finally {
        setImageUploads((count) => Math.max(0, count - 1));
      }
    },
    [insertMarkdownAtCursor, removeBlobReference, replaceMarkdownToken, uploadInlineImage]
  );

  const processDroppedFiles = useCallback(
    (files: FileList) => {
      setDragActive(false);
      const documentFiles: File[] = [];

      for (const file of Array.from(files)) {
        const kind = classifyFile(file);

        if (kind === "image") {
          void handleImageFile(file);
          continue;
        }

        if (kind === "document") {
          documentFiles.push(file);
          continue;
        }

        toast.error(getFileRejectionMessage(file));
      }

      if (documentFiles.length > 0) {
        addPendingDocuments(documentFiles);
      }
    },
    [addPendingDocuments, handleImageFile]
  );

  handleImageFileRef.current = (file: File) => {
    void handleImageFile(file);
  };
  processDroppedFilesRef.current = processDroppedFiles;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: false,
        allowBase64: false
      }),
      Markdown,
      Placeholder.configure({
        placeholder
      }),
      ...(mentionContext ? [mentionExtension] : [])
    ],
    content: markdownMentionsToEditorContent(value),
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "mika-rich-text mika-rich-text-editor"
      },
      handlePaste: (_view, event) => {
        if (!event.clipboardData) {
          return false;
        }

        const imageFile = extractImageFromClipboard(event.clipboardData);

        if (imageFile) {
          logCommentImageDebug("handlePaste:image", { name: imageFile.name, type: imageFile.type });
          event.preventDefault();
          handleImageFileRef.current(imageFile);
          return true;
        }

        const documentFiles = extractDocumentsFromClipboard(event.clipboardData);

        if (documentFiles.length === 0) {
          return false;
        }

        if (!onPendingFilesChangeRef.current) {
          return false;
        }

        event.preventDefault();
        addPendingDocuments(documentFiles);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;

        if (!files || files.length === 0) {
          return false;
        }

        event.preventDefault();
        event.stopPropagation();
        processDroppedFilesRef.current(files);
        return true;
      },
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          submitRef.current();
          return true;
        }

        return false;
      }
    },
    onUpdate: ({ editor: nextEditor }) => {
      if (isApplyingMarkdownRef.current) {
        return;
      }

      const nextMarkdown = getEditorMarkdown(nextEditor);
      valueRef.current = nextMarkdown;
      onChange(nextMarkdown);
    }
  });

  editorRef.current = editor ?? null;

  useEffect(() => {
    if (!editor || value) {
      return;
    }

    revokeBlobUrls();
    isApplyingMarkdownRef.current = true;
    editor.commands.setContent("", { contentType: "markdown", emitUpdate: false });
    isApplyingMarkdownRef.current = false;
  }, [editor, revokeBlobUrls, value]);

  function submitMarkdown() {
    if (!editor || (!value.trim() && !(allowAttachmentOnly && pendingFiles.length > 0)) || disabled || isUploading) {
      return;
    }

    onSubmit();
  }

  submitRef.current = submitMarkdown;

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

  function handleCardDragOver(event: DragEvent<HTMLDivElement>) {
    if (Array.from(event.dataTransfer.types).includes("Files")) {
      event.preventDefault();
      setDragActive(true);
    }
  }

  function handleCardDrop(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.files.length) {
      return;
    }

    event.preventDefault();
    processDroppedFiles(event.dataTransfer.files);
  }

  function handleDocumentSelection(fileList: FileList | null) {
    if (!fileList || !onPendingFilesChange) {
      return;
    }

    const nextFiles = [...pendingFiles];

    for (const file of Array.from(fileList)) {
      const kind = classifyFile(file);

      if (kind === "rejected") {
        toast.error(getFileRejectionMessage(file));
        continue;
      }

      if (kind === "image") {
        void handleImageFile(file);
        continue;
      }

      if (nextFiles.length >= MAX_PENDING_FILES) {
        toast.error("Número máximo de arquivos por envio excedido (máximo 5)");
        break;
      }

      nextFiles.push(createPendingFile(file));
    }

    onPendingFilesChange(nextFiles);
  }

  function removePendingFile(id: string) {
    if (!onPendingFilesChange) {
      return;
    }

    onPendingFilesChange(pendingFiles.filter((item) => item.id !== id));
  }

  return (
    <div
      className={cn("rounded-md border border-[--color-border] bg-[--bg-1]", dragActive && "ring-1 ring-[--color-brand-orange]")}
      onDragOver={handleCardDragOver}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleCardDrop}
    >
      <div className="flex min-h-9 flex-wrap items-center gap-1 border-b border-[--color-border-subtle] bg-[--bg-4] px-2 py-1">
        <ToolbarButton editor={editor} label="Parágrafo" active={editor?.isActive("paragraph")} onClick={() => editor?.chain().focus().setParagraph().run()}>
          <Pilcrow size={14} />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Título" active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={14} />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Negrito" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Itálico" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Lista com marcadores" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Lista numerada" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={14} />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Citação" active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          <Quote size={14} />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Código" active={editor?.isActive("codeBlock")} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
          <Code size={14} />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="Quebra de seção" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
          <Minus size={14} />
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
          <LinkIcon size={14} />
        </button>

        <span className="mx-1 h-4 w-px bg-[--color-border-subtle]" aria-hidden />

        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => documentInputRef.current?.click()}
          disabled={disabled || !onPendingFilesChange}
          aria-label="Anexar documento"
          title="Anexar documento"
        >
          <Paperclip size={14} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => imageInputRef.current?.click()}
          disabled={disabled || isUploading}
          aria-label="Inserir imagem"
          title="Inserir imagem"
        >
          {isUploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
        </button>

        <input
          ref={imageInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";

            if (file) {
              void handleImageFile(file);
            }
          }}
        />
        <input
          ref={documentInputRef}
          type="file"
          accept={DOCUMENT_ACCEPT}
          multiple
          className="hidden"
          onChange={(event) => {
            handleDocumentSelection(event.target.files);
            event.target.value = "";
          }}
        />
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

      {pendingFiles.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-[--color-border-subtle] px-3 py-2">
          {pendingFiles.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-md border border-[--color-border] bg-[--bg-3] px-2 py-1"
            >
              <Paperclip size={12} className="text-[--color-text-muted]" />
              <div className="min-w-0">
                <p className="max-w-[140px] truncate text-[12px] text-[--color-text-primary]">{item.file.name}</p>
                <p className="text-[11px] text-[--color-text-muted]">{formatFileSize(item.file.size)}</p>
              </div>
              <button
                type="button"
                aria-label="Remover arquivo pendente"
                className="text-[--color-text-muted] hover:text-[--status-late-text]"
                onClick={() => removePendingFile(item.id)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-end border-t border-[--color-border-subtle] px-3 py-2">
        {footerActions ?? (
          <Button
            type="button"
            className="h-8 px-3 text-xs"
            disabled={disabled || (!value.trim() && !(allowAttachmentOnly && pendingFiles.length > 0)) || isUploading}
            onClick={submitMarkdown}
          >
            <Send size={14} />
            {submitLabel}
          </Button>
        )}
      </div>
    </div>
  );
});

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
