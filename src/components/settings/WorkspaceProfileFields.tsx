"use client";

import { Check, KeyRound, Lock, Plus, UsersRound } from "lucide-react";
import { useProfiles } from "@/context/ProfileContext";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Button } from "@/components/ui/Workspace";
import {
  PROFILE_ACCENT_STYLES,
  PROFILE_AVATAR_ICONS,
  ProfileAvatarTile,
} from "@/components/profiles/ProfileAvatarTile";
import { PROFILE_ROLE_LIST, type UpdateProfileInput } from "@/types/profiles";
import type { Currency } from "@/types/billing";
import type { UpdateSettingsInput } from "@/types/settings";

export type WorkspaceProfileDraft = Pick<
  UpdateProfileInput,
  "name" | "role" | "avatar" | "accent" | "photoData"
>;

const CURRENCIES = [
  ["USD", "US Dollar"],
  ["EUR", "Euro"],
  ["LKR", "Sri Lankan Rupee"],
  ["GBP", "British Pound"],
  ["CAD", "Canadian Dollar"],
] as const;

export function WorkspaceProfileFields({
  draft,
  settings,
  onProfileChange,
  onSettingsChange,
}: {
  draft: WorkspaceProfileDraft;
  settings: UpdateSettingsInput;
  onProfileChange: (patch: WorkspaceProfileDraft) => void;
  onSettingsChange: (patch: UpdateSettingsInput) => void;
}) {
  const {
    activeProfile,
    profiles,
    maxProfiles,
    openProfileGate,
    lockCurrentProfile,
  } = useProfiles();
  const profile = { ...activeProfile, ...draft };

  return (
    <section
      className="ui-card space-y-6"
      aria-labelledby="workspace-profile-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="workspace-profile-heading" className="font-semibold">
            Workspace profile
          </h2>
          <p className="text-content-neutral-600">
            Editing {activeProfile.name}. Each profile has its own records and
            billing defaults.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="small"
            variant="secondary"
            onClick={() => openProfileGate("select")}
          >
            <UsersRound size={15} aria-hidden="true" />
            Switch profile
          </Button>
          {profiles.length < maxProfiles && (
            <Button
              type="button"
              size="small"
              variant="secondary"
              onClick={() => openProfileGate("create")}
            >
              <Plus size={15} aria-hidden="true" />
              Add profile
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="workspace-profile-name" className="block font-medium">
            Profile name
          </label>
          <input
            id="workspace-profile-name"
            name="profileName"
            className="ui-field w-full border border-line-neutral-300 px-3.5"
            value={profile.name}
            maxLength={60}
            required
            onChange={(event) => onProfileChange({ name: event.target.value })}
          />
        </div>
        <div>
          <label htmlFor="workspace-profile-role" className="block font-medium">
            Role
          </label>
          <select
            id="workspace-profile-role"
            name="profileRole"
            className="ui-field w-full border border-line-neutral-300 px-3.5"
            value={profile.role}
            onChange={(event) =>
              onProfileChange({
                role: event.target.value as typeof profile.role,
              })
            }
          >
            {PROFILE_ROLE_LIST.map((preset) => (
              <option key={preset.role} value={preset.role}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="workspace-primary-currency"
            className="block font-medium"
          >
            Primary currency
          </label>
          <select
            id="workspace-primary-currency"
            name="defaultCurrency"
            className="ui-field w-full border border-line-neutral-300 px-3.5"
            value={settings.defaultCurrency ?? "USD"}
            aria-describedby="workspace-currency-help"
            onChange={(event) =>
              onSettingsChange({
                defaultCurrency: event.target.value as Currency,
              })
            }
          >
            {CURRENCIES.map(([code, label]) => (
              <option key={code} value={code}>
                {code} · {label}
              </option>
            ))}
          </select>
          <p
            id="workspace-currency-help"
            className="mt-2 text-content-neutral-600"
          >
            Used for new invoices and financial reports. Existing records keep
            their original currency.
          </p>
        </div>
        <div>
          <label
            htmlFor="workspace-invoice-prefix"
            className="block font-medium"
          >
            Invoice prefix
          </label>
          <input
            id="workspace-invoice-prefix"
            name="invoicePrefix"
            className="ui-field w-full border border-line-neutral-300 px-3.5 font-mono"
            value={settings.invoicePrefix ?? "INV-"}
            maxLength={20}
            required
            spellCheck={false}
            onChange={(event) =>
              onSettingsChange({ invoicePrefix: event.target.value })
            }
          />
        </div>
      </div>

      <fieldset className="min-w-0 rounded-2xl border border-line-neutral-200 px-4 pb-4 pt-3">
        <legend className="px-2 text-sm font-semibold">Profile avatar</legend>
        <div className="flex flex-wrap items-center gap-4 border-b border-line-neutral-200 pb-4">
          <ProfileAvatarTile
            name={profile.name}
            avatar={profile.avatar}
            accent={profile.accent}
            photoData={profile.photoData}
            size="lg"
          />
          <ImageUpload
            label="Profile photo"
            value={profile.photoData}
            showPreview={false}
            onChange={(photoData) => onProfileChange({ photoData })}
          />
        </div>
        <div className="grid gap-5 pt-4 sm:grid-cols-2">
          <fieldset className="min-w-0">
            <legend className="mb-2 text-xs font-medium">Profile icon</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PROFILE_AVATAR_ICONS).map(([icon, Icon]) => {
                const label =
                  icon === "cpu" ? "CPU" : icon[0].toUpperCase() + icon.slice(1);
                return (
                  <label
                    key={icon}
                    className="relative cursor-pointer"
                    title={label}
                  >
                    <input
                      type="radio"
                      name="profileIcon"
                      value={icon}
                      className="peer sr-only"
                      checked={profile.avatar === icon}
                      onChange={() =>
                        onProfileChange({
                          avatar: icon as typeof profile.avatar,
                        })
                      }
                    />
                    <span className="sr-only">{label}</span>
                    <span className="grid size-10 place-items-center rounded-xl border border-line-neutral-300 bg-surface text-content-neutral-700 hover:bg-surface-neutral-100 peer-checked:border-accent peer-checked:bg-accent-faint peer-checked:text-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                      <Icon
                        className="size-4.5"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      {profile.avatar === icon && (
                        <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full border border-accent bg-surface text-accent">
                          <Check size={10} strokeWidth={2.5} aria-hidden="true" />
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
            {profile.photoData && (
              <p className="mt-2 text-content-neutral-600">
                Remove the photo to show your selected icon.
              </p>
            )}
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="mb-2 text-xs font-medium">Accent color</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PROFILE_ACCENT_STYLES).map(([accent, style]) => (
                <label
                  key={accent}
                  className="relative cursor-pointer"
                  title={style.label}
                >
                  <input
                    type="radio"
                    name="profileAccent"
                    value={accent}
                    className="peer sr-only"
                    aria-label={style.label}
                    checked={profile.accent === accent}
                    onChange={() =>
                      onProfileChange({
                        accent: accent as typeof profile.accent,
                      })
                    }
                  />
                  <span
                    className="grid size-10 place-items-center rounded-full border border-line-neutral-300 text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
                    style={{ backgroundColor: style.swatch }}
                  >
                    {profile.accent === accent && (
                      <Check size={17} aria-hidden="true" />
                    )}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-content-neutral-600">
              Used for the profile icon and workspace highlights.
            </p>
          </fieldset>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-neutral-200 pt-4">
        <div>
          <h3 className="text-sm font-semibold">Profile security</h3>
          <p className="mt-1 text-content-neutral-600">
            {activeProfile.hasPassword
              ? "This profile has a passcode."
              : "This profile opens without a passcode."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeProfile.hasPassword && (
            <Button
              type="button"
              size="small"
              variant="ghost"
              onClick={lockCurrentProfile}
            >
              <Lock size={15} aria-hidden="true" />
              Lock now
            </Button>
          )}
          <Button
            type="button"
            size="small"
            variant="secondary"
            onClick={() => openProfileGate("manage", activeProfile)}
          >
            <KeyRound size={15} aria-hidden="true" />
            Manage profile access
          </Button>
        </div>
      </div>
    </section>
  );
}
