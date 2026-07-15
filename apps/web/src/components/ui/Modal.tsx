"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { Button } from "./Button";

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  confirmVariant?: "primary" | "secondary" | "destructive";
  busy?: boolean;
};

export function Modal({
  open,
  title,
  children,
  onClose,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  confirmVariant = "destructive",
  busy = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-soft-stone/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-soft-stone-200 bg-soft-bg p-5 soft-shadow"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="modal-title"
          className="font-sans text-lg font-semibold text-soft-stone"
        >
          {title}
        </h2>
        <div className="mt-3 font-sans text-sm leading-relaxed text-soft-muted">
          {children}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          {onConfirm ? (
            <Button
              variant={confirmVariant}
              onClick={onConfirm}
              disabled={busy}
            >
              {confirmLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
