"use client";

import React, { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  ExternalLink,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useProfiles } from "@/context/ProfileContext";
import {
  TOUR_STEPS,
  isTourCompleted,
  markTourCompleted,
  normalizeTourRoute,
  resetTourCompleted,
} from "@/lib/onboarding-tour";
import { SPRING_NAV_GLIDE } from "@/lib/motion";

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function WorkspaceTour() {
  const router = useRouter();
  const pathname = usePathname();
  const { activeProfile, isGateOpen, isLocked } = useProfiles();
  const reducedMotion = useReducedMotion();

  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(
    null,
  );
  const [tourProfileId, setTourProfileId] = useState(activeProfile.id);
  if (tourProfileId !== activeProfile.id) {
    setTourProfileId(activeProfile.id);
    setIsOpen(false);
    setHighlightRect(null);
  }

  const step = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0];

  const closeTour = useCallback(() => {
    markTourCompleted(activeProfile.id);
    setIsOpen(false);
    setHighlightRect(null);
  }, [activeProfile.id]);

  const measureTarget = useCallback(() => {
    if (!isOpen || typeof document === "undefined") {
      setHighlightRect(null);
      return;
    }
    const target = document.querySelector(step.targetSelector);
    if (!target) {
      setHighlightRect(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      setHighlightRect(null);
      return;
    }
    setHighlightRect({
      top: rect.top - 4,
      left: rect.left - 4,
      width: rect.width + 8,
      height: rect.height + 8,
    });
  }, [isOpen, step.targetSelector]);

  useEffect(() => {
    const startHandler = (event: Event) => {
      const auto = Boolean(
        (event as CustomEvent<{ auto?: boolean }>).detail?.auto,
      );
      if (auto && isTourCompleted(activeProfile.id)) return;
      if (!auto) resetTourCompleted(activeProfile.id);
      setStepIndex(0);
      setIsOpen(true);
    };
    window.addEventListener("billflow:start-tour", startHandler);
    return () =>
      window.removeEventListener("billflow:start-tour", startHandler);
  }, [activeProfile.id]);

  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(measureTarget);
    const onResize = () => measureTarget();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [isOpen, pathname, stepIndex, measureTarget]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (isGateOpen || isLocked || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (
        typeof document !== "undefined" &&
        document.querySelector(
          '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"], [role="menu"]',
        )
      ) {
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeTour();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (stepIndex < TOUR_STEPS.length - 1) {
          setStepIndex((i) => i + 1);
        } else {
          closeTour();
        }
      } else if (e.key === "ArrowLeft" && stepIndex > 0) {
        e.preventDefault();
        setStepIndex((i) => i - 1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, stepIndex, isGateOpen, isLocked, closeTour]);

  const visible = isOpen && !isGateOpen && !isLocked;
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const isOnStepRoute =
    normalizeTourRoute(pathname || "/") === normalizeTourRoute(step.route);

  return (
    <>
      <AnimatePresence>
        {visible && highlightRect && (
          <motion.div
            key={step.id}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING_NAV_GLIDE}
            style={{
              top: highlightRect.top,
              left: highlightRect.left,
              width: highlightRect.width,
              height: highlightRect.height,
            }}
            className="pointer-events-none fixed z-40 rounded-[16px] ring-2 ring-accent shadow-[0_0_0_4px_rgba(99,102,241,0.16)]"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {visible && (
          <motion.aside
            key="workspace-tour-card"
            role="region"
            aria-label="BillFlow Guided Tour"
            initial={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 12, scale: 0.97 }
            }
            animate={
              reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }
            }
            transition={SPRING_NAV_GLIDE}
            className="fixed bottom-5 left-5 z-40 w-[360px] max-w-[calc(100vw-2rem)] rounded-[20px] bg-surface border border-line-neutral-200 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_8px_16px_-4px_rgba(0,0,0,0.12),0px_24px_32px_-12px_rgba(0,0,0,0.14)] p-4 app-no-drag"
          >
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-line-neutral-100">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-accent-faint text-accent flex items-center justify-center shrink-0">
              <Compass className="w-3.5 h-3.5" />
            </span>
            <span className="text-[11.5px] font-semibold text-content-neutral-600 tabular-nums">
              Quick Tour · {stepIndex + 1} of {TOUR_STEPS.length}
            </span>
            {step.shortcutHint && (
              <kbd className="px-1.5 py-0.5 rounded bg-surface-neutral-100 border border-line-neutral-200 text-[10px] font-mono text-content-neutral-700">
                {step.shortcutHint}
              </kbd>
            )}
          </div>
          <button
            type="button"
            onClick={closeTour}
            aria-label="Dismiss guided tour"
            className="p-1 rounded-full text-content-neutral-400 hover:text-content-neutral-800 hover:bg-surface-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="py-3">
          <h3 className="text-[14.5px] font-semibold text-content-neutral-950 leading-snug">
            {step.title}
          </h3>
          <p className="mt-1.5 text-[12.5px] text-content-neutral-600 leading-relaxed">
            {step.body}
          </p>
        </div>

        <div className="pt-2.5 border-t border-line-neutral-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {!isOnStepRoute && (
              <button
                type="button"
                onClick={() => router.push(step.route)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium bg-surface-neutral-100 hover:bg-surface-neutral-200 text-content-neutral-800 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open view</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-content-neutral-600 hover:bg-surface-neutral-100 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (isLast) {
                  closeTour();
                } else {
                  setStepIndex((i) => i + 1);
                }
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[#1c1c1f] text-white dark:bg-white dark:text-[#111115] hover:opacity-90 transition-opacity cursor-pointer"
            >
              {isLast ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Done</span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
