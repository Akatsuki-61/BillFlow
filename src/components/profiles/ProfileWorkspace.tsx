"use client";
import { Fragment } from "react";
import { useProfiles } from "@/context/ProfileContext";
export function ProfileWorkspace({ children }: { children: React.ReactNode }) {
  const { activeProfile, isLocked, isLoading } = useProfiles();
  return (
    <Fragment key={activeProfile.id}>
      {!isLocked && !isLoading ? children : null}
    </Fragment>
  );
}
