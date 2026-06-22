"use client";

import { FileText } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Modal, PrimaryButton, SecondaryButton } from "@/app/components/ui";
import { splitName } from "@/lib/utils";
import type { UploadItem } from "@/app/types";

export function RenameDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: UploadItem | null;
  onClose: () => void;
  onConfirm: (nextName: string) => void;
}) {
  if (!target) {
    return null;
  }

  return (
    <RenameDialogInner
      key={target.id}
      target={target}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

function RenameDialogInner({
  target,
  onClose,
  onConfirm,
}: {
  target: UploadItem;
  onClose: () => void;
  onConfirm: (nextName: string) => void;
}) {
  const { stem: initialStem, ext } = splitName(target.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [stem, setStem] = useState(initialStem);

  useEffect(() => {
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  const nextName = ext ? `${stem.trim()}.${ext.slice(1)}` : stem.trim();
  const canConfirm = stem.trim().length > 0 && nextName !== target.name;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canConfirm) {
      onConfirm(nextName);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={FileText}
      title="Rename Document"
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton
            disabled={!canConfirm}
            form="rename-form"
            type="submit"
          >
            Rename
          </PrimaryButton>
        </>
      }
    >
      <form id="rename-form" onSubmit={handleSubmit}>
        <label
          className="flex h-9 items-center gap-2 rounded-control border border-line bg-surface px-3 text-[13px] focus-within:border-line-strong"
          onClick={() => inputRef.current?.focus()}
        >
          <input
            ref={inputRef}
            className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-subtle"
            placeholder="Document name"
            value={stem}
            onChange={(event) => setStem(event.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          {ext && (
            <span className="shrink-0 text-subtle">{ext}</span>
          )}
        </label>
        <p className="mt-2 text-xs text-muted">
          {ext
            ? `Keeps the ${ext} extension.`
            : "No file extension to preserve."}
        </p>
      </form>
    </Modal>
  );
}