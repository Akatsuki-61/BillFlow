"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CalendarPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/tasks#calendar");
  }, [router]);

  return (
    <div className="workspace-page motion-page flex items-center justify-center min-h-[50vh]">
      <div className="text-xs text-content-neutral-400 animate-pulse">
        Redirecting to Tasks &amp; Schedule...
      </div>
    </div>
  );
}
