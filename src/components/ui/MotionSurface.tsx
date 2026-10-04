"use client";

import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
  type HTMLMotionProps,
} from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

export function MotionPresence({ children }: { children: ReactNode }) {
  return <AnimatePresence initial={false}>{children}</AnimatePresence>;
}

/** Keep exiting surfaces mounted until their motion finishes, without accepting input. */
export function MotionSurface({
  kind,
  children,
  onDismiss,
  ...props
}: HTMLMotionProps<"div"> & {
  kind: "dialog" | "panel" | "menu" | "toast" | "group";
  onDismiss?: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const isDialog =
    Boolean(onDismiss) && (kind === "panel" || kind === "dialog");
  const ariaLabel = props["aria-label"];
  const ariaLabelledBy = props["aria-labelledby"];
  const surfaceRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  const isPresent = useIsPresent();
  const offset = reducedMotion
    ? 0
    : kind === "toast"
      ? 8
      : kind === "menu"
        ? -4
        : 12;
  const scale = reducedMotion || kind === "toast" ? 1 : 0.98;
  const stationary = kind === "dialog" || kind === "group";

  useEffect(() => {
    const panel = surfaceRef.current;
    if (!isDialog || !isPresent || !panel) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const heading = panel.querySelector("h2, h3");
    if (heading && !ariaLabel && !ariaLabelledBy) {
      heading.id ||= headingId;
      panel.setAttribute("aria-labelledby", heading.id);
    }
    const focusable = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      ).filter(
        (element) =>
          element.getClientRects().length > 0 && !element.closest("[inert]"),
      );
    const controls = focusable();
    const initial =
      controls.find((element) =>
        element.matches('input:not([type="file"]), select, textarea'),
      ) ??
      controls[0] ??
      panel;
    initial.focus({ preventScroll: true });
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissRef.current) {
        event.preventDefault();
        dismissRef.current();
      }
      if (event.key !== "Tab") return;
      const controls = focusable();
      const first = controls[0] ?? panel;
      const last = controls.at(-1) ?? panel;
      if (
        !panel.contains(document.activeElement) ||
        (event.shiftKey
          ? document.activeElement === first
          : document.activeElement === last)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [isDialog, isPresent, headingId, ariaLabel, ariaLabelledBy]);

  return (
    <motion.div
      {...props}
      ref={surfaceRef}
      role={
        props.role ??
        (isDialog ? "dialog" : kind === "toast" ? "status" : undefined)
      }
      aria-modal={isDialog ? true : props["aria-modal"]}
      tabIndex={isDialog ? -1 : props.tabIndex}
      data-motion-surface={kind}
      inert={!isPresent ? true : undefined}
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={{
        hidden: { opacity: 0, ...(stationary ? {} : { y: offset, scale }) },
        visible: { opacity: 1, ...(stationary ? {} : { y: 0, scale: 1 }) },
        exit: { opacity: 0, ...(stationary ? {} : { y: offset / 2, scale }) },
      }}
      transition={{
        duration: reducedMotion ? 0 : kind === "dialog" ? 0.2 : 0.26,
        ease,
      }}
      style={{
        ...props.style,
        ...(kind === "group" ? { display: "contents" } : {}),
      }}
    >
      {children}
    </motion.div>
  );
}
