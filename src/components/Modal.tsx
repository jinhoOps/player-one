"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import m from "./modal.module.css";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The one modal (docs/DESIGN.md §6 Modal): a card over a dimmed page, a bottom
 * sheet on phones. Closes on ×, a press outside, or Esc. Focus moves in on open,
 * stays inside while open, and goes back to where it was on close.
 */
export function Modal({
  title,
  onClose,
  size = "md",
  actions,
  children,
}: {
  title: ReactNode;
  onClose: () => void;
  /** sm 400px · md 480px · lg 640px */
  size?: "sm" | "md" | "lg";
  /** Buttons pinned under the content, right-aligned. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose);

  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const el = panel.current;
    // Land on the first field or button in the content, else on the panel itself —
    // unless the content already put focus somewhere inside (its effects run first).
    if (!el?.contains(document.activeElement)) {
      const first = el?.querySelector<HTMLElement>(`[data-modal-body] :is(${FOCUSABLE})`);
      (first ?? el)?.focus({ preventScroll: true });
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      } else if (e.key === "Tab" && el) {
        const list = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null);
        if (!list.length) return;
        const [head, tail] = [list[0], list[list.length - 1]];
        if (e.shiftKey && document.activeElement === head) {
          e.preventDefault();
          tail.focus();
        } else if (!e.shiftKey && document.activeElement === tail) {
          e.preventDefault();
          head.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      opener?.focus?.({ preventScroll: true });
    };
  }, []);

  // Modals open on a user action, so this only renders in the browser.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className={m.scrim}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close.current();
      }}
    >
      <div
        ref={panel}
        className={`${m.panel} ${m[size]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className={m.head}>
          <h2 id={titleId} className={m.title}>
            {title}
          </h2>
          <button type="button" className={m.close} onClick={() => close.current()} aria-label="닫기">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>
        <div className={m.body} data-modal-body>
          {children}
        </div>
        {actions && <footer className={m.actions}>{actions}</footer>}
      </div>
    </div>,
    document.body,
  );
}
