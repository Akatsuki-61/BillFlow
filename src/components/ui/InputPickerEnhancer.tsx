"use client";

import { useEffect } from "react";

/**
 * Enhances native <input type="date"> controls across the workspace so clicking
 * anywhere inside the input box opens the calendar picker, not only clicking
 * the small native right-hand icon.
 */
export function InputPickerEnhancer() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== "date") return;
      if (target.disabled || target.readOnly) return;
      if (typeof target.showPicker !== "function") return;

      const rect = target.getBoundingClientRect();
      // Native date inputs already open the picker when clicking the rightmost
      // calendar icon hitbox (~28px). Calling showPicker() there in some
      // Chromium builds can immediately toggle it shut, so only call it when
      // clicking anywhere to the left of that icon or via keyboard activation.
      const clickedNativeIndicator =
        event.clientX > 0 && rect.right - event.clientX <= 28;
      if (clickedNativeIndicator) return;

      try {
        target.showPicker();
      } catch {
        // Ignore when browser disallows programmatic picker opening
      }
    };

    let sequence = 0;
    const associateLabels = () => {
      for (const label of document.querySelectorAll<HTMLLabelElement>(
        "label:not([for])",
      )) {
        if (label.querySelector("input, select, textarea")) continue;
        const scope = label.parentElement;
        const controls = scope?.querySelectorAll<HTMLInputElement>(
          "input:not([type=hidden]), select, textarea",
        );
        if (controls?.length !== 1) continue;
        const field = controls[0];
        if (!field.id) {
          let id: string;
          do {
            id = `billflow-field-${++sequence}`;
          } while (document.getElementById(id));
          field.id = id;
        }
        label.htmlFor = field.id;
      }
    };
    associateLabels();
    const observer = new MutationObserver(associateLabels);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", handleClick);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick);
    };
  }, []);

  return null;
}
