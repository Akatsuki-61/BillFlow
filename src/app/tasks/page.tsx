"use client";

import React, { Suspense } from "react";
import TasksView from "@/components/tasks/TasksView";

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="workspace-page motion-page">
          <div className="h-10 w-48 bg-surface-neutral-200 rounded-xl" />
        </div>
      }
    >
      <TasksView defaultView="kanban" />
    </Suspense>
  );
}
