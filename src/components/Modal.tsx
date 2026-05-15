import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  children: ReactNode;
  width?: number | string;
  destructive?: boolean;
}

export function Modal({
  open,
  title,
  onClose,
  onSubmit,
  submitLabel,
  submitDisabled,
  children,
  width = 640,
  destructive = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    // Prevent background scrolling while the modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  // Portal to body so the modal escapes any ancestor stacking context
  // (e.g. .input-panel uses position: sticky which traps z-index).
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-window"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {onSubmit && (
          <div className="modal-footer">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button
              className={`btn ${destructive ? "btn-danger" : "btn-primary"}`}
              onClick={onSubmit}
              disabled={submitDisabled}
            >
              {submitLabel ?? "Save"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
