import { FileUp } from "lucide-react";
import { Modal, PrimaryButton, SecondaryButton } from "@/app/components/ui";

export function ImportDialog({
  target,
  isImporting,
  onClose,
  onConfirm,
}: {
  target: File | null;
  isImporting: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Modal
      open={target !== null}
      title="Import knowledge base"
      icon={FileUp}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton disabled={isImporting} onClick={onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton disabled={isImporting} onClick={onConfirm}>
            {isImporting ? "Importing..." : "Replace"}
          </PrimaryButton>
        </>
      }
    >
      <p className="text-sm leading-6 text-muted">
        This replaces the local documents, folders, and index with
        {target ? ` ${target.name}.` : " the selected bundle."}
      </p>
    </Modal>
  );
}
