"use client";
import { Fragment } from "react";
import { useProfiles } from "@/context/ProfileContext";
export function ProfileWorkspace({ children }: { children: React.ReactNode }) {
  const { activeProfile, isLocked, isLoading, needsOnboarding, desktopSetup } =
    useProfiles();
  const showWorkspace =
    !isLocked &&
    !isLoading &&
    !needsOnboarding &&
    !desktopSetup?.permissionsPending;
  return (
    <Fragment key={activeProfile.id}>
      {showWorkspace ? children : null}
    </Fragment>
  );
}
