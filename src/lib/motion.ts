import type { Transition } from "motion/react";

/**
 * Cross-platform (Windows DirectComposition + macOS CoreAnimation) spring physics presets.
 *
 * Rules:
 * 1. Only animate GPU-composited properties (`transform` and `opacity`).
 * 2. Never animate `filter: blur(...)` frame-by-frame alongside `backdrop-filter`
 *    (avoids D3D11/ANGLE offscreen surface thrashing on Windows).
 * 3. Use tight `restDelta: 0.0005` and `restSpeed: 0.01` so transforms settle cleanly
 *    back to identity (`transform: none`), keeping Windows ClearType subpixel text sharp.
 */

export const SPRING_LIQUID_BUTTON: Transition = {
  type: "spring",
  stiffness: 650,
  damping: 22,
  mass: 0.55,
  restDelta: 0.0005,
  restSpeed: 0.01,
};

/**
 * Fast-launch, soft-settle spring for sliding active highlight pills (`layoutId`).
 * Flies quickly out of the previous item and decelerates smoothly onto the target link.
 */
export const SPRING_NAV_GLIDE: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 34,
  mass: 0.65,
  restDelta: 0.0005,
  restSpeed: 0.01,
};

/**
 * Origin-aware spring for dropdowns, popovers, and context menus.
 */
export const SPRING_MENU_POPOVER: Transition = {
  type: "spring",
  stiffness: 540,
  damping: 30,
  mass: 0.6,
  restDelta: 0.0005,
  restSpeed: 0.01,
};

/**
 * Fast, non-sluggish exit transition for menus and popovers.
 */
export const EXIT_MENU_POPOVER: Transition = {
  duration: 0.13,
  ease: [0.32, 0, 0.67, 0],
};

/**
 * Choreographed spring for modal dialogs, sheets, and full-screen gates.
 */
export const SPRING_MODAL_SHEET: Transition = {
  type: "spring",
  stiffness: 440,
  damping: 32,
  mass: 0.85,
  restDelta: 0.0005,
  restSpeed: 0.01,
};

export const EXIT_MODAL_SHEET: Transition = {
  duration: 0.16,
  ease: [0.32, 0, 0.67, 0],
};

/**
 * Dynamic-pill entrance spring for toast notifications.
 */
export const SPRING_TOAST_PILL: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 26,
  mass: 0.7,
  restDelta: 0.0005,
  restSpeed: 0.01,
};

export const EXIT_TOAST_PILL: Transition = {
  duration: 0.15,
  ease: [0.32, 0, 0.67, 0],
};

/**
 * Horizontal error shake keyframes (e.g., wrong PIN / passcode).
 */
export const KEYFRAME_ERROR_SHAKE = {
  x: [0, -9, 9, -6, 6, -3, 3, 0],
  transition: {
    duration: 0.42,
    ease: "easeInOut" as const,
  },
};
