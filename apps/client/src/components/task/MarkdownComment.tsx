import ReactMarkdown from "react-markdown";
import { ImageOff } from "lucide-react";
import { useAuthenticatedAsset, openAuthenticatedAsset } from "../../hooks/useAuthenticatedAsset";
import { cn } from "../../lib/utils";

interface MarkdownCommentProps {
  content: string;
  className?: string;
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

export function MarkdownComment({ content, className }: MarkdownCommentProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <ReactMarkdown
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
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[--color-brand-orange] underline underline-offset-2"
            >
              {children}
            </a>
          )
        }}
        disallowedElements={["script", "iframe", "object", "embed"]}
        unwrapDisallowed
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
