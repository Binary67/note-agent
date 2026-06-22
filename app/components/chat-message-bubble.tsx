import { Bot, FileText, UserRound } from "lucide-react";
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
        <p className="whitespace-pre-wrap">{message.content}</p>

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