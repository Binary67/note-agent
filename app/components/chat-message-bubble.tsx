import { Bot, FileText, UserRound } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cx } from "@/app/components/ui";
import { splitName, typeLabel } from "@/lib/utils";
import type { ChatMessage } from "@/app/types";

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={cx("flex items-start gap-3", !isAssistant && "justify-end")}>
      {isAssistant && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Bot className="size-4" />
        </span>
      )}

      <div
        className={cx(
          "max-w-[760px] rounded-panel px-3 py-2 text-[14px] leading-6",
          isAssistant
            ? "border border-line bg-surface shadow-sm"
            : "bg-surface-muted text-ink",
        )}
      >
        {isAssistant ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ children, href }) => (
                <a
                  className="font-medium text-accent underline-offset-2 hover:underline"
                  href={href}
                  rel="noreferrer"
                  target="_blank"
                >
                  {children}
                </a>
              ),
              code: ({ children, className }) => (
                <code
                  className={cx(
                    "rounded-[4px] bg-surface-muted px-1 py-0.5 font-mono text-[12px]",
                    className,
                  )}
                >
                  {children}
                </code>
              ),
              h1: ({ children }) => (
                <h1 className="mb-2 text-base font-semibold leading-6 text-ink">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="mb-2 text-[15px] font-semibold leading-6 text-ink">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="mb-1.5 text-[14px] font-semibold leading-6 text-ink">
                  {children}
                </h3>
              ),
              li: ({ children }) => <li className="pl-1">{children}</li>,
              ol: ({ children }) => (
                <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
              ),
              p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
              pre: ({ children }) => (
                <pre className="my-2 overflow-x-auto rounded-control bg-surface-muted p-3 text-[12px] leading-5">
                  {children}
                </pre>
              ),
              table: ({ children }) => (
                <div className="my-2 overflow-x-auto">
                  <table className="min-w-full border-collapse text-left text-[13px]">
                    {children}
                  </table>
                </div>
              ),
              td: ({ children }) => (
                <td className="border border-line px-2 py-1 align-top">{children}</td>
              ),
              th: ({ children }) => (
                <th className="border border-line bg-surface-muted px-2 py-1 font-semibold">
                  {children}
                </th>
              ),
              ul: ({ children }) => (
                <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}

        {isAssistant && message.documents && message.documents.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-2">
            {message.documents.map((document) => {
              const { stem, ext } = splitName(document.name);
              const type = typeLabel(ext);
              return (
                <span
                  key={document.id}
                  className="inline-flex max-w-full items-center gap-1 rounded-[6px] bg-surface-muted px-2 py-1 text-xs text-muted ring-1 ring-line"
                >
                  <FileText className="size-3 shrink-0" />
                  <span className="truncate">{stem}</span>
                  <span className="shrink-0 text-subtle">{type}</span>
                  <span className="shrink-0 text-subtle">
                    {document.source === "selected" ? "Selected" : "Retrieved"}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {!isAssistant && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted ring-1 ring-line">
          <UserRound className="size-4" />
        </span>
      )}
    </div>
  );
}
