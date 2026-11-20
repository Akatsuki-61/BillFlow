"use client";

import dynamic from "next/dynamic";
import { AnimatePresence } from "motion/react";
import { useProfiles } from "@/context/ProfileContext";

const LazyProfileGateModal = dynamic(
  () => import("./ProfileGateModal").then((mod) => mod.ProfileGateModal),
  { ssr: false },
);
const LazyFirstRunOnboarding = dynamic(
  () => import("./FirstRunOnboarding").then((mod) => mod.FirstRunOnboarding),
  { ssr: false },
);

export function ProfileGateHost() {
  const { isGateOpen, isLocked, needsOnboarding, desktopSetup } = useProfiles();
  const showSetup =
    !isLocked && (needsOnboarding || desktopSetup?.permissionsPending);
  return (
    <AnimatePresence initial={false}>
      {showSetup ? (
        <LazyFirstRunOnboarding key="first-run" />
      ) : isGateOpen ? (
        <LazyProfileGateModal key="profiles" />
      ) : null}
    </AnimatePresence>
  );
}
