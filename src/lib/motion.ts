import type { Transition } from "motion/react";

/**
 * Shared Motion curves & paired enter/exit timings.
 * Exits are ~20% shorter than entrances, onscreen movement uses ease-in-out,
 * and everyday transitions avoid bouncy underdamped springs.
 */
export const EASE_ON_SCREEN = [0.42, 0, 0.58, 1] as const;
export const EASE_ENTER = [0.22, 1, 0.36, 1] as const;
export const EASE_EXIT = [0.4, 0, 0.7, 1] as const;

export const BUTTON_PRESS_SCALE = 0.97;
export const POPOVER_INITIAL_SCALE = 0.95;

export const SPRING_LIQUID_BUTTON: Transition = {
  duration: 0.16,
  ease: EASE_ON_SCREEN,
};

export const SPRING_NAV_GLIDE: Transition = {
  duration: 0.22,
  ease: EASE_ON_SCREEN,
};

export const ENTER_DROPDOWN: Transition = {
  duration: 0.19,
  ease: EASE_ON_SCREEN,
};

export const EXIT_DROPDOWN: Transition = {
  duration: 0.15,
  ease: EASE_ON_SCREEN,
};

export const SPRING_MENU_POPOVER: Transition = ENTER_DROPDOWN;

export const EXIT_MENU_POPOVER: Transition = EXIT_DROPDOWN;

export const SPRING_MODAL_SHEET: Transition = {
  duration: 0.25,
  ease: EASE_ENTER,
};

export const EXIT_MODAL_SHEET: Transition = {
  duration: 0.2,
  ease: EASE_EXIT,
};

export const SPRING_TOAST_PILL: Transition = {
  duration: 0.24,
  ease: EASE_ENTER,
};

export const EXIT_TOAST_PILL: Transition = {
  duration: 0.19,
  ease: EASE_EXIT,
};

export const ENTER_DETAILS: Transition = {
  duration: 0.22,
  ease: EASE_ENTER,
};

export const EXIT_DETAILS: Transition = {
  duration: 0.175,
  ease: EASE_EXIT,
};

export const SWITCH_KNOB_TRANSITION: Transition = {
  duration: 0.22,
  ease: EASE_ON_SCREEN,
};

export const KEYFRAME_ERROR_SHAKE = {
  x: [0, -9, 9, -6, 6, -3, 3, 0],
  transition: {
    duration: 0.42,
    ease: "easeInOut" as const,
  },
};

export function listRowTransition(
  index: number,
  reducedMotion = false,
): Transition {
  if (reducedMotion) return { duration: 0 };
  return {
    duration: 0.18,
    delay: Math.min(index, 8) * 0.03,
    ease: EASE_ON_SCREEN,
  };
}

export function detailSettleTransition(
  step: number,
  reducedMotion = false,
): Transition {
  if (reducedMotion) return { duration: 0 };
  return {
    duration: 0.2,
    delay: Math.min(step, 6) * 0.04,
    ease: EASE_ENTER,
  };
}

/**
 * Decouples horizontal and vertical easing so diagonal travel forms a gentle arc
 * rather than a flat straight-line diagonal tween.
 */
export function arcTransition(duration = 0.25, isExit = false): Transition {
  const mainEase = isExit ? EASE_EXIT : EASE_ENTER;
  return {
    duration,
    ease: mainEase,
    x: { duration, ease: EASE_ENTER },
    y: { duration, ease: EASE_ON_SCREEN },
  };
}

/**
 * Logarithmic rubberband resistance when dragging past container/viewport bounds.
 */
export function rubberbandOffset(
  overshoot: number,
  dimension: number,
  coefficient = 0.55,
): number {
  if (overshoot === 0 || dimension <= 0) return 0;
  const abs = Math.abs(overshoot);
  const damped =
    (abs * dimension * coefficient) / (dimension + abs * coefficient);
  return overshoot < 0 ? -damped : damped;
}

export interface TriggerOriginVector {
  x: number;
  y: number;
  originX: string;
  originY: string;
}

interface CapturedRect {
  left: number;
  top: number;
  width: number;
  height: number;
  capturedAt: number;
}

const TRIGGER_SELECTOR =
  'button, a, summary, [role="button"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], [role="radio"], [role="switch"], [role="tab"], [data-trigger], [tabindex]:not([tabindex="-1"])';

