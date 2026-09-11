"use client";

import { useCallback, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useSheetGestures } from "@/app/components/useSheetGestures";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  closeLabel: string;
  id?: string;
  className?: string;
  returnFocusRef?: RefObject<HTMLElement>;
  renderHeader?: (close: () => void) => ReactNode;
  children: ReactNode;
}

export default function Sheet({
  open,
  onClose,
  label,
  closeLabel,
  id,
  className = "",
  returnFocusRef,
  renderHeader,
  children,
}: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const activeRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const finishClose = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    dialogRef.current?.close();
    onCloseRef.current();
    returnFocusRef?.current?.focus({ preventScroll: true });
  }, [returnFocusRef]);

  const gestures = useSheetGestures({
    isOpen: open,
    sheetRef,
    backdropRef,
    onClose: finishClose,
  });

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    activeRef.current = true;
    // A nested Sheet leaves the lightbox's existing scroll lock in charge.
    const previousOverflow = document.body.style.overflow;
    const ownsScrollLock = previousOverflow !== "hidden";
    if (ownsScrollLock) document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();

    return () => {
      activeRef.current = false;
      if (dialog.open) dialog.close();
      if (ownsScrollLock) document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      id={id}
      className={`sheet-layer ${className}`}
      aria-label={label}
      onClose={(event) => {
        // Portal events must not close an underlying lightbox dialog.
        event.stopPropagation();
        if (!event.currentTarget.open) finishClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        gestures.close();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        gestures.close();
      }}
    >
      <button
        ref={backdropRef}
        type="button"
        className="sheet-backdrop"
        aria-label={closeLabel}
        onClick={gestures.close}
      />
      <div
        ref={sheetRef}
        className="sheet-panel"
        onPointerDown={gestures.onPointerDown}
        onPointerMove={gestures.onPointerMove}
        onPointerUp={gestures.onPointerUp}
        onPointerCancel={gestures.onPointerCancel}
      >
        <div className="sheet-grab" data-sheet-handle>
          <span className="sheet-handle" aria-hidden="true" />
          {renderHeader?.(gestures.close)}
        </div>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
