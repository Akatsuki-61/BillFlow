"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/Workspace";
import { useToast } from "@/context/ToastContext";
import { useData, useSettings } from "@/lib/data/DataProvider";
import type {
  FinancialDigestSummary,
  UpdateSettingsInput,
} from "@/types/settings";

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
    <section
      className="ui-card space-y-5"
      aria-labelledby="workspace-interface-heading"
    >
      <div>
        <h2 id="workspace-interface-heading" className="font-semibold">
          Workspace interface
        </h2>
        <p className="text-content-neutral-600">
          Set the text style, spacing, and position of in-app notifications.
        </p>
      </div>
      <div className="grid gap-x-5 gap-y-4 border-t border-line-neutral-200 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label
            htmlFor="workspace-typeface"
            className="block text-xs font-medium"
          >
            Typeface
          </label>
          <select
            id="workspace-typeface"
            name="typeface"
            className="ui-field w-full border border-line-neutral-300 px-3.5"
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
        </div>
        <div>
          <label
            htmlFor="workspace-layout-density"
            className="block text-xs font-medium"
          >
            Layout density
          </label>
          <select
            id="workspace-layout-density"
            name="layoutDensity"
            className="ui-field w-full border border-line-neutral-300 px-3.5"
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
        </div>
        <div>
          <label
            htmlFor="workspace-notification-placement"
            className="block text-xs font-medium"
          >
            Notification placement
          </label>
          <select
            id="workspace-notification-placement"
            name="notificationPlacement"
            className="ui-field w-full border border-line-neutral-300 px-3.5"
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
        </div>
      </div>
    </section>
  );
}

export function FinancialDigestSettings() {
  const { settings, updateSettings } = useSettings();
  const { isElectron } = useData();
  const { showToast } = useToast();
  const [digestSummary, setDigestSummary] =
    useState<FinancialDigestSummary | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void window.billflow?.digest
      ?.summary()
      .then((summary) => {
        if (active) setDigestSummary(summary);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleToggleDigest = async (enabled: boolean) => {
    try {
      await updateSettings({ digestEnabled: enabled });
      showToast(
        enabled
          ? "Morning financial digest enabled."
          : "Morning financial digest paused.",
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not update digest setting.",
        "error",
      );
    }
  };

  const handleSendTestDigest = async () => {
    if (!window.billflow?.digest?.sendTest) return;
    setIsBusy(true);
    try {
      const res = await window.billflow.digest.sendTest();
      setDigestSummary(res.summary);
      showToast(res.summary.headline);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not send digest.",
        "error",
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section
      className="ui-card space-y-4"
      aria-labelledby="digest-settings-heading"
    >
      <div>
        <h2 id="digest-settings-heading" className="font-semibold">
          Financial digest
        </h2>
        <p className="text-content-neutral-600">
          Get a daily notification for overdue invoices, tasks due today, and
          upcoming vendor payouts.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-neutral-200 pt-4">
        <div className="flex items-center gap-2">
          <input
            id="financial-digest-enabled"
            name="digestEnabled"
            type="checkbox"
            disabled={!isElectron}
            checked={settings?.digestEnabled !== false}
            onChange={(event) => void handleToggleDigest(event.target.checked)}
            className="size-4 accent-accent"
          />
          <label
            htmlFor="financial-digest-enabled"
            className="!mb-0 font-medium"
          >
            Show daily financial digest
          </label>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={!isElectron || isBusy}
          onClick={() => void handleSendTestDigest()}
        >
          <Bell size={15} aria-hidden="true" />
          Send test notification
        </Button>
      </div>
      {digestSummary && (
        <div className="space-y-1 rounded-xl border border-line-neutral-200 p-3">
          <p className="font-semibold">{digestSummary.headline}</p>
          <p className="text-content-neutral-600">{digestSummary.body}</p>
        </div>
      )}
    </section>
  );
}
