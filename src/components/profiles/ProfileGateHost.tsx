"use client";

import dynamic from "next/dynamic";
import { useProfiles } from "@/context/ProfileContext";

const LazyProfileGateModal = dynamic(
  () => import("./ProfileGateModal").then((mod) => mod.ProfileGateModal),
  { ssr: false },
);

export function ProfileGateHost() {
  const { isGateOpen } = useProfiles();
  if (!isGateOpen) return null;
  return <LazyProfileGateModal />;
}
