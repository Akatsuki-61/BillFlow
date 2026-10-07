"use client";
import { useEffect, useRef, useState, useEffectEvent } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/lib/data/DataProvider";
import { Button } from "@/components/ui/Workspace";
import { formatCents } from "@/lib/format";
import type { TrackingOffer } from "@/types/workflow";

export default function AdvanceTrackingPrompt() {
  const { trackingOffers } = useData();
  const offer = trackingOffers[0];
  return offer ? <TrackingDecision key={offer.invoiceId} offer={offer} /> : null;
}
function TrackingDecision({ offer }: { offer: TrackingOffer }) {
  const { workflow } = useData();
  const router = useRouter();
  const [remaining, setRemaining] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = useRef(false);
  const deadline = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  const decide = async (choice: "yes" | "no") => {
    if (chosen.current) return;
    chosen.current = true; stop(); setBusy(true); setError(null);
    try {
      const result = await workflow.tracking.decide(offer.invoiceId, choice);
      if (result.choice === "yes") router.push("/tasks");
    } catch (e) {
      chosen.current = false;
      setError(e instanceof Error ? e.message : "Could not save your choice. Retry Yes or No.");
      setBusy(false);
    }
  };
  const tick = useEffectEvent(() => {
    const seconds = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
    setRemaining(seconds);
    if (!seconds) void decide("yes");
  });
  useEffect(() => {
    deadline.current = Date.now() + 5000;
    timer.current = setInterval(() => tick(), 100);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-neutral-900/40 backdrop-blur-xs p-6">
    <section role="dialog" aria-modal="true" aria-labelledby="tracking-heading" className="ui-card w-full max-w-lg p-6 space-y-4">
      <h2 id="tracking-heading" className="text-xl font-semibold">Do you want to track this work?</h2>
      <p>{offer.code} · {offer.clientName}</p>
      <p className="text-content-neutral-600">Advance received: {formatCents(offer.receivedCents, offer.currency)}. Create a task for each service deliverable.</p>
      <p role="status">{error ? "Automatic tracking paused. Choose Yes or No to retry." : busy ? "Saving your choice…" : `Tracking starts automatically in ${remaining} seconds.`}</p>
      {error && <p role="alert" className="text-content-red-700">{error}</p>}
      <div className="flex gap-3">
        <Button autoFocus disabled={busy} onClick={() => void decide("no")}>No</Button>
        <Button variant="primary" disabled={busy} onClick={() => void decide("yes")}>Yes, track work</Button>
      </div>
    </section>
  </div>;
}
