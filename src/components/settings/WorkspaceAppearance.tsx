"use client";

import { useEffect } from "react";
import { useSettings } from "@/lib/data/DataProvider";
import type { UpdateSettingsInput } from "@/types/settings";

export function WorkspaceAppearance() {
  const { settings } = useSettings();
  const font = settings?.typeface ?? "inter";
  const density = settings?.layoutDensity ?? "comfortable";
  const placement = settings?.notificationPlacement ?? "bottom-right";
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.workspaceTypeface = font;
    root.dataset.workspaceDensity = density;
    root.dataset.notificationPlacement = placement;
  }, [font, density, placement]);
  return null;
}

export function AppearanceFields({
  value,
  onChange,
}: {
  value: UpdateSettingsInput;
  onChange: (patch: UpdateSettingsInput) => void;
}) {
  return (
    <section className="ui-card p-5 space-y-3">
      <h2 className="text-base font-semibold">Workspace interface</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-xs font-medium">
          <span>Typeface</span>
          <select
            className="ui-field w-full"
            value={value.typeface ?? "inter"}
            onChange={(event) =>
              onChange({
                typeface: event.target.value as UpdateSettingsInput["typeface"],
              })
            }
          >
            <option value="inter">Inter</option>
            <option value="nunito">Nunito</option>
            <option value="jakarta">Plus Jakarta Sans</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium">
          <span>Layout density</span>
          <select
            className="ui-field w-full"
            value={value.layoutDensity ?? "comfortable"}
            onChange={(event) =>
              onChange({
                layoutDensity: event.target
                  .value as UpdateSettingsInput["layoutDensity"],
              })
            }
          >
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="spacious">Spacious</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium">
          <span>Notification placement</span>
          <select
            className="ui-field w-full"
            value={value.notificationPlacement ?? "bottom-right"}
            onChange={(event) =>
              onChange({
                notificationPlacement: event.target
                  .value as UpdateSettingsInput["notificationPlacement"],
              })
            }
          >
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-left">Bottom left</option>
            <option value="top-right">Top right</option>
            <option value="top-left">Top left</option>
          </select>
        </label>
      </div>
    </section>
  );
}
