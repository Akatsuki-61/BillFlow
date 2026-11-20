"use client";

import Image from "next/image";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  m,
  useIsPresent,
  useReducedMotion,
} from "motion/react";
import { ArrowLeft, ArrowRight, Bell, CalendarDays, Plus } from "lucide-react";
import { useProfiles } from "@/context/ProfileContext";
import { useIsMac } from "@/lib/platform-shortcuts";
import type { Currency } from "@/types/billing";
import { PROFILE_ROLE_PRESETS } from "@/types/profiles";
import { ProfileAvatarTile } from "./ProfileAvatarTile";

const steps = [
  "name",
  "company",
  "email",
  "currency",
  "review",
  "permissions",
] as const;
type Step = (typeof steps)[number] | "picker";

const fields = {
  name: {
    question: "What’s your name?",
    hint: "This is the name you’ll see on your profile.",
    placeholder: "Alex Rivera",
    autoComplete: "name",
    maxLength: 60,
  },
  company: {
    question: "Do you work under a company or studio name?",
    hint: "Optional. This name appears on invoices. You can also use your own name.",
    placeholder: "Rivera Studio",
    autoComplete: "organization",
    maxLength: 80,
  },
  email: {
    question: "What email should clients see on invoices?",
    hint: "Optional. You can add or change this later in Business profile.",
    placeholder: "alex@example.com",
    autoComplete: "email",
    maxLength: 120,
  },
} as const;

const currencies = [
  ["USD", "US dollar"],
  ["LKR", "Sri Lankan rupee"],
  ["EUR", "Euro"],
  ["GBP", "British pound"],
  ["CAD", "Canadian dollar"],
] as const;
const starterProfile = PROFILE_ROLE_PRESETS.general;
const actionStyle =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold outline-offset-4 transition-colors focus-visible:outline-2 disabled:opacity-45";
const primaryStyle = `${actionStyle} bg-white text-slate-950 hover:bg-slate-200 outline-white`;
const secondaryStyle = `${actionStyle} border border-white/25 text-slate-100 hover:bg-white/10 outline-white`;
const controlStyle =
  "w-full min-h-14 rounded-xl border border-slate-500 bg-slate-900 px-4 text-base text-white placeholder:text-slate-400 outline-offset-4 focus-visible:outline-2 focus-visible:outline-sky-200";

const StepPanel = forwardRef<
  HTMLDivElement,
  { direction: number; children: ReactNode }
>(function StepPanel({ direction, children }, forwardedRef) {
  const isPresent = useIsPresent();
  const reducedMotion = useReducedMotion();
  const panel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    panel.current
      ?.querySelector<HTMLElement>("[data-setup-focus]")
      ?.focus({ preventScroll: true });
  }, []);

  return (
    <m.div
      ref={(element) => {
        panel.current = element;
        if (typeof forwardedRef === "function") forwardedRef(element);
        else if (forwardedRef) forwardedRef.current = element;
      }}
      className="w-full"
      custom={direction}
      variants={{
        initial: (direction: number) => ({
          opacity: 0,
          x: reducedMotion ? 0 : 18 * direction,
        }),
        exit: (direction: number) => ({
          opacity: 0,
          x: reducedMotion ? 0 : -12 * direction,
          transition: { duration: reducedMotion ? 0 : 0.14 },
        }),
      }}
      initial="initial"
      animate={{ opacity: 1, x: 0 }}
      exit="exit"
      transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.75 }}
      aria-hidden={!isPresent || undefined}
      inert={!isPresent}
    >
      {children}
    </m.div>
  );
});

