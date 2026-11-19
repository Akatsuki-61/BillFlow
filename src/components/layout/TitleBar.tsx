"use client";

import { useSyncExternalStore } from "react";
import { useProfiles } from "@/context/ProfileContext";

const emptySubscribe = () => () => {};

export default function TitleBar() {
  const { isGateOpen } = useProfiles();
  const platform = useSyncExternalStore(
    emptySubscribe,
    () => window.billflow?.platform ?? null,
    () => null,
  );

  if (platform === "linux") return null;

  const isWindows = platform === "win32";
  return (
    <div
      style={
        isWindows
          ? { minHeight: "env(titlebar-area-height, 40px)" }
          : undefined
      }
      className={`${
        isWindows ? "h-10" : "h-6"
      } w-full flex select-none shrink-0 bg-canvas z-40 ${
        isGateOpen ? "app-no-drag" : "app-drag-region"
      }`}
    />
  );
}
