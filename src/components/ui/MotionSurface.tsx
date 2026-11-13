"use client";

import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from "motion/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  SPRING_MENU_POPOVER,
  EXIT_MENU_POPOVER,
  EXIT_MODAL_SHEET,
  SPRING_TOAST_PILL,
  EXIT_TOAST_PILL,
  POPOVER_INITIAL_SCALE,
  EASE_ON_SCREEN,
  arcTransition,
  captureTriggerOriginVector,
  ensureTriggerTracker,
} from "@/lib/motion";

const dialogStack: HTMLDivElement[] = [];

const backdropEase = [0.22, 1, 0.36, 1] as const;

export function MotionPresence({ children }: { children: ReactNode }) {
  return <AnimatePresence initial={false}>{children}</AnimatePresence>;
}

/**
 * Crossfades swapping icons with subtle scale and blur while overlapping states.
 */
export function IconCrossfade({
  iconKey,
  children,
  className = "inline-flex items-center justify-center",
}: {
  iconKey: string | number | boolean;
  children: ReactNode;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <span className={`relative ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={String(iconKey)}
          initial={
            reducedMotion
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.72, filter: "blur(3px)" }
          }
          animate={
            reducedMotion
              ? { opacity: 1, transition: { duration: 0 } }
              : {
                  opacity: 1,
                  scale: 1,
                  filter: "blur(0px)",
                  transition: { duration: 0.16, ease: EASE_ON_SCREEN },
                }
          }
          exit={
            reducedMotion
              ? { opacity: 0, transition: { duration: 0 } }
              : {
                  opacity: 0,
                  scale: 0.72,
                  filter: "blur(3px)",
                  transition: { duration: 0.125, ease: EASE_ON_SCREEN },
                }
          }
          className="inline-flex items-center justify-center"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
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
  const [triggerOrigin] = useState(() => {
    ensureTriggerTracker();
    return kind === "panel" ? captureTriggerOriginVector() : null;
  });

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
            hidden: { opacity: 0, scale: POPOVER_INITIAL_SCALE, y: -6 },
            visible: {
              opacity: 1,
              scale: 1,
              y: 0,
              transition: SPRING_MENU_POPOVER,
            },
            exit: {
              opacity: 0,
              scale: POPOVER_INITIAL_SCALE,
              y: -5,
              transition: EXIT_MENU_POPOVER,
            },
          }
        : kind === "toast"
          ? {
              hidden: { opacity: 0, y: 14, scale: POPOVER_INITIAL_SCALE },
              visible: {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: SPRING_TOAST_PILL,
              },
              exit: {
                opacity: 0,
                y: 8,
                scale: POPOVER_INITIAL_SCALE,
                transition: EXIT_TOAST_PILL,
              },
            }
          : {
              // kind === "panel" (Modal Dialog / Sheet) enters from and exits back toward trigger along an arc.
              hidden: {
                opacity: 0,
                scale: POPOVER_INITIAL_SCALE,
                x: triggerOrigin?.x ?? 0,
                y: triggerOrigin?.y ?? -10,
              },
              visible: {
                opacity: 1,
                scale: 1,
                x: 0,
                y: 0,
                transition: arcTransition(0.25, false),
              },
              exit: {
                opacity: 0,
                scale: POPOVER_INITIAL_SCALE,
                x: triggerOrigin?.x ?? 0,
                y: triggerOrigin?.y ?? -10,
                transition: {
                  ...arcTransition(0.2, true),
                  ...EXIT_MODAL_SHEET,
                },
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
        ...(kind === "panel" && triggerOrigin
          ? {
              transformOrigin: `${triggerOrigin.originY} ${triggerOrigin.originX}`,
            }
          : {}),
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
