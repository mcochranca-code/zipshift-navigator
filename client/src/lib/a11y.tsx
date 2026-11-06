import React, { useEffect, useRef, useSyncExternalStore, type ReactNode, type RefObject } from "react";

/* ────────────────────────────────────────────────────────────────────────────
 * Live announcer
 * One polite and one assertive region live at the app root. Anything (React or
 * not) can call `announce()`; the message is cleared then re-set so repeated
 * identical messages are still read by screen readers.
 * ──────────────────────────────────────────────────────────────────────────── */

type Politeness = "polite" | "assertive";
type AnnouncerState = { polite: string; assertive: string };

let announcerState: AnnouncerState = { polite: "", assertive: "" };
const listeners = new Set<() => void>();
const timers: Partial<Record<Politeness, ReturnType<typeof setTimeout>>> = {};

function emit(next: AnnouncerState) {
  announcerState = next;
  listeners.forEach((listener) => listener());
}

export function announce(message: string, politeness: Politeness = "polite") {
  if (!message) return;
  emit({ ...announcerState, [politeness]: "" });
  if (timers[politeness]) clearTimeout(timers[politeness]);
  // A short delay lets assistive tech notice the cleared region first.
  timers[politeness] = setTimeout(() => emit({ ...announcerState, [politeness]: message }), 60);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Mount once near the root of the app. */
export function LiveAnnouncer() {
  const state = useSyncExternalStore(subscribe, () => announcerState, () => announcerState);
  return (
    <div className="zs-sr-only">
      <div id="zs-live-polite" role="status" aria-live="polite" aria-atomic="true">{state.polite}</div>
      <div id="zs-live-assertive" role="alert" aria-live="assertive" aria-atomic="true">{state.assertive}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Small presentational helpers
 * ──────────────────────────────────────────────────────────────────────────── */

export function VisuallyHidden({ children, as: Tag = "span", id }: { children: ReactNode; as?: "span" | "h1" | "h2" | "div" | "p"; id?: string }) {
  return <Tag id={id} className="zs-sr-only">{children}</Tag>;
}

export function SkipLink({ targetId = "main-content", label = "Skip to main content" }: { targetId?: string; label?: string }) {
  return (
    <a
      className="zs-skip-link"
      href={`#${targetId}`}
      onClick={(event) => {
        const target = document.getElementById(targetId) || document.querySelector<HTMLElement>("main");
        if (!target) return;
        event.preventDefault();
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus();
        target.scrollIntoView?.({ block: "start" });
      }}
    >
      {label}
    </a>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Focus helpers
 * ──────────────────────────────────────────────────────────────────────────── */

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]:not([contenteditable=false])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.hasAttribute("inert") && element.getAttribute("aria-hidden") !== "true" && !element.closest("[inert]"),
  );
}

type DialogOptions = {
  /** Element to focus when the dialog opens. Defaults to the first focusable element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Lock page scroll while open (default true). */
  lockScroll?: boolean;
};

/**
 * Accessible modal behaviour for hand-built dialogs/drawers:
 * focus moves in on open, Tab/Shift+Tab is trapped, Escape closes, and focus
 * returns to the element that opened the dialog when it closes.
 */
export function useDialogA11y(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, options: DialogOptions = {}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const { initialFocusRef, lockScroll = true } = options;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      const container = ref.current;
      if (!container) return;
      const target = initialFocusRef?.current || getFocusable(container)[0] || container;
      if (target === container && !container.hasAttribute("tabindex")) container.setAttribute("tabindex", "-1");
      target.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      const container = ref.current;
      if (!container) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable(container);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      if (lockScroll) document.body.style.overflow = previousOverflow;
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
    };
  }, [open, ref, initialFocusRef, lockScroll]);
}

/**
 * Screen-change focus management for the single-page screen router.
 * On every change of `screenKey` (after the first render) focus moves to the
 * screen's first h1 (or the main landmark) and the new title is announced.
 */
export function useScreenChangeFocus(screenKey: string, title: string | undefined, { skip = false }: { skip?: boolean } = {}) {
  const first = useRef(true);
  useEffect(() => {
    if (skip) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const main = document.getElementById("main-content") || document.querySelector<HTMLElement>("main");
      const heading = main?.querySelector<HTMLElement>("h1") || document.querySelector<HTMLElement>("h1");
      const target = heading || main;
      if (target) {
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: false });
      }
      if (title) {
        document.title = `${title} · ZipShift`;
        announce(`${title} screen`);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [screenKey, title, skip]);
}
