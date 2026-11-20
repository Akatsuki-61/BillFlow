"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Compass, X } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useProfiles } from "@/context/ProfileContext";
import {
  getTourStatus,
  saveTourStatus,
  TOUR_STEPS,
} from "@/lib/onboarding-tour";
import { SPRING_NAV_GLIDE } from "@/lib/motion";
import { normalizeNavPath } from "@/lib/navigation";
import {
  formatShortcut,
  formatShortcutText,
  useIsMac,
} from "@/lib/platform-shortcuts";

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const cardStyle =
  "app-no-drag fixed bottom-5 left-5 z-40 w-[360px] max-w-[calc(100vw-2.5rem)] max-h-[calc(100dvh-2.5rem)] overflow-y-auto rounded-[20px] border border-line-neutral-200 bg-surface p-4 shadow-xl";
const secondaryButton =
  "inline-flex min-h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-content-neutral-700 hover:bg-surface-neutral-100";
const primaryButton =
  "inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-[#1c1c1f] px-3 text-xs font-semibold text-white hover:opacity-90 dark:bg-white dark:text-[#111115]";

export function WorkspaceTour() {
  const router = useRouter();
  const pathname = normalizeNavPath(usePathname());
  const { activeProfile, isGateOpen, isLocked } = useProfiles();
  const isMac = useIsMac();
  const reducedMotion = useReducedMotion();
  const [status, setStatus] = useState(() => getTourStatus(activeProfile.id));
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<HighlightRect | null>(null);
  const tourRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shouldFocusStep = useRef(false);

  const step = stepIndex === null ? null : TOUR_STEPS[stepIndex];
  const visible = !isGateOpen && !isLocked;
  const showInvitation = visible && !step && !status && pathname === "/";
  const isOnStepRoute = step !== null && pathname === step.route;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  const goToStep = useCallback(
    (nextIndex: number) => {
      const nextStep = TOUR_STEPS[nextIndex];
      if (!nextStep || !visible) return;
      shouldFocusStep.current = true;
      setHighlight(null);
      setStepIndex(nextIndex);
      if (pathname !== nextStep.route) {
        router.push(nextStep.route);
      }
    },
    [pathname, router, visible],
  );

  const closeTour = useCallback(
    (finished = false) => {
      const nextStatus =
        finished || status === "completed" ? "completed" : "dismissed";
      saveTourStatus(activeProfile.id, nextStatus);
      setStatus(nextStatus);
      setStepIndex(null);
      setHighlight(null);
      shouldFocusStep.current = false;
      const target = document.querySelector<HTMLElement>(
        (step ?? TOUR_STEPS[0]).targetSelector,
      );
      target?.focus({ preventScroll: true });
    },
    [activeProfile.id, status, step],
  );

  useEffect(() => {
    const start = () => goToStep(0);
    window.addEventListener("billflow:start-tour", start);
    return () => window.removeEventListener("billflow:start-tour", start);
  }, [goToStep]);

  useEffect(() => {
    if (!visible || !step || !isOnStepRoute) return;
    const { targetSelector } = step;
    function measureTarget() {
      const rect = document.querySelector(targetSelector)?.getBoundingClientRect();
      setHighlight(
        rect && rect.width && rect.height
          ? {
              top: rect.top - 4,
              left: rect.left - 4,
              width: rect.width + 8,
              height: rect.height + 8,
            }
          : null,
      );
    }
    const raf = requestAnimationFrame(() => {
      measureTarget();
      if (shouldFocusStep.current) {
        shouldFocusStep.current = false;
        headingRef.current?.focus({ preventScroll: true });
      }
    });
    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [visible, step, isOnStepRoute]);

  const advance = useCallback(() => {
    if (stepIndex === null) return;
    if (isLast) closeTour(true);
    else goToStep(stepIndex + 1);
  }, [closeTour, goToStep, isLast, stepIndex]);

  useEffect(() => {
    if (!visible || stepIndex === null) return;
    const index = stepIndex;
    function handleKey(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.repeat
      ) return;
      if (
        document.querySelector(
          '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"], [role="menu"]',
        )
      ) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.matches("input, textarea, select"))
      ) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeTour();
      } else if (target instanceof Node && tourRef.current?.contains(target)) {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          advance();
        } else if (event.key === "ArrowLeft" && index > 0) {
          event.preventDefault();
          goToStep(index - 1);
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [advance, closeTour, goToStep, stepIndex, visible]);

  return (
    <>
      <AnimatePresence>
        {visible && step && isOnStepRoute && highlight && (
          <m.div
            key={step.id}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={highlight}
            className="pointer-events-none fixed z-40 rounded-2xl ring-2 ring-accent"
          />
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showInvitation && (
          <m.aside
            key="workspace-tour-invitation"
            aria-label="Tour invitation"
            className={cardStyle}
            exit={{ opacity: 0 }}
          >
            <div className="flex gap-2.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-faint text-accent">
                <Compass size={16} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-content-neutral-950">
                  Get to know BillFlow
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-content-neutral-600">
                  See how Overview, Invoices, Tasks, and Outsourcing fit together.
                </p>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className={secondaryButton}
                onClick={() => closeTour()}
              >
                Skip tour
              </button>
              <button
                type="button"
                className={primaryButton}
                onClick={() => goToStep(0)}
              >
                Take the tour
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          </m.aside>
        )}
        {visible && step && stepIndex !== null && (
          <m.aside
            key="workspace-tour-card"
            ref={tourRef}
            role="region"
            aria-label="BillFlow Guided Tour"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={SPRING_NAV_GLIDE}
            className={cardStyle}
          >
            <div className="flex items-center justify-between gap-2 border-b border-line-neutral-100 pb-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-faint text-accent">
                  <Compass size={14} aria-hidden="true" />
                </span>
                <span className="text-xs font-semibold tabular-nums text-content-neutral-600">
                  Quick Tour · {stepIndex + 1} of {TOUR_STEPS.length}
                </span>
                {step.shortcutHint && (
                  <kbd className="rounded border border-line-neutral-200 bg-surface-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-content-neutral-700">
                    {formatShortcut(step.shortcutHint, isMac)}
                  </kbd>
                )}
              </div>
              <button
                type="button"
                onClick={() => closeTour()}
                aria-label="Dismiss guided tour"
                className="grid size-8 shrink-0 place-items-center rounded-full text-content-neutral-600 hover:bg-surface-neutral-100"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>

            <div className="py-3">
              <h2
                ref={headingRef}
                tabIndex={-1}
                aria-describedby="workspace-tour-step-description"
                className="text-sm font-semibold leading-snug text-content-neutral-950 focus:outline-none"
              >
                {step.title}
              </h2>
              <p
                id="workspace-tour-step-description"
                className="mt-1.5 text-xs leading-relaxed text-content-neutral-600"
              >
                {formatShortcutText(step.body, isMac)}
              </p>
            </div>

            <div className="flex justify-end gap-1.5 border-t border-line-neutral-100 pt-2.5">
              {stepIndex > 0 && (
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => goToStep(stepIndex - 1)}
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  Back
                </button>
              )}
              <button type="button" className={primaryButton} onClick={advance}>
                {isLast ? (
                  <>
                    <Check size={14} aria-hidden="true" />
                    Done
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight size={14} aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </m.aside>
        )}
      </AnimatePresence>
    </>
  );
}
