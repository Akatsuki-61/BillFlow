"use client";

import React from "react";

export default function TitleBar() {
  return (
    <header
      className="h-10 w-full flex select-none shrink-0 app-drag-region z-40"
      aria-label="Window Title Bar"
    >
      {/* Top bar space above sidebar: seamless with sidebar background and divider */}
      <div className="window-sidebar-spacer bg-white border-r border-neutral-200/70 h-full shrink-0" />

      {/* Top bar space above main workspace: seamless with application canvas */}
      <div className="flex-1 bg-[#faf9f5] h-full" />
    </header>
  );
}
