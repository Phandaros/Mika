import ReactMarkdown, { defaultUrlTransform, type UrlTransform } from "react-markdown";
import { ImageOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthenticatedAsset, openAuthenticatedAsset } from "../../hooks/useAuthenticatedAsset";
import { normalizeMentionContentForRender, parseMentionHref } from "../../lib/mentionUtils";
import { cn } from "../../lib/utils";

const mentionUrlTransform: UrlTransform = (url) => {
  if (url.startsWith("mk://")) {
    return url;
  }

  return defaultUrlTransform(url);
};

interface MarkdownCommentProps {
  content: string;
  className?: string;
  onMentionTask?: (taskId: string) => void;
}

function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const { blobUrl, failed, loading } = useAuthenticatedAsset(src);

  if (failed) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-md border border-[--color-border] bg-[--bg-3] px-3 py-2 text-[--color-text-muted]">
        <ImageOff size={16} />
        <span className="text-[12px]">Imagem não disponível</span>
      </div>
    );
  }

  if (loading || !blobUrl) {
    return (
      <div className="my-2 h-24 animate-pulse rounded-md border border-[--color-border] bg-[--bg-3]" aria-hidden />
    );
  }

  return (
    <img
      src={blobUrl}
      alt={alt ?? ""}
      className="my-2 max-h-[480px] max-w-full cursor-pointer rounded-md object-contain"
      style={{ background: "var(--bg-3)" }}
      onClick={() => {
        if (src) {
          void openAuthenticatedAsset(src);
        }
      }}
    />
  );
}

function MentionLink({
  href,
  children,
  onMentionTask
}: {
  href: string;
  children: React.ReactNode;
  onMentionTask?: (taskId: string) => void;
}) {
  const navigate = useNavigate();
  const mention = parseMentionHref(href);

  if (!mention) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-[--color-brand-orange] underline underline-offset-2">
        {children}
      </a>
    );
  }

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();

    const target = parseMentionHref(href);

    if (!target) {
      return;
    }

    if (target.type === "user") {
      navigate(`/users/${target.id}`);
      return;
    }

    if (target.type === "project") {
      navigate(`/projects/${target.id}`);
      return;
    }

    onMentionTask?.(target.id);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline rounded bg-[--color-brand-orange]/15 px-1 py-0.5 text-[13px] font-medium text-[--color-brand-orange] hover:bg-[--color-brand-orange]/25"
    >
      @{children}
    </button>
  );
}

export function MarkdownComment({ content, className, onMentionTask }: MarkdownCommentProps) {
  const normalizedContent = normalizeMentionContentForRender(content);

  return (
    <div className={cn("min-w-0", className)}>
      <ReactMarkdown
        urlTransform={mentionUrlTransform}
        components={{
          img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} />,
          p: ({ children }) => <p className="mb-1 text-[13px] leading-relaxed text-[--color-text-primary]">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-[--color-text-primary]">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => (
            <code className="rounded bg-[--bg-3] px-1 py-0.5 text-[12px] text-[--color-text-primary]">{children}</code>
          ),
          ul: ({ children }) => <ul className="my-1 list-disc pl-5 text-[13px] text-[--color-text-primary]">{children}</ul>,
          ol: ({ children }) => <ol className="my-1 list-decimal pl-5 text-[13px] text-[--color-text-primary]">{children}</ol>,
          li: ({ children }) => <li className="mb-0.5">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-[--color-border-focus] pl-3 text-[--color-text-secondary]">{children}</blockquote>
          ),
          a: ({ href, children }) => (
            <MentionLink href={href ?? ""} onMentionTask={onMentionTask}>
              {children}
            </MentionLink>
          )
        }}
        disallowedElements={["script", "iframe", "object", "embed"]}
        unwrapDisallowed
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
