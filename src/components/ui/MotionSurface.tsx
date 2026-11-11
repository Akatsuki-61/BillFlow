"use client";

import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import {
  SPRING_MENU_POPOVER,
  EXIT_MENU_POPOVER,
  SPRING_MODAL_SHEET,
  EXIT_MODAL_SHEET,
  SPRING_TOAST_PILL,
  EXIT_TOAST_PILL,
} from "@/lib/motion";

const dialogStack: HTMLDivElement[] = [];

const backdropEase = [0.22, 1, 0.36, 1] as const;

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

  useEffect(() => {
    const panel = surfaceRef.current;
    if (!isDialog || !isPresent || !panel) return;
    dialogStack.push(panel);
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
      if (dialogStack.at(-1) !== panel) return;
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
      const index = dialogStack.indexOf(panel);
      if (index !== -1) dialogStack.splice(index, 1);
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [isDialog, isPresent, headingId, ariaLabel, ariaLabelledBy]);

  const variants: Variants = reducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0 } },
        exit: { opacity: 0, transition: { duration: 0 } },
      }
    : kind === "dialog" || kind === "group"
      ? {
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { duration: 0.2, ease: backdropEase },
          },
          exit: {
            opacity: 0,
            transition: { duration: 0.16, ease: backdropEase },
          },
        }
      : kind === "menu"
        ? {
            hidden: { opacity: 0, scaleX: 0.95, scaleY: 0.88, y: -5 },
            visible: {
              opacity: 1,
              scaleX: 1,
              scaleY: 1,
              y: 0,
              transition: SPRING_MENU_POPOVER,
            },
            exit: {
              opacity: 0,
              scaleX: 0.96,
              scaleY: 0.92,
              y: -3,
              transition: EXIT_MENU_POPOVER,
            },
          }
        : kind === "toast"
          ? {
              hidden: { opacity: 0, y: 16, scale: 0.9 },
              visible: {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: SPRING_TOAST_PILL,
              },
              exit: {
                opacity: 0,
                y: 8,
                scale: 0.92,
                transition: EXIT_TOAST_PILL,
              },
            }
          : {
              // kind === "panel" (Modal Dialog / Sheet)
              hidden: { opacity: 0, scale: 0.94, y: 16 },
              visible: {
                opacity: 1,
                scale: 1,
                y: 0,
                transition: SPRING_MODAL_SHEET,
              },
              exit: {
                opacity: 0,
                scale: 0.96,
                y: 10,
                transition: EXIT_MODAL_SHEET,
              },
            };

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
      variants={variants}
      style={{
        ...props.style,
        ...(!isPresent ? { pointerEvents: "none" as const } : {}),
        ...(kind === "toast" ? { zIndex: 9999 } : {}),
        ...(kind === "group" ? { display: "contents" } : {}),
      }}
    >
      {children}
    </motion.div>
  );
}
