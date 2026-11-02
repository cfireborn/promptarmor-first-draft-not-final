import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import type { Review } from "./model";

export const dateLabel = (date: string) =>
  new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
export const statusLabel = (review: Review) =>
  review.status === "approved"
    ? "Approved"
    : review.status === "changes_requested"
      ? "With marketer"
      : review.versions.length > 1
        ? "Revision returned"
        : "New submission";
export function Status({ review }: { review: Review }) {
  return (
    <span
      className={`status ${review.status === "ready" && review.versions.length > 1 ? "returned" : review.status}`}
    >
      <span />
      {statusLabel(review)}
    </span>
  );
}
function formFingerprint(dialog: HTMLDialogElement) {
  return JSON.stringify(
    Array.from(
      dialog.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >("input, textarea, select"),
    ).map((field) => [
      field.id,
      field.value,
      field instanceof HTMLInputElement && field.checked,
    ]),
  );
}
export function closeAllowed() {
  const dialog = document.querySelector<HTMLDialogElement>(
    'dialog[open][data-protect="true"]',
  );
  return (
    !dialog ||
    dialog.dataset.initial === formFingerprint(dialog) ||
    window.confirm(
      "Discard your unsaved changes? Submitted reviews will be kept.",
    )
  );
}
export function Modal({
  title,
  children,
  close,
  wide = false,
  protectEdits = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
  protectEdits?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    const dialog = ref.current!;
    dialog.dataset.initial = formFingerprint(dialog);
    dialog.showModal();
    return () => {
      dialog.close();
      prior?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      data-protect={protectEdits}
      className={wide ? "modal wide" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !protectEdits) close();
      }}
    >
      <div className="modal-head">
        <h2 id={id}>{title}</h2>
        <button className="icon-btn" aria-label="Close dialog" onClick={close}>
          <X size={20} />
        </button>
      </div>
      {protectEdits && (
        <p className="draft-hint">Draft changes are saved when you submit.</p>
      )}
      {children}
    </dialog>
  );
}
