"use client";

import { Check, FolderOpen, Plus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/app/components/ui";
import { folderNamesEqual, normalizeFolderName } from "@/lib/folders";
import type { FolderRecord } from "@/app/types";

export function FolderInlineInput({
  className,
  folders,
  valueName,
  onCommit,
}: {
  className?: string;
  folders: FolderRecord[];
  valueName: string | null;
  onCommit: (folderName: string | null) => void | Promise<void>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const normalizedInput = normalizeFolderName(input);
  const exactFolder = normalizedInput
    ? folders.find((folder) => folderNamesEqual(folder.name, normalizedInput))
    : null;
  const filteredFolders = folders.filter((folder) =>
    normalizedInput
      ? folder.name.toLowerCase().includes(normalizedInput.toLowerCase())
      : true,
  );

  function beginEdit() {
    setInput(valueName ?? "");
    setEditing(true);
  }

  function cancel() {
    setInput("");
    setEditing(false);
  }

  function commit(folderName: string | null) {
    const nextName = folderName ? normalizeFolderName(folderName) : null;
    const isUnchanged =
      (nextName === null && valueName === null) ||
      (nextName !== null && valueName !== null && folderNamesEqual(valueName, nextName));

    if (!isUnchanged) {
      void onCommit(nextName);
    }

    cancel();
  }

  function commitInput() {
    if (!normalizedInput) {
      commit(null);
      return;
    }

    commit(exactFolder?.name ?? normalizedInput);
  }

  useEffect(() => {
    if (!editing) {
      return;
    }

    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => {
      window.clearTimeout(id);
    };
  }, [editing]);

  useEffect(() => {
    if (!editing) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }

      setInput("");
      setEditing(false);
    };

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [editing]);

  if (!editing) {
    return (
      <div ref={rootRef} className={cx("relative inline-flex max-w-full", className)}>
        <button
          className={cx(
            "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition",
            valueName
              ? "border-accent-soft bg-accent-soft text-accent hover:bg-surface-muted"
              : "border-line bg-surface-muted text-muted hover:bg-surface-pressed",
          )}
          type="button"
          onClick={beginEdit}
        >
          <FolderOpen className="size-3.5 shrink-0" />
          <span className="truncate">{valueName ?? "Unfiled"}</span>
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cx("relative inline-flex max-w-full", className)}>
      <label className="flex h-8 w-full items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-xs text-muted shadow-sm focus-within:border-line-strong">
        <Search className="size-3.5 shrink-0 text-subtle" />
        <input
          ref={inputRef}
          className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-subtle"
          placeholder="Folder"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitInput();
            }

            if (event.key === "Escape") {
              event.stopPropagation();
              cancel();
            }
          }}
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <div className="absolute left-0 top-9 z-40 w-full rounded-panel border border-line bg-surface p-2 shadow-[0_12px_32px_rgba(0,0,0,0.16)]">
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          <button
            className={cx(
              "inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition hover:bg-surface-muted",
              valueName
                ? "border-line bg-surface-muted text-muted"
                : "border-accent-soft bg-accent-soft text-accent",
            )}
            type="button"
            onClick={() => commit(null)}
          >
            <FolderOpen className="size-3.5 shrink-0" />
            <span className="truncate">Unfiled</span>
          </button>

          {filteredFolders.map((folder) => (
            <button
              key={folder.id}
              className={cx(
                "inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition hover:bg-surface-muted",
                valueName && folderNamesEqual(valueName, folder.name)
                  ? "border-accent-soft bg-accent-soft text-accent"
                  : "border-line bg-surface-muted text-muted",
              )}
              type="button"
              onClick={() => commit(folder.name)}
            >
              <span className="truncate">{folder.name}</span>
              {valueName && folderNamesEqual(valueName, folder.name) && (
                <Check className="size-3 text-accent" />
              )}
            </button>
          ))}

          {filteredFolders.length === 0 && !normalizedInput && (
            <p className="px-2 py-1 text-xs text-muted">No folders yet.</p>
          )}
        </div>

        {normalizedInput && !exactFolder && (
          <div className="mt-2 border-t border-line pt-2">
            <button
              className="flex h-8 w-full min-w-0 items-center gap-2 rounded-control px-2 text-left text-[13px] text-ink transition hover:bg-surface-muted"
              type="button"
              onClick={() => commit(normalizedInput)}
            >
              <Plus className="size-4 text-subtle" />
              <span className="min-w-0 flex-1 truncate">
                Create &ldquo;{normalizedInput}&rdquo;
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}