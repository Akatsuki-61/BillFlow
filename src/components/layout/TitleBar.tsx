"use client";

import { useProfiles } from "@/context/ProfileContext";

export default function TitleBar() {
  const { isGateOpen } = useProfiles();

  return (
    <div
      className={`h-6 w-full flex select-none shrink-0 bg-canvas z-40 ${
        isGateOpen ? "app-no-drag" : "app-drag-region"
      }`}
      aria-label="Window Title Bar"
    />
  );
}
