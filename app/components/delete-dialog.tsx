"use client";

import { FileText } from "lucide-react";
import { DangerButton, Modal, SecondaryButton } from "@/app/components/ui";
import type { UploadItem } from "@/app/types";

export function DeleteDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: UploadItem | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!target) {
    return null;
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={FileText}
      title="Delete Document?"
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <DangerButton onClick={onConfirm}>Delete</DangerButton>
        </>
      }
    >
      <p className="text-[13px] leading-5 text-muted">
        Delete <span className="font-medium text-ink">&ldquo;{target.name}&rdquo;</span>?
        This removes the file and its indexed data.
      </p>
    </Modal>
  );
}