export function FirstRunOnboarding() {
  const {
    activeProfile,
    completeOnboarding,
    desktopSetup,
    finishSetup,
    refreshProfiles,
  } = useProfiles();
  const isMac = useIsMac();
  const reducedMotion = useReducedMotion();
  const isPresent = useIsPresent();
  const [draft, setDraft] = useState({
    name: "",
    company: "",
    email: "",
    currency: "USD" as Currency,
  });
  const [step, setStep] = useState<Step>("picker");
  const [direction, setDirection] = useState(1);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const current = desktopSetup?.permissionsPending ? "permissions" : step;
  const index = current === "picker" ? -1 : steps.indexOf(current);
  const question =
    current === "name" || current === "company" || current === "email"
      ? current
      : null;
  const field = question ? fields[question] : null;
  const invoiceName = draft.company.trim() || draft.name.trim();

  function go(next: Step, travel = 1) {
    setError("");
    setDirection(travel);
    setStep(next);
  }

  function back() {
    go(steps[index - 1] ?? "picker", -1);
  }

  async function run(key: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setError("");
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "BillFlow couldn’t complete the request.",
      );
    } finally {
      setBusy("");
    }
  }

  function nextQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (current === "name" && !draft.name.trim()) {
      setError("Enter the name you’d like to use.");
      return;
    }
    go(steps[index + 1]);
  }

  function saveProfile() {
    void run("profile", () =>
      completeOnboarding({
        studioName: invoiceName,
        email: draft.email.trim(),
        defaultCurrency: draft.currency,
        guidedSetup: true,
        profiles: [
          {
            name: draft.name.trim(),
            role: starterProfile.role,
            subtitle: "",
            avatar: starterProfile.avatar,
            accent: starterProfile.accent,
            defaultCurrency: draft.currency,
            invoicePrefix: starterProfile.invoicePrefix,
            seedRoleCatalog: false,
          },
        ],
      }),
    );
  }

  const titleStyle =
    "font-semibold tracking-tight text-[clamp(1.8rem,4vw,2.75rem)] leading-[1.12] text-white focus:outline-none";
  const hintStyle = "mt-3 max-w-[52ch] text-sm leading-6 text-slate-300";
  const nextButton = (
    <button type="submit" className={primaryStyle}>
      Continue <ArrowRight size={17} aria-hidden="true" />
    </button>
  );

  return (
    <m.main
      aria-label="BillFlow setup"
      aria-hidden={!isPresent || undefined}
      inert={!isPresent}
      className="fixed inset-0 z-[120] flex flex-col overflow-y-auto bg-[#0c1019] text-white"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 50% 12%, #1b2943 0%, #0c1019 62%)",
      }}
      exit={{ opacity: 0, transition: { duration: reducedMotion ? 0 : 0.17 } }}
    >
      <header className="app-drag-region sticky top-0 z-10 flex min-h-[96px] items-end justify-between gap-4 px-7 pb-4 pt-10 sm:px-12">
        <div className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <Image
            src="/brand/logo-white.png"
            width={24}
            height={24}
            alt=""
            unoptimized
          />
          BillFlow
        </div>
        {index >= 0 && (
          <div className="flex items-center gap-3 text-xs font-medium text-slate-300">
            <span>
              Step {index + 1} of {steps.length}
            </span>
            <progress
              className="h-1.5 w-20 appearance-none overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-white/20 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-sky-300"
              aria-label="Setup progress"
              value={index + 1}
              max={steps.length}
            />
          </div>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-[580px] flex-1 items-center px-6 py-8 sm:px-10">
        <div className="relative w-full">
          <AnimatePresence initial={false} mode="popLayout" custom={direction}>
            <StepPanel key={current} direction={direction}>
              {current === "picker" && (
                <section
                  className="text-center"
                  aria-labelledby="setup-picker-title"
                >
                  <h1 id="setup-picker-title" className={titleStyle}>
                    Who’s working?
                  </h1>
                  <p className="mt-3 text-sm text-slate-300">
                    Add a profile to set up your BillFlow workspace.
                  </p>
                  <button
                    type="button"
                    data-setup-focus
                    className="group mx-auto mt-8 flex flex-col items-center gap-3 rounded-2xl text-sm font-semibold text-slate-100 outline-offset-8 focus-visible:outline-2 focus-visible:outline-sky-200"
                    onClick={() => go("name")}
                  >
                    <span className="grid size-28 place-items-center rounded-[22px] border border-dashed border-slate-400 bg-white/[0.05] text-sky-100 transition-colors group-hover:border-sky-200 group-hover:bg-sky-300/[0.12]">
                      <Plus size={34} strokeWidth={1.6} aria-hidden="true" />
                    </span>
                    Add profile
                  </button>
                </section>
              )}

              {question && field && (
                <form
                  onSubmit={nextQuestion}
                  aria-labelledby={`setup-${question}-title`}
                >
                  <h1 id={`setup-${question}-title`} className={titleStyle}>
                    <label htmlFor={`setup-${question}`}>
                      {field.question}
                    </label>
                  </h1>
                  <p id={`setup-${question}-hint`} className={hintStyle}>
                    {field.hint}
                  </p>
                  <input
                    id={`setup-${question}`}
                    name={question}
                    data-setup-focus
                    className={`${controlStyle} mt-7`}
                    aria-describedby={`setup-${question}-hint${error ? " setup-field-error" : ""}`}
                    aria-invalid={error ? true : undefined}
                    type={question === "email" ? "email" : "text"}
                    required={question === "name"}
                    maxLength={field.maxLength}
                    autoComplete={field.autoComplete}
                    enterKeyHint="next"
                    placeholder={field.placeholder}
                    value={draft[question]}
                    onChange={(event) => {
                      setDraft({ ...draft, [question]: event.target.value });
                      if (error) setError("");
                    }}
                  />
                  {error && (
                    <p
                      id="setup-field-error"
                      role="alert"
                      className="mt-3 text-sm text-rose-200"
                    >
                      {error}
                    </p>
                  )}
                  <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      className={secondaryStyle}
                      onClick={back}
                    >
                      <ArrowLeft size={16} aria-hidden="true" /> Back
                    </button>
                    {nextButton}
                  </div>
                </form>
              )}

              {current === "currency" && (
                <form
                  onSubmit={nextQuestion}
                  aria-labelledby="setup-currency-title"
                >
                  <h1 id="setup-currency-title" className={titleStyle}>
                    <label htmlFor="setup-currency">
                      Which currency do you bill in?
                    </label>
                  </h1>
                  <p id="setup-currency-hint" className={hintStyle}>
                    This is the default for new invoices and reports.
                  </p>
                  <select
                    id="setup-currency"
                    name="currency"
                    data-setup-focus
                    aria-describedby="setup-currency-hint"
                    className={`${controlStyle} mt-7`}
                    value={draft.currency}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        currency: event.target.value as Currency,
                      })
                    }
                  >
                    {currencies.map(([code, label]) => (
                      <option key={code} value={code}>
                        {code} · {label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      className={secondaryStyle}
                      onClick={back}
                    >
                      <ArrowLeft size={16} aria-hidden="true" /> Back
                    </button>
                    {nextButton}
                  </div>
                </form>
              )}

              {current === "review" && (
                <section aria-labelledby="setup-review-title">
                  <h1
                    id="setup-review-title"
                    data-setup-focus
                    tabIndex={-1}
                    className={titleStyle}
                  >
                    Review your profile
                  </h1>
                  <div className="mt-6 rounded-2xl border border-slate-600 bg-white/[0.04] p-5">
                    <div className="flex items-center gap-4">
                      <ProfileAvatarTile
                        avatar={starterProfile.avatar}
                        accent={starterProfile.accent}
                      />
                      <h2 className="min-w-0 break-words text-lg font-semibold">
                        {draft.name.trim()}
                      </h2>
                    </div>
                    <dl className="mt-4 space-y-3 border-t border-white/15 pt-4 text-sm">
                      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                        <dt className="text-slate-300">Invoice name</dt>
                        <dd className="break-all">{invoiceName}</dd>
                      </div>
                      {draft.email.trim() && (
                        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                          <dt className="text-slate-300">Invoice email</dt>
                          <dd className="break-all">{draft.email.trim()}</dd>
                        </div>
                      )}
                      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                        <dt className="text-slate-300">Billing currency</dt>
                        <dd>{draft.currency}</dd>
                      </div>
                    </dl>
                  </div>
                  {error && (
                    <p role="alert" className="mt-3 text-sm text-rose-200">
                      {error}
                    </p>
                  )}
                  <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      className={secondaryStyle}
                      onClick={back}
                    >
                      <ArrowLeft size={16} aria-hidden="true" /> Back
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      className={primaryStyle}
                      onClick={saveProfile}
                    >
                      {busy ? "Creating profile…" : "Create profile"}
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                </section>
              )}

              {current === "permissions" && (
                <section aria-labelledby="setup-permissions-title">
                  <h1
                    id="setup-permissions-title"
                    data-setup-focus
                    tabIndex={-1}
                    className={titleStyle}
                  >
                    Optional permissions
                  </h1>
                  <p className={hintStyle}>
                    {activeProfile.name} is ready. Choose what BillFlow can use
                    on this device.
                  </p>
                  <ul className="mt-6 divide-y divide-white/15 rounded-2xl border border-slate-600 bg-white/[0.04] px-5">
                    <li className="flex flex-wrap items-center gap-3 py-4">
                      <Bell
                        size={20}
                        className="text-sky-200"
                        aria-hidden="true"
                      />
                      <div className="min-w-[160px] flex-1 text-sm">
                        <h2 className="font-semibold">Notifications</h2>
                        <p className="mt-0.5 text-xs leading-5 text-slate-300">
                          {desktopSetup?.notificationsEnabled
                            ? "Enabled in BillFlow. Delivery follows your system settings."
                            : "Get reminders for due tasks, invoices, and payouts."}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={secondaryStyle}
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void run("notifications", async () => {
                            const integrations = window.billflow!.integrations;
                            if (desktopSetup?.notificationsEnabled) {
                              await integrations.openNotificationSettings();
                            } else {
                              await integrations.requestNotifications();
                              await refreshProfiles();
                            }
                          })
                        }
                      >
                        {desktopSetup?.notificationsEnabled
                          ? "System settings"
                          : "Enable notifications"}
                      </button>
                    </li>
                    {isMac && (
                      <li className="flex flex-wrap items-center gap-3 py-4">
                        <CalendarDays
                          size={20}
                          className="text-sky-200"
                          aria-hidden="true"
                        />
                        <div className="min-w-[160px] flex-1 text-sm">
                          <h2 className="font-semibold">Apple Calendar</h2>
                          <p className="mt-0.5 text-xs leading-5 text-slate-300">
                            Sync tasks and events using macOS Automation.
                          </p>
                        </div>
                        {desktopSetup?.calendarConnected ? (
                          <span className="px-3 py-2 text-sm font-medium text-emerald-200">
                            Connected
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={secondaryStyle}
                            disabled={Boolean(busy)}
                            onClick={() =>
                              void run("calendar", async () => {
                                await window.billflow!.integrations.connectCalendar();
                                await refreshProfiles();
                              })
                            }
                          >
                            {busy === "calendar"
                              ? "Connecting…"
                              : "Connect Calendar"}
                          </button>
                        )}
                      </li>
                    )}
                  </ul>
                  {error && (
                    <p role="alert" className="mt-3 text-sm text-rose-200">
                      {error}
                    </p>
                  )}
                  <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-300">
                      You can set these up later.
                    </p>
                    <button
                      type="button"
                      className={primaryStyle}
                      disabled={Boolean(busy)}
                      onClick={() => void run("finish", finishSetup)}
                    >
                      Open BillFlow <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                </section>
              )}
            </StepPanel>
          </AnimatePresence>
        </div>
      </div>
    </m.main>
  );
}