const NON_TRIGGER_CONTAINER_SELECTOR =
  '[data-motion-surface], [role="dialog"], [role="menu"], [role="listbox"], .app-dialog, .app-dialog-backdrop';

let lastTriggerRect: CapturedRect | null = null;
let listenersBound = false;

function writeViewTransitionOrigin(x: string, y: string) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--vt-x", x);
  document.documentElement.style.setProperty("--vt-y", y);
}

function resolveTriggerElement(target: EventTarget | null): Element | null {
  const el =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  if (!el) return null;
  const trigger = el.closest(TRIGGER_SELECTOR);
  if (!trigger) return null;
  if (trigger.matches(NON_TRIGGER_CONTAINER_SELECTOR)) return null;
  if (
    trigger.matches(':disabled, [aria-disabled="true"]') ||
    (trigger instanceof HTMLButtonElement && trigger.disabled)
  ) {
    return null;
  }
  return trigger;
}

function recordElementTrigger(target: EventTarget | null): boolean {
  const trigger = resolveTriggerElement(target);
  if (!trigger) return false;
  const rect = trigger.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  lastTriggerRect = {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    capturedAt: Date.now(),
  };
  writeViewTransitionOrigin(
    `${Math.round(rect.left + rect.width / 2)}px`,
    `${Math.round(rect.top + rect.height / 2)}px`,
  );
  return true;
}

export function hasRecentUserTrigger(maxAgeMs = 1800): boolean {
  return (
    lastTriggerRect !== null &&
    Date.now() - lastTriggerRect.capturedAt < maxAgeMs
  );
}

export function ensureViewTransitionOrigin(
  explicitTrigger?: EventTarget | null,
) {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (explicitTrigger && recordElementTrigger(explicitTrigger)) {
    return;
  }
  if (lastTriggerRect && Date.now() - lastTriggerRect.capturedAt < 1800) {
    writeViewTransitionOrigin(
      `${Math.round(lastTriggerRect.left + lastTriggerRect.width / 2)}px`,
      `${Math.round(lastTriggerRect.top + lastTriggerRect.height / 2)}px`,
    );
    return;
  }
  if (document.activeElement && recordElementTrigger(document.activeElement)) {
    return;
  }
  writeViewTransitionOrigin("50%", "50%");
}

export function ensureTriggerTracker() {
  if (typeof window === "undefined" || listenersBound) return;
  listenersBound = true;
  window.addEventListener(
    "pointerdown",
    (e) => {
      recordElementTrigger(e.target);
    },
    { capture: true, passive: true },
  );
  window.addEventListener(
    "click",
    (e) => {
      recordElementTrigger(e.target);
    },
    { capture: true, passive: true },
  );
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter" || e.key === " ") {
        recordElementTrigger(document.activeElement);
      }
    },
    { capture: true, passive: true },
  );
}

if (typeof window !== "undefined") {
  ensureTriggerTracker();
}

export function captureTriggerOriginVector(
  targetRect?: { left: number; top: number; width: number; height: number },
): TriggerOriginVector {
  if (typeof window === "undefined") {
    return { x: 0, y: 10, originX: "center", originY: "center" };
  }
  const rect =
    lastTriggerRect && Date.now() - lastTriggerRect.capturedAt < 1800
      ? lastTriggerRect
      : null;
  if (!rect) {
    return { x: 0, y: 10, originX: "center", originY: "center" };
  }
  const triggerCenterX = rect.left + rect.width / 2;
  const triggerCenterY = rect.top + rect.height / 2;
  const targetCenterX = targetRect
    ? targetRect.left + targetRect.width / 2
    : window.innerWidth / 2;
  const targetCenterY = targetRect
    ? targetRect.top + targetRect.height / 2
    : window.innerHeight / 2;

  const rawDx = triggerCenterX - targetCenterX;
  const rawDy = triggerCenterY - targetCenterY;

  const x = Math.max(-160, Math.min(160, Math.round(rawDx * 0.34)));
  const y = Math.max(-120, Math.min(120, Math.round(rawDy * 0.34)));

  const originX =
    rawDx < -36 ? "left" : rawDx > 36 ? "right" : "center";
  const originY =
    rawDy < -36 ? "top" : rawDy > 36 ? "bottom" : "center";

  return { x, y, originX, originY };
}
