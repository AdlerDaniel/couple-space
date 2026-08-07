"use client";

import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";

let openDialogCount = 0;
let previousRootOverflow = "";

function lockPageScroll() {
  if (openDialogCount === 0) {
    previousRootOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
  }

  openDialogCount += 1;
}

function unlockPageScroll() {
  openDialogCount = Math.max(0, openDialogCount - 1);

  if (openDialogCount === 0) {
    document.documentElement.style.overflow = previousRootOverflow;
  }
}

type AppDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  role?: "dialog" | "alertdialog";
  ariaLabel?: string;
  ariaLabelledby?: string;
  ariaDescribedby?: string;
  dismissOnBackdrop?: boolean;
  dismissOnEscape?: boolean;
  backdrop?: "default" | "soft" | "rose";
};

/**
 * Native modal dialog with consistent focus management, Escape handling,
 * focus restoration, page scroll locking and an optional backdrop dismissal.
 */
export function AppDialog({
  open,
  onOpenChange,
  children,
  className = "",
  role = "dialog",
  ariaLabel,
  ariaLabelledby,
  ariaDescribedby,
  dismissOnBackdrop = true,
  dismissOnEscape = true,
  backdrop = "default",
}: AppDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }

    const previouslyFocused = document.activeElement;
    dialog.showModal();
    lockPageScroll();

    const focusFrame = window.requestAnimationFrame(() => {
      const initialFocus = dialog.querySelector<HTMLElement>(
        "[data-dialog-initial-focus]",
      );

      initialFocus?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (dialog.open) dialog.close();
      unlockPageScroll();

      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open]);

  function requestClose() {
    onOpenChangeRef.current(false);
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (dismissOnBackdrop && event.target === event.currentTarget) {
      requestClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      role={role}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      aria-describedby={ariaDescribedby}
      aria-modal="true"
      data-backdrop={backdrop}
      className={`app-dialog ${className}`.trim()}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissOnEscape) requestClose();
      }}
      onClick={handleBackdropClick}
    >
      {children}
    </dialog>
  );
}
