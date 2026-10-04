"use client";

import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
  type HTMLMotionProps,
} from "motion/react";
import type { ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

export function MotionPresence({ children }: { children: ReactNode }) {
  return <AnimatePresence initial={false}>{children}</AnimatePresence>;
}

/** Keep exiting surfaces mounted until their motion finishes, without accepting input. */
export function MotionSurface({
  kind,
  children,
  ...props
}: HTMLMotionProps<"div"> & { kind: "dialog" | "panel" | "menu" | "toast" | "group" }) {
  const reducedMotion = useReducedMotion();
  const isPresent = useIsPresent();
  const offset = reducedMotion ? 0 : kind === "toast" ? 8 : kind === "menu" ? -4 : 12;
  const scale = reducedMotion || kind === "toast" ? 1 : 0.98;
  const stationary = kind === "dialog" || kind === "group";

  return (
    <motion.div
      {...props}
      role={props.role ?? (kind === "toast" ? "status" : undefined)}
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
      transition={{ duration: reducedMotion ? 0 : kind === "dialog" ? 0.2 : 0.26, ease }}
      style={{ ...props.style, ...(kind === "group" ? { display: "contents" } : {}) }}
    >
      {children}
    </motion.div>
  );
}
